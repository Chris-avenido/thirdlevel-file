import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiAlertTriangle, FiTrash2, FiCalendar, FiFileText, FiInfo } from 'react-icons/fi';
import Swal from 'sweetalert2';
import { apiUrl } from '../utils/api';
import ModernDatePicker from './ModernDatePicker';

const VACATE_REASONS = [
  'Resignation',
  'Retirement',
  'Promotion',
  'Demotion',
  'Dismissal',
  'Other'
];

const VacateOfficialModal = ({
  isOpen,
  official,
  onClose,
  onSuccess,
  token
}) => {
  const [effectivityDate, setEffectivityDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [vacateReason, setVacateReason] = useState('');
  const [justification, setJustification] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : '');

  const targetTLOid = official?.TLOid || official?.tloid || '';
  const officialName = `${official?.first_name || ''} ${official?.last_name || ''}`.trim() || targetTLOid;
  const positionTitle = official?.position_title || 'Position';
  const isPendingAction = ['Vacating', 'Resigning', 'Inactive', 'Reassigning', 'Pending Assignment'].includes(
    official?.status
  );

  // Reset form or load existing pending vacancy update when modal opens
  useEffect(() => {
    if (!isOpen || !official || !targetTLOid) {
      setEffectivityDate(new Date().toISOString().split('T')[0]);
      setVacateReason('');
      setJustification('');
      return;
    }

    const loadOfficialData = async () => {
      setJustification('');
      setVacateReason('');

      const isPendingStatus = ['Vacating', 'Resigning', 'Inactive'].includes(official.status);

      if (isPendingStatus) {
        if (official.effectivity_date) {
          const d = new Date(official.effectivity_date);
          const offset = d.getTimezoneOffset();
          const localDate = new Date(d.getTime() - offset * 60 * 1000);
          setEffectivityDate(localDate.toISOString().split('T')[0]);
        }

        try {
          const res = await fetch(apiUrl(`/api/third-level/officials/${targetTLOid}/last-vacate-update`), {
            headers: {
              Authorization: `Bearer ${activeToken}`
            }
          });
          const data = await res.json();
          if (data.success && data.data) {
            setVacateReason(data.data.vacate_reason || '');
            setJustification(data.data.remarks || '');
          }
        } catch (err) {
          console.error('Failed to fetch last vacate update:', err);
        }
      } else {
        setEffectivityDate(new Date().toISOString().split('T')[0]);
      }
    };

    loadOfficialData();
  }, [isOpen, official, targetTLOid, activeToken]);

  if (!isOpen || !official) return null;

  const handleConfirmVacate = async (e) => {
    if (e) e.preventDefault();

    if (!vacateReason) {
      return Swal.fire({
        icon: 'warning',
        title: 'Reason Required',
        text: 'Please select a Reason for Vacating.',
        confirmButtonColor: '#08315F'
      });
    }

    if (!effectivityDate) {
      return Swal.fire({
        icon: 'warning',
        title: 'Effectivity Date Required',
        text: 'Please select a Date of Effectivity.',
        confirmButtonColor: '#08315F'
      });
    }

    if (!justification.trim()) {
      return Swal.fire({
        icon: 'warning',
        title: 'Justification Required',
        text: 'Please provide justification / remarks for this action.',
        confirmButtonColor: '#08315F'
      });
    }

    const confirmResult = await Swal.fire({
      title: 'Confirm Vacate Action',
      html: `Are you sure you want to mark <strong>${officialName}</strong> as vacated from <strong>${positionTitle}</strong> effective <strong>${effectivityDate}</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Vacate Official',
      cancelButtonText: 'Cancel'
    });

    if (!confirmResult.isConfirmed) return;

    setActionLoading(true);
    try {
      const res = await fetch(apiUrl('/api/third-level/admin-action'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`
        },
        body: JSON.stringify({
          TLOid: targetTLOid,
          action: 'vacate',
          justification,
          vacateReason,
          effectivityDate
        })
      });

      const data = await res.json();
      if (data.success) {
        await Swal.fire({
          icon: 'success',
          title: 'Action Completed',
          text: `${officialName} has vacated ${positionTitle}.`,
          confirmButtonColor: '#08315F'
        });
        onClose();
        if (typeof onSuccess === 'function') {
          onSuccess(data);
        }
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Action Failed',
          text: data.error || 'Failed to process vacate action.',
          confirmButtonColor: '#08315F'
        });
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Network Error',
        text: 'Action failed: ' + err.message,
        confirmButtonColor: '#08315F'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelVacate = async () => {
    const result = await Swal.fire({
      title: 'Cancel Scheduled Action?',
      text: 'Are you sure you want to cancel this scheduled action and restore the official to Active status?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#08315F',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Yes, Restore to Active',
      cancelButtonText: 'Keep Action'
    });

    if (!result.isConfirmed) return;

    setActionLoading(true);
    try {
      const res = await fetch(apiUrl('/api/third-level/admin-action'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`
        },
        body: JSON.stringify({
          TLOid: targetTLOid,
          action: 'cancel-vacate',
          justification: 'Cancelled scheduled action via Admin Portal'
        })
      });

      const data = await res.json();
      if (data.success) {
        await Swal.fire({
          icon: 'success',
          title: 'Action Cancelled',
          text: 'Official has been restored to Active status.',
          confirmButtonColor: '#08315F'
        });
        onClose();
        if (typeof onSuccess === 'function') {
          onSuccess(data);
        }
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: data.error || 'Could not cancel action.',
          confirmButtonColor: '#08315F'
        });
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Network Error',
        text: 'Action failed: ' + err.message,
        confirmButtonColor: '#08315F'
      });
    } finally {
      setActionLoading(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6 bg-slate-900/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 25 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 25 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl border-2 border-slate-100 overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-7 md:p-8 bg-gradient-to-r from-rose-50/70 via-slate-50 to-white border-b-2 border-slate-100 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 text-rose-600 text-[13px] font-black uppercase tracking-widest mb-1.5">
                <FiTrash2 size={16} />
                <span>Administrative Action</span>
              </div>
              <h2 className="text-[32px] md:text-[38px] font-['Plus_Jakarta_Sans'] font-black text-[#08315F] tracking-tight uppercase italic leading-none">
                VACATING OFFICIAL
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-slate-700 font-black text-[17px]">
                  {officialName}
                </span>
                <span className="text-slate-300 font-bold">•</span>
                <span className="text-slate-500 font-semibold text-[14px]">
                  {positionTitle}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-black font-mono">
                  {official.TLOid}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-2xl bg-white text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all border-2 border-slate-200 shadow-sm shrink-0"
              title="Close modal"
            >
              <FiX size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-7 md:p-8 overflow-y-auto space-y-6">
            {/* Status Notice Banner if already in transition */}
            {isPendingAction && (
              <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900">
                <FiAlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                <div className="text-[13.5px] leading-relaxed">
                  <span className="font-black uppercase tracking-wider block text-amber-800">
                    Current Status: {official.status}
                  </span>
                  This official has a pending or active movement status. You can update the details or cancel the action below.
                </div>
              </div>
            )}

            {/* Date of Effectivity */}
            <div>
              <label className="text-[13.5px] font-black text-slate-500 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                <FiCalendar size={14} className="text-[#08315F]" />
                Date of Effectivity <span className="text-rose-500">*</span>
              </label>
              <ModernDatePicker
                value={effectivityDate}
                onChange={(val) => setEffectivityDate(val)}
                className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#08315F] rounded-2xl py-3.5 px-4 text-[16px] font-bold text-slate-800 outline-none transition-all"
              />
              <p className="text-[12px] font-medium text-slate-400 mt-1.5">
                If the date is in the future, status becomes &quot;Vacating&quot; until that date.
              </p>
            </div>

            {/* Reason for Vacating */}
            <div>
              <label className="text-[13.5px] font-black text-slate-500 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                <FiInfo size={14} className="text-[#08315F]" />
                Reason for Vacating <span className="text-rose-500">*</span>
              </label>
              <select
                value={vacateReason}
                onChange={(e) => setVacateReason(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#08315F] rounded-2xl py-3.5 px-4 text-[16px] font-bold text-slate-800 outline-none transition-all cursor-pointer"
              >
                <option value="">Select a reason...</option>
                {VACATE_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>

            {/* Justification / Remarks */}
            <div>
              <label className="text-[13.5px] font-black text-slate-500 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                <FiFileText size={14} className="text-[#08315F]" />
                Justification / Remarks <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Please state the administrative basis or reason..."
                rows={3}
                className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#08315F] rounded-2xl py-3.5 px-4 text-[15px] font-semibold text-slate-800 outline-none transition-all resize-none shadow-inner"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmVacate}
                className="flex-1 py-4 px-6 bg-[#08315F] text-white rounded-2xl font-black text-[15px] uppercase tracking-wider shadow-lg shadow-blue-950/20 hover:bg-[#0b417e] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <FiTrash2 size={16} />
                {actionLoading ? 'Processing...' : 'Confirm Vacate'}
              </button>

              {isPendingAction && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleCancelVacate}
                  className="py-4 px-6 bg-rose-50 text-rose-600 border-2 border-rose-200 rounded-2xl font-black text-[15px] uppercase tracking-wider hover:bg-rose-100 hover:border-rose-300 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading ? 'Processing...' : 'Cancel Action'}
                </button>
              )}

              <button
                type="button"
                disabled={actionLoading}
                onClick={onClose}
                className="py-4 px-5 bg-slate-100 text-slate-600 rounded-2xl font-black text-[15px] uppercase tracking-wider hover:bg-slate-200 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

export default VacateOfficialModal;

import React, { useState, useEffect } from 'react';
import { FiX, FiAward, FiLogOut, FiAlertCircle, FiCalendar, FiChevronDown, FiUser } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../utils/api';

const RetireesModal = ({ isOpen, onClose, retirees }) => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [selectedOfficial, setSelectedOfficial] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [loadingRemarks, setLoadingRemarks] = useState(false);

  useEffect(() => {
    if (selectedOfficial && selectedOfficial.separationReason !== 'Mandatory Retirement') {
      setLoadingRemarks(true);
      fetch(apiUrl(`/api/third-level/officials/${selectedOfficial.TLOid}/last-vacate-update`), {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) setRemarks(data.data.remarks || 'No remarks provided.');
        else setRemarks('No remarks provided.');
        setLoadingRemarks(false);
      })
      .catch(() => { setRemarks('Error loading remarks.'); setLoadingRemarks(false); });
    } else {
      setRemarks('Mandatory Retirement');
    }
  }, [selectedOfficial, token]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 font-['Quicksand']">
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200"
      >
        <div className="bg-gradient-to-r from-blue-900 to-blue-800 p-6 flex justify-between items-center text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <FiAward size={24} className="text-yellow-400" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight leading-none">Separations & Retirements</h2>
              <p className="text-xs text-blue-200 font-bold uppercase tracking-widest mt-1">
                Personnel Reaching Mandatory Age or Marked Inactive
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-red-500 rounded-xl transition-colors text-white"
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {retirees.length > 0 ? (
            <div className="space-y-3">
              {retirees.map(official => (
                <div 
                  key={official.TLOid} 
                  className="p-4 rounded-2xl border-2 border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-colors flex items-center gap-4 cursor-pointer"
                  onClick={() => setSelectedOfficial(official)}
                >
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-black text-lg border-2 border-white shadow-sm flex-shrink-0">
                    {official.first_name?.[0] || ''}{official.last_name?.[0] || ''}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 truncate text-lg leading-tight">
                        {official.first_name} {official.last_name}
                      </h3>
                      {official.separationReason && (
                         <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700 uppercase tracking-widest flex-shrink-0 max-w-[200px] truncate inline-block align-middle" title={official.separationReason}>
                           {official.separationReason}
                         </span>
                      )}
                      {official.isTurning65 && (
                         <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 uppercase tracking-widest flex-shrink-0">
                           Turns 65
                         </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 font-medium truncate mt-0.5">
                      {official.position_title || 'Unassigned'} • {official.office || 'No Office'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 hidden sm:block">
                     <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-end gap-1 mb-1">
                        <FiLogOut size={12} /> Effectivity Date
                     </div>
                     <div className="text-sm font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg text-right">
                       {official.separationDate ? new Date(official.separationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                       {official.separationDate && new Date(official.separationDate) > new Date() ? (
                         <span className="block text-[9px] text-blue-500 uppercase mt-0.5">Upcoming</span>
                       ) : (
                         <span className="block text-[9px] text-green-600 uppercase mt-0.5">Completed</span>
                       )}
                     </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500">
              <FiAward size={48} className="mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-bold text-slate-800">No Separations This Month</p>
              <p className="text-sm">There are no personnel reaching mandatory retirement age or marked inactive this month.</p>
            </div>
          )}
        </div>
        
        <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end rounded-b-3xl">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl transition-colors shadow-sm"
          >
            Acknowledge
          </button>
        </div>
      </div>

      {/* INNER MODAL FOR DETAILS */}
      {selectedOfficial && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
            <div className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl border border-white/50 animate-in zoom-in-95 duration-200">
                <div className="p-10">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <span className="text-[10px] font-black text-[#075985] uppercase tracking-widest mb-2 block">Administrative Action</span>
                            <h2 className="text-3xl font-['Quicksand'] font-black text-[#08315F] tracking-tighter uppercase italic leading-none">
                                VACATING OFFICIAL
                            </h2>
                            <p className="text-slate-400 font-bold mt-2">
                                {selectedOfficial.first_name} {selectedOfficial.last_name}
                            </p>
                        </div>
                        <button onClick={() => setSelectedOfficial(null)} className="p-3 rounded-2xl bg-slate-50 text-slate-400 hover:text-red-600 transition-all">
                            <FiX size={20} />
                        </button>
                    </div>

                    <div className="space-y-6">
                        <div className="mb-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Date of Effectivity</label>
                            <div className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-4 px-5 text-sm font-bold text-slate-700 flex justify-between items-center cursor-not-allowed">
                                <span>{selectedOfficial.separationDate ? new Date(selectedOfficial.separationDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}</span>
                                <FiCalendar className="text-slate-400" />
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Reason for Vacating</label>
                            <div className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-4 px-5 text-sm font-bold text-slate-700 flex justify-between items-center cursor-not-allowed">
                                <span>{selectedOfficial.separationReason?.split(' - ')[1] || selectedOfficial.separationReason || 'N/A'}</span>
                                <FiChevronDown className="text-slate-400" />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Justification / Remarks</label>
                            <div className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-4 px-5 text-sm font-bold text-slate-700 min-h-[100px] cursor-not-allowed">
                                {loadingRemarks ? 'Loading...' : remarks}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default RetireesModal;

import React, { useState, useEffect } from 'react';
import { FiX, FiAward, FiLogOut, FiAlertCircle, FiCalendar, FiChevronDown, FiUser, FiUsers, FiFileText } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';

const getReasonBadgeClass = (reason) => {
  const r = (reason || '').toLowerCase();
  if (r.includes('anticipat') || r.includes('retir')) return 'bg-amber-100 text-amber-900 border-amber-300';
  if (r.includes('resign')) return 'bg-rose-100 text-rose-900 border-rose-300';
  if (r.includes('promotion') || r.includes('demotion') || r.includes('dismissal')) return 'bg-purple-100 text-purple-900 border-purple-300';
  if (r.includes('vacat')) return 'bg-blue-100 text-blue-900 border-blue-300';
  return 'bg-slate-100 text-slate-800 border-slate-300';
};

const RetireesModal = ({ isOpen, onClose, retirees = [], applicationsThisMonth = [], elementsThisMonth = [] }) => {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [selectedOfficial, setSelectedOfficial] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [loadingRemarks, setLoadingRemarks] = useState(false);
  const [activeTab, setActiveTab] = useState('retirees');

  useEffect(() => {
    if (selectedOfficial) {
      if (selectedOfficial.separationReason === 'Anticipated Retirement' && !selectedOfficial.vacate_reason && !selectedOfficial.assignment_remarks) {
        setRemarks('Mandatory retirement upon reaching the mandatory retirement age of 65 years old.');
        setLoadingRemarks(false);
      } else {
        setLoadingRemarks(true);
        fetch(apiUrl(`/api/third-level/officials/${selectedOfficial.TLOid}/last-vacate-update`), {
          headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data?.remarks) {
            setRemarks(data.data.remarks);
          } else if (selectedOfficial.assignment_remarks) {
            setRemarks(selectedOfficial.assignment_remarks);
          } else if (selectedOfficial.separationReason === 'Anticipated Retirement') {
            setRemarks('Mandatory retirement upon reaching the mandatory retirement age of 65 years old.');
          } else {
            setRemarks('No remarks provided.');
          }
          setLoadingRemarks(false);
        })
        .catch(() => {
          if (selectedOfficial.assignment_remarks) {
            setRemarks(selectedOfficial.assignment_remarks);
          } else {
            setRemarks('No remarks provided.');
          }
          setLoadingRemarks(false);
        });
      }
    } else {
      setRemarks('');
    }
  }, [selectedOfficial, token]);

  return (
    <AnimatePresence>
      {(isOpen && user?.role === 'Central Office') && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 font-['Plus_Jakarta_Sans',system-ui,sans-serif]"
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border-2 border-slate-200"
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#08315F] via-[#0c3d75] to-[#08315F] p-5 sm:p-6 flex justify-between items-center text-white border-b-2 border-white/10 shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="bg-white/15 p-2.5 rounded-2xl border border-white/20 text-amber-400">
                  <FiAward size={26} />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight text-white">Anticipated Vacancies</h2>
                  <p className="text-xs sm:text-sm text-blue-200 font-bold uppercase tracking-wider mt-0.5">
                    Upcoming Vacancies & Scheduled Retirements
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2.5 bg-white/10 hover:bg-rose-600 rounded-xl transition-colors text-white"
                title="Close modal"
              >
                <FiX size={20} />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="bg-slate-50 border-b-2 border-slate-100 px-6 py-2.5 flex gap-2 overflow-x-auto shrink-0">
              <button 
                onClick={() => setActiveTab('retirees')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                  activeTab === 'retirees' 
                    ? 'bg-blue-100 text-[#08315F] border border-blue-300 shadow-xs' 
                    : 'text-slate-500 hover:bg-slate-200/60 hover:text-slate-800'
                }`}
              >
                <span>Anticipated Vacancies</span>
                <span className="bg-[#08315F] text-white px-2 py-0.5 rounded-full text-[11px] font-black font-mono">
                  {retirees.length}
                </span>
              </button>
            </div>

            {/* Modal Content List */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
              {activeTab === 'retirees' && (
                retirees.length > 0 ? (
                  <div className="space-y-3">
                    {retirees.map(official => (
                      <div 
                        key={official.TLOid} 
                        className="p-4 sm:p-5 rounded-2xl border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer group"
                        onClick={() => setSelectedOfficial(official)}
                      >
                        {/* Official Details */}
                        <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                          <div className="w-12 h-12 rounded-full bg-blue-100 text-[#08315F] flex items-center justify-center font-black text-base border-2 border-white shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                            {official.first_name?.[0] || ''}{official.last_name?.[0] || ''}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-extrabold text-slate-800 text-base sm:text-lg leading-tight">
                                {official.first_name} {official.last_name}
                              </h3>
                              {official.separationReason && (
                                <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border uppercase tracking-wider shrink-0 ${getReasonBadgeClass(official.separationReason)}`} title={official.separationReason}>
                                  {official.separationReason}
                                </span>
                              )}
                              {official.isTurning65 && (
                                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 uppercase tracking-wider shrink-0">
                                  Turns 65
                                </span>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm text-slate-500 font-semibold mt-1 leading-normal">
                              {official.position_title || 'Unassigned'} {official.office ? `• ${official.office}` : ''}
                            </p>
                          </div>
                        </div>

                        {/* Effectivity Date Card */}
                        <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                          <div className="text-left md:text-right">
                            <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center md:justify-end gap-1 mb-1">
                              <FiLogOut size={13} /> Effectivity Date
                            </div>
                            <div className="text-sm sm:text-base font-extrabold text-slate-800 bg-slate-100 px-3.5 py-1.5 rounded-xl border border-slate-200">
                              <span>
                                {official.separationDate ? new Date(official.separationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                              </span>
                              {official.separationDate && new Date(official.separationDate) > new Date() ? (
                                <span className="block text-[11px] font-black text-sky-600 uppercase mt-0.5">Upcoming</span>
                              ) : (
                                <span className="block text-[11px] font-black text-emerald-600 uppercase mt-0.5">Completed</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-3xl p-6">
                    <FiAward className="mx-auto text-slate-300 mb-3" size={44} />
                    <h3 className="text-xl font-black text-[#08315F] uppercase tracking-wide">No Anticipated Vacancies</h3>
                    <p className="text-sm font-semibold text-slate-400 mt-1 max-w-md mx-auto">
                      There are no upcoming scheduled vacancies or retirements within the next 5 years.
                    </p>
                  </div>
                )
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="bg-slate-50 p-4 border-t-2 border-slate-100 flex justify-end shrink-0">
              <button 
                onClick={onClose}
                className="px-6 py-2.5 bg-[#08315F] hover:bg-blue-800 text-white font-bold rounded-xl transition-colors shadow-sm text-sm sm:text-base"
              >
                Acknowledge
              </button>
            </div>
          </motion.div>

          {/* INNER MODAL FOR DETAILS */}
          <AnimatePresence>
            {selectedOfficial && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md"
              >
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0, y: 15 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 15 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border-2 border-slate-200 overflow-hidden"
                >
                  <div className="p-6 sm:p-8">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <span className="text-xs font-black text-[#075985] uppercase tracking-wider mb-1 block">Administrative Action</span>
                        <h2 className="text-2xl sm:text-3xl font-black text-[#08315F] tracking-tight uppercase italic leading-tight">
                          {selectedOfficial.separationReason === 'Anticipated Retirement' ? 'Anticipated Retirement' : 'Scheduled Vacancy'}
                        </h2>
                        <p className="text-slate-500 text-sm sm:text-base font-bold mt-1">
                          {selectedOfficial.first_name} {selectedOfficial.last_name}
                        </p>
                      </div>
                      <button 
                        onClick={() => setSelectedOfficial(null)} 
                        className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-rose-600 transition-all border border-slate-200"
                        title="Close details"
                      >
                        <FiX size={18} />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1.5 block">Date of Effectivity</label>
                        <div className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-3 px-4 text-sm sm:text-base font-bold text-slate-800 flex justify-between items-center">
                          <span>{selectedOfficial.separationDate ? new Date(selectedOfficial.separationDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}</span>
                          <FiCalendar className="text-slate-400" size={18} />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1.5 block">Reason for Vacating</label>
                        <div className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-3 px-4 text-sm sm:text-base font-bold text-slate-800 flex justify-between items-center">
                          <span>{selectedOfficial.separationReason?.split(' - ')[1] || selectedOfficial.separationReason || 'N/A'}</span>
                          <FiChevronDown className="text-slate-400" size={18} />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1.5 block">Justification / Remarks</label>
                        <div className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-3 px-4 text-sm sm:text-base font-bold text-slate-800 min-h-[90px] leading-relaxed">
                          {loadingRemarks ? 'Loading...' : remarks}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RetireesModal;


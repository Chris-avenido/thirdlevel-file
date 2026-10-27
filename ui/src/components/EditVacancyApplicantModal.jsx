import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheck, FiLoader, FiUser, FiPhone, FiFileText, FiBookmark } from 'react-icons/fi';
import Swal from 'sweetalert2';

const EditVacancyApplicantModal = ({
    isOpen,
    onClose,
    applicantProfile,
    onSave,
    vacancies = []
}) => {
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        first_name: '',
        middle_name: '',
        last_name: '',
        suffix: '',
        contact_number: '',
        target_vacancy_id: '',
        target_position_title: '',
        notes: ''
    });

    useEffect(() => {
        if (applicantProfile) {
            setFormData({
                first_name: applicantProfile.first_name || '',
                middle_name: applicantProfile.middle_name || '',
                last_name: applicantProfile.last_name || '',
                suffix: applicantProfile.suffix || '',
                contact_number: applicantProfile.contact_number || '',
                target_vacancy_id: applicantProfile.target_vacancy_id || '',
                target_position_title: applicantProfile.target_position_title || '',
                notes: applicantProfile.notes || ''
            });
        }
    }, [applicantProfile, isOpen]);

    const handleVacancySelect = (e) => {
        const selectedId = e.target.value;
        if (!selectedId) {
            setFormData(prev => ({
                ...prev,
                target_vacancy_id: '',
                target_position_title: ''
            }));
            return;
        }

        const found = vacancies.find(v => (v.TLOid || v.item_number || String(v.assignment_id)) === selectedId);
        if (found) {
            setFormData(prev => ({
                ...prev,
                target_vacancy_id: found.TLOid || found.item_number || selectedId,
                target_position_title: found.position_title || ''
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                target_vacancy_id: selectedId
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.first_name.trim() || !formData.last_name.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Required Information',
                text: 'First name and last name are required fields.',
                confirmButtonColor: '#08315F'
            });
            return;
        }

        setSaving(true);
        try {
            await onSave(formData);
            Swal.fire({
                icon: 'success',
                title: 'Data Updated',
                text: 'Your applicant data in vacancy_applicants has been saved successfully.',
                timer: 1800,
                showConfirmButton: false
            });
            onClose();
        } catch (err) {
            console.error('Failed to update applicant data:', err);
            Swal.fire({
                icon: 'error',
                title: 'Update Error',
                text: err.message || 'Unable to update applicant profile.',
                confirmButtonColor: '#08315F'
            });
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
                />

                {/* Modal Window */}
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 15 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 15 }}
                    className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[90vh]"
                >
                    {/* Header Banner */}
                    <div className="bg-[#08315F] text-white px-6 py-5 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white font-black">
                                <FiUser size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-tight">Edit Applicant Data</h3>
                                <p className="text-[10px] text-blue-200 uppercase tracking-widest font-mono">
                                    Table: vacancy_applicants • UID: {applicantProfile?.applicant_uid}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                        >
                            <FiX size={18} />
                        </button>
                    </div>

                    {/* Scrollable Form Body */}
                    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                        
                        {/* Name Grid */}
                        <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#08315F] mb-3 flex items-center gap-2">
                                <FiUser size={13} className="text-[#075985]" /> Personal Identification
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                                        First Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.first_name}
                                        onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#08315F] focus:ring-2 focus:ring-[#08315F]/15 text-xs font-bold text-slate-800 outline-none uppercase transition-all"
                                        placeholder="e.g. JUAN"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                                        Middle Name
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.middle_name}
                                        onChange={e => setFormData({ ...formData, middle_name: e.target.value })}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#08315F] focus:ring-2 focus:ring-[#08315F]/15 text-xs font-bold text-slate-800 outline-none uppercase transition-all"
                                        placeholder="e.g. SANTOS"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                                        Last Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.last_name}
                                        onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#08315F] focus:ring-2 focus:ring-[#08315F]/15 text-xs font-bold text-slate-800 outline-none uppercase transition-all"
                                        placeholder="e.g. DELA CRUZ"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                                        Suffix
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.suffix}
                                        onChange={e => setFormData({ ...formData, suffix: e.target.value })}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#08315F] focus:ring-2 focus:ring-[#08315F]/15 text-xs font-bold text-slate-800 outline-none uppercase transition-all"
                                        placeholder="e.g. Jr., III, Ph.D."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Contact Information */}
                        <div className="pt-2 border-t border-slate-100">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#08315F] mb-3 flex items-center gap-2">
                                <FiPhone size={13} className="text-[#075985]" /> Contact Details
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                                        Email Address (Official)
                                    </label>
                                    <input
                                        type="email"
                                        disabled
                                        value={applicantProfile?.email || ''}
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-500 cursor-not-allowed outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                                        Contact Number
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.contact_number}
                                        onChange={e => setFormData({ ...formData, contact_number: e.target.value })}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#08315F] focus:ring-2 focus:ring-[#08315F]/15 text-xs font-bold text-slate-800 outline-none transition-all"
                                        placeholder="09123456789"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Target Vacancy Position */}
                        <div className="pt-2 border-t border-slate-100">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#08315F] mb-3 flex items-center gap-2">
                                <FiBookmark size={13} className="text-[#075985]" /> Target Vacancy Application
                            </h4>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                                        Select from Available Positions
                                    </label>
                                    <select
                                        value={formData.target_vacancy_id}
                                        onChange={handleVacancySelect}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#08315F] focus:ring-2 focus:ring-[#08315F]/15 text-xs font-bold text-slate-800 outline-none transition-all cursor-pointer bg-white"
                                    >
                                        <option value="">-- No Target Vacancy Selected --</option>
                                        {vacancies.map(v => {
                                            const id = v.TLOid || v.item_number || String(v.assignment_id);
                                            return (
                                                <option key={id} value={id}>
                                                    {v.position_title} ({v.office || 'DepEd'} • Item: {id})
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                                {formData.target_position_title && (
                                    <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/60">
                                        <p className="text-[10px] font-black text-[#08315F] uppercase">
                                            Position: {formData.target_position_title}
                                        </p>
                                        <p className="text-[9px] font-mono text-slate-500 mt-0.5">
                                            Item Code: {formData.target_vacancy_id}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Notes / Career Objectives */}
                        <div className="pt-2 border-t border-slate-100">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#08315F] mb-3 flex items-center gap-2">
                                <FiFileText size={13} className="text-[#075985]" /> Qualifications & Applicant Notes
                            </h4>
                            <textarea
                                rows={4}
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#08315F] focus:ring-2 focus:ring-[#08315F]/15 text-xs font-semibold text-slate-800 outline-none transition-all resize-none"
                                placeholder="State your qualifications, eligibility (CESO / CSEE / Career Service), relevant experience, or motivation for applying..."
                            />
                        </div>

                        {/* Modal Footer Actions */}
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={saving}
                                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-6 py-2.5 rounded-xl bg-[#08315F] hover:bg-blue-900 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-2 active:scale-95 disabled:opacity-60"
                            >
                                {saving ? (
                                    <>
                                        <FiLoader className="animate-spin" size={14} />
                                        <span>Saving Changes...</span>
                                    </>
                                ) : (
                                    <>
                                        <FiCheck size={14} />
                                        <span>Save to Database</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default EditVacancyApplicantModal;

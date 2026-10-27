import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    FiUser, FiMail, FiPhone, FiEdit2, FiCheck, FiX, FiBriefcase, 
    FiBookmark, FiCopy, FiCheckCircle, FiLoader, FiAlertCircle, 
    FiFileText, FiSearch, FiLayers, FiChevronRight, FiTrash2
} from 'react-icons/fi';
import Swal from 'sweetalert2';

const VacancyApplicantSidebar = ({
    applicantProfile,
    loading,
    vacancies = [],
    onUpdateProfile,
    onSelectVacancy,
    onClearTargetVacancy,
    isMobileOpen,
    setIsMobileOpen
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'vacancies'
    const [copiedUid, setCopiedUid] = useState(false);
    const [saving, setSaving] = useState(false);
    const [vacancySearch, setVacancySearch] = useState('');
    const [sidebarPage, setSidebarPage] = useState(1);
    const sidebarPageSize = 10;

    // Reset sidebar page when search query changes
    useEffect(() => {
        setSidebarPage(1);
    }, [vacancySearch]);

    const [formData, setFormData] = useState({
        first_name: '',
        middle_name: '',
        last_name: '',
        suffix: '',
        contact_number: '',
        notes: ''
    });

    // Sync formData whenever applicantProfile loads or updates
    useEffect(() => {
        if (applicantProfile) {
            setFormData({
                first_name: applicantProfile.first_name || '',
                middle_name: applicantProfile.middle_name || '',
                last_name: applicantProfile.last_name || '',
                suffix: applicantProfile.suffix || '',
                contact_number: applicantProfile.contact_number || '',
                notes: applicantProfile.notes || ''
            });
        }
    }, [applicantProfile]);

    const handleCopyUid = (uid) => {
        if (!uid) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(uid);
            setCopiedUid(true);
            setTimeout(() => setCopiedUid(false), 2000);
        }
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!formData.first_name.trim() || !formData.last_name.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Required Information',
                text: 'First name and last name are required.',
                confirmButtonColor: '#08315F'
            });
            return;
        }

        setSaving(true);
        try {
            const success = await onUpdateProfile(formData);
            if (success) {
                setIsEditing(false);
                Swal.fire({
                    icon: 'success',
                    title: 'Profile Updated',
                    text: 'Your applicant data has been saved successfully.',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        } catch (err) {
            console.error('Failed to save profile:', err);
            Swal.fire({
                icon: 'error',
                title: 'Update Failed',
                text: err.message || 'Unable to update applicant profile.',
                confirmButtonColor: '#08315F'
            });
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        if (applicantProfile) {
            setFormData({
                first_name: applicantProfile.first_name || '',
                middle_name: applicantProfile.middle_name || '',
                last_name: applicantProfile.last_name || '',
                suffix: applicantProfile.suffix || '',
                contact_number: applicantProfile.contact_number || '',
                notes: applicantProfile.notes || ''
            });
        }
        setIsEditing(false);
    };

    // Filter vacancies for sidebar quick directory
    const filteredSidebarVacancies = vacancies.filter(v => {
        const q = vacancySearch.toLowerCase();
        return (
            (v.position_title && v.position_title.toLowerCase().includes(q)) ||
            (v.office && v.office.toLowerCase().includes(q)) ||
            (v.strand && v.strand.toLowerCase().includes(q))
        );
    });

    const totalSidebarPages = Math.ceil(filteredSidebarVacancies.length / sidebarPageSize) || 1;
    const currentSidebarVacancies = filteredSidebarVacancies.slice(
        (sidebarPage - 1) * sidebarPageSize,
        sidebarPage * sidebarPageSize
    );

    const fullName = [
        formData.first_name,
        formData.middle_name,
        formData.last_name,
        formData.suffix
    ].filter(Boolean).join(' ') || applicantProfile?.email || 'Applicant';

    const sidebarContent = (
        <div className="flex flex-col h-full bg-white border border-slate-200/80 rounded-[28px] shadow-xl overflow-hidden backdrop-blur-md">
            {/* Sidebar Top Header & Profile Banner */}
            <div className="bg-gradient-to-br from-[#08315F] via-[#0A3D78] to-[#075985] text-white p-6 relative overflow-hidden shrink-0">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-sky-400/20 rounded-full blur-2xl pointer-events-none"></div>
                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white font-black text-lg shadow-inner">
                            {formData.first_name ? formData.first_name.charAt(0).toUpperCase() : <FiUser size={20} />}
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-sm font-black tracking-tight text-white uppercase truncate max-w-[180px]">
                                {fullName}
                            </h2>
                            <p className="text-[10px] font-bold text-sky-200/80 uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                {applicantProfile?.registration_status || 'Active'} Applicant
                            </p>
                        </div>
                    </div>

                    {isMobileOpen && (
                        <button 
                            onClick={() => setIsMobileOpen(false)}
                            className="lg:hidden p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all"
                            title="Close Sidebar"
                        >
                            <FiX size={18} />
                        </button>
                    )}
                </div>

                {/* UID Badge Row */}
                {applicantProfile?.applicant_uid && (
                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between relative z-10">
                        <span className="text-[9px] font-black uppercase tracking-widest text-blue-200/70">
                            Applicant UID
                        </span>
                        <button 
                            onClick={() => handleCopyUid(applicantProfile.applicant_uid)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/20 hover:bg-black/30 border border-white/15 text-[10px] font-mono font-bold tracking-wider text-sky-200 transition-all active:scale-95"
                            title="Click to copy UID"
                        >
                            <span>{applicantProfile.applicant_uid}</span>
                            {copiedUid ? <FiCheck size={12} className="text-emerald-300" /> : <FiCopy size={12} />}
                        </button>
                    </div>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className="grid grid-cols-2 p-1.5 bg-slate-100/80 border-b border-slate-200 shrink-0">
                <button
                    onClick={() => setActiveTab('profile')}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                        activeTab === 'profile'
                            ? 'bg-white text-[#08315F] shadow-sm font-black'
                            : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <FiUser size={13} />
                    <span>My Profile</span>
                </button>
                <button
                    onClick={() => setActiveTab('vacancies')}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all relative ${
                        activeTab === 'vacancies'
                            ? 'bg-white text-[#08315F] shadow-sm font-black'
                            : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <FiBriefcase size={13} />
                    <span>Vacancies ({vacancies.length})</span>
                    {applicantProfile?.target_vacancy_id && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-2 right-2 ring-2 ring-white"></span>
                    )}
                </button>
            </div>

            {/* Scrollable Body Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                {loading ? (
                    <div className="py-16 text-center text-slate-400 space-y-2">
                        <FiLoader className="animate-spin mx-auto text-[#075985]" size={24} />
                        <p className="text-[10px] font-bold uppercase tracking-widest">Loading Applicant Data...</p>
                    </div>
                ) : activeTab === 'profile' ? (
                    /* TAB 1: EDITABLE PROFILE DATA */
                    <div className="space-y-5">
                        {/* Target Vacancy Status Card */}
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/80 to-sky-50/60 border border-blue-100/90 relative overflow-hidden">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[9px] font-black uppercase tracking-widest text-[#075985] flex items-center gap-1.5">
                                    <FiBookmark size={12} className="text-[#075985]" /> Target Vacancy
                                </span>
                                {applicantProfile?.target_vacancy_id && (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                                        <FiCheckCircle size={10} /> Selected
                                    </span>
                                )}
                            </div>

                            {applicantProfile?.target_position_title ? (
                                <div className="space-y-2">
                                    <p className="text-xs font-black text-[#08315F] uppercase tracking-tight leading-snug">
                                        {applicantProfile.target_position_title}
                                    </p>
                                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold pt-1 border-t border-blue-100/60">
                                        <span>Item: {applicantProfile.target_vacancy_id || 'N/A'}</span>
                                        {onClearTargetVacancy && (
                                            <button 
                                                onClick={onClearTargetVacancy}
                                                className="text-rose-500 hover:text-rose-700 font-bold text-[9px] uppercase tracking-wider flex items-center gap-1 transition-colors"
                                                title="Clear selected target vacancy"
                                            >
                                                <FiTrash2 size={11} /> Clear
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="py-2 text-center text-slate-400">
                                    <p className="text-[11px] font-medium text-slate-500">No vacancy chosen yet.</p>
                                    <p className="text-[9px] text-slate-400 mt-0.5">Click "Apply / Select" on any vacancy card to link it here.</p>
                                </div>
                            )}
                        </div>

                        {/* Personal Information Header */}
                        <div className="flex items-center justify-between pt-1">
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-widest text-[#08315F]">
                                    Personal Data
                                </h3>
                                <p className="text-[10px] text-slate-400 font-medium">
                                    {isEditing ? 'Editing your information' : 'Your saved profile details'}
                                </p>
                            </div>
                            {!isEditing ? (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#075985] text-[10px] font-black uppercase tracking-wider border border-blue-200/60 transition-all active:scale-95"
                                >
                                    <FiEdit2 size={12} />
                                    <span>Edit Data</span>
                                </button>
                            ) : (
                                <button
                                    onClick={handleCancel}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider transition-all"
                                >
                                    <FiX size={12} />
                                    <span>Cancel</span>
                                </button>
                            )}
                        </div>

                        {/* View vs Edit Mode */}
                        {!isEditing ? (
                            <div className="space-y-3">
                                {/* Name Field */}
                                <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                        Full Name
                                    </span>
                                    <p className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                                        {fullName}
                                    </p>
                                </div>

                                {/* Email Field (Fixed/Verified) */}
                                <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                            Email Address
                                        </span>
                                        <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 flex items-center gap-1">
                                            <FiCheckCircle size={9} /> Verified
                                        </span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-700 break-all flex items-center gap-2">
                                        <FiMail size={13} className="text-[#075985] shrink-0" />
                                        {applicantProfile?.email || 'N/A'}
                                    </p>
                                </div>

                                {/* Contact Number */}
                                <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                        Contact Number
                                    </span>
                                    <p className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                        <FiPhone size={13} className="text-[#075985] shrink-0" />
                                        {formData.contact_number || <span className="text-slate-400 italic">Not specified</span>}
                                    </p>
                                </div>

                                {/* Statement of Intent / Notes */}
                                <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                        Applicant Notes & Qualifications
                                    </span>
                                    <p className="text-xs font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">
                                        {formData.notes || <span className="text-slate-400 italic text-[11px]">No notes added yet. Click "Edit Data" to introduce yourself, qualifications, or eligibility details.</span>}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            /* EDIT FORM */
                            <form onSubmit={handleSave} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1 ml-0.5">
                                            First Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.first_name}
                                            onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                                            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:border-[#08315F] focus:ring-2 focus:ring-[#08315F]/20 text-xs font-bold text-slate-900 outline-none transition-all uppercase shadow-sm"
                                            placeholder="First Name"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1 ml-0.5">
                                            Middle Name
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.middle_name}
                                            onChange={e => setFormData({ ...formData, middle_name: e.target.value })}
                                            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:border-[#08315F] focus:ring-2 focus:ring-[#08315F]/20 text-xs font-bold text-slate-900 outline-none transition-all uppercase shadow-sm"
                                            placeholder="Middle Name"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1 ml-0.5">
                                            Last Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.last_name}
                                            onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                                            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:border-[#08315F] focus:ring-2 focus:ring-[#08315F]/20 text-xs font-bold text-slate-900 outline-none transition-all uppercase shadow-sm"
                                            placeholder="Last Name"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1 ml-0.5">
                                            Suffix
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.suffix}
                                            onChange={e => setFormData({ ...formData, suffix: e.target.value })}
                                            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:border-[#08315F] focus:ring-2 focus:ring-[#08315F]/20 text-xs font-bold text-slate-900 outline-none transition-all uppercase shadow-sm"
                                            placeholder="Jr., III, etc."
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1 ml-0.5">
                                        Contact Number
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.contact_number}
                                        onChange={e => setFormData({ ...formData, contact_number: e.target.value })}
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:border-[#08315F] focus:ring-2 focus:ring-[#08315F]/20 text-xs font-bold text-slate-900 outline-none transition-all shadow-sm"
                                        placeholder="09123456789"
                                    />
                                </div>

                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1 ml-0.5">
                                        Notes / Career Pitch / Remarks
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={formData.notes}
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:border-[#08315F] focus:ring-2 focus:ring-[#08315F]/20 text-xs font-semibold text-slate-900 outline-none transition-all resize-none shadow-sm"
                                        placeholder="Briefly state your qualifications, eligibility (e.g. CESO/CSEE), or career objective..."
                                    />
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={handleCancel}
                                        disabled={saving}
                                        className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[10px] uppercase tracking-wider transition-all disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="flex-[2] py-3 px-4 rounded-xl bg-[#08315F] hover:bg-blue-900 text-white font-black text-[10px] uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95"
                                    >
                                        {saving ? (
                                            <>
                                                <FiLoader className="animate-spin" size={14} />
                                                <span>Saving...</span>
                                            </>
                                        ) : (
                                            <>
                                                <FiCheck size={14} />
                                                <span>Save Changes</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                ) : (
                    /* TAB 2: VACANCIES DIRECTORY & SELECTION */
                    <div className="space-y-4">
                        <div className="relative">
                            <FiSearch className="absolute left-3.5 top-3 text-slate-400" size={14} />
                            <input
                                type="text"
                                placeholder="Filter vacancies..."
                                value={vacancySearch}
                                onChange={e => setVacancySearch(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-xl py-2 pl-9 pr-3 text-xs font-semibold text-slate-900 outline-none focus:border-[#08315F] focus:ring-2 focus:ring-[#08315F]/15 transition-all shadow-xs"
                            />
                        </div>

                        <div className="space-y-2.5">
                            {filteredSidebarVacancies.length === 0 ? (
                                <div className="py-10 text-center text-slate-400">
                                    <p className="text-[11px] font-bold uppercase tracking-wider">No matching vacancies</p>
                                </div>
                            ) : (
                                <>
                                    {currentSidebarVacancies.map(v => {
                                        const isTarget = applicantProfile?.target_vacancy_id === v.TLOid || applicantProfile?.target_vacancy_id === v.item_number;
                                        return (
                                            <div
                                                key={v.assignment_id || v.TLOid || v.id}
                                                onClick={() => onSelectVacancy && onSelectVacancy(v)}
                                                className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative group ${
                                                    isTarget 
                                                        ? 'bg-blue-50/80 border-[#075985] shadow-sm ring-1 ring-[#075985]/30' 
                                                        : 'bg-white border-slate-200/80 hover:border-blue-300 hover:bg-slate-50/60'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <h4 className="text-xs font-black text-[#08315F] uppercase tracking-tight truncate group-hover:text-[#075985] transition-colors">
                                                            {v.position_title}
                                                        </h4>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate mt-0.5">
                                                            {v.office || 'Department of Education'}
                                                        </p>
                                                    </div>
                                                    {isTarget && (
                                                        <span className="shrink-0 p-1 rounded-full bg-emerald-100 text-emerald-600" title="Selected Target Position">
                                                            <FiCheckCircle size={14} />
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[9px] font-bold">
                                                    <span className="text-slate-400">SG: {v.salary_grade || 'Third Level'}</span>
                                                    <span className={`uppercase tracking-wider flex items-center gap-1 ${isTarget ? 'text-emerald-700 font-black' : 'text-[#075985]'}`}>
                                                        {isTarget ? 'Selected' : 'Select'} <FiChevronRight size={12} />
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {totalSidebarPages > 1 && (
                                        <div className="flex items-center justify-between pt-2 px-1 text-xs">
                                            <span className="text-[10px] font-bold text-slate-400">
                                                Page {sidebarPage} of {totalSidebarPages} ({filteredSidebarVacancies.length})
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setSidebarPage(p => Math.max(1, p - 1))}
                                                    disabled={sidebarPage === 1}
                                                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold disabled:opacity-40 transition-colors"
                                                >
                                                    Prev
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setSidebarPage(p => Math.min(totalSidebarPages, p + 1))}
                                                    disabled={sidebarPage === totalSidebarPages}
                                                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold disabled:opacity-40 transition-colors"
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Sidebar Bottom Footer Info */}
            <div className="p-4 bg-slate-50 border-t border-slate-200/80 text-center shrink-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    DepEd Third Level Portal • Open Opportunities
                </p>
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop Sidebar Column */}
            <aside className="hidden lg:block w-[380px] shrink-0 sticky top-6 h-[calc(100vh-140px)] z-20">
                {sidebarContent}
            </aside>

            {/* Mobile Drawer Backdrop & Drawer */}
            <AnimatePresence>
                {isMobileOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileOpen(false)}
                            className="lg:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40"
                        />
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="lg:hidden fixed inset-y-0 left-0 w-[90%] max-w-[360px] p-4 z-50 overflow-hidden"
                        >
                            {sidebarContent}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};

export default VacancyApplicantSidebar;

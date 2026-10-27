import React from 'react';
import { motion } from 'framer-motion';
import { 
    FiX, FiCheckCircle, FiClock, FiFileText, FiAward, 
    FiBriefcase, FiUser, FiExternalLink, FiDownload 
} from 'react-icons/fi';
import { apiUrl } from '../utils/api';

const DOC_DEFINITIONS = [
    { key: 'letter_of_intent', label: '1. Letter of Intent', binaryKey: 'letter_of_intent_binary_id', nameKey: 'letter_of_intent_filename' },
    { key: 'pds', label: '2. Personal Data Sheet (PDS) CSC Form 212', binaryKey: 'pds_binary_id', nameKey: 'pds_filename' },
    { key: 'work_experience_sheet', label: '3. PDS - Work Experience Sheet', binaryKey: 'work_experience_sheet_binary_id', nameKey: 'work_experience_sheet_filename' },
    { key: 'cv', label: '4. Curriculum Vitae (CV)', binaryKey: 'cv_binary_id', nameKey: 'cv_filename' },
    { key: 'outstanding_accomplishments', label: '5. Outstanding Accomplishments', binaryKey: 'outstanding_accomplishments_binary_id', nameKey: 'outstanding_accomplishments_filename' },
    { key: 'service_records', label: '6. Service Records', binaryKey: 'service_records_binary_id', nameKey: 'service_records_filename' },
    { key: 'transcript_of_records', label: '7. Transcript of Records (TOR)', binaryKey: 'transcript_of_records_binary_id', nameKey: 'transcript_of_records_filename' },
    { key: 'performance_eval', label: '8. Performance Evaluation Records', binaryKey: 'performance_eval_binary_id', nameKey: 'performance_eval_filename' },
    { key: 'self_certification', label: '9. Self-Certification of Pending Charges', binaryKey: 'self_certification_binary_id', nameKey: 'self_certification_filename' },
    { key: 'id_picture', label: '10. ID Picture (Passport size)', binaryKey: 'id_picture_binary_id', nameKey: 'id_picture_filename', isImage: true },
    { key: 'applicant_profile_doc', label: '11. Accomplished Applicant Profile', binaryKey: 'applicant_profile_doc_binary_id', nameKey: 'applicant_profile_doc_filename' },
    { key: 'other_documents', label: '12. Other Relevant Documents', binaryKey: 'other_documents_binary_id', nameKey: 'other_documents_filename' }
];

const ViewApplicationDetailsModal = ({ isOpen, onClose, application }) => {
    if (!isOpen || !application) return null;

    const statusColors = {
        'Submitted': 'bg-blue-50 text-blue-700 border-blue-200',
        'Under Review': 'bg-amber-50 text-amber-700 border-amber-200',
        'Shortlisted': 'bg-purple-50 text-purple-700 border-purple-200',
        'Approved': 'bg-emerald-50 text-emerald-700 border-emerald-200',
        'Rejected': 'bg-rose-50 text-rose-700 border-rose-200'
    };

    const badgeColor = statusColors[application.status] || 'bg-slate-50 text-slate-700 border-slate-200';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 15 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden my-auto"
            >
                {/* Header */}
                <div className="bg-[#08315F] text-white px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between border-b border-blue-900/50 shrink-0">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white/10 flex items-center justify-center text-sky-300 shrink-0 border border-white/20">
                            <FiFileText size={18} className="sm:hidden" />
                            <FiFileText size={20} className="hidden sm:block" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                <h2 className="text-sm sm:text-lg font-black uppercase tracking-tight truncate">
                                    {application.application_no}
                                </h2>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0 ${badgeColor}`}>
                                    {application.status || 'Submitted'}
                                </span>
                            </div>
                            <p className="text-[10px] sm:text-[11px] text-blue-200 font-medium truncate">
                                Position: {application.position_applying_for} • Filed on {new Date(application.created_at).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0 ml-2"
                    >
                        <FiX size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto flex-1 space-y-4 sm:space-y-6">
                    {/* Top Identity Grid */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 sm:space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-wider text-[#08315F]">
                            Applicant & Plantilla Profile
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-4 text-xs">
                            <div className="min-w-0">
                                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Full Name (ALL CAPS):</span>
                                <span className="font-bold text-slate-900 uppercase break-words">
                                    {application.surname}, {application.first_name} {application.middle_name || ''}
                                </span>
                            </div>
                            <div className="min-w-0">
                                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Applicant UID:</span>
                                <span className="font-mono font-bold text-slate-900 break-all">{application.applicant_uid}</span>
                            </div>
                            <div className="min-w-0">
                                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Email Address:</span>
                                <span className="font-bold text-slate-900 break-all">{application.email}</span>
                            </div>
                            <div className="min-w-0">
                                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Contact Number:</span>
                                <span className="font-bold text-slate-900 break-words">{application.contact_number || '—'}</span>
                            </div>
                            <div className="min-w-0">
                                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Date of Birth:</span>
                                <span className="font-bold text-slate-900">{application.date_of_birth ? new Date(application.date_of_birth).toLocaleDateString() : '—'}</span>
                            </div>
                            <div className="min-w-0">
                                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Target Vacancy ID:</span>
                                <span className="font-mono font-bold text-slate-900 break-all">{application.target_vacancy_id || 'General Pool'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Employment & Third Level Designation */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 sm:space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-wider text-[#08315F]">
                            Employment & Current Designation
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 text-xs">
                            <div className="min-w-0">
                                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Current Position (Full):</span>
                                <span className="font-bold text-slate-900 break-words">{application.current_position}</span>
                            </div>
                            <div className="min-w-0">
                                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Plantilla Office Assignment:</span>
                                <span className="font-bold text-slate-900 break-words">{application.plantilla_office}</span>
                            </div>
                            <div className="min-w-0">
                                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Current Designation to 3rd Level:</span>
                                <span className="font-bold text-slate-900 break-words">{application.current_designation}</span>
                            </div>
                            <div className="min-w-0">
                                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Assigned SDO as OIC:</span>
                                <span className="font-bold text-slate-900 break-words">{application.assigned_oic_office || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Eligibilities & Examination Tests */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 sm:space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-wider text-[#08315F]">
                            Examinations & CES Eligibility
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-4 text-xs">
                            <div>
                                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">LET Passer:</span>
                                <span className="font-bold text-slate-900">{application.is_let_passer ? '✓ Yes' : '✕ No'}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">EMT Passer:</span>
                                <span className="font-bold text-slate-900">{application.is_emt_passer ? '✓ Yes' : '✕ No'}</span>
                            </div>
                            <div className="sm:col-span-2 md:col-span-1 min-w-0">
                                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Highest CES Stage:</span>
                                <span className="font-bold text-slate-900 break-words">{application.ces_eligibility_stage}</span>
                            </div>
                            {application.ces_stage_date && (
                                <div className="min-w-0">
                                    <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Date Conferred / Passed:</span>
                                    <span className="font-bold text-slate-900">{new Date(application.ces_stage_date).toLocaleDateString()}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 12 Uploaded Documents */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 sm:space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black uppercase tracking-wider text-[#08315F]">
                                Attached Documents (12 Requirements)
                            </h3>
                            <span className="text-[10px] font-mono font-bold text-slate-500">
                                {DOC_DEFINITIONS.filter(d => application[d.binaryKey]).length} Attached
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                            {DOC_DEFINITIONS.map(doc => {
                                const binaryId = application[doc.binaryKey];
                                const filename = application[doc.nameKey];

                                return (
                                    <div
                                        key={doc.key}
                                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                                            binaryId ? 'bg-white border-slate-200' : 'bg-slate-100/60 border-slate-200 opacity-60'
                                        }`}
                                    >
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-slate-900 truncate">{doc.label}</p>
                                            <p className="text-[10px] text-slate-500 truncate mt-0.5 font-medium">
                                                {filename || (binaryId ? 'Document on File' : 'Not attached')}
                                            </p>
                                        </div>

                                        {binaryId ? (
                                            <a
                                                href={apiUrl(`/api/binary/${binaryId}`)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-2.5 py-1.5 rounded-lg bg-[#08315F] hover:bg-blue-900 text-white text-[10px] font-bold flex items-center gap-1.5 shrink-0 transition-colors"
                                            >
                                                <span>View</span>
                                                <FiExternalLink size={11} />
                                            </a>
                                        ) : (
                                            <span className="text-[10px] font-bold text-slate-500 shrink-0">None</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 px-4 sm:px-6 py-3.5 sm:py-4 border-t border-slate-200 flex justify-end shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto justify-center px-5 py-2.5 rounded-xl bg-[#08315F] hover:bg-blue-900 text-white text-xs font-black uppercase tracking-wider transition-all"
                    >
                        Close
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default ViewApplicationDetailsModal;

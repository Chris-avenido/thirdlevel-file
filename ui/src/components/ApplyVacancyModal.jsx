import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    FiX, FiCheck, FiLoader, FiUploadCloud, FiFileText, FiAward, 
    FiUser, FiBriefcase, FiAlertCircle, FiCheckCircle, FiChevronRight, 
    FiChevronLeft, FiExternalLink, FiTrash2, FiInfo
} from 'react-icons/fi';
import Swal from 'sweetalert2';
import { apiUrl } from '../utils/api';

const REQUIRED_DOCUMENTS = [
    {
        key: 'letter_of_intent',
        binaryKey: 'letter_of_intent_binary_id',
        nameKey: 'letter_of_intent_filename',
        label: '1. Letter of Intent',
        instruction: 'Addressed to Secretary Sonny Angara (PDF only)',
        accept: '.pdf,application/pdf',
        isPdf: true,
        required: true
    },
    {
        key: 'pds',
        binaryKey: 'pds_binary_id',
        nameKey: 'pds_filename',
        label: '2. Personal Data Sheet (PDS) CSC Form 212',
        instruction: 'Must be notarized within the last 6 months (PDF only)',
        accept: '.pdf,application/pdf',
        isPdf: true,
        required: true
    },
    {
        key: 'work_experience_sheet',
        binaryKey: 'work_experience_sheet_binary_id',
        nameKey: 'work_experience_sheet_filename',
        label: '3. PDS - Work Experience Sheet',
        instruction: 'Attachment to CSC Form 212 (PDF only)',
        accept: '.pdf,application/pdf',
        isPdf: true,
        required: true
    },
    {
        key: 'cv',
        binaryKey: 'cv_binary_id',
        nameKey: 'cv_filename',
        label: '4. Curriculum Vitae (CV)',
        instruction: 'Comprehensive curriculum vitae (PDF only)',
        accept: '.pdf,application/pdf',
        isPdf: true,
        required: true
    },
    {
        key: 'outstanding_accomplishments',
        binaryKey: 'outstanding_accomplishments_binary_id',
        nameKey: 'outstanding_accomplishments_filename',
        label: '5. Outstanding Accomplishments',
        instruction: 'Supported by certificates, citations, or relevant evidence (PDF only)',
        accept: '.pdf,application/pdf',
        isPdf: true,
        required: false
    },
    {
        key: 'service_records',
        binaryKey: 'service_records_binary_id',
        nameKey: 'service_records_filename',
        label: '6. Service Records',
        instruction: 'Updated and certified government / DepEd service record (PDF only)',
        accept: '.pdf,application/pdf',
        isPdf: true,
        required: true
    },
    {
        key: 'transcript_of_records',
        binaryKey: 'transcript_of_records_binary_id',
        nameKey: 'transcript_of_records_filename',
        label: '7. Transcript of Records (TOR)',
        instruction: 'Baccalaureate and post-graduate degree transcripts (PDF only)',
        accept: '.pdf,application/pdf',
        isPdf: true,
        required: true
    },
    {
        key: 'performance_eval',
        binaryKey: 'performance_eval_binary_id',
        nameKey: 'performance_eval_filename',
        label: '8. Performance Evaluation Records',
        instruction: 'CESPES, OPCRF, or IPCRF for the last rating period (PDF only)',
        accept: '.pdf,application/pdf',
        isPdf: true,
        required: true
    },
    {
        key: 'self_certification',
        binaryKey: 'self_certification_binary_id',
        nameKey: 'self_certification_filename',
        label: '9. Self-Certification of Pending Charges',
        instruction: 'Self-certification of pending administrative/civil/criminal charges notarized (PDF only)',
        accept: '.pdf,application/pdf',
        isPdf: true,
        required: true
    },
    {
        key: 'id_picture',
        binaryKey: 'id_picture_binary_id',
        nameKey: 'id_picture_filename',
        label: '10. ID Picture (Passport size)',
        instruction: 'Recent passport-sized colored photo with white background (JPG/PNG/WebP)',
        accept: 'image/jpeg,image/png,image/webp',
        isImage: true,
        required: true
    },
    {
        key: 'applicant_profile_doc',
        binaryKey: 'applicant_profile_doc_binary_id',
        nameKey: 'applicant_profile_doc_filename',
        label: '11. Accomplished Applicant Profile',
        instruction: 'Accomplished template from https://tinyurl.com/3rdLevelForms (PDF or Word format)',
        accept: '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        templateUrl: 'https://tinyurl.com/3rdLevelForms',
        required: true
    },
    {
        key: 'other_documents',
        binaryKey: 'other_documents_binary_id',
        nameKey: 'other_documents_filename',
        label: '12. Other Relevant Documents',
        instruction: 'Any other credentials, special orders, or supporting documents (PDF only)',
        accept: '.pdf,application/pdf',
        isPdf: true,
        required: false
    }
];

const CES_STAGES = [
    'Appointed to a CESO Rank',
    'Conferred CES Eligibility',
    'Stage 4 (Board Interview)',
    'Stage 3 (Performance Validation)',
    'Stage 2 (Assessment Center)',
    'Stage 1 (CES Written Examination)',
    'None'
];

const DESIGNATION_PRESETS = [
    'OIC-SDS (Officer-in-Charge of the Office of the Schools Division Superintendent)',
    'OIC-ASDS (Officer-in-Charge of the Office of the Assistant Schools Division Superintendent)',
    'N/A',
    'Other'
];

const STEPS = [
    { id: 1, title: 'Position & Item', icon: FiBriefcase },
    { id: 2, title: 'Personal Details', icon: FiUser },
    { id: 3, title: 'Designation & OIC', icon: FiBriefcase },
    { id: 4, title: 'Eligibilities', icon: FiAward },
    { id: 5, title: 'Documents (12)', icon: FiFileText },
    { id: 6, title: 'Review & Submit', icon: FiCheckCircle }
];

const ApplyVacancyModal = ({
    isOpen,
    onClose,
    vacancy = null,
    applicantProfile = null,
    onSuccess
}) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [uploadingDoc, setUploadingDoc] = useState({});

    // Form fields corresponding strictly to DepEd Google Form questions
    const [formData, setFormData] = useState({
        position_applying_for: '',
        target_vacancy_id: '',
        surname: '',
        first_name: '',
        middle_name: '',
        date_of_birth: '',
        current_position: '',
        plantilla_office: '',
        current_designation_preset: 'N/A',
        current_designation_custom: '',
        assigned_oic_office: '',
        is_let_passer: false,
        is_emt_passer: false,
        ces_eligibility_stage: 'Stage 1 (CES Written Examination)',
        ces_stage_date: '',
        contact_number: '',
        // 12 Documents storage
        letter_of_intent_binary_id: null,
        letter_of_intent_filename: null,
        pds_binary_id: null,
        pds_filename: null,
        work_experience_sheet_binary_id: null,
        work_experience_sheet_filename: null,
        cv_binary_id: null,
        cv_filename: null,
        outstanding_accomplishments_binary_id: null,
        outstanding_accomplishments_filename: null,
        service_records_binary_id: null,
        service_records_filename: null,
        transcript_of_records_binary_id: null,
        transcript_of_records_filename: null,
        performance_eval_binary_id: null,
        performance_eval_filename: null,
        self_certification_binary_id: null,
        self_certification_filename: null,
        id_picture_binary_id: null,
        id_picture_filename: null,
        applicant_profile_doc_binary_id: null,
        applicant_profile_doc_filename: null,
        other_documents_binary_id: null,
        other_documents_filename: null
    });

    // Populate data when modal opens or vacancy/applicantProfile changes
    useEffect(() => {
        if (isOpen) {
            setCurrentStep(1);
            const posTitle = vacancy?.position_title || applicantProfile?.target_position_title || 'Schools Division Superintendent';
            const vacId = vacancy?.TLOid || vacancy?.item_number || (vacancy?.assignment_id ? String(vacancy.assignment_id) : '') || applicantProfile?.target_vacancy_id || '';

            setFormData(prev => ({
                ...prev,
                position_applying_for: posTitle,
                target_vacancy_id: vacId,
                surname: (applicantProfile?.last_name || '').toUpperCase(),
                first_name: (applicantProfile?.first_name || '').toUpperCase(),
                middle_name: (applicantProfile?.middle_name || '').toUpperCase(),
                contact_number: applicantProfile?.contact_number || '',
                current_position: prev.current_position || '',
                plantilla_office: prev.plantilla_office || (vacancy?.office || '')
            }));
        }
    }, [isOpen, vacancy, applicantProfile]);

    if (!isOpen) return null;

    // Handle Input Change with automatic uppercase formatting for name fields
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        let finalValue = type === 'checkbox' ? checked : value;

        if (['surname', 'first_name', 'middle_name'].includes(name)) {
            finalValue = finalValue.toUpperCase();
        }

        setFormData(prev => ({
            ...prev,
            [name]: finalValue
        }));
    };

    // File Upload Handler via `/api/third-level/vacancy-applicant/upload-document`
    const handleFileUpload = async (docConfig, file) => {
        if (!file) return;

        // Validation for PDF only
        if (docConfig.isPdf) {
            const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
            if (!isPdf) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Invalid File Type',
                    text: `${docConfig.label} must be a PDF file (.pdf).`,
                    confirmButtonColor: '#08315F'
                });
                return;
            }
        }

        // Validation for ID picture
        if (docConfig.isImage) {
            const isImg = file.type.startsWith('image/');
            if (!isImg) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Invalid File Type',
                    text: 'ID Picture must be an image file (JPG, PNG, or WebP).',
                    confirmButtonColor: '#08315F'
                });
                return;
            }
        }

        setUploadingDoc(prev => ({ ...prev, [docConfig.key]: true }));
        try {
            const uploadFormData = new FormData();
            uploadFormData.append('file', file);
            uploadFormData.append('doc_type', docConfig.key);

            const vacId = formData.target_vacancy_id ||
                          vacancy?.TLOid ||
                          vacancy?.item_number ||
                          (vacancy?.assignment_id ? String(vacancy.assignment_id) : '') ||
                          applicantProfile?.target_vacancy_id ||
                          applicantProfile?.applicant_uid ||
                          'general-vacancy';
            uploadFormData.append('vacancy_id', vacId);

            const token = localStorage.getItem('token');
            const res = await fetch(apiUrl('/api/third-level/vacancy-applicant/upload-document'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: uploadFormData
            });

            const data = await res.json();
            if (data.success && data.data) {
                setFormData(prev => ({
                    ...prev,
                    [docConfig.binaryKey]: data.data.binary_id,
                    [docConfig.nameKey]: data.data.filename
                }));
            } else {
                throw new Error(data.error || 'Upload failed');
            }
        } catch (err) {
            console.error('File upload error:', err);
            Swal.fire({
                icon: 'error',
                title: 'Upload Failed',
                text: err.message || 'Could not upload file.',
                confirmButtonColor: '#08315F'
            });
        } finally {
            setUploadingDoc(prev => ({ ...prev, [docConfig.key]: false }));
        }
    };

    const handleRemoveDoc = (docConfig) => {
        setFormData(prev => ({
            ...prev,
            [docConfig.binaryKey]: null,
            [docConfig.nameKey]: null
        }));
    };

    // Step Validation
    const validateStep = (step) => {
        if (step === 1) {
            if (!formData.position_applying_for.trim()) {
                Swal.fire({ icon: 'warning', title: 'Required Field', text: 'Position Applying For is required.', confirmButtonColor: '#08315F' });
                return false;
            }
        }
        if (step === 2) {
            if (!formData.surname.trim() || !formData.first_name.trim()) {
                Swal.fire({ icon: 'warning', title: 'Required Fields', text: 'Surname and First Name are required (DepEd ALL CAPS format).', confirmButtonColor: '#08315F' });
                return false;
            }
            if (!formData.current_position.trim()) {
                Swal.fire({ icon: 'warning', title: 'Required Field', text: 'Current Position is required. Do not abbreviate.', confirmButtonColor: '#08315F' });
                return false;
            }
            if (!formData.plantilla_office.trim()) {
                Swal.fire({ icon: 'warning', title: 'Required Field', text: 'Plantilla Office (SDO/RO or Agency) is required.', confirmButtonColor: '#08315F' });
                return false;
            }
        }
        if (step === 3) {
            const des = formData.current_designation_preset === 'Other' ? formData.current_designation_custom : formData.current_designation_preset;
            if (!des || !des.trim()) {
                Swal.fire({ icon: 'warning', title: 'Required Field', text: 'Please specify your current designation to a third level position.', confirmButtonColor: '#08315F' });
                return false;
            }
        }
        if (step === 4) {
            if (!formData.ces_eligibility_stage) {
                Swal.fire({ icon: 'warning', title: 'Required Field', text: 'Please select your CES eligibility stage.', confirmButtonColor: '#08315F' });
                return false;
            }
        }
        if (step === 5) {
            const missingRequired = REQUIRED_DOCUMENTS.filter(d => d.required && !formData[d.binaryKey]);
            if (missingRequired.length > 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Missing Required Documents',
                    html: `
                        <p class="text-xs text-slate-600 mb-2">Please upload all mandatory documents before proceeding:</p>
                        <ul class="text-left text-xs text-red-600 font-bold space-y-1 list-disc pl-5">
                            ${missingRequired.map(d => `<li>${d.label}</li>`).join('')}
                        </ul>
                    `,
                    confirmButtonColor: '#08315F'
                });
                return false;
            }
        }
        return true;
    };

    const handleNext = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
        }
    };

    const handlePrev = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

    // Final Form Submission
    const handleSubmitApplication = async () => {
        // Validate all steps
        for (let s = 1; s <= 5; s++) {
            if (!validateStep(s)) {
                setCurrentStep(s);
                return;
            }
        }

        const effectiveDesignation = formData.current_designation_preset === 'Other'
            ? formData.current_designation_custom.trim()
            : formData.current_designation_preset;

        const payload = {
            position_applying_for: formData.position_applying_for.trim(),
            target_vacancy_id: formData.target_vacancy_id ? formData.target_vacancy_id.trim() : null,
            surname: formData.surname.trim(),
            first_name: formData.first_name.trim(),
            middle_name: formData.middle_name ? formData.middle_name.trim() : null,
            date_of_birth: formData.date_of_birth || null,
            current_position: formData.current_position.trim(),
            plantilla_office: formData.plantilla_office.trim(),
            current_designation: effectiveDesignation,
            assigned_oic_office: formData.assigned_oic_office ? formData.assigned_oic_office.trim() : null,
            is_let_passer: formData.is_let_passer,
            is_emt_passer: formData.is_emt_passer,
            ces_eligibility_stage: formData.ces_eligibility_stage,
            ces_stage_date: formData.ces_stage_date || null,
            contact_number: formData.contact_number ? formData.contact_number.trim() : null,
            // 12 documents
            letter_of_intent_binary_id: formData.letter_of_intent_binary_id,
            letter_of_intent_filename: formData.letter_of_intent_filename,
            pds_binary_id: formData.pds_binary_id,
            pds_filename: formData.pds_filename,
            work_experience_sheet_binary_id: formData.work_experience_sheet_binary_id,
            work_experience_sheet_filename: formData.work_experience_sheet_filename,
            cv_binary_id: formData.cv_binary_id,
            cv_filename: formData.cv_filename,
            outstanding_accomplishments_binary_id: formData.outstanding_accomplishments_binary_id,
            outstanding_accomplishments_filename: formData.outstanding_accomplishments_filename,
            service_records_binary_id: formData.service_records_binary_id,
            service_records_filename: formData.service_records_filename,
            transcript_of_records_binary_id: formData.transcript_of_records_binary_id,
            transcript_of_records_filename: formData.transcript_of_records_filename,
            performance_eval_binary_id: formData.performance_eval_binary_id,
            performance_eval_filename: formData.performance_eval_filename,
            self_certification_binary_id: formData.self_certification_binary_id,
            self_certification_filename: formData.self_certification_filename,
            id_picture_binary_id: formData.id_picture_binary_id,
            id_picture_filename: formData.id_picture_filename,
            applicant_profile_doc_binary_id: formData.applicant_profile_doc_binary_id,
            applicant_profile_doc_filename: formData.applicant_profile_doc_filename,
            other_documents_binary_id: formData.other_documents_binary_id,
            other_documents_filename: formData.other_documents_filename
        };

        const confirm = await Swal.fire({
            title: 'Submit Application?',
            text: `You are submitting your official DepEd application for ${formData.position_applying_for}. Please ensure all documents and details are complete and truthful.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#08315F',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, Submit Application'
        });

        if (!confirm.isConfirmed) return;

        setSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(apiUrl('/api/third-level/vacancy-applicant/application'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success && data.data) {
                const app = data.data;
                await Swal.fire({
                    icon: 'success',
                    title: 'Application Submitted!',
                    html: `
                        <div class="text-left text-xs space-y-3 p-2">
                            <div class="p-3 bg-blue-50 rounded-xl border border-blue-200">
                                <span class="text-[10px] font-black uppercase text-blue-800 tracking-wider block">Official Application Number:</span>
                                <span class="text-lg font-mono font-black text-[#08315F] block mt-0.5">${app.application_no}</span>
                            </div>
                            <p class="text-slate-700"><strong>Position:</strong> ${app.position_applying_for}</p>
                            <p class="text-slate-700"><strong>Applicant:</strong> ${app.surname}, ${app.first_name} ${app.middle_name || ''}</p>
                            <p class="text-slate-500 text-[11px]">Your application has been registered in the system. You can view its status anytime under <strong>My Applications</strong>.</p>
                        </div>
                    `,
                    confirmButtonColor: '#08315F',
                    confirmButtonText: 'View Dashboard'
                });

                if (onSuccess) onSuccess(app);
                onClose();
            } else {
                throw new Error(data.error || 'Failed to submit application');
            }
        } catch (err) {
            console.error('Submit application error:', err);
            Swal.fire({
                icon: 'error',
                title: 'Submission Failed',
                text: err.message || 'Could not submit application.',
                confirmButtonColor: '#08315F'
            });
        } finally {
            setSubmitting(false);
        }
    };

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
                            <h2 className="text-sm sm:text-lg font-black uppercase tracking-tight flex items-center gap-1.5 sm:gap-2 truncate">
                                <span>Third Level Position</span>
                                <span className="text-sky-300">Application</span>
                            </h2>
                            <p className="text-[10px] sm:text-[11px] text-blue-200 font-medium truncate">
                                DepEd SDS & ASDS Application Form • Plantilla Registry
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0 ml-2"
                        title="Close modal"
                    >
                        <FiX size={18} />
                    </button>
                </div>

                {/* Step Navigation Bar */}
                <div className="bg-slate-50 border-b border-slate-200 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between overflow-x-hidden shrink-0 gap-1.5 sm:gap-2 no-scrollbar">
                    {STEPS.map((step) => {
                        const Icon = step.icon;
                        const isActive = currentStep === step.id;
                        const isCompleted = currentStep > step.id;

                        return (
                            <button
                                key={step.id}
                                onClick={() => {
                                    if (step.id < currentStep || validateStep(currentStep)) {
                                        setCurrentStep(step.id);
                                    }
                                }}
                                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
                                    isActive
                                        ? 'bg-[#08315F] text-white shadow-sm'
                                        : isCompleted
                                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                        : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                    isActive ? 'bg-sky-400 text-slate-900' : isCompleted ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                                }`}>
                                    {isCompleted ? '✓' : step.id}
                                </span>
                                <span className="hidden md:inline">{step.title}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Scrollable Form Body */}
                <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto flex-1 space-y-5 sm:space-y-6">

                    {/* STEP 1: POSITION APPLYING FOR & PLANTILLA ITEM */}
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <div className="p-4 rounded-2xl bg-sky-50 border border-sky-100 flex items-start gap-3">
                                <FiInfo size={20} className="text-sky-700 mt-0.5 shrink-0" />
                                <div className="text-xs text-sky-900 space-y-1">
                                    <p className="font-bold">Position Selection</p>
                                    <p>Select the Third Level Position you are applying for in DepEd. You may apply for open Schools Division Superintendent (SDS) or Assistant Schools Division Superintendent (ASDS) positions.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                                        Position Applying For <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        name="position_applying_for"
                                        value={formData.position_applying_for}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#08315F] text-xs font-bold text-slate-800 bg-white"
                                    >
                                        <option value="Schools Division Superintendent">Schools Division Superintendent (SDS)</option>
                                        <option value="Assistant Schools Division Superintendent">Assistant Schools Division Superintendent (ASDS)</option>
                                        <option value="Regional Director">Regional Director (RD)</option>
                                        <option value="Assistant Regional Director">Assistant Regional Director (ARD)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                                        Target Vacancy Item Number / Identifier (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        name="target_vacancy_id"
                                        value={formData.target_vacancy_id}
                                        onChange={handleChange}
                                        placeholder="e.g. OSEC-DECSB-ASDS-1998-001 or TLO-0627"
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#08315F] text-xs font-mono font-bold text-slate-900 bg-white shadow-sm"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1 font-medium">
                                        Leave empty if applying generally for the pool of candidates.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: PERSONAL & CURRENT EMPLOYMENT INFO */}
                    {currentStep === 2 && (
                        <div className="space-y-6">
                            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-start gap-3">
                                <FiInfo size={20} className="text-amber-700 mt-0.5 shrink-0" />
                                <div className="text-xs text-amber-900 space-y-1">
                                    <p className="font-bold">Official DepEd Standard: ALL CAPS</p>
                                    <p>Please type your surname, first name, and middle name in <strong>ALL CAPITAL LETTERS</strong> as instructed by the DepEd application guidelines.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                                        SURNAME [ALL CAPS] <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="surname"
                                        value={formData.surname}
                                        onChange={handleChange}
                                        placeholder="DELA CRUZ"
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#08315F] text-xs font-bold text-slate-900 bg-white uppercase shadow-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                                        FIRST NAME [ALL CAPS] <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="first_name"
                                        value={formData.first_name}
                                        onChange={handleChange}
                                        placeholder="JUAN"
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#08315F] text-xs font-bold text-slate-900 bg-white uppercase shadow-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                                        MIDDLE NAME [ALL CAPS]
                                    </label>
                                    <input
                                        type="text"
                                        name="middle_name"
                                        value={formData.middle_name}
                                        onChange={handleChange}
                                        placeholder="SANTOS"
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#08315F] text-xs font-bold text-slate-900 bg-white uppercase shadow-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                                        Date of Birth
                                    </label>
                                    <input
                                        type="date"
                                        name="date_of_birth"
                                        value={formData.date_of_birth}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#08315F] text-xs font-bold text-slate-900 bg-white shadow-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                                        Contact Number
                                    </label>
                                    <input
                                        type="text"
                                        name="contact_number"
                                        value={formData.contact_number}
                                        onChange={handleChange}
                                        placeholder="0917-XXX-XXXX"
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#08315F] text-xs font-bold text-slate-900 bg-white shadow-sm"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                                        What is your current position? <span className="text-rose-500">*</span>
                                    </label>
                                    <span className="text-[10px] text-slate-400 block mb-2 font-medium">
                                        [For other positions, do not abbreviate. e.g. Education Program Supervisor, Public Schools District Supervisor]
                                    </span>
                                    <input
                                        type="text"
                                        name="current_position"
                                        value={formData.current_position}
                                        onChange={handleChange}
                                        placeholder="e.g. Chief Education Supervisor"
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#08315F] text-xs font-bold text-slate-900 bg-white shadow-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                                        In what Schools Division Office or Regional Office does your plantilla item belong to? <span className="text-rose-500">*</span>
                                    </label>
                                    <span className="text-[10px] text-slate-400 block mb-2 font-medium">
                                        [i.e. SDO-Pasig City; SDO-Cebu City; Regional Office; For non-DepEd, include Agency and Office Assignment]
                                    </span>
                                    <input
                                        type="text"
                                        name="plantilla_office"
                                        value={formData.plantilla_office}
                                        onChange={handleChange}
                                        placeholder="e.g. SDO-Pasig City or Regional Office IV-A"
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#08315F] text-xs font-bold text-slate-900 bg-white shadow-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: THIRD LEVEL DESIGNATION & OIC ASSIGNMENT */}
                    {currentStep === 3 && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                                    What is your current designation to a third level position? <span className="text-rose-500">*</span>
                                </label>
                                <span className="text-[10px] text-slate-400 block mb-3 font-medium">
                                    [For others, input full designation. Do not abbreviate]
                                </span>

                                <div className="space-y-2.5">
                                    {DESIGNATION_PRESETS.map((option) => (
                                        <label
                                            key={option}
                                            className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                                                formData.current_designation_preset === option
                                                    ? 'bg-blue-50/70 border-[#08315F] text-[#08315F] shadow-sm'
                                                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="current_designation_preset"
                                                value={option}
                                                checked={formData.current_designation_preset === option}
                                                onChange={handleChange}
                                                className="mt-1 text-[#08315F] focus:ring-[#08315F]"
                                            />
                                            <span className="text-xs font-bold leading-relaxed">{option}</span>
                                        </label>
                                    ))}
                                </div>

                                {formData.current_designation_preset === 'Other' && (
                                    <div className="mt-3">
                                        <input
                                            type="text"
                                            name="current_designation_custom"
                                            value={formData.current_designation_custom}
                                            onChange={handleChange}
                                            placeholder="Input full designation (do not abbreviate)"
                                            className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#08315F] text-xs font-bold text-slate-900 bg-white shadow-sm"
                                        />
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                                    Assigned Schools Division Office as designated OIC
                                </label>
                                <span className="text-[10px] text-slate-400 block mb-2 font-medium">
                                    [i.e. SDO-Pasig City; SDO-Cebu City; Regional Office; For non-DepEd, include Agency and Office Assignment]
                                </span>
                                <input
                                    type="text"
                                    name="assigned_oic_office"
                                    value={formData.assigned_oic_office}
                                    onChange={handleChange}
                                    placeholder="e.g. SDO-Manila (or leave blank if N/A)"
                                    className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#08315F] text-xs font-bold text-slate-900 bg-white shadow-sm"
                                />
                            </div>
                        </div>
                    )}

                    {/* STEP 4: EXAMINATION & CES ELIGIBILITIES */}
                    {currentStep === 4 && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                                        Are you a passer of the Licensure Examination for Teachers (LET)? <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="flex items-center gap-6">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="is_let_passer"
                                                checked={formData.is_let_passer === true}
                                                onChange={() => setFormData(prev => ({ ...prev, is_let_passer: true }))}
                                                className="text-[#08315F] focus:ring-[#08315F]"
                                            />
                                            <span className="text-xs font-bold text-slate-800">Yes</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="is_let_passer"
                                                checked={formData.is_let_passer === false}
                                                onChange={() => setFormData(prev => ({ ...prev, is_let_passer: false }))}
                                                className="text-[#08315F] focus:ring-[#08315F]"
                                            />
                                            <span className="text-xs font-bold text-slate-800">No</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                                        Are you a passer of the Educational Management Test (EMT)? <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="flex items-center gap-6">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="is_emt_passer"
                                                checked={formData.is_emt_passer === true}
                                                onChange={() => setFormData(prev => ({ ...prev, is_emt_passer: true }))}
                                                className="text-[#08315F] focus:ring-[#08315F]"
                                            />
                                            <span className="text-xs font-bold text-slate-800">Yes</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="is_emt_passer"
                                                checked={formData.is_emt_passer === false}
                                                onChange={() => setFormData(prev => ({ ...prev, is_emt_passer: false }))}
                                                className="text-[#08315F] focus:ring-[#08315F]"
                                            />
                                            <span className="text-xs font-bold text-slate-800">No</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                                        What is the highest stage of the Career Executive Service (CES) eligibility process that you have passed/completed? <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        name="ces_eligibility_stage"
                                        value={formData.ces_eligibility_stage}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#08315F] text-xs font-bold text-slate-800 bg-white"
                                    >
                                        {CES_STAGES.map(stage => (
                                            <option key={stage} value={stage}>{stage}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                                        Date Appointed/Conferred/Passed the CESO/CES eligibility process [Highest Stage]
                                    </label>
                                    <input
                                        type="date"
                                        name="ces_stage_date"
                                        value={formData.ces_stage_date}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#08315F] text-xs font-bold text-slate-900 bg-white shadow-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 5: 12 REQUIRED DOCUMENT ATTACHMENTS */}
                    {currentStep === 5 && (
                        <div className="space-y-6">
                            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                    <FiInfo size={20} className="text-blue-700 mt-0.5 shrink-0" />
                                    <div className="text-xs text-blue-900 space-y-1">
                                        <p className="font-bold">12 Required Document Attachments</p>
                                        <p>Please upload all required PDF/image documents according to DepEd specifications. Files are stored securely and encrypted in the official document registry.</p>
                                    </div>
                                </div>
                                <a
                                    href="https://tinyurl.com/3rdLevelForms"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#08315F] text-white text-[10px] font-black uppercase tracking-wider shrink-0 shadow-sm hover:bg-blue-900 transition-colors"
                                >
                                    <span>Download Templates</span>
                                    <FiExternalLink size={12} />
                                </a>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {REQUIRED_DOCUMENTS.map((doc) => {
                                    const binaryId = formData[doc.binaryKey];
                                    const filename = formData[doc.nameKey];
                                    const isUploading = uploadingDoc[doc.key];

                                    return (
                                        <div
                                            key={doc.key}
                                            className={`p-4 rounded-2xl border transition-all ${
                                                binaryId
                                                    ? 'bg-emerald-50/50 border-emerald-300'
                                                    : doc.required
                                                    ? 'bg-white border-slate-200 hover:border-slate-300'
                                                    : 'bg-slate-50/50 border-slate-200'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs font-black text-slate-800 uppercase tracking-tight truncate">
                                                            {doc.label}
                                                        </span>
                                                        {doc.required ? (
                                                            <span className="text-rose-500 font-bold">*</span>
                                                        ) : (
                                                            <span className="text-[9px] px-1.5 py-0.2 bg-slate-200 text-slate-600 rounded font-bold uppercase">Optional</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 font-medium leading-snug mt-0.5">
                                                        {doc.instruction}
                                                    </p>
                                                </div>

                                                {binaryId && (
                                                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                                        <FiCheck size={12} />
                                                    </span>
                                                )}
                                            </div>

                                            {/* File Status or Upload Drop Area */}
                                            {binaryId ? (
                                                <div className="mt-3 p-2.5 rounded-xl bg-white border border-emerald-200 flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <FiFileText size={16} className="text-emerald-600 shrink-0" />
                                                        <span className="text-xs font-mono font-bold text-slate-700 truncate" title={filename}>
                                                            {filename || 'Uploaded Document'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <a
                                                            href={apiUrl(`/api/binary/${binaryId}`)}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold"
                                                            title="View Document"
                                                        >
                                                            <FiExternalLink size={12} />
                                                        </a>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveDoc(doc)}
                                                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px]"
                                                            title="Remove / Re-upload"
                                                        >
                                                            <FiTrash2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="mt-3">
                                                    <label className={`w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl border border-dashed text-xs font-bold cursor-pointer transition-all ${
                                                        isUploading
                                                            ? 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed'
                                                            : 'bg-slate-50 hover:bg-blue-50/70 border-slate-300 hover:border-[#08315F] text-slate-600 hover:text-[#08315F]'
                                                    }`}>
                                                        {isUploading ? (
                                                            <>
                                                                <FiLoader className="animate-spin text-[#08315F]" size={14} />
                                                                <span>Uploading...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <FiUploadCloud size={16} />
                                                                <span>Choose {doc.isImage ? 'Image' : 'File'}</span>
                                                            </>
                                                        )}
                                                        <input
                                                            type="file"
                                                            accept={doc.accept}
                                                            disabled={isUploading}
                                                            onChange={(e) => {
                                                                if (e.target.files && e.target.files[0]) {
                                                                    handleFileUpload(doc, e.target.files[0]);
                                                                }
                                                            }}
                                                            className="hidden"
                                                        />
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* STEP 6: REVIEW & SUBMIT */}
                    {currentStep === 6 && (
                        <div className="space-y-6">
                            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                                <FiCheckCircle size={22} className="text-emerald-700 mt-0.5 shrink-0" />
                                <div className="text-xs text-emerald-900 space-y-1">
                                    <p className="font-bold">Ready for Submission</p>
                                    <p>Review your information carefully before submitting. Once submitted, your application will be assigned an official reference number and entered into the DepEd screening pipeline.</p>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-wider text-[#08315F] pb-2 border-b border-slate-200">
                                    Application Summary
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                    <div>
                                        <span className="text-slate-400 block font-medium">Position Applying For:</span>
                                        <span className="font-bold text-slate-800">{formData.position_applying_for}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block font-medium">Target Vacancy ID:</span>
                                        <span className="font-mono font-bold text-slate-800">{formData.target_vacancy_id || 'General Pool'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block font-medium">Applicant Full Name:</span>
                                        <span className="font-bold text-slate-800">{formData.surname}, {formData.first_name} {formData.middle_name || ''}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block font-medium">Date of Birth:</span>
                                        <span className="font-bold text-slate-800">{formData.date_of_birth || '—'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block font-medium">Current Position:</span>
                                        <span className="font-bold text-slate-800">{formData.current_position}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block font-medium">Plantilla Office:</span>
                                        <span className="font-bold text-slate-800">{formData.plantilla_office}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block font-medium">Third Level Designation:</span>
                                        <span className="font-bold text-slate-800">
                                            {formData.current_designation_preset === 'Other' ? formData.current_designation_custom : formData.current_designation_preset}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block font-medium">Assigned OIC Office:</span>
                                        <span className="font-bold text-slate-800">{formData.assigned_oic_office || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block font-medium">LET Passer:</span>
                                        <span className="font-bold text-slate-800">{formData.is_let_passer ? 'Yes' : 'No'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block font-medium">EMT Passer:</span>
                                        <span className="font-bold text-slate-800">{formData.is_emt_passer ? 'Yes' : 'No'}</span>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <span className="text-slate-400 block font-medium">CES Eligibility Stage:</span>
                                        <span className="font-bold text-slate-800">{formData.ces_eligibility_stage} ({formData.ces_stage_date || 'Date not specified'})</span>
                                    </div>
                                </div>
                            </div>

                            {/* Documents Check Table */}
                            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3">
                                <h3 className="text-xs font-black uppercase tracking-wider text-[#08315F] pb-2 border-b border-slate-200">
                                    Document Attachments ({REQUIRED_DOCUMENTS.filter(d => formData[d.binaryKey]).length} / {REQUIRED_DOCUMENTS.length})
                                </h3>
                                <div className="space-y-1.5">
                                    {REQUIRED_DOCUMENTS.map(doc => {
                                        const uploaded = Boolean(formData[doc.binaryKey]);
                                        return (
                                            <div key={doc.key} className="flex items-center justify-between text-xs py-1">
                                                <span className="text-slate-700 font-medium truncate pr-2">{doc.label}</span>
                                                {uploaded ? (
                                                    <span className="inline-flex items-center gap-1 text-emerald-600 font-bold shrink-0">
                                                        <FiCheck size={13} />
                                                        <span>Ready</span>
                                                    </span>
                                                ) : doc.required ? (
                                                    <span className="text-rose-600 font-bold shrink-0">Missing</span>
                                                ) : (
                                                    <span className="text-slate-400 font-medium shrink-0">Not Attached</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Controls */}
                <div className="bg-slate-50 px-4 sm:px-6 py-3.5 sm:py-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                        {currentStep > 1 && (
                            <button
                                type="button"
                                onClick={handlePrev}
                                className="flex-1 sm:flex-initial justify-center px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95"
                            >
                                <FiChevronLeft size={14} />
                                <span>Previous</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 sm:flex-initial justify-center px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-600 text-xs font-black uppercase tracking-wider transition-all"
                        >
                            Cancel
                        </button>
                    </div>

                    <div className="flex items-center gap-2.5 sm:gap-3">
                        {currentStep < STEPS.length ? (
                            <button
                                type="button"
                                onClick={handleNext}
                                className="w-full sm:w-auto justify-center px-5 py-2.5 rounded-xl bg-[#08315F] hover:bg-blue-900 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all active:scale-95"
                            >
                                <span>Next Step</span>
                                <FiChevronRight size={14} />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSubmitApplication}
                                disabled={submitting}
                                className="w-full sm:w-auto justify-center px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md transition-all active:scale-95"
                            >
                                {submitting ? (
                                    <>
                                        <FiLoader className="animate-spin" size={14} />
                                        <span>Submitting Application...</span>
                                    </>
                                ) : (
                                    <>
                                        <FiCheckCircle size={15} />
                                        <span>Submit Official Application</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default ApplyVacancyModal;

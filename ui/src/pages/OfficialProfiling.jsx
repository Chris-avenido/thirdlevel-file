import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiUser, FiAward, FiBriefcase, FiBook, FiFileText, FiShield,
    FiChevronLeft, FiChevronRight, FiSave, FiPlus, FiTrash2, FiCheckCircle,
    FiAlertTriangle, FiInfo, FiUpload, FiToggleLeft, FiToggleRight,
    FiSearch, FiLoader, FiList, FiLock, FiTrendingUp, FiClock, FiActivity, FiStar, FiArrowRight, FiCalendar,
    FiDownload, FiX, FiMonitor, FiFile
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import PageTransition from '../components/PageTransition';
import html2pdf from 'html2pdf.js';
import PptxGenJS from 'pptxgenjs';
import newLogo from '../assets/new_logo.png';
import { apiUrl } from '../utils/api';
import { compressImageClientSide } from '../utils/imageCompressor';
import ModernDatePicker from '../components/ModernDatePicker';
import Swal from 'sweetalert2';

const TABS = [
    { id: 'personal', label: 'Personal Info', icon: FiUser },
    { id: 'eligibility', label: 'Eligibility', icon: FiAward },
    { id: 'experience', label: 'Experience', icon: FiBriefcase },
    { id: 'education', label: 'Education', icon: FiBook },
    { id: 'performance', label: 'Performance Ratings', icon: FiActivity },
    { id: 'trainings', label: 'Prof. Dev. Trainings', icon: FiStar },
    { id: 'achievements', label: 'Achievements', icon: FiTrendingUp },
    { id: 'documents', label: 'Documents', icon: FiFileText },
    { id: 'legal', label: 'Legal', icon: FiShield },
    { id: 'application', label: 'Apply for Position', icon: FiActivity },
    { id: 'summary', label: 'Summary & Certify', icon: FiList },
];

const SummaryRow = ({ label, value }) => (
    <div className="flex flex-col gap-1 min-w-0">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{label}</span>
        <span className="text-sm font-bold text-slate-800 break-words">{value || <span className="text-slate-300 italic font-normal text-xs">—</span>}</span>
    </div>
);

const COMPLETENESS_FIELDS = [
    'first_name', 'last_name', 'gender', 'date_of_birth', 'civil_status',
    'position_title', 'appointment_date',
    'permanent_address', 'highest_education', 'education_program', 'education_year_graduated',
    'performance_rating_1', 'performance_rating_1_period', 'pending_admin_case', 'ombudsman_case'
];

const computeAge = (dob) => {
    if (!dob) return '';
    const today = new Date();
    const birth = new Date(dob);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
};


const calculateDuration = (start, end) => {
    if (!start) return { years: 0, months: 0 };
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();

    let years = endDate.getFullYear() - startDate.getFullYear();
    let months = endDate.getMonth() - startDate.getMonth();

    if (months < 0) {
        years--;
        months += 12;
    }

    return { years, months };
};

const inp = 'w-full bg-white hover:bg-transparent border border-slate-200 focus:border-[#0038A8] focus:ring-1 focus:ring-[#0038A8] rounded-lg py-2.5 px-4 text-xs font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400/80 shadow-none';
const sel = 'w-full bg-white hover:bg-transparent border border-slate-200 focus:border-[#0038A8] focus:ring-1 focus:ring-[#0038A8] rounded-lg py-2.5 px-4 text-xs font-semibold text-slate-800 outline-none transition-all shadow-none';

const Field = ({ label, children }) => (
    <div className="flex flex-col gap-1.5 group">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest transition-colors duration-200 group-focus-within:text-[#08315F]">{label}</label>
        {children}
    </div>
);

const SectionLabel = ({ children }) => (
    <p className="text-[11px] font-black uppercase tracking-[0.05em] text-[#08315F] mb-4">{children}</p>
);

const buildFullName = (profile) => {
    const suffix = profile.suffix && profile.suffix.toLowerCase() !== 'not applicable' ? profile.suffix : '';
    return [profile.first_name, profile.middle_name, profile.last_name, suffix].filter(Boolean).join(' ').trim();
};

const PREVIOUS_POSITION_OPTIONS = [
    'Secretary',
    'Undersecretary',
    'Assistant Secretary',
    'Director IV',
    'Director III',
    'Regional Director',
    'Assistant Regional Director',
    'Schools Division Superintendent',
    'Assistant Schools Division Superintendent',
    'Chief Administrative Officer',
    'Supervising Administrative Officer',
    'Administrative Officer V',
    'Education Program Supervisor',
    'Public Schools District Supervisor',
    'Principal IV',
    'Principal III',
    'Principal II',
    'Principal I'
];

const SearchableSelect = ({ value, onChange, options, placeholder, className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState(value || '');
    const containerRef = React.useRef(null);

    useEffect(() => {
        setSearch(value || '');
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt =>
        opt.toLowerCase().includes(search.toLowerCase())
    );

    const handleInputChange = (e) => {
        const val = e.target.value;
        setSearch(val);
        onChange(val);
        setIsOpen(true);
    };

    return (
        <div ref={containerRef} className="relative w-full">
            <input
                type="text"
                placeholder={placeholder}
                value={search}
                onChange={handleInputChange}
                onFocus={() => setIsOpen(true)}
                className={`w-full ${className}`}
            />
            {isOpen && (
                <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map(opt => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                    onChange(opt);
                                    setSearch(opt);
                                    setIsOpen(false);
                                }}
                                className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-transparent transition-colors"
                            >
                                {opt}
                            </button>
                        ))
                    ) : (
                        <div className="px-3 py-2 text-xs text-slate-400 italic">No matches found. Typing custom position...</div>
                    )}
                </div>
            )}
        </div>
    );
};

const OfficialProfiling = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const urlEmail = searchParams.get('email');
    const { user, token, logout } = useAuth();

    const [status, setStatus] = useState('loading'); // loading | found | not-found | error
    const [TLOid, setTlid] = useState(null);
    const [applicationId, setApplicationId] = useState(null);
    const [applicationStatus, setApplicationStatus] = useState(null); // draft|pending_review|denied|approved|null(masterlist)
    const [denialReason, setDenialReason] = useState('');
    const [dataSource, setDataSource] = useState(null); // 'staging' | 'masterlist'
    const [tab, setTab] = useState('personal');
    const [saving, setSaving] = useState(false);
    const [uploadingDocs, setUploadingDocs] = useState({});
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saved, setSaved] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const [profile, setProfile] = useState({
        last_name: '', first_name: '', middle_name: '', suffix: '',
        gender: '', date_of_birth: '', age: '', civil_status: '',
        position_title: '', designation: '', is_oic: false, appointment_date: '',
        emt_passer: null, emt_date: '', ces_stage: '', ces_conferment_date: '',
        total_years_third_level: '', permanent_address: '',
        highest_education: '', specific_degree: '', education_program: '', education_year_graduated: '',
        notable_achievements: '',
        performance_rating_1: '', performance_rating_1_period: '',
        performance_rating_2: '', performance_rating_2_period: '',
        cespes_1_rating: '', cespes_2_rating: '',
        cespes_rating_1_period: '', cespes_rating_2_period: '',
        managerial_experience_total: '',
        pending_admin_case: '', ombudsman_case: '',
        sandiganbayan_case: '', nbi_case: '', csc_case: '',
        updated_at: null,
    });
    const [prevPositions, setPrevPositions] = useState([]);
    const [trainings, setTrainings] = useState([]);
    const [completeness, setCompleteness] = useState(0);
    const [dpaConsent, setDpaConsent] = useState(false);
    const [truthConsent, setTruthConsent] = useState(false);
    const [certified, setCertified] = useState(false);
    const [certifying, setCertifying] = useState(false);
    const [vacancies, setVacancies] = useState([]);
    const [vacanciesLoading, setVacanciesLoading] = useState(false);
    const [targetVacancyId, setTargetVacancyId] = useState(null);
    const [notableAchievementsOptions, setNotableAchievementsOptions] = useState([]);

    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [selectedExportType, setSelectedExportType] = useState('csv');
    const [exporting, setExporting] = useState(false);
    const [previewScale, setPreviewScale] = useState(1);
    const previewContainerRef = React.useRef(null);

    React.useEffect(() => {
        if (!exportModalOpen) return;
        const observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                const width = entry.contentRect.width;
                // Previews are 1000px wide, plus padding -> ~1040px
                const targetWidth = 1040;
                if (width < targetWidth) {
                    setPreviewScale(width / targetWidth);
                } else {
                    setPreviewScale(1);
                }
            }
        });

        // Use timeout to allow DOM to render before observing
        const timeoutId = setTimeout(() => {
            if (previewContainerRef.current) {
                observer.observe(previewContainerRef.current);
            }
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            observer.disconnect();
        };
    }, [exportModalOpen, selectedExportType]);
    const fullName = buildFullName(profile) || 'Official Profiling';
    const completedFields = COMPLETENESS_FIELDS.filter(f => !!profile[f]).length;

    const isTabCompleted = (tabId) => {
        if (tabId === 'personal') {
            return !!(profile.first_name && profile.last_name && profile.gender && profile.date_of_birth && profile.civil_status);
        }
        if (tabId === 'eligibility') {
            return !!(profile.ces_stage || profile.emt_passer !== null);
        }
        if (tabId === 'experience') {
            return prevPositions.length > 0;
        }
        if (tabId === 'education') {
            return !!(profile.highest_education && profile.education_program && profile.education_year_graduated);
        }
        if (tabId === 'performance') {
            return !!(profile.performance_rating_1 && profile.performance_rating_1_period);
        }
        if (tabId === 'trainings') {
            return trainings.length > 0;
        }
        if (tabId === 'achievements') {
            return !!profile.notable_achievements;
        }
        if (tabId === 'documents') {
            return !!profile.photo_binary_id;
        }
        if (tabId === 'legal') {
            return profile.pending_admin_case !== '' && profile.ombudsman_case !== '';
        }
        if (tabId === 'application') {
            return !!targetVacancyId;
        }
        if (tabId === 'summary') {
            return completeness === 100;
        }
        return false;
    };

    // Export Logic
    const generateCSV = () => {
        setExporting(true);
        try {
            const header = [
                'First Name', 'Last Name', 'Middle Name', 'Suffix', 'Gender', 'Date of Birth', 'Age', 'Civil Status',
                'Position Title', 'Designation', 'Date of Present Position', 'Permanent Address',
                'Career Executive Service (CES)', 'CES Conferment Date', 'Educational Management Test (EMT)', 'EMT Date',
                'Highest Education', 'Specific Degree', 'Program / Course', 'Year Graduated',
                'Latest Rating (1st)', 'Previous Rating (2nd)', 'CESPES 1st Sem', 'CESPES 2nd Sem', 'Total Managerial Experience',
                'Notable Achievements', 'Previous Position 1', 'Documents 2x2 Photo', 'Administrative Cases', 'Ombudsman / CSC Cases'
            ];
            const row = [
                profile.first_name, profile.last_name, profile.middle_name, profile.suffix, profile.gender, profile.date_of_birth, profile.age, profile.civil_status,
                profile.position_title, profile.designation, profile.appointment_date, profile.permanent_address,
                profile.ces_stage, profile.ces_conferment_date, profile.emt_passer === true ? 'Yes' : profile.emt_passer === false ? 'No' : '', profile.emt_date,
                profile.highest_education, profile.specific_degree, profile.education_program, profile.education_year_graduated,
                profile.performance_rating_1, profile.performance_rating_2, profile.cespes_1_rating, profile.cespes_2_rating, profile.managerial_experience_total,
                profile.notable_achievements, prevPositions[0]?.position_name || '', profile.photo_binary_id ? 'Uploaded' : 'Missing', profile.pending_admin_case, profile.ombudsman_case
            ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',');

            const csvContent = "data:text/csv;charset=utf-8," + header.join(',') + "\n" + row;
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `profile_${profile.last_name || 'export'}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error(err);
            Swal.fire('Notice', "Failed to generate CSV", 'info');
        } finally {
            setExporting(false);
        }
    };

    const generatePDF = () => {
        setExporting(true);
        try {
            const element = document.getElementById('pdf-preview-content');
            if (!element) {
                setExporting(false);
                return;
            }
            const opt = {
                margin: 0,
                filename: `profile_${profile.last_name || 'export'}.pdf`,
                image: { type: 'jpeg', quality: 1.0 },
                html2canvas: { scale: 3, useCORS: true, letterRendering: true },
                jsPDF: { unit: 'in', format: [13.33, 7.5], orientation: 'landscape' }
            };
            html2pdf().set(opt).from(element).save().then(() => setExporting(false));
        } catch (err) {
            console.error(err);
            Swal.fire('Notice', "Failed to generate PDF", 'info');
            setExporting(false);
        }
    };

    const generatePPT = () => {
        setExporting(true);
        try {
            let pres = new PptxGenJS();
            pres.layout = 'LAYOUT_16x9';
            let slide = pres.addSlide();

            // Header: Logo, Name and Position
            slide.addImage({ path: newLogo, x: 0.4, y: 0.2, w: 1.1, h: 1.1 });
            slide.addText(`${profile.last_name?.toUpperCase() || ''}, ${profile.first_name?.toUpperCase() || ''} ${profile.middle_name?.toUpperCase() || ''}`, { x: 1.6, y: 0.3, w: 4.3, h: 0.6, fontSize: 32, bold: true, color: '000000' });
            slide.addText(`${profile.position_title || ''}, ${profile.office || ''}`, { x: 1.6, y: 0.9, w: 4.3, h: 0.5, fontSize: 22, bold: true, color: '000000' });

            // Top Right: Position Applied For
            slide.addShape(pres.ShapeType.rect, { x: 6.2, y: 0.4, w: 2.2, h: 0.3, fill: { color: 'B91C1C' } });
            slide.addText('Position Applied For', { x: 6.2, y: 0.4, w: 2.2, h: 0.3, color: 'FFFFFF', bold: true, align: 'center', fontSize: 12 });
            slide.addShape(pres.ShapeType.rect, { x: 6.2, y: 0.7, w: 2.2, h: 0.5, fill: { color: 'FFFFFF' }, line: { color: 'B91C1C' } });
            slide.addText(targetVacancyId ? vacancies.find(v => v.TLOid === targetVacancyId)?.position_title || 'N/A' : 'N/A', { x: 6.2, y: 0.7, w: 2.2, h: 0.5, align: 'center', fontSize: 11, color: '000000' });

            // Top Right: Photo
            slide.addShape(pres.ShapeType.rect, { x: 8.6, y: 0.2, w: 1.2, h: 1.2, fill: { color: 'E2E8F0' } });
            slide.addText('2x2 Photo', { x: 8.6, y: 0.2, w: 1.2, h: 1.2, align: 'center', color: '64748B', fontSize: 10 });

            // Managerial Experience Table
            let histRows = [
                [{ text: 'Managerial Experience', options: { colspan: 3, fill: '0038A8', color: 'FFFFFF', bold: true, align: 'center', fontSize: 14 } }]
            ];
            const displayHistory = history.slice(0, 4);
            displayHistory.forEach(h => {
                const dur = h.start_date && h.end_date ? calculateDuration(h.start_date, h.end_date) : { years: 0, months: 0 };
                histRows.push([
                    { text: h.position_title || '', options: { fill: 'FFFFFF', fontSize: 10, color: '000000' } },
                    { text: h.office || '', options: { fill: 'FFFFFF', fontSize: 10, color: '000000' } },
                    { text: `${dur.years} yrs., ${dur.months} mos.`, options: { fill: 'FFFFFF', fontSize: 10, color: '000000' } }
                ]);
            });
            if (displayHistory.length === 0) histRows.push([{ text: 'No experience listed', options: { colspan: 3, fill: 'FFFFFF', fontSize: 10, align: 'center' } }]);
            slide.addTable(histRows, { x: 0.4, y: 1.6, w: 5.5, colW: [1.2, 2.8, 1.5], border: { pt: 1, color: '64748B' } });

            // Educational Attainment Table
            let eduRows = [
                [{ text: 'Educational Attainment', options: { colspan: 3, fill: '0038A8', color: 'FFFFFF', bold: true, align: 'center', fontSize: 14 } }]
            ];
            eduRows.push([
                { text: 'N/A', options: { fill: 'FFFFFF', fontSize: 10, color: '000000' } },
                { text: profile.specific_degree || profile.education_program || '', options: { fill: 'FFFFFF', fontSize: 10, color: '000000' } },
                { text: profile.education_year_graduated || '', options: { fill: 'FFFFFF', fontSize: 10, align: 'center', color: '000000' } }
            ]);
            slide.addTable(eduRows, { x: 0.4, y: 3.8, w: 5.5, colW: [1.5, 3.0, 1.0], border: { pt: 1, color: '64748B' } });

            // Age Box
            slide.addShape(pres.ShapeType.rect, { x: 6.2, y: 1.6, w: 1.0, h: 0.25, fill: { color: 'F59E0B' } });
            slide.addText('Age', { x: 6.2, y: 1.6, w: 1.0, h: 0.25, color: 'FFFFFF', bold: true, align: 'center', fontSize: 12 });
            slide.addShape(pres.ShapeType.rect, { x: 6.2, y: 1.85, w: 1.0, h: 0.4, fill: { color: 'FFFFFF' }, line: { color: '64748B' } });
            slide.addText(`${profile.age || ''}`, { x: 6.2, y: 1.85, w: 1.0, h: 0.4, align: 'center', fontSize: 14, color: '000000' });

            // Performance Rating Table
            let perfRows = [
                [{ text: 'Performance Rating', options: { colspan: 2, fill: 'B91C1C', color: 'FFFFFF', bold: true, align: 'center', fontSize: 12 } }]
            ];
            if (profile.cespes_1_rating) perfRows.push([{ text: `${profile.cespes_rating_1_period || ''} 1st sem (CESPES)`, options: { fontSize: 10, color: '000000' } }, { text: profile.cespes_1_rating, options: { fontSize: 10, align: 'center', color: '000000' } }]);
            if (profile.cespes_2_rating) perfRows.push([{ text: `${profile.cespes_rating_2_period || ''} 2nd sem (CESPES)`, options: { fontSize: 10, color: '000000' } }, { text: profile.cespes_2_rating, options: { fontSize: 10, align: 'center', color: '000000' } }]);
            if (profile.performance_rating_1) perfRows.push([{ text: `${profile.performance_rating_1_period || ''} (OPCRF)`, options: { fontSize: 10, color: '000000' } }, { text: profile.performance_rating_1, options: { fontSize: 10, align: 'center', color: '000000' } }]);
            if (profile.performance_rating_2) perfRows.push([{ text: `${profile.performance_rating_2_period || ''} (OPCRF)`, options: { fontSize: 10, color: '000000' } }, { text: profile.performance_rating_2, options: { fontSize: 10, align: 'center', color: '000000' } }]);

            if (perfRows.length === 1) perfRows.push([{ text: 'No ratings', options: { colspan: 2, fontSize: 10, align: 'center', color: '000000' } }]);
            slide.addTable(perfRows, { x: 6.2, y: 2.4, w: 3.6, colW: [2.6, 1.0], border: { pt: 1, color: 'B91C1C' }, fill: 'FFFFFF' });

            // Eligibility Table
            let eligRows = [
                [{ text: 'Eligibility', options: { colspan: 2, fill: 'B91C1C', color: 'FFFFFF', bold: true, align: 'center', fontSize: 12 } }]
            ];
            eligRows.push([{ text: `CES: ${profile.ces_stage || 'Not Applicable'}`, options: { fontSize: 10, color: '000000' } }, { text: profile.ces_conferment_date || '', options: { fontSize: 10, align: 'center', color: '000000' } }]);
            eligRows.push([{ text: `EMT: ${profile.emt_passer === true ? 'Passed' : profile.emt_passer === false ? 'Not Passed' : 'Not Applicable'}`, options: { fontSize: 10, color: '000000' } }, { text: profile.emt_date || '', options: { fontSize: 10, align: 'center', color: '000000' } }]);
            slide.addTable(eligRows, { x: 6.2, y: 4.0, w: 3.6, colW: [2.0, 1.6], border: { pt: 1, color: 'B91C1C' }, fill: 'FFFFFF' });
            pres.writeFile({ fileName: `profile_${profile.last_name || 'export'}.pptx` }).then(() => setExporting(false));
        } catch (err) {
            console.error(err);
            Swal.fire('Notice', "Failed to generate PPT", 'info');
            setExporting(false);
        }
    };

    useEffect(() => {
        const filledCount = COMPLETENESS_FIELDS.filter(f => !!profile[f]).length;
        setCompleteness(Math.round((filledCount / COMPLETENESS_FIELDS.length) * 100));
    }, [profile]);

    useEffect(() => {
        if (completeness === 100 && profile.profiling_status !== 'profiling completed') {
            setP('profiling_status', 'profiling completed');
        } else if (completeness < 100 && profile.profiling_status === 'profiling completed') {
            setP('profiling_status', 'profiling');
        }
    }, [completeness]);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024) {
                document.documentElement.style.overflow = 'hidden';
                document.body.style.overflow = 'hidden';
                document.documentElement.style.height = '100%';
                document.body.style.height = '100%';
            } else {
                document.documentElement.style.overflow = '';
                document.body.style.overflow = '';
                document.documentElement.style.height = '';
                document.body.style.height = '';
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => {
            window.removeEventListener('resize', handleResize);
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            document.documentElement.style.height = '';
            document.body.style.height = '';
        };
    }, []);

    useEffect(() => {
        const emailToLookup = urlEmail || user?.email || user?.userEmail || localStorage.getItem('userEmail');
        if (emailToLookup) {
            lookupByEmail(emailToLookup);
        } else {
            const timer = setTimeout(() => {
                if (!user && !localStorage.getItem('userEmail')) {
                    setStatus('not-found');
                }
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [user, urlEmail]);

    useEffect(() => {
        if (TLOid) {
            fetchHistory(TLOid);
        }
    }, [TLOid]);

    const fetchHistory = async (id) => {
        setHistoryLoading(true);
        try {
            const res = await fetch(apiUrl(`/api/third-level/${id}/career-path`), {
                headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success) setHistory(data.data);
        } catch (err) {
            console.error('Failed to fetch career path:', err);
        } finally {
            setHistoryLoading(false);
        }
    };

    // Managerial Experience Auto-Computation
    useEffect(() => {
        let totalYears = 0;
        let totalMonths = 0;

        // 1. Current Position
        if (profile.appointment_date) {
            const dur = calculateDuration(profile.appointment_date, null);
            totalYears += dur.years;
            totalMonths += dur.months;
        }

        // 2. Previous Positions
        prevPositions.forEach(pos => {
            if (pos.start_date) {
                const dur = calculateDuration(pos.start_date, pos.end_date);
                totalYears += dur.years;
                totalMonths += dur.months;
            }
        });

        // Normalize months
        totalYears += Math.floor(totalMonths / 12);
        totalMonths = totalMonths % 12;

        const resultStr = `${totalYears} Year${totalYears !== 1 ? 's' : ''}, ${totalMonths} Month${totalMonths !== 1 ? 's' : ''}`;
        if (profile.managerial_experience_total !== resultStr) {
            setProfile(prev => ({ ...prev, managerial_experience_total: resultStr }));
        }
    }, [prevPositions, profile.appointment_date]);

    // Training Hours Auto-Computation
    useEffect(() => {
        const total = trainings.reduce((acc, tr) => acc + (parseFloat(tr.hours) || 0), 0);
        if (parseFloat(profile.total_training_hours) !== total) {
            setProfile(prev => ({ ...prev, total_training_hours: total }));
        }
    }, [trainings]);

    const lookupByEmail = async (email) => {
        if (!email) { setStatus('not-found'); return; }
        try {
            const res = await fetch(apiUrl(`/api/third-level/by-email?email=${encodeURIComponent(email)}`), {
                headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success && data.data) {
                const d = data.data;
                setTlid(d.TLOid || d.app_TLOid);
                setApplicationId(d.application_id || null);
                setApplicationStatus(data.source === 'masterlist' ? null : d.application_status);
                setDenialReason(d.denial_reason || '');
                setDataSource(data.source);
                setTargetVacancyId(d.target_TLOid || null);
                setProfile({
                    last_name: d.last_name || '',
                    first_name: d.first_name || '',
                    middle_name: d.middle_name || '',
                    suffix: d.suffix || '',
                    gender: d.gender || '',
                    date_of_birth: d.date_of_birth ? d.date_of_birth.split('T')[0] : '',
                    age: d.age ?? '',
                    civil_status: d.civil_status || '',
                    position_title: d.position_title || '',
                    designation: d.designation || '',
                    is_oic: d.is_oic ?? false,
                    appointment_date: d.appointment_date ? d.appointment_date.split('T')[0] : '',
                    emt_passer: d.emt_passer ?? null,
                    emt_date: d.emt_date ? d.emt_date.split('T')[0] : '',
                    ces_stage: d.ces_stage || '',
                    ces_conferment_date: d.ces_conferment_date ? d.ces_conferment_date.split('T')[0] : '',
                    total_years_third_level: d.total_years_third_level ?? '',
                    permanent_address: d.permanent_address || '',
                    highest_education: d.highest_education || '',
                    specific_degree: d.specific_degree || '',
                    education_program: d.education_program || '',
                    education_year_graduated: d.education_year_graduated ?? '',
                    notable_achievements: d.notable_achievements || '',
                    performance_rating_1: d.performance_rating_1 || '',
                    performance_rating_1_period: d.performance_rating_1_period || '',
                    performance_rating_2: d.performance_rating_2 || '',
                    performance_rating_2_period: d.performance_rating_2_period || '',
                    cespes_1_rating: d.cespes_1_rating || '',
                    cespes_2_rating: d.cespes_2_rating || '',
                    cespes_rating_1_period: d.cespes_rating_1_period || '',
                    cespes_rating_2_period: d.cespes_rating_2_period || '',
                    managerial_experience_total: d.managerial_experience_total || '',
                    pending_admin_case: d.pending_admin_case || '',
                    ombudsman_case: d.ombudsman_case || '',
                    sandiganbayan_case: d.sandiganbayan_case || '',
                    nbi_case: d.nbi_case || '',
                    csc_case: d.csc_case || '',
                    alt_email_1: d.alt_email_1 || '',
                    alt_email_2: d.alt_email_2 || '',
                    alt_contact_details_1: d.alt_contact_details_1 || '',
                    alt_contact_details_2: d.alt_contact_details_2 || '',
                    photo_binary_id: d.photo_binary_id || null,
                    pds_binary_id: d.pds_binary_id || null,
                    profile_word_binary_id: d.profile_word_binary_id || null,
                    profile_ppt_binary_id: d.profile_ppt_binary_id || null,
                    service_records_binary_id: d.service_records_binary_id || null,
                    updated_at: d.updated_at || null,
                });

                setPrevPositions(d.previous_positions || []);
                setTrainings(d.relevant_trainings || []);

                setStatus('found');
            } else {
                setStatus('not-found');
            }
        } catch (err) {
            console.error("Lookup Error:", err);
            setStatus('error');
        }
    };

    const handleInitializeRecord = async () => {
        if (!user?.email) return;
        setSaving(true);
        try {
            const res = await fetch(apiUrl('/api/third-level/initialize'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token || localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    email: user.email,
                    first_name: user.firstName || '',
                    last_name: user.lastName || '',
                    role: user.role
                })
            });

            if (!res.ok) {
                const errorText = await res.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    throw new Error(`Server returned status ${res.status}: ${errorText || 'No details'}`);
                }
                throw new Error(errorData.error || 'Initialization failed.');
            }

            const data = await res.json();
            if (data.success) {
                lookupByEmail(user.email);
            }
        } catch (err) {
            console.error("Initialization Error:", err);
            Swal.fire('Notice', 'Initialization failed: ' + err.message, 'info');
        } finally {
            setSaving(false);
        }
    };

    const setP = (field, value) => setProfile(p => ({ ...p, [field]: value }));

    const validateProfile = () => {
        // 1. Date of Birth
        if (profile.date_of_birth) {
            const dob = new Date(profile.date_of_birth);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (dob > today) {
                Swal.fire('Validation Error', 'Date of Birth cannot be in the future.', 'error');
                return false;
            }
        }

        // 2. Alternative Email 1 & 2
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (profile.alt_email_1) {
            if (!emailRegex.test(profile.alt_email_1)) {
                Swal.fire('Validation Error', 'Alternative Email 1 is malformed or contains an invalid domain.', 'error');
                return false;
            }
        }
        if (profile.alt_email_2) {
            if (!emailRegex.test(profile.alt_email_2)) {
                Swal.fire('Validation Error', 'Alternative Email 2 is malformed or contains an invalid domain.', 'error');
                return false;
            }
        }

        // 3. Year Graduated
        if (profile.education_year_graduated) {
            const yr = Number(profile.education_year_graduated);
            if (isNaN(yr) || yr < 1900) {
                Swal.fire('Validation Error', 'Year Graduated must be 1900 or later.', 'error');
                return false;
            }
        }

        return true;
    };

    const handleSave = async () => {
        if (!TLOid) return;
        if (!validateProfile()) return;
        setSaving(true);
        setSaveSuccess(false);
        try {
            const targetVacancy = vacancies.find(v => v.TLOid === targetVacancyId);
            const payload = {
                ...profile,
                previous_positions: prevPositions,
                relevant_trainings: trainings,
                target_TLOid: targetVacancyId,
                position_applied_for: targetVacancy ? targetVacancy.position_title : profile.position_applied_for,
                profiling_status: completeness === 100 ? 'profiling completed' : 'profiling'
            };
            delete payload.age;

            const res = await fetch(apiUrl(`/api/third-level/${TLOid}/profile`), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token || localStorage.getItem('token')}`
                },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 5000);
            } else {
                Swal.fire('Notice', data.error || 'Save failed.', 'info');
            }
        } catch (err) {
            Swal.fire('Notice', 'Save failed: ' + err.message, 'info');
        } finally {
            setSaving(false);
        }
    };

    const handleCertify = async (thenNavigate = false) => {
        if (!TLOid) return;
        setCertifying(true);
        try {
            const res = await fetch(apiUrl(`/api/third-level/${TLOid}/profile`), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token || localStorage.getItem('token')}`
                },
                body: JSON.stringify({ dpa_consented_at: new Date().toISOString() })
            });
            const data = await res.json();
            if (data.success) {
                setCertified(true);
                if (thenNavigate) setTab('application');
            } else {
                Swal.fire('Notice', data.error || 'Certification failed.', 'info');
            }
        } catch (err) {
            Swal.fire('Notice', 'Certification failed: ' + err.message, 'info');
        } finally {
            setCertifying(false);
        }
    };

    const fetchVacancies = async () => {
        setVacanciesLoading(true);
        try {
            const res = await fetch(apiUrl('/api/third-level/vacancies'), {
                headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success) setVacancies(data.data);
        } catch (err) {
            console.error('Failed to fetch vacancies:', err);
        } finally {
            setVacanciesLoading(false);
        }
    };

    const handleSubmitApplication = async () => {
        if (!TLOid || !targetVacancyId) return;
        setSaving(true);
        try {
            const res = await fetch(apiUrl('/api/third-level/submit-application'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token || localStorage.getItem('token')}`
                },
                body: JSON.stringify({ app_TLOid: TLOid, target_TLOid: targetVacancyId })
            });
            const data = await res.json();
            if (data.success) {
                setApplicationStatus('under_review');
                setTab('summary');
            } else {
                Swal.fire('Notice', data.error || 'Submission failed.', 'info');
            }
        } catch (err) {
            Swal.fire('Notice', 'Submission failed: ' + err.message, 'info');
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        if (tab === 'application') {
            fetchVacancies();
        }
    }, [tab]);

    const fetchNotableAchievements = async () => {
        try {
            const res = await fetch(apiUrl('/api/third-level/notable-achievements'), {
                headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success) setNotableAchievementsOptions(data.data);
        } catch (err) {
            console.error('Failed to fetch notable achievements:', err);
        }
    };

    useEffect(() => {
        if (tab === 'achievements' && notableAchievementsOptions.length === 0) {
            fetchNotableAchievements();
        }
    }, [tab, notableAchievementsOptions.length]);

    const handleResubmit = async () => {
        if (!applicationId) return;
        setSaving(true);
        try {
            const res = await fetch(apiUrl(`/api/third-level/applications/${applicationId}/resubmit`), {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success) {
                setApplicationStatus('under_review');
                setDenialReason('');
            } else {
                Swal.fire('Notice', data.error || 'Resubmit failed.', 'info');
            }
        } catch (err) {
            Swal.fire('Notice', 'Resubmit failed: ' + err.message, 'info');
        } finally {
            setSaving(false);
        }
    };

    const handleFileUpload = async (file, docType) => {
        if (!TLOid || !file) return;
        setUploadingDocs(prev => ({ ...prev, [docType]: true }));
        try {
            let fileToUpload = file;

            // Compress 2x2 ID Picture
            if (docType === 'photo' && file.type.startsWith('image/')) {
                fileToUpload = await compressImageClientSide(file, 800, 0.9);
            }

            const formData = new FormData();
            formData.append('file', fileToUpload);

            const res = await fetch(apiUrl(`/api/third-level/${TLOid}/upload/${docType}`), {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` },
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                const docMap = {
                    'photo': 'photo_binary_id',
                    'pds': 'pds_binary_id',
                    'profile_word': 'profile_word_binary_id',
                    'profile_ppt': 'profile_ppt_binary_id',
                    'service_records': 'service_records_binary_id'
                };
                setP(docMap[docType], data.binary_id);
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            } else {
                Swal.fire('Notice', data.error || 'Upload failed.', 'info');
            }
        } catch (err) {
            Swal.fire('Notice', 'Upload failed: ' + err.message, 'info');
        } finally {
            setUploadingDocs(prev => ({ ...prev, [docType]: false }));
        }
    };

    const handleAddPosition = () => setPrevPositions(p => [...p, { position_id: `tmp-${Date.now()}`, position_name: '', office: '', start_date: '', end_date: '', is_oic: false, isNew: true }]);
    const handleRemovePosition = (pos) => {
        setPrevPositions(p => p.filter(x => x.position_id !== pos.position_id));
    };

    const handleAddTraining = () => setTrainings(t => [...t, { training_id: `tmp-${Date.now()}`, training_name: '', date_from: '', date_to: '', hours_per_day: '8', hours: '', isNew: true }]);
    const handleRemoveTraining = (tr) => {
        setTrainings(t => t.filter(x => x.training_id !== tr.training_id));
    };

    const handleTrainingDateChange = (idx, field, val) => {
        setTrainings(t => t.map((x, i) => {
            if (i !== idx) return x;
            const newX = { ...x, [field]: val };
            const from = newX.date_from || newX.date_completed;
            const to = newX.date_to || newX.date_completed;
            const hrsPerDay = parseFloat(newX.hours_per_day) || 8;
            if (from && to) {
                const d1 = new Date(from);
                const d2 = new Date(to);
                if (d1 <= d2) {
                    const diffTime = Math.abs(d2 - d1);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                    newX.hours = String(diffDays * hrsPerDay);
                }
            }
            return newX;
        }));
    };

    // ── LOADING ──
    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-transparent font-['Quicksand']">
                <div className="flex flex-col items-center gap-6">
                    <div className="w-14 h-14 border-[5px] border-[#0038A8] border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400 font-black uppercase tracking-[0.4em] text-[10px]">Loading Your Profile...</p>
                </div>
            </div>
        );
    }

    // ── NOT FOUND ──
    if (status === 'not-found' || status === 'error') {
        return (
            <PageTransition>
                <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-8 font-['Quicksand'] text-center">
                    <div className="max-w-md w-full bg-white border-2 border-[#08315F] rounded-[22px] p-12 shadow-none">
                        <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                            <FiSearch size={40} />
                        </div>
                        <h2 className="text-3xl font-['Quicksand'] font-black text-[#08315F] italic tracking-tighter mb-4">Record Not Found</h2>
                        <p className="text-sm font-bold text-slate-500 leading-relaxed mb-8">
                            Your account email (<span className="text-[#08315F]">{user?.email || 'unknown'}</span>) is not yet linked to an active Third Level Official record in the masterlist.
                        </p>
                        <p className="text-[11px] font-bold text-slate-400 italic mb-8">
                            {(user?.role === 'Third Level Applicant' || user?.role === 'Regional Office' || user?.role === 'School Division Office')
                                ? "To proceed with recruitment, you need to initialize your candidate profile using your current account email."
                                : "Please contact the Personnel Division (TLM Section) to have your record linked before you can access the profiling system."}
                        </p>
                        <div className="flex flex-col gap-3">
                            {(user?.role === 'Third Level Applicant' || user?.role === 'Regional Office' || user?.role === 'School Division Office') && (
                                <button
                                    onClick={handleInitializeRecord}
                                    disabled={saving}
                                    className="w-full py-4 bg-[#08315F] text-white font-black text-[10px] uppercase tracking-widest rounded-full shadow-xl hover:bg-[#08315F] transition-all flex items-center justify-center gap-3"
                                >
                                    {saving ? <FiLoader className="animate-spin" /> : <FiPlus size={16} />} Initialize My Profile
                                </button>
                            )}
                            <button onClick={() => navigate(-1)} className="w-full py-4 bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-full hover:bg-slate-200 transition-all flex items-center justify-center gap-3">
                                <FiChevronLeft size={16} /> Go Back
                            </button>
                        </div>
                    </div>
                </div>
            </PageTransition>
        );
    }

    // ── MAIN PROFILING FORM ──
    return (
        <PageTransition>
            <div className="min-h-screen bg-transparent font-['Quicksand'] text-[#08315F] relative overflow-x-hidden lg:h-screen lg:flex lg:flex-col lg:overflow-hidden">
                {/* Ambient Decorative Background Elements */}

                {/* ── Mobile Sidebar Drawer ── */}
                <AnimatePresence>
                    {isMobileMenuOpen && (
                        <>
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="fixed inset-0 bg-slate-900/60 z-50 lg:hidden"
                            />
                            {/* Drawer Content */}
                            <motion.aside
                                initial={{ x: '-100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '-100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="fixed top-0 left-0 bottom-0 w-[280px] bg-white z-50 shadow-2xl flex flex-col lg:hidden"
                            >
                                {/* Header */}
                                <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-[#08315F]/10 rounded-xl flex items-center justify-center text-[#08315F]">
                                            <FiUser size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-['Quicksand'] font-black text-[#08315F] leading-tight">Talent Portal</p>
                                            <p className="text-[10px] font-medium text-slate-400">Applicant Workspace</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className="w-8 h-8 rounded-full bg-transparent hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        <FiX size={16} />
                                    </button>
                                </div>
                                {/* Navigation */}
                                <div className="p-4 flex-1 overflow-y-auto">
                                    <p className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Profile Sections</p>
                                    <div className="space-y-1">
                                        {TABS.filter(t => dataSource !== 'masterlist' || t.id !== 'application').map(t => {
                                            const isLocked = t.id === 'application' && completeness < 100;
                                            const active = tab === t.id;
                                            const completed = isTabCompleted(t.id);
                                            return (
                                                <button
                                                    key={t.id}
                                                    disabled={isLocked}
                                                    onClick={() => {
                                                        if (!isLocked) {
                                                            setTab(t.id);
                                                            setIsMobileMenuOpen(false);
                                                        }
                                                    }}
                                                    className={`w-full flex items-center justify-between gap-3 px-3 py-3 rounded-xl text-left text-[12px] font-semibold transition-all
                                                        ${active ? 'bg-[#08315F] text-white shadow-md shadow-blue-900/20' : 'text-slate-600 hover:bg-transparent hover:text-slate-800'}
                                                        ${isLocked ? 'opacity-40 cursor-not-allowed grayscale' : ''}`}
                                                >
                                                    <span className="flex items-center gap-3 min-w-0">
                                                        <t.icon size={16} className="shrink-0" />
                                                        <span className="truncate">{t.label}</span>
                                                    </span>
                                                    {isLocked ? (
                                                        <FiLock size={12} className="shrink-0 opacity-50" />
                                                    ) : completed ? (
                                                        <FiCheckCircle size={14} className={active ? 'text-emerald-300' : 'text-emerald-500'} />
                                                    ) : active ? (
                                                        <FiArrowRight size={12} className="shrink-0" />
                                                    ) : null}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </motion.aside>
                        </>
                    )}
                </AnimatePresence>

                {/* ── Unified Premium Header Banner ── */}
                <div className="bg-[#08315F] text-white relative overflow-hidden shadow-lg border-b border-[#0038A8]/20 py-6 px-6 lg:px-8 shrink-0">
                    <div className="absolute -top-[100%] right-[-10%] w-[50%] h-[300%] bg-[#075985] rounded-[100%] opacity-90 pointer-events-none transform rotate-12 z-0"></div>
                    <div className="max-w-[1400px] mx-auto flex flex-col gap-6 relative z-10">
                        {/* Top Navigation Row */}
                        <div className="flex justify-between items-center w-full">
                            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-300 hover:text-white font-bold text-[10px] uppercase tracking-wider transition-all">
                                <FiChevronLeft size={16} /> Back
                            </button>
                            <button onClick={logout} className="flex items-center gap-2 text-slate-300 hover:text-red-400 font-bold text-[10px] uppercase tracking-wider transition-all">
                                <FiLock size={14} /> Sign Out
                            </button>
                        </div>

                        {/* Profile Info Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
                            {/* Left: Avatar + Profile Info */}
                            <div className="flex items-center gap-4 min-w-0">
                                <div className="relative shrink-0">
                                    <div className="w-[56px] h-[56px] md:w-[72px] md:h-[72px] bg-white/10 rounded-full flex items-center justify-center text-white/60 border border-white/20 shadow-lg shadow-black/10 overflow-hidden">
                                        {profile.photo_binary_id ? (
                                            <img src={apiUrl(`/api/binary/${profile.photo_binary_id}`)} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <>
                                                <FiUser size={30} className="md:hidden" />
                                                <FiUser size={36} className="hidden md:block" />
                                            </>
                                        )}
                                    </div>
                                    <div className="absolute -bottom-0.5 -left-0.5 w-3.5 h-3.5 md:w-4 md:h-4 bg-emerald-400 rounded-full border-[2px] md:border-[2.5px] border-[#0a1e3f] shadow-sm" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                        <h1 className="text-xl md:text-2xl lg:text-3xl font-black text-white tracking-tight leading-none truncate">{fullName}</h1>
                                        {applicationStatus && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#FCD116] text-[#1a3a6e] text-[8px] md:text-[9px] font-black uppercase tracking-wider rounded-full shadow-sm">
                                                <span className="w-1 h-1 bg-[#1a3a6e] rounded-full" />
                                                {applicationStatus === 'under_review' ? 'In Review' : applicationStatus === 'approved' ? 'Approved' : applicationStatus === 'disapproved' ? 'Denied' : 'Draft'}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-blue-200/80 text-xs md:text-sm font-medium mt-1 truncate flex items-center gap-2">
                                        <span>{profile.position_title || 'No position selected'}{profile.designation ? ` - ${profile.designation}` : ''}</span>
                                        {profile.is_oic && <span className="px-1.5 py-0.5 rounded bg-[#FCD116] text-[#08315F] text-[8px] font-black uppercase tracking-widest leading-none">OIC</span>}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-blue-300/60 text-[9px] md:text-[11px] font-medium">
                                        {TLOid && (
                                            <span className="flex items-center gap-1">
                                                • {applicationId ? `APP-${String(applicationId).padStart(4, '0')}` : TLOid}
                                            </span>
                                        )}
                                        {TLOid && <span className="opacity-30">·</span>}
                                        <span className="flex items-center gap-1">
                                            Applied {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                        {profile.updated_at && <span className="opacity-30">·</span>}
                                        {profile.updated_at && (
                                            <span className="flex items-center gap-1">
                                                Last Updated: {new Date(profile.updated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right: Progress Card */}
                            <div className="shrink-0">
                                <div className="w-40 bg-[#075985] border border-white/5 rounded-2xl p-3 shadow-lg flex flex-col justify-center">
                                    <p className="text-slate-400 text-[8px] font-black uppercase tracking-widest leading-none">Progress</p>
                                    <div className="flex items-center gap-3 mt-1">
                                        <p className="text-[#FCD116] font-black text-lg leading-none">{completeness}%</p>
                                        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${completeness}%` }}
                                                className="h-full bg-[#FCD116]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Body Content ── */}
                <div className="w-full flex-1 flex flex-row lg:overflow-hidden bg-transparent">
                    {/* Sidebar (Desktop Only) */}
                    <aside className="hidden lg:flex flex-col bg-transparent border-r border-slate-200/80 w-[260px] h-full shrink-0 pt-6">
                        {/* Talent Portal Branding */}
                        <div className="px-5 pt-2 pb-4 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#08315F]/10 rounded-xl flex items-center justify-center text-[#08315F]">
                                    <FiUser size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-['Quicksand'] font-black text-[#08315F] leading-tight">Talent Portal</p>
                                    <p className="text-[10px] font-medium text-slate-400">Applicant Workspace</p>
                                </div>
                            </div>
                        </div>
                        {/* Navigation */}
                        <div className="p-4 flex-1">
                            <p className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Profile Sections</p>
                            <div className="space-y-1">
                                {TABS.filter(t => dataSource !== 'masterlist' || t.id !== 'application').map(t => {
                                    const isLocked = t.id === 'application' && completeness < 100;
                                    const active = tab === t.id;
                                    const completed = isTabCompleted(t.id);
                                    return (
                                        <React.Fragment key={t.id}>
                                            {t.id === 'application' && <div className="my-3 border-t border-slate-100 mx-3" />}
                                            <button
                                                disabled={isLocked}
                                                onClick={() => !isLocked && setTab(t.id)}
                                                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left text-[11px] font-bold transition-all
                                                    ${active ? 'bg-[#08315F] text-white shadow-md shadow-blue-900/20' : 'text-slate-505 text-slate-500 hover:bg-transparent hover:text-slate-800'}
                                                    ${isLocked ? 'opacity-40 cursor-not-allowed grayscale' : ''}`}
                                            >
                                                <span className="flex items-center gap-3 min-w-0">
                                                    {React.createElement(t.icon, { size: 16, className: "shrink-0" })}
                                                    <span className="truncate">{t.label}</span>
                                                </span>
                                                {isLocked ? (
                                                    <FiLock size={12} className="shrink-0 opacity-50" />
                                                ) : completed ? (
                                                    <FiCheckCircle size={13} className={active ? 'text-emerald-300' : 'text-emerald-500'} />
                                                ) : active ? (
                                                    <FiChevronRight size={14} className="shrink-0 text-white" />
                                                ) : null}
                                            </button>
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    </aside>

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                        {/* Mobile Toggle Bar */}
                        <div className="lg:hidden flex items-center justify-between bg-transparent border-b border-slate-200 p-4 shadow-sm shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-[#08315F]/10 flex items-center justify-center text-[#08315F]">
                                    {React.createElement(TABS.find(t => t.id === tab)?.icon || FiUser, { size: 16 })}
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Active Section</p>
                                    <p className="text-xs font-['Quicksand'] font-black text-[#08315F] uppercase tracking-wider mt-1">{TABS.find(t => t.id === tab)?.label}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsMobileMenuOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-[#08315F]/15 hover:bg-[#08315F]/20 text-[#08315F] text-xs font-black rounded-xl transition-all border border-[#0038A8]/10"
                            >
                                <FiList size={14} /> Change Section
                            </button>
                        </div>

                        {/* Scrollable Form Area */}
                        <div className="flex-1 overflow-y-auto p-6 lg:p-10 bg-transparent pb-24">
                            <div className="max-w-[1400px] w-full mx-auto">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                                    <div className="md:col-span-3">
                                        <AnimatePresence mode="wait">
                                            <motion.div
                                                key={tab}
                                                initial={{ opacity: 0, y: 12 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -8 }}
                                                transition={{ duration: 0.15 }}
                                            >

                                                {/* ── PERSONAL INFO ── */}
                                                {tab === 'personal' && (
                                                    <div className="space-y-6">
                                                        <div className="bg-white border-2 border-[#08315F] rounded-[22px] p-8 lg:p-10 space-y-8 shadow-none">
                                                            <div>
                                                                <SectionLabel>Personal Information</SectionLabel>
                                                                <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
                                                                    {/* 2x2 ID Upload */}
                                                                    <div className="w-full lg:w-[132px] shrink-0">
                                                                        <Field label="2x2 ID Picture">
                                                                            <div className="relative group/upload w-full aspect-square max-w-[132px] mx-auto lg:mx-0 rounded-2xl border-2 border-dashed border-slate-300 bg-transparent hover:bg-slate-100 hover:border-[#0038A8] transition-all flex flex-col items-center justify-center overflow-hidden shadow-sm">
                                                                                <input
                                                                                    type="file"
                                                                                    accept="image/*"
                                                                                    onChange={(e) => {
                                                                                        const file = e.target.files[0];
                                                                                        if (file) handleFileUpload(file, 'photo');
                                                                                    }}
                                                                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                                                                />
                                                                                {profile.photo_binary_id ? (
                                                                                    <>
                                                                                        <img src={apiUrl(`/api/binary/${profile.photo_binary_id}`)} alt="2x2 ID" className="w-full h-full object-cover" />
                                                                                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover/upload:opacity-100 transition-opacity flex flex-col items-center justify-center text-white z-0 backdrop-blur-sm">
                                                                                            <FiUpload size={20} className="mb-2" />
                                                                                            <span className="text-[9px] font-black uppercase tracking-widest text-center px-2">Change Photo</span>
                                                                                        </div>
                                                                                    </>
                                                                                ) : (
                                                                                    <div className="flex flex-col items-center justify-center p-4 text-slate-400 group-hover/upload:text-[#08315F] transition-colors">
                                                                                        <FiUpload size={24} className={uploadingDocs['photo'] ? 'animate-bounce' : 'mb-3'} />
                                                                                        <span className="text-[10px] font-black uppercase tracking-widest text-center leading-tight mt-1">
                                                                                            {uploadingDocs['photo'] ? 'Processing...' : 'Upload Photo'}
                                                                                        </span>
                                                                                        <span className="text-[8px] font-bold text-slate-400 italic mt-1.5 text-center">PNG or JPG</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </Field>
                                                                    </div>

                                                                    <div className="flex-1 w-full space-y-4">
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                                                                            <Field label="First Name"><input type="text" value={profile.first_name} onChange={e => setP('first_name', e.target.value)} className={inp} /></Field>
                                                                            <Field label="Last Name"><input type="text" value={profile.last_name} onChange={e => setP('last_name', e.target.value)} className={inp} /></Field>
                                                                            <Field label="Middle Name"><input type="text" value={profile.middle_name} onChange={e => setP('middle_name', e.target.value)} className={inp} /></Field>
                                                                            <Field label="Suffix (Type 'Not Applicable' if none)"><input type="text" value={profile.suffix} onChange={e => setP('suffix', e.target.value)} placeholder="e.g. Jr., III" className={inp} /></Field>
                                                                        </div>
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                                                                            <Field label="Gender">
                                                                                <select value={profile.gender} onChange={e => setP('gender', e.target.value)} className={sel}>
                                                                                    <option value="">Select</option>
                                                                                    <option value="Male">Male</option>
                                                                                    <option value="Female">Female</option>
                                                                                </select>
                                                                            </Field>
                                                                            <Field label="Date of Birth">
                                                                                <div className="relative">
                                                                                    <ModernDatePicker maxDate={new Date()} value={profile.date_of_birth} onChange={val => setProfile(p => ({ ...p, date_of_birth: val, age: computeAge(val) }))} className={inp} />
                                                                                </div>
                                                                            </Field>
                                                                            <Field label="Age (auto-computed)">
                                                                                <div className="w-full bg-transparent border border-slate-200 rounded-lg py-2.5 px-4 text-xs font-semibold text-slate-500 min-h-[38px] flex items-center justify-center">
                                                                                    {profile.age || '—'}
                                                                                </div>
                                                                            </Field>
                                                                            <Field label="Civil Status">
                                                                                <select value={profile.civil_status} onChange={e => setP('civil_status', e.target.value)} className={sel}>
                                                                                    <option value="">Select</option>
                                                                                    {['Single', 'Married', 'Widowed', 'Separated'].map(o => <option key={o} value={o}>{o}</option>)}
                                                                                </select>
                                                                            </Field>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="border-t border-slate-100 pt-8">
                                                                <SectionLabel>Designation & Appointment</SectionLabel>
                                                                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
                                                                    <Field label="Position Title (As per Appointment)">
                                                                        <select value={profile.position_title || ''} onChange={e => setP('position_title', e.target.value)} className={sel}>
                                                                            <option value="">Select Position Title</option>
                                                                            {[
                                                                                'Undersecretary',
                                                                                'Assistant Secretary',
                                                                                'Director IV',
                                                                                'Director III',
                                                                                'Chief Administrative Officer'
                                                                            ].map(o => <option key={o} value={o}>{o}</option>)}
                                                                            {profile.position_title && ![
                                                                                'Undersecretary',
                                                                                'Assistant Secretary',
                                                                                'Director IV',
                                                                                'Director III',
                                                                                'Chief Administrative Officer'
                                                                            ].includes(profile.position_title) && (
                                                                                    <option value={profile.position_title}>{profile.position_title}</option>
                                                                                )}
                                                                        </select>
                                                                    </Field>
                                                                    <Field label="Designation">
                                                                        <select value={profile.designation || ''} onChange={e => setP('designation', e.target.value)} className={sel}>
                                                                            <option value="">Select Designation</option>
                                                                            {[
                                                                                'Undersecretary',
                                                                                'Assistant Secretary',
                                                                                'Director IV',
                                                                                'Director III',
                                                                                'Chief Administrative Officer'
                                                                            ].map(o => <option key={o} value={o}>{o}</option>)}
                                                                            {profile.designation && ![
                                                                                'Undersecretary',
                                                                                'Assistant Secretary',
                                                                                'Director IV',
                                                                                'Director III',
                                                                                'Chief Administrative Officer'
                                                                            ].includes(profile.designation) && (
                                                                                    <option value={profile.designation}>{profile.designation}</option>
                                                                                )}
                                                                        </select>
                                                                    </Field>
                                                                    <Field label="Officer-in-Charge (OIC) Status">
                                                                        <div className="flex items-center gap-3 py-2 px-1">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setP('is_oic', !profile.is_oic)}
                                                                                className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${profile.is_oic ? 'bg-[#08315F]' : 'bg-slate-200'}`}
                                                                            >
                                                                                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${profile.is_oic ? 'translate-x-6' : 'translate-x-0'}`} />
                                                                            </button>
                                                                            <span className="text-xs font-bold text-slate-700">
                                                                                {profile.is_oic ? 'Officer-in-Charge (OIC)' : 'Regular Appointment'}
                                                                            </span>
                                                                        </div>
                                                                    </Field>
                                                                    <Field label="Date of Present Position (Appointment Date)">
                                                                        <div className="relative">
                                                                            <ModernDatePicker value={profile.appointment_date} onChange={val => setP('appointment_date', val)} className={inp} />

                                                                        </div>
                                                                    </Field>
                                                                </div>
                                                            </div>

                                                            <div className="border-t border-slate-100 pt-8">
                                                                <SectionLabel>Contact Details</SectionLabel>
                                                                <div className="space-y-4">
                                                                    <Field label="Permanent Address">
                                                                        <input type="text" value={profile.permanent_address || ''} onChange={e => setP('permanent_address', e.target.value)} placeholder="House No., Street, Barangay, City/Municipality, Province" className={inp} />
                                                                    </Field>
                                                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                                                        <Field label="Phone Number"><input type="text" value={profile.alt_contact_details_1 || ''} onChange={e => { const val = e.target.value.replace(/\D/g, '').slice(0, 11); setP('alt_contact_details_1', val); }} placeholder="e.g. +63 912 345 6789" className={inp} /></Field>
                                                                        <Field label="Alternative Email 1"><input type="email" value={profile.alt_email_1 || ''} onChange={e => setP('alt_email_1', e.target.value)} placeholder="e.g. personal@gmail.com" className={inp} /></Field>
                                                                        <Field label="Alternative Email 2"><input type="email" value={profile.alt_email_2 || ''} onChange={e => setP('alt_email_2', e.target.value)} placeholder="e.g. backup@yahoo.com" className={inp} /></Field>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ── ELIGIBILITY ── */}
                                                {tab === 'eligibility' && (
                                                    <div className="space-y-6">
                                                        <div className="bg-white border-2 border-[#08315F] rounded-[22px] p-6 lg:p-8 space-y-5 shadow-none">
                                                            <SectionLabel color="#0038A8">Career Executive Service (CES)</SectionLabel>
                                                            <Field label="CES Eligibility / Rank Status">
                                                                <select value={profile.ces_stage} onChange={e => setP('ces_stage', e.target.value)} className={sel}>
                                                                    <option value="">Select Status</option>
                                                                    {[
                                                                        'Stage 1 (CES Written Examination)',
                                                                        'Stage 2 (Assessment Center)',
                                                                        'Stage 3 (Performance Validation)',
                                                                        'Stage 4 (Board Interview)',
                                                                        'CES Eligible',
                                                                        'CESO Rank VI',
                                                                        'CESO Rank V',
                                                                        'CESO Rank IV',
                                                                        'CESO Rank III',
                                                                        'CESO Rank II',
                                                                        'CESO Rank I',
                                                                        'Not Applicable'
                                                                    ].map(o => <option key={o} value={o}>{o}</option>)}
                                                                </select>
                                                            </Field>
                                                            <Field label="Date of Conferment (if applicable)">
                                                                <div className="relative">
                                                                    <ModernDatePicker value={profile.ces_conferment_date} onChange={val => setP('ces_conferment_date', val)} className={inp} />

                                                                </div>
                                                            </Field>
                                                        </div>

                                                        <div className="bg-white border-2 border-[#08315F] rounded-[22px] p-6 lg:p-8 space-y-5 shadow-none">
                                                            <SectionLabel>Educational Management Test (EMT)</SectionLabel>
                                                            <Field label="Are you an EMT Passer?">
                                                                <div className="flex gap-1.5 p-1 bg-slate-100/70 rounded-xl max-w-xs border border-slate-200/40">
                                                                    {[{ val: true, label: 'Yes' }, { val: false, label: 'No' }].map(opt => (
                                                                        <button
                                                                            key={String(opt.val)}
                                                                            onClick={() => setP('emt_passer', opt.val)}
                                                                            className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all
                                                                        ${profile.emt_passer === opt.val
                                                                                    ? (opt.val ? 'bg-[#08315F] text-white shadow-sm shadow-blue-900/10' : 'bg-[#FBBF24] text-white shadow-sm shadow-red-900/10')
                                                                                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                                                                        >
                                                                            {opt.label}
                                                                        </button>
                                                                    ))}
                                                                    <button
                                                                        onClick={() => setProfile(p => ({ ...p, emt_passer: null, emt_date: '' }))}
                                                                        className="px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-600 hover:bg-transparent transition-all"
                                                                    >
                                                                        Clear
                                                                    </button>
                                                                </div>
                                                            </Field>
                                                            {profile.emt_passer === true && (
                                                                <Field label="Date passed EMT">
                                                                    <div className="relative">
                                                                        <ModernDatePicker value={profile.emt_date} onChange={val => setP('emt_date', val)} className={inp} />

                                                                    </div>
                                                                </Field>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ── EXPERIENCE ── */}
                                                {tab === 'experience' && (
                                                    <div className="space-y-6">
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                                                            <div className="md:col-span-2">
                                                                <div className="bg-white border-2 border-[#08315F] rounded-[22px] p-8 shadow-none h-full">
                                                                    <SectionLabel>Managerial Experience</SectionLabel>
                                                                    <div className="bg-[#F4F8FB]/50 p-6 rounded-3xl border border-blue-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                                                                        <div>
                                                                            <p className="text-[10px] font-black text-[#08315F] uppercase tracking-widest mb-1">Total Managerial Experience</p>
                                                                            <p className="text-[9px] font-bold text-slate-400 italic leading-tight">Automatically computed based on your current and previous positions.</p>
                                                                        </div>
                                                                        <div className="bg-white px-6 py-3 rounded-2xl border-2 border-blue-200 shadow-sm">
                                                                            <p className="text-xl font-black text-[#08315F] tracking-tight">{profile.managerial_experience_total || '0 Years, 0 Months'}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* SIDEBAR: CAREER PROGRESSION */}
                                                            <div className="md:col-span-1">
                                                                <div className="bg-white border-2 border-[#08315F] rounded-[22px] p-8 shadow-none">
                                                                    <div className="flex items-center gap-3 mb-8">
                                                                        <div className="w-10 h-10 bg-[#F4F8FB] text-[#075985] rounded-2xl flex items-center justify-center">
                                                                            <FiClock size={20} />
                                                                        </div>
                                                                        <div>
                                                                            <h3 className="text-sm font-['Quicksand'] font-black text-[#08315F] uppercase tracking-tight italic leading-none">Career Progression</h3>
                                                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Professional Journey</p>
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-6 relative">
                                                                        {/* Vertical Line */}
                                                                        <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-100"></div>

                                                                        {historyLoading ? (
                                                                            <div className="py-12 text-center">
                                                                                <div className="w-6 h-6 border-2 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                                                                            </div>
                                                                        ) : history.length === 0 ? (
                                                                            <div className="py-12 text-center bg-transparent rounded-3xl border border-dashed border-slate-200">
                                                                                <FiClock className="mx-auto text-slate-200 mb-2" size={24} />
                                                                                <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">Initial Entry Record</p>
                                                                            </div>
                                                                        ) : (
                                                                            history.map((item, idx) => (
                                                                                <div key={idx} className="flex gap-6 relative z-10">
                                                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-md shrink-0 ${idx === 0 ? 'bg-[#08315F] text-white shadow-blue-500/30' : 'bg-slate-200 text-slate-500'}`}>
                                                                                        {idx === 0 ? <FiAward size={14} /> : <FiActivity size={14} />}
                                                                                    </div>
                                                                                    <div className="flex-1 pt-1">
                                                                                        <div className="flex justify-between items-start">
                                                                                            <h4 className="text-[11px] font-['Quicksand'] font-black text-[#08315F] uppercase tracking-tight leading-none italic">{item.position_title}</h4>
                                                                                            <span className="text-[8px] font-bold text-slate-400 bg-transparent px-2 py-0.5 rounded-full">{new Date(item.updated_at).getFullYear()}</span>
                                                                                        </div>
                                                                                        <p className="text-[10px] font-bold text-[#075985] uppercase tracking-widest mt-2">{item.office || 'Department of Education'}</p>
                                                                                        {item.previous_incumbent && (
                                                                                            <p className="text-[9px] font-bold text-slate-400 mt-1 flex items-center gap-1">
                                                                                                <FiChevronLeft size={10} className="rotate-180" />
                                                                                                Prev. Incumbent: <span className="text-slate-600">{item.previous_incumbent}</span>
                                                                                            </p>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            ))
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="bg-white border-2 border-[#08315F] rounded-[22px] p-8 shadow-none">
                                                            <SectionLabel color="#08315F">Previous Positions Held</SectionLabel>
                                                            <div className="space-y-3">
                                                                <div className="hidden xl:grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_140px_80px_44px] gap-3 px-2">
                                                                    {['Position', 'Office / Division', 'From', 'To', 'OIC?', ''].map(h => <span key={h} className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{h}</span>)}
                                                                </div>
                                                                {prevPositions.map((pos, idx) => (
                                                                    <motion.div key={pos.position_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_140px_80px_44px] gap-4 xl:gap-3 items-start xl:items-center bg-slate-50/40 hover:bg-transparent p-4 md:p-6 xl:p-4 rounded-2xl border border-slate-200/50 transition-colors shadow-sm">
                                                                        <div className="flex flex-col gap-1.5 w-full">
                                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest xl:hidden">Position</span>
                                                                            <SearchableSelect value={pos.position_name || ''} onChange={val => setPrevPositions(p => p.map((x, i) => i === idx ? { ...x, position_name: val } : x))} options={PREVIOUS_POSITION_OPTIONS} placeholder="Position" className="bg-white border border-slate-200 focus:border-[#0038A8] focus:ring-2 focus:ring-blue-50/50 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition-all truncate min-w-0 shadow-sm" />
                                                                        </div>
                                                                        <div className="flex flex-col gap-1.5 w-full">
                                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest xl:hidden">Office / Division</span>
                                                                            <input type="text" value={pos.office || ''} onChange={e => setPrevPositions(p => p.map((x, i) => i === idx ? { ...x, office: e.target.value } : x))} placeholder="Office" className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#0038A8] transition-all truncate min-w-0 h-[38px] shadow-sm" />
                                                                        </div>
                                                                        <div className="flex flex-col gap-1.5 w-full">
                                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest xl:hidden">From Date</span>
                                                                            <div className="relative">
                                                                                <ModernDatePicker value={pos.start_date ? pos.start_date.split('T')[0] : ''} onChange={val => setPrevPositions(p => p.map((x, i) => i === idx ? { ...x, start_date: val } : x))} className="bg-white border border-slate-200 focus:border-[#0038A8] focus:ring-2 focus:ring-blue-50/50 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition-all w-full shadow-sm" />

                                                                            </div>
                                                                        </div>
                                                                        <div className="flex flex-col gap-1.5 w-full">
                                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest xl:hidden">To Date</span>
                                                                            <div className="relative">
                                                                                <ModernDatePicker value={pos.end_date ? pos.end_date.split('T')[0] : ''} onChange={val => setPrevPositions(p => p.map((x, i) => i === idx ? { ...x, end_date: val } : x))} className="bg-white border border-slate-200 focus:border-[#0038A8] focus:ring-2 focus:ring-blue-50/50 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition-all w-full shadow-sm" />

                                                                            </div>
                                                                        </div>
                                                                        <div className="flex flex-col gap-1.5 w-full">
                                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest xl:hidden">OIC Status</span>
                                                                            <button onClick={() => setPrevPositions(p => p.map((x, i) => i === idx ? { ...x, is_oic: !x.is_oic } : x))} className={`flex items-center justify-center gap-1 text-[9px] font-black uppercase py-2 px-1 rounded-xl transition-all h-[38px] ${pos.is_oic ? 'bg-[#FCD116] text-[#08315F]' : 'bg-white border border-slate-200 text-slate-400 shadow-sm'}`}>{pos.is_oic ? <FiToggleRight size={14} /> : <FiToggleLeft size={14} />} OIC</button>
                                                                        </div>
                                                                        <div className="flex flex-col gap-1.5 w-full md:w-auto md:self-end justify-center xl:items-center">
                                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest xl:hidden md:invisible">Action</span>
                                                                            <button onClick={() => handleRemovePosition(pos)} className="w-full xl:w-10 h-10 flex items-center justify-center bg-[#FBBF24]/10 text-[#FBBF24] rounded-xl hover:bg-[#FBBF24] hover:text-white transition-all"><FiTrash2 size={14} /></button>
                                                                        </div>
                                                                    </motion.div>
                                                                ))}
                                                                <button onClick={handleAddPosition} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black text-[10px] uppercase tracking-widest hover:border-[#0038A8] hover:text-[#08315F] transition-all flex items-center justify-center gap-2 mt-2">
                                                                    <FiPlus size={14} /> Add Position
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ── EDUCATION ── */}
                                                {tab === 'education' && (
                                                    <div className="space-y-6">
                                                        <div className="bg-white border-2 border-[#08315F] rounded-[22px] p-6 lg:p-8 space-y-5 shadow-none">
                                                            <SectionLabel>Educational Attainment</SectionLabel>
                                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                                <Field label="Highest Educational Attainment">
                                                                    <select value={profile.highest_education} onChange={e => setP('highest_education', e.target.value)} className={sel}>
                                                                        <option value="">Select Level</option>
                                                                        {[
                                                                            'Post-Doctoral Studies',
                                                                            "Doctorate Degree",
                                                                            "Master's Degree",
                                                                            "Bachelor's Degree"
                                                                        ].map(o => <option key={o} value={o}>{o}</option>)}
                                                                    </select>
                                                                </Field>

                                                                <Field label="Specific Degree Title (e.g. PhD, EdD, MAEd)">
                                                                    <input
                                                                        type="text"
                                                                        value={profile.specific_degree}
                                                                        onChange={e => setP('specific_degree', e.target.value)}
                                                                        placeholder="Specify the exact degree title"
                                                                        className={inp}
                                                                    />
                                                                </Field>
                                                            </div>

                                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                                <Field label="Full Program / Field of Study (No Abbreviations)">
                                                                    <input
                                                                        type="text"
                                                                        value={profile.education_program}
                                                                        onChange={e => setP('education_program', e.target.value)}
                                                                        placeholder="e.g. Master of Arts in Educational Management"
                                                                        className={inp}
                                                                    />
                                                                </Field>
                                                                <Field label="Year Graduated">
                                                                    <input type="number" min="1900" max="2099" value={profile.education_year_graduated} onChange={e => setP('education_year_graduated', e.target.value)} placeholder="YYYY" className={inp} />
                                                                </Field>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ── PERFORMANCE RATINGS ── */}
                                                {tab === 'performance' && (
                                                    <div className="space-y-6">
                                                        {/* Performance Section */}
                                                        <div className="bg-white border-2 border-[#08315F] rounded-[22px] p-8 shadow-none space-y-6">
                                                            <SectionLabel color="#0038A8">IPCRF / OPCRF</SectionLabel>

                                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                                {/* Rating 1 */}
                                                                <div className="p-6 bg-[#08315F]/5 rounded-[2rem] border border-[#0038A8]/10 space-y-4">
                                                                    <p className="text-[10px] font-black text-[#08315F] uppercase tracking-widest">Latest Rating (1st)</p>
                                                                    <div className="space-y-3">
                                                                        <Field label="Rating (Max 5.000)">
                                                                            <input type="number" step="0.001" min="1.0" max="5.0" value={profile.performance_rating_1} onChange={e => { let v = e.target.value; if (v !== '' && Number(v) > 5) v = '5.0'; setP('performance_rating_1', v); }} onBlur={e => { let v = e.target.value; if (v !== '') { let n = Number(v); if (n > 5) n = 5; if (n < 1) n = 1; setP('performance_rating_1', n.toString()); } }} placeholder="4.850" className={inp} />
                                                                        </Field>
                                                                        <Field label="Rating Period">
                                                                            <div className="relative">
                                                                                <ModernDatePicker isMonthPicker value={profile.performance_rating_1_period} onChange={val => setP('performance_rating_1_period', val)} className={inp} />

                                                                            </div>
                                                                        </Field>
                                                                    </div>
                                                                </div>

                                                                {/* Rating 2 */}
                                                                <div className="p-6 bg-[#08315F]/5 rounded-[2rem] border border-[#0038A8]/10 space-y-4">
                                                                    <p className="text-[10px] font-black text-[#08315F] uppercase tracking-widest">Previous Rating (2nd)</p>
                                                                    <div className="space-y-3">
                                                                        <Field label="Rating (Max 5.000)">
                                                                            <input type="number" step="0.001" min="1.0" max="5.0" value={profile.performance_rating_2} onChange={e => { let v = e.target.value; if (v !== '' && Number(v) > 5) v = '5.0'; setP('performance_rating_2', v); }} onBlur={e => { let v = e.target.value; if (v !== '') { let n = Number(v); if (n > 5) n = 5; if (n < 1) n = 1; setP('performance_rating_2', n.toString()); } }} placeholder="4.750" className={inp} />
                                                                        </Field>
                                                                        <Field label="Rating Period">
                                                                            <div className="relative">
                                                                                <ModernDatePicker isMonthPicker value={profile.performance_rating_2_period} onChange={val => setP('performance_rating_2_period', val)} className={inp} />

                                                                            </div>
                                                                        </Field>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="p-6 bg-[#F4F8FB]/30 rounded-[2rem] border border-blue-100 space-y-5">
                                                                <div className="flex items-center gap-3">
                                                                    <p className="text-[10px] font-black text-[#075985] uppercase tracking-widest">CESPES Rating</p>
                                                                    <span className="text-[9px] font-bold text-blue-400 italic flex items-center gap-1"><FiInfo size={11} /> Career Executive Service Performance Evaluation System</span>
                                                                </div>

                                                                {/* 1st Semester */}
                                                                <div className="space-y-3">
                                                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">1st Semester</p>
                                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                                        <Field label="CESPES Rating (1st)">
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                min="1.0"
                                                                                max="5.0"
                                                                                value={profile.cespes_1_rating}
                                                                                onChange={e => { let v = e.target.value; if (v !== '' && Number(v) > 5) v = '5.0'; setP('cespes_1_rating', v); }}
                                                                                onBlur={e => { let v = e.target.value; if (v !== '') { let n = Number(v); if (n > 5) n = 5; if (n < 1) n = 1; setP('cespes_1_rating', n.toString()); } }}
                                                                                placeholder="0.00"
                                                                                className={inp}
                                                                            />
                                                                        </Field>
                                                                        <Field label="Period (1st)">
                                                                            <div className="relative">
                                                                                <input
                                                                                    type="month"
                                                                                    value={profile.cespes_rating_1_period}
                                                                                    onChange={e => setP('cespes_rating_1_period', e.target.value)}
                                                                                    className={`${inp} pr-10`}
                                                                                />

                                                                            </div>
                                                                        </Field>
                                                                    </div>
                                                                </div>

                                                                {/* 2nd Semester */}
                                                                <div className="space-y-3">
                                                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">2nd Semester</p>
                                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                                        <Field label="CESPES Rating (2nd)">
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                min="1.0"
                                                                                max="5.0"
                                                                                value={profile.cespes_2_rating}
                                                                                onChange={e => { let v = e.target.value; if (v !== '' && Number(v) > 5) v = '5.0'; setP('cespes_2_rating', v); }}
                                                                                onBlur={e => { let v = e.target.value; if (v !== '') { let n = Number(v); if (n > 5) n = 5; if (n < 1) n = 1; setP('cespes_2_rating', n.toString()); } }}
                                                                                placeholder="0.00"
                                                                                className={inp}
                                                                            />
                                                                        </Field>
                                                                        <Field label="Period (2nd)">
                                                                            <div className="relative">
                                                                                <input
                                                                                    type="month"
                                                                                    value={profile.cespes_rating_2_period}
                                                                                    onChange={e => setP('cespes_rating_2_period', e.target.value)}
                                                                                    className={`${inp} pr-10`}
                                                                                />

                                                                            </div>
                                                                        </Field>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                    </div>
                                                )}

                                                {/* ── ACHIEVEMENTS ── */}
                                                {tab === 'achievements' && (
                                                    <div className="space-y-6">
                                                        <div className="bg-white border-2 border-[#08315F] rounded-[22px] p-8 shadow-none space-y-6">
                                                            <SectionLabel color="#FCD116">Notable Achievements</SectionLabel>
                                                            <Field label="Awards / Recognitions / Notable Achievements">
                                                                <select
                                                                    value={profile.notable_achievements}
                                                                    onChange={e => setP('notable_achievements', e.target.value)}
                                                                    className="w-full bg-transparent hover:bg-slate-100/30 border border-slate-200/80 focus:border-[#0038A8] focus:bg-white focus:ring-4 focus:ring-blue-50/50 rounded-2xl py-4 px-5 text-xs font-semibold text-slate-800 outline-none transition-all shadow-sm shadow-slate-50 cursor-pointer"
                                                                >
                                                                    <option value="">-- Select Achievement --</option>
                                                                    {notableAchievementsOptions.map((ach, i) => (
                                                                        <option key={`opt-${i}`} value={ach}>{ach}</option>
                                                                    ))}
                                                                    {profile.notable_achievements && !notableAchievementsOptions.includes(profile.notable_achievements) && (
                                                                        <option value={profile.notable_achievements}>{profile.notable_achievements}</option>
                                                                    )}
                                                                </select>
                                                            </Field>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ── PROFESSIONAL DEVELOPMENT TRAININGS ── */}
                                                {tab === 'trainings' && (
                                                    <div className="space-y-6">
                                                        <div className="bg-white border-2 border-[#08315F] rounded-[22px] p-6 lg:p-8 space-y-5 shadow-none">
                                                            <SectionLabel color="#0038A8">Professional Development Trainings</SectionLabel>

                                                            <div className="bg-[#F4F8FB]/40 rounded-[2rem] p-5 border border-blue-100 flex items-center gap-3">
                                                                <FiInfo size={16} className="text-blue-400 shrink-0" />
                                                                <p className="text-[10px] font-bold text-[#075985]">List all relevant trainings, seminars, and professional development programs attended. Include the total number of training hours accumulated.</p>
                                                            </div>

                                                            {/* Total Training Hours */}
                                                            <Field label="Total Number of Training Hours (Auto-computed)">
                                                                <div className="bg-slate-100 rounded-2xl py-3 px-5 text-sm font-black text-[#08315F] border border-slate-200">
                                                                    {profile.total_training_hours || '0'} Hours
                                                                </div>
                                                            </Field>

                                                            {/* Trainings List */}
                                                            <div className="space-y-3">
                                                                <div className="hidden xl:grid grid-cols-[minmax(0,1fr)_140px_140px_80px_80px_44px] gap-3 px-2">
                                                                    {['Training / Seminar Name', 'Date From', 'Date To', 'Hrs/Day', 'Total Hrs', ''].map(h => (
                                                                        <span key={h} className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{h}</span>
                                                                    ))}
                                                                </div>
                                                                {trainings.map((tr, idx) => (
                                                                    <motion.div key={tr.training_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_140px_140px_80px_80px_44px] gap-3 items-center bg-slate-50/40 hover:bg-transparent p-4 rounded-2xl border border-slate-200/50 transition-colors shadow-sm">
                                                                        <input type="text" value={tr.training_name || ''} onChange={e => setTrainings(t => t.map((x, i) => i === idx ? { ...x, training_name: e.target.value } : x))} placeholder="Training / Seminar name" className="bg-white border border-slate-200 focus:border-[#0038A8] focus:ring-2 focus:ring-blue-50/50 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition-all min-w-0 shadow-sm" />
                                                                        <div className="relative">
                                                                            <ModernDatePicker value={tr.date_from ? tr.date_from.split('T')[0] : (tr.date_completed ? tr.date_completed.split('T')[0] : '')} onChange={val => handleTrainingDateChange(idx, 'date_from', val)} className="bg-white border border-slate-200 focus:border-[#0038A8] focus:ring-2 focus:ring-blue-50/50 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition-all w-full shadow-sm" />
                                                                        </div>
                                                                        <div className="relative">
                                                                            <ModernDatePicker value={tr.date_to ? tr.date_to.split('T')[0] : (tr.date_completed ? tr.date_completed.split('T')[0] : '')} onChange={val => handleTrainingDateChange(idx, 'date_to', val)} className="bg-white border border-slate-200 focus:border-[#0038A8] focus:ring-2 focus:ring-blue-50/50 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition-all w-full shadow-sm" />
                                                                        </div>
                                                                        <select value={tr.hours_per_day || '8'} onChange={e => handleTrainingDateChange(idx, 'hours_per_day', e.target.value)} className="bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold outline-none focus:border-[#0038A8] transition-all min-w-0 cursor-pointer shadow-sm">
                                                                            <option value="8">8 hrs</option>
                                                                            <option value="4">4 hrs</option>
                                                                            <option value="2">2 hrs</option>
                                                                        </select>
                                                                        <input type="number" min="0" max="999" step="0.5" value={tr.hours || ''} onChange={e => { let v = e.target.value; if (v !== '' && Number(v) > 999) v = '999'; setTrainings(t => t.map((x, i) => i === idx ? { ...x, hours: v } : x)); }} placeholder="Total" className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#0038A8] transition-all min-w-0" />
                                                                        <button onClick={() => handleRemoveTraining(tr)} className="w-10 h-10 flex items-center justify-center bg-[#FBBF24]/10 text-[#FBBF24] rounded-xl hover:bg-[#FBBF24] hover:text-white transition-all"><FiTrash2 size={14} /></button>
                                                                    </motion.div>
                                                                ))}
                                                                <button onClick={handleAddTraining} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black text-[10px] uppercase tracking-widest hover:border-[#0038A8] hover:text-[#08315F] transition-all flex items-center justify-center gap-2 mt-2">
                                                                    <FiPlus size={14} /> Add Training
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ── DOCUMENTS ── */}
                                                {tab === 'documents' && (
                                                    <div className="space-y-6">
                                                        <div className="flex items-start gap-4 p-6 bg-[#F4F8FB] rounded-[2rem] border border-blue-100">
                                                            <FiInfo className="text-[#08315F] mt-1 shrink-0" size={18} />
                                                            <p className="text-[11px] font-bold text-[#08315F] leading-relaxed">
                                                                Document uploads are processed by the Personnel Division. Files will be stored securely in the system once upload integration is completed. The reference IDs below track which documents have been linked to your profile.
                                                            </p>
                                                        </div>
                                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                                            {[
                                                                { id: 'pds', label: 'Personal Data Sheet (CSC Form 212, rev 2025)', note: 'PDF with Work Experience Sheet attached', accept: '.pdf' },
                                                                { id: 'profile_word', label: 'Accomplished Profile (Word File)', note: 'Word format required', accept: '.doc,.docx' },
                                                                { id: 'profile_ppt', label: 'Accomplished Profile (PPT Format)', note: 'PowerPoint format required', accept: '.ppt,.pptx' },
                                                                { id: 'service_records', label: 'Service Records', note: 'PDF — verifies previous positions', accept: '.pdf' },
                                                            ].map(({ id, label, note, accept }) => (
                                                                <div key={id} className="flex flex-col gap-3 p-6 bg-slate-50/40 hover:bg-transparent border border-slate-200/60 rounded-3xl transition-all duration-300 shadow-sm hover:shadow-md">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-10 h-10 bg-transparent rounded-xl flex items-center justify-center text-[#08315F]"><FiFileText size={18} /></div>
                                                                        <div className="flex-1">
                                                                            <p className="text-[11px] font-['Quicksand'] font-black text-[#08315F] leading-tight">{label}</p>
                                                                            <p className="text-[9px] font-bold text-slate-400 italic mt-0.5">{note}</p>
                                                                        </div>
                                                                        {profile[`${id}_binary_id`] && (
                                                                            <div className="text-emerald-500 flex items-center gap-1 text-[9px] font-black uppercase">
                                                                                <FiCheckCircle /> Linked
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="relative group/upload">
                                                                        <input
                                                                            type="file"
                                                                            accept={accept}
                                                                            onChange={(e) => {
                                                                                const file = e.target.files[0];
                                                                                if (file) handleFileUpload(file, id);
                                                                            }}
                                                                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                                                        />
                                                                        <div className={`flex items-center justify-center gap-2.5 border border-dashed rounded-xl px-4 py-2.5 text-xs font-semibold transition-all shadow-sm group-hover/upload:shadow-md ${profile[`${id}_binary_id`] ? 'bg-emerald-50/50 border-emerald-200 text-emerald-700 shadow-inner' : 'bg-white border-slate-300 text-slate-500 group-hover/upload:border-[#0038A8] group-hover/upload:text-[#08315F]'}`}>
                                                                            <FiUpload size={14} className={uploadingDocs[id] ? 'animate-bounce' : ''} />
                                                                            <span className="text-[10px] font-black uppercase tracking-widest">
                                                                                {uploadingDocs[id] ? 'Processing...' : profile[`${id}_binary_id`] ? 'Replace Document' : 'Upload Document'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ── LEGAL ── */}
                                                {tab === 'legal' && (
                                                    <div className="space-y-6">
                                                        <div className="flex items-start gap-4 p-6 bg-amber-50 rounded-[2rem] border border-amber-200">
                                                            <FiAlertTriangle className="text-amber-500 mt-1 shrink-0" size={20} />
                                                            <div>
                                                                <p className="text-[11px] font-black text-amber-800 uppercase tracking-widest mb-1">Confidential Section</p>
                                                                <p className="text-[11px] font-bold text-amber-700 leading-relaxed">
                                                                    This section is optional and strictly confidential per civil service guidelines. You may opt not to disclose. Information entered here is accessible only to authorized Personnel Division personnel.
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="bg-white border-2 border-[#08315F] rounded-[22px] p-8 shadow-none space-y-6">
                                                            <Field label="Pending Administrative Case/s (Type 'Not Applicable' if none)">
                                                                <textarea value={profile.pending_admin_case || ''} onChange={e => setP('pending_admin_case', e.target.value)} rows={4} placeholder="Type 'Not Applicable' if none. Otherwise, describe the nature and status of the case." className="w-full bg-transparent hover:bg-slate-100/30 border border-slate-200/80 focus:border-[#0038A8] focus:bg-white focus:ring-4 focus:ring-blue-50/50 rounded-2xl py-4 px-5 text-xs font-semibold text-slate-800 outline-none transition-all resize-none shadow-sm shadow-slate-50" />
                                                            </Field>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                <Field label="Sandiganbayan / Case/s">
                                                                    <textarea value={profile.sandiganbayan_case || ''} onChange={e => setP('sandiganbayan_case', e.target.value)} rows={3} placeholder="Type 'Not Applicable' if none." className="w-full bg-transparent border-2 border-transparent focus:border-amber-400 rounded-2xl py-3 px-5 text-sm font-bold outline-none transition-all resize-none" />
                                                                </Field>
                                                                <Field label="NBI Clearance / Case/s">
                                                                    <textarea value={profile.nbi_case || ''} onChange={e => setP('nbi_case', e.target.value)} rows={3} placeholder="Type 'Not Applicable' if none." className="w-full bg-transparent border-2 border-transparent focus:border-amber-400 rounded-2xl py-3 px-5 text-sm font-bold outline-none transition-all resize-none" />
                                                                </Field>
                                                                <Field label="CSC / Case/s">
                                                                    <textarea value={profile.csc_case || ''} onChange={e => setP('csc_case', e.target.value)} rows={3} placeholder="Type 'Not Applicable' if none." className="w-full bg-transparent border-2 border-transparent focus:border-amber-400 rounded-2xl py-3 px-5 text-sm font-bold outline-none transition-all resize-none" />
                                                                </Field>
                                                                <Field label="Ombudsman / Case/s">
                                                                    <textarea value={profile.ombudsman_case || ''} onChange={e => setP('ombudsman_case', e.target.value)} rows={3} placeholder="Type 'Not Applicable' if none." className="w-full bg-transparent border-2 border-transparent focus:border-amber-400 rounded-2xl py-3 px-5 text-sm font-bold outline-none transition-all resize-none" />
                                                                </Field>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ── APPLICATION ── */}
                                                {tab === 'application' && (
                                                    <div className="space-y-6">
                                                        <div className="bg-white border-2 border-[#08315F] rounded-[22px] p-6 lg:p-8 space-y-5 shadow-none">
                                                            <div className="flex items-center justify-between">
                                                                <SectionLabel color="#0038A8">Apply for Vacant Position</SectionLabel>
                                                                {applicationStatus === 'under_review' && (
                                                                    <div className="px-4 py-1.5 bg-amber-50 text-amber-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-100 flex items-center gap-2">
                                                                        <FiLock size={12} /> Under Review
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <p className="text-xs font-medium text-slate-500 leading-relaxed max-w-2xl">
                                                                Please select the vacant position you wish to apply for. Your profile must be <span className="text-[#08315F] font-bold">100% complete</span> and certified before you can submit your application.
                                                            </p>

                                                            <div className="grid grid-cols-1 gap-4">
                                                                {vacanciesLoading ? (
                                                                    <div className="py-20 text-center bg-transparent rounded-[2rem] border-2 border-dashed border-slate-200">
                                                                        <FiLoader className="animate-spin mx-auto text-[#075985] mb-4" size={32} />
                                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fetching Available Vacancies...</p>
                                                                    </div>
                                                                ) : vacancies.length === 0 ? (
                                                                    <div className="py-20 text-center bg-transparent rounded-[2rem] border-2 border-dashed border-slate-200">
                                                                        <FiAlertTriangle className="mx-auto text-amber-400 mb-4" size={32} />
                                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Vacant Positions Found</p>
                                                                    </div>
                                                                ) : (
                                                                    vacancies.map(v => (
                                                                        <button
                                                                            key={v.TLOid}
                                                                            disabled={applicationStatus === 'under_review'}
                                                                            onClick={() => setTargetVacancyId(v.TLOid)}
                                                                            className={`w-full flex items-center justify-between p-6 rounded-[2rem] border-2 transition-all text-left group ${targetVacancyId === v.TLOid ? 'bg-[#F4F8FB] border-[#0038A8] shadow-lg shadow-blue-900/10' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                                                                        >
                                                                            <div className="flex items-center gap-5">
                                                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${targetVacancyId === v.TLOid ? 'bg-[#08315F] text-white' : 'bg-transparent text-slate-400 group-hover:bg-slate-100'}`}>
                                                                                    <FiBriefcase size={20} />
                                                                                </div>
                                                                                <div>
                                                                                    <h4 className="text-sm font-['Quicksand'] font-black text-[#08315F] uppercase tracking-tight italic flex items-center gap-2">
                                                                                        <span>{v.position_title}</span>
                                                                                        {v.is_oic && <span className="px-1.5 py-0.5 rounded bg-[#FCD116] text-[#08315F] text-[8px] font-black uppercase tracking-widest leading-none">OIC</span>}
                                                                                    </h4>
                                                                                    <div className="flex items-center gap-3 mt-1">
                                                                                        <span className="text-[9px] font-bold text-[#075985] uppercase tracking-widest">{v.office}</span>
                                                                                        <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{v.strand}</span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${targetVacancyId === v.TLOid ? 'bg-[#08315F] border-[#0038A8] text-white' : 'border-slate-100 text-transparent'}`}>
                                                                                <FiCheckCircle size={14} />
                                                                            </div>
                                                                        </button>
                                                                    ))
                                                                )}
                                                            </div>

                                                            {targetVacancyId && applicationStatus !== 'under_review' && (
                                                                <div className="pt-6 border-t border-slate-100 mt-10">
                                                                    <div className="bg-slate-900 rounded-[2rem] p-8 text-white flex flex-col lg:flex-row items-center justify-between gap-8">
                                                                        <div className="flex items-center gap-5">
                                                                            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center">
                                                                                <FiActivity size={24} className="text-blue-300" />
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-[10px] font-black text-blue-300 uppercase tracking-[0.2em] mb-1">Selected Vacancy</p>
                                                                                <h3 className="text-xl font-black italic tracking-tight flex items-center gap-2">
                                                                                    {(() => {
                                                                                        const vac = vacancies.find(x => x.TLOid === targetVacancyId);
                                                                                        if (!vac) return null;
                                                                                        return (
                                                                                            <>
                                                                                                <span>{vac.position_title}</span>
                                                                                                {vac.is_oic && <span className="px-1.5 py-0.5 rounded bg-[#FCD116] text-[#08315F] text-[8px] font-black uppercase tracking-widest leading-none">OIC</span>}
                                                                                            </>
                                                                                        );
                                                                                    })()}
                                                                                </h3>
                                                                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">{vacancies.find(x => x.TLOid === targetVacancyId)?.office}</p>
                                                                            </div>
                                                                        </div>

                                                                        <button
                                                                            onClick={() => setTab('summary')}
                                                                            className="w-full lg:w-auto px-10 py-4 bg-white text-[#08315F] font-black text-[10px] uppercase tracking-widest rounded-full shadow-2xl hover:scale-105 transition-all flex items-center justify-center gap-3"
                                                                        >
                                                                            Proceed to Final Step <FiArrowRight size={14} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ── SUMMARY & CERTIFY ── */}
                                                {tab === 'summary' && (
                                                    <div className="space-y-8">

                                                        {/* ── Profile Summary Card ── */}
                                                        <div className="bg-white border-2 border-[#08315F] rounded-[22px] p-8 shadow-none space-y-8">
                                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4 relative">
                                                                <SectionLabel>Profile Summary</SectionLabel>
                                                                <div className="relative">
                                                                    <button onClick={() => setExportModalOpen(!exportModalOpen)} className="flex items-center gap-2 bg-[#08315F] px-5 py-2.5 rounded-full text-white hover:bg-blue-800 font-black text-[10px] uppercase tracking-widest transition-all shadow-md hover:shadow-lg w-max relative z-[51]">
                                                                        <FiDownload size={14} /> Export Profile
                                                                    </button>
                                                                    <AnimatePresence>
                                                                        {exportModalOpen && (
                                                                            <motion.div
                                                                                initial={{ opacity: 0 }}
                                                                                animate={{ opacity: 1 }}
                                                                                exit={{ opacity: 0 }}
                                                                                className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6 lg:p-10 bg-slate-900/60 backdrop-blur-sm"
                                                                            >
                                                                                <motion.div
                                                                                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                                                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                                                                    className="relative w-full max-w-[1200px] bg-white rounded-[2rem] shadow-2xl border border-white/50 flex flex-col lg:flex-row overflow-hidden max-h-full"
                                                                                    onClick={e => e.stopPropagation()}
                                                                                >
                                                                                    {/* Sidebar Options */}
                                                                                    <div className="w-full lg:w-64 bg-transparent border-r border-slate-200 p-6 flex flex-col gap-3 shrink-0">
                                                                                        <div className="flex items-center justify-between mb-4">
                                                                                            <div>
                                                                                                <h2 className="text-sm font-['Quicksand'] font-black text-[#08315F] uppercase tracking-tight italic">Export Options</h2>
                                                                                            </div>
                                                                                            <button onClick={() => setExportModalOpen(false)} className="w-8 h-8 bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-full flex items-center justify-center transition-colors shadow-sm">
                                                                                                <FiX size={16} />
                                                                                            </button>
                                                                                        </div>
                                                                                        {[
                                                                                            { id: 'csv', label: 'Data Export (CSV)', icon: FiFileText, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
                                                                                            { id: 'pdf', label: 'Document (PDF)', icon: FiFile, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
                                                                                            { id: 'ppt', label: 'Presentation (PPT)', icon: FiMonitor, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
                                                                                        ].map(opt => (
                                                                                            <button
                                                                                                key={opt.id}
                                                                                                onClick={() => setSelectedExportType(opt.id)}
                                                                                                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${selectedExportType === opt.id ? `${opt.border} ${opt.bg} shadow-sm` : 'border-slate-200 bg-white hover:border-slate-300'}`}
                                                                                            >
                                                                                                <opt.icon size={16} className={selectedExportType === opt.id ? opt.color : 'text-slate-400'} />
                                                                                                <div>
                                                                                                    <p className={`text-[10px] font-black uppercase tracking-tight ${selectedExportType === opt.id ? opt.color : 'text-slate-600'}`}>{opt.label}</p>
                                                                                                </div>
                                                                                            </button>
                                                                                        ))}

                                                                                        <div className="mt-auto pt-6">
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    if (selectedExportType === 'csv') generateCSV();
                                                                                                    if (selectedExportType === 'pdf') generatePDF();
                                                                                                    if (selectedExportType === 'ppt') generatePPT();
                                                                                                }}
                                                                                                disabled={exporting}
                                                                                                className="w-full py-4 bg-[#08315F] text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-xl hover:bg-[#08315F] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                                                                            >
                                                                                                {exporting ? <FiLoader className="animate-spin" size={16} /> : <FiDownload size={16} />}
                                                                                                {exporting ? 'Generating...' : `Download`}
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* Preview Area */}
                                                                                    <div ref={previewContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden p-6 lg:p-10 flex flex-col items-center bg-slate-100/50">
                                                                                        {selectedExportType === 'csv' && (
                                                                                            <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                                                                                <div className="bg-slate-800 px-4 py-3 flex items-center gap-2">
                                                                                                    <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-rose-500" /><div className="w-3 h-3 rounded-full bg-amber-500" /><div className="w-3 h-3 rounded-full bg-emerald-500" /></div>
                                                                                                    <span className="text-[11px] text-slate-300 font-mono ml-2">profile_{profile.last_name || 'export'}.csv</span>
                                                                                                </div>
                                                                                                <div className="p-0 overflow-x-auto custom-scrollbar">
                                                                                                    <table className="w-full text-left border-collapse text-[11px] font-mono whitespace-nowrap">
                                                                                                        <thead className="bg-transparent sticky top-0">
                                                                                                            <tr className="border-b border-slate-200 text-slate-500">
                                                                                                                <th className="p-4 font-bold">Data Field</th><th className="p-4 font-bold">Exported Value</th>
                                                                                                            </tr>
                                                                                                        </thead>
                                                                                                        <tbody>
                                                                                                            {[
                                                                                                                ['First Name', profile.first_name], ['Last Name', profile.last_name], ['Middle Name', profile.middle_name],
                                                                                                                ['Gender', profile.gender], ['Date of Birth', profile.date_of_birth], ['Age', profile.age],
                                                                                                                ['Civil Status', profile.civil_status], ['Position Title', profile.position_title], ['Designation', profile.designation],
                                                                                                                ['Permanent Address', profile.permanent_address], ['CES Stage', profile.ces_stage],
                                                                                                                ['Highest Education', profile.highest_education], ['Program / Course', profile.education_program],
                                                                                                                ['Latest Rating', profile.performance_rating_1], ['Total Managerial Exp.', profile.managerial_experience_total],
                                                                                                            ].map(([k, v], i) => (
                                                                                                                <tr key={i} className="border-b border-slate-100 text-slate-700 hover:bg-white bg-slate-50/30">
                                                                                                                    <td className="px-4 py-3 font-bold text-slate-500 border-r border-slate-100">{k}</td><td className="px-4 py-3">{v || '—'}</td>
                                                                                                                </tr>
                                                                                                            ))}
                                                                                                        </tbody>
                                                                                                    </table>
                                                                                                </div>
                                                                                            </div>
                                                                                        )}

                                                                                        {selectedExportType === 'pdf' && (
                                                                                            <div className="overflow-hidden flex justify-center w-full bg-slate-50/50 py-10 rounded-2xl border border-slate-200 shadow-inner hide-scrollbar">
                                                                                                <div className="bg-white shadow-2xl border border-slate-200 transition-transform duration-200 shrink-0 w-[1000px]" style={{ transform: `scale(${previewScale})`, transformOrigin: 'top center', marginBottom: `-${700 * (1 - previewScale)}px` }}>
                                                                                                    <div className="p-10 mx-auto w-[1000px] h-[700px] relative font-['Quicksand'] text-black" id="pdf-preview-content">
                                                                                                        <div className="flex justify-between items-start mb-8">
                                                                                                            <div className="flex gap-6 items-center">
                                                                                                                <img src={newLogo} alt="Logo" className="w-24 h-24 object-contain" />
                                                                                                                <div>
                                                                                                                    <h1 className="text-3xl font-black uppercase tracking-tight text-[#08315F]">{profile.last_name || ''}, {profile.first_name || ''} {profile.middle_name || ''}</h1>
                                                                                                                    <h2 className="text-xl font-bold uppercase mt-1 text-slate-800 flex items-center gap-2">
                                                                                                                        <span>{profile.position_title || 'N/A'}</span>
                                                                                                                        {profile.is_oic && <span className="px-2 py-0.5 rounded-full bg-[#FCD116] text-[#08315F] text-[9px] font-black uppercase tracking-widest leading-none">OIC</span>}
                                                                                                                        {profile.office ? `, ${profile.office}` : ''}
                                                                                                                    </h2>
                                                                                                                </div>
                                                                                                            </div>
                                                                                                            <div className="flex gap-6 items-start">
                                                                                                                <div className="text-center w-56">
                                                                                                                    <div className="bg-red-700 text-white font-bold py-1.5 text-xs uppercase tracking-wider">Position Applied For</div>
                                                                                                                    <div className="border border-red-700 py-2 text-sm font-bold min-h-[44px] flex items-center justify-center text-[#08315F] bg-white">
                                                                                                                        {(() => {
                                                                                                                            const vac = vacancies.find(v => v.TLOid === targetVacancyId);
                                                                                                                            if (!vac) return '—';
                                                                                                                            return (
                                                                                                                                <div className="flex items-center gap-2">
                                                                                                                                    <span>{vac.position_title}</span>
                                                                                                                                    {vac.is_oic && <span className="px-1.5 py-0.5 rounded-full bg-[#FCD116] text-[#08315F] text-[8px] font-black uppercase tracking-widest leading-none">OIC</span>}
                                                                                                                                </div>
                                                                                                                            );
                                                                                                                        })()}
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                                <div className="w-[100px] h-[100px] bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 border-2 border-slate-200 uppercase tracking-widest shrink-0">
                                                                                                                    2x2 Photo
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                        <div className="grid grid-cols-12 gap-10">
                                                                                                            <div className="col-span-7 space-y-8">
                                                                                                                <table className="w-full text-sm border-collapse">
                                                                                                                    <thead>
                                                                                                                        <tr><th colSpan={3} className="bg-[#08315F] text-white font-bold py-2.5 border border-slate-400 text-center uppercase tracking-widest text-xs">Managerial Experience</th></tr>
                                                                                                                    </thead>
                                                                                                                    <tbody>
                                                                                                                        {history.slice(0, 4).map((h, i) => {
                                                                                                                            const dur = h.start_date && h.end_date ? calculateDuration(h.start_date, h.end_date) : { years: 0, months: 0 };
                                                                                                                            return (
                                                                                                                                <tr key={i} className="text-slate-800">
                                                                                                                                    <td className="border border-slate-400 px-3 py-2 font-medium w-1/3">{h.position_title || '—'}</td>
                                                                                                                                    <td className="border border-slate-400 px-3 py-2 w-1/3">{h.office || '—'}</td>
                                                                                                                                    <td className="border border-slate-400 px-3 py-2 text-center font-medium">{dur.years} yrs., {dur.months} mos.</td>
                                                                                                                                </tr>
                                                                                                                            );
                                                                                                                        })}
                                                                                                                        {history.length === 0 && <tr><td colSpan={3} className="border border-slate-400 px-3 py-2 text-center text-slate-500 italic">No experience listed</td></tr>}
                                                                                                                    </tbody>
                                                                                                                </table>
                                                                                                                <table className="w-full text-sm border-collapse">
                                                                                                                    <thead>
                                                                                                                        <tr><th colSpan={3} className="bg-[#08315F] text-white font-bold py-2.5 border border-slate-400 text-center uppercase tracking-widest text-xs">Educational Attainment</th></tr>
                                                                                                                    </thead>
                                                                                                                    <tbody className="text-slate-800">
                                                                                                                        <tr>
                                                                                                                            <td className="border border-slate-400 px-3 py-2 w-1/4 font-medium text-center">N/A</td>
                                                                                                                            <td className="border border-slate-400 px-3 py-2 w-1/2">{profile.specific_degree || profile.education_program || '—'}</td>
                                                                                                                            <td className="border border-slate-400 px-3 py-2 w-1/4 text-center font-medium">{profile.education_year_graduated || '—'}</td>
                                                                                                                        </tr>
                                                                                                                    </tbody>
                                                                                                                </table>
                                                                                                            </div>
                                                                                                            <div className="col-span-5 space-y-8 relative">
                                                                                                                <div className="absolute -top-14 left-0 w-24">
                                                                                                                    <div className="bg-amber-500 text-white font-bold py-1 text-center text-xs uppercase tracking-widest">Age</div>
                                                                                                                    <div className="border border-amber-500 py-1.5 text-center font-bold text-lg text-[#08315F] bg-white">{profile.age || '—'}</div>
                                                                                                                </div>
                                                                                                                <table className="w-full text-sm border-collapse mt-10">
                                                                                                                    <thead>
                                                                                                                        <tr><th colSpan={2} className="bg-red-700 text-white font-bold py-2.5 border border-red-700 text-center uppercase tracking-widest text-xs">Performance Rating</th></tr>
                                                                                                                    </thead>
                                                                                                                    <tbody className="text-slate-800">
                                                                                                                        <tr><td className="border border-slate-400 px-3 py-2">{profile.cespes_rating_1_period || ''} 1st sem (CESPES)</td><td className="border border-slate-400 px-3 py-2 text-center font-black">{profile.cespes_1_rating || '—'}</td></tr>
                                                                                                                        <tr><td className="border border-slate-400 px-3 py-2">{profile.cespes_rating_2_period || ''} 2nd sem (CESPES)</td><td className="border border-slate-400 px-3 py-2 text-center font-black">{profile.cespes_2_rating || '—'}</td></tr>
                                                                                                                        <tr><td className="border border-slate-400 px-3 py-2">{profile.performance_rating_1_period || ''} (OPCRF)</td><td className="border border-slate-400 px-3 py-2 text-center font-black">{profile.performance_rating_1 || '—'}</td></tr>
                                                                                                                        <tr><td className="border border-slate-400 px-3 py-2">{profile.performance_rating_2_period || ''} (OPCRF)</td><td className="border border-slate-400 px-3 py-2 text-center font-black">{profile.performance_rating_2 || '—'}</td></tr>
                                                                                                                    </tbody>
                                                                                                                </table>
                                                                                                                <table className="w-full text-sm border-collapse">
                                                                                                                    <thead>
                                                                                                                        <tr><th colSpan={2} className="bg-red-700 text-white font-bold py-2.5 border border-red-700 text-center uppercase tracking-widest text-xs">Eligibility</th></tr>
                                                                                                                    </thead>
                                                                                                                    <tbody className="text-slate-800">
                                                                                                                        <tr>
                                                                                                                            <td className="border border-slate-400 px-3 py-2 font-medium">Career Executive Service (CES): {profile.ces_stage || 'Not Applicable'}</td>
                                                                                                                            <td className="border border-slate-400 px-3 py-2 text-center font-black">{profile.ces_conferment_date || '—'}</td>
                                                                                                                        </tr>
                                                                                                                        <tr>
                                                                                                                            <td className="border border-slate-400 px-3 py-2 font-medium">Educational Management Test (EMT): {profile.emt_passer === true ? 'Passed' : profile.emt_passer === false ? 'Not Passed' : 'Not Applicable'}</td>
                                                                                                                            <td className="border border-slate-400 px-3 py-2 text-center font-black">{profile.emt_date || '—'}</td>
                                                                                                                        </tr>
                                                                                                                    </tbody>
                                                                                                                </table>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                        )}

                                                                                        {selectedExportType === 'ppt' && (
                                                                                            <div className="overflow-hidden w-full rounded-2xl border-2 border-slate-200 bg-slate-50 relative flex items-start justify-center pt-8 pb-4" style={{ height: `${Math.max(350, 562.5 * previewScale + 64)}px` }}>
                                                                                                <div className="bg-white border border-slate-200 shadow-2xl relative flex flex-col font-['Quicksand'] transition-transform duration-200 shrink-0 w-[1000px]" style={{ transform: `scale(${previewScale})`, transformOrigin: 'top center', marginBottom: `-${562.5 * (1 - previewScale)}px` }}>
                                                                                                    <div className="w-[1000px] h-[562.5px] p-10 relative" id="ppt-preview-content">
                                                                                                        <div className="absolute top-0 left-0 w-full h-2 bg-[#08315F]"></div>
                                                                                                        <div className="flex gap-4 items-center mb-6">
                                                                                                            <img src={newLogo} alt="Logo" className="w-16 h-16 object-contain" />
                                                                                                            <div>
                                                                                                                <h1 className="text-3xl font-['Quicksand'] font-black text-[#08315F] uppercase tracking-tight">{profile.last_name || ''}, {profile.first_name || ''}</h1>
                                                                                                                <h2 className="text-lg font-bold text-slate-700 uppercase flex items-center gap-2">
                                                                                                                    <span>{profile.position_title || 'N/A'}</span>
                                                                                                                    {profile.is_oic && <span className="px-1.5 py-0.5 rounded bg-[#FCD116] text-[#08315F] text-[8px] font-black uppercase tracking-widest leading-none">OIC</span>}
                                                                                                                    {profile.office ? `, ${profile.office}` : ''}
                                                                                                                </h2>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                        <div className="flex gap-6 mt-8">
                                                                                                            <div className="flex-1 border-2 border-[#0038A8] rounded-xl p-6">
                                                                                                                <h3 className="text-sm font-black text-[#08315F] uppercase tracking-widest mb-3 border-b border-blue-100 pb-2">Managerial Experience</h3>
                                                                                                                {history.slice(0, 3).map((h, i) => (
                                                                                                                    <p key={i} className="text-sm text-slate-700 mb-2 font-bold">{h.position_title} <span className="font-normal">({h.office})</span></p>
                                                                                                                ))}
                                                                                                            </div>
                                                                                                            <div className="w-64 border-2 border-red-700 rounded-xl p-6">
                                                                                                                <h3 className="text-sm font-black text-red-700 uppercase tracking-widest mb-3 border-b border-red-100 pb-2">Performance</h3>
                                                                                                                <p className="text-sm text-slate-700 mb-2 font-bold">CESPES: <span className="font-['Quicksand'] font-black text-[#08315F]">{profile.cespes_1_rating || '—'}</span></p>
                                                                                                                <p className="text-sm text-slate-700 font-bold">OPCRF: <span className="font-['Quicksand'] font-black text-[#08315F]">{profile.performance_rating_1 || '—'}</span></p>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </motion.div>
                                                                            </motion.div>
                                                                        )}
                                                                    </AnimatePresence>
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Personal Information</p>
                                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                                                                    <SummaryRow label="First Name" value={profile.first_name} />
                                                                    <SummaryRow label="Last Name" value={profile.last_name} />
                                                                    <SummaryRow label="Middle Name" value={profile.middle_name} />
                                                                    <SummaryRow label="Suffix" value={profile.suffix} />
                                                                    <SummaryRow label="Gender" value={profile.gender} />
                                                                    <SummaryRow label="Date of Birth" value={profile.date_of_birth} />
                                                                    <SummaryRow label="Age" value={profile.age} />
                                                                    <SummaryRow label="Civil Status" value={profile.civil_status} />
                                                                    <SummaryRow
                                                                        label="Target Vacancy"
                                                                        value={(() => {
                                                                            const vac = targetVacancyId ? vacancies.find(x => x.TLOid === targetVacancyId) : null;
                                                                            if (!vac) return null;
                                                                            return (
                                                                                <div className="flex items-center gap-2">
                                                                                    <span>{vac.position_title}</span>
                                                                                    {vac.is_oic && <span className="px-1.5 py-0.5 rounded bg-[#FCD116] text-[#08315F] text-[8px] font-black uppercase tracking-widest leading-none">OIC</span>}
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    />
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Designation & Appointment</p>
                                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                                                    <SummaryRow
                                                                        label="Position Title"
                                                                        value={
                                                                            profile.position_title ? (
                                                                                <div className="flex items-center gap-2">
                                                                                    <span>{profile.position_title}</span>
                                                                                    {profile.is_oic && <span className="px-1.5 py-0.5 rounded bg-[#FCD116] text-[#08315F] text-[8px] font-black uppercase tracking-widest leading-none">OIC</span>}
                                                                                </div>
                                                                            ) : null
                                                                        }
                                                                    />
                                                                    <SummaryRow label="Date of Present Position" value={profile.appointment_date} />
                                                                    <SummaryRow label="Permanent Address" value={profile.permanent_address} />
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Eligibility</p>
                                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                                                                    <SummaryRow label="Career Executive Service (CES)" value={profile.ces_stage} />
                                                                    <SummaryRow label="CES Conferment Date" value={profile.ces_conferment_date} />
                                                                    <SummaryRow label="Educational Management Test (EMT)" value={profile.emt_passer === true ? 'Yes' : profile.emt_passer === false ? 'No' : null} />
                                                                    <SummaryRow label="EMT Date" value={profile.emt_date} />
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Education</p>
                                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                                                    <SummaryRow label="Highest Education" value={profile.highest_education} />
                                                                    <SummaryRow label="Specific Degree" value={profile.specific_degree} />
                                                                    <SummaryRow label="Program / Course" value={profile.education_program} />
                                                                    <SummaryRow label="Year Graduated" value={profile.education_year_graduated} />
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Performance History</p>
                                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                                                    <SummaryRow label="Latest Rating (1st)" value={profile.performance_rating_1 ? `${profile.performance_rating_1} (${profile.performance_rating_1_period})` : null} />
                                                                    <SummaryRow label="Previous Rating (2nd)" value={profile.performance_rating_2 ? `${profile.performance_rating_2} (${profile.performance_rating_2_period})` : null} />
                                                                    <SummaryRow label="CESPES 1st Sem" value={profile.cespes_1_rating ? `${profile.cespes_1_rating}${profile.cespes_rating_1_period ? ` (${profile.cespes_rating_1_period})` : ''}` : null} />
                                                                    <SummaryRow label="CESPES 2nd Sem" value={profile.cespes_2_rating ? `${profile.cespes_2_rating}${profile.cespes_rating_2_period ? ` (${profile.cespes_rating_2_period})` : ''}` : null} />
                                                                    <SummaryRow label="Total Managerial Experience" value={profile.managerial_experience_total} />
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Notable Achievements</p>
                                                                <p className="text-sm font-bold text-slate-800 whitespace-pre-wrap leading-relaxed">{profile.notable_achievements || 'No achievements listed.'}</p>
                                                            </div>

                                                            {prevPositions.length > 0 && (
                                                                <div>
                                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Previous Positions ({prevPositions.length})</p>
                                                                    <div className="space-y-2">
                                                                        {prevPositions.map((p, i) => (
                                                                            <div key={i} className="flex items-start gap-3 p-3 bg-transparent rounded-2xl">
                                                                                <span className="text-[10px] font-black text-slate-400 mt-0.5 w-5 shrink-0">{i + 1}.</span>
                                                                                <div>
                                                                                    <p className="text-sm font-bold text-slate-800">{p.position_name || '—'}</p>
                                                                                    <p className="text-[10px] font-bold text-slate-400">{p.office} {p.start_date ? `· ${p.start_date} – ${p.end_date || 'Present'}` : ''}</p>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            <div>
                                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Documents</p>
                                                                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                                                                    {[
                                                                        { key: 'photo_binary_id', label: '2x2 Photo' },
                                                                        { key: 'pds_binary_id', label: 'PDS' },
                                                                        { key: 'profile_word_binary_id', label: 'Profile (Word)' },
                                                                        { key: 'profile_ppt_binary_id', label: 'Profile (PPT)' },
                                                                        { key: 'service_records_binary_id', label: 'Service Records' },
                                                                    ].map(d => (
                                                                        <div key={d.key} className={`flex flex-col items-center gap-2 p-4 rounded-[1.5rem] border-2 text-center ${profile[d.key] ? 'bg-emerald-50 border-emerald-200' : 'bg-transparent border-slate-100'}`}>
                                                                            <FiFileText size={20} className={profile[d.key] ? 'text-emerald-500' : 'text-slate-300'} />
                                                                            <span className="text-[9px] font-black uppercase tracking-wider leading-tight" style={{ color: profile[d.key] ? '#059669' : '#94a3b8' }}>{d.label}</span>
                                                                            <span className={`text-[8px] font-black uppercase tracking-widest ${profile[d.key] ? 'text-emerald-500' : 'text-slate-300'}`}>{profile[d.key] ? 'Uploaded' : 'Missing'}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Legal Disclosures</p>
                                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                                                    <SummaryRow label="Administrative Cases" value={profile.pending_admin_case ? 'Disclosed' : null} />
                                                                    <SummaryRow label="Ombudsman / CSC Cases" value={profile.ombudsman_case ? 'Disclosed' : null} />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* ── Career Progression (Summary Tab) ── */}
                                                        <div className="bg-white border-2 border-[#08315F] rounded-[22px] p-8 shadow-none">
                                                            <div className="flex items-center gap-3 mb-8">
                                                                <div className="w-10 h-10 bg-[#F4F8FB] text-[#075985] rounded-2xl flex items-center justify-center">
                                                                    <FiClock size={20} />
                                                                </div>
                                                                <div>
                                                                    <h3 className="text-sm font-['Quicksand'] font-black text-[#08315F] uppercase tracking-tight italic leading-none">Career Progression</h3>
                                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Professional Journey</p>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-6 relative">
                                                                <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-100"></div>
                                                                {historyLoading ? (
                                                                    <div className="py-12 text-center">
                                                                        <div className="w-6 h-6 border-2 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                                                                    </div>
                                                                ) : history.length === 0 ? (
                                                                    <div className="py-12 text-center bg-transparent rounded-3xl border border-dashed border-slate-200">
                                                                        <FiClock className="mx-auto text-slate-200 mb-2" size={24} />
                                                                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">Initial Entry Record</p>
                                                                    </div>
                                                                ) : (
                                                                    history.map((item, idx) => (
                                                                        <div key={idx} className="flex gap-6 relative z-10">
                                                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-md shrink-0 ${idx === 0 ? 'bg-[#08315F] text-white shadow-blue-500/30' : 'bg-slate-200 text-slate-500'}`}>
                                                                                {idx === 0 ? <FiAward size={14} /> : <FiActivity size={14} />}
                                                                            </div>
                                                                            <div className="flex-1 pt-1">
                                                                                <div className="flex justify-between items-start">
                                                                                    <h4 className="text-[11px] font-['Quicksand'] font-black text-[#08315F] uppercase tracking-tight leading-none italic">{item.position_title}</h4>
                                                                                    <span className="text-[8px] font-bold text-slate-400 bg-transparent px-2 py-0.5 rounded-full">{new Date(item.updated_at).getFullYear()}</span>
                                                                                </div>
                                                                                <p className="text-[10px] font-bold text-[#075985] uppercase tracking-widest mt-2">{item.office || 'Department of Education'}</p>
                                                                                {item.previous_incumbent && (
                                                                                    <p className="text-[9px] font-bold text-slate-400 mt-1 flex items-center gap-1">
                                                                                        <FiChevronLeft size={10} className="rotate-180" />
                                                                                        Prev. Incumbent: <span className="text-slate-600">{item.previous_incumbent}</span>
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* ── Masterlist Status (Verified Officials only) ── */}
                                                        {dataSource === 'masterlist' && (
                                                            <div className="bg-gradient-to-br from-[#0038A8] to-[#002878] rounded-[2.5rem] p-8 text-white shadow-xl shadow-blue-900/20 relative overflow-hidden">
                                                                <FiShield className="text-white/20 absolute -top-4 -right-4 rotate-12" size={80} />
                                                                <div className="relative z-10">
                                                                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] mb-4 opacity-60">Masterlist Status</h4>
                                                                    <p className="text-xl font-black italic uppercase leading-tight tracking-tighter">Verified Official</p>
                                                                    <p className="text-[10px] font-bold mt-4 opacity-80 leading-relaxed">This record is synchronized with the Central Office Masterlist. Any changes will be logged to the update ledger for audit transparency.</p>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* ── Data Privacy & Certification ── */}
                                                        <div className="bg-white rounded-[2.5rem] border-2 border-[#0038A8]/20 shadow-sm overflow-hidden">

                                                            {/* Header */}
                                                            <div className="bg-[#08315F] px-8 py-6 flex items-center gap-4">
                                                                <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center">
                                                                    <FiShield size={18} className="text-white" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-white font-black text-sm uppercase tracking-widest">Data Privacy Notice & Certification</p>
                                                                    <p className="text-blue-200 text-[9px] font-bold uppercase tracking-widest mt-0.5">Republic Act No. 10173 — Data Privacy Act of 2012</p>
                                                                </div>
                                                            </div>

                                                            <div className="p-8 space-y-6">
                                                                {/* DepEd DPA Notice */}
                                                                <div className="bg-transparent rounded-[2rem] p-6 text-[11px] font-bold text-slate-600 leading-relaxed border border-slate-100">
                                                                    <p>Pursuant to <span className="text-[#08315F] font-black">Republic Act No. 10173</span> or <span className="text-[#08315F] font-black">Data Privacy Act of 2012</span>, the personal data collected shall be kept confidential and shall not be disclosed, divulged nor used beyond its intended purpose. It may not be reproduced in whole, or in part, nor may any of the information contained therein be disclosed without the prior notice and/or consent of DepEd.</p>
                                                                </div>

                                                                {/* Certification Checkboxes */}
                                                                <div className="space-y-4">
                                                                    <button
                                                                        onClick={() => setDpaConsent(v => !v)}
                                                                        className={`w-full flex items-start gap-4 p-5 rounded-[1.5rem] border-2 text-left transition-all ${dpaConsent ? 'bg-[#F4F8FB] border-[#0038A8]' : 'bg-transparent border-slate-200 hover:border-slate-300'}`}
                                                                    >
                                                                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${dpaConsent ? 'bg-[#08315F] border-[#0038A8]' : 'border-slate-300 bg-white'}`}>
                                                                            {dpaConsent && <FiCheckCircle size={14} className="text-white" />}
                                                                        </div>
                                                                        <p className="text-[11px] font-bold text-slate-700 leading-relaxed">
                                                                            I have read and fully understood the Data Privacy Notice above. I hereby give my <span className="text-[#08315F] font-black">informed consent</span> to the collection, processing, and use of my personal information by the Department of Education for the purposes stated herein, in compliance with the Data Privacy Act of 2012.
                                                                        </p>
                                                                    </button>

                                                                    <button
                                                                        onClick={() => setTruthConsent(v => !v)}
                                                                        className={`w-full flex items-start gap-4 p-5 rounded-[1.5rem] border-2 text-left transition-all ${truthConsent ? 'bg-emerald-50 border-emerald-500' : 'bg-transparent border-slate-200 hover:border-slate-300'}`}
                                                                    >
                                                                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${truthConsent ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 bg-white'}`}>
                                                                            {truthConsent && <FiCheckCircle size={14} className="text-white" />}
                                                                        </div>
                                                                        <p className="text-[11px] font-bold text-slate-700 leading-relaxed">
                                                                            I hereby <span className="text-emerald-700 font-black">certify under oath</span> that all information I have provided in this profile is true, correct, and complete to the best of my knowledge. I understand that any false statement or misrepresentation shall subject me to the penalties prescribed under applicable laws and civil service rules.
                                                                        </p>
                                                                    </button>
                                                                </div>

                                                                {/* Action Buttons */}
                                                                {!certified ? (
                                                                    <div className="space-y-3 pt-2 w-full">
                                                                        <div className="flex flex-col sm:flex-row gap-3">
                                                                            {dataSource === 'masterlist' ? (
                                                                                <button
                                                                                    onClick={() => handleCertify(false)}
                                                                                    disabled={!dpaConsent || !truthConsent || certifying}
                                                                                    className="flex-1 py-5 bg-[#08315F] text-white font-black text-[10px] uppercase tracking-widest rounded-full shadow-2xl shadow-blue-900/30 hover:bg-[#08315F] transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                                                                                >
                                                                                    {certifying ? <FiLoader className="animate-spin" size={16} /> : <FiCheckCircle size={16} />}
                                                                                    {certifying ? 'Certifying...' : 'Certify — Profile is Up-to-Date'}
                                                                                </button>
                                                                            ) : (
                                                                                <>
                                                                                    <button
                                                                                        onClick={() => handleCertify(false)}
                                                                                        disabled={!dpaConsent || !truthConsent || certifying || applicationStatus === 'applied'}
                                                                                        className="flex-1 py-5 bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest rounded-full hover:bg-slate-900 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                                                                                    >
                                                                                        {certifying ? <FiLoader className="animate-spin" size={16} /> : <FiSave size={16} />}
                                                                                        Save Consent Only
                                                                                    </button>
                                                                                    {completeness === 100 && (applicationStatus === null || applicationStatus === 'disapproved') && (
                                                                                        <button
                                                                                            onClick={targetVacancyId ? handleSubmitApplication : () => setTab('application')}
                                                                                            disabled={!dpaConsent || !truthConsent || saving}
                                                                                            className="flex-1 py-5 bg-[#08315F] text-white font-black text-[10px] uppercase tracking-widest rounded-full shadow-2xl shadow-blue-900/30 hover:bg-[#08315F] transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 border-2 border-white/20"
                                                                                        >
                                                                                            {saving ? <FiLoader className="animate-spin" size={16} /> : <FiArrowRight size={16} />}
                                                                                            {saving ? 'Processing...' : targetVacancyId ? 'Submit Final Application' : 'Select a Vacancy First'}
                                                                                        </button>
                                                                                    )}
                                                                                    {applicationStatus === 'applied' && (
                                                                                        <div className="flex-1 flex items-center justify-center gap-3 py-5 bg-amber-50 border-2 border-amber-200 rounded-full text-amber-600 text-[10px] font-black uppercase tracking-widest">
                                                                                            <FiClock size={14} /> Applied (Pending Review)
                                                                                        </div>
                                                                                    )}
                                                                                    {applicationStatus === 'disapproved' && (
                                                                                        <div className="flex-1 flex items-center justify-center gap-3 py-5 bg-rose-50 border-2 border-rose-200 rounded-full text-rose-600 text-[10px] font-black uppercase tracking-widest">
                                                                                            <FiXCircle size={14} /> Disapproved
                                                                                        </div>
                                                                                    )}
                                                                                    {applicationStatus === 'approved' && (
                                                                                        <div className="flex-1 flex items-center justify-center gap-3 py-5 bg-emerald-50 border-2 border-emerald-200 rounded-full text-emerald-600 text-[10px] font-black uppercase tracking-widest">
                                                                                            <FiCheckCircle size={14} /> Approved
                                                                                        </div>
                                                                                    )}
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                        {(!dpaConsent || !truthConsent) && (
                                                                            <p className="text-[9px] font-bold text-slate-400 text-center mt-2 w-full">Please check both declarations above to proceed.</p>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center justify-center gap-4 py-6 bg-emerald-50 rounded-[2rem] border-2 border-emerald-200">
                                                                        <FiCheckCircle size={24} className="text-emerald-500" />
                                                                        <div>
                                                                            <p className="font-black text-emerald-700 text-sm uppercase tracking-wider">Certified Successfully</p>
                                                                            <p className="text-[10px] font-bold text-emerald-500 mt-0.5">Your consent and certification have been recorded.</p>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                            </motion.div>
                                        </AnimatePresence>

                                        {/* Global Save Success Notification */}
                                        <AnimatePresence>
                                            {saveSuccess && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 20 }}
                                                    className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-4 border border-emerald-400/30 backdrop-blur-md"
                                                >
                                                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                                                        <FiCheckCircle size={18} />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black uppercase tracking-widest">Progress Saved</p>
                                                        <p className="text-[10px] font-bold opacity-80">Your profile data is secure in our registry.</p>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {applicationStatus === 'disapproved' && tab === 'application' && (
                                            <div className="mt-10 flex justify-center">
                                                <button
                                                    onClick={handleResubmit}
                                                    disabled={saving}
                                                    className="px-12 py-4 bg-[#FBBF24] text-white font-black text-[10px] uppercase tracking-widest rounded-full shadow-lg shadow-red-500/20 hover:shadow-xl hover:shadow-red-500/35 hover:scale-[1.02] transition-all duration-300 active:scale-95 disabled:opacity-50 flex items-center gap-4"
                                                >
                                                    {saving ? <FiLoader className="animate-spin" size={16} /> : <FiRefreshCw size={16} />}
                                                    {saving ? 'Submitting...' : 'Resubmit Application'}
                                                </button>
                                            </div>
                                        )}
                                    </div>


                                </div>
                            </div>
                        </div>

                        {/* Persistent Bottom Action Bar */}
                        {applicationStatus !== 'applied' && (
                            <div className="bg-white border-t border-slate-200 py-4 px-6 lg:px-8 flex items-center justify-between z-20 shrink-0">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <FiShield className="text-emerald-500" size={12} /> Securely stored in DepEd database
                                </span>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-8 py-3 bg-[#08315F] hover:bg-blue-800 text-white font-black text-[10px] uppercase tracking-widest rounded-lg shadow-md hover:shadow-lg transition-all duration-300 active:scale-95 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving ? <FiLoader className="animate-spin" size={14} /> : <FiSave size={14} />}
                                    {saving ? 'Saving...' : 'Save Progress'}
                                </button>
                            </div>
                        )}

                        {/* Removed Global Export Modal because it was moved into Summary Tab as an inline popover */}
                    </div>
                </div>
            </div>
        </PageTransition>
    );
};

export default OfficialProfiling;

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiUser, FiAward, FiBriefcase, FiBook, FiFileText, FiShield,
    FiChevronLeft, FiChevronRight, FiSave, FiPlus, FiTrash2, FiCheckCircle,
    FiAlertTriangle, FiInfo, FiUpload, FiToggleLeft, FiToggleRight,
    FiSearch, FiLoader, FiList, FiLock, FiUnlock, FiTrendingUp, FiClock, FiActivity, FiStar, FiArrowRight, FiCalendar,
    FiDownload, FiX, FiMonitor, FiFile, FiPrinter, FiEye,
    FiEdit2, FiHeart, FiBookOpen, FiRotateCcw, FiCamera, FiBarChart2, FiChevronDown, FiHome, FiMapPin, FiLayers
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import PageTransition from '../components/PageTransition';
import html2pdf from 'html2pdf.js';
import PptxGenJS from 'pptxgenjs';
import newLogo from '../assets/modern_logo.png';
import depedLogo from '../assets/DepED-Logo.png';
import { apiUrl } from '../utils/api';
import { compressImageClientSide } from '../utils/imageCompressor';
import ModernDatePicker from '../components/ModernDatePicker';
import YearInput from '../components/YearInput';
import Swal from 'sweetalert2';
import { toUpper } from '../utils/textUtils';

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

    { id: 'summary', label: 'Summary & Certify', icon: FiList },
];

const SummaryRow = ({ label, value }) => (
    <div className="flex flex-col gap-1 min-w-0">
        <span className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest truncate">{label}</span>
        <span className="text-[21px] font-bold text-slate-800 break-words">{value || <span className="text-slate-300 italic font-normal text-[18px]">—</span>}</span>
    </div>
);

// All side tabs whose completion drives the progress bar.
const CONTENT_TABS = ['personal', 'eligibility', 'experience', 'education', 'performance', 'trainings', 'achievements', 'documents', 'legal', 'summary'];

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

const formatDateStr = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return val.split('T')[0];
    if (val instanceof Date) return val.toISOString().split('T')[0];
    return String(val).split('T')[0];
};

const inp = 'w-full bg-white hover:bg-transparent border-2 border-slate-200 focus:border-[#0038A8] focus:ring-1 focus:ring-[#0038A8] rounded-lg py-2.5 px-4 text-[18px] font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400/80 shadow-none';
const sel = 'w-full bg-white hover:bg-transparent border-2 border-slate-200 focus:border-[#0038A8] focus:ring-1 focus:ring-[#0038A8] rounded-lg py-2.5 px-4 text-[18px] font-semibold text-slate-800 outline-none transition-all shadow-none';

const Field = ({ label, children, className = '' }) => (
    <div className={`flex flex-col justify-end gap-1.5 group h-full ${className}`}>
        {label && (
            <label className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest transition-colors duration-200 group-focus-within:text-[#08315F] min-h-[26px] flex items-end">
                {label}
            </label>
        )}
        <div className="w-full">
            {children}
        </div>
    </div>
);

const SectionLabel = ({ children }) => (
    <p className="text-[16.5px] font-black uppercase tracking-[0.05em] text-[#08315F] mb-4">{children}</p>
);

const isSuffixPlaceholder = (suffix) => {
    if (!suffix) return true;
    const s = String(suffix).trim().toLowerCase();
    return s === '' || s === 'not applicable' || s === 'not apllicable' || s === 'na' || s === 'n/a' || s === 'none';
};

const sanitizeSuffix = (suffix) => {
    if (isSuffixPlaceholder(suffix)) return '';
    return String(suffix).trim();
};

const buildFullName = (profile) => {
    if (!profile) return '';
    const suffix = sanitizeSuffix(profile.suffix);
    return [profile.first_name, profile.middle_name, profile.last_name, suffix].filter(Boolean).join(' ').trim();
};

// Canonical positions and salary grades from public.tlo_positions (managerial: salary_grade >= 18)
const DEFAULT_TLO_POSITIONS = [
    { position_title: 'Assistant Regional Director', salary_grade: 27 },
    { position_title: 'Assistant Schools Division Superintendent', salary_grade: 28 },
    { position_title: 'Assistant Secretary', salary_grade: 29 },
    { position_title: 'Director III', salary_grade: 27 },
    { position_title: 'Director IV', salary_grade: 28 },
    { position_title: 'Regional Director', salary_grade: 28 },
    { position_title: 'Schools Division Superintendent', salary_grade: 26 },
    { position_title: 'Secretary', salary_grade: 31 },
    { position_title: 'Undersecretary', salary_grade: 30 }
];

const PREVIOUS_POSITION_OPTIONS = DEFAULT_TLO_POSITIONS.map(p => p.position_title);

const MANAGERIAL_MIN_SALARY_GRADE = 18;

const STANDARD_POSITION_SALARY_GRADES = {
    // Executive / Third-Level
    'SECRETARY': 31,
    'UNDERSECRETARY': 30,
    'ASSISTANT SECRETARY': 29,
    'REGIONAL DIRECTOR': 28,
    'DIRECTOR IV': 28,
    'ASSISTANT REGIONAL DIRECTOR': 27,
    'DIRECTOR III': 27,
    'SCHOOLS DIVISION SUPERINTENDENT': 26,
    'DIRECTOR II': 26,
    'ASSISTANT SCHOOLS DIVISION SUPERINTENDENT': 25,
    'DIRECTOR I': 25,
    'ATTORNEY V': 25,

    // Division Chiefs & Second-Level Supervisory / Managerial (SG 18-24)
    'CHIEF EDUCATION SUPERVISOR': 24,
    'CHIEF ADMINISTRATIVE OFFICER': 24,
    'CHIEF EDUCATION PROGRAM SUPERVISOR': 24,
    'CHIEF, CURRICULUM IMPLEMENTATION DIVISION': 24,
    'CHIEF, SCHOOL GOVERNANCE AND OPERATIONS DIVISION': 24,
    'CID CHIEF': 24,
    'SGOD CHIEF': 24,
    'CHIEF SUPERVISORS': 24,
    'VOCATIONAL SCHOOL ADMINISTRATOR II': 24,
    'ATTORNEY IV': 23,
    'PUBLIC SCHOOLS DISTRICT SUPERVISOR': 22,
    'EDUCATION PROGRAM SUPERVISOR': 22,
    'EDUCATION PROGRAM SUPERVISOR I': 22,
    'EDUCATION PROGRAM SUPERVISOR II': 22,
    'EDUCATION SUPERVISOR I': 22,
    'EDUCATION SUPERVISOR II': 22,
    'SUPERVISING ADMINISTRATIVE OFFICER': 22,
    'SUPERVISING EDUCATION PROGRAM SPECIALIST': 22,
    'VOCATIONAL SCHOOL ADMINISTRATOR I': 22,
    'PRINCIPAL IV': 22,
    'PRINCIPAL III': 21,
    'PRINCIPAL II': 20,
    'PRINCIPAL I': 19,
    'PRINCIPAL': 19,
    'ASSISTANT PRINCIPAL II': 19,
    'SENIOR EDUCATION PROGRAM SPECIALIST': 19,
    'ASSISTANT PRINCIPAL I': 18,
    'ASSISTANT PRINCIPAL': 18,
    'ADMINISTRATIVE OFFICER V': 18,
    'ACCOUNTANT III': 18,
    'ATTORNEY III': 18,
    'COLLEGE PRESIDENT': 30,

    // Below SG 18 (Non-Managerial / Non-Supervisory for DepEd Third Level qualification)
    'HEAD TEACHER VI': 19,
    'HEAD TEACHER III': 16,
    'HEAD TEACHER II': 15,
    'HEAD TEACHER I': 14,
    'HEAD TEACHER': 14,
    'HED TEACHER II': 15,
    'EDUCATION PROGRAM SPECIALIST II': 16,
    'PLANNING OFFICER II': 15,
    'PROJECT DEVELOPMENT OFFICER II': 15,
    'PROJECT DEVELOPMENT OFFICER 2': 15,
    'ADMINISTRATIVE OFFICER IV': 15,
    'ADMINISTRATIVE OFFICER II': 11,
    'ADMINISTRATIVE OFFICER': 11,
    'MASTER TEACHER II': 19,
    'MASTER TEACHER I': 18,
    'MASTER TEACHER': 18,
    'TEACHER III': 13,
    'TEACHER II': 12,
    'TEACHER I': 11,
    'TEACHER': 11,
    'CLASSROOM TEACHER': 11,
    'ELEMENTARY GRADE TEACHER III': 13,
    'ELEMENTARY GRADE TEACHER II': 12,
    'ELEMENTARY GRADE TEACHER I': 11,
    'SECONDARY SCHOOL TEACHER I': 11,
    'SECONDARY SCHOOL TEACHER': 11,
    'ADMINISTRATIVE ASSISTANT III': 9,
    'ADMINISTRATIVE ASSISTANT II': 8,
    'ADMINISTRATIVE ASSISTANT I': 7,
    'ADMINISTRATIVE AIDE VI': 6,
    'ADMINISTRATIVE AIDE IV': 4,
    'ADMINISTRATIVE AIDE III': 3,
    'ADMINISTRATIVE AIDE I': 1,
    'CLERK I': 3,
    'CLERK': 3
};

const PREVIOUS_POSITION_ACRONYMS = {
    'SDS': 'Schools Division Superintendent',
    'ASDS': 'Assistant Schools Division Superintendent',
    'RD': 'Regional Director',
    'ARD': 'Assistant Regional Director',
    'USEC': 'Undersecretary',
    'ASEC': 'Assistant Secretary',
    'SEC': 'Secretary',
    'OSEC': 'Secretary',
    'DIR IV': 'Director IV',
    'DIR III': 'Director III',
    'DIR II': 'Director II',
    'DIR4': 'Director IV',
    'DIR3': 'Director III',
    'DIR2': 'Director II',
    'PSDS': 'Public Schools District Supervisor',
    'EPS': 'Education Program Supervisor',
    'EPS I': 'Education Program Supervisor I',
    'EPS II': 'Education Program Supervisor II',
    'SEPS': 'Senior Education Program Specialist',
    'CES': 'Chief Education Supervisor',
    'CAO': 'Chief Administrative Officer',
    'AO V': 'Administrative Officer V',
    'AOV': 'Administrative Officer V',
    'P1': 'Principal I',
    'P2': 'Principal II',
    'P3': 'Principal III',
    'P4': 'Principal IV',
    'HT3': 'Head Teacher III',
    'HT2': 'Head Teacher II',
    'HT1': 'Head Teacher I',
    'T3': 'Teacher III',
    'T2': 'Teacher II',
    'T1': 'Teacher I',
    'MT2': 'Master Teacher II',
    'MT1': 'Master Teacher I'
};

const normalizeManagerialTitle = (rawTitle) => {
    if (!rawTitle || typeof rawTitle !== 'string') return '';
    let title = rawTitle.trim().toUpperCase();

    // Strip OIC / Acting prefixes
    title = title.replace(/^(OIC|OFFICER-IN-CHARGE|OFFICER\s+IN\s+CHARGE|ACTING)\s*[-–—:]*\s*/i, '');

    // Expand common abbreviations safely
    title = title.replace(/\bASSIST\./i, 'ASSISTANT');
    title = title.replace(/\bDIR\./i, 'DIRECTOR');
    title = title.replace(/\bSUPT\./i, 'SUPERINTENDENT');
    title = title.replace(/\bADMIN\./i, 'ADMINISTRATIVE');
    title = title.replace(/\bOFF\./i, 'OFFICER');

    // Strip trailing parenthesis like (SGOD), (CID), (CESO VI), etc.
    title = title.replace(/\s*\([^)]*\)\s*/g, ' ').trim();

    // Remove extra whitespace
    title = title.replace(/\s+/g, ' ');

    if (PREVIOUS_POSITION_ACRONYMS[title]) {
        return PREVIOUS_POSITION_ACRONYMS[title].toUpperCase();
    }

    return title;
};

const getSalaryGradeForPosition = (rawTitle, positionsList = DEFAULT_TLO_POSITIONS, explicitGrade = null) => {
    if (explicitGrade !== null && explicitGrade !== undefined && explicitGrade !== '') {
        const num = parseInt(explicitGrade, 10);
        if (!isNaN(num) && num > 0) return num;
    }

    if (!rawTitle || typeof rawTitle !== 'string') return 0;

    // Check if title mentions explicit SG like 'SG 18', 'SG-24', 'Salary Grade 22'
    const sgMatch = rawTitle.match(/\b(?:SG|SALARY\s*GRADE)\s*[-:]*\s*(\d{1,2})\b/i);
    if (sgMatch) {
        const num = parseInt(sgMatch[1], 10);
        if (!isNaN(num) && num > 0) return num;
    }

    const clean = normalizeManagerialTitle(rawTitle);
    if (!clean || clean === 'OTHERS' || clean === 'N/A') return 0;

    // 1. Direct match in positionsList (e.g. from tlo_positions)
    const match = (positionsList || []).find(p => p.position_title && p.position_title.trim().toUpperCase() === clean);
    if (match && match.salary_grade) {
        const num = parseInt(match.salary_grade, 10);
        if (!isNaN(num) && num > 0) return num;
    }

    // 2. Direct match in STANDARD_POSITION_SALARY_GRADES
    if (STANDARD_POSITION_SALARY_GRADES[clean] !== undefined) {
        return STANDARD_POSITION_SALARY_GRADES[clean];
    }

    // 3. Prefix/keyword matches in STANDARD_POSITION_SALARY_GRADES
    for (const [key, sg] of Object.entries(STANDARD_POSITION_SALARY_GRADES)) {
        if (clean === key || clean.startsWith(key + ' ') || clean.startsWith(key + '-') || clean.endsWith(' ' + key)) {
            return sg;
        }
    }

    // 4. Prefix match against positionsList
    const prefixMatch = (positionsList || []).find(p => p.position_title && clean.startsWith(p.position_title.trim().toUpperCase()));
    if (prefixMatch && prefixMatch.salary_grade) {
        const num = parseInt(prefixMatch.salary_grade, 10);
        if (!isNaN(num) && num > 0) return num;
    }

    return 0;
};

// Managerial position identification: salary_grade >= 18 (DepEd / CSC standard)
const isManagerialPosition = (rawTitle, positionsList = DEFAULT_TLO_POSITIONS, explicitGrade = null) => {
    if (!rawTitle || typeof rawTitle !== 'string') return false;
    const clean = normalizeManagerialTitle(rawTitle);
    if (!clean || clean === 'OTHERS' || clean === 'N/A') return false;

    // Master Teachers are teaching track (individual contributor) - exclude unless TIC
    if (clean.startsWith('MASTER TEACHER') && !clean.includes('CHARGE')) {
        return false;
    }

    const sg = getSalaryGradeForPosition(rawTitle, positionsList, explicitGrade);
    return sg >= MANAGERIAL_MIN_SALARY_GRADE;
};

const SearchableSelect = ({ value, onChange, options, placeholder, className, disabled }) => {
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
        const val = e.target.value.toUpperCase();
        setSearch(val);
        onChange(val);
        setIsOpen(true);
    };

    return (
        <div ref={containerRef} className="relative w-full">
            <input disabled={disabled}
                type="text"
                placeholder={placeholder}
                value={search}
                onChange={handleInputChange}
                onFocus={() => setIsOpen(true)}
                className={`w-full ${className}`}
            />
            {isOpen && (
                <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border-2 border-slate-200 rounded-xl shadow-lg z-50 py-1">
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
                                className="w-full text-left px-3 py-2 text-[18px] font-semibold text-slate-700 hover:bg-transparent transition-colors"
                            >
                                {opt}
                            </button>
                        ))
                    ) : (
                        <div className="px-3 py-2 text-[18px] text-slate-400 italic">No matches found. Typing custom position...</div>
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
    const urlVacancy = searchParams.get('vacancy');
    const urlTloid = searchParams.get('tloid');
    const { user, token, logout } = useAuth();

    const [status, setStatus] = useState('loading'); // loading | found | not-found | error
    const [TLOid, setTlid] = useState(null);
    const [availableRoles, setAvailableRoles] = useState([]);
    const [isMultiRole, setIsMultiRole] = useState(false);
    const [isCollision, setIsCollision] = useState(false);
    const [isUncertain, setIsUncertain] = useState(false);
    const [disambiguationRecords, setDisambiguationRecords] = useState([]);
    const [applyToVerifiedRoles, setApplyToVerifiedRoles] = useState(false);
    const [showRoleDropdown, setShowRoleDropdown] = useState(false);
    const [isHeaderExpanded, setIsHeaderExpanded] = useState(() => {
        const saved = localStorage.getItem('deped_profiling_header_expanded');
        return saved !== null ? saved === 'true' : false;
    });

    const toggleHeaderAccordion = () => {
        setIsHeaderExpanded(prev => {
            const next = !prev;
            try {
                localStorage.setItem('deped_profiling_header_expanded', String(next));
            } catch (e) { }
            return next;
        });
    };

    const [applicationId, setApplicationId] = useState(null);
    const [applicationStatus, setApplicationStatus] = useState(null); // draft|pending_review|denied|approved|null(masterlist)
    const [denialReason, setDenialReason] = useState('');
    const [dataSource, setDataSource] = useState(null); // 'staging' | 'masterlist'
    const [tab, setTab] = useState('personal');
    const [saving, setSaving] = useState(false);
    const [uploadingDocs, setUploadingDocs] = useState({});
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saved, setSaved] = useState(false);
    const isTlo = user?.role?.toLowerCase() === 'tlo applicant';
    const [isEditing, setIsEditing] = useState(isTlo);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSuffixNA, setIsSuffixNA] = useState(false);

    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const [profile, setProfile] = useState({
        email: '',
        last_name: '', first_name: '', middle_name: '', suffix: '',
        gender: '', date_of_birth: '', age: '', civil_status: '',
        employment_status: '', position_title: '', designation: '', is_oic: false, appointment_date: '',
        region: '', division: '', office: '', strand: '',
        emt_passer: null, emt_date: '', ces_stage: '', ces_conferment_date: '',
        total_years_third_level: '', permanent_address: '', temporary_address: '',
        highest_education: '', specific_degree: '', education_program: '', education_year_graduated: '',
        bachelor_degree: '', bachelor_year: '', master_degree: '', master_year: '', doctorate_degree: '', doctorate_year: '',
        notable_achievements: [], individual_accomplishments: [],
        eligibilities: [], other_courses: [],
        performance_rating_1: '', performance_rating_1_period: '',
        performance_rating_2: '', performance_rating_2_period: '',
        performance_rating_3: '', performance_rating_3_period: '',
        cespes_1_rating: '', cespes_2_rating: '',
        cespes_rating_1_period: '', cespes_rating_2_period: '',
        managerial_experience_total: '',
        pending_admin_case: '',
        guilty_admin_details: '', criminally_charged_details: '', convicted_crime_details: '',
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
    const [positionsList, setPositionsList] = useState([]);
    const [tloPositions, setTloPositions] = useState(DEFAULT_TLO_POSITIONS);
    const tloPositionOptions = React.useMemo(() => {
        const list = (tloPositions || []).map(p => p.position_title).filter(Boolean);
        return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
    }, [tloPositions]);
    const [designationsList, setDesignationsList] = useState([]);
    const [regionsList, setRegionsList] = useState([]);
    const [regionDivisions, setRegionDivisions] = useState({});
    const [divisionsList, setDivisionsList] = useState([]);
    const [activeAssignments, setActiveAssignments] = useState([]);
    const [isLocationLocked, setIsLocationLocked] = useState(true);
    const [showLocationUnlockModal, setShowLocationUnlockModal] = useState(false);
    const [targetVacancyId, setTargetVacancyId] = useState(null);
    const [notableAchievementsOptions, setNotableAchievementsOptions] = useState([]);

    const sortAssignmentsByCapacity = (list) => {
        if (!Array.isArray(list)) return [];
        return [...list].sort((a, b) => {
            const getRank = (cap) => {
                const c = (cap || '').trim().toUpperCase();
                if (c === 'FULL') return 1;
                if (c === 'OIC') return 2;
                return 3;
            };
            const rankDiff = getRank(a.capacity) - getRank(b.capacity);
            if (rankDiff !== 0) return rankDiff;
            return (a.assignment_id || a.id || 0) - (b.assignment_id || b.id || 0);
        });
    };

    const fetchActiveAssignments = async (id) => {
        if (!id) return;
        try {
            const res = await fetch(apiUrl(`/api/third-level/${encodeURIComponent(id)}/active-assignments`), {
                headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
            });
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
                setActiveAssignments(sortAssignmentsByCapacity(json.data));
            }
        } catch (e) {
            console.warn('[fetchActiveAssignments] Failed to load active assignments:', e);
        }
    };

    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [selectedExportType, setSelectedExportType] = useState('csv');
    const [exporting, setExporting] = useState(false);
    const [previewScale, setPreviewScale] = useState(1);
    const [selectedEducationType, setSelectedEducationType] = useState('');
    const [uploadedFileNames, setUploadedFileNames] = useState({});
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
    // completedTabs: how many of the 9 content tabs satisfy isTabCompleted
    // (isTabCompleted is defined below, so we compute this after it is defined)

    const isTabCompleted = (tabId) => {
        if (tabId === 'personal') {
            return !!(
                profile.first_name?.trim() &&
                profile.last_name?.trim() &&
                profile.gender?.trim() &&
                profile.date_of_birth &&
                profile.civil_status?.trim() &&
                profile.photo_binary_id &&
                profile.permanent_address?.trim() &&
                (profile.alt_contact_details_1?.trim() || profile.contact_details?.trim())
            );
        }
        if (tabId === 'eligibility') {
            return !!(
                profile.ces_stage?.trim() ||
                (profile.emt_passer === true && profile.emt_date) ||
                (Array.isArray(profile.eligibilities) && profile.eligibilities.some(e => e && (e.eligibility?.trim() || e.title?.trim())))
            );
        }
        if (tabId === 'experience') {
            return prevPositions.some(p => p && (p.position_name?.trim() || p.office?.trim()));
        }
        if (tabId === 'education') {
            return !!(
                profile.bachelor_degree?.trim() ||
                profile.master_degree?.trim() ||
                profile.doctorate_degree?.trim() ||
                profile.highest_education?.trim() ||
                (Array.isArray(profile.education_degrees) && profile.education_degrees.some(d => d && (d.specific_degree?.trim() || d.education_program?.trim())))
            );
        }
        if (tabId === 'performance') {
            return !!(profile.performance_rating_1 && profile.performance_rating_1_period);
        }
        if (tabId === 'trainings') {
            return trainings.some(t => t && (t.training_name?.trim() || t.date_from?.trim()));
        }
        if (tabId === 'achievements') {
            return !!(
                (Array.isArray(profile.notable_achievements) && profile.notable_achievements.some(a => a && (a.title?.trim() || (typeof a === 'string' && a.trim())))) ||
                (Array.isArray(profile.individual_accomplishments) && profile.individual_accomplishments.some(a => a && (a.description?.trim() || a.title?.trim() || (typeof a === 'string' && a.trim()))))
            );
        }
        if (tabId === 'documents') {
            return !!(profile.pds_binary_id && profile.service_records_binary_id);
        }
        if (tabId === 'legal') {
            return !!(
                profile.pending_admin_case?.trim() &&
                profile.guilty_admin_details?.trim() &&
                profile.criminally_charged_details?.trim() &&
                profile.convicted_crime_details?.trim()
            );
        }
        if (tabId === 'application') {
            return !!targetVacancyId;
        }
        if (tabId === 'summary') {
            return !!(certified || profile.dpa_consented_at);
        }
        return false;
    };

    // Export Logic
    const generateCSV = () => {
        setExporting(true);
        try {
            const header = [
                'First Name', 'Last Name', 'Middle Name', 'Suffix', 'Gender', 'Date of Birth', 'Age', 'Civil Status',
                'DepEd Email', 'Phone Number', 'Alternative Email 1', 'Alternative Email 2',
                'Position Title', 'Designation', 'Date of Present Position', 'Permanent Address',
                'Career Executive Service (CES)', 'CES Conferment Date', 'Educational Management Test (EMT)', 'EMT Date', 'Other Eligibilities',
                'Highest Education', 'Specific Degree', 'Program / Course', 'Year Graduated',
                'Latest Rating (1st)', 'Previous Rating (2nd)', 'CESPES 1st Sem', 'CESPES 2nd Sem', 'Total Managerial Experience',
                'Notable Achievements', 'Previous Position 1', 'Documents 2x2 Photo', 'Administrative Cases', 'Ombudsman / CSC Cases'
            ];
            const achFormatted = (Array.isArray(profile.notable_achievements) ? profile.notable_achievements : []).map(a => typeof a === 'object' && a !== null ? `${a.title || ''}${a.year ? ' (' + a.year + ')' : ''}` : String(a)).join(' | ');
            const indAccFormatted = (Array.isArray(profile.individual_accomplishments) ? profile.individual_accomplishments : []).map(a => typeof a === 'object' && a !== null ? `${a.description || a.title || ''}${a.award_year ? ' (' + a.award_year + ')' : ''}` : String(a)).filter(Boolean).join(' | ');
            const row = [
                profile.first_name, profile.last_name, profile.middle_name, sanitizeSuffix(profile.suffix), profile.gender, profile.date_of_birth, profile.age, profile.civil_status,
                profile.email || user?.email || '', profile.alt_contact_details_1 || profile.contact_details || '', profile.alt_email_1 || '', profile.alt_email_2 || '',
                profile.position_title, profile.designation, profile.appointment_date, profile.permanent_address,
                profile.ces_stage, profile.ces_conferment_date, profile.emt_passer === true ? 'Yes' : profile.emt_passer === false ? 'No' : '', profile.emt_date,
                (profile.eligibilities || []).map(e => `${e.eligibility || e.title || 'Untitled'} (${[e.date ? new Date(e.date).toLocaleDateString() : '', e.rating ? 'Rating: ' + e.rating : '', e.place_of_assignment ? 'Place: ' + e.place_of_assignment : '', e.details || ''].filter(Boolean).join(' | ')})`).join('; '),
                profile.highest_education, profile.specific_degree, profile.education_program, profile.education_year_graduated,
                profile.performance_rating_1, profile.performance_rating_2, profile.cespes_1_rating, profile.cespes_2_rating, profile.managerial_experience_total,
                [achFormatted, indAccFormatted].filter(Boolean).join(' | '), prevPositions[0]?.position_name || '', profile.photo_binary_id ? 'Uploaded' : 'Missing', profile.pending_admin_case, profile.ombudsman_case
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
            setExportModalOpen(false);
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
            slide.addImage({ path: depedLogo, x: 0.4, y: 0.2, w: 1.1, h: 1.1 });
            const pSuffix = sanitizeSuffix(profile.suffix);
            slide.addText(`${profile.last_name?.toUpperCase() || ''}${pSuffix ? ' ' + pSuffix : ''}, ${profile.first_name?.toUpperCase() || ''} ${profile.middle_name?.toUpperCase() || ''}`.trim(), { x: 1.6, y: 0.3, w: 4.3, h: 0.6, fontSize: 32, bold: true, color: '000000' });
            let posText = profile.position_title || '';
            if (profile.is_oic) {
                posText += ' (OIC)';
            }
            if (profile.office) {
                posText += `, ${profile.office}`;
            }

            const hasCustomDesignation = profile.designation &&
                profile.designation.trim() !== '' &&
                profile.designation.trim().toLowerCase() !== 'no designation' &&
                profile.designation.trim().toLowerCase() !== 'none' &&
                profile.designation.trim().toLowerCase() !== (profile.position_title || '').trim().toLowerCase();

            if (hasCustomDesignation) {
                slide.addText(posText, { x: 1.6, y: 0.85, w: 6.8, h: 0.35, fontSize: 18, bold: true, color: '000000' });
                slide.addText(profile.designation, { x: 1.6, y: 1.2, w: 6.8, h: 0.3, fontSize: 13, italic: true, bold: true, color: '08315F' });
            } else {
                slide.addText(posText, { x: 1.6, y: 0.9, w: 6.8, h: 0.5, fontSize: 20, bold: true, color: '000000' });
            }

            // Top Right: Photo
            if (profile.photo_binary_id) {
                slide.addImage({ path: apiUrl(`/api/binary/${profile.photo_binary_id}`), x: 8.6, y: 0.2, w: 1.2, h: 1.2 });
            } else {
                slide.addShape(pres.ShapeType.rect, { x: 8.6, y: 0.2, w: 1.2, h: 1.2, fill: { color: 'E2E8F0' } });
                slide.addText('2x2 Photo', { x: 8.6, y: 0.2, w: 1.2, h: 1.2, align: 'center', color: '64748B', fontSize: 10 });
            }

            // Managerial Experience Table
            let histRows = [
                [{ text: `Managerial Experience${profile.managerial_experience_total ? ` — Total: ${profile.managerial_experience_total}` : ''}`, options: { colspan: 3, fill: '0038A8', color: 'FFFFFF', bold: true, align: 'center', fontSize: 13 } }]
            ];
            const displayHistory = (prevPositions && prevPositions.length > 0) ? prevPositions : (history || []);
            const filteredHistory = displayHistory.filter(h => h.position_title || h.position_name || h.office).slice(0, 4);
            filteredHistory.forEach(h => {
                const title = h.position_title || h.position_name || '—';
                const officeName = h.office || '—';
                const dur = h.start_date ? calculateDuration(h.start_date, h.end_date) : { years: 0, months: 0 };
                histRows.push([
                    { text: title, options: { fill: 'F8FAFC', fontSize: 10, color: '000000', bold: true } },
                    { text: officeName, options: { fill: 'F8FAFC', fontSize: 10, color: '000000' } },
                    { text: `${dur.years} yrs., ${dur.months} mos.`, options: { fill: 'F8FAFC', fontSize: 10, color: '000000' } }
                ]);

                // Nested Child OIC positions under Parent
                if (h.oic_positions && Array.isArray(h.oic_positions) && h.oic_positions.length > 0) {
                    h.oic_positions.forEach(oic => {
                        if (oic.oic_position_name || oic.oic_office) {
                            const oicTitle = `   └─ OIC: ${oic.oic_position_name || 'OIC Position'}`;
                            const oicOffice = oic.oic_office || '—';
                            const oicDur = oic.oic_start_date ? calculateDuration(oic.oic_start_date, oic.oic_end_date) : { years: 0, months: 0 };
                            histRows.push([
                                { text: oicTitle, options: { fill: 'FEF3C7', fontSize: 9, color: '08315F' } },
                                { text: oicOffice, options: { fill: 'FEF3C7', fontSize: 9, color: '334155' } },
                                { text: `${oicDur.years} yrs., ${oicDur.months} mos.`, options: { fill: 'FEF3C7', fontSize: 9, color: '334155' } }
                            ]);
                        }
                    });
                }
            });
            if (filteredHistory.length === 0) histRows.push([{ text: 'No experience listed', options: { colspan: 3, fill: 'FFFFFF', fontSize: 10, align: 'center' } }]);
            if (profile.managerial_experience_total) {
                const todayFormatted = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                histRows.push([
                    { text: `Total Managerial Experience (As of ${todayFormatted}):`, options: { colspan: 2, fill: 'E2E8F0', fontSize: 9, bold: true, align: 'right', color: '08315F' } },
                    { text: profile.managerial_experience_total, options: { fill: 'E2E8F0', fontSize: 9, bold: true, align: 'center', color: '08315F' } }
                ]);
            }
            slide.addTable(histRows, { x: 0.4, y: 1.6, w: 5.5, colW: [1.8, 2.3, 1.4], border: { pt: 1, color: '64748B' } });

            // Educational Attainment Table
            let eduRows = [
                [{ text: 'Educational Attainment', options: { colspan: 3, fill: '0038A8', color: 'FFFFFF', bold: true, align: 'center', fontSize: 14 } }]
            ];
            eduRows.push([
                { text: 'Doctorate', options: { fill: 'FFFFFF', fontSize: 10, color: '000000', bold: true } },
                { text: profile.doctorate_degree || '—', options: { fill: 'FFFFFF', fontSize: 10, color: '000000' } },
                { text: profile.doctorate_year || '—', options: { fill: 'FFFFFF', fontSize: 10, align: 'center', color: '000000' } }
            ]);
            eduRows.push([
                { text: "Master's Degree", options: { fill: 'FFFFFF', fontSize: 10, color: '000000', bold: true } },
                { text: profile.master_degree || '—', options: { fill: 'FFFFFF', fontSize: 10, color: '000000' } },
                { text: profile.master_year || '—', options: { fill: 'FFFFFF', fontSize: 10, align: 'center', color: '000000' } }
            ]);
            eduRows.push([
                { text: 'Baccalaureate', options: { fill: 'FFFFFF', fontSize: 10, color: '000000', bold: true } },
                { text: profile.bachelor_degree || '—', options: { fill: 'FFFFFF', fontSize: 10, color: '000000' } },
                { text: profile.bachelor_year || '—', options: { fill: 'FFFFFF', fontSize: 10, align: 'center', color: '000000' } }
            ]);
            slide.addTable(eduRows, { x: 0.4, y: 3.8, w: 5.5, colW: [1.5, 3.0, 1.0], border: { pt: 1, color: '64748B' } });

            // Age Box
            slide.addShape(pres.ShapeType.rect, { x: 6.2, y: 1.6, w: 1.0, h: 0.25, fill: { color: 'F59E0B' } });
            slide.addText('Age', { x: 6.2, y: 1.6, w: 1.0, h: 0.25, color: 'FFFFFF', bold: true, align: 'center', fontSize: 12 });
            slide.addShape(pres.ShapeType.rect, { x: 6.2, y: 1.85, w: 1.0, h: 0.4, fill: { color: 'FFFFFF' }, line: { color: '64748B' } });
            slide.addText(`${profile.age || ''}`, { x: 6.2, y: 1.85, w: 1.0, h: 0.4, align: 'center', fontSize: 14, color: '000000' });

            // Performance Rating Table
            const extractPptYear = (period) => {
                if (!period) return '—';
                const match = String(period).match(/\b(19\d\d|20\d\d)\b/);
                return match ? match[1] : (String(period).split('-')[0] || String(period));
            };

            let perfRows = [
                [{ text: 'Performance Rating', options: { colspan: 3, fill: 'B91C1C', color: 'FFFFFF', bold: true, align: 'center', fontSize: 12 } }],
                [
                    { text: 'Period / Type', options: { fill: 'FEE2E2', fontSize: 9, bold: true, color: '991B1B' } },
                    { text: 'Year', options: { fill: 'FEE2E2', fontSize: 9, bold: true, align: 'center', color: '991B1B' } },
                    { text: 'Rating', options: { fill: 'FEE2E2', fontSize: 9, bold: true, align: 'center', color: '991B1B' } }
                ]
            ];

            if (profile.cespes_1_rating) perfRows.push([
                { text: `${profile.cespes_rating_1_period || ''} 1st sem (CESPES)`, options: { fontSize: 9, color: '000000' } },
                { text: extractPptYear(profile.cespes_rating_1_period), options: { fontSize: 9, align: 'center', color: '000000', bold: true } },
                { text: String(profile.cespes_1_rating), options: { fontSize: 9, align: 'center', color: '000000', bold: true } }
            ]);
            if (profile.cespes_2_rating) perfRows.push([
                { text: `${profile.cespes_rating_2_period || ''} 2nd sem (CESPES)`, options: { fontSize: 9, color: '000000' } },
                { text: extractPptYear(profile.cespes_rating_2_period), options: { fontSize: 9, align: 'center', color: '000000', bold: true } },
                { text: String(profile.cespes_2_rating), options: { fontSize: 9, align: 'center', color: '000000', bold: true } }
            ]);
            if (profile.performance_rating_1) perfRows.push([
                { text: `${profile.performance_rating_1_period || ''} (OPCRF)`, options: { fontSize: 9, color: '000000' } },
                { text: extractPptYear(profile.performance_rating_1_period), options: { fontSize: 9, align: 'center', color: '000000', bold: true } },
                { text: String(profile.performance_rating_1), options: { fontSize: 9, align: 'center', color: '000000', bold: true } }
            ]);
            if (profile.performance_rating_2) perfRows.push([
                { text: `${profile.performance_rating_2_period || ''} (OPCRF)`, options: { fontSize: 9, color: '000000' } },
                { text: extractPptYear(profile.performance_rating_2_period), options: { fontSize: 9, align: 'center', color: '000000', bold: true } },
                { text: String(profile.performance_rating_2), options: { fontSize: 9, align: 'center', color: '000000', bold: true } }
            ]);
            if (profile.performance_rating_3) perfRows.push([
                { text: `${profile.performance_rating_3_period || ''} (OPCRF)`, options: { fontSize: 9, color: '000000' } },
                { text: extractPptYear(profile.performance_rating_3_period), options: { fontSize: 9, align: 'center', color: '000000', bold: true } },
                { text: String(profile.performance_rating_3), options: { fontSize: 9, align: 'center', color: '000000', bold: true } }
            ]);

            if (perfRows.length === 2) perfRows.push([{ text: 'No ratings', options: { colspan: 3, fontSize: 10, align: 'center', color: '000000' } }]);
            slide.addTable(perfRows, { x: 6.2, y: 2.4, w: 3.6, colW: [2.1, 0.7, 0.8], border: { pt: 1, color: 'B91C1C' }, fill: 'FFFFFF' });

            // Eligibility Table
            let eligRows = [
                [{ text: 'Eligibility', options: { colspan: 2, fill: 'B91C1C', color: 'FFFFFF', bold: true, align: 'center', fontSize: 12 } }]
            ];
            eligRows.push([{ text: `CES: ${profile.ces_stage || 'Not Applicable'}`, options: { fontSize: 10, color: '000000' } }, { text: profile.ces_conferment_date || '', options: { fontSize: 10, align: 'center', color: '000000' } }]);
            eligRows.push([{ text: `EMT: ${profile.emt_passer === true ? 'Passed' : profile.emt_passer === false ? 'Not Passed' : 'Not Applicable'}`, options: { fontSize: 10, color: '000000' } }, { text: profile.emt_date || '', options: { fontSize: 10, align: 'center', color: '000000' } }]);

            if (profile.eligibilities && profile.eligibilities.length > 0) {
                profile.eligibilities.forEach(elig => {
                    const name = elig.eligibility || elig.title || 'Untitled';
                    const meta = [
                        elig.rating ? `Rating: ${elig.rating}` : '',
                        elig.date ? `Date: ${new Date(elig.date).toLocaleDateString()}` : '',
                        elig.place_of_assignment ? `Place: ${elig.place_of_assignment}` : ''
                    ].filter(Boolean).join(' | ');
                    const fallback = elig.details || '—';
                    eligRows.push([{ text: name, options: { fontSize: 10, color: '000000' } }, { text: meta || fallback, options: { fontSize: 10, align: 'center', color: '000000' } }]);
                });
            }

            slide.addTable(eligRows, { x: 6.2, y: 4.0, w: 3.6, colW: [2.0, 1.6], border: { pt: 1, color: 'B91C1C' }, fill: 'FFFFFF' });
            pres.writeFile({ fileName: `profile_${profile.last_name || 'export'}.pptx` }).then(() => setExporting(false));
        } catch (err) {
            console.error(err);
            Swal.fire('Notice', "Failed to generate PPT", 'info');
            setExporting(false);
        }
    };

    // Recompute progress whenever any tab dependency changes
    useEffect(() => {
        const progressTabs = TABS.filter(t => dataSource !== 'masterlist' || t.id !== 'application').map(t => t.id);
        const completedCount = progressTabs.filter(tabId => isTabCompleted(tabId)).length;
        setCompleteness(Math.round((completedCount / progressTabs.length) * 100));
    }, [profile, prevPositions, trainings, dpaConsent, truthConsent, certified, dataSource]);
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
        let parsedUrlEmail = urlEmail;
        if (parsedUrlEmail) {
            parsedUrlEmail = parsedUrlEmail.replace(/ /g, '+');
        }
        const emailToLookup = parsedUrlEmail || user?.email || user?.userEmail || localStorage.getItem('userEmail');
        if (urlTloid) {
            lookupByEmail(emailToLookup || '', urlTloid);
        } else if (emailToLookup) {
            lookupByEmail(emailToLookup);
        } else {
            const timer = setTimeout(() => {
                if (!user && !localStorage.getItem('userEmail')) {
                    setStatus('not-found');
                }
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [user, urlEmail, urlTloid]);

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
        if (!Array.isArray(prevPositions) || prevPositions.length === 0) {
            if (profile.managerial_experience_total !== '0 Years, 0 Months') {
                setProfile(prev => ({ ...prev, managerial_experience_total: '0 Years, 0 Months' }));
            }
            return;
        }

        const intervals = [];

        prevPositions.forEach(pos => {
            // 1. Base Position: only count if it is an approved managerial position (salary_grade >= 18)
            if (pos.start_date && isManagerialPosition(pos.position_name, tloPositions, pos.salary_grade)) {
                const start = new Date(pos.start_date);
                const end = pos.end_date ? new Date(pos.end_date) : new Date();
                if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
                    intervals.push({ start, end });
                }
            }

            // 2. Child OIC positions: each OIC period is evaluated independently
            if (Array.isArray(pos.oic_positions)) {
                pos.oic_positions.forEach(oic => {
                    if (oic.oic_start_date && isManagerialPosition(oic.oic_position_name, tloPositions, oic.salary_grade)) {
                        const start = new Date(oic.oic_start_date);
                        const end = oic.oic_end_date ? new Date(oic.oic_end_date) : new Date();
                        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
                            intervals.push({ start, end });
                        }
                    }
                });
            }
        });

        if (intervals.length === 0) {
            const emptyStr = '0 Years, 0 Months';
            if (profile.managerial_experience_total !== emptyStr) {
                setProfile(prev => ({ ...prev, managerial_experience_total: emptyStr }));
            }
            return;
        }

        // Sort intervals by start date ascending
        intervals.sort((a, b) => a.start.getTime() - b.start.getTime());

        // Merge overlapping intervals to prevent double-counting
        const merged = [];
        for (const curr of intervals) {
            if (merged.length === 0) {
                merged.push({ start: new Date(curr.start), end: new Date(curr.end) });
            } else {
                const last = merged[merged.length - 1];
                if (curr.start.getTime() <= last.end.getTime()) {
                    // Overlaps or touches: extend end date if current ends later
                    if (curr.end.getTime() > last.end.getTime()) {
                        last.end = new Date(curr.end);
                    }
                } else {
                    merged.push({ start: new Date(curr.start), end: new Date(curr.end) });
                }
            }
        }

        // Calculate total duration across disjoint merged intervals
        let totalYears = 0;
        let totalMonths = 0;

        merged.forEach(interval => {
            const dur = calculateDuration(interval.start, interval.end);
            totalYears += dur.years;
            totalMonths += dur.months;
        });

        totalYears += Math.floor(totalMonths / 12);
        totalMonths = totalMonths % 12;

        const resultStr = `${totalYears} Year${totalYears !== 1 ? 's' : ''}, ${totalMonths} Month${totalMonths !== 1 ? 's' : ''}`;
        if (profile.managerial_experience_total !== resultStr) {
            setProfile(prev => ({ ...prev, managerial_experience_total: resultStr }));
        }
    }, [prevPositions, tloPositions]);

    // Training Hours Auto-Computation
    useEffect(() => {
        const total = trainings.reduce((acc, tr) => acc + (parseFloat(tr.hours) || 0), 0);
        if (parseFloat(profile.total_training_hours) !== total) {
            setProfile(prev => ({ ...prev, total_training_hours: total }));
        }
    }, [trainings]);

    // Highest Education Auto-Sync
    useEffect(() => {
        let hEd = '';
        let hProg = '';
        let hYear = '';

        const doc = (profile.doctorate_degree || '').split('\n').filter(Boolean);
        const docY = (profile.doctorate_year || '').split('\n').filter(Boolean);
        const mas = (profile.master_degree || '').split('\n').filter(Boolean);
        const masY = (profile.master_year || '').split('\n').filter(Boolean);
        const bac = (profile.bachelor_degree || '').split('\n').filter(Boolean);
        const bacY = (profile.bachelor_year || '').split('\n').filter(Boolean);

        if (doc.length > 0) {
            hEd = 'Doctorate';
            hProg = doc[0];
            hYear = docY[0] || '';
        } else if (mas.length > 0) {
            hEd = "Master's Degree";
            hProg = mas[0];
            hYear = masY[0] || '';
        } else if (bac.length > 0) {
            hEd = "Baccalaureate / Bachelor's Degree";
            hProg = bac[0];
            hYear = bacY[0] || '';
        }

        if (profile.highest_education !== hEd || profile.education_program !== hProg || profile.education_year_graduated !== hYear) {
            setProfile(prev => ({
                ...prev,
                highest_education: hEd,
                education_program: hProg,
                education_year_graduated: hYear
            }));
        }
    }, [profile.doctorate_degree, profile.master_degree, profile.bachelor_degree, profile.doctorate_year, profile.master_year, profile.bachelor_year]);

    // Removed reactive degree year clearing because it prevents typing (e.g. typing "20" evaluates to 20 < 2010 and gets cleared).
    // Validation is already properly handled by `validateProfile` on save.

    const lookupByEmail = async (email, explicitTloid = null) => {
        if (!email && !explicitTloid) { setStatus('not-found'); return; }
        try {
            const queryParams = explicitTloid
                ? `email=${encodeURIComponent(email || '')}&tloid=${encodeURIComponent(explicitTloid)}`
                : `email=${encodeURIComponent(email || '')}`;
            const res = await fetch(apiUrl(`/api/third-level/by-email?${queryParams}`), {
                headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success) {
                const multi = Boolean(data.isMultiRole);
                setIsMultiRole(multi);
                setApplyToVerifiedRoles(multi);
                setAvailableRoles(Array.isArray(data.availableRoles) ? data.availableRoles : []);
                setIsCollision(Boolean(data.isCollision));
                setIsUncertain(Boolean(data.isUncertain));
                setDisambiguationRecords(Array.isArray(data.disambiguationRecords) ? data.disambiguationRecords : []);

                if ((data.isCollision || data.isUncertain) && !data.data) {
                    // Ambiguous/Collision state without explicit TLOid: halt auto-population and show disambiguation
                    setStatus('found');
                    return;
                }

                if (data.data) {
                    const d = data.data;
                    setTlid(d.TLOid || d.app_TLOid);
                    setActiveAssignments(sortAssignmentsByCapacity(d.active_assignments));
                    if ((!Array.isArray(d.active_assignments) || d.active_assignments.length === 0) && (d.TLOid || d.app_TLOid)) {
                        fetchActiveAssignments(d.TLOid || d.app_TLOid);
                    }
                    setApplicationId(d.application_id || null);
                    setApplicationStatus(data.source === 'masterlist' ? null : d.application_status);
                    setDenialReason(d.denial_reason || '');
                    setDataSource(data.source);
                    setTargetVacancyId(urlVacancy || d.target_TLOid || null);
                    if (urlVacancy) {
                        setTab('summary');
                    }

                    // ─────────────────────────────────────────────────────────────
                    // EDUCATION: Fallback chain
                    // Priority 1: d.education_records  (relational — new)
                    // Priority 2: d.education_degrees  (JSONB — existing)
                    // Priority 3: d.bachelor_degree     (legacy newline text)
                    // ─────────────────────────────────────────────────────────────
                    let bacDegs = [];
                    let bacYrs = [];
                    let masDegs = [];
                    let masYrs = [];
                    let docDegs = [];
                    let docYrs = [];

                    const relationalEdu = Array.isArray(d.education_records) && d.education_records.length > 0;
                    if (relationalEdu) {
                        // Priority 1: relational rows { id, level, degree, year_graduated }
                        d.education_records.forEach(rec => {
                            const lv = (rec.level || '').toUpperCase();
                            const deg = rec.degree || '';
                            const yr = rec.year_graduated ? String(rec.year_graduated) : '';
                            if (lv === 'BACHELOR') {
                                if (deg) bacDegs.push(deg);
                                if (yr) bacYrs.push(yr);
                            } else if (lv === 'MASTER') {
                                if (deg) masDegs.push(deg);
                                if (yr) masYrs.push(yr);
                            } else if (lv === 'DOCTORATE') {
                                if (deg) docDegs.push(deg);
                                if (yr) docYrs.push(yr);
                            }
                        });
                    } else {
                        // Priority 2: education_degrees JSONB (existing logic — preserved)
                        const educationDegrees = d.education_degrees || [];
                        educationDegrees.forEach(deg => {
                            const highest = (deg.highest_education || '').toUpperCase();
                            const degreeName = deg.specific_degree || deg.education_program || '';
                            const year = deg.education_year_graduated || '';
                            if (highest.includes('BACHELOR') || highest.includes('BACCALAUREATE')) {
                                if (degreeName) bacDegs.push(degreeName);
                                if (year) bacYrs.push(year);
                            } else if (highest.includes('MASTER')) {
                                if (degreeName) masDegs.push(degreeName);
                                if (year) masYrs.push(year);
                            } else if (highest.includes('DOCTOR')) {
                                if (degreeName) docDegs.push(degreeName);
                                if (year) docYrs.push(year);
                            }
                        });
                    }

                    const hasEducationDegrees = relationalEdu || Array.isArray(d.education_degrees);
                    // Priority 3 (legacy text) is the fallback inside the ternary below
                    const bachelor_degree = hasEducationDegrees ? bacDegs.join('\n') : (d.bachelor_degree || '');
                    const bachelor_year = hasEducationDegrees ? bacYrs.join('\n') : (d.bachelor_year || '');
                    const master_degree = hasEducationDegrees ? masDegs.join('\n') : (d.master_degree || '');
                    const master_year = hasEducationDegrees ? masYrs.join('\n') : (d.master_year || '');
                    const doctorate_degree = hasEducationDegrees ? docDegs.join('\n') : (d.doctorate_degree || '');
                    const doctorate_year = hasEducationDegrees ? docYrs.join('\n') : (d.doctorate_year || '');

                    // ─────────────────────────────────────────────────────────────
                    // ELIGIBILITIES: Fallback chain
                    // Priority 1: d.eligibility_records (relational)
                    // Priority 2: d.eligibilities        (JSONB — existing)
                    // ─────────────────────────────────────────────────────────────
                    const formatDateStr = (val) => {
                        if (!val) return '';
                        if (typeof val === 'string') return val.split('T')[0];
                        if (val instanceof Date) return val.toISOString().split('T')[0];
                        return String(val).split('T')[0];
                    };

                    let resolvedEligibilities;
                    if (Array.isArray(d.eligibility_records) && d.eligibility_records.length > 0) {
                        // Map relational columns back to the frontend object shape
                        resolvedEligibilities = d.eligibility_records.map(rec => ({
                            id: rec.id,
                            eligibility: rec.eligibility_type,
                            date: formatDateStr(rec.conferment_date),
                            rating: rec.rating || '',
                            place_of_assignment: rec.place_of_assignment || '',
                            details: rec.details || ''
                        }));
                    } else {
                        // Priority 2: existing JSONB (preserved as-is)
                        resolvedEligibilities = d.eligibilities || [];
                    }

                    // ─────────────────────────────────────────────────────────────
                    // ACCOMPLISHMENTS: Fallback chain
                    // Priority 1: d.accomplishment_records (relational)
                    // Priority 2: d.individual_accomplishments (JSONB — existing)
                    // ─────────────────────────────────────────────────────────────
                    let resolvedAccomplishments;
                    if (Array.isArray(d.accomplishment_records) && d.accomplishment_records.length > 0) {
                        // Preserve the DB row id so save round-trips use UPDATE, not INSERT+DELETE
                        resolvedAccomplishments = d.accomplishment_records.map(rec => ({
                            id: rec.id,
                            description: rec.description || '',
                            award_year: rec.award_year || null,
                        }));
                    } else {
                        resolvedAccomplishments = d.individual_accomplishments || [];
                    }

                    // ─────────────────────────────────────────────────────────────
                    // OTHER COURSES: Fallback chain
                    // Priority 1: d.other_course_records (relational)
                    // Priority 2: d.other_courses         (JSONB — existing)
                    // ─────────────────────────────────────────────────────────────
                    let resolvedOtherCourses;
                    if (Array.isArray(d.other_course_records) && d.other_course_records.length > 0) {
                        // Map relational columns back to frontend shape: { course, date_from, date_to, details }
                        resolvedOtherCourses = d.other_course_records.map(rec => ({
                            id: rec.id,
                            course: rec.course_title || '',
                            date_from: formatDateStr(rec.date_from),
                            date_to: formatDateStr(rec.date_to),
                            details: rec.details || ''
                        }));
                    } else {
                        resolvedOtherCourses = d.other_courses || [];
                    }

                    const rawSuffix = d.suffix || '';
                    const isNA = isSuffixPlaceholder(rawSuffix);
                    setIsSuffixNA(isNA);

                    setProfile({
                        email: d.email || user?.email || '',
                        last_name: d.last_name || '',
                        first_name: d.first_name || '',
                        middle_name: d.middle_name || '',
                        suffix: isNA ? '' : rawSuffix,
                        gender: d.gender || '',
                        date_of_birth: formatDateStr(d.date_of_birth),
                        age: d.age ?? '',
                        civil_status: d.civil_status || '',
                        employment_status: d.employment_status || '',
                        position_title: d.position_title || '',
                        designation: d.designation || '',
                        region: d.region || '',
                        division: d.division || '',
                        office: d.office || '',
                        strand: d.strand || '',
                        is_oic: (d.designation && typeof d.designation === 'string' && d.designation.toUpperCase().includes('OIC')) ? true : (d.is_oic ?? false),
                        appointment_date: formatDateStr(d.appointment_date),
                        emt_passer: d.emt_passer ?? null,
                        emt_date: formatDateStr(d.emt_date),
                        ces_stage: d.ces_stage || '',
                        ces_conferment_date: formatDateStr(d.ces_conferment_date),
                        total_years_third_level: d.total_years_third_level ?? '',
                        permanent_address: d.permanent_address || '',
                        temporary_address: d.temporary_address || '',
                        highest_education: d.highest_education || '',
                        specific_degree: d.specific_degree || '',
                        education_program: d.education_program || '',
                        education_year_graduated: d.education_year_graduated ?? '',
                        bachelor_degree,
                        bachelor_year,
                        master_degree,
                        master_year,
                        doctorate_degree,
                        doctorate_year,
                        education_degrees: d.education_degrees || [],
                        notable_achievements: (() => {
                            if (Array.isArray(d.notable_achievements)) return d.notable_achievements;
                            if (typeof d.notable_achievements === 'string' && d.notable_achievements.trim().startsWith('[')) {
                                try { return JSON.parse(d.notable_achievements); } catch (e) { return []; }
                            }
                            if (typeof d.notable_achievements === 'string' && d.notable_achievements) {
                                const titles = d.notable_achievements.split('\n');
                                const years = (d.notable_achievements_year || '').split('\n');
                                return titles.map((t, idx) => ({ title: t, year: years[idx] || '' }));
                            }
                            return [];
                        })(),
                        // Fallback chain applied above: relational → JSONB
                        eligibilities: resolvedEligibilities,
                        other_courses: resolvedOtherCourses,
                        individual_accomplishments: resolvedAccomplishments,
                        performance_rating_1: d.performance_rating_1 || '',
                        performance_rating_1_period: d.performance_rating_1_period || '',
                        performance_rating_2: d.performance_rating_2 || '',
                        performance_rating_2_period: d.performance_rating_2_period || '',
                        performance_rating_3: d.performance_rating_3 || '',
                        performance_rating_3_period: d.performance_rating_3_period || '',
                        cespes_1_rating: d.cespes_1_rating || '',
                        cespes_2_rating: d.cespes_2_rating || '',
                        cespes_rating_1_period: d.cespes_rating_1_period || '',
                        cespes_rating_2_period: d.cespes_rating_2_period || '',
                        managerial_experience_total: d.managerial_experience_total || '',
                        pending_admin_case: d.pending_admin_case || '',
                        guilty_admin_details: d.guilty_admin_details || '',
                        criminally_charged_details: d.criminally_charged_details || '',
                        convicted_crime_details: d.convicted_crime_details || '',
                        alt_email_1: d.alt_email_1 || '',
                        alt_email_2: d.alt_email_2 || '',
                        alt_contact_details_1: d.alt_contact_details_1 || d.contact_details || '',
                        alt_contact_details_2: d.alt_contact_details_2 || '',
                        contact_details: d.contact_details || d.alt_contact_details_1 || '',
                        photo_binary_id: d.photo_binary_id || null,
                        pds_binary_id: d.pds_binary_id || null,
                        profile_word_binary_id: d.profile_word_binary_id || null,
                        profile_ppt_binary_id: d.profile_ppt_binary_id || null,
                        service_records_binary_id: d.service_records_binary_id || null,
                        sandiganbayan_clearance_binary_id: d.sandiganbayan_clearance_binary_id || null,
                        nbi_clearance_binary_id: d.nbi_clearance_binary_id || null,
                        csc_clearance_binary_id: d.csc_clearance_binary_id || null,
                        ombudsman_clearance_binary_id: d.ombudsman_clearance_binary_id || null,
                        executive_summary_binary_id: d.executive_summary_binary_id || null,
                        dpa_consented_at: d.dpa_consented_at || null,
                        updated_at: d.updated_at || null,
                    });

                    // POSITIONS: Fallback chain
                    // Priority 1: d.position_history (relational)
                    // Priority 2: d.previous_positions (JSONB — existing)
                    let resolvedPrevPositions;
                    if (Array.isArray(d.position_history) && d.position_history.length > 0) {
                        // Map relational columns back to frontend shape
                        resolvedPrevPositions = d.position_history.map(rec => {
                            const startDate = formatDateStr(rec.inclusive_date_start);
                            const endDate = formatDateStr(rec.inclusive_date_end);
                            const isCurrent = Boolean(
                                rec.is_current === true ||
                                rec.is_current === 'true' ||
                                rec.is_current === 1 ||
                                rec.status === 'Active' ||
                                (!endDate && Boolean(startDate))
                            );
                            return {
                                id: rec.id,
                                position_name: rec.position_name || '',
                                office: rec.office || rec.division || '',
                                division: rec.division || '',
                                strand: rec.strand || '',
                                region: rec.region || '',
                                designation: rec.designation || '',
                                start_date: startDate,
                                end_date: isCurrent ? '' : endDate,
                                is_current: isCurrent,
                                oic_positions: (rec.oic_positions || []).map(o => {
                                    const oicStart = formatDateStr(o.oic_start_date);
                                    const oicEnd = formatDateStr(o.oic_end_date);
                                    const oicIsCurrent = Boolean(
                                        o.is_current === true ||
                                        o.is_current === 'true' ||
                                        o.is_current === 1 ||
                                        (!oicEnd && Boolean(oicStart))
                                    );
                                    return {
                                        ...o,
                                        oic_start_date: oicStart,
                                        oic_end_date: oicIsCurrent ? '' : oicEnd,
                                        is_current: oicIsCurrent
                                    };
                                }),
                                status: isCurrent ? 'Active' : (rec.status || 'Inactive'),
                                oic: Boolean(rec.oic ?? false),
                                is_oic: Boolean(rec.oic ?? false)
                            };
                        });
                    } else {
                        resolvedPrevPositions = (d.previous_positions || []).map(p => {
                            const startDate = formatDateStr(p.start_date || p.inclusive_date_start);
                            const endDate = formatDateStr(p.end_date || p.inclusive_date_end);
                            const isCurrent = Boolean(
                                p.is_current === true ||
                                p.is_current === 'true' ||
                                p.is_current === 1 ||
                                p.status === 'Active' ||
                                (!endDate && Boolean(startDate))
                            );
                            return {
                                ...p,
                                office: p.office || p.division || '',
                                region: p.region || '',
                                designation: p.designation || '',
                                start_date: startDate,
                                end_date: isCurrent ? '' : endDate,
                                is_current: isCurrent,
                                oic_positions: (p.oic_positions || []).map(o => {
                                    const oicStart = formatDateStr(o.oic_start_date);
                                    const oicEnd = formatDateStr(o.oic_end_date);
                                    const oicIsCurrent = Boolean(
                                        o.is_current === true ||
                                        o.is_current === 'true' ||
                                        o.is_current === 1 ||
                                        (!oicEnd && Boolean(oicStart))
                                    );
                                    return {
                                        ...o,
                                        oic_start_date: oicStart,
                                        oic_end_date: oicIsCurrent ? '' : oicEnd,
                                        is_current: oicIsCurrent
                                    };
                                }),
                                status: isCurrent ? 'Active' : (p.status || 'Inactive'),
                                oic: Boolean(p.oic ?? p.is_oic ?? false),
                                is_oic: Boolean(p.oic ?? p.is_oic ?? false)
                            };
                        });
                    }

                    // TRAININGS: Fallback chain
                    // Priority 1: d.training_records (relational)
                    // Priority 2: d.relevant_trainings (JSONB — existing)
                    let resolvedTrainings;
                    if (Array.isArray(d.training_records) && d.training_records.length > 0) {
                        resolvedTrainings = d.training_records.map(rec => {
                            const dateFrom = formatDateStr(rec.inclusive_date_start);
                            const dateTo = formatDateStr(rec.inclusive_date_end);
                            let hours = rec.hours != null ? String(rec.hours) : '';
                            let hours_per_day = '8';

                            // Auto-compute hours from date range if hours is missing or zero
                            if ((!hours || hours === '0') && dateFrom && dateTo) {
                                const d1 = new Date(dateFrom);
                                const d2 = new Date(dateTo);
                                if (!isNaN(d1) && !isNaN(d2) && d1 <= d2) {
                                    const diffDays = Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
                                    hours = String(diffDays * 8);
                                    hours_per_day = '8';
                                }
                            } else if (hours && hours !== '0' && dateFrom && dateTo) {
                                // Back-compute hours_per_day from stored hours + date range
                                const d1 = new Date(dateFrom);
                                const d2 = new Date(dateTo);
                                if (!isNaN(d1) && !isNaN(d2) && d1 <= d2) {
                                    const diffDays = Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
                                    const derivedHpd = parseFloat(hours) / diffDays;
                                    if ([2, 4, 8].includes(Math.round(derivedHpd))) {
                                        hours_per_day = String(Math.round(derivedHpd));
                                    }
                                }
                            }

                            return {
                                id: rec.id,
                                training_name: rec.training_name || '',
                                date_from: dateFrom,
                                date_to: dateTo,
                                conducted_by: rec.conducted_by || '',
                                hours,
                                hours_per_day,
                            };
                        });
                    } else {
                        resolvedTrainings = d.relevant_trainings || [];
                    }

                    setPrevPositions(resolvedPrevPositions);
                    setTrainings(resolvedTrainings);

                    if (d.dpa_consented_at) {
                        setCertified(true);
                        setDpaConsent(true);
                        setTruthConsent(true);
                    }

                    setStatus('found');
                }
            } else {
                if (user?.email) {
                    handleInitializeRecord();
                } else {
                    setStatus('error');
                }
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
                    first_name: user.firstName || user.first_name || '',
                    last_name: user.lastName || user.last_name || '',
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

    const setP = (field, value) => {
        const skipFields = new Set([
            'email', 'alt_email_1', 'alt_email_2', 'suffix',
            'photo_binary_id', 'pds_binary_id', 'profile_word_binary_id', 'profile_ppt_binary_id', 'service_records_binary_id',
            'sandiganbayan_clearance_binary_id', 'nbi_clearance_binary_id', 'csc_clearance_binary_id', 'ombudsman_clearance_binary_id', 'executive_summary_binary_id',
            'target_TLOid', 'application_status', 'profiling_status', 'is_oic',
            'pending_admin_case', 'guilty_admin_details', 'criminally_charged_details', 'convicted_crime_details', 'ces_stage', 'gender', 'civil_status', 'employment_status'
        ]);
        let finalValue = value;
        if (typeof value === 'string' && !skipFields.has(field)) {
            finalValue = toUpper(value);
        }
        setProfile(p => ({ ...p, [field]: finalValue }));
    };
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

        // 3b. Degree Year Ordering
        const bacY = (profile.bachelor_year || '').split('\n').map(y => parseInt(y)).filter(y => !isNaN(y));
        const masY = (profile.master_year || '').split('\n').map(y => parseInt(y)).filter(y => !isNaN(y));
        const docY = (profile.doctorate_year || '').split('\n').map(y => parseInt(y)).filter(y => !isNaN(y));

        const maxBac = bacY.length > 0 ? Math.max(...bacY) : 0;
        const maxMas = masY.length > 0 ? Math.max(...masY) : 0;

        if (maxBac > 0 && masY.some(m => m <= maxBac)) {
            Swal.fire('Validation Error', 'Master\'s Degree year must be strictly greater than Bachelor\'s Degree year.', 'error');
            return false;
        }
        if (maxMas > 0 && docY.some(d => d <= maxMas)) {
            Swal.fire('Validation Error', 'Doctorate year must be strictly greater than Master\'s Degree year.', 'error');
            return false;
        }

        // 3c. Rating Period Validation
        const currentMonth = new Date().toISOString().substring(0, 7);
        if (profile.performance_rating_1_period && profile.performance_rating_1_period > currentMonth) {
            Swal.fire('Validation Error', 'Latest Performance Rating period cannot be in the future.', 'error');
            return false;
        }
        if (profile.performance_rating_2_period && profile.performance_rating_2_period > currentMonth) {
            Swal.fire('Validation Error', 'Previous Performance Rating period cannot be in the future.', 'error');
            return false;
        }
        if (profile.performance_rating_3_period && profile.performance_rating_3_period > currentMonth) {
            Swal.fire('Validation Error', 'Oldest Performance Rating period cannot be in the future.', 'error');
            return false;
        }
        if (profile.performance_rating_3_period && profile.performance_rating_2_period && profile.performance_rating_3_period > profile.performance_rating_2_period) {
            Swal.fire('Validation Error', 'Previous Rating period cannot be earlier than Oldest Rating period.', 'error');
            return false;
        }
        if (profile.performance_rating_2_period && profile.performance_rating_1_period && profile.performance_rating_2_period > profile.performance_rating_1_period) {
            Swal.fire('Validation Error', 'Latest Rating period cannot be earlier than Previous Rating period.', 'error');
            return false;
        }

        if (profile.cespes_rating_1_period && profile.cespes_rating_1_period > currentMonth) {
            Swal.fire('Validation Error', 'CESPES 1st Semester period cannot be in the future.', 'error');
            return false;
        }
        if (profile.cespes_rating_2_period && profile.cespes_rating_2_period > currentMonth) {
            Swal.fire('Validation Error', 'CESPES 2nd Semester period cannot be in the future.', 'error');
            return false;
        }
        if (profile.cespes_rating_1_period && profile.cespes_rating_2_period && profile.cespes_rating_1_period > profile.cespes_rating_2_period) {
            Swal.fire('Validation Error', 'CESPES 2nd Semester period cannot be earlier than 1st Semester period.', 'error');
            return false;
        }

        // 4. Date Ranges
        const validateRange = (from, to, ctx) => {
            if (from && to) {
                const d1 = new Date(from);
                const d2 = new Date(to);
                if (d2 <= d1) {
                    Swal.fire('Validation Error', `In ${ctx}: To Date must be after From Date.`, 'error');
                    return false;
                }
            }
            return true;
        };

        for (let i = 0; i < prevPositions.length; i++) {
            const p = prevPositions[i];
            if (!validateRange(p.start_date, p.end_date, `Managerial Experience #${i + 1}`)) return false;
            if (p.oic_positions) {
                for (let j = 0; j < p.oic_positions.length; j++) {
                    const oic = p.oic_positions[j];
                    if (!validateRange(oic.oic_start_date, oic.oic_end_date, `Managerial Experience #${i + 1} (OIC #${j + 1})`)) return false;
                }
            }
        }

        for (let i = 0; i < trainings.length; i++) {
            const t = trainings[i];
            if (!validateRange(t.date_from, t.date_to, `Relevant Training #${i + 1}`)) return false;
        }

        if (profile.other_courses && profile.other_courses.length > 0) {
            for (let i = 0; i < profile.other_courses.length; i++) {
                const c = profile.other_courses[i];
                if (!validateRange(c.date_from, c.date_to, `Other Training/Course #${i + 1}`)) return false;
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
            const cleanOIC = (oics) => (oics || [])
                .filter(o => o.oic_position_name?.trim() || o.oic_office?.trim() || o.oic_start_date?.trim() || o.oic_end_date?.trim() || o.is_current)
                .map(o => ({
                    ...o,
                    is_current: Boolean(o.is_current),
                    oic_end_date: o.is_current ? '' : (o.oic_end_date || '')
                }));
            const cleanPrevPositions = prevPositions
                .map(p => ({
                    ...p,
                    is_current: Boolean(p.is_current),
                    status: p.is_current ? 'Active' : (p.status === 'Active' ? 'Inactive' : (p.status || 'Inactive')),
                    end_date: p.is_current ? '' : (p.end_date || ''),
                    oic_positions: cleanOIC(p.oic_positions)
                }))
                .filter(p => p.position_name?.trim() || p.office?.trim() || p.start_date?.trim() || p.end_date?.trim() || p.is_current || p.oic_positions.length > 0);

            const cleanTrainings = trainings.filter(t => t.training_name?.trim() || t.date_from?.trim() || t.date_to?.trim()).map(t => ({
                ...t,
                training_name: t.training_name ? t.training_name.toUpperCase() : ''
            }));

            const degreesList = [];

            const bacDegrees = (profile.bachelor_degree || '').split('\n');
            const bacYears = (profile.bachelor_year || '').split('\n');
            const bacCount = Math.max(bacDegrees.length, bacYears.length);
            for (let i = 0; i < bacCount; i++) {
                const deg = (bacDegrees[i] || '').trim();
                const yr = (bacYears[i] || '').trim();
                if (deg || yr) {
                    degreesList.push({
                        highest_education: "BACCALAUREATE / BACHELOR'S DEGREE",
                        specific_degree: deg,
                        education_program: deg,
                        education_year_graduated: yr
                    });
                }
            }

            const masDegrees = (profile.master_degree || '').split('\n');
            const masYears = (profile.master_year || '').split('\n');
            const masCount = Math.max(masDegrees.length, masYears.length);
            for (let i = 0; i < masCount; i++) {
                const deg = (masDegrees[i] || '').trim();
                const yr = (masYears[i] || '').trim();
                if (deg || yr) {
                    degreesList.push({
                        highest_education: "MASTER'S DEGREE",
                        specific_degree: deg,
                        education_program: deg,
                        education_year_graduated: yr
                    });
                }
            }

            const docDegrees = (profile.doctorate_degree || '').split('\n');
            const docYears = (profile.doctorate_year || '').split('\n');
            const docCount = Math.max(docDegrees.length, docYears.length);
            for (let i = 0; i < docCount; i++) {
                const deg = (docDegrees[i] || '').trim();
                const yr = (docYears[i] || '').trim();
                if (deg || yr) {
                    degreesList.push({
                        highest_education: "DOCTORATE",
                        specific_degree: deg,
                        education_program: deg,
                        education_year_graduated: yr
                    });
                }
            }

            const payload = {
                ...profile,
                suffix: (isSuffixNA || isSuffixPlaceholder(profile.suffix)) ? '' : (profile.suffix || '').trim(),
                contact_details: profile.alt_contact_details_1 || profile.contact_details || '',
                previous_positions: cleanPrevPositions,
                relevant_trainings: cleanTrainings,
                education_degrees: degreesList,
                target_TLOid: targetVacancyId,
                position_applied_for: targetVacancy ? targetVacancy.position_title : profile.position_applied_for,
                profiling_status: completeness === 100 ? 'profiling completed' : 'profiling',
                applyToVerifiedRoles: Boolean(applyToVerifiedRoles)
            };

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
                setProfile(prev => ({ ...prev, education_degrees: degreesList }));
                if (data.data && Array.isArray(data.data.position_history)) {
                    const mapped = data.data.position_history.map(rec => {
                        const startDate = formatDateStr(rec.inclusive_date_start);
                        const endDate = formatDateStr(rec.inclusive_date_end);
                        const isCurrent = Boolean(
                            rec.is_current === true ||
                            rec.is_current === 'true' ||
                            rec.is_current === 1 ||
                            rec.status === 'Active' ||
                            (!endDate && Boolean(startDate))
                        );
                        return {
                            id: rec.id,
                            position_name: rec.position_name || '',
                            office: rec.office || rec.division || '',
                            division: rec.division || '',
                            strand: rec.strand || '',
                            region: rec.region || '',
                            designation: rec.designation || '',
                            start_date: startDate,
                            end_date: isCurrent ? '' : endDate,
                            is_current: isCurrent,
                            oic_positions: (rec.oic_positions || []).map(o => {
                                const oicStart = formatDateStr(o.oic_start_date);
                                const oicEnd = formatDateStr(o.oic_end_date);
                                const oicIsCurrent = Boolean(
                                    o.is_current === true ||
                                    o.is_current === 'true' ||
                                    o.is_current === 1 ||
                                    (!oicEnd && Boolean(oicStart))
                                );
                                return {
                                    ...o,
                                    oic_start_date: oicStart,
                                    oic_end_date: oicIsCurrent ? '' : oicEnd,
                                    is_current: oicIsCurrent
                                };
                            }),
                            status: isCurrent ? 'Active' : (rec.status || 'Inactive'),
                            oic: Boolean(rec.oic ?? false),
                            is_oic: Boolean(rec.oic ?? false)
                        };
                    });
                    setPrevPositions(mapped);
                }
                if (TLOid) {
                    fetchHistory(TLOid);
                }
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
            const consentTimestamp = new Date().toISOString();
            const res = await fetch(apiUrl(`/api/third-level/${TLOid}/profile`), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token || localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    dpa_consented_at: consentTimestamp,
                    applyToVerifiedRoles: Boolean(applyToVerifiedRoles)
                })
            });
            const data = await res.json();
            if (data.success) {
                setCertified(true);
                setDpaConsent(true);
                setTruthConsent(true);
                setProfile(prev => ({ ...prev, dpa_consented_at: consentTimestamp }));
                if (thenNavigate) setTab('summary');
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

    const fetchPositionsList = async () => {
        try {
            const res = await fetch(apiUrl('/api/third-level/positions'), {
                headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success) {
                const validPositions = (data.positions || []).filter(p => {
                    const upper = p.toUpperCase();
                    return upper !== 'N/A' && upper !== 'NA' && upper !== 'OTHERS' && !/\bOIC\b/i.test(upper);
                });
                setPositionsList(validPositions);

                const validDesignations = (data.designations || []).filter(d => {
                    const upper = d.toUpperCase();
                    return upper !== 'N/A' && upper !== 'NA' && upper !== 'OTHERS' && !/\bOIC\b/i.test(upper);
                });
                setDesignationsList(validDesignations);

                if (Array.isArray(data.tlo_positions) && data.tlo_positions.length > 0) {
                    setTloPositions(data.tlo_positions);
                }
                if (Array.isArray(data.regions)) setRegionsList(data.regions);
                if (data.regionDivisions && typeof data.regionDivisions === 'object') setRegionDivisions(data.regionDivisions);
                if (Array.isArray(data.divisions)) setDivisionsList(data.divisions);
            }
        } catch (err) {
            console.error('Failed to fetch positions:', err);
        }
    };

    useEffect(() => {
        fetchVacancies();
        fetchPositionsList();
    }, []);

    const defaultPositions = [
        'Undersecretary',
        'Assistant Secretary',
        'Director IV',
        'Director III',
        'Chief Administrative Officer'
    ];

    // Merge positions and designations case-insensitively
    const positionMap = new Map();
    const addPos = (p) => {
        if (!p) return;
        const up = p.toUpperCase();
        const existing = positionMap.get(up);
        if (!existing) {
            positionMap.set(up, p);
        } else if (existing === up && p !== up) {
            // Replace all-uppercase version with mixed-case/title-case version
            positionMap.set(up, p);
        }
    };

    positionsList.forEach(addPos);
    designationsList.forEach(addPos);

    if (positionMap.size === 0) {
        defaultPositions.forEach(addPos);
    }

    const unifiedList = Array.from(positionMap.values()).sort();

    const availableDivisions = React.useMemo(() => {
        if (profile.region && profile.region.trim().toUpperCase() === 'CENTRAL OFFICE') {
            const coDivs = (regionDivisions?.['Central Office'] || regionDivisions?.['CENTRAL OFFICE'] || ['Central Office']);
            return coDivs.length > 0 ? coDivs : ['Central Office'];
        }

        let rawList = divisionsList || [];
        if (profile.region && regionDivisions) {
            const regionKey = Object.keys(regionDivisions).find(k => k.trim().toUpperCase() === profile.region.trim().toUpperCase());
            if (regionKey && Array.isArray(regionDivisions[regionKey])) {
                rawList = regionDivisions[regionKey];
            } else {
                rawList = [];
            }
        }

        return rawList.filter(d => {
            if (!d) return false;
            const up = String(d).trim().toUpperCase();
            if (profile.region && up === profile.region.trim().toUpperCase()) return false;
            if ((regionsList || []).some(r => r.toUpperCase() !== 'CENTRAL OFFICE' && r.toUpperCase() === up)) return false;
            return !/^REGION\s+/i.test(up) && up !== 'REGIONAL OFFICE' && up !== 'N/A';
        });
    }, [profile.region, regionDivisions, divisionsList, regionsList]);

    const isPositionOthers = profile.position_title?.toUpperCase() === 'OTHERS' || (profile.position_title && !unifiedList.some(u => u.toUpperCase() === profile.position_title.toUpperCase()));
    const isDesignationOthers = profile.designation?.toUpperCase() === 'OTHERS' || (profile.designation && !unifiedList.some(u => u.toUpperCase() === profile.designation.toUpperCase()));

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

        if (docType === 'photo') {
            if (!file.type.startsWith('image/')) {
                Swal.fire('Notice', 'Please upload a valid image file (PNG, JPG) for the ID Picture.', 'info');
                return;
            }


        }

        setUploadingDocs(prev => ({ ...prev, [docType]: true }));
        try {
            let fileToUpload = file;

            // Compress 2x2 ID Picture
            if (docType === 'photo') {
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
                    'service_records': 'service_records_binary_id',
                    'sandiganbayan_clearance': 'sandiganbayan_clearance_binary_id',
                    'nbi_clearance': 'nbi_clearance_binary_id',
                    'csc_clearance': 'csc_clearance_binary_id',
                    'ombudsman_clearance': 'ombudsman_clearance_binary_id',
                    'executive_summary': 'executive_summary_binary_id'
                };
                setP(docMap[docType], data.binary_id);
                setUploadedFileNames(prev => ({ ...prev, [docType]: file.name }));
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

    const handleViewDocument = (binaryId) => {
        window.open(apiUrl(`/api/binary/${binaryId}`), '_blank');
    };

    const handleEditToggle = () => {
        if (!isEditing) {
            Swal.fire({
                title: 'Edit Profile',
                text: 'Are you sure you want to edit profile info?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#eab308',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Yes, edit profile'
            }).then((result) => {
                if (result.isConfirmed) {
                    setIsEditing(true);
                }
            });
        } else {
            setIsEditing(false);
        }
    };

    const handleDownloadDocument = async (binaryId, label) => {
        try {
            Swal.fire({ title: 'Downloading...', text: 'Please wait while we fetch the document.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const res = await fetch(apiUrl(`/api/binary/${binaryId}`), {
                headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
            });
            if (!res.ok) throw new Error('Failed to download document');

            let filename = '';
            const disposition = res.headers.get('Content-Disposition');
            if (disposition && disposition.indexOf('filename=') !== -1) {
                const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
                if (matches != null && matches[1]) filename = matches[1].replace(/['"]/g, '');
            }

            const blob = await res.blob();
            if (!filename) {
                let ext = '';
                if (blob.type === 'application/pdf') ext = '.pdf';
                else if (blob.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') ext = '.docx';
                else if (blob.type === 'application/msword') ext = '.doc';
                else if (blob.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') ext = '.pptx';
                else if (blob.type === 'application/vnd.ms-powerpoint') ext = '.ppt';
                else if (blob.type.startsWith('image/')) ext = '.' + blob.type.split('/')[1];

                const safeLabel = label.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').toLowerCase();
                const name = buildFullName(profile).replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
                filename = `${name}_${safeLabel}${ext}`;
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            Swal.close();
        } catch (err) {
            Swal.fire('Error', 'Could not download the document.', 'error');
        }
    };

    const handleAddPosition = () => setPrevPositions(p => [...p, { position_id: `tmp-${Date.now()}`, position_name: '', designation: '', office: '', division: '', region: '', start_date: '', end_date: '', status: 'Inactive', oic: false, is_oic: false, isNew: true }]);
    const handleRemovePosition = (idxToRemove) => {
        setPrevPositions(p => p.filter((_, idx) => idx !== idxToRemove));
    };

    const handleAddTraining = () => setTrainings(t => [...t, { training_id: `tmp-${Date.now()}`, training_name: '', date_from: '', date_to: '', hours_per_day: '8', hours: '', isNew: true }]);
    const handleRemoveTraining = (idxToRemove) => {
        setTrainings(t => t.filter((_, idx) => idx !== idxToRemove));
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
            <div className="min-h-screen flex items-center justify-center bg-transparent font-['Plus_Jakarta_Sans']">
                <div className="flex flex-col items-center gap-6">
                    <div className="w-14 h-14 border-[5px] border-[#0038A8] border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400 font-black uppercase tracking-[0.4em] text-[10px]">Loading Your Profile...</p>
                </div>
            </div>
        );
    }


    // ── MAIN PROFILING FORM ──
    return (
        <PageTransition>
            <div className="min-h-screen bg-transparent font-['Plus_Jakarta_Sans'] text-[#08315F] relative overflow-x-hidden lg:h-screen lg:flex lg:flex-col lg:overflow-hidden">
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
                                <div className="px-5 pt-5 pb-4 border-b-2 border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-[#08315F]/10 rounded-xl flex items-center justify-center text-[#08315F]">
                                            <FiUser size={20} />
                                        </div>
                                        <div>
                                            <p className="text-[21px] font-['Plus_Jakarta_Sans'] font-black text-[#08315F] leading-tight">Talent Portal</p>
                                            <p className="text-[15px] font-medium text-slate-400">Applicant Workspace</p>
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
                                    <p className="px-3 py-2 text-[13.5px] font-black text-slate-400 uppercase tracking-[0.2em]">Profile Sections</p>
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
                                                    className={`w-full flex items-center justify-between gap-3 px-3 py-3 rounded-xl text-left text-[18px] font-semibold transition-all
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

                {/* ── Disambiguation Modal for Confirmed Collision & Uncertain States ── */}
                <AnimatePresence>
                    {(isCollision || isUncertain) && !TLOid && disambiguationRecords.length > 0 && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                                className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full border-2 border-slate-200 shadow-2xl space-y-6 relative max-h-[90vh] flex flex-col"
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border-2 ${isCollision
                                        ? 'bg-rose-100 text-rose-700 border-rose-200'
                                        : 'bg-amber-100 text-amber-700 border-amber-200'
                                        }`}>
                                        {isCollision ? <FiAlertTriangle size={24} /> : <FiInfo size={24} />}
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                                            {isCollision
                                                ? 'Shared Email Detected: Identity Collision'
                                                : 'Shared Email Detected: Verification Required'}
                                        </h3>
                                        <p className={`text-[13.5px] font-bold uppercase tracking-wider mt-0.5 ${isCollision ? 'text-rose-600' : 'text-amber-600'
                                            }`}>
                                            {isCollision
                                                ? 'Distinct Officials Sharing Contact Email'
                                                : 'Inconclusive Identity Evidence — Strict Isolation'}
                                        </p>
                                    </div>
                                </div>

                                <div className={`p-4 rounded-2xl border-2 text-[14.5px] font-medium leading-relaxed ${isCollision
                                    ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                                    : 'bg-amber-50/80 border-amber-200 text-amber-900'
                                    }`}>
                                    {isCollision
                                        ? 'Affirmative contradictory evidence indicates that the records below represent different individuals. To prevent data corruption, cross-record synchronization is prohibited. Please select the specific official record to access.'
                                        : 'Identity evidence is incomplete or insufficient to safely determine whether the records below represent the same official. Records are strictly isolated. Please select the specific official role to access.'}
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                                    {disambiguationRecords.map(rec => (
                                        <div
                                            key={rec.TLOid}
                                            className="p-4 rounded-2xl border-2 border-slate-200 hover:border-[#0038A8] bg-slate-50/60 hover:bg-blue-50/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                        >
                                            <div className="space-y-1">
                                                <p className="text-[16.5px] font-black text-[#08315F]">
                                                    {[rec.first_name, rec.middle_name, rec.last_name].filter(Boolean).join(' ')}
                                                </p>
                                                <p className="text-[13.5px] font-bold text-slate-700">
                                                    {rec.position_title || 'No Position Title'}
                                                </p>
                                                <p className="text-[12px] text-slate-500 font-medium">
                                                    {[rec.office, rec.division, rec.region].filter(Boolean).join(' • ') || '—'}
                                                </p>
                                                <div className="flex items-center gap-2 pt-1">
                                                    <span className="text-[11px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                                                        TLOid: {rec.TLOid}
                                                    </span>
                                                    {rec.plantilla_item_no && (
                                                        <span className="text-[11px] font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-500">
                                                            Item: {rec.plantilla_item_no}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    lookupByEmail(rec.email, rec.TLOid);
                                                    const params = new URLSearchParams(window.location.search);
                                                    params.set('tloid', rec.TLOid);
                                                    navigate(`?${params.toString()}`, { replace: true });
                                                }}
                                                className="px-5 py-2.5 bg-[#08315F] hover:bg-blue-800 text-white font-black text-[13px] uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 shrink-0 flex items-center justify-center gap-2"
                                            >
                                                <span>Select Record</span>
                                                <FiArrowRight size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* ── Unified Premium Header Banner with Custom Accordion ── */}
                <div className={`bg-[#08315F] text-white relative overflow-hidden shadow-lg border-b-2 border-[#0038A8]/20 transition-all duration-300 ${isHeaderExpanded ? 'py-5 lg:py-6' : 'py-3.5'} px-6 lg:px-8 shrink-0`}>
                    <div className="absolute -top-[100%] right-[-10%] w-[50%] h-[300%] bg-[#075985] rounded-[100%] opacity-90 pointer-events-none transform rotate-12 z-0"></div>
                    <div className="max-w-[1400px] mx-auto flex flex-col relative z-10">
                        {/* Top Navigation Row (Always Visible) */}
                        <div className="flex justify-between items-center w-full min-h-[38px] gap-3">
                            {/* Left: Back Button & Compact Identity Summary (when collapsed) */}
                            <div className="flex items-center gap-3 md:gap-4 min-w-0">
                                <button
                                    onClick={() => navigate(-1)}
                                    className="flex items-center gap-2 text-slate-300 hover:text-white font-bold text-[14px] md:text-[15px] uppercase tracking-wider transition-all shrink-0 active:scale-95"
                                >
                                    <FiChevronLeft size={16} /> Back
                                </button>

                                {/* Compact Overview Pill (Displayed only when accordion is collapsed) */}
                                {!isHeaderExpanded && (
                                    <motion.div
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -8 }}
                                        transition={{ duration: 0.2 }}
                                        className="hidden sm:flex items-center gap-2.5 min-w-0 border-l border-white/20 pl-3 md:pl-4"
                                    >
                                        <div className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                                            {profile.photo_binary_id ? (
                                                <img src={apiUrl(`/api/binary/${profile.photo_binary_id}`)} alt="Profile" className="w-full h-full object-cover" />
                                            ) : (
                                                <FiUser size={14} className="text-white/70" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="font-black text-white text-[14px] md:text-[15px] truncate max-w-[160px] md:max-w-[220px] lg:max-w-[280px]">
                                                {fullName}
                                            </span>
                                            {TLOid && (
                                                <span className="px-2 py-0.5 rounded-full bg-[#075985] text-blue-200 text-[11px] font-mono font-bold tracking-wider shrink-0 border border-white/10">
                                                    {TLOid}
                                                </span>
                                            )}
                                            {profile.position_title && (
                                                <span className="hidden lg:inline text-blue-200/70 text-[12.5px] font-medium truncate max-w-[220px]">
                                                    • {profile.position_title}
                                                </span>
                                            )}
                                        </div>
                                        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/20 border border-white/10 text-[11px] font-black text-[#FCD116]">
                                            <span>{completeness}%</span>
                                            <span className="text-white/50 text-[9.5px] uppercase font-bold">Done</span>
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            {/* Right: Custom Accordion Toggle, Edit Profile, and Sign Out */}
                            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                {/* System Custom Accordion Toggle Button */}
                                <button
                                    type="button"
                                    onClick={toggleHeaderAccordion}
                                    className={`flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-full text-[12px] sm:text-[13px] font-black uppercase tracking-wider transition-all duration-200 border shadow-sm active:scale-95 group ${isHeaderExpanded
                                        ? 'bg-[#075985] hover:bg-[#0369a1] text-white border-white/25 shadow-md'
                                        : 'bg-[#FCD116] hover:bg-yellow-400 text-[#08315F] border-yellow-300 shadow-yellow-500/10'
                                        }`}
                                    title={isHeaderExpanded ? "Collapse header to maximize form view" : "Expand header to view full profile details"}
                                    aria-expanded={isHeaderExpanded}
                                >
                                    <span className={`w-2 h-2 rounded-full transition-transform group-hover:scale-125 ${isHeaderExpanded ? 'bg-blue-300' : 'bg-[#08315F]'}`} />
                                    <span className="hidden xs:inline">{isHeaderExpanded ? "Collapse Details" : "Profile Details"}</span>
                                    <span className="xs:hidden">{isHeaderExpanded ? "Less" : "Details"}</span>
                                    <FiChevronDown
                                        size={14}
                                        className={`transition-transform duration-300 ${isHeaderExpanded
                                            ? 'rotate-180 text-white group-hover:-translate-y-0.5'
                                            : 'rotate-0 text-[#08315F] group-hover:translate-y-0.5'
                                            }`}
                                    />
                                </button>

                                {!isTlo && (
                                    <button
                                        onClick={handleEditToggle}
                                        className={`px-4 sm:px-5 py-1.5 sm:py-2 font-bold rounded-full text-[13px] sm:text-[15px] uppercase tracking-widest transition-all hidden sm:block border ${!isEditing
                                            ? 'bg-yellow-500 text-yellow-950 hover:bg-yellow-400 border-yellow-600 shadow-md'
                                            : 'bg-blue-600/20 text-blue-300 hover:bg-blue-600/40 border-blue-500/30'
                                            }`}
                                    >
                                        {isEditing ? "Cancel Edit" : "Edit Profile"}
                                    </button>
                                )}

                                <button
                                    onClick={logout}
                                    className="flex items-center gap-1.5 sm:gap-2 text-slate-300 hover:text-red-400 font-bold text-[13px] sm:text-[15px] uppercase tracking-wider transition-all shrink-0 active:scale-95"
                                >
                                    <FiLock size={14} /> <span className="hidden sm:inline">Sign Out</span>
                                </button>
                            </div>
                        </div>

                        {!isTlo && (
                            <div className="sm:hidden flex items-center justify-end w-full mt-2">
                                <button
                                    onClick={handleEditToggle}
                                    className={`w-full py-1.5 font-bold rounded-full text-[13px] uppercase tracking-widest transition-all border ${!isEditing
                                        ? 'bg-yellow-500 text-yellow-950 hover:bg-yellow-400 border-yellow-600 shadow-md'
                                        : 'bg-blue-600/20 text-blue-300 hover:bg-blue-600/40 border-blue-500/30'
                                        }`}
                                >
                                    {isEditing ? "Cancel Edit" : "Edit Profile"}
                                </button>
                            </div>
                        )}

                        {/* ── Collapsible Accordion Content (Profile Info Row) ── */}
                        <AnimatePresence initial={false}>
                            {isHeaderExpanded && (
                                <motion.div
                                    key="header-profile-details"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.28, ease: [0.04, 0.62, 0.23, 0.98] }}
                                    className="overflow-hidden"
                                >
                                    <div className="pt-6 border-t border-white/10 mt-5">
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
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#FCD116] text-[#1a3a6e] text-[12px] md:text-[13.5px] font-black uppercase tracking-wider rounded-full shadow-sm">
                                                                <span className="w-1 h-1 bg-[#1a3a6e] rounded-full" />
                                                                {applicationStatus === 'under_review' ? 'In Review' : applicationStatus === 'approved' ? 'Approved' : applicationStatus === 'disapproved' ? 'Denied' : 'Draft'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {Array.isArray(activeAssignments) && activeAssignments.length > 0 ? (
                                                        activeAssignments.length === 1 ? (
                                                            <div className="mt-1 flex items-center gap-2 flex-wrap max-w-full">
                                                                <p className="text-white text-[16.5px] sm:text-[19px] md:text-[22px] font-black tracking-tight flex items-center gap-2 drop-shadow-sm flex-wrap leading-tight">
                                                                    <span className="break-words">{activeAssignments[0].position_title || profile.position_title || 'No position selected'}</span>
                                                                    {activeAssignments[0].designation && activeAssignments[0].designation !== activeAssignments[0].position_title && (
                                                                        <span className="text-blue-200/80 font-medium text-[14px] sm:text-[16px] md:text-[18px]">({activeAssignments[0].designation})</span>
                                                                    )}
                                                                </p>
                                                                {activeAssignments[0].capacity && (
                                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider leading-none shadow-sm flex items-center gap-1 shrink-0 ${activeAssignments[0].capacity.toUpperCase() === 'OIC'
                                                                            ? 'bg-[#FCD116] text-[#08315F] border border-yellow-300'
                                                                            : 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                                                                        }`}>
                                                                        <span className={`w-1.5 h-1.5 rounded-full ${activeAssignments[0].capacity.toUpperCase() === 'OIC' ? 'bg-[#08315F]' : 'bg-emerald-400'}`}></span>
                                                                        {activeAssignments[0].capacity}
                                                                    </span>
                                                                )}
                                                                {activeAssignments[0].salary_grade && (
                                                                    <span className="px-1.5 py-0.5 rounded-md text-[9.5px] sm:text-[10.5px] font-black bg-blue-500/25 text-blue-100 border border-blue-400/30 shrink-0">
                                                                        SG {activeAssignments[0].salary_grade}
                                                                    </span>
                                                                )}
                                                                {(activeAssignments[0].bureau || activeAssignments[0].division || activeAssignments[0].region) && (
                                                                    <span className="text-blue-200/75 text-[12px] sm:text-[13px] md:text-[14.5px] font-medium flex items-center gap-1.5">
                                                                        <span className="text-blue-300/40">•</span>
                                                                        <span className="break-words">{activeAssignments[0].bureau || activeAssignments[0].division || activeAssignments[0].region}</span>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="mt-1.5 flex flex-col gap-1.5 max-w-full">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] sm:text-[11px] font-black uppercase tracking-wider bg-[#FCD116]/15 text-[#FCD116] border border-[#FCD116]/40 shadow-sm">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-[#FCD116] animate-pulse"></span>
                                                                        {activeAssignments.length} Active Plantilla Positions
                                                                    </span>
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-2 pt-0.5 max-w-full">
                                                                    {activeAssignments.map((asg, idx) => {
                                                                        const isOic = asg.capacity && asg.capacity.toUpperCase() === 'OIC';
                                                                        return (
                                                                            <div
                                                                                key={asg.assignment_id || asg.id || idx}
                                                                                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/35 backdrop-blur-md transition-all shadow-sm group max-w-full flex-wrap sm:flex-nowrap"
                                                                            >
                                                                                <span className="text-white text-[13.5px] sm:text-[15px] md:text-[17px] font-black tracking-tight break-words">
                                                                                    {asg.position_title || asg.designation || 'Plantilla Position'}
                                                                                </span>
                                                                                {asg.capacity && (
                                                                                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] sm:text-[10.5px] font-black uppercase tracking-wider leading-none shadow-sm shrink-0 ${isOic
                                                                                            ? 'bg-[#FCD116] text-[#08315F] font-black border border-yellow-300'
                                                                                            : 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/30'
                                                                                        }`}>
                                                                                        {asg.capacity}
                                                                                    </span>
                                                                                )}
                                                                                {asg.salary_grade && (
                                                                                    <span className="px-1.5 py-0.5 rounded-md text-[9.5px] sm:text-[10px] font-black bg-blue-500/30 text-blue-100 border border-blue-400/30 shrink-0">
                                                                                        SG {asg.salary_grade}
                                                                                    </span>
                                                                                )}
                                                                                {(asg.bureau || asg.division || asg.region) && (
                                                                                    <span className="hidden sm:inline-block text-blue-200/80 text-[12px] font-medium border-l border-white/20 pl-2 max-w-[220px] truncate shrink-0" title={asg.bureau || asg.division || asg.region}>
                                                                                        {asg.bureau || asg.division || asg.region}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )
                                                    ) : (
                                                        <p className="text-blue-200/80 text-[16.5px] sm:text-[18px] md:text-[21px] font-medium mt-1 truncate flex items-center gap-2 flex-wrap">
                                                            <span>{profile.position_title || 'No position selected'}{(profile.designation && profile.designation !== profile.position_title) ? ` - ${profile.designation}` : ''}</span>
                                                            {profile.is_oic && <span className="px-1.5 py-0.5 rounded bg-[#FCD116] text-[#08315F] text-[11px] sm:text-[12px] font-black uppercase tracking-widest leading-none shrink-0">OIC</span>}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-blue-300/60 text-[13px] sm:text-[13.5px] md:text-[16.5px] font-medium max-w-full">
                                                        {isMultiRole && availableRoles.length > 1 ? (
                                                            <div className="relative inline-block max-w-full">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowRoleDropdown(prev => !prev)}
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FCD116] text-[#08315F] hover:bg-yellow-400 font-black text-[11.5px] sm:text-[12px] md:text-[13px] uppercase tracking-wider rounded-full shadow-md transition-all active:scale-95 border border-yellow-300 max-w-full"
                                                                    title="Switch between verified roles for this official"
                                                                >
                                                                    <span className="truncate">Active Role: {TLOid}</span>
                                                                    <span className="bg-[#08315F]/20 px-1.5 py-0.2 rounded text-[10.5px] sm:text-[11px] font-bold shrink-0">
                                                                        {availableRoles.findIndex(r => r.TLOid === TLOid) + 1} of {availableRoles.length}
                                                                    </span>
                                                                    <FiChevronDown size={14} className={`transition-transform duration-200 shrink-0 ${showRoleDropdown ? 'rotate-180' : ''}`} />
                                                                </button>

                                                                {showRoleDropdown && (
                                                                    <div className="absolute left-0 mt-2 w-[min(20rem,calc(100vw-2.5rem))] max-w-[calc(100vw-2.5rem)] bg-white text-slate-800 rounded-2xl shadow-2xl border-2 border-slate-200 z-50 p-2 overflow-hidden">
                                                                        <div className="px-3 py-2 border-b border-slate-100 mb-1">
                                                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Verified Multi-Role Official</p>
                                                                            <p className="text-[12.5px] font-bold text-[#08315F]">Select active role to view/edit:</p>
                                                                        </div>
                                                                        <div className="max-h-60 overflow-y-auto space-y-1">
                                                                            {availableRoles.map(role => {
                                                                                const isActive = role.TLOid === TLOid;
                                                                                return (
                                                                                    <button
                                                                                        key={role.TLOid}
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setShowRoleDropdown(false);
                                                                                            if (!isActive) {
                                                                                                lookupByEmail(urlEmail || profile.email, role.TLOid);
                                                                                                const params = new URLSearchParams(window.location.search);
                                                                                                params.set('tloid', role.TLOid);
                                                                                                navigate(`?${params.toString()}`, { replace: true });
                                                                                            }
                                                                                        }}
                                                                                        className={`w-full text-left p-2.5 rounded-xl transition-all flex flex-col gap-0.5 border ${isActive
                                                                                            ? 'bg-blue-50/90 border-[#0038A8]/30 shadow-sm'
                                                                                            : 'hover:bg-slate-50 border-transparent'
                                                                                            }`}
                                                                                    >
                                                                                        <div className="flex items-center justify-between">
                                                                                            <span className="font-black text-[13px] text-[#08315F] flex items-center gap-1.5">
                                                                                                {role.TLOid}
                                                                                                {role.is_oic && <span className="text-[10px] bg-amber-200 text-amber-900 px-1 rounded font-bold">OIC</span>}
                                                                                            </span>
                                                                                            {isActive && (
                                                                                                <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full">
                                                                                                    Current
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                        <p className="text-[12.5px] font-bold text-slate-700 truncate">
                                                                                            {role.position_title || 'No position title'}
                                                                                        </p>
                                                                                        <p className="text-[11px] text-slate-400 font-medium truncate">
                                                                                            {[role.office, role.division, role.region].filter(Boolean).join(' • ') || 'Central/Regional Office'}
                                                                                        </p>
                                                                                        {role.plantilla_item_no && (
                                                                                            <p className="text-[10.5px] font-mono text-slate-500 truncate">
                                                                                                Item: {role.plantilla_item_no}
                                                                                            </p>
                                                                                        )}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            TLOid && (
                                                                <span className="flex items-center gap-1">
                                                                    • {TLOid}
                                                                </span>
                                                            )
                                                        )}
                                                        {applicationId && (
                                                            <>
                                                                <span className="opacity-30">·</span>
                                                                <span className="flex items-center gap-1">
                                                                    APP-{String(applicationId).padStart(4, '0')}
                                                                </span>
                                                            </>
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
                                                    <p className="text-slate-400 text-[12px] font-black uppercase tracking-widest leading-none">Progress</p>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <p className="text-[#FCD116] font-black text-[27px] leading-none">{completeness}%</p>
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
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* ── Body Content ── */}
                <div className="w-full flex-1 flex flex-row lg:overflow-hidden bg-transparent">
                    {/* Sidebar (Desktop Only) */}
                    <aside className="hidden lg:flex flex-col bg-transparent border-r border-slate-200/80 w-[260px] h-full shrink-0 pt-6 overflow-hidden">
                        {/* Talent Portal Branding */}
                        <div className="px-5 pt-2 pb-4 border-b-2 border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#08315F]/10 rounded-xl flex items-center justify-center text-[#08315F]">
                                    <FiUser size={20} />
                                </div>
                                <div>
                                    <p className="text-[21px] font-['Plus_Jakarta_Sans'] font-black text-[#08315F] leading-tight">Talent Portal</p>
                                    <p className="text-[15px] font-medium text-slate-400">Applicant Workspace</p>
                                </div>
                            </div>
                        </div>
                        {/* Navigation */}
                        <div className="p-4 flex-1 overflow-y-auto thin-scrollbar">
                            <p className="px-3 py-2 text-[13.5px] font-bold text-slate-400 uppercase tracking-[0.2em]">Profile Sections</p>
                            <div className="space-y-1">
                                {TABS.filter(t => dataSource !== 'masterlist' || t.id !== 'application').map(t => {
                                    const isLocked = t.id === 'application' && completeness < 100;
                                    const active = tab === t.id;
                                    const completed = isTabCompleted(t.id);
                                    return (
                                        <React.Fragment key={t.id}>
                                            {t.id === 'application' && <div className="my-3 border-t-2 border-slate-100 mx-3" />}
                                            <button
                                                disabled={isLocked}
                                                onClick={() => !isLocked && setTab(t.id)}
                                                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left text-[16.5px] font-bold transition-all
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
                        <div className="lg:hidden flex flex-col gap-2.5 bg-white/90 backdrop-blur-md border-b-2 border-slate-200 p-3.5 shadow-sm shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-[#08315F]/10 flex items-center justify-center text-[#08315F]">
                                        {React.createElement(TABS.find(t => t.id === tab)?.icon || FiUser, { size: 16 })}
                                    </div>
                                    <div>
                                        <p className="text-[13.5px] font-bold text-slate-400 uppercase tracking-widest leading-none">Active Section</p>
                                        <p className="text-[18px] font-['Plus_Jakarta_Sans'] font-black text-[#08315F] uppercase tracking-wider mt-0.5">{TABS.find(t => t.id === tab)?.label}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsMobileMenuOpen(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#08315F]/10 hover:bg-[#08315F]/20 text-[#08315F] text-[18px] font-black rounded-lg transition-all border-2 border-[#0038A8]/10"
                                >
                                    <FiList size={14} /> Full Menu
                                </button>
                            </div>
                            {/* Mobile Section Selection Dropdown */}
                            <div className="w-full">
                                <select
                                    value={tab}
                                    onChange={(e) => setTab(e.target.value)}
                                    className="w-full p-2.5 bg-slate-50 border-2 border-slate-300 rounded-lg text-[18px] font-bold text-slate-800 focus:ring-2 focus:ring-[#0038A8] outline-none shadow-inner"
                                >
                                    {TABS.filter(t => dataSource !== 'masterlist' || t.id !== 'application').map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.label} {isTabCompleted(t.id) ? '✓' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Scrollable Form Area */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 bg-transparent pb-32 lg:pb-24">
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
                                                                    {/* CSC ID Upload */}
                                                                    <div className="w-full lg:w-[150px] shrink-0">
                                                                        <Field label="CSC Format ID Picture">
                                                                            <div className="relative group/upload w-full aspect-[3.5/4.5] max-w-[150px] mx-auto lg:mx-0 rounded-2xl border-2 border-dashed border-slate-300 bg-transparent hover:bg-slate-100 hover:border-[#0038A8] transition-all flex flex-col items-center justify-center overflow-hidden shadow-sm">
                                                                                <input disabled={!isEditing}
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
                                                                                        <img src={apiUrl(`/api/binary/${profile.photo_binary_id}`)} alt="CSC ID" className="w-full h-full object-cover" />
                                                                                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover/upload:opacity-100 transition-opacity flex flex-col items-center justify-center text-white z-0 backdrop-blur-sm">
                                                                                            <FiUpload size={20} className="mb-2" />
                                                                                            <span className="text-[13.5px] font-black uppercase tracking-widest text-center px-2">Change Photo</span>
                                                                                        </div>
                                                                                    </>
                                                                                ) : (
                                                                                    <div className="flex flex-col items-center justify-center p-4 text-slate-400 group-hover/upload:text-[#08315F] transition-colors">
                                                                                        <FiUpload size={24} className={uploadingDocs['photo'] ? 'animate-bounce' : 'mb-3'} />
                                                                                        <span className="text-[15px] font-black uppercase tracking-widest text-center leading-tight mt-1">
                                                                                            {uploadingDocs['photo'] ? 'Processing...' : 'Upload Photo'}
                                                                                        </span>
                                                                                        <span className="text-[12px] font-bold text-slate-400 italic mt-1.5 text-center">Passport size with handwritten name tag & signature</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </Field>
                                                                    </div>

                                                                    <div className="flex-1 w-full space-y-4">
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                                                                            <Field label="First Name"><input disabled={!isEditing} type="text" value={profile.first_name} onChange={e => setP('first_name', e.target.value)} className={inp} /></Field>
                                                                            <Field label="Last Name"><input disabled={!isEditing} type="text" value={profile.last_name} onChange={e => setP('last_name', e.target.value)} className={inp} /></Field>
                                                                            <Field label="Middle Name"><input disabled={!isEditing} type="text" value={profile.middle_name} onChange={e => setP('middle_name', e.target.value)} className={inp} /></Field>
                                                                            <Field label="Suffix">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <input
                                                                                        disabled={!isEditing || isSuffixNA}
                                                                                        type="text"
                                                                                        value={isSuffixNA ? '' : (profile.suffix || '')}
                                                                                        onChange={e => {
                                                                                            if (isSuffixNA) setIsSuffixNA(false);
                                                                                            setP('suffix', e.target.value);
                                                                                        }}
                                                                                        placeholder={isSuffixNA ? 'Not Applicable' : 'e.g. Jr., III'}
                                                                                        className={`${inp} ${isSuffixNA ? '!bg-slate-100/80 !text-slate-400 !cursor-not-allowed italic' : ''}`}
                                                                                    />
                                                                                    <button
                                                                                        type="button"
                                                                                        disabled={!isEditing}
                                                                                        onClick={() => {
                                                                                            const nextNA = !isSuffixNA;
                                                                                            setIsSuffixNA(nextNA);
                                                                                            if (nextNA) {
                                                                                                setP('suffix', '');
                                                                                            }
                                                                                        }}
                                                                                        title={isSuffixNA ? "Click to enable Suffix entry" : "Click to mark Suffix as Not Applicable"}
                                                                                        className={`h-[38px] px-2.5 rounded-lg text-[15px] font-black uppercase tracking-wider transition-all border-2 shrink-0 flex items-center justify-center select-none ${isSuffixNA
                                                                                            ? 'bg-[#08315F] text-white border-[#08315F] shadow-sm'
                                                                                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
                                                                                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                                                                                    >
                                                                                        N/A
                                                                                    </button>
                                                                                </div>
                                                                            </Field>
                                                                        </div>
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                                                                            <Field label="Gender">
                                                                                <select disabled={!isEditing} value={profile.gender} onChange={e => setP('gender', e.target.value)} className={sel}>
                                                                                    <option value="">Select</option>
                                                                                    <option value="MALE">Male</option>
                                                                                    <option value="FEMALE">Female</option>
                                                                                </select>
                                                                            </Field>
                                                                            <Field label="Date of Birth">
                                                                                <div className="relative">
                                                                                    <ModernDatePicker disabled={!isEditing} maxDate={new Date()} value={profile.date_of_birth} onChange={val => setProfile(p => ({ ...p, date_of_birth: val, age: computeAge(val) }))} className={inp} />
                                                                                </div>
                                                                            </Field>
                                                                            <Field label="Age (auto-computed)">
                                                                                <div className="w-full bg-transparent border-2 border-slate-200 rounded-lg py-2.5 px-4 text-[18px] font-semibold text-slate-500 min-h-[38px] flex items-center justify-center">
                                                                                    {profile.age || '—'}
                                                                                </div>
                                                                            </Field>
                                                                            <Field label="Civil Status">
                                                                                <select disabled={!isEditing} value={profile.civil_status} onChange={e => setP('civil_status', e.target.value)} className={sel}>
                                                                                    <option value="">Select</option>
                                                                                    {['SINGLE', 'MARRIED', 'WIDOWED', 'SEPARATED'].map(o => <option key={o} value={o}>{o.charAt(0) + o.slice(1).toLowerCase()}</option>)}
                                                                                </select>
                                                                            </Field>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* ── DESIGNATION & APPOINTMENT (Hidden per user request) ── */}
                                                            {false && (
                                                                <div className="border-t-2 border-slate-100 pt-8">
                                                                    <div className="flex items-center justify-between mb-4">
                                                                        <SectionLabel>Designation & Appointment</SectionLabel>
                                                                        <div className="flex items-center gap-2">
                                                                            {isLocationLocked ? (
                                                                                <button
                                                                                    type="button"
                                                                                    disabled={!isEditing}
                                                                                    onClick={() => setShowLocationUnlockModal(true)}
                                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 border-2 border-amber-200 rounded-xl text-[15px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
                                                                                >
                                                                                    <FiLock size={12} className="text-amber-600" /> Unlock Location
                                                                                </button>
                                                                            ) : (
                                                                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border-2 border-emerald-200 rounded-xl text-[15px] font-black uppercase tracking-wider">
                                                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                                                                    <FiUnlock size={12} className="text-emerald-600" /> Location Unlocked
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
                                                                        <Field label="Unique Number">
                                                                            <input disabled={!isEditing} type="text" value={TLOid || ''} readOnly className={`${inp} bg-slate-50 text-slate-500 cursor-not-allowed`} />
                                                                        </Field>
                                                                        <Field label="Employment Status">
                                                                            <select disabled={!isEditing} value={profile.employment_status || ''} onChange={e => setP('employment_status', e.target.value)} className={sel}>
                                                                                <option value="">Select Status</option>
                                                                                <option value="REGULAR">Regular</option>
                                                                                <option value="COTERMINOUS">Coterminous</option>
                                                                            </select>
                                                                        </Field>
                                                                        <Field label="Region">
                                                                            <div className="relative">
                                                                                <select
                                                                                    disabled={!isEditing || isLocationLocked}
                                                                                    value={profile.region || ''}
                                                                                    onChange={e => {
                                                                                        setP('region', e.target.value);
                                                                                        setP('division', '');
                                                                                    }}
                                                                                    className={`${sel} ${isLocationLocked ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' : ''}`}
                                                                                >
                                                                                    <option value="">Select Region</option>
                                                                                    {(regionsList || []).map(r => (
                                                                                        <option key={r} value={r}>{r}</option>
                                                                                    ))}
                                                                                    {profile.region && !(regionsList || []).includes(profile.region) && (
                                                                                        <option value={profile.region}>{profile.region}</option>
                                                                                    )}
                                                                                </select>
                                                                                {isLocationLocked && (
                                                                                    <FiLock className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
                                                                                )}
                                                                            </div>
                                                                        </Field>
                                                                        <Field label="Division">
                                                                            <div className="relative">
                                                                                <select
                                                                                    disabled={!isEditing || isLocationLocked || !profile.region}
                                                                                    value={profile.division || ''}
                                                                                    onChange={e => setP('division', e.target.value)}
                                                                                    className={`${sel} ${(isLocationLocked || !profile.region) ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' : ''}`}
                                                                                >
                                                                                    <option value="">{profile.region ? 'Select Division' : 'Select Region First'}</option>
                                                                                    {(availableDivisions || []).map(d => (
                                                                                        <option key={d} value={d}>{d}</option>
                                                                                    ))}
                                                                                    {profile.division && !(availableDivisions || []).includes(profile.division) && (
                                                                                        <option value={profile.division}>{profile.division}</option>
                                                                                    )}
                                                                                </select>
                                                                                {isLocationLocked && (
                                                                                    <FiLock className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
                                                                                )}
                                                                            </div>
                                                                        </Field>
                                                                        <Field label="Position Title (As per Appointment)">
                                                                            {isPositionOthers ? (
                                                                                <div className="relative flex items-center">
                                                                                    <input
                                                                                        disabled={!isEditing}
                                                                                        type="text"
                                                                                        value={profile.position_title?.toUpperCase() === 'OTHERS' ? '' : profile.position_title}
                                                                                        onChange={e => setP('position_title', e.target.value || 'Others')}
                                                                                        placeholder="Please specify position title"
                                                                                        className={`${inp} pr-9`}
                                                                                        autoFocus
                                                                                    />
                                                                                    <button
                                                                                        type="button"
                                                                                        disabled={!isEditing}
                                                                                        onClick={() => setP('position_title', '')}
                                                                                        className="absolute right-2.5 p-1 rounded-md text-slate-400 hover:text-[#08315F] hover:bg-slate-100 transition-colors"
                                                                                        title="Switch back to list selection"
                                                                                    >
                                                                                        <FiRotateCcw size={13} />
                                                                                    </button>
                                                                                </div>
                                                                            ) : (
                                                                                <select disabled={!isEditing} value={unifiedList.find(u => u.toUpperCase() === profile.position_title?.toUpperCase()) || profile.position_title || ''} onChange={e => setP('position_title', e.target.value)} className={sel}>
                                                                                    <option value="">Select Position Title</option>
                                                                                    {unifiedList.map(o => <option key={o} value={o}>{o}</option>)}
                                                                                    <option value="Others">Others</option>
                                                                                </select>
                                                                            )}
                                                                        </Field>
                                                                        <Field label="Designation">
                                                                            {profile.is_oic ? (
                                                                                isDesignationOthers ? (
                                                                                    <div className="relative flex items-center">
                                                                                        <input
                                                                                            disabled={!isEditing}
                                                                                            type="text"
                                                                                            value={profile.designation?.toUpperCase() === 'OTHERS' ? '' : profile.designation}
                                                                                            onChange={e => setP('designation', e.target.value || 'Others')}
                                                                                            placeholder="Please specify designation"
                                                                                            className={`${inp} pr-9`}
                                                                                            autoFocus
                                                                                        />
                                                                                        <button
                                                                                            type="button"
                                                                                            disabled={!isEditing}
                                                                                            onClick={() => setP('designation', '')}
                                                                                            className="absolute right-2.5 p-1 rounded-md text-slate-400 hover:text-[#08315F] hover:bg-slate-100 transition-colors"
                                                                                            title="Switch back to list selection"
                                                                                        >
                                                                                            <FiRotateCcw size={13} />
                                                                                        </button>
                                                                                    </div>
                                                                                ) : (
                                                                                    <select disabled={!isEditing} value={unifiedList.find(u => u.toUpperCase() === profile.designation?.toUpperCase()) || profile.designation || ''} onChange={e => setP('designation', e.target.value)} className={sel}>
                                                                                        <option value="">Select Designation</option>
                                                                                        {unifiedList.map(o => <option key={o} value={o}>{o}</option>)}
                                                                                        <option value="Others">Others</option>
                                                                                    </select>
                                                                                )
                                                                            ) : (
                                                                                <div className="w-full bg-slate-50/70 border-2 border-slate-200 rounded-lg py-2 px-3.5 text-[18px] font-semibold text-slate-400 min-h-[38px] h-[38px] flex items-center italic">
                                                                                    Not Applicable (Regular)
                                                                                </div>
                                                                            )}
                                                                        </Field>
                                                                        <Field label="Officer-in-Charge (OIC) Status">
                                                                            <div className="flex items-center justify-between px-3.5 py-1.5 rounded-lg border-2 border-slate-200 bg-slate-50/60 min-h-[38px] h-[38px]">
                                                                                <span className={`text-[18px] font-bold ${profile.is_oic ? 'text-[#08315F]' : 'text-slate-500'}`}>
                                                                                    {profile.is_oic ? 'Officer-in-Charge (OIC)' : 'Regular Appointment'}
                                                                                </span>
                                                                                <button
                                                                                    type="button"
                                                                                    disabled={!isEditing}
                                                                                    onClick={() => {
                                                                                        const newOicStatus = !profile.is_oic;
                                                                                        setP('is_oic', newOicStatus);
                                                                                        if (!newOicStatus) {
                                                                                            setP('designation', '');
                                                                                        }
                                                                                    }}
                                                                                    className={`w-11 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none disabled:opacity-50 ${profile.is_oic ? 'bg-[#08315F]' : 'bg-slate-300'}`}
                                                                                >
                                                                                    <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${profile.is_oic ? 'translate-x-6' : 'translate-x-0'}`} />
                                                                                </button>
                                                                            </div>
                                                                        </Field>
                                                                        <Field label="Date of Present Position (Appointment Date)">
                                                                            <div className="relative">
                                                                                <ModernDatePicker disabled={!isEditing} value={profile.appointment_date} onChange={val => setP('appointment_date', val)} className={inp} />
                                                                            </div>
                                                                        </Field>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            <div className="border-t-2 border-slate-100 pt-8">
                                                                <SectionLabel>Contact Details</SectionLabel>
                                                                <div className="space-y-4">
                                                                    <Field label="Permanent Address">
                                                                        <input disabled={!isEditing} type="text" value={profile.permanent_address || ''} onChange={e => setP('permanent_address', e.target.value)} placeholder="House No., Street, Barangay, City/Municipality, Province" className={inp} />
                                                                    </Field>
                                                                    <Field label="Temporary Address">
                                                                        <input disabled={!isEditing} type="text" value={profile.temporary_address || ''} onChange={e => setP('temporary_address', e.target.value)} placeholder="House No., Street, Barangay, City/Municipality, Province" className={inp} />
                                                                    </Field>
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                        <Field label="Phone Number">
                                                                            <input
                                                                                disabled={!isEditing}
                                                                                type="text"
                                                                                value={profile.alt_contact_details_1 || ''}
                                                                                onChange={e => {
                                                                                    const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                                                                                    setProfile(p => ({ ...p, alt_contact_details_1: val, contact_details: val }));
                                                                                }}
                                                                                placeholder="e.g. 0917 123 4567"
                                                                                className={inp}
                                                                            />
                                                                        </Field>
                                                                        <Field label="DepEd Email">
                                                                            <input
                                                                                disabled={!isEditing}
                                                                                type="email"
                                                                                value={profile.email || user?.email || ''}
                                                                                onChange={e => setP('email', e.target.value)}
                                                                                placeholder="e.g. juan.delacruz@deped.gov.ph"
                                                                                className={inp}
                                                                            />
                                                                        </Field>
                                                                    </div>
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                        <Field label="Alternative Email 1">
                                                                            <input
                                                                                disabled={!isEditing}
                                                                                type="email"
                                                                                value={profile.alt_email_1 || ''}
                                                                                onChange={e => setP('alt_email_1', e.target.value)}
                                                                                placeholder="e.g. personal@gmail.com"
                                                                                className={inp}
                                                                            />
                                                                        </Field>
                                                                        <Field label="Alternative Email 2">
                                                                            <input
                                                                                disabled={!isEditing}
                                                                                type="email"
                                                                                value={profile.alt_email_2 || ''}
                                                                                onChange={e => setP('alt_email_2', e.target.value)}
                                                                                placeholder="e.g. backup@yahoo.com"
                                                                                className={inp}
                                                                            />
                                                                        </Field>
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
                                                                <select disabled={!isEditing} value={profile.ces_stage || ''} onChange={e => setP('ces_stage', e.target.value)} className={inp}>
                                                                    <option value="">Select Status</option>
                                                                    <option value="STAGE 1 (CES WRITTEN EXAMINATION)">Stage 1 (CES Written Examination)</option>
                                                                    <option value="STAGE 2 (ASSESSMENT CENTER)">Stage 2 (Assessment Center)</option>
                                                                    <option value="STAGE 3 (PERFORMANCE VALIDATION)">Stage 3 (Performance Validation)</option>
                                                                    <option value="STAGE 4 (BOARD INTERVIEW)">Stage 4 (Board Interview)</option>
                                                                    <option value="CES ELIGIBLE">CES Eligible</option>
                                                                    <option value="CESO RANK VI">CESO Rank VI</option>
                                                                    <option value="CESO RANK V">CESO Rank V</option>
                                                                    <option value="CESO RANK IV">CESO Rank IV</option>
                                                                    <option value="CESO RANK III">CESO Rank III</option>
                                                                    <option value="CESO RANK II">CESO Rank II</option>
                                                                    <option value="CESO RANK I">CESO Rank I</option>
                                                                    <option value="NOT APPLICABLE">Not Applicable</option>
                                                                </select>
                                                            </Field>
                                                            <Field label="Date of Conferment (if applicable)">
                                                                <div className="relative">
                                                                    <ModernDatePicker disabled={!isEditing} value={profile.ces_conferment_date} onChange={val => setP('ces_conferment_date', val)} className={inp} />

                                                                </div>
                                                            </Field>
                                                        </div>

                                                        <div className="bg-white border-2 border-[#08315F] rounded-[22px] p-6 lg:p-8 space-y-5 shadow-none">
                                                            <SectionLabel>Educational Management Test (EMT)</SectionLabel>
                                                            <Field label="Are you an EMT Passer?">
                                                                <div className="flex gap-1.5 p-1 bg-slate-100/70 rounded-xl max-w-xs border-2 border-slate-200/40">
                                                                    {[{ val: true, label: 'Yes' }, { val: false, label: 'No' }].map(opt => (
                                                                        <button disabled={!isEditing}
                                                                            key={String(opt.val)}
                                                                            onClick={() => setP('emt_passer', opt.val)}
                                                                            className={`flex-1 py-2 rounded-lg text-[15px] font-bold uppercase tracking-wider transition-all
                                                                        ${profile.emt_passer === opt.val
                                                                                    ? (opt.val ? 'bg-[#08315F] text-white shadow-sm shadow-blue-900/10' : 'bg-[#FBBF24] text-white shadow-sm shadow-red-900/10')
                                                                                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                                                                        >
                                                                            {opt.label}
                                                                        </button>
                                                                    ))}
                                                                    <button
                                                                        onClick={() => setProfile(p => ({ ...p, emt_passer: null, emt_date: '' }))}
                                                                        className="px-3 py-2 rounded-lg text-[13.5px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-600 hover:bg-transparent transition-all"
                                                                    >
                                                                        Clear
                                                                    </button>
                                                                </div>
                                                            </Field>
                                                            {profile.emt_passer === true && (
                                                                <Field label="Date passed EMT">
                                                                    <div className="relative">
                                                                        <ModernDatePicker disabled={!isEditing} value={profile.emt_date} onChange={val => setP('emt_date', val)} className={inp} />

                                                                    </div>
                                                                </Field>
                                                            )}
                                                        </div>

                                                        <div className="bg-white border-2 border-[#08315F] rounded-[22px] p-6 lg:p-8 space-y-5 shadow-none">
                                                            <div className="flex items-center justify-between">
                                                                <SectionLabel>Other Civil Service Eligibility</SectionLabel>
                                                                {isEditing && <button
                                                                    onClick={() => setProfile(p => ({ ...p, eligibilities: [...(p.eligibilities || []), { eligibility: '', date: '', rating: '', place_of_assignment: '' }] }))}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-[#0038A8] text-[15px] font-black uppercase tracking-wider rounded-lg hover:bg-[#0038A8] hover:text-white transition-all shadow-sm"
                                                                >
                                                                    <FiPlus size={12} /> Add Eligibility
                                                                </button>}
                                                            </div>

                                                            {(!profile.eligibilities || profile.eligibilities.length === 0) ? (
                                                                <div className="p-8 text-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                                                                    <p className="text-[18px] font-semibold text-slate-400">No other eligibilities added.</p>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-4">
                                                                    {profile.eligibilities.map((elig, idx) => (
                                                                        <div key={elig.id || `elig-${idx}`} className="relative p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl group">
                                                                            {isEditing && <button
                                                                                onClick={() => setProfile(p => ({ ...p, eligibilities: p.eligibilities.filter((_, i) => i !== idx) }))}
                                                                                className="absolute -right-2 -top-2 p-1.5 bg-white border-2 border-slate-200 text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 hover:border-red-100 shadow-sm"
                                                                                title="Remove"
                                                                            >
                                                                                <FiTrash2 size={12} />
                                                                            </button>}
                                                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                                                                <Field label="Eligibility">
                                                                                    <input disabled={!isEditing}
                                                                                        type="text"
                                                                                        value={elig.eligibility || elig.title || ''}
                                                                                        onChange={e => setProfile(p => ({ ...p, eligibilities: p.eligibilities.map((x, i) => i === idx ? { ...x, eligibility: e.target.value.toUpperCase(), title: undefined } : x) }))}
                                                                                        placeholder="e.g. Career Service Professional"
                                                                                        className={inp}
                                                                                    />
                                                                                </Field>
                                                                                <Field label="Date of Examination / Conferment">
                                                                                    <ModernDatePicker disabled={!isEditing}
                                                                                        value={elig.date || ''}
                                                                                        onChange={val => setProfile(p => ({ ...p, eligibilities: p.eligibilities.map((x, i) => i === idx ? { ...x, date: val } : x) }))}
                                                                                        className={inp}
                                                                                    />
                                                                                </Field>
                                                                                <Field label="Rating">
                                                                                    <input disabled={!isEditing}
                                                                                        type="text"
                                                                                        value={elig.rating || ''}
                                                                                        onChange={e => setProfile(p => ({ ...p, eligibilities: p.eligibilities.map((x, i) => i === idx ? { ...x, rating: e.target.value } : x) }))}
                                                                                        placeholder="e.g. 85.50"
                                                                                        className={inp}
                                                                                    />
                                                                                </Field>
                                                                                <Field label="Place of Examination / Conferment">
                                                                                    <input disabled={!isEditing}
                                                                                        type="text"
                                                                                        value={elig.place_of_assignment || ''}
                                                                                        onChange={e => setProfile(p => ({ ...p, eligibilities: p.eligibilities.map((x, i) => i === idx ? { ...x, place_of_assignment: e.target.value.toUpperCase() } : x) }))}
                                                                                        placeholder="e.g. Manila"
                                                                                        className={inp}
                                                                                    />
                                                                                </Field>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ── EXPERIENCE ── */}
                                                {tab === 'experience' && (
                                                    <div className="space-y-6">
                                                        <div className="w-full">
                                                            <div className="bg-white border-2 border-[#08315F] rounded-[22px] p-8 shadow-none h-full">
                                                                <SectionLabel>Managerial Experience</SectionLabel>
                                                                <div className="bg-[#F4F8FB]/50 p-6 rounded-3xl border-2 border-blue-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                                                                    <div>
                                                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                                            <p className="text-[15px] font-black text-[#08315F] uppercase tracking-widest">Total Managerial Experience</p>
                                                                            <span className="text-[12px] font-bold text-blue-700 bg-blue-100/80 px-2.5 py-0.5 rounded-full border border-blue-200">
                                                                                As of {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-[13.5px] font-bold text-slate-400 italic leading-tight">Automatically computed based on supervisory & managerial positions (Salary Grade 18 and above) as of current date.</p>
                                                                    </div>
                                                                    <div className="bg-white px-6 py-3 rounded-2xl border-2 border-blue-200 shadow-sm">
                                                                        <p className="text-[30px] font-black text-[#08315F] tracking-tight">{profile.managerial_experience_total || '0 Years, 0 Months'}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="bg-white border-2 border-[#08315F] rounded-[22px] p-8 shadow-none">
                                                            <SectionLabel color="#08315F">Previous Positions Held</SectionLabel>
                                                            <div className="space-y-3">
                                                                <div className="hidden xl:grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_140px_80px_44px] gap-3 px-2">
                                                                    {['Position', 'Office / Division', 'From', 'To', 'OIC?', ''].map(h => <span key={h} className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest">{h}</span>)}
                                                                </div>
                                                                {prevPositions.map((pos, idx) => (
                                                                    <div key={pos.id || pos.position_id || `pos-${idx}`} className="relative mb-2 focus-within:z-50" style={{ zIndex: prevPositions.length - idx + 10 }}>
                                                                        {(() => {
                                                                            const isPrevPosOthers = pos.position_name === 'Others' || (pos.position_name && !tloPositionOptions.some(o => o.toUpperCase() === pos.position_name.toUpperCase()));
                                                                            return (
                                                                                <>
                                                                                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_140px_80px_44px] gap-4 xl:gap-3 items-start xl:items-start bg-slate-50/40 hover:bg-transparent p-4 md:p-6 xl:px-4 xl:pb-4 xl:pt-7 rounded-2xl border-2 border-slate-200/60 transition-colors shadow-sm relative">
                                                                                        <div className="flex flex-col gap-1.5 w-full">
                                                                                            <span className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest xl:hidden">Position</span>
                                                                                            <select disabled={!isEditing}
                                                                                                value={isPrevPosOthers ? 'Others' : (pos.position_name?.toUpperCase() || '')}
                                                                                                onChange={e => setPrevPositions(p => p.map((x, i) => i === idx ? { ...x, position_name: e.target.value } : x))}
                                                                                                className="bg-white border-2 border-slate-200 focus:border-[#0038A8] focus:ring-2 focus:ring-blue-50/50 rounded-xl px-3 py-2 text-[18px] font-semibold text-slate-800 outline-none transition-all truncate min-w-0 shadow-sm"
                                                                                            >
                                                                                                <option value="">Select Position</option>
                                                                                                {tloPositionOptions.map(o => <option key={o} value={o.toUpperCase()}>{o}</option>)}
                                                                                                <option value="Others">Others</option>
                                                                                            </select>
                                                                                            {isPrevPosOthers && (
                                                                                                <input disabled={!isEditing}
                                                                                                    type="text"
                                                                                                    value={pos.position_name === 'Others' ? '' : pos.position_name}
                                                                                                    onChange={e => setPrevPositions(p => p.map((x, i) => i === idx ? { ...x, position_name: e.target.value.toUpperCase() || 'Others' } : x))}
                                                                                                    placeholder="Type the position you held"
                                                                                                    className="bg-white border-2 border-slate-200 focus:border-[#0038A8] rounded-xl px-3 py-2 text-[18px] font-semibold mt-2 w-full outline-none transition-all shadow-sm"
                                                                                                    autoFocus
                                                                                                />
                                                                                            )}
                                                                                            {pos.position_name && pos.position_name !== 'Others' && (() => {
                                                                                                const sg = getSalaryGradeForPosition(pos.position_name, tloPositions, pos.salary_grade);
                                                                                                const isMgr = isManagerialPosition(pos.position_name, tloPositions, pos.salary_grade);
                                                                                                return (
                                                                                                    <div className="flex items-center gap-1.5 mt-1 px-1">
                                                                                                        {isMgr ? (
                                                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[12px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                                                                                {sg ? `SG ${sg} • ` : ''}Managerial (Counted)
                                                                                                            </span>
                                                                                                        ) : (
                                                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[12px] font-black bg-slate-100 text-slate-600 border border-slate-200">
                                                                                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                                                                                                {sg ? `SG ${sg} • ` : ''}Non-Managerial (&lt; SG 18)
                                                                                                            </span>
                                                                                                        )}
                                                                                                    </div>
                                                                                                );
                                                                                            })()}
                                                                                        </div>
                                                                                        <div className="flex flex-col gap-1.5 w-full">
                                                                                            <span className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest xl:hidden">Office / Division</span>
                                                                                            <input disabled={!isEditing} type="text" value={pos.office || ''} onChange={e => setPrevPositions(p => p.map((x, i) => i === idx ? { ...x, office: e.target.value } : x))} placeholder="Office" className="bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-[18px] font-bold outline-none focus:border-[#0038A8] transition-all truncate min-w-0 shadow-sm" />
                                                                                        </div>
                                                                                        <div className="flex flex-col gap-1.5 w-full">
                                                                                            <span className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest xl:hidden">From Date</span>
                                                                                            <div className="relative">
                                                                                                <ModernDatePicker disabled={!isEditing} value={pos.start_date ? pos.start_date.split('T')[0] : ''} onChange={val => setPrevPositions(p => p.map((x, i) => i === idx ? { ...x, start_date: val } : x))} className="bg-white border-2 border-slate-200 focus:border-[#0038A8] focus:ring-2 focus:ring-blue-50/50 rounded-xl px-3 py-2 text-[18px] font-semibold text-slate-800 outline-none transition-all w-full shadow-sm" />
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="flex flex-col gap-1.5 w-full relative">
                                                                                            <div className="flex items-center justify-between xl:block">
                                                                                                <span className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest xl:hidden">To Date</span>
                                                                                                {isEditing ? (
                                                                                                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-black text-[#0038A8] hover:text-[#08315F] uppercase tracking-wider ml-auto xl:absolute xl:-top-6 xl:right-0">
                                                                                                        <input
                                                                                                            type="checkbox"
                                                                                                            checked={Boolean(pos.is_current)}
                                                                                                            onChange={e => {
                                                                                                                const checked = e.target.checked;
                                                                                                                setPrevPositions(p => p.map((x, i) => {
                                                                                                                    if (i !== idx) return x;
                                                                                                                    return {
                                                                                                                        ...x,
                                                                                                                        is_current: checked,
                                                                                                                        status: checked ? 'Active' : 'Inactive',
                                                                                                                        end_date: checked ? '' : (x.end_date || '')
                                                                                                                    };
                                                                                                                }));
                                                                                                            }}
                                                                                                            className="w-3.5 h-3.5 rounded border-slate-300 text-[#0038A8] focus:ring-[#0038A8] cursor-pointer"
                                                                                                        />
                                                                                                        <span>Current</span>
                                                                                                    </label>
                                                                                                ) : (
                                                                                                    pos.is_current && (
                                                                                                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-blue-700 uppercase tracking-wider ml-auto xl:absolute xl:-top-5.5 xl:right-0">
                                                                                                            Current
                                                                                                        </span>
                                                                                                    )
                                                                                                )}
                                                                                            </div>
                                                                                            <div className="relative">
                                                                                                <ModernDatePicker
                                                                                                    disabled={!isEditing || Boolean(pos.is_current)}
                                                                                                    placeholder={pos.is_current ? "Present" : "Select a date"}
                                                                                                    value={pos.is_current ? '' : (pos.end_date ? pos.end_date.split('T')[0] : '')}
                                                                                                    onChange={val => setPrevPositions(p => p.map((x, i) => i === idx ? { ...x, end_date: val, is_current: false, status: 'Inactive' } : x))}
                                                                                                    minDate={pos.start_date ? new Date(pos.start_date) : undefined}
                                                                                                    className={`bg-white border-2 border-slate-200 focus:border-[#0038A8] focus:ring-2 focus:ring-blue-50/50 rounded-xl px-3 py-2 text-[18px] font-semibold text-slate-800 outline-none transition-all w-full shadow-sm ${pos.is_current ? 'bg-blue-50/50 text-[#0038A8] font-bold' : ''}`}
                                                                                                />
                                                                                                {pos.start_date && pos.end_date && !pos.is_current && new Date(pos.end_date) <= new Date(pos.start_date) && (
                                                                                                    <p className="text-red-500 text-[15px] mt-1 font-semibold absolute -bottom-5">Must be after From Date.</p>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="flex flex-col gap-1.5 w-full">
                                                                                            <span className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest xl:hidden">OIC Status</span>
                                                                                            <button type="button" onClick={(e) => { e.preventDefault(); setPrevPositions(p => p.map((x, i) => i === idx ? { ...x, oic_positions: [...(x.oic_positions || []), { id: `tmp-oic-${Date.now()}`, oic_position_name: '', oic_office: '', oic_start_date: '', oic_end_date: '' }] } : x)); }} className="flex items-center justify-center gap-1 text-[13.5px] font-black uppercase h-[48px] px-1 rounded-xl transition-all bg-white border-2 border-slate-200 text-slate-500 shadow-sm hover:border-[#FCD116] hover:text-[#FBBF24]">
                                                                                                <FiPlus size={14} /> Add OIC
                                                                                            </button>
                                                                                        </div>
                                                                                        <div className="flex flex-col gap-1.5 w-full md:w-auto md:self-end justify-center xl:items-center">
                                                                                            <span className="text-[13.5px] font-black text-slate-[#FBBF24] uppercase tracking-widest xl:hidden md:invisible">Action</span>
                                                                                            {isEditing && <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemovePosition(idx); }} className="w-full xl:w-11 h-[48px] flex items-center justify-center bg-[#FBBF24]/10 text-[#FBBF24] rounded-xl hover:bg-[#FBBF24] hover:text-white transition-all"><FiTrash2 size={14} /></button>}
                                                                                        </div>
                                                                                    </motion.div>

                                                                                    {(pos.oic_positions || []).map((oic, oicIdx) => {
                                                                                        const isOicPosOthers = oic.oic_position_name === 'Others' || (oic.oic_position_name && !tloPositionOptions.some(o => o.toUpperCase() === oic.oic_position_name.toUpperCase()));
                                                                                        return (
                                                                                            <motion.div key={oic.id || `oic-${idx}-${oicIdx}`} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="ml-8 mt-2 pl-6 border-l-2 border-dashed border-[#FCD116] relative focus-within:z-40">
                                                                                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_140px_80px_44px] gap-4 xl:gap-3 items-start xl:items-start bg-white p-4 md:p-6 xl:px-4 xl:pb-4 xl:pt-7 rounded-2xl border-2 border-[#FCD116]/30 transition-colors shadow-sm relative mb-2">
                                                                                                    <div className="absolute -left-6 top-1/2 w-6 h-0.5 border-t-2 border-dashed border-[#FCD116]"></div>
                                                                                                    <div className="flex flex-col gap-1.5 w-full">
                                                                                                        <span className="text-[13.5px] font-black text-[#FCD116] uppercase tracking-widest xl:hidden">OIC Position</span>
                                                                                                        <select disabled={!isEditing}
                                                                                                            value={isOicPosOthers ? 'Others' : (oic.oic_position_name?.toUpperCase() || '')}
                                                                                                            onChange={e => setPrevPositions(p => p.map((x, i) => i === idx ? { ...x, oic_positions: x.oic_positions.map((o, j) => j === oicIdx ? { ...o, oic_position_name: e.target.value } : o) } : x))}
                                                                                                            className="bg-white border-2 border-[#FCD116]/50 focus:border-[#FBBF24] focus:ring-2 focus:ring-[#FBBF24]/30 rounded-xl px-3 py-2 text-[18px] font-semibold text-slate-800 outline-none transition-all truncate min-w-0 shadow-sm"
                                                                                                        >
                                                                                                            <option value="">Select OIC Position</option>
                                                                                                            {tloPositionOptions.map(o => <option key={o} value={o.toUpperCase()}>{o}</option>)}
                                                                                                            <option value="Others">Others</option>
                                                                                                        </select>
                                                                                                        {isOicPosOthers && (
                                                                                                            <input disabled={!isEditing}
                                                                                                                type="text"
                                                                                                                value={oic.oic_position_name === 'Others' ? '' : oic.oic_position_name}
                                                                                                                onChange={e => setPrevPositions(p => p.map((x, i) => i === idx ? { ...x, oic_positions: x.oic_positions.map((o, j) => j === oicIdx ? { ...o, oic_position_name: e.target.value.toUpperCase() || 'Others' } : o) } : x))}
                                                                                                                placeholder="Type the position you held"
                                                                                                                className="bg-white border-2 border-[#FCD116]/50 focus:border-[#FBBF24] rounded-xl px-3 py-2 text-[18px] font-semibold mt-2 w-full outline-none transition-all shadow-sm"
                                                                                                                autoFocus
                                                                                                            />
                                                                                                        )}
                                                                                                        {oic.oic_position_name && oic.oic_position_name !== 'Others' && (() => {
                                                                                                            const oicSg = getSalaryGradeForPosition(oic.oic_position_name, tloPositions, oic.salary_grade);
                                                                                                            const isOicMgr = isManagerialPosition(oic.oic_position_name, tloPositions, oic.salary_grade);
                                                                                                            return (
                                                                                                                <div className="flex items-center gap-1.5 mt-1 px-1">
                                                                                                                    {isOicMgr ? (
                                                                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[12px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                                                                                            {oicSg ? `SG ${oicSg} • ` : ''}Managerial OIC (Counted)
                                                                                                                        </span>
                                                                                                                    ) : (
                                                                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[12px] font-black bg-slate-100 text-slate-600 border border-slate-200">
                                                                                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                                                                                                            {oicSg ? `SG ${oicSg} • ` : ''}Non-Managerial (&lt; SG 18)
                                                                                                                        </span>
                                                                                                                    )}
                                                                                                                </div>
                                                                                                            );
                                                                                                        })()}
                                                                                                    </div>
                                                                                                    <div className="flex flex-col gap-1.5 w-full">
                                                                                                        <span className="text-[13.5px] font-black text-[#FCD116] uppercase tracking-widest xl:hidden">OIC Office / Division</span>
                                                                                                        <input disabled={!isEditing} type="text" value={oic.oic_office || ''} onChange={e => setPrevPositions(p => p.map((x, i) => i === idx ? { ...x, oic_positions: x.oic_positions.map((o, j) => j === oicIdx ? { ...o, oic_office: e.target.value } : o) } : x))} placeholder="OIC Office" className="bg-white border-2 border-[#FCD116]/50 rounded-xl px-3 py-2 text-[18px] font-bold outline-none focus:border-[#FBBF24] transition-all truncate min-w-0 shadow-sm" />
                                                                                                    </div>
                                                                                                    <div className="flex flex-col gap-1.5 w-full">
                                                                                                        <span className="text-[13.5px] font-black text-[#FCD116] uppercase tracking-widest xl:hidden">From Date</span>
                                                                                                        <div className="relative">
                                                                                                            <ModernDatePicker disabled={!isEditing} value={oic.oic_start_date ? oic.oic_start_date.split('T')[0] : ''} onChange={val => setPrevPositions(p => p.map((x, i) => i === idx ? { ...x, oic_positions: x.oic_positions.map((o, j) => j === oicIdx ? { ...o, oic_start_date: val } : o) } : x))} className="bg-white border-2 border-[#FCD116]/50 focus:border-[#FBBF24] focus:ring-2 focus:ring-[#FBBF24]/30 rounded-xl px-3 py-2 text-[18px] font-semibold text-slate-800 outline-none transition-all w-full shadow-sm" />
                                                                                                        </div>
                                                                                                    </div>
                                                                                                    <div className="flex flex-col gap-1.5 w-full relative">
                                                                                                        <div className="flex items-center justify-between xl:block">
                                                                                                            <span className="text-[13.5px] font-black text-[#FCD116] uppercase tracking-widest xl:hidden">To Date</span>
                                                                                                            {isEditing ? (
                                                                                                                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-black text-[#08315F] uppercase tracking-wider hover:underline ml-auto xl:absolute xl:-top-6 xl:right-0">
                                                                                                                    <input
                                                                                                                        type="checkbox"
                                                                                                                        checked={Boolean(oic.is_current)}
                                                                                                                        onChange={e => {
                                                                                                                            const checked = e.target.checked;
                                                                                                                            setPrevPositions(p => p.map((x, i) => i === idx ? {
                                                                                                                                ...x,
                                                                                                                                oic_positions: x.oic_positions.map((o, j) => j === oicIdx ? {
                                                                                                                                    ...o,
                                                                                                                                    is_current: checked,
                                                                                                                                    oic_end_date: checked ? '' : (o.oic_end_date || '')
                                                                                                                                } : o)
                                                                                                                            } : x));
                                                                                                                        }}
                                                                                                                        className="w-3.5 h-3.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                                                                                                    />
                                                                                                                    <span>Current</span>
                                                                                                                </label>
                                                                                                            ) : (
                                                                                                                oic.is_current && (
                                                                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-800 uppercase tracking-wider ml-auto xl:absolute xl:-top-5.5 xl:right-0">
                                                                                                                        Current
                                                                                                                    </span>
                                                                                                                )
                                                                                                            )}
                                                                                                        </div>
                                                                                                        <div className="relative">
                                                                                                            <ModernDatePicker
                                                                                                                disabled={!isEditing || Boolean(oic.is_current)}
                                                                                                                placeholder={oic.is_current ? "Present" : "Select a date"}
                                                                                                                value={oic.is_current ? '' : (oic.oic_end_date ? oic.oic_end_date.split('T')[0] : '')}
                                                                                                                onChange={val => setPrevPositions(p => p.map((x, i) => i === idx ? {
                                                                                                                    ...x,
                                                                                                                    oic_positions: x.oic_positions.map((o, j) => j === oicIdx ? { ...o, oic_end_date: val, is_current: false } : o)
                                                                                                                } : x))}
                                                                                                                minDate={oic.oic_start_date ? new Date(oic.oic_start_date) : undefined}
                                                                                                                className={`bg-white border-2 border-[#FCD116]/50 focus:border-[#FBBF24] focus:ring-2 focus:ring-[#FBBF24]/30 rounded-xl px-3 py-2 text-[18px] font-semibold text-slate-800 outline-none transition-all w-full shadow-sm ${oic.is_current ? 'bg-amber-50/70 text-[#08315F] font-bold' : ''}`}
                                                                                                            />
                                                                                                            {oic.oic_start_date && oic.oic_end_date && !oic.is_current && new Date(oic.oic_end_date) <= new Date(oic.oic_start_date) && (
                                                                                                                <p className="text-red-500 text-[15px] mt-1 font-semibold absolute -bottom-5">Must be after From Date.</p>
                                                                                                            )}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                    <div className="hidden xl:block"></div>
                                                                                                    <div className="flex flex-col gap-1.5 w-full md:w-auto md:self-end justify-center xl:items-center">
                                                                                                        <span className="text-[13.5px] font-black text-[#FCD116] uppercase tracking-widest xl:hidden md:invisible">Action</span>
                                                                                                        {isEditing && <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPrevPositions(p => p.map((x, i) => i === idx ? { ...x, oic_positions: x.oic_positions.filter((_, j) => j !== oicIdx) } : x)); }} className="w-full xl:w-11 h-[48px] flex items-center justify-center bg-[#FBBF24]/10 text-[#FBBF24] rounded-xl hover:bg-[#FBBF24] hover:text-white transition-all"><FiTrash2 size={14} /></button>}
                                                                                                    </div>
                                                                                                </div>
                                                                                            </motion.div>
                                                                                        );
                                                                                    })}
                                                                                </>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                ))}
                                                                {isEditing && <button onClick={handleAddPosition} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black text-[15px] uppercase tracking-widest hover:border-[#0038A8] hover:text-[#08315F] transition-all flex items-center justify-center gap-2 mt-2">
                                                                    <FiPlus size={14} /> Add Position
                                                                </button>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ── EDUCATION ── */}
                                                {tab === 'education' && (() => {
                                                    const renderDegreeSection = (title, degField, yrField, prevMin) => {
                                                        const degrees = (profile[degField] || '').split('\n');
                                                        const years = (profile[yrField] || '').split('\n');
                                                        const count = Math.max(degrees.length, years.length, 1);

                                                        const updateEntry = (idx, type, val) => {
                                                            if (type === 'deg') {
                                                                const newDegs = [...degrees];
                                                                newDegs[idx] = val;
                                                                setP(degField, newDegs.join('\n'));
                                                            } else {
                                                                const newYrs = [...years];
                                                                newYrs[idx] = val;
                                                                setP(yrField, newYrs.join('\n'));
                                                            }
                                                        };

                                                        return (
                                                            <div className="relative p-6 bg-[#08315F]/5 rounded-[2rem] border-2 border-[#0038A8]/10 space-y-4 mb-6 group">
                                                                <p className="text-[15px] font-black text-[#08315F] uppercase tracking-widest">{title}</p>
                                                                {Array.from({ length: count }).map((_, idx) => (
                                                                    <div key={`${degField}-${idx}`} className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                                                                        <Field label="Degree / Course">
                                                                            <input disabled={!isEditing} type="text" value={degrees[idx] || ''} onChange={e => updateEntry(idx, 'deg', e.target.value)} placeholder="e.g. Bachelor of Science in Nursing" className={inp} />
                                                                        </Field>
                                                                        <Field label="Year Graduated">
                                                                            <YearInput disabled={!isEditing} value={years[idx] || ''} onChange={val => updateEntry(idx, 'yr', val)} min={prevMin > 0 ? prevMin + 1 : 1900} placeholder="YYYY" />
                                                                        </Field>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        );
                                                    };

                                                    const bachelorYr = profile.bachelor_year || '';
                                                    const masterYr = profile.master_year || '';
                                                    const bYearNum = parseInt(bachelorYr.split('\n')[0]) || 0;
                                                    const mYearNum = parseInt(masterYr.split('\n')[0]) || 0;

                                                    return (
                                                        <div className="space-y-6">
                                                            <div className="bg-white border-2 border-[#08315F] rounded-[22px] p-6 lg:p-8 space-y-5 shadow-none">
                                                                <div className="mb-6 flex justify-between items-center">
                                                                    <SectionLabel>Educational Attainment</SectionLabel>
                                                                    {isEditing && <div className="relative group/add-degree">
                                                                        <button type="button" className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[15px] uppercase tracking-widest rounded-xl transition-all flex items-center gap-2">
                                                                            <FiPlus size={14} /> Add Degree
                                                                        </button>
                                                                        <div className="absolute right-0 top-full mt-2 w-48 bg-white border-2 border-slate-200 rounded-xl shadow-lg opacity-0 invisible group-hover/add-degree:opacity-100 group-hover/add-degree:visible transition-all z-10 flex flex-col p-1">
                                                                            <button disabled={!isEditing} type="button" onClick={() => { setP('bachelor_degree', (profile.bachelor_degree ? profile.bachelor_degree + '\n' : '')); setP('bachelor_year', (profile.bachelor_year ? profile.bachelor_year + '\n' : '')); }} className="text-left px-3 py-2 text-[15px] font-bold text-slate-600 hover:bg-slate-50 rounded-lg uppercase tracking-wider">Bachelor's</button>
                                                                            <button disabled={!isEditing} type="button" onClick={() => { setP('master_degree', (profile.master_degree ? profile.master_degree + '\n' : '')); setP('master_year', (profile.master_year ? profile.master_year + '\n' : '')); }} className="text-left px-3 py-2 text-[15px] font-bold text-slate-600 hover:bg-slate-50 rounded-lg uppercase tracking-wider">Master's</button>
                                                                            <button disabled={!isEditing} type="button" onClick={() => { setP('doctorate_degree', (profile.doctorate_degree ? profile.doctorate_degree + '\n' : '')); setP('doctorate_year', (profile.doctorate_year ? profile.doctorate_year + '\n' : '')); }} className="text-left px-3 py-2 text-[15px] font-bold text-slate-600 hover:bg-slate-50 rounded-lg uppercase tracking-wider">Doctorate</button>
                                                                        </div>
                                                                    </div>}
                                                                </div>

                                                                {renderDegreeSection("Baccalaureate / Bachelor's Degree", 'bachelor_degree', 'bachelor_year', 1900)}
                                                                {renderDegreeSection("Master's Degree", 'master_degree', 'master_year', bYearNum)}
                                                                {renderDegreeSection("Doctorate", 'doctorate_degree', 'doctorate_year', mYearNum)}

                                                                <div className="flex items-center justify-between mt-8 pt-6 border-t-2 border-slate-100">
                                                                    <SectionLabel>Other Educational / Professional Courses</SectionLabel>
                                                                    {isEditing && <button
                                                                        onClick={() => setProfile(p => ({ ...p, other_courses: [...(p.other_courses || []), { course: '', date_from: '', date_to: '', details: '' }] }))}
                                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-[#0038A8] text-[15px] font-black uppercase tracking-wider rounded-lg hover:bg-[#0038A8] hover:text-white transition-all shadow-sm"
                                                                    >
                                                                        <FiPlus size={14} /> Add Course
                                                                    </button>}
                                                                </div>

                                                                {(!profile.other_courses || profile.other_courses.length === 0) ? (
                                                                    <div className="p-8 text-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                                                                        <p className="text-[18px] font-semibold text-slate-400">No other courses added.</p>
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-y-4">
                                                                        {profile.other_courses.map((course, idx) => (
                                                                            <div key={course.id || `course-${idx}`} className="relative p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl group">
                                                                                {isEditing && <button
                                                                                    onClick={() => setProfile(p => ({ ...p, other_courses: p.other_courses.filter((_, i) => i !== idx) }))}
                                                                                    className="absolute -right-2 -top-2 p-1.5 bg-white border-2 border-slate-200 text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 hover:border-red-100 shadow-sm"
                                                                                    title="Remove"
                                                                                >
                                                                                    <FiTrash2 size={14} />
                                                                                </button>}
                                                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-4">
                                                                                    <Field label="Course Title">
                                                                                        <input disabled={!isEditing}
                                                                                            type="text"
                                                                                            value={course.course || ''}
                                                                                            onChange={e => setProfile(p => ({ ...p, other_courses: p.other_courses.map((x, i) => i === idx ? { ...x, course: e.target.value } : x) }))}
                                                                                            placeholder="e.g. Executive Leadership Program"
                                                                                            className={inp}
                                                                                        />
                                                                                    </Field>
                                                                                    <Field label="Details">
                                                                                        <input disabled={!isEditing}
                                                                                            type="text"
                                                                                            value={course.details || ''}
                                                                                            onChange={e => setProfile(p => ({ ...p, other_courses: p.other_courses.map((x, i) => i === idx ? { ...x, details: e.target.value } : x) }))}
                                                                                            placeholder="Sponsor, Location, etc."
                                                                                            className={inp}
                                                                                        />
                                                                                    </Field>
                                                                                </div>
                                                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                                                                    <Field label="Date From">
                                                                                        <div className="relative">
                                                                                            <ModernDatePicker disabled={!isEditing}
                                                                                                value={course.date_from || ''}
                                                                                                onChange={val => setProfile(p => ({ ...p, other_courses: p.other_courses.map((x, i) => i === idx ? { ...x, date_from: val } : x) }))}
                                                                                                className={inp}
                                                                                            />
                                                                                        </div>
                                                                                    </Field>
                                                                                    <Field label="Date To">
                                                                                        <div className="relative">
                                                                                            <ModernDatePicker disabled={!isEditing}
                                                                                                value={course.date_to || ''}
                                                                                                onChange={val => setProfile(p => ({ ...p, other_courses: p.other_courses.map((x, i) => i === idx ? { ...x, date_to: val } : x) }))}
                                                                                                minDate={course.date_from ? new Date(course.date_from) : undefined}
                                                                                                className={inp}
                                                                                            />
                                                                                            {course.date_from && course.date_to && new Date(course.date_to) <= new Date(course.date_from) && (
                                                                                                <p className="text-red-500 text-[15px] mt-1 font-semibold absolute -bottom-5">Must be after From Date.</p>
                                                                                            )}
                                                                                        </div>
                                                                                    </Field>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {/* ── PERFORMANCE RATINGS ── */}
                                                {tab === 'performance' && (
                                                    <div className="space-y-6">
                                                        {/* Performance Section */}
                                                        <div className="bg-white border-2 border-[#08315F] rounded-[22px] p-8 shadow-none space-y-6">
                                                            <SectionLabel color="#0038A8">IPCRF / OPCRF</SectionLabel>

                                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                                                {/* Rating 1 */}
                                                                <div className="p-6 bg-[#08315F]/5 rounded-[2rem] border-2 border-[#0038A8]/10 space-y-4">
                                                                    <p className="text-[15px] font-black text-[#08315F] uppercase tracking-widest">Latest Rating (1st)</p>
                                                                    <div className="space-y-3">
                                                                        <Field label="Rating (Max 5.000)">
                                                                            <input disabled={!isEditing} type="number" step="0.001" min="1.0" max="5.0" value={profile.performance_rating_1} onChange={e => { let v = e.target.value; if (v !== '' && Number(v) > 5) v = '5.0'; setP('performance_rating_1', v); }} onBlur={e => { let v = e.target.value; if (v !== '') { let n = Number(v); if (n > 5) n = 5; if (n < 1) n = 1; setP('performance_rating_1', n.toString()); } }} placeholder="4.850" className={inp} />
                                                                        </Field>
                                                                        <Field label="Rating Period">
                                                                            <div className="relative">
                                                                                <ModernDatePicker disabled={!isEditing} isMonthPicker value={profile.performance_rating_1_period} onChange={val => setP('performance_rating_1_period', val)} maxDate={new Date()} minDate={profile.performance_rating_2_period ? new Date(profile.performance_rating_2_period + "-01") : undefined} className={inp} />

                                                                            </div>
                                                                        </Field>
                                                                    </div>
                                                                </div>

                                                                {/* Rating 2 */}
                                                                <div className="p-6 bg-[#08315F]/5 rounded-[2rem] border-2 border-[#0038A8]/10 space-y-4">
                                                                    <p className="text-[15px] font-black text-[#08315F] uppercase tracking-widest">Previous Rating (2nd)</p>
                                                                    <div className="space-y-3">
                                                                        <Field label="Rating (Max 5.000)">
                                                                            <input disabled={!isEditing} type="number" step="0.001" min="1.0" max="5.0" value={profile.performance_rating_2} onChange={e => { let v = e.target.value; if (v !== '' && Number(v) > 5) v = '5.0'; setP('performance_rating_2', v); }} onBlur={e => { let v = e.target.value; if (v !== '') { let n = Number(v); if (n > 5) n = 5; if (n < 1) n = 1; setP('performance_rating_2', n.toString()); } }} placeholder="4.750" className={inp} />
                                                                        </Field>
                                                                        <Field label="Rating Period">
                                                                            <div className="relative">
                                                                                <ModernDatePicker disabled={!isEditing} isMonthPicker value={profile.performance_rating_2_period} onChange={val => setP('performance_rating_2_period', val)} maxDate={profile.performance_rating_1_period ? new Date(profile.performance_rating_1_period + "-01") : new Date()} minDate={profile.performance_rating_3_period ? new Date(profile.performance_rating_3_period + "-01") : undefined} className={inp} />

                                                                            </div>
                                                                        </Field>
                                                                    </div>
                                                                </div>

                                                                {/* Rating 3 */}
                                                                <div className="p-6 bg-[#08315F]/5 rounded-[2rem] border-2 border-[#0038A8]/10 space-y-4">
                                                                    <p className="text-[15px] font-black text-[#08315F] uppercase tracking-widest">Oldest Rating (3rd)</p>
                                                                    <div className="space-y-3">
                                                                        <Field label="Rating (Max 5.000)">
                                                                            <input disabled={!isEditing} type="number" step="0.001" min="1.0" max="5.0" value={profile.performance_rating_3} onChange={e => { let v = e.target.value; if (v !== '' && Number(v) > 5) v = '5.0'; setP('performance_rating_3', v); }} onBlur={e => { let v = e.target.value; if (v !== '') { let n = Number(v); if (n > 5) n = 5; if (n < 1) n = 1; setP('performance_rating_3', n.toString()); } }} placeholder="4.650" className={inp} />
                                                                        </Field>
                                                                        <Field label="Rating Period">
                                                                            <div className="relative">
                                                                                <ModernDatePicker disabled={!isEditing} isMonthPicker value={profile.performance_rating_3_period} onChange={val => setP('performance_rating_3_period', val)} maxDate={profile.performance_rating_2_period ? new Date(profile.performance_rating_2_period + "-01") : new Date()} className={inp} />

                                                                            </div>
                                                                        </Field>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="p-6 bg-[#F4F8FB]/30 rounded-[2rem] border-2 border-blue-100 space-y-5">
                                                                <div className="flex items-center gap-3">
                                                                    <p className="text-[15px] font-black text-[#075985] uppercase tracking-widest">CESPES Rating</p>
                                                                    <span className="text-[13.5px] font-bold text-blue-400 italic flex items-center gap-1"><FiInfo size={14} /> Career Executive Service Performance Evaluation System</span>
                                                                </div>

                                                                {/* 1st Semester */}
                                                                <div className="space-y-3">
                                                                    <p className="text-[13.5px] font-black text-slate-500 uppercase tracking-widest">1st Semester</p>
                                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                                        <Field label="CESPES Rating (1st)">
                                                                            <input disabled={!isEditing}
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
                                                                                <ModernDatePicker disabled={!isEditing}
                                                                                    isMonthPicker
                                                                                    value={profile.cespes_rating_1_period}
                                                                                    onChange={val => setP('cespes_rating_1_period', val)}
                                                                                    maxDate={profile.cespes_rating_2_period ? new Date(profile.cespes_rating_2_period + "-01") : new Date()}
                                                                                    className={`${inp} pr-10`}
                                                                                />
                                                                            </div>
                                                                        </Field>
                                                                    </div>
                                                                </div>

                                                                {/* 2nd Semester */}
                                                                <div className="space-y-3">
                                                                    <p className="text-[13.5px] font-black text-slate-500 uppercase tracking-widest">2nd Semester</p>
                                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                                        <Field label="CESPES Rating (2nd)">
                                                                            <input disabled={!isEditing}
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
                                                                                <ModernDatePicker disabled={!isEditing}
                                                                                    isMonthPicker
                                                                                    value={profile.cespes_rating_2_period}
                                                                                    onChange={val => setP('cespes_rating_2_period', val)}
                                                                                    maxDate={new Date()}
                                                                                    minDate={profile.cespes_rating_1_period ? new Date(profile.cespes_rating_1_period + "-01") : undefined}
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
                                                            <div className="flex items-center justify-between">
                                                                <SectionLabel color="#FCD116">Notable Achievements (If Any)</SectionLabel>
                                                            </div>

                                                            {(() => {
                                                                const achList = Array.isArray(profile.notable_achievements) ? profile.notable_achievements : [];
                                                                const layerCount = Math.max(achList.length, 1);

                                                                const updateAchievementEntry = (idx, newTitle, newYr) => {
                                                                    const newAchs = achList.map(item => typeof item === 'object' && item !== null ? { ...item } : { title: String(item || ''), year: '' });
                                                                    if (!newAchs[idx]) newAchs[idx] = { title: '', year: '' };
                                                                    if (newTitle !== undefined) newAchs[idx].title = newTitle;
                                                                    if (newYr !== undefined) newAchs[idx].year = newYr;
                                                                    setP('notable_achievements', newAchs);
                                                                };

                                                                const removeAchievementEntry = (idx) => {
                                                                    const newAchs = achList.filter((_, i) => i !== idx);
                                                                    setP('notable_achievements', newAchs);
                                                                };

                                                                return (
                                                                    <div className="space-y-6">
                                                                        {Array.from({ length: layerCount }).map((_, idx) => {
                                                                            const item = achList[idx] || { title: '', year: '' };
                                                                            const valAch = typeof item === 'object' && item !== null ? (item.title || '') : String(item || '');
                                                                            const valYr = typeof item === 'object' && item !== null ? (item.year || '') : '';
                                                                            return (
                                                                                <motion.div
                                                                                    key={`ach-layer-${idx}`}
                                                                                    initial={{ opacity: 0, y: 6 }}
                                                                                    animate={{ opacity: 1, y: 0 }}
                                                                                    className="p-5 bg-slate-50/60 rounded-2xl border-2 border-slate-200/80 relative space-y-4"
                                                                                >
                                                                                    <div className="flex items-center justify-between">
                                                                                        <span className="text-[15px] font-black text-slate-400 uppercase tracking-widest">
                                                                                            Achievement Entry {layerCount > 1 ? `#${idx + 1}` : ''}
                                                                                        </span>
                                                                                        {isEditing && layerCount > 1 && (
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => removeAchievementEntry(idx)}
                                                                                                className="text-amber-600 hover:text-amber-800 text-[15px] font-bold uppercase tracking-wider flex items-center gap-1 bg-amber-50 px-3 py-1 rounded-lg border-2 border-amber-200 transition-colors cursor-pointer"
                                                                                                title="Remove Achievement Entry"
                                                                                            >
                                                                                                <FiTrash2 size={14} /> Remove
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                                                        <Field label="Awards / Recognitions / Notable Achievements (If Any)">
                                                                                            <select
                                                                                                disabled={!isEditing}
                                                                                                value={valAch}
                                                                                                onChange={e => updateAchievementEntry(idx, e.target.value, undefined)}
                                                                                                className="w-full bg-white hover:bg-slate-100/30 border-2 border-slate-200/80 focus:border-[#0038A8] focus:bg-white focus:ring-4 focus:ring-blue-50/50 rounded-2xl py-4 px-5 text-[18px] font-semibold text-slate-800 outline-none transition-all shadow-sm cursor-pointer"
                                                                                            >
                                                                                                <option value="">-- Select Achievement --</option>
                                                                                                {notableAchievementsOptions.map((ach, i) => (
                                                                                                    <option key={`opt-${idx}-${i}`} value={ach}>{ach}</option>
                                                                                                ))}
                                                                                                {valAch && !notableAchievementsOptions.includes(valAch) && (
                                                                                                    <option value={valAch}>{valAch}</option>
                                                                                                )}
                                                                                            </select>
                                                                                        </Field>
                                                                                        <Field label="Year Received">
                                                                                            <YearInput
                                                                                                disabled={!isEditing}
                                                                                                value={valYr}
                                                                                                onChange={val => updateAchievementEntry(idx, undefined, val)}
                                                                                                placeholder="YYYY"
                                                                                            />
                                                                                        </Field>
                                                                                    </div>
                                                                                </motion.div>
                                                                            );
                                                                        })}

                                                                        {isEditing && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setP('notable_achievements', [...achList, { title: '', year: '' }])}
                                                                                className="w-full py-4 border-2 border-dashed border-amber-300 bg-amber-50/30 rounded-2xl text-amber-800 font-black text-[15px] uppercase tracking-widest hover:border-amber-500 hover:bg-amber-50 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
                                                                            >
                                                                                <FiPlus size={14} /> Add Another Achievement Layer
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>

                                                        {/* Individual Accomplishments & Additional Awards */}
                                                        <div className="bg-white border-2 border-[#08315F] rounded-[22px] p-6 lg:p-8 space-y-5 shadow-none">
                                                            <SectionLabel color="#0038A8">Additional Awards &amp; Notable Accomplishments</SectionLabel>

                                                            <div className="bg-[#F4F8FB]/40 rounded-[2rem] p-5 border-2 border-blue-100 flex items-center gap-3">
                                                                <FiInfo size={16} className="text-blue-400 shrink-0" />
                                                                <p className="text-[15px] font-bold text-[#075985]">List any additional awards, recognitions, or notable individual accomplishments (supports multiple awards with different years).</p>
                                                            </div>

                                                            <div className="space-y-3">
                                                                {(profile.individual_accomplishments || []).map((acc, idx) => {
                                                                    // acc may be a plain string (legacy/new) or { id, description, award_year } (loaded from relational table)
                                                                    const accText = typeof acc === 'object' && acc !== null ? (acc.description || '') : (acc || '');
                                                                    const accYear = typeof acc === 'object' && acc !== null ? (acc.award_year || '') : '';
                                                                    const accId = typeof acc === 'object' && acc !== null ? acc.id : undefined;
                                                                    return (
                                                                        <motion.div key={accId || `acc-${idx}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-slate-50/40 hover:bg-transparent p-4 rounded-2xl border-2 border-slate-200/50 transition-colors shadow-sm">
                                                                            <input disabled={!isEditing}
                                                                                type="text"
                                                                                maxLength={150}
                                                                                value={accText}
                                                                                onChange={e => {
                                                                                    const newAccs = [...(profile.individual_accomplishments || [])];
                                                                                    const val = e.target.value;
                                                                                    newAccs[idx] = typeof acc === 'object' && acc !== null
                                                                                        ? { ...acc, description: val }
                                                                                        : { description: val, award_year: accYear };
                                                                                    setP('individual_accomplishments', newAccs);
                                                                                }}
                                                                                placeholder="Award / Recognition / Notable accomplishment title"
                                                                                className="bg-white border-2 border-slate-200 focus:border-[#0038A8] focus:ring-2 focus:ring-blue-50/50 rounded-xl px-3.5 py-2 text-[15px] sm:text-[16px] font-semibold text-slate-800 outline-none transition-all flex-1 min-h-[44px] h-[44px] shadow-sm w-full"
                                                                            />
                                                                            <div className="w-full sm:w-44 md:w-52 shrink-0">
                                                                                <YearInput disabled={!isEditing}
                                                                                    value={accYear}
                                                                                    onChange={val => {
                                                                                        const newAccs = [...(profile.individual_accomplishments || [])];
                                                                                        newAccs[idx] = typeof acc === 'object' && acc !== null
                                                                                            ? { ...acc, award_year: val }
                                                                                            : { description: accText, award_year: val };
                                                                                        setP('individual_accomplishments', newAccs);
                                                                                    }}
                                                                                    placeholder="Year (YYYY)"
                                                                                />
                                                                            </div>
                                                                            {isEditing && <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    const newAccs = (profile.individual_accomplishments || []).filter((_, i) => i !== idx);
                                                                                    setP('individual_accomplishments', newAccs);
                                                                                }}
                                                                                className="w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 self-end sm:self-center bg-[#FBBF24]/10 text-[#FBBF24] rounded-xl hover:bg-[#FBBF24] hover:text-white transition-all cursor-pointer"
                                                                                title="Remove Award"
                                                                            >
                                                                                <FiTrash2 size={16} />
                                                                            </button>}
                                                                        </motion.div>
                                                                    );
                                                                })}
                                                                {isEditing && <button disabled={!isEditing}
                                                                    type="button"
                                                                    onClick={() => setP('individual_accomplishments', [...(profile.individual_accomplishments || []), { description: '', award_year: '' }])}
                                                                    className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 font-black text-[15px] uppercase tracking-widest hover:border-[#0038A8] hover:text-[#08315F] transition-all flex items-center justify-center gap-2 mt-2"
                                                                >
                                                                    <FiPlus size={14} /> Add Award / Notable Accomplishment
                                                                </button>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ── PROFESSIONAL DEVELOPMENT TRAININGS ── */}
                                                {tab === 'trainings' && (
                                                    <div className="space-y-6">
                                                        <div className="bg-white border-2 border-[#08315F] rounded-[22px] p-6 lg:p-8 space-y-5 shadow-none">
                                                            <SectionLabel color="#0038A8">Professional Development Trainings</SectionLabel>

                                                            <div className="bg-[#F4F8FB]/40 rounded-[2rem] p-5 border-2 border-blue-100 flex items-center gap-3">
                                                                <FiInfo size={16} className="text-blue-400 shrink-0" />
                                                                <p className="text-[15px] font-bold text-[#075985]">List all relevant trainings, seminars, and professional development programs attended. Include the total number of training hours accumulated.</p>
                                                            </div>

                                                            {/* Total Training Hours */}
                                                            <Field label="Total Number of Training Hours (Auto-computed)">
                                                                <div className="bg-slate-100 rounded-2xl py-3 px-5 text-[21px] font-black text-[#08315F] border-2 border-slate-200">
                                                                    {profile.total_training_hours || '0'} Hours
                                                                </div>
                                                            </Field>

                                                            {/* Trainings List */}
                                                            <div className="space-y-3">
                                                                <div className="hidden xl:grid grid-cols-[minmax(0,1fr)_140px_140px_80px_80px_44px] gap-3 px-2">
                                                                    {['Training / Seminar Name', 'Date From', 'Date To', 'Hrs/Day', 'Total Hrs', ''].map(h => (
                                                                        <span key={h} className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest">{h}</span>
                                                                    ))}
                                                                </div>
                                                                {trainings.map((tr, idx) => (
                                                                    <motion.div key={tr.id || tr.training_id || `tr-${idx}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_140px_140px_80px_80px_44px] gap-3 items-center bg-slate-50/40 hover:bg-transparent p-4 rounded-2xl border-2 border-slate-200/50 transition-colors shadow-sm">
                                                                        <input disabled={!isEditing} type="text" value={tr.training_name || ''} onChange={e => setTrainings(t => t.map((x, i) => i === idx ? { ...x, training_name: e.target.value.toUpperCase() } : x))} placeholder="Training / Seminar name" className="bg-white border-2 border-slate-200 focus:border-[#0038A8] focus:ring-2 focus:ring-blue-50/50 rounded-xl px-3 py-2 text-[18px] font-semibold text-slate-800 outline-none transition-all min-w-0 shadow-sm" />
                                                                        <div className="relative">
                                                                            <ModernDatePicker disabled={!isEditing} value={tr.date_from ? tr.date_from.split('T')[0] : (tr.date_completed ? tr.date_completed.split('T')[0] : '')} onChange={val => handleTrainingDateChange(idx, 'date_from', val)} className="bg-white border-2 border-slate-200 focus:border-[#0038A8] focus:ring-2 focus:ring-blue-50/50 rounded-xl px-3 py-2 text-[18px] font-semibold text-slate-800 outline-none transition-all w-full shadow-sm" />
                                                                        </div>
                                                                        <div className="relative">
                                                                            <ModernDatePicker disabled={!isEditing} value={tr.date_to ? tr.date_to.split('T')[0] : (tr.date_completed ? tr.date_completed.split('T')[0] : '')} onChange={val => handleTrainingDateChange(idx, 'date_to', val)} minDate={tr.date_from ? new Date(tr.date_from) : undefined} className="bg-white border-2 border-slate-200 focus:border-[#0038A8] focus:ring-2 focus:ring-blue-50/50 rounded-xl px-3 py-2 text-[18px] font-semibold text-slate-800 outline-none transition-all w-full shadow-sm" />
                                                                            {tr.date_from && (tr.date_to || tr.date_completed) && new Date(tr.date_to || tr.date_completed) <= new Date(tr.date_from) && (
                                                                                <p className="text-red-500 text-[15px] mt-1 font-semibold absolute -bottom-5">Must be after From Date.</p>
                                                                            )}
                                                                        </div>
                                                                        <select disabled={!isEditing} value={tr.hours_per_day || '8'} onChange={e => handleTrainingDateChange(idx, 'hours_per_day', e.target.value)} className="bg-white border-2 border-slate-200 rounded-xl px-2 py-2 text-[18px] font-bold outline-none focus:border-[#0038A8] transition-all min-w-0 cursor-pointer shadow-sm">
                                                                            <option value="8">8 hrs</option>
                                                                            <option value="4">4 hrs</option>
                                                                            <option value="2">2 hrs</option>
                                                                        </select>
                                                                        <input disabled={!isEditing} type="number" min="0" max="999" step="0.5" value={tr.hours || ''} onChange={e => { let v = e.target.value; if (v !== '' && Number(v) > 999) v = '999'; setTrainings(t => t.map((x, i) => i === idx ? { ...x, hours: v } : x)); }} placeholder="Total" className="bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-[18px] font-bold outline-none focus:border-[#0038A8] transition-all min-w-0" />
                                                                        {isEditing && <button onClick={() => handleRemoveTraining(idx)} className="w-11 h-11 flex items-center justify-center bg-[#FBBF24]/10 text-[#FBBF24] rounded-xl hover:bg-[#FBBF24] hover:text-white transition-all"><FiTrash2 size={14} /></button>}
                                                                    </motion.div>
                                                                ))}
                                                                {isEditing && <button onClick={handleAddTraining} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black text-[15px] uppercase tracking-widest hover:border-[#0038A8] hover:text-[#08315F] transition-all flex items-center justify-center gap-2 mt-2">
                                                                    <FiPlus size={14} /> Add Training
                                                                </button>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ── DOCUMENTS ── */}
                                                {tab === 'documents' && (
                                                    <div className="space-y-6">
                                                        <div className="flex items-start gap-4 p-6 bg-[#F4F8FB] rounded-[2rem] border-2 border-blue-100">
                                                            <FiInfo className="text-[#08315F] mt-1 shrink-0" size={18} />
                                                            <p className="text-[16.5px] font-bold text-[#08315F] leading-relaxed">
                                                                Document uploads are processed by the Personnel Division. Files will be stored securely in the system once upload integration is completed. The reference IDs below track which documents have been linked to your profile.
                                                            </p>
                                                        </div>
                                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                                            {[
                                                                { id: 'pds', label: 'Personal Data Sheet (PDS)', note: 'PDF/Word - properly signed & notarized', accept: '.pdf,.doc,.docx' },
                                                                { id: 'service_records', label: 'Service Records', note: 'PDF - certified true copy', accept: '.pdf' },
                                                            ].map(({ id, label, note, accept }) => (
                                                                <div key={id} className="flex flex-col justify-between gap-4 p-6 bg-slate-50/40 hover:bg-slate-50/70 border-2 border-slate-200/60 rounded-3xl transition-all duration-300 shadow-sm hover:shadow-md min-w-0 overflow-hidden">
                                                                    <div className="flex items-center gap-3 min-w-0">
                                                                        <div className="w-10 h-10 bg-white border border-slate-200/80 rounded-xl flex items-center justify-center text-[#08315F] shadow-xs shrink-0"><FiFileText size={18} /></div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-[16.5px] font-['Plus_Jakarta_Sans'] font-black text-[#08315F] leading-tight truncate">{label}</p>
                                                                            <p className="text-[13.5px] font-bold text-slate-400 italic mt-0.5 truncate">{note}</p>
                                                                        </div>
                                                                        {profile[`${id}_binary_id`] && (
                                                                            <div className="text-emerald-600 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full flex items-center gap-1.5 text-[12px] font-black uppercase tracking-wider shrink-0">
                                                                                <FiCheckCircle size={13} /> Linked
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {!profile[`${id}_binary_id`] ? (
                                                                        <div className="relative group/upload w-full h-11">
                                                                            <input disabled={!isEditing}
                                                                                type="file"
                                                                                accept={accept}
                                                                                onChange={(e) => {
                                                                                    const file = e.target.files[0];
                                                                                    if (file) handleFileUpload(file, id);
                                                                                }}
                                                                                className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full disabled:cursor-not-allowed"
                                                                            />
                                                                            <div className="h-full w-full flex items-center justify-center gap-2.5 border-2 border-dashed border-slate-300 rounded-xl px-4 py-2 text-slate-500 bg-white group-hover/upload:border-[#0038A8] group-hover/upload:text-[#08315F] group-hover/upload:bg-blue-50/20 transition-all duration-200 shadow-xs group-hover/upload:shadow-sm">
                                                                                <FiUpload size={14} className={uploadingDocs[id] ? 'animate-bounce text-[#0038A8]' : 'transition-transform group-hover/upload:-translate-y-0.5'} />
                                                                                <span className="text-[14px] font-black uppercase tracking-wider truncate">
                                                                                    {uploadingDocs[id] ? 'Processing...' : 'Upload Document'}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-2 w-full min-w-0">
                                                                            <div className="relative group/upload flex-1 min-w-0 h-10">
                                                                                <input disabled={!isEditing}
                                                                                    type="file"
                                                                                    accept={accept}
                                                                                    onChange={(e) => {
                                                                                        const file = e.target.files[0];
                                                                                        if (file) handleFileUpload(file, id);
                                                                                    }}
                                                                                    className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full disabled:cursor-not-allowed"
                                                                                    title={isEditing ? 'Click to replace document' : 'Document uploaded (editing disabled)'}
                                                                                />
                                                                                <div className="h-full w-full flex items-center justify-between gap-2 border-2 border-dashed border-emerald-300/80 bg-emerald-50/50 group-hover/upload:bg-emerald-50/80 group-hover/upload:border-emerald-400 rounded-xl px-3 transition-all duration-200 shadow-xs">
                                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                                        <FiUpload size={14} className={`text-emerald-700 shrink-0 ${uploadingDocs[id] ? 'animate-bounce' : 'transition-transform group-hover/upload:-translate-y-0.5'}`} />
                                                                                        <span className="text-[13px] font-black uppercase tracking-wider text-emerald-800 truncate">
                                                                                            {uploadingDocs[id] ? 'Processing...' : (uploadedFileNames[id] ? `Saved ✓ — ${uploadedFileNames[id]}` : 'Document on file ✓')}
                                                                                        </span>
                                                                                    </div>
                                                                                    {isEditing && (
                                                                                        <span className="text-[11px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-100/90 hover:bg-emerald-200/80 px-2 py-0.5 rounded-md shrink-0 border border-emerald-300/60 transition-colors">
                                                                                            Replace
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <div className="grid grid-cols-2 xl:flex items-center gap-2 shrink-0">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleViewDocument(profile[`${id}_binary_id`])}
                                                                                    className="h-10 flex items-center justify-center gap-2 border-2 border-slate-200 hover:border-[#08315F] rounded-xl px-4 text-[13px] font-black uppercase tracking-wider text-[#08315F] bg-white hover:bg-slate-50 transition-all duration-200 shadow-xs hover:shadow-sm group/view active:scale-[0.98]"
                                                                                    title="View Document"
                                                                                >
                                                                                    <FiEye size={14} className="group-hover/view:scale-110 transition-transform text-[#0038A8]" />
                                                                                    <span>View</span>
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleDownloadDocument(profile[`${id}_binary_id`], label)}
                                                                                    className="h-10 flex items-center justify-center gap-2 border-2 border-slate-200 hover:border-[#08315F] rounded-xl px-4 text-[13px] font-black uppercase tracking-wider text-[#08315F] bg-white hover:bg-slate-50 transition-all duration-200 shadow-xs hover:shadow-sm group/download active:scale-[0.98]"
                                                                                    title="Download Document"
                                                                                >
                                                                                    <FiDownload size={14} className="group-hover/download:-translate-y-0.5 transition-transform text-[#0038A8]" />
                                                                                    <span>Download</span>
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ── LEGAL ── */}
                                                {tab === 'legal' && (
                                                    <div className="space-y-6">
                                                        <div className="flex items-start gap-4 p-6 bg-amber-50 rounded-[2rem] border-2 border-amber-200">
                                                            <FiAlertTriangle className="text-amber-500 mt-1 shrink-0" size={20} />
                                                            <div>
                                                                <p className="text-[16.5px] font-black text-amber-800 uppercase tracking-widest mb-1">Confidential Section</p>
                                                                <p className="text-[16.5px] font-bold text-amber-700 leading-relaxed">
                                                                    This section is optional and strictly confidential per civil service guidelines. You may opt not to disclose. Information entered here is accessible only to authorized Personnel Division personnel.
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="bg-white border-2 border-[#08315F] rounded-[22px] p-8 shadow-none space-y-6">
                                                            <Field label="Pending Administrative Case/s?">
                                                                <div className="flex gap-1.5 p-1 bg-slate-100/70 rounded-xl max-w-xs border-2 border-slate-200/40">
                                                                    {[{ val: 'Yes', label: 'Yes' }, { val: 'No', label: 'No' }].map(opt => (
                                                                        <button disabled={!isEditing}
                                                                            key={opt.val}
                                                                            onClick={() => setP('pending_admin_case', opt.val)}
                                                                            className={`w-full py-3 px-4 rounded-xl font-black text-[16.5px] uppercase tracking-widest transition-all
                                                                        ${profile.pending_admin_case?.toUpperCase() === opt.val.toUpperCase()
                                                                                    ? 'bg-[#0038A8] text-white shadow-lg shadow-[#0038A8]/20'
                                                                                    : 'bg-white border-2 border-slate-100 text-slate-400 hover:border-[#0038A8] hover:text-[#0038A8]'
                                                                                }`}
                                                                        >
                                                                            {opt.label}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </Field>
                                                            <div className="space-y-6">
                                                                <Field label="Have you ever been found guilty of any administrative offense?">
                                                                    <div className="flex gap-1.5 p-1 bg-slate-100/70 rounded-xl max-w-xs border-2 border-slate-200/40">
                                                                        {[{ val: 'Yes', label: 'Yes' }, { val: 'No', label: 'No' }].map(opt => (
                                                                            <button disabled={!isEditing}
                                                                                key={opt.val}
                                                                                onClick={() => setP('guilty_admin_details', opt.val)}
                                                                                className={`w-full py-3 px-4 rounded-xl font-black text-[16.5px] uppercase tracking-widest transition-all
                                                                            ${profile.guilty_admin_details?.toUpperCase() === opt.val.toUpperCase()
                                                                                        ? 'bg-[#0038A8] text-white shadow-lg shadow-[#0038A8]/20'
                                                                                        : 'bg-white border-2 border-slate-100 text-slate-400 hover:border-[#0038A8] hover:text-[#0038A8]'
                                                                                    }`}
                                                                            >
                                                                                {opt.label}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </Field>
                                                                <Field label="Have you been criminally charged before any court?">
                                                                    <div className="flex gap-1.5 p-1 bg-slate-100/70 rounded-xl max-w-xs border-2 border-slate-200/40">
                                                                        {[{ val: 'Yes', label: 'Yes' }, { val: 'No', label: 'No' }].map(opt => (
                                                                            <button disabled={!isEditing}
                                                                                key={opt.val}
                                                                                onClick={() => setP('criminally_charged_details', opt.val)}
                                                                                className={`w-full py-3 px-4 rounded-xl font-black text-[16.5px] uppercase tracking-widest transition-all
                                                                            ${profile.criminally_charged_details?.toUpperCase() === opt.val.toUpperCase()
                                                                                        ? 'bg-[#0038A8] text-white shadow-lg shadow-[#0038A8]/20'
                                                                                        : 'bg-white border-2 border-slate-100 text-slate-400 hover:border-[#0038A8] hover:text-[#0038A8]'
                                                                                    }`}
                                                                            >
                                                                                {opt.label}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </Field>
                                                                <Field label="Have you ever been convicted of any crime or violation of any law?">
                                                                    <div className="flex gap-1.5 p-1 bg-slate-100/70 rounded-xl max-w-xs border-2 border-slate-200/40">
                                                                        {[{ val: 'Yes', label: 'Yes' }, { val: 'No', label: 'No' }].map(opt => (
                                                                            <button disabled={!isEditing}
                                                                                key={opt.val}
                                                                                onClick={() => setP('convicted_crime_details', opt.val)}
                                                                                className={`w-full py-3 px-4 rounded-xl font-black text-[16.5px] uppercase tracking-widest transition-all
                                                                            ${profile.convicted_crime_details?.toUpperCase() === opt.val.toUpperCase()
                                                                                        ? 'bg-[#0038A8] text-white shadow-lg shadow-[#0038A8]/20'
                                                                                        : 'bg-white border-2 border-slate-100 text-slate-400 hover:border-[#0038A8] hover:text-[#0038A8]'
                                                                                    }`}
                                                                            >
                                                                                {opt.label}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </Field>
                                                            </div>
                                                            <div className="pt-6 border-t-2 border-slate-100 mt-6">
                                                                <Field label="Executive Summary of Pending Case/s, Copies of Complaints, Counter-Affidavits, and Other Supporting Documents">
                                                                    <div className="flex flex-col gap-3 p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl min-w-0 overflow-hidden">
                                                                        {!profile.executive_summary_binary_id ? (
                                                                            <div className="relative group/upload w-full h-11">
                                                                                <input disabled={!isEditing}
                                                                                    type="file"
                                                                                    accept=".pdf,.doc,.docx"
                                                                                    onChange={(e) => {
                                                                                        const file = e.target.files[0];
                                                                                        if (file) handleFileUpload(file, 'executive_summary');
                                                                                    }}
                                                                                    className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full disabled:cursor-not-allowed"
                                                                                />
                                                                                <div className="h-full w-full flex items-center justify-center gap-2.5 border-2 border-dashed border-slate-300 rounded-xl px-4 py-2.5 text-slate-500 bg-white group-hover/upload:border-[#0038A8] group-hover/upload:text-[#08315F] group-hover/upload:bg-blue-50/20 transition-all duration-200 shadow-xs group-hover/upload:shadow-sm">
                                                                                    <FiUpload size={14} className={uploadingDocs.executive_summary ? 'animate-bounce text-[#0038A8]' : 'transition-transform group-hover/upload:-translate-y-0.5'} />
                                                                                    <span className="text-[14px] font-black uppercase tracking-wider truncate">
                                                                                        {uploadingDocs.executive_summary ? 'Processing...' : 'Upload Document'}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-2 w-full min-w-0">
                                                                                <div className="relative group/upload flex-1 min-w-0 h-10">
                                                                                    <input disabled={!isEditing}
                                                                                        type="file"
                                                                                        accept=".pdf,.doc,.docx"
                                                                                        onChange={(e) => {
                                                                                            const file = e.target.files[0];
                                                                                            if (file) handleFileUpload(file, 'executive_summary');
                                                                                        }}
                                                                                        className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full disabled:cursor-not-allowed"
                                                                                        title={isEditing ? 'Click to replace document' : 'Document uploaded (editing disabled)'}
                                                                                    />
                                                                                    <div className="h-full w-full flex items-center justify-between gap-2 border-2 border-dashed border-emerald-300/80 bg-emerald-50/50 group-hover/upload:bg-emerald-50/80 group-hover/upload:border-emerald-400 rounded-xl px-3 transition-all duration-200 shadow-xs">
                                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                                            <FiUpload size={14} className={`text-emerald-700 shrink-0 ${uploadingDocs.executive_summary ? 'animate-bounce' : 'transition-transform group-hover/upload:-translate-y-0.5'}`} />
                                                                                            <span className="text-[13px] font-black uppercase tracking-wider text-emerald-800 truncate">
                                                                                                {uploadingDocs.executive_summary ? 'Processing...' : (uploadedFileNames.executive_summary ? `Saved ✓ — ${uploadedFileNames.executive_summary}` : 'Document on file ✓')}
                                                                                            </span>
                                                                                        </div>
                                                                                        {isEditing && (
                                                                                            <span className="text-[11px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-100/90 hover:bg-emerald-200/80 px-2 py-0.5 rounded-md shrink-0 border border-emerald-300/60 transition-colors">
                                                                                                Replace
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="grid grid-cols-2 xl:flex items-center gap-2 shrink-0">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleViewDocument(profile.executive_summary_binary_id)}
                                                                                        className="h-10 flex items-center justify-center gap-2 border-2 border-slate-200 hover:border-[#08315F] rounded-xl px-4 text-[13px] font-black uppercase tracking-wider text-[#08315F] bg-white hover:bg-slate-50 transition-all duration-200 shadow-xs hover:shadow-sm group/view active:scale-[0.98]"
                                                                                        title="View Document"
                                                                                    >
                                                                                        <FiEye size={14} className="group-hover/view:scale-110 transition-transform text-[#0038A8]" />
                                                                                        <span>View</span>
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleDownloadDocument(profile.executive_summary_binary_id, 'Executive Summary of Pending Case/s, Copies of Complaints, Counter-Affidavits, and Other Supporting Documents')}
                                                                                        className="h-10 flex items-center justify-center gap-2 border-2 border-slate-200 hover:border-[#08315F] rounded-xl px-4 text-[13px] font-black uppercase tracking-wider text-[#08315F] bg-white hover:bg-slate-50 transition-all duration-200 shadow-xs hover:shadow-sm group/download active:scale-[0.98]"
                                                                                        title="Download Document"
                                                                                    >
                                                                                        <FiDownload size={14} className="group-hover/download:-translate-y-0.5 transition-transform text-[#0038A8]" />
                                                                                        <span>Download</span>
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </Field>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}



                                                {/* ── SUMMARY & CERTIFY ── */}
                                                {tab === 'summary' && (
                                                    <div className="bg-slate-50 min-h-screen">
                                                        <div className="space-y-6">

                                                            {/* PROFILE SUMMARY */}
                                                            <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-8 relative">
                                                                <div className="absolute top-8 right-8 z-[51]">
                                                                    <button onClick={() => setExportModalOpen(!exportModalOpen)} className="flex items-center gap-2 bg-[#004a99] border-2 border-blue-400/30 px-5 py-2.5 rounded-lg text-white hover:bg-blue-700 font-bold text-[16.5px] transition-all shadow-sm relative z-[51]">
                                                                        <FiDownload size={18} /> Export Profile
                                                                    </button>
                                                                    <AnimatePresence>
                                                                        {/* Reusing existing exportModalOpen block logic but keeping it hidden inside this div */}
                                                                        {exportModalOpen && (
                                                                            /* existing export modal code will go here - I will retain the original modal code */
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
                                                                                            className="relative w-full max-w-[1200px] bg-white rounded-[2rem] shadow-2xl border-2 border-white/50 flex flex-col lg:flex-row overflow-hidden max-h-full"
                                                                                            onClick={e => e.stopPropagation()}
                                                                                        >
                                                                                            {/* Sidebar Options */}
                                                                                            <div className="w-full lg:w-64 bg-transparent border-r-2 border-slate-200 p-6 flex flex-col gap-3 shrink-0">
                                                                                                <div className="flex items-center justify-between mb-4">
                                                                                                    <div>
                                                                                                        <h2 className="text-[21px] font-['Plus_Jakarta_Sans'] font-black text-[#08315F] uppercase tracking-tight italic">Export Options</h2>
                                                                                                    </div>
                                                                                                    <button onClick={() => setExportModalOpen(false)} className="w-8 h-8 bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-full flex items-center justify-center transition-colors shadow-sm border-2 border-slate-200">
                                                                                                        <FiX size={18} />
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
                                                                                                        <opt.icon size={18} className={selectedExportType === opt.id ? opt.color : 'text-slate-400'} />
                                                                                                        <div>
                                                                                                            <p className={`text-[15px] font-black uppercase tracking-tight ${selectedExportType === opt.id ? opt.color : 'text-slate-600'}`}>{opt.label}</p>
                                                                                                        </div>
                                                                                                    </button>
                                                                                                ))}

                                                                                                <div className="mt-auto pt-6 flex flex-col gap-3">
                                                                                                    {selectedExportType === 'pdf' && (
                                                                                                        <button
                                                                                                            onClick={() => {
                                                                                                                const printContent = document.getElementById('pdf-preview-content').outerHTML;
                                                                                                                const printWindow = window.open('', '_blank');
                                                                                                                printWindow.document.write(`
                                                                                                                                                            <html>
                                                                                                                                                            <head>
                                                                                                                                                                <title>Print Profile</title>
                                                                                                                                                                <script src="https://cdn.tailwindcss.com"></script>
                                                                                                                                                                <style>
                                                                                                                                                                    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap');
                                                                                                                                                                    body { font-family: 'Plus Jakarta Sans', sans-serif; margin: 0; padding: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                                                                                                                                                                    @page { size: landscape; margin: 10mm; }
                                                                                                                                                                </style>
                                                                                                                                                            </head>
                                                                                                                                                            <body>
                                                                                                                                                                <div class="flex justify-center items-start w-full h-full">
                                                                                                                                                                    ${printContent}
                                                                                                                                                                </div>
                                                                                                                                                                <script>
                                                                                                                                                                    window.onload = function() {
                                                                                                                                                                        setTimeout(function() {
                                                                                                                                                                            window.print();
                                                                                                                                                                            window.close();
                                                                                                                                                                        }, 800);
                                                                                                                                                                    };
                                                                                                                                                                </script>
                                                                                                                                                            </body>
                                                                                                                                                            </html>
                                                                                                                                                        `);
                                                                                                                printWindow.document.close();
                                                                                                            }}
                                                                                                            disabled={exporting}
                                                                                                            className="w-full py-4 bg-emerald-600 text-white font-black text-[15px] uppercase tracking-widest rounded-xl shadow-xl hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                                                                                        >
                                                                                                            <FiPrinter size={18} />
                                                                                                            Print Document
                                                                                                        </button>
                                                                                                    )}
                                                                                                    <button
                                                                                                        onClick={() => {
                                                                                                            if (selectedExportType === 'csv') generateCSV();
                                                                                                            if (selectedExportType === 'pdf') generatePDF();
                                                                                                            if (selectedExportType === 'ppt') generatePPT();
                                                                                                        }}
                                                                                                        disabled={exporting}
                                                                                                        className="w-full py-4 bg-[#08315F] text-white font-black text-[15px] uppercase tracking-widest rounded-xl shadow-xl hover:bg-[#08315F] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                                                                                    >
                                                                                                        {exporting ? <FiLoader className="animate-spin" size={18} /> : <FiDownload size={18} />}
                                                                                                        {exporting ? 'Generating...' : `Download`}
                                                                                                    </button>
                                                                                                </div>
                                                                                            </div>

                                                                                            {/* Preview Area */}
                                                                                            <div ref={previewContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden p-6 lg:p-10 flex flex-col items-center bg-slate-100/50">
                                                                                                {selectedExportType === 'csv' && (
                                                                                                    <div className="w-full max-w-4xl bg-white border-2 border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                                                                                        <div className="bg-slate-800 px-4 py-3 flex items-center gap-2">
                                                                                                            <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-rose-500" /><div className="w-3 h-3 rounded-full bg-amber-500" /><div className="w-3 h-3 rounded-full bg-emerald-500" /></div>
                                                                                                            <span className="text-[16.5px] text-slate-300 font-mono ml-2">profile_{profile.last_name || 'export'}.csv</span>
                                                                                                        </div>
                                                                                                        <div className="p-0 overflow-x-auto custom-scrollbar">
                                                                                                            <table className="w-full text-left border-collapse text-[16.5px] font-mono whitespace-nowrap">
                                                                                                                <thead className="bg-transparent sticky top-0">
                                                                                                                    <tr className="border-b-2 border-slate-200 text-slate-500">
                                                                                                                        <th className="p-4 font-bold">Data Field</th><th className="p-4 font-bold">Exported Value</th>
                                                                                                                    </tr>
                                                                                                                </thead>
                                                                                                                <tbody>
                                                                                                                    {[
                                                                                                                        ['First Name', profile.first_name], ['Last Name', profile.last_name], ['Middle Name', profile.middle_name],
                                                                                                                        ['Gender', profile.gender], ['Date of Birth', profile.date_of_birth], ['Age', profile.age],
                                                                                                                        ['Phone Number', profile.alt_contact_details_1 || profile.contact_details], ['DepEd Email', profile.email || user?.email],
                                                                                                                        ['Alternative Email 1', profile.alt_email_1], ['Alternative Email 2', profile.alt_email_2],
                                                                                                                        ['Total Years in Third Level', profile.total_years_third_level],
                                                                                                                        ['Permanent Address', profile.permanent_address], ['Temporary Address', profile.temporary_address], ['CES Stage', profile.ces_stage],
                                                                                                                        ['Highest Education', profile.highest_education], ['Program / Course', profile.education_program],
                                                                                                                        ['Latest Rating', profile.performance_rating_1], ['Total Managerial Exp.', profile.managerial_experience_total],
                                                                                                                    ].map(([k, v], i) => (
                                                                                                                        <tr key={i} className="border-b-2 border-slate-100 text-slate-700 hover:bg-white bg-slate-50/30">
                                                                                                                            <td className="px-4 py-3 font-bold text-slate-500 border-r-2 border-slate-100">{k}</td><td className="px-4 py-3">{v || '—'}</td>
                                                                                                                        </tr>
                                                                                                                    ))}
                                                                                                                </tbody>
                                                                                                            </table>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                )}

                                                                                                {(selectedExportType === 'pdf' || selectedExportType === 'ppt') && (
                                                                                                    <div className="overflow-hidden flex justify-center w-full bg-slate-50/50 py-10 rounded-2xl border-2 border-slate-200 shadow-inner hide-scrollbar">
                                                                                                        <div className="bg-white shadow-2xl border-2 border-slate-200 transition-transform duration-200 shrink-0 w-[1000px]" style={{ transform: `scale(${previewScale * 0.5})`, transformOrigin: 'top center', marginBottom: `-${700 * (1 - previewScale * 0.5)}px` }}>
                                                                                                            <div className="p-8 mx-auto w-[1000px] min-h-[700px] relative font-['Plus_Jakarta_Sans'] text-black bg-white" id={selectedExportType === 'pdf' ? "pdf-preview-content" : "ppt-preview-content"}>
                                                                                                                <div className="absolute top-0 left-0 w-full h-2 bg-[#08315F]"></div>
                                                                                                                <div className="flex justify-between items-start mb-5 pt-2">
                                                                                                                    <div className="flex gap-5 items-center">
                                                                                                                        <img src={depedLogo} alt="Logo" className="w-20 h-20 object-contain" />
                                                                                                                        <div>
                                                                                                                            <h1 className="text-2xl font-black uppercase tracking-tight text-[#08315F]">{profile.last_name || ''}{sanitizeSuffix(profile.suffix) ? ` ${sanitizeSuffix(profile.suffix)}` : ''}, {profile.first_name || ''} {profile.middle_name || ''}</h1>
                                                                                                                            <h2 className="text-lg font-bold uppercase mt-1 text-slate-800 flex items-center gap-2 flex-wrap">
                                                                                                                                <span>{profile.position_title || 'N/A'}</span>
                                                                                                                                {profile.is_oic && <span className="px-2 py-0.5 rounded-full bg-[#FCD116] text-[#08315F] text-[9px] font-black uppercase tracking-widest leading-none">OIC</span>}
                                                                                                                                {profile.office ? `, ${profile.office}` : ''}
                                                                                                                            </h2>
                                                                                                                            {profile.designation &&
                                                                                                                                profile.designation.trim() !== '' &&
                                                                                                                                profile.designation.trim().toLowerCase() !== 'no designation' &&
                                                                                                                                profile.designation.trim().toLowerCase() !== 'none' &&
                                                                                                                                profile.designation.trim().toLowerCase() !== (profile.position_title || '').trim().toLowerCase() && (
                                                                                                                                    <p className="text-sm font-semibold italic text-[#08315F] mt-0.5">
                                                                                                                                        {profile.designation}
                                                                                                                                    </p>
                                                                                                                                )}
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                    <div className="flex gap-6 items-start">
                                                                                                                        <div className="w-[84px] h-[84px] bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 border-2 border-slate-200 uppercase tracking-widest shrink-0 overflow-hidden">
                                                                                                                            {profile.photo_binary_id ? (
                                                                                                                                <img src={apiUrl(`/api/binary/${profile.photo_binary_id}`)} alt="Photo" className="w-full h-full object-cover" />
                                                                                                                            ) : (
                                                                                                                                "2x2 Photo"
                                                                                                                            )}
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                                <div className="grid grid-cols-12 gap-8">
                                                                                                                    <div className="col-span-7 space-y-5">
                                                                                                                        <table className="w-full text-xs border-collapse">
                                                                                                                            <thead>
                                                                                                                                <tr><th colSpan={3} className="bg-[#08315F] text-white font-bold py-2 border-2 border-slate-400 text-center uppercase tracking-widest text-[11px]">Managerial Experience {profile.managerial_experience_total ? `— Total: ${profile.managerial_experience_total}` : ''}</th></tr>
                                                                                                                            </thead>
                                                                                                                            <tbody>
                                                                                                                                {(() => {
                                                                                                                                    const list = (prevPositions && prevPositions.length > 0) ? prevPositions : (history || []);
                                                                                                                                    const displayList = list.filter(h => h.position_title || h.position_name || h.office).slice(0, 4);
                                                                                                                                    if (displayList.length === 0) {
                                                                                                                                        return (
                                                                                                                                            <tr><td colSpan={3} className="border-2 border-slate-400 px-3 py-1.5 text-center text-slate-500 italic">No experience listed</td></tr>
                                                                                                                                        );
                                                                                                                                    }
                                                                                                                                    const rows = [];
                                                                                                                                    displayList.forEach((h, i) => {
                                                                                                                                        const title = h.position_title || h.position_name || '—';
                                                                                                                                        const officeName = h.office || '—';
                                                                                                                                        const dur = h.start_date ? calculateDuration(h.start_date, h.end_date) : { years: 0, months: 0 };
                                                                                                                                        rows.push(
                                                                                                                                            <tr key={`parent-${i}`} className="text-slate-800 bg-slate-50/30 font-semibold">
                                                                                                                                                <td className="border-2 border-slate-400 px-3 py-1.5 font-bold w-1/3">{title}</td>
                                                                                                                                                <td className="border-2 border-slate-400 px-3 py-1.5 w-1/3">{officeName}</td>
                                                                                                                                                <td className="border-2 border-slate-400 px-3 py-1.5 text-center font-medium">{dur.years} yrs., {dur.months} mos.</td>
                                                                                                                                            </tr>
                                                                                                                                        );
                                                                                                                                        if (h.oic_positions && Array.isArray(h.oic_positions) && h.oic_positions.length > 0) {
                                                                                                                                            h.oic_positions.forEach((oic, oicIdx) => {
                                                                                                                                                if (oic.oic_position_name || oic.oic_office) {
                                                                                                                                                    const oicTitle = oic.oic_position_name || 'OIC Position';
                                                                                                                                                    const oicOffice = oic.oic_office || '—';
                                                                                                                                                    const oicDur = oic.oic_start_date ? calculateDuration(oic.oic_start_date, oic.oic_end_date) : { years: 0, months: 0 };
                                                                                                                                                    rows.push(
                                                                                                                                                        <tr key={`child-${i}-${oicIdx}`} className="text-slate-700 text-[11px] bg-amber-50/50">
                                                                                                                                                            <td className="border-2 border-slate-400 px-3 py-1.5 pl-6 font-medium">
                                                                                                                                                                <span className="text-[#08315F] font-bold">└─ OIC:</span> {oicTitle}
                                                                                                                                                            </td>
                                                                                                                                                            <td className="border-2 border-slate-400 px-3 py-1.5 text-slate-600">{oicOffice}</td>
                                                                                                                                                            <td className="border-2 border-slate-400 px-3 py-1.5 text-center font-normal">{oicDur.years} yrs., {oicDur.months} mos.</td>
                                                                                                                                                        </tr>
                                                                                                                                                    );
                                                                                                                                                }
                                                                                                                                            });
                                                                                                                                        }
                                                                                                                                    });
                                                                                                                                    return rows;
                                                                                                                                })()}
                                                                                                                            </tbody>
                                                                                                                            {profile.managerial_experience_total && (
                                                                                                                                <tfoot>
                                                                                                                                    <tr className="bg-slate-100 font-bold text-slate-800">
                                                                                                                                        <td colSpan={2} className="border-2 border-slate-400 px-3 py-1.5 text-right font-black uppercase text-[10px] text-[#08315F] tracking-wider">
                                                                                                                                            Total Managerial Experience (As of {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}):
                                                                                                                                        </td>
                                                                                                                                        <td className="border-2 border-slate-400 px-3 py-1.5 text-center font-black text-[#08315F] text-[11px]">
                                                                                                                                            {profile.managerial_experience_total}
                                                                                                                                        </td>
                                                                                                                                    </tr>
                                                                                                                                </tfoot>
                                                                                                                            )}
                                                                                                                        </table>
                                                                                                                        <table className="w-full text-xs border-collapse">
                                                                                                                            <thead>
                                                                                                                                <tr><th colSpan={3} className="bg-[#08315F] text-white font-bold py-2 border-2 border-slate-400 text-center uppercase tracking-widest text-[11px]">Educational Attainment</th></tr>
                                                                                                                            </thead>
                                                                                                                            <tbody className="text-slate-800">
                                                                                                                                <tr>
                                                                                                                                    <td className="border-2 border-slate-400 px-3 py-1.5 w-1/4 font-medium text-center">Doctorate</td>
                                                                                                                                    <td className="border-2 border-slate-400 px-3 py-1.5 w-1/2">{profile.doctorate_degree || '—'}</td>
                                                                                                                                    <td className="border-2 border-slate-400 px-3 py-1.5 w-1/4 text-center font-medium">{profile.doctorate_year || '—'}</td>
                                                                                                                                </tr>
                                                                                                                                <tr>
                                                                                                                                    <td className="border-2 border-slate-400 px-3 py-1.5 w-1/4 font-medium text-center">Master's Degree</td>
                                                                                                                                    <td className="border-2 border-slate-400 px-3 py-1.5 w-1/2">{profile.master_degree || '—'}</td>
                                                                                                                                    <td className="border-2 border-slate-400 px-3 py-1.5 w-1/4 text-center font-medium">{profile.master_year || '—'}</td>
                                                                                                                                </tr>
                                                                                                                                <tr>
                                                                                                                                    <td className="border-2 border-slate-400 px-3 py-1.5 w-1/4 font-medium text-center">Baccalaureate</td>
                                                                                                                                    <td className="border-2 border-slate-400 px-3 py-1.5 w-1/2">{profile.bachelor_degree || '—'}</td>
                                                                                                                                    <td className="border-2 border-slate-400 px-3 py-1.5 w-1/4 text-center font-medium">{profile.bachelor_year || '—'}</td>
                                                                                                                                </tr>
                                                                                                                            </tbody>
                                                                                                                        </table>
                                                                                                                    </div>
                                                                                                                    <div className="col-span-5 space-y-5 relative">
                                                                                                                        <div className="absolute -top-12 left-0 w-20">
                                                                                                                            <div className="bg-amber-500 text-white font-bold py-0.5 text-center text-[10px] uppercase tracking-widest">Age</div>
                                                                                                                            <div className="border-2 border-amber-500 py-1 text-center font-bold text-base text-[#08315F] bg-white">{profile.age || '—'}</div>
                                                                                                                        </div>
                                                                                                                        <table className="w-full text-xs border-collapse mt-8">
                                                                                                                            <thead>
                                                                                                                                <tr><th colSpan={3} className="bg-red-700 text-white font-bold py-2 border-2 border-red-700 text-center uppercase tracking-widest text-[11px]">Performance Rating</th></tr>
                                                                                                                                <tr className="bg-red-50 text-[10px] font-black text-red-900 border-2 border-slate-400">
                                                                                                                                    <th className="px-3 py-1 text-left border-2 border-slate-400">Period / Type</th>
                                                                                                                                    <th className="px-2 py-1 text-center border-2 border-slate-400 w-16">Year</th>
                                                                                                                                    <th className="px-2 py-1 text-center border-2 border-slate-400 w-16">Rating</th>
                                                                                                                                </tr>
                                                                                                                            </thead>
                                                                                                                            <tbody className="text-slate-800">
                                                                                                                                {(() => {
                                                                                                                                    const extractPdfYear = (p) => {
                                                                                                                                        if (!p) return '—';
                                                                                                                                        const m = String(p).match(/\b(19\d\d|20\d\d)\b/);
                                                                                                                                        return m ? m[1] : (String(p).split('-')[0] || String(p));
                                                                                                                                    };
                                                                                                                                    const rows = [];
                                                                                                                                    if (profile.cespes_1_rating) rows.push(
                                                                                                                                        <tr key="cespes-1"><td className="border-2 border-slate-400 px-3 py-1.5">{profile.cespes_rating_1_period || ''} 1st sem (CESPES)</td><td className="border-2 border-slate-400 px-2 py-1.5 text-center font-semibold text-slate-600">{extractPdfYear(profile.cespes_rating_1_period)}</td><td className="border-2 border-slate-400 px-3 py-1.5 text-center font-black">{profile.cespes_1_rating}</td></tr>
                                                                                                                                    );
                                                                                                                                    if (profile.cespes_2_rating) rows.push(
                                                                                                                                        <tr key="cespes-2"><td className="border-2 border-slate-400 px-3 py-1.5">{profile.cespes_rating_2_period || ''} 2nd sem (CESPES)</td><td className="border-2 border-slate-400 px-2 py-1.5 text-center font-semibold text-slate-600">{extractPdfYear(profile.cespes_rating_2_period)}</td><td className="border-2 border-slate-400 px-3 py-1.5 text-center font-black">{profile.cespes_2_rating}</td></tr>
                                                                                                                                    );
                                                                                                                                    if (profile.performance_rating_1) rows.push(
                                                                                                                                        <tr key="opcrf-1"><td className="border-2 border-slate-400 px-3 py-1.5">{profile.performance_rating_1_period || ''} (OPCRF)</td><td className="border-2 border-slate-400 px-2 py-1.5 text-center font-semibold text-slate-600">{extractPdfYear(profile.performance_rating_1_period)}</td><td className="border-2 border-slate-400 px-3 py-1.5 text-center font-black">{profile.performance_rating_1}</td></tr>
                                                                                                                                    );
                                                                                                                                    if (profile.performance_rating_2) rows.push(
                                                                                                                                        <tr key="opcrf-2"><td className="border-2 border-slate-400 px-3 py-1.5">{profile.performance_rating_2_period || ''} (OPCRF)</td><td className="border-2 border-slate-400 px-2 py-1.5 text-center font-semibold text-slate-600">{extractPdfYear(profile.performance_rating_2_period)}</td><td className="border-2 border-slate-400 px-3 py-1.5 text-center font-black">{profile.performance_rating_2}</td></tr>
                                                                                                                                    );
                                                                                                                                    if (profile.performance_rating_3) rows.push(
                                                                                                                                        <tr key="opcrf-3"><td className="border-2 border-slate-400 px-3 py-1.5">{profile.performance_rating_3_period || ''} (OPCRF)</td><td className="border-2 border-slate-400 px-2 py-1.5 text-center font-semibold text-slate-600">{extractPdfYear(profile.performance_rating_3_period)}</td><td className="border-2 border-slate-400 px-3 py-1.5 text-center font-black">{profile.performance_rating_3}</td></tr>
                                                                                                                                    );
                                                                                                                                    if (rows.length === 0) {
                                                                                                                                        return <tr><td colSpan={3} className="border-2 border-slate-400 px-3 py-2 text-center text-slate-400 italic">No ratings listed</td></tr>;
                                                                                                                                    }
                                                                                                                                    return rows;
                                                                                                                                })()}
                                                                                                                            </tbody>
                                                                                                                        </table>
                                                                                                                        <table className="w-full text-xs border-collapse">
                                                                                                                            <thead>
                                                                                                                                <tr><th colSpan={2} className="bg-red-700 text-white font-bold py-2 border-2 border-red-700 text-center uppercase tracking-widest text-[11px]">Eligibility</th></tr>
                                                                                                                            </thead>
                                                                                                                            <tbody className="text-slate-800">
                                                                                                                                <tr>
                                                                                                                                    <td className="border-2 border-slate-400 px-3 py-1.5 font-medium">Career Executive Service (CES): {profile.ces_stage || 'Not Applicable'}</td>
                                                                                                                                    <td className="border-2 border-slate-400 px-3 py-1.5 text-center font-black">{profile.ces_conferment_date || '—'}</td>
                                                                                                                                </tr>
                                                                                                                                <tr>
                                                                                                                                    <td className="border-2 border-slate-400 px-3 py-1.5 font-medium">Educational Management Test (EMT): {profile.emt_passer === true ? 'Passed' : profile.emt_passer === false ? 'Not Passed' : 'Not Applicable'}</td>
                                                                                                                                    <td className="border-2 border-slate-400 px-3 py-1.5 text-center font-black">{profile.emt_date || '—'}</td>
                                                                                                                                </tr>
                                                                                                                            </tbody>
                                                                                                                        </table>
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
                                                                        )}
                                                                    </AnimatePresence>
                                                                </div>

                                                                <div className="flex items-center gap-3 mb-8">
                                                                    <FiUser className="text-[#08315F]" size={24} />
                                                                    <h2 className="text-[21px] font-black text-[#08315F] uppercase tracking-widest">Profile Summary</h2>
                                                                </div>

                                                                {/* Personal Information */}
                                                                <div className="mb-8">
                                                                    <h3 className="text-[15px] font-bold text-slate-400 uppercase tracking-widest mb-4">Personal Information</h3>
                                                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                                                                        <div><p className="text-[15px] text-slate-400 mb-1">First Name</p><p className="text-[18px] font-black text-slate-800 uppercase">{profile.first_name || '—'}</p></div>
                                                                        <div><p className="text-[15px] text-slate-400 mb-1">Last Name</p><p className="text-[18px] font-black text-slate-800 uppercase">{profile.last_name || '—'}</p></div>
                                                                        <div><p className="text-[15px] text-slate-400 mb-1">Middle Name</p><p className="text-[18px] font-black text-slate-800 uppercase">{profile.middle_name || '—'}</p></div>
                                                                        <div><p className="text-[15px] text-slate-400 mb-1">Suffix</p><p className="text-[18px] font-black text-slate-800 uppercase">{sanitizeSuffix(profile.suffix) || '—'}</p></div>
                                                                        <div>
                                                                            <p className="text-[15px] text-slate-400 mb-1">DepEd Email</p>
                                                                            <p className="text-[18px] font-black text-slate-800 lowercase break-all">{profile.email || user?.email || '—'}</p>
                                                                        </div>

                                                                        <div className="flex items-start gap-2">
                                                                            <FiUser size={18} className="text-blue-500 mt-0.5" />
                                                                            <div><p className="text-[15px] text-slate-400 mb-1">Gender</p><p className="text-[18px] font-black text-slate-800 uppercase">{profile.gender || '—'}</p></div>
                                                                        </div>
                                                                        <div className="flex items-start gap-2">
                                                                            <FiCalendar size={18} className="text-blue-500 mt-0.5" />
                                                                            <div><p className="text-[15px] text-slate-400 mb-1">Date of Birth</p><p className="text-[18px] font-black text-slate-800 uppercase">{profile.date_of_birth || '—'}</p></div>
                                                                        </div>
                                                                        <div className="flex items-start gap-2">
                                                                            <FiUser size={18} className="text-blue-500 mt-0.5" />
                                                                            <div><p className="text-[15px] text-slate-400 mb-1">Age</p><p className="text-[18px] font-black text-slate-800 uppercase">{profile.age || '—'}</p></div>
                                                                        </div>
                                                                        <div className="flex items-start gap-2">
                                                                            <FiHeart size={18} className="text-blue-500 mt-0.5" />
                                                                            <div><p className="text-[15px] text-slate-400 mb-1">Civil Status</p><p className="text-[18px] font-black text-slate-800 uppercase">{profile.civil_status || '—'}</p></div>
                                                                        </div>
                                                                        <div className="flex items-start gap-2">
                                                                            <FiStar size={18} className="text-blue-500 mt-0.5" />
                                                                            <div><p className="text-[15px] text-slate-400 mb-1">Target Vacancy</p>
                                                                                <p className="text-[18px] font-black text-slate-800 uppercase">
                                                                                    {(() => {
                                                                                        const vac = targetVacancyId ? vacancies.find(x => x.TLOid === targetVacancyId) : null;
                                                                                        return vac ? vac.position_title : '—';
                                                                                    })()}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="w-full h-0.5 bg-slate-200 my-8"></div>

                                                                {/* Designation & Appointment */}
                                                                <div className="mb-8">
                                                                    <h3 className="text-[15px] font-bold text-slate-400 uppercase tracking-widest mb-4">Designation & Appointment</h3>
                                                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                                                                        <div className="col-span-2">
                                                                            <p className="text-[15px] text-slate-400 mb-1">Position Title</p>
                                                                            <div className="flex items-center gap-2">
                                                                                <p className="text-[18px] font-black text-slate-800 uppercase">{profile.position_title || '—'}</p>
                                                                                {profile.is_oic && <span className="px-1.5 py-0.5 rounded bg-[#FCD116] text-[#08315F] text-[13.5px] font-black uppercase">OIC</span>}
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-start gap-2">
                                                                            <FiCalendar size={18} className="text-blue-500 mt-0.5" />
                                                                            <div><p className="text-[15px] text-slate-400 mb-1">Date of Present Position</p><p className="text-[18px] font-black text-slate-800 uppercase">{profile.appointment_date || '—'}</p></div>
                                                                        </div>
                                                                        <div className="flex items-start gap-2">
                                                                            <FiHome size={18} className="text-blue-500 mt-0.5" />
                                                                            <div><p className="text-[15px] text-slate-400 mb-1">Permanent Address</p><p className="text-[18px] font-black text-slate-800 uppercase">{profile.permanent_address || '—'}</p></div>
                                                                        </div>
                                                                        <div className="flex items-start gap-2">
                                                                            <FiMapPin size={18} className="text-blue-500 mt-0.5" />
                                                                            <div><p className="text-[15px] text-slate-400 mb-1">Temporary Address</p><p className="text-[18px] font-black text-slate-800 uppercase">{profile.temporary_address || '—'}</p></div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="w-full h-0.5 bg-slate-200 my-8"></div>

                                                                {/* Eligibility */}
                                                                <div>
                                                                    <h3 className="text-[15px] font-bold text-slate-400 uppercase tracking-widest mb-4">Eligibility</h3>
                                                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 mb-8">
                                                                        <div className="col-span-2"><p className="text-[15px] text-slate-400 mb-1">Career Executive Service (CES)</p><p className="text-[18px] font-black text-slate-800 uppercase">{profile.ces_stage || '—'}</p></div>
                                                                        <div className="flex items-start gap-2">
                                                                            <FiCalendar size={18} className="text-blue-500 mt-0.5" />
                                                                            <div><p className="text-[15px] text-slate-400 mb-1">CES Conferment Date</p><p className="text-[18px] font-black text-slate-800 uppercase">{profile.ces_conferment_date || '—'}</p></div>
                                                                        </div>
                                                                        <div className="flex items-start gap-2">
                                                                            <FiBookOpen size={18} className="text-blue-500 mt-0.5" />
                                                                            <div><p className="text-[15px] text-slate-400 mb-1">Educational Management Test (EMT)</p><p className="text-[18px] font-black text-slate-800 uppercase">{profile.emt_passer === true ? 'Yes' : profile.emt_passer === false ? 'No' : '—'}</p></div>
                                                                        </div>
                                                                        <div className="flex items-start gap-2">
                                                                            <FiCalendar size={18} className="text-blue-500 mt-0.5" />
                                                                            <div><p className="text-[15px] text-slate-400 mb-1">EMT Date</p><p className="text-[18px] font-black text-slate-800 uppercase">{profile.emt_date || '—'}</p></div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Eligibilities List */}
                                                                    {profile.eligibilities && profile.eligibilities.length > 0 && (
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
                                                                            {profile.eligibilities.map((elig, idx) => {
                                                                                const name = elig.eligibility || elig.title || 'Untitled';
                                                                                const meta = [
                                                                                    elig.rating ? `Rating: ${elig.rating}` : '',
                                                                                    elig.date ? `Date: ${new Date(elig.date).toLocaleDateString()}` : '',
                                                                                    elig.place_of_assignment ? `Place: ${elig.place_of_assignment}` : ''
                                                                                ].filter(Boolean).join(' | ');

                                                                                return (
                                                                                    <div key={idx} className="flex items-center justify-between">
                                                                                        <div className="flex items-center gap-2 text-[16.5px]">
                                                                                            <span className="font-black text-blue-600 uppercase w-24">{name}:</span>
                                                                                            <span className="text-slate-600">{meta || '—'}</span>
                                                                                        </div>
                                                                                        {/* Star Rating Visualization (dummy logic if not real rating format, but image shows stars) */}
                                                                                        <div className="flex text-yellow-400 gap-0.5">
                                                                                            {[1, 2, 3, 4, 5].map(star => (
                                                                                                <FiStar key={star} size={14} fill={(elig.rating && parseInt(elig.rating) >= star) ? 'currentColor' : 'none'} className={(elig.rating && parseInt(elig.rating) >= star) ? '' : 'text-slate-200'} />
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* EDUCATION */}
                                                            <div className="mb-10">
                                                                <div className="flex items-center gap-4 mb-6 px-2">
                                                                    <div className="w-12 h-12 bg-blue-50 text-[#0038A8] rounded-full flex items-center justify-center shadow-sm border-2 border-blue-100/50">
                                                                        <FiAward size={22} />
                                                                    </div>
                                                                    <div>
                                                                        <h2 className="text-[21px] font-black text-[#08315F] uppercase tracking-widest leading-tight">Education</h2>
                                                                        <p className="text-[18px] font-medium text-slate-400 mt-0.5">Your academic background and qualifications</p>
                                                                    </div>
                                                                </div>

                                                                <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-6 lg:p-8">
                                                                    {(!profile.education_degrees || profile.education_degrees.length === 0) ? (
                                                                        (profile.highest_education || profile.education_program) ? (
                                                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-8 relative">
                                                                                <div className="flex gap-4 items-start">
                                                                                    <div className="w-10 h-10 bg-blue-50 text-[#0038A8] rounded-xl flex items-center justify-center shrink-0 border-2 border-blue-100/50">
                                                                                        <FiAward size={18} />
                                                                                    </div>
                                                                                    <div className="flex flex-col gap-1 min-w-0 mt-0.5">
                                                                                        <span className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest truncate">Highest Education</span>
                                                                                        <span className="text-[18px] font-black text-slate-800 uppercase break-words">{profile.highest_education || '—'}</span>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex gap-4 items-start">
                                                                                    <div className="w-10 h-10 bg-blue-50 text-[#0038A8] rounded-xl flex items-center justify-center shrink-0 border-2 border-blue-100/50">
                                                                                        <FiFileText size={18} />
                                                                                    </div>
                                                                                    <div className="flex flex-col gap-1 min-w-0 mt-0.5">
                                                                                        <span className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest truncate">Specific Degree</span>
                                                                                        <span className="text-[18px] font-black text-slate-800 uppercase break-words">{profile.specific_degree || '—'}</span>
                                                                                    </div>
                                                                                </div>

                                                                                <div className="col-span-1 lg:col-span-2 border-t-2 border-slate-200 my-[-1rem] hidden lg:block" />

                                                                                <div className="flex gap-4 items-start">
                                                                                    <div className="w-10 h-10 bg-blue-50 text-[#0038A8] rounded-xl flex items-center justify-center shrink-0 border-2 border-blue-100/50">
                                                                                        <FiBookOpen size={18} />
                                                                                    </div>
                                                                                    <div className="flex flex-col gap-1 min-w-0 mt-0.5">
                                                                                        <span className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest truncate">Program / Course</span>
                                                                                        <span className="text-[18px] font-black text-slate-800 uppercase break-words">{profile.education_program || '—'}</span>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex gap-4 items-start">
                                                                                    <div className="w-10 h-10 bg-blue-50 text-[#0038A8] rounded-xl flex items-center justify-center shrink-0 border-2 border-blue-100/50">
                                                                                        <FiCalendar size={18} />
                                                                                    </div>
                                                                                    <div className="flex flex-col gap-1 min-w-0 mt-0.5">
                                                                                        <span className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest truncate">Year Graduated</span>
                                                                                        <span className="text-[18px] font-black text-slate-800 uppercase break-words">{profile.education_year_graduated || '—'}</span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <p className="text-[21px] font-bold text-slate-400 text-center py-4">No degrees added</p>
                                                                        )
                                                                    ) : (
                                                                        <div className="space-y-12">
                                                                            {profile.education_degrees.map((deg, idx) => (
                                                                                <div key={idx} className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-8 relative">
                                                                                    <div className="flex gap-4 items-start">
                                                                                        <div className="w-10 h-10 bg-blue-50 text-[#0038A8] rounded-xl flex items-center justify-center shrink-0 border-2 border-blue-100/50">
                                                                                            <FiAward size={18} />
                                                                                        </div>
                                                                                        <div className="flex flex-col gap-1 min-w-0 mt-0.5">
                                                                                            <span className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest truncate">Highest Education</span>
                                                                                            <span className="text-[18px] font-black text-slate-800 uppercase break-words">{deg.highest_education || '—'}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex gap-4 items-start">
                                                                                        <div className="w-10 h-10 bg-blue-50 text-[#0038A8] rounded-xl flex items-center justify-center shrink-0 border-2 border-blue-100/50">
                                                                                            <FiFileText size={18} />
                                                                                        </div>
                                                                                        <div className="flex flex-col gap-1 min-w-0 mt-0.5">
                                                                                            <span className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest truncate">Specific Degree</span>
                                                                                            <span className="text-[18px] font-black text-slate-800 uppercase break-words">{deg.specific_degree || '—'}</span>
                                                                                        </div>
                                                                                    </div>

                                                                                    <div className="col-span-1 lg:col-span-2 border-t-2 border-slate-200 my-[-1rem] hidden lg:block" />

                                                                                    <div className="flex gap-4 items-start">
                                                                                        <div className="w-10 h-10 bg-blue-50 text-[#0038A8] rounded-xl flex items-center justify-center shrink-0 border-2 border-blue-100/50">
                                                                                            <FiBookOpen size={18} />
                                                                                        </div>
                                                                                        <div className="flex flex-col gap-1 min-w-0 mt-0.5">
                                                                                            <span className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest truncate">Program / Course</span>
                                                                                            <span className="text-[18px] font-black text-slate-800 uppercase break-words">{deg.education_program || '—'}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex gap-4 items-start">
                                                                                        <div className="w-10 h-10 bg-blue-50 text-[#0038A8] rounded-xl flex items-center justify-center shrink-0 border-2 border-blue-100/50">
                                                                                            <FiCalendar size={18} />
                                                                                        </div>
                                                                                        <div className="flex flex-col gap-1 min-w-0 mt-0.5">
                                                                                            <span className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest truncate">Year Graduated</span>
                                                                                            <span className="text-[18px] font-black text-slate-800 uppercase break-words">{deg.education_year_graduated || '—'}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}

                                                                    {profile.other_courses && profile.other_courses.length > 0 && (
                                                                        <div className="mt-8 bg-[#F8FAFC] rounded-2xl p-6 lg:p-8 border-2 border-slate-200">
                                                                            <div className="flex items-center gap-3 mb-6">
                                                                                <div className="w-8 h-8 bg-blue-100/70 text-[#004a99] rounded-full flex items-center justify-center shrink-0">
                                                                                    <FiLayers size={16} />
                                                                                </div>
                                                                                <h3 className="text-[16.5px] font-black text-[#004a99] uppercase tracking-widest">Other Courses</h3>
                                                                            </div>

                                                                            <div className="space-y-4">
                                                                                {profile.other_courses.map((course, idx) => (
                                                                                    <div key={idx} className={`flex items-start gap-5 ${idx !== profile.other_courses.length - 1 ? 'pb-4 border-b-2 border-dashed border-slate-200' : ''}`}>
                                                                                        <div className="bg-blue-50/80 text-[#004a99] px-3 py-2 rounded-xl text-[16.5px] font-black shrink-0 min-w-[70px] text-center uppercase tracking-wider border-2 border-blue-100/50 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                                                                                            {course.course ? (course.course.length > 8 ? course.course.substring(0, 8) + '...' : course.course) + ':' : '—:'}
                                                                                        </div>
                                                                                        <div className="flex flex-col gap-0.5 mt-1">
                                                                                            <span className="text-[18px] font-black text-[#08315F]">
                                                                                                {course.date_from ? new Date(course.date_from).toLocaleDateString() : '—'} to {course.date_to ? new Date(course.date_to).toLocaleDateString() : '—'}
                                                                                            </span>
                                                                                            {course.details && <span className="text-[16.5px] font-bold text-slate-500">{course.details}</span>}
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {/* PERFORMANCE HISTORY */}
                                                            <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-8">
                                                                <div className="flex items-center gap-3 mb-6">
                                                                    <FiBarChart2 className="text-[#08315F]" size={24} />
                                                                    <h2 className="text-[21px] font-black text-[#08315F] uppercase tracking-widest">Performance History</h2>
                                                                </div>

                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                                                    {/* Ratings */}
                                                                    <div className="border-b-2 md:border-b-0 md:border-r-2 border-slate-200 pb-4 md:pb-0 md:pr-4">
                                                                        <p className="text-[15px] text-slate-400 mb-1">Latest Rating (1st)</p>
                                                                        <div className="flex items-center justify-between">
                                                                            <p className="text-[21px] font-black text-slate-800">{profile.performance_rating_1 ? `${profile.performance_rating_1} (${profile.performance_rating_1_period})` : '—'}</p>
                                                                            <FiTrendingUp className="text-emerald-500" size={18} />
                                                                        </div>
                                                                    </div>
                                                                    <div className="border-b-2 md:border-b-0 md:border-r-2 border-slate-200 pb-4 md:pb-0 md:pr-4">
                                                                        <p className="text-[15px] text-slate-400 mb-1">Previous Rating (2nd)</p>
                                                                        <div className="flex items-center justify-between">
                                                                            <p className="text-[21px] font-black text-slate-800">{profile.performance_rating_2 ? `${profile.performance_rating_2} (${profile.performance_rating_2_period})` : '—'}</p>
                                                                            <FiTrendingUp className="text-emerald-500" size={18} />
                                                                        </div>
                                                                    </div>
                                                                    <div className="pb-4 md:pb-0">
                                                                        <p className="text-[15px] text-slate-400 mb-1">Oldest Rating (3rd)</p>
                                                                        <div className="flex items-center justify-between">
                                                                            <p className="text-[21px] font-black text-slate-800">{profile.performance_rating_3 ? `${profile.performance_rating_3} (${profile.performance_rating_3_period})` : '—'}</p>
                                                                            <FiTrendingUp className="text-emerald-500" size={18} />
                                                                        </div>
                                                                    </div>
                                                                    <div className="border-b-2 md:border-b-0 md:border-r-2 border-slate-200 pb-4 md:pb-0 md:pr-4 md:-mt-4">
                                                                        <p className="text-[15px] text-slate-400 mb-1">CSPMS 2nd Sem</p>
                                                                        <div className="flex items-center justify-between">
                                                                            <p className="text-[21px] font-black text-slate-800">{profile.cespes_2_rating ? `${profile.cespes_2_rating} (${profile.cespes_rating_2_period})` : '—'}</p>
                                                                            <FiTrendingUp className="text-emerald-500" size={18} />
                                                                        </div>
                                                                    </div>
                                                                    <div className="pb-4 md:pb-0 md:-mt-4">
                                                                        <p className="text-[15px] text-slate-400 mb-1">Total Managerial Experience</p>
                                                                        <div className="flex items-center justify-between">
                                                                            <p className="text-[21px] font-black text-slate-800">{profile.managerial_experience_total || '—'}</p>
                                                                            <FiBriefcase className="text-blue-500" size={18} />
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Achievements */}
                                                                <div className="mt-8">
                                                                    <div className="flex items-center gap-2 mb-3">
                                                                        <FiAward className="text-amber-500" size={18} />
                                                                        <h3 className="text-[15px] font-bold text-slate-400 uppercase tracking-widest">Notable Achievements</h3>
                                                                    </div>
                                                                    {Array.isArray(profile.notable_achievements) && profile.notable_achievements.length > 0 ? (
                                                                        <div className="pl-6 space-y-1">
                                                                            {profile.notable_achievements.map((item, i) => {
                                                                                const title = typeof item === 'object' && item !== null ? item.title : String(item || '');
                                                                                const year = typeof item === 'object' && item !== null ? item.year : '';
                                                                                if (!title) return null;
                                                                                return (
                                                                                    <p key={i} className="text-[18px] font-black text-slate-800 uppercase">
                                                                                        • {title} {year ? `(${year})` : ''}
                                                                                    </p>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-[18px] font-black text-slate-800 uppercase pl-6">—</p>
                                                                    )}
                                                                </div>

                                                                {/* Previous Positions */}
                                                                {prevPositions.length > 0 && (
                                                                    <div className="mt-8">
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <FiRotateCcw className="text-blue-500" size={18} />
                                                                            <h3 className="text-[15px] font-bold text-slate-400 uppercase tracking-widest">Previous Position ({prevPositions.length})</h3>
                                                                        </div>
                                                                        <div className="pl-6 space-y-2">
                                                                            {prevPositions.map((p, i) => (
                                                                                <div key={i} className="bg-slate-50 border-2 border-slate-200 rounded-lg p-4 flex gap-4">
                                                                                    <span className="text-[18px] font-black text-slate-800">{i + 1}.</span>
                                                                                    <div>
                                                                                        <p className="text-[18px] font-black text-slate-800 uppercase">{p.position_name || '—'}</p>
                                                                                        <p className="text-[15px] text-slate-500 uppercase mt-0.5">{p.office} | {p.start_date ? `${p.start_date} - ${p.end_date || 'Present'}` : ''}</p>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* DOCUMENTS */}
                                                            <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-8">
                                                                <div className="flex items-center gap-3 mb-6">
                                                                    <FiFileText className="text-[#08315F]" size={24} />
                                                                    <h2 className="text-[21px] font-black text-[#08315F] uppercase tracking-widest">Documents</h2>
                                                                </div>

                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                                    {[
                                                                        { key: 'photo', dbKey: 'photo_binary_id', label: '2x2 Photo', accept: 'image/*' },
                                                                        { key: 'pds', dbKey: 'pds_binary_id', label: 'PDS', accept: '.pdf,.doc,.docx' },
                                                                        { key: 'service_records', dbKey: 'service_records_binary_id', label: 'Performance Rating', accept: '.pdf' },
                                                                    ].map(d => (
                                                                        <div key={d.key} className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 ${profile[d.dbKey] ? 'bg-emerald-50/30 border-emerald-200' : 'bg-transparent border-slate-200'}`}>
                                                                            {d.key === 'photo' ? <FiCamera size={28} className={profile[d.dbKey] ? 'text-emerald-500' : 'text-slate-300'} /> : <FiFileText size={28} className={profile[d.dbKey] ? 'text-emerald-500' : 'text-slate-300'} />}
                                                                            <div className="text-center">
                                                                                <p className={`text-[18px] font-black uppercase tracking-wider ${profile[d.dbKey] ? 'text-emerald-700' : 'text-slate-500'}`}>{d.label}</p>
                                                                                <p className={`text-[13.5px] font-bold uppercase tracking-widest mt-1 ${profile[d.dbKey] ? 'text-emerald-500' : 'text-slate-400'}`}>{profile[d.dbKey] ? 'Uploaded' : 'Missing'}</p>
                                                                            </div>

                                                                            <div className="flex gap-2 w-full mt-4">
                                                                                <div className="relative group/upload flex-1">
                                                                                    <input disabled={!isEditing} type="file" accept={d.accept} onChange={(e) => { const file = e.target.files[0]; if (file) handleFileUpload(file, d.key); }} className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full" />
                                                                                    <div className="flex items-center justify-center gap-1.5 border-2 border-slate-200 rounded-lg px-2 py-2 text-[15px] font-bold transition-all bg-white text-blue-700 hover:border-blue-300 w-full">
                                                                                        <FiUpload size={14} className={uploadingDocs[d.key] ? 'animate-bounce' : ''} />
                                                                                        <span>{uploadingDocs[d.key] ? '...' : 'Upload'}</span>
                                                                                    </div>
                                                                                </div>
                                                                                {profile[d.dbKey] && (
                                                                                    <button onClick={() => handleViewDocument(profile[d.dbKey])} className="flex-1 flex items-center justify-center gap-1.5 border-2 border-slate-200 rounded-lg px-2 py-2 text-[15px] font-bold transition-all bg-white hover:border-blue-300 text-blue-700">
                                                                                        <FiEye size={14} />
                                                                                        <span>View</span>
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            {/* LEGAL DISCLOSURES */}
                                                            <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-8">
                                                                <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => {
                                                                    // Let's implement an inline toggle state for Legal Disclosures
                                                                    const el = document.getElementById('legal-collapse');
                                                                    if (el) {
                                                                        el.classList.toggle('hidden');
                                                                        document.getElementById('legal-chevron').classList.toggle('rotate-180');
                                                                    }
                                                                }}>
                                                                    <div className="flex items-center gap-3">
                                                                        <FiShield className="text-blue-600" size={24} />
                                                                        <h2 className="text-[21px] font-black text-slate-800 uppercase tracking-widest">Legal Disclosures</h2>
                                                                    </div>
                                                                    <FiChevronDown id="legal-chevron" className="text-slate-400 transition-transform" size={24} />
                                                                </div>

                                                                <div id="legal-collapse" className="hidden border-t-2 border-slate-100 pt-6 mt-4">
                                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                                                        <SummaryRow label="Pending Administrative Cases" value={profile.pending_admin_case === 'Yes' ? 'Yes' : 'No'} />
                                                                        <SummaryRow label="Guilty of Admin Offense" value={profile.guilty_admin_details === 'Yes' ? 'Yes' : 'No'} />
                                                                        <SummaryRow label="Criminally Charged" value={profile.criminally_charged_details === 'Yes' ? 'Yes' : 'No'} />
                                                                        <SummaryRow label="Convicted of Crime" value={profile.convicted_crime_details === 'Yes' ? 'Yes' : 'No'} />
                                                                    </div>
                                                                </div>
                                                            </div>


                                                            {/* DATA PRIVACY & CERTIFICATION */}
                                                            <div className="mt-8">
                                                                {/* ── Data Privacy & Certification ── */}
                                                                <div className="bg-white rounded-[2.5rem] border-2 border-[#0038A8]/20 shadow-sm overflow-hidden">

                                                                    {/* Header */}
                                                                    <div className="bg-[#08315F] px-8 py-6 flex items-center gap-4">
                                                                        <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center">
                                                                            <FiShield size={22} className="text-white" />
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-white font-black text-[21px] uppercase tracking-widest">Data Privacy Notice & Certification</p>
                                                                            <p className="text-blue-200 text-[13.5px] font-bold uppercase tracking-widest mt-0.5">Republic Act No. 10173 — Data Privacy Act of 2012</p>
                                                                        </div>
                                                                    </div>

                                                                    <div className="p-8 space-y-6">
                                                                        {/* DepEd DPA Notice */}
                                                                        <div className="bg-transparent rounded-[2rem] p-6 text-[16.5px] font-bold text-slate-600 leading-relaxed border-2 border-slate-200">
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
                                                                                <p className="text-[16.5px] font-bold text-slate-700 leading-relaxed">
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
                                                                                <p className="text-[16.5px] font-bold text-slate-700 leading-relaxed">
                                                                                    I hereby <span className="text-emerald-700 font-black">certify under oath</span> that all information I have provided in this profile is true, correct, and complete to the best of my knowledge. I understand that any false statement or misrepresentation shall subject me to the penalties prescribed under applicable laws and civil service rules.
                                                                                </p>
                                                                            </button>
                                                                        </div>

                                                                        {/* Multi-Role Personal Sync Option */}
                                                                        {isMultiRole && availableRoles.length > 1 && (
                                                                            <label className="flex items-start gap-3.5 cursor-pointer select-none p-5 rounded-2xl border-2 border-blue-200 bg-blue-50/70 hover:bg-blue-50 transition-all">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={applyToVerifiedRoles}
                                                                                    onChange={(e) => setApplyToVerifiedRoles(e.target.checked)}
                                                                                    className="w-5 h-5 text-[#08315F] rounded border-slate-300 focus:ring-[#08315F] cursor-pointer shrink-0 mt-0.5"
                                                                                />
                                                                                <div>
                                                                                    <p className="text-[14.5px] font-black text-[#08315F] uppercase tracking-wider">
                                                                                        Apply personal information updates to verified sibling role(s)
                                                                                    </p>
                                                                                    <p className="text-[12.5px] font-medium text-slate-600 mt-1 leading-relaxed">
                                                                                        When checked, updates to common personal information (demographics, contact numbers, executive credentials, and document attachments) will also update your {availableRoles.length - 1} other verified role(s). Role-specific fields (position title, office, division, designation, plantilla item) remain strictly isolated per role.
                                                                                    </p>
                                                                                </div>
                                                                            </label>
                                                                        )}

                                                                        {/* Action Buttons */}
                                                                        {!certified ? (
                                                                            <div className="space-y-3 pt-2 w-full">
                                                                                <div className="flex flex-col sm:flex-row gap-3">
                                                                                    {dataSource === 'masterlist' ? (
                                                                                        <button
                                                                                            onClick={() => handleCertify(false)}
                                                                                            disabled={!dpaConsent || !truthConsent || certifying}
                                                                                            className="flex-1 py-5 bg-[#08315F] text-white font-black text-[15px] uppercase tracking-widest rounded-full shadow-2xl shadow-blue-900/30 hover:bg-[#08315F] transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                                                                                        >
                                                                                            {certifying ? <FiLoader className="animate-spin" size={18} /> : <FiCheckCircle size={18} />}
                                                                                            {certifying ? 'Certifying...' : 'Certify — Profile is Up-to-Date'}
                                                                                        </button>
                                                                                    ) : (
                                                                                        <>
                                                                                            <button
                                                                                                onClick={() => handleCertify(false)}
                                                                                                disabled={!dpaConsent || !truthConsent || certifying || applicationStatus === 'applied'}
                                                                                                className="flex-1 py-5 bg-slate-800 text-white font-black text-[15px] uppercase tracking-widest rounded-full hover:bg-slate-900 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                                                                                            >
                                                                                                {certifying ? <FiLoader className="animate-spin" size={18} /> : <FiSave size={18} />}
                                                                                                Save Consent Only
                                                                                            </button>
                                                                                            {completeness === 100 && (applicationStatus === null || applicationStatus === 'disapproved') && (
                                                                                                <button
                                                                                                    onClick={targetVacancyId ? handleSubmitApplication : () => setTab('summary')}
                                                                                                    disabled={!dpaConsent || !truthConsent || saving}
                                                                                                    className="flex-1 py-5 bg-[#08315F] text-white font-black text-[15px] uppercase tracking-widest rounded-full shadow-2xl shadow-blue-900/30 hover:bg-[#08315F] transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 border-2 border-white/20"
                                                                                                >
                                                                                                    {saving ? <FiLoader className="animate-spin" size={18} /> : <FiArrowRight size={18} />}
                                                                                                    {saving ? 'Processing...' : targetVacancyId ? 'Submit Final Application' : 'Select a Vacancy First'}
                                                                                                </button>
                                                                                            )}
                                                                                            {applicationStatus === 'applied' && (
                                                                                                <div className="flex-1 flex items-center justify-center gap-3 py-5 bg-amber-50 border-2 border-amber-200 rounded-full text-amber-600 text-[15px] font-black uppercase tracking-widest">
                                                                                                    <FiClock size={16} /> Applied (Pending Review)
                                                                                                </div>
                                                                                            )}
                                                                                            {applicationStatus === 'disapproved' && (
                                                                                                <div className="flex-1 flex items-center justify-center gap-3 py-5 bg-rose-50 border-2 border-rose-200 rounded-full text-rose-600 text-[15px] font-black uppercase tracking-widest">
                                                                                                    <FiXCircle size={16} /> Disapproved
                                                                                                </div>
                                                                                            )}
                                                                                            {applicationStatus === 'approved' && (
                                                                                                <div className="flex-1 flex items-center justify-center gap-3 py-5 bg-emerald-50 border-2 border-emerald-200 rounded-full text-emerald-600 text-[15px] font-black uppercase tracking-widest">
                                                                                                    <FiCheckCircle size={16} /> Approved
                                                                                                </div>
                                                                                            )}
                                                                                        </>
                                                                                    )}
                                                                                </div>
                                                                                {(!dpaConsent || !truthConsent) && (
                                                                                    <p className="text-[13.5px] font-bold text-slate-400 text-center mt-2 w-full">Please check both declarations above to proceed.</p>
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex items-center justify-center gap-4 py-6 bg-emerald-50 rounded-[2rem] border-2 border-emerald-200">
                                                                                <FiCheckCircle size={28} className="text-emerald-500" />
                                                                                <div>
                                                                                    <p className="font-black text-emerald-700 text-[21px] uppercase tracking-wider">Certified Successfully</p>
                                                                                    <p className="text-[15px] font-bold text-emerald-500 mt-0.5">Your consent and certification have been recorded.</p>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
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
                                                    className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-4 border-2 border-emerald-400/30 backdrop-blur-md"
                                                >
                                                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                                                        <FiCheckCircle size={20} />
                                                    </div>
                                                    <div>
                                                        <p className="text-[18px] font-black uppercase tracking-widest">Progress Saved</p>
                                                        <p className="text-[15px] font-bold opacity-80">Your profile data is secure in our registry.</p>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {applicationStatus === 'disapproved' && tab === 'summary' && (
                                            <div className="mt-10 flex justify-center">
                                                <button
                                                    onClick={handleResubmit}
                                                    disabled={saving}
                                                    className="px-12 py-4 bg-[#FBBF24] text-white font-black text-[15px] uppercase tracking-widest rounded-full shadow-lg shadow-red-500/20 hover:shadow-xl hover:shadow-red-500/35 hover:scale-[1.02] transition-all duration-300 active:scale-95 disabled:opacity-50 flex items-center gap-4 border-2 border-amber-300"
                                                >
                                                    {saving ? <FiLoader className="animate-spin" size={18} /> : <FiRefreshCw size={18} />}
                                                    {saving ? 'Submitting...' : 'Resubmit Application'}
                                                </button>
                                            </div>
                                        )}
                                    </div>


                                </div>
                            </div>
                        </div>

                        {/* Persistent Bottom Action Bar (Reduced Height & Mobile Optimized) */}
                        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t-2 border-slate-200 py-2 sm:py-2.5 px-3 sm:px-6 lg:px-8 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] lg:relative lg:bottom-auto lg:left-auto lg:right-auto lg:z-20 lg:bg-white lg:shadow-none flex items-center justify-between shrink-0 transition-all duration-300 min-h-[46px] sm:min-h-[50px] w-full max-w-[100vw] box-border">
                            <span className="text-[13px] sm:text-[14px] font-bold text-slate-400 uppercase tracking-widest hidden sm:flex items-center gap-2 shrink-0">
                                <FiShield className="text-emerald-500 shrink-0" size={16} /> Securely stored in DepEd database
                            </span>
                            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end min-w-0">
                                {isMultiRole && availableRoles.length > 1 && (
                                    <label className="flex items-center gap-1.5 cursor-pointer select-none bg-blue-50/90 hover:bg-blue-100/90 border border-blue-200 px-2 py-1 rounded-lg transition-all min-w-0 max-w-[45%] sm:max-w-none shrink">
                                        <input
                                            type="checkbox"
                                            checked={applyToVerifiedRoles}
                                            onChange={(e) => setApplyToVerifiedRoles(e.target.checked)}
                                            className="w-3.5 h-3.5 text-[#08315F] rounded border-slate-300 focus:ring-[#08315F] cursor-pointer shrink-0"
                                        />
                                        <span className="text-[10px] sm:text-[12px] font-bold text-blue-950 truncate">
                                            Apply to sibling roles
                                        </span>
                                    </label>
                                )}
                                <span className="text-[11px] sm:text-[13px] font-bold text-slate-400 uppercase tracking-widest sm:hidden flex items-center gap-1 shrink-0 select-none">
                                    <FiShield className="text-emerald-500 shrink-0" size={13} /> Protected
                                </span>
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !isEditing}
                                    className="flex-1 sm:flex-initial sm:w-auto px-3 sm:px-7 py-2 bg-[#08315F] hover:bg-blue-800 text-white font-black text-[12px] sm:text-[14px] uppercase tracking-wider rounded-lg shadow-sm hover:shadow-md transition-all duration-200 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 sm:gap-2 min-w-0"
                                >
                                    {saving ? <FiLoader className="animate-spin shrink-0" size={14} /> : <FiSave className="shrink-0" size={14} />}
                                    <span className="truncate">{saving ? 'Saving...' : 'Save Progress'}</span>
                                </button>
                            </div>
                        </div>




                        {/* Location Unlock Confirmation Modal */}
                        <AnimatePresence>
                            {showLocationUnlockModal && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                        className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border-2 border-slate-200 shadow-2xl space-y-5 relative"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border-2 border-amber-200">
                                                <FiAlertTriangle size={24} />
                                            </div>
                                            <div>
                                                <h3 className="text-[27px] font-black text-slate-800 tracking-tight">Confirm Location Change</h3>
                                                <p className="text-[16.5px] font-bold text-amber-600 uppercase tracking-wider mt-0.5">Location Access Verification</p>
                                            </div>
                                        </div>
                                        <p className="text-[18px] text-slate-600 font-medium leading-relaxed bg-slate-50 p-4 rounded-2xl border-2 border-slate-200">
                                            Are you sure you want to unlock and modify your Region and Division? Changing these fields may alter your profile assignment and jurisdiction.
                                        </p>
                                        <div className="flex items-center justify-end gap-3 pt-2">
                                            <button
                                                type="button"
                                                onClick={() => setShowLocationUnlockModal(false)}
                                                className="px-4 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-[18px] hover:bg-slate-100 transition-all active:scale-95"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsLocationLocked(false);
                                                    setShowLocationUnlockModal(false);
                                                }}
                                                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-[18px] uppercase tracking-wider transition-all shadow-md shadow-amber-600/20 active:scale-95 flex items-center gap-2"
                                            >
                                                <FiUnlock size={16} /> Yes, Unlock
                                            </button>
                                        </div>
                                    </motion.div>
                                </div>
                            )}
                        </AnimatePresence>

                        {/* Removed Global Export Modal because it was moved into Summary Tab as an inline popover */}
                    </div>
                </div>
            </div>
        </PageTransition>
    );
};

export default OfficialProfiling;

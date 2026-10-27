import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    FiGrid, FiBriefcase, FiUser, FiSearch, FiLoader, 
    FiCheckCircle, FiAlertTriangle, FiBookmark, FiEdit3, 
    FiPhone, FiMail, FiCalendar, FiClock, FiMenu, FiCheck, 
    FiFilter, FiFileText, FiAward, FiArrowRight, FiTrash2,
    FiList, FiMapPin, FiLayers, FiChevronDown, FiX
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import PageTransition from '../components/PageTransition';
import VacancySidebar from '../components/VacancySidebar';
import EditVacancyApplicantModal from '../components/EditVacancyApplicantModal';
import ApplyVacancyModal from '../components/ApplyVacancyModal';
import ViewApplicationDetailsModal from '../components/ViewApplicationDetailsModal';
import { apiUrl } from '../utils/api';
import Swal from 'sweetalert2';

const VacancyDashboard = ({ defaultTab = 'overview' }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { user, token, logout, setUser } = useAuth();

    // Map URL path or searchParams or defaultTab to active view/page
    const getTabFromRoute = useCallback(() => {
        const p = location.pathname.toLowerCase();
        if (p === '/all-vacancies' || p === '/vacancies') return 'vacancies';
        if (p === '/my-applications' || p === '/vacancy-applications') return 'applications';
        if (p === '/my-applicant-data' || p === '/applicant-profile') return 'profile';
        if (p === '/vacancy-dashboard' || p === '/applicant-dashboard') return 'overview';
        return searchParams.get('tab') || defaultTab || 'overview';
    }, [location.pathname, searchParams, defaultTab]);

    const [activeTab, setActiveTab] = useState(getTabFromRoute);

    useEffect(() => {
        setActiveTab(getTabFromRoute());
    }, [getTabFromRoute]);

    const handleNavigateTab = (tab) => {
        setActiveTab(tab);
        if (tab === 'vacancies') navigate('/all-vacancies');
        else if (tab === 'applications') navigate('/my-applications');
        else if (tab === 'profile') navigate('/my-applicant-data');
        else navigate('/vacancy-dashboard');
    };
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
    const [selectedVacancyForApply, setSelectedVacancyForApply] = useState(null);
    const [isViewAppModalOpen, setIsViewAppModalOpen] = useState(false);
    const [selectedAppForView, setSelectedAppForView] = useState(null);

    // Data States
    const [applicantProfile, setApplicantProfile] = useState(null);
    const [vacancies, setVacancies] = useState([]);
    const [applications, setApplications] = useState([]);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [loadingVacancies, setLoadingVacancies] = useState(true);
    const [loadingApplications, setLoadingApplications] = useState(true);

    // Vacancy Filter & Search States
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPosition, setSelectedPosition] = useState('All');
    const [selectedRegion, setSelectedRegion] = useState('All');
    const [selectedOffice, setSelectedOffice] = useState('All');
    const [selectedSalaryGrade, setSelectedSalaryGrade] = useState('All');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
    const [itemsPerPage, setItemsPerPage] = useState('10'); // '10' (default) | '20' | '50' | 'all'
    const [currentPage, setCurrentPage] = useState(1);
    const [overviewPage, setOverviewPage] = useState(1);

    // Fetch Applicant Profile from vacancy_applicants table
    const fetchApplicantProfile = useCallback(async () => {
        setLoadingProfile(true);
        try {
            const res = await fetch(apiUrl('/api/third-level/vacancy-applicant/profile'), {
                headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success && data.data) {
                setApplicantProfile(data.data);
            } else if (user) {
                setApplicantProfile({
                    applicant_uid: user.uid,
                    first_name: user.first_name || '',
                    last_name: user.last_name || '',
                    email: user.email || '',
                    registration_status: 'Active',
                    contact_number: user.contact_number || '',
                    target_vacancy_id: null,
                    target_position_title: null,
                    notes: ''
                });
            }
        } catch (err) {
            console.error('Failed to fetch applicant profile:', err);
        } finally {
            setLoadingProfile(false);
        }
    }, [token, user]);

    // Fetch List of Vacancies
    const fetchVacancies = useCallback(async () => {
        setLoadingVacancies(true);
        try {
            const res = await fetch(apiUrl('/api/third-level/vacancies'), {
                headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success) {
                setVacancies(data.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch vacancies:', err);
        } finally {
            setLoadingVacancies(false);
        }
    }, [token]);

    // Fetch List of Submitted Applications
    const fetchApplications = useCallback(async () => {
        setLoadingApplications(true);
        try {
            const res = await fetch(apiUrl('/api/third-level/vacancy-applicant/applications'), {
                headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success) {
                setApplications(data.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch applications:', err);
        } finally {
            setLoadingApplications(false);
        }
    }, [token]);

    const handleOpenApplyModal = (v = null) => {
        setSelectedVacancyForApply(v);
        setIsApplyModalOpen(true);
    };

    const handleApplicationSuccess = (newApp) => {
        fetchApplications();
        fetchApplicantProfile();
        handleNavigateTab('applications');
    };

    useEffect(() => {
        fetchApplicantProfile();
        fetchVacancies();
        fetchApplications();
    }, [fetchApplicantProfile, fetchVacancies, fetchApplications]);

    useEffect(() => {
        setCurrentPage(1);
        setOverviewPage(1);
    }, [searchQuery, selectedOffice, selectedRegion, selectedPosition, selectedSalaryGrade, itemsPerPage]);

    // Update Profile Handler
    const handleUpdateProfile = async (formData) => {
        try {
            const res = await fetch(apiUrl('/api/third-level/vacancy-applicant/profile'), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token || localStorage.getItem('token')}`
                },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success && data.data) {
                setApplicantProfile(data.data);
                if (setUser && user) {
                    const updatedUser = {
                        ...user,
                        first_name: data.data.first_name || user.first_name,
                        last_name: data.data.last_name || user.last_name
                    };
                    setUser(updatedUser);
                    localStorage.setItem('user', JSON.stringify(updatedUser));
                }
                return data.data;
            } else {
                throw new Error(data.error || 'Failed to save changes');
            }
        } catch (err) {
            console.error('Error saving applicant profile:', err);
            throw err;
        }
    };

    // Apply / Select Vacancy Handler
    const handleSelectVacancy = async (v) => {
        const vacancyId = v.TLOid || v.item_number || v.assignment_id;
        const positionTitle = v.position_title;

        try {
            const res = await fetch(apiUrl('/api/third-level/vacancy-applicant/apply'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token || localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    vacancy_id: vacancyId,
                    position_title: positionTitle
                })
            });
            const data = await res.json();
            if (data.success && data.data) {
                setApplicantProfile(data.data);
                Swal.fire({
                    icon: 'success',
                    title: 'Target Vacancy Selected',
                    html: `
                        <div class="text-left text-sm space-y-2">
                            <p class="font-bold text-[#08315F]">You have chosen your target position:</p>
                            <p class="font-black text-slate-800 text-base uppercase">${positionTitle}</p>
                            <p class="text-xs text-slate-500">Item: ${vacancyId} • ${v.office || 'Department of Education'}</p>
                            <p class="text-[11px] text-emerald-600 font-bold mt-2">✓ Saved in your vacancy_applicants record.</p>
                        </div>
                    `,
                    confirmButtonColor: '#08315F',
                    confirmButtonText: 'Done'
                });
            } else {
                throw new Error(data.error || 'Failed to apply for vacancy');
            }
        } catch (err) {
            console.error('Error selecting vacancy:', err);
            Swal.fire({
                icon: 'error',
                title: 'Selection Failed',
                text: err.message || 'Unable to update target vacancy.',
                confirmButtonColor: '#08315F'
            });
        }
    };

    // Clear Target Vacancy Handler
    const handleClearTargetVacancy = async () => {
        const confirm = await Swal.fire({
            title: 'Remove Target Vacancy?',
            text: 'Are you sure you want to clear your current target position selection?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#08315F',
            confirmButtonText: 'Yes, clear it'
        });

        if (confirm.isConfirmed) {
            try {
                const res = await fetch(apiUrl('/api/third-level/vacancy-applicant/profile'), {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token || localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({
                        target_vacancy_id: null,
                        target_position_title: null
                    })
                });
                const data = await res.json();
                if (data.success && data.data) {
                    setApplicantProfile(data.data);
                    Swal.fire({
                        icon: 'success',
                        title: 'Target Cleared',
                        text: 'Target vacancy has been removed.',
                        timer: 1500,
                        showConfirmButton: false
                    });
                }
            } catch (err) {
                console.error('Failed to clear target vacancy:', err);
            }
        }
    };

    // Compute Profile Completeness
    const profileCompleteness = useMemo(() => {
        if (!applicantProfile) return 0;
        let score = 0;
        if (applicantProfile.first_name) score += 20;
        if (applicantProfile.last_name) score += 20;
        if (applicantProfile.contact_number) score += 20;
        if (applicantProfile.target_vacancy_id) score += 25;
        if (applicantProfile.notes) score += 15;
        return score;
    }, [applicantProfile]);

    // Dynamic Filter Options
    const positionCategories = useMemo(() => {
        const counts = {};
        vacancies.forEach(v => {
            const title = v.position_title || 'Other';
            counts[title] = (counts[title] || 0) + 1;
        });
        return counts;
    }, [vacancies]);

    const regionOptions = useMemo(() => {
        const regions = [...new Set(vacancies.map(v => v.region).filter(Boolean))];
        return ['All', ...regions.sort((a, b) => {
            if (a === 'Central Office') return -1;
            if (b === 'Central Office') return 1;
            return a.localeCompare(b);
        })];
    }, [vacancies]);

    const officeOptions = useMemo(() => {
        return ['All', ...new Set(vacancies.map(v => v.office).filter(Boolean))].sort();
    }, [vacancies]);

    const salaryGradeOptions = useMemo(() => {
        const sgs = [...new Set(vacancies.map(v => v.salary_grade).filter(Boolean))];
        return ['All', ...sgs.sort((a, b) => Number(b) - Number(a))];
    }, [vacancies]);

    // Salary Grade Badge Colorizer
    const getSalaryGradeBadge = (sg) => {
        const num = Number(sg);
        if (num >= 30) {
            return {
                badge: 'bg-amber-100 text-amber-900 border-amber-300',
                label: `SG ${num} • Undersecretary`
            };
        } else if (num === 29) {
            return {
                badge: 'bg-indigo-100 text-indigo-900 border-indigo-300',
                label: `SG ${num} • Assistant Secretary`
            };
        } else if (num === 27 || num === 28) {
            return {
                badge: 'bg-purple-100 text-purple-900 border-purple-300',
                label: `SG ${num} • Director / ARD`
            };
        } else if (num === 26) {
            return {
                badge: 'bg-blue-100 text-[#08315F] border-blue-300',
                label: `SG ${num} • SDS`
            };
        } else {
            return {
                badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
                label: `SG ${num || 25} • ASDS`
            };
        }
    };

    // Filtered Vacancies
    const filteredVacancies = useMemo(() => {
        return vacancies.filter(v => {
            const q = searchQuery.toLowerCase().trim();
            const matchesQuery = !q || (
                (v.position_title && v.position_title.toLowerCase().includes(q)) ||
                (v.office && v.office.toLowerCase().includes(q)) ||
                (v.region && v.region.toLowerCase().includes(q)) ||
                (v.division && v.division.toLowerCase().includes(q)) ||
                (v.strand && v.strand.toLowerCase().includes(q)) ||
                (v.TLOid && v.TLOid.toLowerCase().includes(q)) ||
                (v.item_number && v.item_number.toLowerCase().includes(q)) ||
                (v.salary_grade && String(v.salary_grade).toLowerCase().includes(q))
            );

            const matchesOffice = selectedOffice === 'All' || v.office === selectedOffice;
            const matchesRegion = selectedRegion === 'All' || v.region === selectedRegion;
            const matchesPosition = selectedPosition === 'All' || v.position_title === selectedPosition;
            const matchesSG = selectedSalaryGrade === 'All' || String(v.salary_grade) === String(selectedSalaryGrade);

            return matchesQuery && matchesOffice && matchesRegion && matchesPosition && matchesSG;
        });
    }, [vacancies, searchQuery, selectedOffice, selectedRegion, selectedPosition, selectedSalaryGrade]);

    const getPageNumbers = (current, total) => {
        if (total <= 7) {
            return Array.from({ length: total }, (_, i) => i + 1);
        }
        if (current <= 3) {
            return [1, 2, 3, 4, '...', total];
        }
        if (current >= total - 2) {
            return [1, '...', total - 3, total - 2, total - 1, total];
        }
        return [1, '...', current - 1, current, current + 1, '...', total];
    };

    const pageSizeNumber = itemsPerPage === 'all' ? filteredVacancies.length : Number(itemsPerPage);
    const totalPages = itemsPerPage === 'all' || pageSizeNumber <= 0 ? 1 : Math.ceil(filteredVacancies.length / pageSizeNumber);
    const currentVacancies = itemsPerPage === 'all'
        ? filteredVacancies
        : filteredVacancies.slice((currentPage - 1) * pageSizeNumber, currentPage * pageSizeNumber);

    const overviewPageSize = 10;
    const totalOverviewPages = Math.ceil(filteredVacancies.length / overviewPageSize) || 1;
    const currentOverviewVacancies = filteredVacancies.slice(
        (overviewPage - 1) * overviewPageSize,
        overviewPage * overviewPageSize
    );

    const hasActiveFilters = searchQuery !== '' || selectedPosition !== 'All' || selectedRegion !== 'All' || selectedOffice !== 'All' || selectedSalaryGrade !== 'All';

    const handleClearFilters = () => {
        setSearchQuery('');
        setSelectedPosition('All');
        setSelectedRegion('All');
        setSelectedOffice('All');
        setSelectedSalaryGrade('All');
        setCurrentPage(1);
        setOverviewPage(1);
    };

    const fullName = [
        applicantProfile?.first_name,
        applicantProfile?.middle_name,
        applicantProfile?.last_name,
        applicantProfile?.suffix
    ].filter(Boolean).join(' ') || applicantProfile?.email || 'Applicant';

    return (
        <PageTransition>
            <div className="flex min-h-screen bg-slate-50 text-slate-800 font-['Plus_Jakarta_Sans',sans-serif]">
                
                {/* 1. DEDICATED APPLICANT SIDEBAR */}
                <VacancySidebar
                    applicantProfile={applicantProfile}
                    loading={loadingProfile}
                    activeTab={activeTab}
                    setActiveTab={handleNavigateTab}
                    vacanciesCount={vacancies.length}
                    applicationsCount={applications.length}
                    onOpenEditModal={() => setIsEditModalOpen(true)}
                    isMobileOpen={isMobileOpen}
                    setIsMobileOpen={setIsMobileOpen}
                />

                {/* 2. MAIN WORKSPACE / DASHBOARD AREA */}
                <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto relative">
                    
                    {/* Top Executive Header */}
                    <header className="sticky top-0 z-40 bg-[#08315F] text-white px-4 sm:px-6 lg:px-10 py-3 sm:py-4 flex items-center justify-between shadow-md border-b border-blue-900/50 shrink-0 gap-3">
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <button
                                onClick={() => setIsMobileOpen(true)}
                                className="lg:hidden p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
                                aria-label="Open Navigation Menu"
                            >
                                <FiMenu size={18} />
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-sm sm:text-base lg:text-lg font-black uppercase tracking-tight italic flex items-center gap-1.5 sm:gap-2 truncate">
                                    <span className="truncate">
                                        {activeTab === 'vacancies' ? 'List of' :
                                         activeTab === 'applications' ? 'My' :
                                         activeTab === 'profile' ? 'My Applicant' :
                                         'Applicant'}
                                    </span>
                                    <span className="text-sky-300 not-italic shrink-0">
                                        {activeTab === 'vacancies' ? 'Vacancies' :
                                         activeTab === 'applications' ? 'Applications' :
                                         activeTab === 'profile' ? 'Data' :
                                         'Dashboard'}
                                    </span>
                                </h1>
                                <p className="text-[10px] font-bold text-blue-200/80 uppercase tracking-widest hidden sm:block truncate">
                                    Department of Education • Third Level Opportunities
                                </p>
                            </div>
                        </div>

                        {/* User Identification Pill */}
                        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                            <div className="flex flex-col items-end min-w-0">
                                <span className="hidden sm:block text-xs font-black uppercase tracking-tight text-white leading-tight max-w-[160px] md:max-w-[240px] lg:max-w-none truncate" title={fullName}>
                                    {fullName}
                                </span>
                                <span className="text-[9px] font-mono font-bold text-[#FCD116] uppercase tracking-wider mt-0.5">
                                    {applicantProfile?.applicant_uid || 'VAC-2026'}
                                </span>
                            </div>
                        </div>
                    </header>

                    {/* Main Scrollable View Body */}
                    <main className="p-4 sm:p-6 lg:p-10 space-y-6 sm:space-y-8 flex-1">
                        
                        {/* 1. OVERVIEW PAGE: WELCOME BANNER & KPIS */}
                        {activeTab === 'overview' && (
                            <>
                                {/* Welcome Banner */}
                                <div className="relative overflow-hidden rounded-[24px] sm:rounded-[28px] bg-gradient-to-r from-[#08315F] via-[#0A3D78] to-[#075985] text-white p-5 sm:p-7 lg:p-9 shadow-xl">
                                    <div className="absolute -top-12 -right-12 w-64 h-64 bg-sky-400/20 rounded-full blur-3xl pointer-events-none"></div>
                                    <div className="relative z-10 max-w-3xl space-y-3">
                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-[10px] font-black uppercase tracking-widest text-sky-200">
                                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                            Active Applicant Workspace
                                        </div>
                                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight uppercase">
                                            Welcome, {applicantProfile?.first_name || 'Applicant'}!
                                        </h2>
                                        <p className="text-blue-100/90 text-xs lg:text-sm font-medium leading-relaxed">
                                            Browse open executive third level positions, submit your official application with 12 mandatory documents matching the official DepEd guidelines, and track your application status in real-time.
                                        </p>
                                        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
                                            <button
                                                onClick={() => handleOpenApplyModal()}
                                                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-white text-[#08315F] font-black text-xs uppercase tracking-wider shadow-lg hover:bg-sky-50 transition-all active:scale-95"
                                            >
                                                <FiFileText size={15} className="text-sky-600" />
                                                <span>Apply for Vacant Position</span>
                                            </button>
                                            <button
                                                onClick={() => handleNavigateTab('vacancies')}
                                                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase tracking-wider border border-white/20 transition-all active:scale-95"
                                            >
                                                <FiBriefcase size={15} className="text-amber-300" />
                                                <span>Browse All Vacancies ({vacancies.length})</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Top 4 KPI Metric Cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                                    {/* Card 1: Registration Status */}
                                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Registration Status
                                            </p>
                                            <p className="text-lg font-black text-[#08315F] uppercase flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                                {applicantProfile?.registration_status || 'Active'}
                                            </p>
                                            <p className="text-[10px] font-mono text-slate-500 font-bold">
                                                UID: {applicantProfile?.applicant_uid || 'N/A'}
                                            </p>
                                        </div>
                                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                            <FiCheckCircle size={24} />
                                        </div>
                                    </div>

                                    {/* Card 2: Target Vacancy */}
                                    <div 
                                        className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-[#08315F] transition-all"
                                        onClick={() => handleNavigateTab('profile')}
                                    >
                                        <div className="space-y-1 min-w-0 flex-1 pr-2">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Target Position
                                            </p>
                                            <p className="text-sm font-black text-[#08315F] uppercase truncate" title={applicantProfile?.target_position_title}>
                                                {applicantProfile?.target_position_title || 'None Selected'}
                                            </p>
                                            <p className="text-[10px] font-mono text-slate-500 font-bold truncate">
                                                Item: {applicantProfile?.target_vacancy_id || 'Not Assigned'}
                                            </p>
                                        </div>
                                        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#075985] flex items-center justify-center shrink-0">
                                            <FiBookmark size={24} />
                                        </div>
                                    </div>

                                    {/* Card 3: Submitted Applications */}
                                    <div 
                                        className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-[#08315F] transition-all"
                                        onClick={() => handleNavigateTab('applications')}
                                    >
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                My Applications
                                            </p>
                                            <p className="text-lg font-black text-[#08315F]">
                                                {loadingApplications ? '...' : `${applications.length} Filed`}
                                            </p>
                                            <p className="text-[10px] text-sky-700 font-bold uppercase tracking-wider flex items-center gap-1">
                                                Track status <FiArrowRight size={10} />
                                            </p>
                                        </div>
                                        <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
                                            <FiFileText size={24} />
                                        </div>
                                    </div>

                                    {/* Card 4: Open Vacancies Available */}
                                    <div 
                                        className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-[#08315F] transition-all"
                                        onClick={() => handleNavigateTab('vacancies')}
                                    >
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Open Vacancies
                                            </p>
                                            <p className="text-lg font-black text-[#08315F]">
                                                {loadingVacancies ? '...' : vacancies.length} Positions
                                            </p>
                                            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1">
                                                Click to view <FiArrowRight size={10} />
                                            </p>
                                        </div>
                                        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                                            <FiBriefcase size={24} />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* 2. LIST OF VACANCIES PAGE DEDICATED HEADER */}
                        {activeTab === 'vacancies' && (
                            <div className="pb-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="text-2xl font-black text-[#08315F] uppercase tracking-tight">
                                        List of Vacancies
                                    </h1>
                                    <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black uppercase">
                                        {vacancies.length} Positions Total
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 font-medium mt-1">
                                    Explore and apply for vacant third level executive plantilla positions in the Department of Education.
                                </p>
                            </div>
                        )}

                        {/* 3. MY APPLICATIONS PAGE DEDICATED HEADER */}
                        {activeTab === 'applications' && (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h1 className="text-2xl font-black text-[#08315F] uppercase tracking-tight">
                                            My Applications
                                        </h1>
                                        <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-900 border border-sky-300 text-xs font-black uppercase">
                                            {applications.length} Filed
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium mt-1">
                                        Track the submission history and review status of your third level vacancy applications.
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleOpenApplyModal()}
                                    className="self-start sm:self-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#08315F] hover:bg-blue-900 text-white font-black text-xs uppercase tracking-wider shadow-md transition-all active:scale-95"
                                >
                                    <FiFileText size={15} />
                                    <span>New Application</span>
                                </button>
                            </div>
                        )}

                        {/* 4. MY APPLICANT DATA PAGE DEDICATED HEADER */}
                        {activeTab === 'profile' && (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h1 className="text-2xl font-black text-[#08315F] uppercase tracking-tight">
                                            My Applicant Data
                                        </h1>
                                        <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black uppercase">
                                            {applicantProfile?.registration_status || 'Active'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium mt-1">
                                        Manage your registered personal information, contact credentials, and career statements.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsEditModalOpen(true)}
                                    className="self-start sm:self-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#08315F] hover:bg-blue-900 text-white font-black text-xs uppercase tracking-wider shadow-md transition-all active:scale-95"
                                >
                                    <FiEdit3 size={15} />
                                    <span>Edit Applicant Data</span>
                                </button>
                            </div>
                        )}


                        {/* TAB 1: OVERVIEW & DATA SUMMARY */}
                        {activeTab === 'overview' && (
                            <div className="space-y-8">
                                
                                {/* Section A: Applicant Profile Data (vacancy_applicants) */}
                                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3 sm:gap-4">
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-base font-black text-[#08315F] uppercase tracking-tight">
                                                    Applicant Registered Information
                                                </h3>
                                                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#075985] text-[9px] font-mono font-bold uppercase">
                                                    vacancy_applicants
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400 font-medium mt-0.5">
                                                Official details registered under UID: {applicantProfile?.applicant_uid}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setIsEditModalOpen(true)}
                                            className="self-start sm:self-auto px-4 py-2 rounded-xl bg-[#08315F] hover:bg-blue-900 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all active:scale-95"
                                        >
                                            <FiEdit3 size={13} />
                                            <span>Edit Applicant Data</span>
                                        </button>
                                    </div>

                                    {/* Data Grid based on vacancy_applicants columns */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
                                        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                                First Name
                                            </span>
                                            <p className="text-xs font-bold text-slate-800 uppercase break-words">
                                                {applicantProfile?.first_name || '—'}
                                            </p>
                                        </div>

                                        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                                Middle Name
                                            </span>
                                            <p className="text-xs font-bold text-slate-800 uppercase break-words">
                                                {applicantProfile?.middle_name || '—'}
                                            </p>
                                        </div>

                                        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                                Last Name & Suffix
                                            </span>
                                            <p className="text-xs font-bold text-slate-800 uppercase break-words">
                                                {applicantProfile?.last_name || '—'} {applicantProfile?.suffix || ''}
                                            </p>
                                        </div>

                                        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                                Email Address (Official)
                                            </span>
                                            <p className="text-xs font-bold text-slate-800 flex items-center gap-2 min-w-0">
                                                <FiMail size={13} className="text-[#075985] shrink-0" />
                                                <span className="break-all">{applicantProfile?.email || '—'}</span>
                                            </p>
                                        </div>

                                        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                                Contact Number
                                            </span>
                                            <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                                <FiPhone size={13} className="text-[#075985] shrink-0" />
                                                <span className="break-words">{applicantProfile?.contact_number || 'Not provided'}</span>
                                            </p>
                                        </div>

                                        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                                Applicant UID & Status
                                            </span>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-mono text-xs font-black text-[#08315F]">
                                                    {applicantProfile?.applicant_uid}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase">
                                                    {applicantProfile?.registration_status || 'Active'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Target Vacancy Card */}
                                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                                        <div className="space-y-1 min-w-0 flex-1">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-[#075985] flex items-center gap-1.5">
                                                <FiBookmark size={12} /> Target Vacancy Application
                                            </span>
                                            {applicantProfile?.target_position_title ? (
                                                <div className="min-w-0">
                                                    <h4 className="text-sm font-black text-[#08315F] uppercase break-words">
                                                        {applicantProfile.target_position_title}
                                                    </h4>
                                                    <p className="text-[10px] font-mono text-slate-500 font-bold truncate">
                                                        Item Code: {applicantProfile.target_vacancy_id}
                                                    </p>
                                                </div>
                                            ) : (
                                                <p className="text-xs font-medium text-slate-500 italic">
                                                    No target vacancy selected yet. Browse the vacancy catalog to choose a position.
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                                            {applicantProfile?.target_vacancy_id ? (
                                                <>
                                                    <button
                                                        onClick={() => handleNavigateTab('vacancies')}
                                                        className="px-3.5 py-2 rounded-xl bg-[#08315F] text-white text-[10px] font-black uppercase tracking-wider hover:bg-blue-900 transition-all"
                                                    >
                                                        Change Position
                                                    </button>
                                                    <button
                                                        onClick={handleClearTargetVacancy}
                                                        className="p-2 rounded-xl bg-white border border-rose-200 text-rose-500 hover:bg-rose-50 transition-all"
                                                        title="Remove Target Position"
                                                    >
                                                        <FiTrash2 size={14} />
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => handleNavigateTab('vacancies')}
                                                    className="px-4 py-2 rounded-xl bg-[#08315F] text-white text-[10px] font-black uppercase tracking-wider hover:bg-blue-900 transition-all flex items-center gap-1.5"
                                                >
                                                    <span>Browse Vacancies</span>
                                                    <FiArrowRight size={12} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Notes / Statement of Intent */}
                                    <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                            Qualifications & Career Notes
                                        </span>
                                        <p className="text-xs font-medium text-slate-700 whitespace-pre-wrap leading-relaxed break-words">
                                            {applicantProfile?.notes || (
                                                <span className="text-slate-400 italic">
                                                    No qualifications or statements added yet. Click "Edit Applicant Data" to enter your eligibility (e.g. CESO, CSEE) or career summary.
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>

                                {/* Section B: Comprehensive DepEd Vacant Positions Explorer */}
                                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-base font-black text-[#08315F] uppercase tracking-tight">
                                                    DepEd Vacant Plantilla Positions
                                                </h3>
                                                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase">
                                                    {vacancies.length} Positions Total
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400 font-medium mt-0.5">
                                                Live CES Plantilla vacancies ({filteredVacancies.length} matching your criteria)
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {hasActiveFilters && (
                                                <button
                                                    onClick={handleClearFilters}
                                                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1"
                                                >
                                                    <FiX size={12} />
                                                    <span>Reset</span>
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleNavigateTab('vacancies')}
                                                className="px-4 py-2 rounded-xl bg-[#08315F] hover:bg-blue-900 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm"
                                            >
                                                <span>Full Catalog ({vacancies.length})</span>
                                                <FiArrowRight size={13} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Compact Search, Position & Region Filter Bar */}
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                            {/* Search Input */}
                                            <div className="flex items-center gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-slate-300 focus-within:border-[#08315F] focus-within:ring-2 focus-within:ring-[#08315F]/15 transition-all shadow-xs min-w-0">
                                                <FiSearch size={15} className="text-slate-400 shrink-0" />
                                                <input
                                                    type="text"
                                                    placeholder="Search position, item number, office..."
                                                    value={searchQuery}
                                                    onChange={e => setSearchQuery(e.target.value)}
                                                    className="w-full bg-transparent border-none text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none min-w-0"
                                                />
                                                {searchQuery && (
                                                    <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 shrink-0">
                                                        <FiX size={14} />
                                                    </button>
                                                )}
                                            </div>

                                            {/* Position Title Dropdown */}
                                            <div className="min-w-0">
                                                <select
                                                    value={selectedPosition}
                                                    onChange={e => setSelectedPosition(e.target.value)}
                                                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:border-[#08315F] cursor-pointer shadow-xs truncate"
                                                >
                                                    <option value="All">All Positions ({vacancies.length})</option>
                                                    {Object.entries(positionCategories).map(([title, count]) => (
                                                        <option key={title} value={title}>{title} ({count})</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Region Filter */}
                                            <div className="min-w-0">
                                                <select
                                                    value={selectedRegion}
                                                    onChange={e => setSelectedRegion(e.target.value)}
                                                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:border-[#08315F] cursor-pointer shadow-xs truncate"
                                                >
                                                    {regionOptions.map(r => (
                                                        <option key={r} value={r}>{r === 'All' ? 'All Regions & Central Office' : r}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="flex items-center justify-between sm:justify-end gap-3 text-xs font-bold text-slate-500 min-w-0">
                                                <span className="truncate">Displaying {filteredVacancies.length} of {vacancies.length}</span>
                                            </div>
                                        </div>

                                        {/* Active Filter Indicators */}
                                        {hasActiveFilters && (
                                            <div className="flex items-center gap-2 flex-wrap text-xs">
                                                <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Active:</span>
                                                {selectedPosition !== 'All' && (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#08315F] text-white text-[10px] font-black uppercase">
                                                        Position: {selectedPosition}
                                                        <button onClick={() => setSelectedPosition('All')} className="hover:text-rose-300">
                                                            <FiX size={10} />
                                                        </button>
                                                    </span>
                                                )}
                                                {selectedRegion !== 'All' && (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[10px] font-bold">
                                                        Region: {selectedRegion}
                                                        <button onClick={() => setSelectedRegion('All')} className="hover:text-rose-500">
                                                            <FiX size={10} />
                                                        </button>
                                                    </span>
                                                )}
                                                <button
                                                    onClick={handleClearFilters}
                                                    className="text-[10px] font-bold text-rose-500 hover:text-rose-700 underline uppercase tracking-wider ml-1"
                                                >
                                                    Clear All
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Vacancies Grid (Default 10 items per page with Pagination) */}
                                    <div className="space-y-4">
                                        {loadingVacancies ? (
                                            <div className="py-20 text-center bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                                                <FiLoader className="animate-spin mx-auto text-[#075985] mb-3" size={28} />
                                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading All Vacant Positions...</p>
                                            </div>
                                        ) : filteredVacancies.length === 0 ? (
                                            <div className="py-16 text-center bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                                                <FiAlertTriangle className="mx-auto text-amber-500 mb-2" size={28} />
                                                <p className="text-xs font-black uppercase tracking-wide text-slate-700">No matching vacant positions found</p>
                                                <button
                                                    onClick={handleClearFilters}
                                                    className="mt-3 px-3.5 py-1.5 rounded-lg bg-[#08315F] text-white text-[10px] font-bold uppercase tracking-wider"
                                                >
                                                    Clear Filters
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {currentOverviewVacancies.map(v => {
                                                        const id = v.TLOid || v.item_number || v.assignment_id;
                                                        const isTarget = applicantProfile?.target_vacancy_id === id;
                                                        const sgInfo = getSalaryGradeBadge(v.salary_grade);

                                                        return (
                                                            <div 
                                                                key={id} 
                                                                className={`p-5 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 ${
                                                                    isTarget 
                                                                        ? 'bg-blue-50/80 border-[#075985] shadow-md ring-2 ring-[#075985]/30'
                                                                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                                                                }`}
                                                            >
                                                                <div>
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <div className="space-y-1">
                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                <h4 className="text-xs font-black text-[#08315F] uppercase tracking-tight">
                                                                                    {v.position_title}
                                                                                </h4>
                                                                                <span className={`px-2 py-0.5 rounded-md border text-[8px] font-mono font-bold uppercase ${sgInfo.badge}`}>
                                                                                    SG {v.salary_grade}
                                                                                </span>
                                                                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[8px] font-bold uppercase">
                                                                                    Vacant
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-[11px] font-bold text-slate-600 uppercase">
                                                                                {v.office || 'Department of Education'}
                                                                            </p>
                                                                        </div>
                                                                        {isTarget && (
                                                                            <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[8px] font-black uppercase shrink-0 shadow-sm flex items-center gap-1">
                                                                                <FiCheck size={10} /> Target
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    <div className="flex items-center gap-2 mt-2 text-[10px] font-bold text-slate-500 flex-wrap">
                                                                        {v.region && (
                                                                            <span className="flex items-center gap-1 text-[#075985]">
                                                                                <FiMapPin size={10} /> {v.region}
                                                                            </span>
                                                                        )}
                                                                        <span>•</span>
                                                                        <span className="font-mono text-slate-400">Item: {id}</span>
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-wrap items-center justify-between pt-3 border-t border-slate-100 text-[10px] gap-2">
                                                                    <span className="text-[9px] font-mono text-slate-400 min-w-0 truncate max-w-[160px] sm:max-w-none">
                                                                        {sgInfo.label}
                                                                    </span>
                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                        <button
                                                                            onClick={() => handleOpenApplyModal(v)}
                                                                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-400 to-sky-500 hover:from-sky-300 hover:to-sky-400 text-slate-900 text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm flex items-center gap-1"
                                                                        >
                                                                            <FiFileText size={11} />
                                                                            <span>Apply</span>
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleSelectVacancy(v)}
                                                                            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1 ${
                                                                                isTarget
                                                                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                                                                                    : 'bg-[#08315F] hover:bg-blue-900 text-white shadow-sm'
                                                                            }`}
                                                                        >
                                                                            {isTarget ? (
                                                                                <>
                                                                                    <FiCheck size={11} />
                                                                                    <span>Target ✓</span>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <FiBookmark size={11} />
                                                                                    <span>Target</span>
                                                                                </>
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {totalOverviewPages > 1 && (
                                                    <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-slate-100 gap-3">
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center sm:text-left">
                                                            Showing {(overviewPage - 1) * overviewPageSize + 1} to {Math.min(overviewPage * overviewPageSize, filteredVacancies.length)} of {filteredVacancies.length} (Page {overviewPage} of {totalOverviewPages})
                                                        </p>
                                                        <div className="flex items-center gap-1.5 flex-wrap justify-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => setOverviewPage(p => Math.max(1, p - 1))}
                                                                disabled={overviewPage === 1}
                                                                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold disabled:opacity-50 transition-colors"
                                                            >
                                                                Previous
                                                            </button>
                                                            {getPageNumbers(overviewPage, totalOverviewPages).map((p, idx) => (
                                                                p === '...' ? (
                                                                    <span key={`dots-overview-${idx}`} className="px-2 text-slate-400 text-xs font-bold">...</span>
                                                                ) : (
                                                                    <button
                                                                        key={p}
                                                                        type="button"
                                                                        onClick={() => setOverviewPage(p)}
                                                                        className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                                                                            overviewPage === p
                                                                                ? 'bg-[#08315F] text-white shadow-sm'
                                                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                                        }`}
                                                                    >
                                                                        {p}
                                                                    </button>
                                                                )
                                                            ))}
                                                            <button
                                                                type="button"
                                                                onClick={() => setOverviewPage(p => Math.min(totalOverviewPages, p + 1))}
                                                                disabled={overviewPage === totalOverviewPages}
                                                                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold disabled:opacity-50 transition-colors"
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
                            </div>
                        )}

                        {/* TAB 2: FULL LIST OF VACANCIES (DEDICATED CATALOG VIEW) */}
                        {activeTab === 'vacancies' && (
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
                                
                                {/* Catalog Header */}
                                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between pb-4 border-b border-slate-100">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-base font-black text-[#08315F] uppercase tracking-tight">
                                                DepEd Plantilla Vacancies Catalog
                                            </h3>
                                            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-[#08315F] font-black text-[10px] uppercase">
                                                {vacancies.length} Positions Total
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                                            Official Third Level Plantilla • Showing {filteredVacancies.length} matching positions across {regionOptions.length > 1 ? regionOptions.length - 1 : 18} Regions & Central Office
                                        </p>
                                    </div>

                                    {/* View Mode & Reset Controls */}
                                    <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end flex-wrap">
                                        {hasActiveFilters && (
                                            <button
                                                onClick={handleClearFilters}
                                                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
                                            >
                                                <FiX size={13} />
                                                <span>Clear Filters</span>
                                            </button>
                                        )}

                                        {/* View Mode Toggle: Grid vs Table */}
                                        <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs shrink-0">
                                            <button
                                                onClick={() => setViewMode('grid')}
                                                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                                                    viewMode === 'grid'
                                                        ? 'bg-white text-[#08315F] shadow-sm font-black'
                                                        : 'text-slate-500 hover:text-slate-800'
                                                }`}
                                                title="Card Grid View"
                                            >
                                                <FiGrid size={13} />
                                                <span className="hidden sm:inline">Cards</span>
                                            </button>
                                            <button
                                                onClick={() => setViewMode('table')}
                                                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                                                    viewMode === 'table'
                                                        ? 'bg-white text-[#08315F] shadow-sm font-black'
                                                        : 'text-slate-500 hover:text-slate-800'
                                                }`}
                                                title="Compact Table View"
                                            >
                                                <FiList size={13} />
                                                <span className="hidden sm:inline">Table</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Multi-Filter Controls Bar with Position Dropdown */}
                                <div className="space-y-3 bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200/80">
                                    {/* Primary Row: Search Input & Per-Page Display Selector */}
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                        {/* Search Input */}
                                        <div className="flex-1 flex items-center gap-2.5 bg-white px-3.5 py-2.5 rounded-xl border border-slate-300 focus-within:border-[#08315F] focus-within:ring-2 focus-within:ring-[#08315F]/15 transition-all shadow-xs min-w-0">
                                            <FiSearch size={16} className="text-slate-400 shrink-0" />
                                            <input
                                                type="text"
                                                placeholder="Search title, office, item number..."
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                className="w-full bg-transparent border-none text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none min-w-0"
                                            />
                                            {searchQuery && (
                                                <button 
                                                    type="button"
                                                    onClick={() => setSearchQuery('')} 
                                                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors shrink-0"
                                                    title="Clear search"
                                                >
                                                    <FiX size={14} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Items Per Page / Display Density Toggle */}
                                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 w-full sm:w-auto">
                                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Show:</span>
                                            <select
                                                value={itemsPerPage}
                                                onChange={e => setItemsPerPage(e.target.value)}
                                                className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:border-[#08315F] cursor-pointer shadow-xs transition-colors"
                                                title="Items to display"
                                            >
                                                <option value="10">10 / page (Default)</option>
                                                <option value="20">20 / page</option>
                                                <option value="50">50 / page</option>
                                                <option value="all">Show All ({vacancies.length})</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Secondary Row: Facet Dropdowns (Position, Region, Office, Salary Grade) */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                        {/* Position Title Dropdown */}
                                        <div className="min-w-0">
                                            <select
                                                value={selectedPosition}
                                                onChange={e => setSelectedPosition(e.target.value)}
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:border-[#08315F] cursor-pointer shadow-xs truncate transition-colors"
                                            >
                                                <option value="All">All Positions ({vacancies.length})</option>
                                                {Object.entries(positionCategories).map(([title, count]) => (
                                                    <option key={title} value={title}>
                                                        {title} ({count})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Region Filter */}
                                        <div className="min-w-0">
                                            <select
                                                value={selectedRegion}
                                                onChange={e => setSelectedRegion(e.target.value)}
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:border-[#08315F] cursor-pointer shadow-xs truncate transition-colors"
                                            >
                                                {regionOptions.map(r => (
                                                    <option key={r} value={r}>{r === 'All' ? 'All Regions' : r}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Office Filter */}
                                        <div className="min-w-0">
                                            <select
                                                value={selectedOffice}
                                                onChange={e => setSelectedOffice(e.target.value)}
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:border-[#08315F] cursor-pointer shadow-xs truncate transition-colors"
                                            >
                                                {officeOptions.map(o => (
                                                    <option key={o} value={o}>{o === 'All' ? 'All Offices' : o}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Salary Grade Filter */}
                                        <div className="min-w-0">
                                            <select
                                                value={selectedSalaryGrade}
                                                onChange={e => setSelectedSalaryGrade(e.target.value)}
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:border-[#08315F] cursor-pointer shadow-xs truncate transition-colors"
                                            >
                                                {salaryGradeOptions.map(sg => (
                                                    <option key={sg} value={sg}>{sg === 'All' ? 'All Salary Grades' : `SG ${sg}`}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Active Filter Indicators */}
                                    {hasActiveFilters && (
                                        <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
                                            <span className="text-slate-400 font-bold text-[11px] uppercase tracking-wider">Active Filters:</span>
                                            {selectedPosition !== 'All' && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#08315F] text-white text-[11px] font-black uppercase shadow-xs">
                                                    Position: {selectedPosition}
                                                    <button onClick={() => setSelectedPosition('All')} className="hover:text-rose-300">
                                                        <FiX size={12} />
                                                    </button>
                                                </span>
                                            )}
                                            {selectedRegion !== 'All' && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200 text-slate-800 text-[11px] font-bold">
                                                    Region: {selectedRegion}
                                                    <button onClick={() => setSelectedRegion('All')} className="hover:text-rose-500">
                                                        <FiX size={12} />
                                                    </button>
                                                </span>
                                            )}
                                            {selectedOffice !== 'All' && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200 text-slate-800 text-[11px] font-bold">
                                                    Office: {selectedOffice}
                                                    <button onClick={() => setSelectedOffice('All')} className="hover:text-rose-500">
                                                        <FiX size={12} />
                                                    </button>
                                                </span>
                                            )}
                                            {selectedSalaryGrade !== 'All' && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200 text-slate-800 text-[11px] font-bold">
                                                    SG: {selectedSalaryGrade}
                                                    <button onClick={() => setSelectedSalaryGrade('All')} className="hover:text-rose-500">
                                                        <FiX size={12} />
                                                    </button>
                                                </span>
                                            )}
                                            <button
                                                onClick={handleClearFilters}
                                                className="text-[11px] font-bold text-rose-500 hover:text-rose-700 underline uppercase tracking-wider ml-1"
                                            >
                                                Clear All
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Content Display: Loading, Empty, Table or Grid */}
                                {loadingVacancies ? (
                                    <div className="py-24 text-center bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                                        <FiLoader className="animate-spin mx-auto text-[#075985] mb-3" size={32} />
                                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading All Vacant Positions...</p>
                                    </div>
                                ) : filteredVacancies.length === 0 ? (
                                    <div className="py-24 text-center bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                                        <FiAlertTriangle className="mx-auto text-amber-500 mb-3" size={32} />
                                        <p className="text-sm font-black uppercase tracking-wide text-slate-700">No matching vacancies found</p>
                                        <p className="text-xs text-slate-400 mt-1">Try adjusting your search query or region/office filter</p>
                                        <button
                                            onClick={handleClearFilters}
                                            className="mt-4 px-4 py-2 rounded-xl bg-[#08315F] text-white text-xs font-black uppercase tracking-wider shadow-sm"
                                        >
                                            Reset Filters
                                        </button>
                                    </div>
                                ) : viewMode === 'table' ? (
                                    /* TABLE VIEW MODE */
                                    <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm scrollbar-thin">
                                        <table className="w-full text-left border-collapse min-w-[700px]">
                                            <thead>
                                                <tr className="bg-[#08315F] text-white text-[10px] font-black uppercase tracking-wider">
                                                    <th className="py-3.5 px-4">Plantilla Item</th>
                                                    <th className="py-3.5 px-4">Position Title</th>
                                                    <th className="py-3.5 px-3">SG</th>
                                                    <th className="py-3.5 px-4">Office / Bureau</th>
                                                    <th className="py-3.5 px-4">Region</th>
                                                    <th className="py-3.5 px-3 text-center">Status</th>
                                                    <th className="py-3.5 px-4 text-right">Target Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-xs">
                                                {currentVacancies.map((v, idx) => {
                                                    const id = v.TLOid || v.item_number || v.assignment_id;
                                                    const isTarget = applicantProfile?.target_vacancy_id === id;
                                                    const sgInfo = getSalaryGradeBadge(v.salary_grade);

                                                    return (
                                                        <tr 
                                                            key={id}
                                                            className={`transition-colors hover:bg-slate-50/80 ${
                                                                isTarget ? 'bg-blue-50/70 font-semibold' : (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30')
                                                            }`}
                                                        >
                                                            <td className="py-3.5 px-4 font-mono text-[11px] font-bold text-slate-700 whitespace-nowrap">
                                                                {id}
                                                            </td>
                                                            <td className="py-3.5 px-4">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-black text-[#08315F] uppercase text-xs">
                                                                        {v.position_title}
                                                                    </span>
                                                                    {isTarget && (
                                                                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[8px] font-black uppercase shrink-0">
                                                                            Target
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="py-3.5 px-3 whitespace-nowrap">
                                                                <span className={`px-2 py-0.5 rounded border text-[9px] font-mono font-bold ${sgInfo.badge}`}>
                                                                    SG {v.salary_grade}
                                                                </span>
                                                            </td>
                                                            <td className="py-3.5 px-4 text-slate-700 text-xs uppercase font-medium">
                                                                {v.office || 'Department of Education'}
                                                            </td>
                                                            <td className="py-3.5 px-4 text-slate-600 text-xs font-medium whitespace-nowrap">
                                                                <span className="flex items-center gap-1">
                                                                    <FiMapPin size={11} className="text-[#075985]" />
                                                                    <span>{v.region || 'Central Office'}</span>
                                                                </span>
                                                            </td>
                                                            <td className="py-3.5 px-3 text-center whitespace-nowrap">
                                                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase">
                                                                    Vacant
                                                                </span>
                                                            </td>
                                                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                                <div className="flex items-center justify-end gap-1.5">
                                                                    <button
                                                                        onClick={() => handleOpenApplyModal(v)}
                                                                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-400 to-sky-500 hover:from-sky-300 hover:to-sky-400 text-slate-900 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm flex items-center gap-1"
                                                                    >
                                                                        <FiFileText size={11} />
                                                                        <span>Apply</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleSelectVacancy(v)}
                                                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                                                                            isTarget
                                                                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                                                                                : 'bg-[#08315F] hover:bg-blue-900 text-white shadow-sm'
                                                                        }`}
                                                                    >
                                                                        {isTarget ? 'Target ✓' : 'Target'}
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    /* GRID VIEW MODE */
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {currentVacancies.map(v => {
                                            const id = v.TLOid || v.item_number || v.assignment_id;
                                            const isTarget = applicantProfile?.target_vacancy_id === id;
                                            const sgInfo = getSalaryGradeBadge(v.salary_grade);

                                            return (
                                                <div
                                                    key={id}
                                                    className={`p-4 sm:p-5 rounded-2xl border-2 transition-all flex flex-col justify-between gap-4 ${
                                                        isTarget
                                                            ? 'bg-blue-50/70 border-[#075985] shadow-md ring-2 ring-[#075985]/30'
                                                            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                                                    }`}
                                                >
                                                    <div className="space-y-3">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="space-y-1 flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <h4 className="text-sm font-black text-[#08315F] uppercase tracking-tight break-words">
                                                                        {v.position_title}
                                                                    </h4>
                                                                    <span className={`px-2 py-0.5 rounded-md border text-[9px] font-mono font-bold uppercase shrink-0 ${sgInfo.badge}`}>
                                                                        SG {v.salary_grade}
                                                                    </span>
                                                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase shrink-0">
                                                                        Vacant
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs font-bold text-slate-700 uppercase mt-1 break-words">
                                                                    {v.office || 'Department of Education'}
                                                                </p>
                                                            </div>
                                                            {isTarget && (
                                                                <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[9px] font-black uppercase shadow-sm flex items-center gap-1 shrink-0">
                                                                    <FiCheck size={11} /> Selected Target
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs min-w-0">
                                                            <span className="flex items-center gap-1.5 text-slate-600 font-bold min-w-0 truncate">
                                                                <FiMapPin size={12} className="text-[#075985] shrink-0" />
                                                                <span className="truncate">{v.region || 'Central Office'}</span>
                                                            </span>
                                                            <span className="font-mono text-[11px] text-slate-500 font-bold shrink-0">
                                                                Item: {id}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap items-center justify-between pt-3 border-t border-slate-100 text-xs gap-2.5">
                                                        <span className="text-[10px] font-mono text-slate-400 font-bold truncate min-w-0 max-w-[200px] sm:max-w-none">
                                                            {sgInfo.label}
                                                        </span>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <button
                                                                onClick={() => handleOpenApplyModal(v)}
                                                                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-400 to-sky-500 hover:from-sky-300 hover:to-sky-400 text-slate-900 text-xs font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                                                            >
                                                                <FiFileText size={13} />
                                                                <span>Apply Now</span>
                                                            </button>
                                                            <button
                                                                onClick={() => handleSelectVacancy(v)}
                                                                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 active:scale-95 ${
                                                                    isTarget
                                                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                                                        : 'bg-[#08315F] hover:bg-blue-900 text-white'
                                                                }`}
                                                            >
                                                                {isTarget ? (
                                                                    <>
                                                                        <FiCheck size={14} />
                                                                        <span>Target ✓</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <FiBookmark size={14} />
                                                                        <span>Target</span>
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Bottom Summary Bar or Pagination */}
                                {itemsPerPage === 'all' ? (
                                    <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-slate-100 text-xs font-bold text-slate-500 gap-2 text-center sm:text-left">
                                        <p className="flex items-center justify-center sm:justify-start gap-1.5 text-emerald-700 font-black uppercase tracking-wider text-[11px]">
                                            <FiCheckCircle size={14} /> Showing all {filteredVacancies.length} open positions in the Third Level Plantilla
                                        </p>
                                        <span className="font-mono text-slate-400 text-[10px]">
                                            Total in Database: {vacancies.length}
                                        </span>
                                    </div>
                                ) : totalPages > 1 ? (
                                    <div className="flex flex-col sm:flex-row items-center justify-between pt-4 sm:pt-6 border-t border-slate-100 gap-3">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center sm:text-left">
                                            Showing {(currentPage - 1) * pageSizeNumber + 1} to {Math.min(currentPage * pageSizeNumber, filteredVacancies.length)} of {filteredVacancies.length} Total Matching (Page {currentPage} of {totalPages})
                                        </p>
                                        <div className="flex items-center gap-1.5 flex-wrap justify-center">
                                            <button
                                                type="button"
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                disabled={currentPage === 1}
                                                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold disabled:opacity-50 transition-colors"
                                            >
                                                Previous
                                            </button>
                                            {getPageNumbers(currentPage, totalPages).map((p, idx) => (
                                                p === '...' ? (
                                                    <span key={`dots-catalog-${idx}`} className="px-2 text-slate-400 text-xs font-bold">...</span>
                                                ) : (
                                                    <button
                                                        key={p}
                                                        type="button"
                                                        onClick={() => setCurrentPage(p)}
                                                        className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                                                            currentPage === p
                                                                ? 'bg-[#08315F] text-white shadow-sm'
                                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                        }`}
                                                    >
                                                        {p}
                                                    </button>
                                                )
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                disabled={currentPage === totalPages}
                                                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold disabled:opacity-50 transition-colors"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        )}

                        {/* TAB 3: MY SUBMITTED APPLICATIONS */}
                        {activeTab === 'applications' && (
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3 sm:gap-4">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-base font-black text-[#08315F] uppercase tracking-tight">
                                                My Submitted Applications
                                            </h3>
                                            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-[#08315F] font-black text-[10px] uppercase">
                                                {applications.length} Total Filed
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400 font-medium mt-0.5 break-words">
                                            Official applications registered under UID: {applicantProfile?.applicant_uid}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleOpenApplyModal()}
                                        className="w-full sm:w-auto justify-center px-4 py-2.5 rounded-xl bg-[#08315F] hover:bg-blue-900 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all active:scale-95 shrink-0"
                                    >
                                        <FiFileText size={14} className="text-sky-300" />
                                        <span>Submit New Application</span>
                                    </button>
                                </div>

                                {loadingApplications ? (
                                    <div className="py-20 sm:py-24 text-center bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                                        <FiLoader className="animate-spin mx-auto text-[#075985] mb-3" size={32} />
                                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Applications...</p>
                                    </div>
                                ) : applications.length === 0 ? (
                                    <div className="py-14 sm:py-20 text-center bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200 p-4 sm:p-8 space-y-4">
                                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-blue-50 text-[#08315F] flex items-center justify-center mx-auto">
                                            <FiFileText size={28} className="sm:hidden" />
                                            <FiFileText size={32} className="hidden sm:block" />
                                        </div>
                                        <div className="max-w-md mx-auto space-y-1">
                                            <h4 className="text-sm sm:text-base font-black uppercase text-slate-800 tracking-tight">
                                                No Applications Submitted Yet
                                            </h4>
                                            <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                                You have not filed any official applications for DepEd Third Level positions. Browse the catalog of open vacancies or click below to start your application.
                                            </p>
                                        </div>
                                        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3">
                                            <button
                                                onClick={() => handleOpenApplyModal()}
                                                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#08315F] text-white text-xs font-black uppercase tracking-wider shadow-sm hover:bg-blue-900 transition-all active:scale-95 flex items-center justify-center gap-2"
                                            >
                                                <FiFileText size={14} />
                                                <span>Apply for Vacant Position</span>
                                            </button>
                                            <button
                                                onClick={() => handleNavigateTab('vacancies')}
                                                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider transition-all text-center"
                                            >
                                                Browse Catalog
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                                        {applications.map((app) => {
                                            const docKeys = [
                                                app.letter_of_intent_binary_id,
                                                app.pds_binary_id,
                                                app.work_experience_sheet_binary_id,
                                                app.cv_binary_id,
                                                app.outstanding_accomplishments_binary_id,
                                                app.service_records_binary_id,
                                                app.transcript_of_records_binary_id,
                                                app.performance_eval_binary_id,
                                                app.self_certification_binary_id,
                                                app.id_picture_binary_id,
                                                app.applicant_profile_doc_binary_id,
                                                app.other_documents_binary_id
                                            ];
                                            const uploadedDocsCount = docKeys.filter(Boolean).length;

                                            return (
                                                <div
                                                    key={app.id || app.application_no}
                                                    className="p-4 sm:p-6 rounded-3xl border-2 border-slate-200 bg-white hover:border-slate-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 min-w-0"
                                                >
                                                    <div className="space-y-3 min-w-0">
                                                        <div className="flex items-start justify-between gap-2.5 min-w-0">
                                                            <div className="min-w-0 flex-1">
                                                                <span className="font-mono text-xs font-black text-[#08315F] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 inline-block">
                                                                    {app.application_no}
                                                                </span>
                                                                <h4 className="text-sm sm:text-base font-black text-[#08315F] uppercase tracking-tight mt-2 break-words">
                                                                    {app.position_applying_for}
                                                                </h4>
                                                                <p className="text-xs text-slate-500 font-bold mt-0.5 break-words">
                                                                    Office: {app.plantilla_office || 'DepEd'}
                                                                </p>
                                                            </div>

                                                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wider shrink-0">
                                                                {app.status || 'Submitted'}
                                                            </span>
                                                        </div>

                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                                                            <div>
                                                                <span className="text-[10px] font-black uppercase text-slate-400 block">Submitted On</span>
                                                                <span className="font-bold text-slate-700">
                                                                    {app.created_at ? new Date(app.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="text-[10px] font-black uppercase text-slate-400 block">Documents Attached</span>
                                                                <span className="font-bold text-slate-700 flex items-center gap-1">
                                                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                                                    {uploadedDocsCount} of 12 Files
                                                                </span>
                                                            </div>
                                                            <div className="col-span-1 sm:col-span-2">
                                                                <span className="text-[10px] font-black uppercase text-slate-400 block">Current Designation</span>
                                                                <span className="font-bold text-slate-700 break-words block">
                                                                    {app.current_designation}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase break-words">
                                                            Item: {app.target_vacancy_id || 'General Pool'}
                                                        </span>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedAppForView(app);
                                                                setIsViewAppModalOpen(true);
                                                            }}
                                                            className="w-full sm:w-auto justify-center px-4 py-2 rounded-xl bg-[#08315F] hover:bg-blue-900 text-white text-xs font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                                                        >
                                                            <FiFileText size={13} />
                                                            <span>View Details</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 4: APPLICANT DATA PROFILE VIEW & EDIT */}
                        {activeTab === 'profile' && (
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3 sm:gap-4">
                                    <div>
                                        <h3 className="text-base font-black text-[#08315F] uppercase tracking-tight">
                                            Applicant Information Profile
                                        </h3>
                                        <p className="text-xs text-slate-400 font-medium">
                                            Live database record from table <span className="font-mono text-slate-600">vacancy_applicants</span>
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setIsEditModalOpen(true)}
                                        className="w-full sm:w-auto justify-center px-4 py-2 rounded-xl bg-[#08315F] hover:bg-blue-900 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all"
                                    >
                                        <FiEdit3 size={13} />
                                        <span>Edit Details</span>
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 min-w-0">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                            Applicant UID
                                        </span>
                                        <p className="text-sm font-mono font-bold text-[#08315F] break-all">
                                            {applicantProfile?.applicant_uid || 'N/A'}
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 min-w-0">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                            Registration Status
                                        </span>
                                        <p className="text-sm font-bold text-emerald-700 uppercase flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                            {applicantProfile?.registration_status || 'Active'}
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 min-w-0">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                            Full Name
                                        </span>
                                        <p className="text-sm font-bold text-slate-800 uppercase break-words">
                                            {fullName}
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 min-w-0">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                            Email Address
                                        </span>
                                        <p className="text-sm font-bold text-slate-800 break-all">
                                            {applicantProfile?.email}
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 min-w-0">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                            Contact Number
                                        </span>
                                        <p className="text-sm font-bold text-slate-800 break-words">
                                            {applicantProfile?.contact_number || 'Not provided'}
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 min-w-0">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                            Target Vacancy
                                        </span>
                                        <p className="text-sm font-bold text-[#08315F] uppercase break-words">
                                            {applicantProfile?.target_position_title || 'No position chosen'}
                                        </p>
                                        {applicantProfile?.target_vacancy_id && (
                                            <p className="text-[10px] font-mono text-slate-400 mt-0.5 break-all">
                                                Code: {applicantProfile.target_vacancy_id}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                                        Qualifications / Career Remarks
                                    </span>
                                    <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-wrap break-words">
                                        {applicantProfile?.notes || 'No remarks added yet. Click "Edit Details" above to add your CESO eligibility, achievements, or statement of intent.'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </main>
                </div>

                {/* 3. EDIT APPLICANT DATA MODAL */}
                <EditVacancyApplicantModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    applicantProfile={applicantProfile}
                    onSave={handleUpdateProfile}
                    vacancies={vacancies}
                />

                {/* 4. APPLY FOR VACANCY MODAL */}
                <ApplyVacancyModal
                    isOpen={isApplyModalOpen}
                    onClose={() => {
                        setIsApplyModalOpen(false);
                        setSelectedVacancyForApply(null);
                    }}
                    vacancy={selectedVacancyForApply}
                    applicantProfile={applicantProfile}
                    onSuccess={handleApplicationSuccess}
                />

                {/* 5. VIEW APPLICATION DETAILS MODAL */}
                <ViewApplicationDetailsModal
                    isOpen={isViewAppModalOpen}
                    onClose={() => {
                        setIsViewAppModalOpen(false);
                        setSelectedAppForView(null);
                    }}
                    application={selectedAppForView}
                />
            </div>
        </PageTransition>
    );
};

export default VacancyDashboard;

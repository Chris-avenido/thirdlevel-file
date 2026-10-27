import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    FiGrid, FiBriefcase, FiUser, FiSearch, FiLoader, 
    FiCheckCircle, FiAlertTriangle, FiBookmark, FiEdit3, 
    FiPhone, FiMail, FiCalendar, FiClock, FiMenu, FiCheck, 
    FiFilter, FiFileText, FiAward, FiArrowRight, FiTrash2
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import PageTransition from '../components/PageTransition';
import VacancySidebar from '../components/VacancySidebar';
import EditVacancyApplicantModal from '../components/EditVacancyApplicantModal';
import { apiUrl } from '../utils/api';
import Swal from 'sweetalert2';

const VacancyDashboard = ({ defaultTab = 'overview' }) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user, token, logout, setUser } = useAuth();

    // Tab state: 'overview' | 'vacancies' | 'profile'
    const initialTab = searchParams.get('tab') || defaultTab;
    const [activeTab, setActiveTab] = useState(initialTab);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Data States
    const [applicantProfile, setApplicantProfile] = useState(null);
    const [vacancies, setVacancies] = useState([]);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [loadingVacancies, setLoadingVacancies] = useState(true);

    // Vacancy Filter & Search States
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedOffice, setSelectedOffice] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 6;

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

    useEffect(() => {
        fetchApplicantProfile();
        fetchVacancies();
    }, [fetchApplicantProfile, fetchVacancies]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedOffice]);

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

    // Unique Offices for filtering
    const officeOptions = useMemo(() => {
        return ['All', ...new Set(vacancies.map(v => v.office).filter(Boolean))];
    }, [vacancies]);

    // Filtered Vacancies
    const filteredVacancies = useMemo(() => {
        return vacancies.filter(v => {
            const q = searchQuery.toLowerCase();
            const matchesQuery = 
                (v.position_title && v.position_title.toLowerCase().includes(q)) ||
                (v.office && v.office.toLowerCase().includes(q)) ||
                (v.strand && v.strand.toLowerCase().includes(q)) ||
                (v.TLOid && v.TLOid.toLowerCase().includes(q));

            const matchesOffice = selectedOffice === 'All' || v.office === selectedOffice;
            return matchesQuery && matchesOffice;
        });
    }, [vacancies, searchQuery, selectedOffice]);

    const totalPages = Math.ceil(filteredVacancies.length / itemsPerPage);
    const currentVacancies = filteredVacancies.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
                    setActiveTab={setActiveTab}
                    vacanciesCount={vacancies.length}
                    onOpenEditModal={() => setIsEditModalOpen(true)}
                    isMobileOpen={isMobileOpen}
                    setIsMobileOpen={setIsMobileOpen}
                />

                {/* 2. MAIN WORKSPACE / DASHBOARD AREA */}
                <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto relative">
                    
                    {/* Top Executive Header */}
                    <header className="sticky top-0 z-40 bg-[#08315F] text-white px-6 lg:px-10 py-4 flex items-center justify-between shadow-md border-b border-blue-900/50 shrink-0">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsMobileOpen(true)}
                                className="lg:hidden p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                            >
                                <FiMenu size={20} />
                            </button>
                            <div>
                                <h1 className="text-base lg:text-lg font-black uppercase tracking-tight italic flex items-center gap-2">
                                    <span>Applicant</span>
                                    <span className="text-sky-300 not-italic">Dashboard</span>
                                </h1>
                                <p className="text-[10px] font-bold text-blue-200/80 uppercase tracking-widest hidden sm:block">
                                    Department of Education • Third Level Opportunities
                                </p>
                            </div>
                        </div>

                        {/* User Pill & Quick Action */}
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setIsEditModalOpen(true)}
                                className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-black uppercase tracking-wider border border-white/20 transition-all active:scale-95"
                            >
                                <FiEdit3 size={13} className="text-sky-300" />
                                <span>Edit Profile</span>
                            </button>

                            <div className="flex flex-col items-end">
                                <span className="text-xs font-black uppercase tracking-tight text-white leading-tight">
                                    {fullName}
                                </span>
                                <span className="text-[9px] font-mono font-bold text-[#FCD116] uppercase tracking-wider mt-0.5">
                                    {applicantProfile?.applicant_uid || 'VAC-2026'}
                                </span>
                            </div>
                        </div>
                    </header>

                    {/* Main Scrollable View Body */}
                    <main className="p-6 lg:p-10 space-y-8 flex-1">
                        
                        {/* Welcome Banner */}
                        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#08315F] via-[#0A3D78] to-[#075985] text-white p-7 lg:p-9 shadow-xl">
                            <div className="absolute -top-12 -right-12 w-64 h-64 bg-sky-400/20 rounded-full blur-3xl pointer-events-none"></div>
                            <div className="relative z-10 max-w-3xl space-y-2">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-[10px] font-black uppercase tracking-widest text-sky-200">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                    Active Applicant Workspace
                                </div>
                                <h2 className="text-2xl lg:text-3xl font-black tracking-tight uppercase">
                                    Welcome, {applicantProfile?.first_name || 'Applicant'}!
                                </h2>
                                <p className="text-blue-100/90 text-xs lg:text-sm font-medium leading-relaxed">
                                    Manage your profile details stored in the <span className="font-mono font-bold text-white bg-black/20 px-1.5 py-0.5 rounded">vacancy_applicants</span> registry, track your target position, and browse open executive vacancies.
                                </p>
                            </div>
                        </div>

                        {/* Top 4 KPI Metric Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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
                            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
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

                            {/* Card 3: Total Vacancies Available */}
                            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-[#08315F] transition-all"
                                 onClick={() => setActiveTab('vacancies')}>
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

                            {/* Card 4: Profile Completeness */}
                            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
                                <div className="space-y-1.5 flex-1 pr-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Profile Completeness
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                                            <div 
                                                className="h-full bg-gradient-to-r from-[#08315F] to-emerald-500 rounded-full transition-all duration-500"
                                                style={{ width: `${profileCompleteness}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-black text-[#08315F]">{profileCompleteness}%</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-medium">
                                        {profileCompleteness === 100 ? 'Profile complete' : 'Add qualifications/target'}
                                    </p>
                                </div>
                                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                                    <FiAward size={24} />
                                </div>
                            </div>
                        </div>

                        {/* View Switcher Tabs */}
                        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                            <button
                                onClick={() => setActiveTab('overview')}
                                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                                    activeTab === 'overview'
                                        ? 'bg-[#08315F] text-white shadow-md'
                                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                }`}
                            >
                                <FiGrid size={14} />
                                <span>Dashboard & Data</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('vacancies')}
                                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                                    activeTab === 'vacancies'
                                        ? 'bg-[#08315F] text-white shadow-md'
                                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                }`}
                            >
                                <FiBriefcase size={14} />
                                <span>List of Vacancies ({vacancies.length})</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('profile')}
                                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                                    activeTab === 'profile'
                                        ? 'bg-[#08315F] text-white shadow-md'
                                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                }`}
                            >
                                <FiUser size={14} />
                                <span>Applicant Information</span>
                            </button>
                        </div>

                        {/* TAB 1: OVERVIEW & DATA SUMMARY */}
                        {activeTab === 'overview' && (
                            <div className="space-y-8">
                                
                                {/* Section A: Applicant Profile Data (vacancy_applicants) */}
                                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-6">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
                                        <div>
                                            <div className="flex items-center gap-2">
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
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                                First Name
                                            </span>
                                            <p className="text-xs font-bold text-slate-800 uppercase">
                                                {applicantProfile?.first_name || '—'}
                                            </p>
                                        </div>

                                        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                                Middle Name
                                            </span>
                                            <p className="text-xs font-bold text-slate-800 uppercase">
                                                {applicantProfile?.middle_name || '—'}
                                            </p>
                                        </div>

                                        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                                Last Name & Suffix
                                            </span>
                                            <p className="text-xs font-bold text-slate-800 uppercase">
                                                {applicantProfile?.last_name || '—'} {applicantProfile?.suffix || ''}
                                            </p>
                                        </div>

                                        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                                Email Address (Official)
                                            </span>
                                            <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                                <FiMail size={13} className="text-[#075985]" />
                                                <span className="break-all">{applicantProfile?.email || '—'}</span>
                                            </p>
                                        </div>

                                        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                                Contact Number
                                            </span>
                                            <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                                <FiPhone size={13} className="text-[#075985]" />
                                                <span>{applicantProfile?.contact_number || 'Not provided'}</span>
                                            </p>
                                        </div>

                                        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                                Applicant UID & Status
                                            </span>
                                            <div className="flex items-center gap-2">
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
                                    <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-[#075985] flex items-center gap-1.5">
                                                <FiBookmark size={12} /> Target Vacancy Application
                                            </span>
                                            {applicantProfile?.target_position_title ? (
                                                <div>
                                                    <h4 className="text-sm font-black text-[#08315F] uppercase">
                                                        {applicantProfile.target_position_title}
                                                    </h4>
                                                    <p className="text-[10px] font-mono text-slate-500 font-bold">
                                                        Item Code: {applicantProfile.target_vacancy_id}
                                                    </p>
                                                </div>
                                            ) : (
                                                <p className="text-xs font-medium text-slate-500 italic">
                                                    No target vacancy selected yet. Browse the vacancy catalog to choose a position.
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {applicantProfile?.target_vacancy_id ? (
                                                <>
                                                    <button
                                                        onClick={() => setActiveTab('vacancies')}
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
                                                    onClick={() => setActiveTab('vacancies')}
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
                                        <p className="text-xs font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">
                                            {applicantProfile?.notes || (
                                                <span className="text-slate-400 italic">
                                                    No qualifications or statements added yet. Click "Edit Applicant Data" to enter your eligibility (e.g. CESO, CSEE) or career summary.
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>

                                {/* Section B: Featured Open Vacancies List Preview */}
                                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-5">
                                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                        <div>
                                            <h3 className="text-base font-black text-[#08315F] uppercase tracking-tight">
                                                Open Positions & Opportunities Preview
                                            </h3>
                                            <p className="text-xs text-slate-400 font-medium">
                                                Top available vacancies from the Third Level plantilla
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setActiveTab('vacancies')}
                                            className="text-xs font-black uppercase tracking-wider text-[#075985] hover:text-blue-900 flex items-center gap-1 transition-colors"
                                        >
                                            <span>View All ({vacancies.length})</span>
                                            <FiArrowRight size={13} />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {vacancies.slice(0, 4).map(v => {
                                            const id = v.TLOid || v.item_number || v.assignment_id;
                                            const isTarget = applicantProfile?.target_vacancy_id === id;
                                            return (
                                                <div 
                                                    key={id} 
                                                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                                                        isTarget 
                                                            ? 'bg-blue-50/70 border-[#075985] shadow-sm ring-1 ring-[#075985]/30'
                                                            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                                                    }`}
                                                >
                                                    <div>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <h4 className="text-xs font-black text-[#08315F] uppercase tracking-tight">
                                                                {v.position_title}
                                                            </h4>
                                                            {isTarget && (
                                                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase">
                                                                    Target
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                            {v.office || 'Department of Education'}
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
                                                        <span className="font-mono text-slate-500 font-bold">Item: {id}</span>
                                                        <button
                                                            onClick={() => handleSelectVacancy(v)}
                                                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                                                isTarget
                                                                    ? 'bg-emerald-600 text-white'
                                                                    : 'bg-[#08315F] hover:bg-blue-900 text-white'
                                                            }`}
                                                        >
                                                            {isTarget ? 'Selected ✓' : 'Select Target'}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: FULL LIST OF VACANCIES */}
                        {activeTab === 'vacancies' && (
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-6">
                                
                                {/* Search & Filters Header */}
                                <div className="flex flex-col md:flex-row gap-4 items-center justify-between pb-4 border-b border-slate-100">
                                    <div className="w-full md:w-auto">
                                        <h3 className="text-base font-black text-[#08315F] uppercase tracking-tight">
                                            List of Available Vacancies
                                        </h3>
                                        <p className="text-xs text-slate-400 font-medium">
                                            Showing {filteredVacancies.length} of {vacancies.length} open positions
                                        </p>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                                        {/* Search Input */}
                                        <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200 w-full sm:w-72 focus-within:border-[#08315F] focus-within:ring-2 focus-within:ring-[#08315F]/15 transition-all">
                                            <FiSearch size={16} className="text-slate-400 shrink-0" />
                                            <input
                                                type="text"
                                                placeholder="Search position or office..."
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                className="w-full bg-transparent border-none text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none"
                                            />
                                        </div>

                                        {/* Office Filter */}
                                        {officeOptions.length > 2 && (
                                            <select
                                                value={selectedOffice}
                                                onChange={e => setSelectedOffice(e.target.value)}
                                                className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:border-[#08315F] cursor-pointer"
                                            >
                                                {officeOptions.map(o => (
                                                    <option key={o} value={o}>{o === 'All' ? 'All Offices' : o}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                </div>

                                {/* Vacancies List Grid */}
                                <div className="space-y-4">
                                    {loadingVacancies ? (
                                        <div className="py-24 text-center bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                                            <FiLoader className="animate-spin mx-auto text-[#075985] mb-3" size={30} />
                                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Vacancies Catalog...</p>
                                        </div>
                                    ) : filteredVacancies.length === 0 ? (
                                        <div className="py-24 text-center bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                                            <FiAlertTriangle className="mx-auto text-amber-500 mb-3" size={30} />
                                            <p className="text-xs font-black uppercase tracking-wide text-slate-700">No matching vacancies found</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-4">
                                            {currentVacancies.map(v => {
                                                const id = v.TLOid || v.item_number || v.assignment_id;
                                                const isTarget = applicantProfile?.target_vacancy_id === id;

                                                return (
                                                    <div
                                                        key={id}
                                                        className={`p-5 rounded-2xl border-2 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                                                            isTarget
                                                                ? 'bg-blue-50/60 border-[#075985] shadow-md ring-1 ring-[#075985]/30'
                                                                : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-sm'
                                                        }`}
                                                    >
                                                        <div className="flex items-start sm:items-center gap-4">
                                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                                                                isTarget ? 'bg-[#08315F] text-white' : 'bg-slate-100 text-slate-500'
                                                            }`}>
                                                                <FiBriefcase size={22} />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <h4 className="text-sm font-black text-[#08315F] uppercase tracking-tight">
                                                                        {v.position_title}
                                                                    </h4>
                                                                    {v.is_oic && (
                                                                        <span className="px-1.5 py-0.5 rounded bg-[#FCD116] text-[#08315F] text-[8px] font-black uppercase">
                                                                            OIC
                                                                        </span>
                                                                    )}
                                                                    {isTarget && (
                                                                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase flex items-center gap-1">
                                                                            <FiCheckCircle size={10} /> Selected Target Position
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-3 text-slate-500 flex-wrap text-[10px] font-bold">
                                                                    <span className="text-[#075985] uppercase">{v.office || 'DepEd Office'}</span>
                                                                    {v.strand && (
                                                                        <>
                                                                            <span>•</span>
                                                                            <span className="text-slate-400 uppercase">{v.strand}</span>
                                                                        </>
                                                                    )}
                                                                    {v.salary_grade && (
                                                                        <>
                                                                            <span>•</span>
                                                                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                                                                                SG {v.salary_grade}
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                    <span>•</span>
                                                                    <span className="font-mono text-slate-400">Item: {id}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Action Button */}
                                                        <div className="self-end md:self-center shrink-0">
                                                            <button
                                                                onClick={() => handleSelectVacancy(v)}
                                                                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-2 active:scale-95 ${
                                                                    isTarget
                                                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                                                        : 'bg-[#08315F] hover:bg-blue-900 text-white'
                                                                }`}
                                                            >
                                                                {isTarget ? (
                                                                    <>
                                                                        <FiCheck size={14} />
                                                                        <span>Selected Target</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <FiBookmark size={14} />
                                                                        <span>Select Target</span>
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Pagination Controls */}
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                Page {currentPage} of {totalPages}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                    disabled={currentPage === 1}
                                                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold disabled:opacity-50 transition-colors"
                                                >
                                                    Previous
                                                </button>
                                                <button
                                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                    disabled={currentPage === totalPages}
                                                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold disabled:opacity-50 transition-colors"
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB 3: APPLICANT DATA PROFILE VIEW & EDIT */}
                        {activeTab === 'profile' && (
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-6">
                                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
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
                                        className="px-4 py-2 rounded-xl bg-[#08315F] hover:bg-blue-900 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all"
                                    >
                                        <FiEdit3 size={13} />
                                        <span>Edit Details</span>
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                            Applicant UID
                                        </span>
                                        <p className="text-sm font-mono font-bold text-[#08315F]">
                                            {applicantProfile?.applicant_uid || 'N/A'}
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                            Registration Status
                                        </span>
                                        <p className="text-sm font-bold text-emerald-700 uppercase flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                            {applicantProfile?.registration_status || 'Active'}
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                            Full Name
                                        </span>
                                        <p className="text-sm font-bold text-slate-800 uppercase">
                                            {fullName}
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                            Email Address
                                        </span>
                                        <p className="text-sm font-bold text-slate-800 break-all">
                                            {applicantProfile?.email}
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                            Contact Number
                                        </span>
                                        <p className="text-sm font-bold text-slate-800">
                                            {applicantProfile?.contact_number || 'Not provided'}
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                                            Target Vacancy
                                        </span>
                                        <p className="text-sm font-bold text-[#08315F] uppercase truncate">
                                            {applicantProfile?.target_position_title || 'No position chosen'}
                                        </p>
                                        {applicantProfile?.target_vacancy_id && (
                                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                                                Code: {applicantProfile.target_vacancy_id}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                                        Qualifications / Career Remarks
                                    </span>
                                    <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
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
            </div>
        </PageTransition>
    );
};

export default VacancyDashboard;

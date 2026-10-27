import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    FiChevronLeft, FiBriefcase, FiSearch, FiLoader, FiAlertTriangle, 
    FiUser, FiLock, FiCheckCircle, FiSidebar, FiFilter, FiBookmark 
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import PageTransition from '../components/PageTransition';
import VacancyApplicantSidebar from '../components/VacancyApplicantSidebar';
import { apiUrl } from '../utils/api';
import Swal from 'sweetalert2';

const AllVacancies = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user, token, logout, setUser } = useAuth();
    
    const [vacancies, setVacancies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [officeFilter, setOfficeFilter] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 6;

    // Applicant Profile State (for Sidebar Display & Editing)
    const [applicantProfile, setApplicantProfile] = useState(null);
    const [profileLoading, setProfileLoading] = useState(true);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    // Fetch Vacancies
    useEffect(() => {
        const fetchVacancies = async () => {
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
                setLoading(false);
            }
        };
        fetchVacancies();
    }, [token]);

    // Fetch Applicant Profile
    const fetchApplicantProfile = useCallback(async () => {
        setProfileLoading(true);
        try {
            const res = await fetch(apiUrl('/api/third-level/vacancy-applicant/profile'), {
                headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success && data.data) {
                setApplicantProfile(data.data);
            } else if (user) {
                // Fallback to existing auth user data if no record exists yet
                setApplicantProfile({
                    applicant_uid: user.uid,
                    first_name: user.first_name || '',
                    last_name: user.last_name || '',
                    middle_name: '',
                    suffix: '',
                    email: user.email || '',
                    contact_number: user.contact_number || '',
                    registration_status: 'Active',
                    target_vacancy_id: null,
                    target_position_title: null,
                    notes: ''
                });
            }
        } catch (err) {
            console.error('Failed to fetch applicant profile:', err);
            if (user) {
                setApplicantProfile({
                    applicant_uid: user.uid,
                    first_name: user.first_name || '',
                    last_name: user.last_name || '',
                    email: user.email || '',
                    registration_status: 'Active'
                });
            }
        } finally {
            setProfileLoading(false);
        }
    }, [token, user]);

    useEffect(() => {
        fetchApplicantProfile();
    }, [fetchApplicantProfile]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, officeFilter]);

    // Handle Updating Profile Data
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
                // Also update user in AuthContext if name changed
                if (setUser && user) {
                    const updatedUser = {
                        ...user,
                        first_name: data.data.first_name || user.first_name,
                        last_name: data.data.last_name || user.last_name
                    };
                    setUser(updatedUser);
                    localStorage.setItem('user', JSON.stringify(updatedUser));
                }
                return true;
            } else {
                throw new Error(data.error || 'Failed to update applicant profile');
            }
        } catch (err) {
            console.error('Update profile error:', err);
            throw err;
        }
    };

    // Handle Selecting/Applying for a Vacancy
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
                            <p class="font-bold text-[#08315F]">You have chosen:</p>
                            <p class="font-black text-slate-800 text-base uppercase">${positionTitle}</p>
                            <p class="text-xs text-slate-500">Item: ${vacancyId} • ${v.office || 'Department of Education'}</p>
                            <p class="text-[11px] text-emerald-600 font-bold mt-2">✓ Updated in your Applicant Profile Sidebar.</p>
                        </div>
                    `,
                    confirmButtonColor: '#08315F',
                    confirmButtonText: 'Done'
                });
            } else {
                throw new Error(data.error || 'Failed to select vacancy');
            }
        } catch (err) {
            console.error('Failed to apply for vacancy:', err);
            Swal.fire({
                icon: 'error',
                title: 'Selection Failed',
                text: err.message || 'Unable to update target vacancy.',
                confirmButtonColor: '#08315F'
            });
        }
    };

    // Handle Clearing Target Vacancy
    const handleClearTargetVacancy = async () => {
        const result = await Swal.fire({
            title: 'Clear Target Vacancy?',
            text: 'Are you sure you want to remove your selected target position?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#08315F',
            confirmButtonText: 'Yes, clear it'
        });

        if (result.isConfirmed) {
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
                        title: 'Cleared',
                        text: 'Target vacancy removed from your profile.',
                        timer: 1500,
                        showConfirmButton: false
                    });
                }
            } catch (err) {
                console.error('Failed to clear target vacancy:', err);
            }
        }
    };

    // Extract unique offices for quick filtering
    const officeOptions = ['All', ...new Set(vacancies.map(v => v.office).filter(Boolean))];

    // Filter vacancies
    const filteredVacancies = vacancies.filter(v => {
        const matchesQuery = 
            (v.position_title && v.position_title.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (v.office && v.office.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (v.strand && v.strand.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (v.TLOid && v.TLOid.toLowerCase().includes(searchQuery.toLowerCase()));
        
        const matchesOffice = officeFilter === 'All' || v.office === officeFilter;
        return matchesQuery && matchesOffice;
    });

    const totalPages = Math.ceil(filteredVacancies.length / itemsPerPage);
    const currentVacancies = filteredVacancies.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50/60 font-['Plus_Jakarta_Sans'] text-[#08315F] relative flex flex-col">
                {/* Header Banner */}
                <header className="bg-[#08315F] text-white relative overflow-hidden shadow-xl border-b border-[#0038A8]/20 py-6 px-6 lg:px-8 shrink-0">
                    <div className="absolute -top-[100%] right-[-10%] w-[50%] h-[300%] bg-[#075985] rounded-[100%] opacity-90 pointer-events-none transform rotate-12 z-0"></div>
                    <div className="max-w-[1500px] mx-auto flex flex-col gap-5 relative z-10">
                        {/* Top Navigation Row */}
                        <div className="flex justify-between items-center w-full">
                            <button 
                                onClick={() => navigate(-1)} 
                                className="flex items-center gap-2 text-slate-300 hover:text-white font-bold text-[10px] uppercase tracking-wider transition-all"
                            >
                                <FiChevronLeft size={16} /> Back
                            </button>

                            <div className="flex items-center gap-3">
                                {/* Mobile Sidebar Toggle Button */}
                                <button
                                    onClick={() => setIsMobileSidebarOpen(true)}
                                    className="lg:hidden flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-wider transition-all border border-white/20"
                                >
                                    <FiSidebar size={14} />
                                    <span>My Profile & Vacancies</span>
                                    {applicantProfile?.target_vacancy_id && (
                                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                    )}
                                </button>

                                <button 
                                    onClick={logout} 
                                    className="flex items-center gap-2 text-slate-300 hover:text-red-400 font-bold text-[10px] uppercase tracking-wider transition-all"
                                >
                                    <FiLock size={14} /> Sign Out
                                </button>
                            </div>
                        </div>

                        {/* Title Row & Quick Stat Pills */}
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                            <div className="flex flex-col gap-1.5 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-0.5 rounded-md bg-[#FCD116] text-[#08315F] font-black text-[9px] uppercase tracking-widest leading-none">
                                        Executive Recruitment
                                    </span>
                                    <span className="text-blue-200/80 text-[10px] font-black uppercase tracking-widest">
                                        DepEd Third Level
                                    </span>
                                </div>
                                <h1 className="text-xl md:text-2xl lg:text-3xl font-black text-white tracking-tight leading-none truncate">
                                    Open Positions & Vacancies
                                </h1>
                                <p className="text-blue-200/80 text-xs md:text-sm font-medium">
                                    Browse, search, and apply for vacant Third Level positions across the Department
                                </p>
                            </div>

                            {/* Live Counts */}
                            <div className="flex items-center gap-3 shrink-0">
                                <div className="px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-right">
                                    <p className="text-[9px] font-black text-blue-200 uppercase tracking-widest">Total Positions</p>
                                    <p className="text-base font-black text-white leading-tight">{vacancies.length}</p>
                                </div>
                                {applicantProfile?.target_position_title && (
                                    <div className="hidden sm:block px-4 py-2 rounded-2xl bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 text-right">
                                        <p className="text-[9px] font-black text-emerald-200 uppercase tracking-widest flex items-center justify-end gap-1">
                                            <FiCheckCircle size={10} /> Target Set
                                        </p>
                                        <p className="text-xs font-black text-white leading-tight max-w-[180px] truncate">
                                            {applicantProfile.target_position_title}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content Area with Integrated Sidebar */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    <div className="max-w-[1500px] w-full mx-auto flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
                        
                        {/* SIDEBAR: Display & Edit Applicant Data + Vacancies Directory */}
                        <VacancyApplicantSidebar
                            applicantProfile={applicantProfile}
                            loading={profileLoading}
                            vacancies={vacancies}
                            onUpdateProfile={handleUpdateProfile}
                            onSelectVacancy={handleSelectVacancy}
                            onClearTargetVacancy={handleClearTargetVacancy}
                            isMobileOpen={isMobileSidebarOpen}
                            setIsMobileOpen={setIsMobileSidebarOpen}
                        />

                        {/* MAIN CATALOG PANEL: Available Vacancies List */}
                        <div className="flex-1 w-full space-y-5">
                            
                            {/* Search and Filters Bar */}
                            <div className="bg-white p-4 rounded-[22px] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                                {/* Search Input */}
                                <div className="flex items-center gap-3 w-full md:w-auto md:flex-1 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200/80 focus-within:border-[#08315F] focus-within:ring-2 focus-within:ring-[#08315F]/15 transition-all">
                                    <FiSearch className="text-slate-400 shrink-0" size={18} />
                                    <input 
                                        type="text"
                                        placeholder="Search by position title, item number, office, or strand..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full bg-transparent border-none text-xs md:text-sm font-semibold text-slate-800 placeholder:text-slate-400 outline-none"
                                    />
                                    {searchQuery && (
                                        <button 
                                            onClick={() => setSearchQuery('')}
                                            className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>

                                {/* Office Filter Pills (or Dropdown) */}
                                {officeOptions.length > 2 && (
                                    <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                                        <FiFilter className="text-slate-400 shrink-0" size={14} />
                                        <select
                                            value={officeFilter}
                                            onChange={e => setOfficeFilter(e.target.value)}
                                            className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-[#08315F] transition-all cursor-pointer w-full md:w-auto"
                                        >
                                            <option value="All">All Offices ({vacancies.length})</option>
                                            {officeOptions.filter(o => o !== 'All').map(office => (
                                                <option key={office} value={office}>{office}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Vacancies Cards Container */}
                            <div className="bg-white border border-slate-200/90 rounded-[24px] p-5 sm:p-7 shadow-sm space-y-5">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                    <div>
                                        <h3 className="text-xs font-black uppercase tracking-widest text-[#08315F]">
                                            Vacant Positions Catalog
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                            Showing {filteredVacancies.length} of {vacancies.length} Available Items
                                        </p>
                                    </div>

                                    {applicantProfile?.target_vacancy_id && (
                                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-[10px] font-bold">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                            <span>Active Selection in Sidebar</span>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    {loading ? (
                                        <div className="py-24 text-center bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                                            <FiLoader className="animate-spin mx-auto text-[#075985] mb-4" size={32} />
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Fetching Available Vacancies...
                                            </p>
                                        </div>
                                    ) : filteredVacancies.length === 0 ? (
                                        <div className="py-24 text-center bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                                            <FiAlertTriangle className="mx-auto text-amber-500 mb-4" size={32} />
                                            <p className="text-xs font-black text-slate-700 uppercase tracking-wide">
                                                {searchQuery || officeFilter !== 'All' ? 'No Matching Vacancies Found' : 'No Vacant Positions Registered'}
                                            </p>
                                            <p className="text-[10px] text-slate-400 mt-1">
                                                Try adjusting your search criteria or clearing filters.
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            <AnimatePresence>
                                                {currentVacancies.map(v => {
                                                    const vacancyId = v.TLOid || v.item_number || v.assignment_id;
                                                    const isSelectedTarget = 
                                                        applicantProfile?.target_vacancy_id === vacancyId || 
                                                        applicantProfile?.target_vacancy_id === v.TLOid ||
                                                        applicantProfile?.target_vacancy_id === v.item_number;

                                                    return (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 8 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, scale: 0.98 }}
                                                            key={vacancyId || v.id}
                                                            className={`w-full flex flex-col md:flex-row md:items-center justify-between p-5 sm:p-6 rounded-[22px] border-2 transition-all gap-5 ${
                                                                isSelectedTarget
                                                                    ? 'bg-blue-50/60 border-[#075985] shadow-md ring-2 ring-[#075985]/20'
                                                                    : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-md'
                                                            }`}
                                                        >
                                                            {/* Vacancy Identity & Meta */}
                                                            <div className="flex items-start sm:items-center gap-4">
                                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                                                                    isSelectedTarget 
                                                                        ? 'bg-[#08315F] text-white' 
                                                                        : 'bg-slate-100 text-slate-500'
                                                                }`}>
                                                                    <FiBriefcase size={20} />
                                                                </div>

                                                                <div className="space-y-1 min-w-0">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <h4 className="text-sm sm:text-base font-black text-[#08315F] uppercase tracking-tight leading-snug">
                                                                            {v.position_title}
                                                                        </h4>
                                                                        {v.is_oic && (
                                                                            <span className="px-2 py-0.5 rounded bg-[#FCD116] text-[#08315F] text-[8px] font-black uppercase tracking-widest leading-none">
                                                                                OIC
                                                                            </span>
                                                                        )}
                                                                        {isSelectedTarget && (
                                                                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                                                                                <FiCheckCircle size={10} /> Selected Target
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    <div className="flex items-center gap-3 text-slate-500 flex-wrap text-[10px] font-bold">
                                                                        <span className="text-[#075985] uppercase tracking-wider">
                                                                            {v.office || 'Department Office'}
                                                                        </span>
                                                                        {v.strand && (
                                                                            <>
                                                                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                                                <span className="text-slate-400 uppercase tracking-wider">{v.strand}</span>
                                                                            </>
                                                                        )}
                                                                        {v.salary_grade && (
                                                                            <>
                                                                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[9px]">
                                                                                    SG {v.salary_grade}
                                                                                </span>
                                                                            </>
                                                                        )}
                                                                        {vacancyId && (
                                                                            <>
                                                                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                                                <span className="text-slate-400 font-mono text-[9px]">
                                                                                    Item: {vacancyId}
                                                                                </span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Actions Row */}
                                                            <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                                                                <button
                                                                    onClick={() => handleSelectVacancy(v)}
                                                                    className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm flex items-center gap-2 ${
                                                                        isSelectedTarget
                                                                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                                                                            : 'bg-[#08315F] hover:bg-blue-900 text-white'
                                                                    }`}
                                                                >
                                                                    {isSelectedTarget ? (
                                                                        <>
                                                                            <FiCheckCircle size={13} />
                                                                            <span>Selected Target</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <FiBookmark size={13} />
                                                                            <span>Apply / Select</span>
                                                                        </>
                                                                    )}
                                                                </button>
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })}
                                            </AnimatePresence>

                                            {/* Pagination Controls */}
                                            {totalPages > 1 && (
                                                <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-slate-100 mt-4 gap-4">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                        Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredVacancies.length)} of {filteredVacancies.length}
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                        <button 
                                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                            disabled={currentPage === 1}
                                                            className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-bold disabled:opacity-50 transition-colors"
                                                        >
                                                            Previous
                                                        </button>
                                                        <div className="flex gap-1">
                                                            {[...Array(totalPages)].map((_, i) => (
                                                                <button
                                                                    key={i + 1}
                                                                    onClick={() => setCurrentPage(i + 1)}
                                                                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                                                                        currentPage === i + 1 
                                                                            ? 'bg-[#08315F] text-white shadow-sm' 
                                                                            : 'bg-transparent text-slate-500 hover:bg-slate-100'
                                                                    }`}
                                                                >
                                                                    {i + 1}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <button 
                                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                            disabled={currentPage === totalPages}
                                                            className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-bold disabled:opacity-50 transition-colors"
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

                    </div>
                </main>
            </div>
        </PageTransition>
    );
};

export default AllVacancies;

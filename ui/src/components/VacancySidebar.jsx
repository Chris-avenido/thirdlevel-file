import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    FiGrid, FiBriefcase, FiUser, FiLogOut, FiX, FiCheck, 
    FiCopy, FiBookmark, FiEdit3, FiFileText
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import modernLogo from '../assets/tlo_logo.png';
import Swal from 'sweetalert2';

const VacancySidebar = ({
    applicantProfile,
    loading = false,
    activeTab = 'overview',
    setActiveTab,
    vacanciesCount = 0,
    applicationsCount = 0,
    onOpenEditModal,
    isMobileOpen = false,
    setIsMobileOpen
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout } = useAuth();
    const [copiedUid, setCopiedUid] = useState(false);

    // Hover State for Collapsing / Minimizing (matches Central Office AdminSidebar)
    const [isHovered, setIsHovered] = useState(false);
    const sidebarCollapsed = !isHovered;

    const handleCopyUid = (uid) => {
        if (!uid) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(uid);
            setCopiedUid(true);
            setTimeout(() => setCopiedUid(false), 2000);
        }
    };

    const handleSignOut = () => {
        Swal.fire({
            title: 'Sign Out?',
            text: 'Are you sure you want to log out of the Vacancy Applicant portal?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#08315F',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, Sign Out'
        }).then((result) => {
            if (result.isConfirmed) {
                logout();
                navigate('/');
            }
        });
    };

    const fullName = [
        applicantProfile?.first_name,
        applicantProfile?.middle_name,
        applicantProfile?.last_name,
        applicantProfile?.suffix
    ].filter(Boolean).join(' ') || applicantProfile?.email || 'Applicant';

    const navItems = [
        {
            id: 'overview',
            label: 'Applicant Dashboard',
            icon: FiGrid,
            path: '/vacancy-dashboard',
            badge: null
        },
        {
            id: 'vacancies',
            label: 'List of Vacancies',
            icon: FiBriefcase,
            path: '/all-vacancies',
            badge: vacanciesCount > 0 ? vacanciesCount : null
        },
        {
            id: 'applications',
            label: 'My Applications',
            icon: FiFileText,
            path: '/my-applications',
            badge: applicationsCount > 0 ? applicationsCount : null
        },
        {
            id: 'profile',
            label: 'My Applicant Data',
            icon: FiUser,
            path: '/my-applicant-data',
            badge: applicantProfile?.target_vacancy_id ? 'Target Set' : null
        }
    ];

    const currentPath = location.pathname.toLowerCase();
    const isItemActive = (item) => {
        if (item.id === 'overview' && (currentPath === '/vacancy-dashboard' || currentPath === '/applicant-dashboard')) return true;
        if (item.id === 'vacancies' && (currentPath === '/all-vacancies' || currentPath === '/vacancies')) return true;
        if (item.id === 'applications' && (currentPath === '/my-applications' || currentPath === '/vacancy-applications')) return true;
        if (item.id === 'profile' && (currentPath === '/my-applicant-data' || currentPath === '/applicant-profile')) return true;
        return activeTab === item.id;
    };

    return (
        <>
            {/* Desktop Spacer to prevent content overlap matching collapsed sidebar */}
            <div className="hidden lg:block w-[96px] shrink-0" />

            {/* Mobile Overlay */}
            {isMobileOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90]"
                    onClick={() => setIsMobileOpen && setIsMobileOpen(false)}
                />
            )}

            {/* Main Sidebar Container with Hover Minimize / Expand */}
            <div
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={`fixed top-0 h-screen inset-y-0 left-0 z-[100] flex shrink-0 bg-[#08315F] border-r border-blue-900 flex-col pt-6 sm:pt-8 shadow-2xl transition-all duration-300 transform overflow-y-auto scrollbar-thin
                ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} 
                lg:translate-x-0 
                ${sidebarCollapsed ? 'w-[85vw] max-w-[320px] sm:w-[320px] lg:w-[96px]' : 'w-[85vw] max-w-[320px] sm:w-[320px]'}`}
            >
                {/* Mobile Close Button */}
                <button
                    onClick={() => setIsMobileOpen && setIsMobileOpen(false)}
                    className="lg:hidden absolute right-4 top-4 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                >
                    <FiX size={20} />
                </button>

                {/* Top Logo & Portal Branding */}
                <div className={`px-6 mb-8 flex ${sidebarCollapsed ? 'lg:justify-center' : 'justify-start'}`}>
                    <div className="flex items-center gap-4 mb-3">
                        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-[#08315F] font-black text-xl shadow-inner border border-white/5 shrink-0 overflow-hidden">
                            <img src={modernLogo} alt="Logo" className="w-8 h-8 object-contain" />
                        </div>
                        <div className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${sidebarCollapsed ? 'lg:w-0 lg:opacity-0' : 'w-auto opacity-100'}`}>
                            <h2 className="text-sm font-black text-white uppercase tracking-tight italic leading-none">InsightED</h2>
                            <p className="text-[10px] text-blue-300 font-bold tracking-widest uppercase mt-1">Applicant Portal</p>
                        </div>
                    </div>
                </div>

                {/* Applicant Profile Section */}
                {/* 1. Collapsed Avatar (desktop when minimized) */}
                <div className={`transition-all duration-300 ${sidebarCollapsed ? 'hidden lg:flex flex-col items-center mb-6 px-4' : 'hidden'}`}>
                    <button
                        onClick={onOpenEditModal}
                        title={`${fullName}\nUID: ${applicantProfile?.applicant_uid || 'N/A'}\nClick to view / edit profile`}
                        className="relative group w-12 h-12 rounded-2xl bg-gradient-to-br from-[#075985] to-[#08315F] text-white flex items-center justify-center font-black text-lg shadow-inner border border-white/20 hover:border-sky-300 hover:scale-105 transition-all cursor-pointer"
                    >
                        {applicantProfile?.first_name ? applicantProfile.first_name.charAt(0).toUpperCase() : <FiUser size={20} />}
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#08315F] animate-pulse" />
                    </button>
                </div>

                {/* 2. Expanded Profile Card (visible on mobile, and on desktop when hovered) */}
                <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:hidden' : 'block'} px-4 mb-6`}>
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/15 backdrop-blur-md shadow-lg">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-[#075985] text-white flex items-center justify-center font-black text-lg shadow-inner shrink-0 border border-white/20">
                                {applicantProfile?.first_name ? applicantProfile.first_name.charAt(0).toUpperCase() : <FiUser size={20} />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[8px] font-black uppercase tracking-widest border border-emerald-400/30">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                        {applicantProfile?.registration_status || 'Active'}
                                    </span>
                                </div>
                                <h3 className="text-xs font-black text-white uppercase truncate mt-1 tracking-tight" title={fullName}>
                                    {fullName}
                                </h3>
                                <p className="text-[10px] text-blue-200/80 truncate font-mono mt-0.5">
                                    {applicantProfile?.email || 'Registered Applicant'}
                                </p>
                            </div>
                        </div>

                        {/* Applicant UID Pill */}
                        {applicantProfile?.applicant_uid && (
                            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                                <span className="text-[9px] font-black uppercase tracking-wider text-blue-300/70">
                                    Applicant UID:
                                </span>
                                <button
                                    onClick={() => handleCopyUid(applicantProfile.applicant_uid)}
                                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-black/25 hover:bg-black/40 text-sky-200 text-[10px] font-mono font-bold transition-all border border-white/10 active:scale-95"
                                    title="Click to copy UID"
                                >
                                    <span>{applicantProfile.applicant_uid}</span>
                                    {copiedUid ? <FiCheck size={11} className="text-emerald-300" /> : <FiCopy size={11} />}
                                </button>
                            </div>
                        )}

                        {/* Target Vacancy Pill */}
                        <div className="mt-2.5 pt-2 border-t border-white/10">
                            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-blue-300/70 mb-1">
                                <span className="flex items-center gap-1">
                                    <FiBookmark size={10} className="text-amber-400" /> Target Vacancy
                                </span>
                                {applicantProfile?.target_vacancy_id && (
                                    <span className="text-[8px] font-mono text-emerald-300 bg-emerald-500/20 px-1 rounded">
                                        {applicantProfile.target_vacancy_id}
                                    </span>
                                )}
                            </div>
                            <p className="text-[10px] font-bold text-white uppercase tracking-tight truncate">
                                {applicantProfile?.target_position_title || (
                                    <span className="text-blue-300/60 italic lowercase">No target selected yet</span>
                                )}
                            </p>
                        </div>

                        {/* Quick Edit Button */}
                        <button
                            onClick={onOpenEditModal}
                            className="w-full mt-3 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border border-white/15 active:scale-95"
                        >
                            <FiEdit3 size={12} className="text-sky-300" />
                            <span>Edit Applicant Data</span>
                        </button>
                    </div>
                </div>

                {/* Navigation Menu */}
                <nav className={`flex flex-col gap-3 flex-1 ${sidebarCollapsed ? 'lg:px-4' : 'px-4'}`}>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isItemActive(item);
                        return (
                            <button
                                key={item.id}
                                onClick={() => {
                                    if (setActiveTab) setActiveTab(item.id);
                                    if (item.path) navigate(item.path);
                                    if (setIsMobileOpen) setIsMobileOpen(false);
                                }}
                                title={item.label}
                                className={`relative flex items-center gap-4 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                                    sidebarCollapsed ? 'lg:justify-center lg:px-0 px-5' : 'px-5'
                                } ${active ? 'bg-white text-[#08315F] shadow-lg' : 'text-blue-200 hover:bg-white/10 hover:text-white'}`}
                            >
                                <Icon size={18} className="shrink-0" />
                                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${
                                    sidebarCollapsed ? 'lg:w-0 lg:opacity-0' : 'w-auto opacity-100'
                                }`}>
                                    {item.label}
                                </span>
                                {item.badge && !sidebarCollapsed && (
                                    <span className={`ml-auto px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 ${
                                        active ? 'bg-[#08315F] text-white' : 'bg-white/15 text-blue-200'
                                    }`}>
                                        {item.badge}
                                    </span>
                                )}
                                {item.badge && sidebarCollapsed && (
                                    <span className="hidden lg:block absolute top-3 right-3 w-2 h-2 rounded-full bg-sky-400" />
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* Footer Section */}
                <div className={`border-t border-blue-800/50 mt-auto flex flex-col gap-4 ${sidebarCollapsed ? 'lg:p-4' : 'p-6'}`}>
                    <button
                        onClick={handleSignOut}
                        title="Sign Out"
                        className={`flex items-center gap-4 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                            sidebarCollapsed ? 'lg:justify-center lg:px-0 px-5' : 'px-5'
                        } text-rose-200 hover:bg-white/10 hover:text-rose-400`}
                    >
                        <FiLogOut size={18} className="shrink-0" />
                        <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${
                            sidebarCollapsed ? 'lg:w-0 lg:opacity-0' : 'w-auto opacity-100'
                        }`}>
                            Sign Out
                        </span>
                    </button>
                    <div className={`overflow-hidden transition-all duration-300 ${
                        sidebarCollapsed ? 'lg:h-0 lg:opacity-0' : 'h-6 opacity-100'
                    }`}>
                        <p className="text-[9px] font-black text-blue-400/50 uppercase tracking-[0.2em] text-center whitespace-nowrap">
                            Department of Education
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
};

export default VacancySidebar;

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiLogIn, FiUserPlus, FiShield, FiBookOpen, FiExternalLink, FiLock } from 'react-icons/fi';
import Swal from 'sweetalert2';
import PageTransition from '../components/PageTransition';
import './NexusGate.css';
import modernLogo from '../assets/modern_logo.png';
import depedLogo from '../assets/DepED-Logo.png';

const NexusGate = () => {
    const navigate = useNavigate();

    // Recruitment portal modal (existing)
    const [showRecruitModal, setShowRecruitModal] = useState(false);

    // Central Office auth gate modal
    const [showCOGate, setShowCOGate] = useState(false);

    // Records Management User Guide modal
    const [showGuideModal, setShowGuideModal] = useState(false);

    // Track clicked card for animation
    const [clickedCard, setClickedCard] = useState(null);

    // Layout Swap State
    const [isSwapped, setIsSwapped] = useState(false);

    const handleLockedVacanciesClick = (e) => {
        e.stopPropagation();
        Swal.fire({
            title: 'Vacancies Portal Locked',
            text: 'The Vacancies module is currently locked and unavailable for public applications. Access is restricted to active hiring cycles.',
            icon: 'warning',
            confirmButtonText: 'Understood',
            confirmButtonColor: '#06345F',
            customClass: {
                popup: 'rounded-3xl border-2 border-[#06345F]'
            }
        });
    };

    const itemLeft = {
        hidden: { opacity: 0, x: -60 },
        visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: "easeOut" } },
        exit: { opacity: 0, x: -60, transition: { duration: 0.3, ease: "easeIn" } }
    };

    const itemRight = {
        hidden: { opacity: 0, x: 60 },
        visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: "easeOut" } },
        exit: { opacity: 0, x: 60, transition: { duration: 0.3, ease: "easeIn" } }
    };

    const closeCOGate = () => {
        setShowCOGate(false);
    };

    const handlePortalClick = (portalId) => {
        setClickedCard(portalId);
        // After animation starts, automatically redirect to login page
        setTimeout(() => {
            if (portalId === 'admin') {
                navigate('/login', { state: { redirectTo: '/home', isCO: true } });
            } else if (portalId === 'records') {
                navigate('/login', { state: { redirectTo: '/official-profiling', isCO: false } });
            } else {
                navigate('/login');
            }
        }, 500); // 500ms delay matches the transition duration smoothly
    };

    const portals = [
        {
            id: 'records',
            icon: (
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="M8 7V5.8C8 4.8 8.8 4 9.8 4h4.4c1 0 1.8.8 1.8 1.8V7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                    <path d="M5.8 7h12.4c1 0 1.8.8 1.8 1.8v9.4c0 1-.8 1.8-1.8 1.8H5.8c-1 0-1.8-.8-1.8-1.8V8.8C4 7.8 4.8 7 5.8 7Z" stroke="currentColor" strokeWidth="1.9" />
                    <path d="M9 7v13M15 7v13" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                </svg>
            ),

            roleLabel: 'For Third Level Personnel',
            title: 'Third Level Portal',
            desc: 'Access and update your professional and personnel information, upload supporting documents, and review your official Third Level profile records. The portal supports leadership profiling, talent management, succession planning, and other human resource management initiatives of the Department.',
            action: 'Continue',
            className: ''
        },
        {
            id: 'admin',
            icon: (
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 3.8 18.5 6v5.1c0 4.1-2.6 7.8-6.5 9.1-3.9-1.3-6.5-5-6.5-9.1V6L12 3.8Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
                    <path d="M9.2 12.1 11.1 14l3.8-4.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            ),
            tag: 'Administrative Portal',
            roleLabel: 'For Administrators',
            title: 'Records Management',
            desc: 'Access tools for managing the TLO masterlist, monitoring submissions and performing authorized actions.',
            action: 'Continue',
            className: 'admin'
        }
    ];

    const textVariants = {
        hidden: { opacity: 0, x: -40 },
        visible: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: 40 }
    };

    return (
        <PageTransition>
            <div className={`nexus-gate-wrapper ${isSwapped ? 'swapped' : ''}`}>
                <div className="app-container">
                    <main className="preview">
                        <div className="preview-bg" aria-hidden="true"></div>
                        <div className="bg-orb orb-a" aria-hidden="true"></div>
                        <div className="bg-orb orb-b" aria-hidden="true"></div>
                        <div className="bg-orb orb-c" aria-hidden="true"></div>

                        <AnimatePresence mode="wait">
                            {!isSwapped ? (
                                <motion.section key="normal" className="landing-stage" exit="exit">
                                    <motion.section
                                        className="hero"
                                        aria-labelledby="page-title"
                                        onClick={() => setIsSwapped(true)}
                                        style={{ cursor: 'pointer' }}
                                        initial="hidden" animate="visible" exit="exit"
                                        variants={{ visible: { transition: { staggerChildren: 0.15 } }, exit: { transition: { staggerChildren: 0.05 } } }}
                                    >
                                        <motion.div variants={itemLeft} className="flex gap-4 mb-2 overflow-visible relative z-30" aria-label="Logos">
                                            <div
                                                className="deped-logo-wrapper relative group cursor-pointer"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handlePortalClick('admin');
                                                }}
                                                title="Access Records Management (Admin Access)"
                                            >
                                                <div className="logo transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg group-hover:border-amber-400/60">
                                                    <img src={depedLogo} alt="DepEd Logo" className="w-full h-full object-contain p-1" />
                                                </div>

                                                {/* Floating Tooltip / Popover Badge on Hover */}
                                                <div className="admin-hover-tooltip">
                                                    <div className="admin-pill-icon" aria-hidden="true">
                                                        <FiShield size={13} />
                                                    </div>
                                                    <span className="admin-pill-text">Records Management</span>
                                                    <span className="admin-pill-badge">Admin Access</span>
                                                    <span className="admin-pill-arrow" aria-hidden="true">→</span>
                                                </div>
                                            </div>
                                            <div className="logo">
                                                <img src={modernLogo} alt="InsightED Logo" className="w-full h-full object-contain p-1" />
                                            </div>
                                        </motion.div>
                                        <motion.h1 variants={itemLeft} id="page-title">
                                            Welcome to<br />
                                            <span>Insight<span className="ed-red">ED</span> Nexus</span>
                                        </motion.h1>
                                        <motion.p variants={itemLeft}>
                                            Select the portal that corresponds to your role to access the appropriate services and information.
                                        </motion.p>
                                    </motion.section>

                                    <motion.section
                                        className="portal-grid"
                                        aria-label="Available portals"
                                        initial="hidden" animate="visible" exit="exit"
                                        variants={{ visible: { transition: { staggerChildren: 0.15, delayChildren: 0.2 } }, exit: { transition: { staggerChildren: 0.05 } } }}
                                    >
                                        {/* Main Records Management Card */}
                                        <motion.button
                                            key="records"
                                            variants={itemRight}
                                            onClick={(e) => { e.stopPropagation(); handlePortalClick('records'); }}
                                            className="portal-card"
                                            style={{ textAlign: 'left' }}
                                            whileTap={{ scale: 0.96 }}
                                        >
                                            <motion.div
                                                variants={textVariants}
                                                initial="hidden"
                                                animate={clickedCard === 'records' ? "exit" : "visible"}
                                                transition={{ duration: 0.4, ease: "easeOut" }}
                                                className="flex flex-col h-full"
                                            >
                                                <div className="card-top">
                                                    <div className="portal-icon" aria-hidden="true">
                                                        <svg viewBox="0 0 24 24" fill="none">
                                                            <path d="M8 7V5.8C8 4.8 8.8 4 9.8 4h4.4c1 0 1.8.8 1.8 1.8V7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                                                            <path d="M5.8 7h12.4c1 0 1.8.8 1.8 1.8v9.4c0 1-.8 1.8-1.8 1.8H5.8c-1 0-1.8-.8-1.8-1.8V8.8C4 7.8 4.8 7 5.8 7Z" stroke="currentColor" strokeWidth="1.9" />
                                                            <path d="M9 7v13M15 7v13" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                                                        </svg>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowGuideModal(true);
                                                        }}
                                                        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#06345F] text-white hover:bg-[#0A6FA6] border border-blue-400/30 text-[11px] font-black uppercase tracking-wider transition-all shadow-md group shrink-0 relative z-20 active:scale-95"
                                                        title="Records Management User Guide"
                                                    >
                                                        <FiBookOpen size={14} className="text-amber-400 group-hover:scale-110 transition-transform" />
                                                        <span>User Guide</span>
                                                    </button>
                                                </div>
                                                <h2>Third Level Portal</h2>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 opacity-80">For Third Level Personnel</p>
                                                <p>Access and update your professional and personnel information, upload supporting documents, and review your official Third Level profile records. The portal supports leadership profiling, talent management, succession planning, and other human resource management initiatives of the Department.</p>
                                                <div className="portal-link" aria-label="Enter Third Level Portal">
                                                    Continue <span aria-hidden="true">→</span>
                                                </div>
                                            </motion.div>
                                        </motion.button>

                                        {/* Vacancies Card (Locked) */}
                                        <motion.button
                                            key="vacancies"
                                            variants={itemRight}
                                            onClick={handleLockedVacanciesClick}
                                            className="portal-card locked"
                                            style={{ textAlign: 'left' }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            <motion.div
                                                variants={textVariants}
                                                initial="hidden"
                                                animate="visible"
                                                transition={{ duration: 0.4, ease: "easeOut" }}
                                                className="flex flex-col h-full"
                                            >
                                                <div className="card-top">
                                                    <div className="portal-icon bg-slate-700 text-slate-200" aria-hidden="true">
                                                        <svg viewBox="0 0 24 24" fill="none">
                                                            <rect x="3" y="6" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.9" />
                                                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.9" />
                                                            <circle cx="12" cy="13" r="1.5" fill="currentColor" />
                                                        </svg>
                                                    </div>
                                                    <p className="card-label !text-slate-500">Recruitment</p>
                                                    <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/90 text-amber-300 border border-amber-400/30 text-[11px] font-black uppercase tracking-wider shadow-sm group shrink-0 relative z-20">
                                                        <FiLock size={13} className="text-amber-400" />
                                                        <span>Locked</span>
                                                    </div>
                                                </div>
                                                <h2>Vacancies</h2>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 opacity-80">Open Positions & Opportunities</p>
                                                <p>Explore official Third Level executive position vacancies, qualification standards, application requirements, and recruitment announcements across the Department.</p>
                                                <div className="portal-link !text-slate-500 group-hover:!text-rose-600 transition-colors" aria-label="Vacancies Portal Locked">
                                                    <span>Restricted Access</span> <FiLock size={12} className="inline ml-1 text-slate-400" />
                                                </div>
                                            </motion.div>
                                        </motion.button>
                                    </motion.section>
                                    <p className="footer-note">
                                        Use your <strong>official credentials</strong>. Contact your administrator if your portal access is unavailable.
                                    </p>
                                </motion.section>
                            ) : (
                                <motion.section key="swapped" className="landing-stage swapped" exit="exit">
                                    <motion.section
                                        className="portal-grid"
                                        aria-label="Available portals"
                                        initial="hidden" animate="visible" exit="exit"
                                        variants={{ visible: { transition: { staggerChildren: 0.15 } }, exit: { transition: { staggerChildren: 0.05 } } }}
                                    >
                                        {/* Main Records Management Card */}
                                        <motion.button
                                            key="records"
                                            variants={itemLeft}
                                            onClick={(e) => { e.stopPropagation(); handlePortalClick('records'); }}
                                            className="portal-card"
                                            style={{ textAlign: 'left' }}
                                            whileTap={{ scale: 0.96 }}
                                        >
                                            <motion.div
                                                variants={textVariants}
                                                initial="hidden"
                                                animate={clickedCard === 'records' ? "exit" : "visible"}
                                                transition={{ duration: 0.4, ease: "easeOut" }}
                                                className="flex flex-col h-full"
                                            >
                                                <div className="card-top">
                                                    <div className="portal-icon" aria-hidden="true">
                                                        <svg viewBox="0 0 24 24" fill="none">
                                                            <path d="M8 7V5.8C8 4.8 8.8 4 9.8 4h4.4c1 0 1.8.8 1.8 1.8V7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                                                            <path d="M5.8 7h12.4c1 0 1.8.8 1.8 1.8v9.4c0 1-.8 1.8-1.8 1.8H5.8c-1 0-1.8-.8-1.8-1.8V8.8C4 7.8 4.8 7 5.8 7Z" stroke="currentColor" strokeWidth="1.9" />
                                                            <path d="M9 7v13M15 7v13" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                                                        </svg>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowGuideModal(true);
                                                        }}
                                                        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#06345F] text-white hover:bg-[#0A6FA6] border border-blue-400/30 text-[11px] font-black uppercase tracking-wider transition-all shadow-md group shrink-0 relative z-20 active:scale-95"
                                                        title="Records Management User Guide"
                                                    >
                                                        <FiBookOpen size={14} className="text-amber-400 group-hover:scale-110 transition-transform" />
                                                        <span>User Guide</span>
                                                    </button>
                                                </div>
                                                <h2>Third Level Portal</h2>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 opacity-80">For Third Level Personnel</p>
                                                <p>Access and update your professional and personnel information, upload supporting documents, and review your official Third Level profile records. The portal supports leadership profiling, talent management, succession planning, and other human resource management initiatives of the Department.</p>
                                                <div className="portal-link" aria-label="Enter Third Level Portal">
                                                    Continue <span aria-hidden="true">→</span>
                                                </div>
                                            </motion.div>
                                        </motion.button>

                                        {/* Vacancies Card (Locked) */}
                                        <motion.button
                                            key="vacancies"
                                            variants={itemLeft}
                                            onClick={handleLockedVacanciesClick}
                                            className="portal-card locked"
                                            style={{ textAlign: 'left' }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            <motion.div
                                                variants={textVariants}
                                                initial="hidden"
                                                animate="visible"
                                                transition={{ duration: 0.4, ease: "easeOut" }}
                                                className="flex flex-col h-full"
                                            >
                                                <div className="card-top">
                                                    <div className="portal-icon bg-slate-700 text-slate-200" aria-hidden="true">
                                                        <svg viewBox="0 0 24 24" fill="none">
                                                            <rect x="3" y="6" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.9" />
                                                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.9" />
                                                            <circle cx="12" cy="13" r="1.5" fill="currentColor" />
                                                        </svg>
                                                    </div>
                                                    <p className="card-label !text-slate-500">Recruitment</p>
                                                    <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/90 text-amber-300 border border-amber-400/30 text-[11px] font-black uppercase tracking-wider shadow-sm group shrink-0 relative z-20">
                                                        <FiLock size={13} className="text-amber-400" />
                                                        <span>Locked</span>
                                                    </div>
                                                </div>
                                                <h2>Vacancies</h2>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 opacity-80">Open Positions & Opportunities</p>
                                                <p>Explore official Third Level executive position vacancies, qualification standards, application requirements, and recruitment announcements across the Department.</p>
                                                <div className="portal-link !text-slate-500 group-hover:!text-rose-600 transition-colors" aria-label="Vacancies Portal Locked">
                                                    <span>Restricted Access</span> <FiLock size={12} className="inline ml-1 text-slate-400" />
                                                </div>
                                            </motion.div>
                                        </motion.button>
                                    </motion.section>

                                    <motion.section
                                        className="hero"
                                        aria-labelledby="page-title"
                                        onClick={() => setIsSwapped(false)}
                                        style={{ cursor: 'pointer' }}
                                        initial="hidden" animate="visible" exit="exit"
                                        variants={{ visible: { transition: { staggerChildren: 0.15, delayChildren: 0.2 } }, exit: { transition: { staggerChildren: 0.05 } } }}
                                    >
                                        <motion.div variants={itemRight} className="flex gap-4 mb-2 overflow-visible relative z-30" aria-label="Logos">
                                            <div
                                                className="deped-logo-wrapper relative group cursor-pointer"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handlePortalClick('admin');
                                                }}
                                                title="Access Records Management (Admin Access)"
                                            >
                                                <div className="logo transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg group-hover:border-amber-400/60">
                                                    <img src={depedLogo} alt="DepEd Logo" className="w-full h-full object-contain p-1" />
                                                </div>

                                                {/* Floating Tooltip / Popover Badge on Hover */}
                                                <div className="admin-hover-tooltip">
                                                    <div className="admin-pill-icon" aria-hidden="true">
                                                        <FiShield size={13} />
                                                    </div>
                                                    <span className="admin-pill-text">Records Management</span>
                                                    <span className="admin-pill-badge">Admin Access</span>
                                                    <span className="admin-pill-arrow" aria-hidden="true">→</span>
                                                </div>
                                            </div>
                                            <div className="logo">
                                                <img src={modernLogo} alt="InsightED Logo" className="w-full h-full object-contain p-1" />
                                            </div>
                                        </motion.div>
                                        <motion.h1 variants={itemRight} id="page-title">
                                            Welcome to<br />
                                            <span>Insight<span className="ed-red">ED</span> Nexus</span>
                                        </motion.h1>
                                        <motion.p variants={itemRight}>
                                            Select the portal that corresponds to your role to access the appropriate services and information.
                                        </motion.p>
                                    </motion.section>
                                    <p className="footer-note">
                                        Use your <strong>official credentials</strong>. Contact your administrator if your portal access is unavailable.
                                    </p>
                                </motion.section>
                            )}
                        </AnimatePresence>
                    </main>
                </div>

                {/* ── RECRUITMENT MODAL ── */}
                <AnimatePresence>
                    {showRecruitModal && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRecruitModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
                            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-lg bg-white rounded-[22px] shadow-none border-2 border-[#08315F] overflow-hidden">
                                <div className="p-10">
                                    <div className="flex justify-between items-start mb-8">
                                        <div className="space-y-1">
                                            <h2 className="text-3xl font-['Plus_Jakarta_Sans'] font-black text-[#08315F] tracking-tight italic uppercase">Application Access</h2>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Verify your InsightED account status</p>
                                        </div>
                                        <button onClick={() => setShowRecruitModal(false)} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                                            <FiX size={24} className="text-slate-400" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <button onClick={() => navigate('/login')} className="group p-6 bg-blue-50 hover:bg-blue-600 rounded-3xl border border-blue-100 transition-all duration-300 text-left">
                                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform shadow-sm"><FiLogIn size={24} /></div>
                                            <h3 className="font-black text-blue-900 group-hover:text-white uppercase tracking-tight italic">I have an account</h3>
                                            <p className="text-[10px] font-bold text-blue-600 group-hover:text-blue-100 uppercase tracking-wide mt-1">Sign in to continue</p>
                                        </button>
                                        <button onClick={() => navigate('/register')} className="group p-6 bg-slate-50 hover:bg-[#075985] rounded-3xl border border-slate-200 transition-all duration-300 text-left">
                                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-600 mb-4 group-hover:scale-110 transition-transform shadow-sm"><FiUserPlus size={24} /></div>
                                            <h3 className="font-black text-slate-900 group-hover:text-white uppercase tracking-tight italic">Portal Registration</h3>
                                            <p className="text-[10px] font-bold text-slate-500 group-hover:text-blue-100 uppercase tracking-wide mt-1">Personnel & Applicants</p>
                                        </button>
                                    </div>
                                    <div className="mt-8 pt-8 border-t border-slate-100">
                                        <h4 className="text-[10px] font-black text-[#075985] uppercase tracking-widest mb-4 text-center">Mandatory Workflow</h4>
                                        <div className="flex justify-between items-center px-4">
                                            {[['1', 'Identity Verified'], ['2', '100% Profiling'], ['3', 'Submit Application']].map(([n, lbl], i) => (
                                                <React.Fragment key={n}>
                                                    <div className="flex flex-col items-center gap-1">
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold italic ${i === 0 ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'}`}>{n}</div>
                                                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter text-center">{lbl.split(' ').join('\n')}</span>
                                                    </div>
                                                    {i < 2 && <div className="h-[1px] flex-1 bg-slate-200 mb-4 mx-2"></div>}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider text-center mt-6 leading-relaxed">
                                            Per existing policy, candidates must complete 100% of their professional profile before being permitted to apply for vacant positions.
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* ── CENTRAL OFFICE AUTH GATE ── */}
                <AnimatePresence>
                    {showCOGate && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeCOGate} className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" />
                            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-md bg-white rounded-[22px] shadow-none border-2 border-[#08315F] overflow-hidden">
                                {/* Header bar */}
                                <div className="bg-[#08315F] px-10 py-8 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                                            <FiShield size={22} className="text-white" />
                                        </div>
                                        <div>
                                            <p className="text-white font-black text-sm uppercase tracking-widest leading-none">Third Level</p>
                                            <p className="text-blue-200 text-[9px] font-bold uppercase tracking-widest mt-1">Administrative Portal</p>
                                        </div>
                                    </div>
                                    <button onClick={closeCOGate} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                                        <FiX size={20} className="text-white/70" />
                                    </button>
                                </div>

                                <div className="p-10">
                                    <AnimatePresence mode="wait">
                                        {/* Access Options */}
                                        <motion.div key="access-step" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                                            <div>
                                                <h2 className="text-2xl font-['Plus_Jakarta_Sans'] font-black text-[#08315F] tracking-tight italic uppercase">How would you like to proceed?</h2>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Sign in to your existing account or register a new one</p>
                                            </div>

                                            <div className="grid grid-cols-1 gap-4">
                                                <button
                                                    onClick={() => navigate('/login', { state: { isCO: true } })}
                                                    className="group p-6 bg-blue-50 hover:bg-[#08315F] rounded-3xl border border-blue-100 transition-all duration-300 text-left flex items-center gap-4"
                                                >
                                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#08315F] shrink-0 group-hover:scale-110 transition-transform shadow-sm">
                                                        <FiLogIn size={22} />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-slate-900 group-hover:text-white uppercase tracking-tight italic">Sign In</h3>
                                                        <p className="text-[10px] font-bold text-slate-500 group-hover:text-blue-100 uppercase tracking-wide mt-0.5">I already have an account</p>
                                                    </div>
                                                </button>

                                                <button
                                                    onClick={() => navigate('/register', { state: { isCO: true } })}
                                                    className="group p-6 bg-slate-50 hover:bg-[#08315F] rounded-3xl border border-slate-200 transition-all duration-300 text-left flex items-center gap-4"
                                                >
                                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-600 shrink-0 group-hover:scale-110 transition-transform shadow-sm">
                                                        <FiUserPlus size={22} />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-slate-900 group-hover:text-white uppercase tracking-tight italic">Register New Account</h3>
                                                        <p className="text-[10px] font-bold text-slate-500 group-hover:text-blue-100 uppercase tracking-wide mt-0.5">Create a Central Office account</p>
                                                    </div>
                                                </button>
                                            </div>
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* ── RECORDS MANAGEMENT USER GUIDE MODAL ── */}
                <AnimatePresence>
                    {showGuideModal && (
                        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 lg:p-8">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowGuideModal(false)}
                                className="absolute inset-0 bg-slate-900/70 backdrop-blur-md"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="relative w-full max-w-6xl h-[88vh] bg-white rounded-3xl shadow-2xl border border-white/40 flex flex-col overflow-hidden z-10"
                            >
                                {/* Modal Header */}
                                <div className="px-6 py-4 bg-[#06345F] text-white flex items-center justify-between shrink-0 shadow-md">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-amber-400">
                                            <FiBookOpen size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black uppercase tracking-wide text-white">Records Management User Guide</h3>
                                            <p className="text-[10px] text-blue-200 font-medium">Department of Education · Personnel Division</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <a
                                            href={`${import.meta.env.BASE_URL}guide-template.html`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
                                        >
                                            <FiExternalLink size={14} />
                                            <span>Open Full Tab</span>
                                        </a>
                                        <button
                                            onClick={() => setShowGuideModal(false)}
                                            className="w-8 h-8 rounded-full bg-white/10 hover:bg-rose-600 text-white flex items-center justify-center transition-colors"
                                        >
                                            <FiX size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* Modal Body with Iframe */}
                                <div className="flex-1 w-full h-full bg-slate-100 relative">
                                    <iframe
                                        src={`${import.meta.env.BASE_URL}guide-template.html`}
                                        title="Records Management User Guide"
                                        className="w-full h-full border-0"
                                    />
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </PageTransition>
    );
};

export default NexusGate;


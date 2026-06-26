import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiLogIn, FiUserPlus, FiShield } from 'react-icons/fi';
import PageTransition from '../components/PageTransition';
import './NexusGate.css';

const NexusGate = () => {
    const navigate = useNavigate();

    // Recruitment portal modal (existing)
    const [showRecruitModal, setShowRecruitModal] = useState(false);

    // Central Office auth gate modal
    const [showCOGate, setShowCOGate] = useState(false);

    // Track clicked card for animation
    const [clickedCard, setClickedCard] = useState(null);

    // Layout Swap State
    const [isSwapped, setIsSwapped] = useState(false);

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
            tag: 'Career Path',
            title: 'Records Management',
            desc: 'Manage official records and professional profiles for 3rd level positions within the department.',
            action: 'Enter portal',
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
            title: 'Third Level Dashboard',
            desc: 'Access tools for managing the TLO masterlist, monitoring submissions, and performing authorized administrative actions.',
            action: 'Administrator access',
            className: 'admin'
        },
        {
            id: 'insights',
            icon: (
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="M5 19V5.8C5 4.8 5.8 4 6.8 4h10.4c1 0 1.8.8 1.8 1.8V19" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                    <path d="M8.5 16v-4.2M12 16V8.5M15.5 16v-6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                    <path d="M4 19h16" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                </svg>
            ),
            tag: 'Insights Portal',
            title: 'Reports & Analytics',
            desc: 'Review summary dashboards, submission trends, and consolidated status reports for leadership monitoring.',
            action: 'View insights',
            className: 'reports'
        },
        {
            id: 'support',
            icon: (
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 4a7 7 0 0 0-7 7v2.4c0 .9.7 1.6 1.6 1.6H8v-5H6.7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 4a7 7 0 0 1 7 7v2.4c0 .9-.7 1.6-1.6 1.6H16v-5h1.3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M16 15c0 2.2-1.5 3.5-4 3.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                </svg>
            ),
            tag: 'Service Desk',
            title: 'Help & Support',
            desc: 'Submit access concerns, request portal assistance, and track support responses for authorized users.',
            action: 'Get support',
            className: 'support'
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
                                        <motion.div variants={itemLeft} className="logo" aria-label="InsightED">IE</motion.div>
                                        <motion.p variants={itemLeft} className="eyebrow">Specialized Portals Gateway</motion.p>
                                        <motion.h1 variants={itemLeft} id="page-title">
                                            Welcome to the<br />
                                            <span>Insight<span className="ed-red">ED</span> Nexus</span>
                                        </motion.h1>
                                        <motion.p variants={itemLeft}>
                                            Choose the portal that matches your role, authorized workflow, and official access level.
                                        </motion.p>
                                    </motion.section>

                                    <motion.section 
                                        className="portal-grid" 
                                        aria-label="Available portals"
                                        initial="hidden" animate="visible" exit="exit"
                                        variants={{ visible: { transition: { staggerChildren: 0.15, delayChildren: 0.2 } }, exit: { transition: { staggerChildren: 0.05 } } }}
                                    >
                                        {portals.map((portal) => (
                                            <motion.button
                                                key={portal.id}
                                                variants={itemRight}
                                                onClick={(e) => { e.stopPropagation(); handlePortalClick(portal.id); }}
                                                className={`portal-card ${portal.className}`}
                                                style={{ textAlign: 'left' }}
                                                whileTap={{ scale: 0.96 }}
                                            >
                                                <motion.div
                                                    variants={textVariants}
                                                    initial="hidden"
                                                    animate={clickedCard === portal.id ? "exit" : "visible"}
                                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                                    className="flex flex-col h-full"
                                                >
                                                    <div className="card-top">
                                                        <div className="portal-icon" aria-hidden="true">
                                                            {portal.icon}
                                                        </div>
                                                        <p className="card-label">{portal.tag}</p>
                                                    </div>
                                                    <h2>{portal.title}</h2>
                                                    <p>{portal.desc}</p>
                                                    <div className="portal-link" aria-label={`Enter ${portal.title} portal`}>
                                                        {portal.action} <span aria-hidden="true">→</span>
                                                    </div>
                                                </motion.div>
                                            </motion.button>
                                        ))}
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
                                        {portals.map((portal) => (
                                            <motion.button
                                                key={portal.id}
                                                variants={itemLeft}
                                                onClick={(e) => { e.stopPropagation(); handlePortalClick(portal.id); }}
                                                className={`portal-card ${portal.className}`}
                                                style={{ textAlign: 'left' }}
                                                whileTap={{ scale: 0.96 }}
                                            >
                                                <motion.div
                                                    variants={textVariants}
                                                    initial="hidden"
                                                    animate={clickedCard === portal.id ? "exit" : "visible"}
                                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                                    className="flex flex-col h-full"
                                                >
                                                    <div className="card-top">
                                                        <div className="portal-icon" aria-hidden="true">
                                                            {portal.icon}
                                                        </div>
                                                        <p className="card-label">{portal.tag}</p>
                                                    </div>
                                                    <h2>{portal.title}</h2>
                                                    <p>{portal.desc}</p>
                                                    <div className="portal-link" aria-label={`Enter ${portal.title} portal`}>
                                                        {portal.action} <span aria-hidden="true">→</span>
                                                    </div>
                                                </motion.div>
                                            </motion.button>
                                        ))}
                                    </motion.section>

                                    <motion.section 
                                        className="hero" 
                                        aria-labelledby="page-title"
                                        onClick={() => setIsSwapped(false)}
                                        style={{ cursor: 'pointer' }}
                                        initial="hidden" animate="visible" exit="exit"
                                        variants={{ visible: { transition: { staggerChildren: 0.15, delayChildren: 0.2 } }, exit: { transition: { staggerChildren: 0.05 } } }}
                                    >
                                        <motion.div variants={itemRight} className="logo" aria-label="InsightED">IE</motion.div>
                                        <motion.p variants={itemRight} className="eyebrow">Specialized Portals Gateway</motion.p>
                                        <motion.h1 variants={itemRight} id="page-title">
                                            Welcome to the<br />
                                            <span>Insight<span className="ed-red">ED</span> Nexus</span>
                                        </motion.h1>
                                        <motion.p variants={itemRight}>
                                            Choose the portal that matches your role, authorized workflow, and official access level.
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
                                            <h2 className="text-3xl font-['Quicksand'] font-black text-[#08315F] tracking-tight italic uppercase">Application Access</h2>
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
                                                <h2 className="text-2xl font-['Quicksand'] font-black text-[#08315F] tracking-tight italic uppercase">How would you like to proceed?</h2>
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
            </div>
        </PageTransition>
    );
};

export default NexusGate;

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiBriefcase, FiArrowRight, FiX, FiLogIn, FiUserPlus, FiShield, FiLock, FiLoader, FiCheckCircle } from 'react-icons/fi';
import logo from '../assets/InsightEd1.png';
import PageTransition from '../components/PageTransition';
import { apiUrl } from '../utils/api';

const NexusGate = () => {
    const navigate = useNavigate();

    // Recruitment portal modal (existing)
    const [showRecruitModal, setShowRecruitModal] = useState(false);

    // Central Office auth gate modal
    const [showCOGate, setShowCOGate] = useState(false);
    const [coCode, setCoCode] = useState('');
    const [coError, setCoError] = useState('');
    const [coLoading, setCoLoading] = useState(false);
    const [coVerified, setCoVerified] = useState(false); // shows login/register after valid code

    const cardVariants = {
        hidden: { opacity: 0, y: 30, scale: 0.9 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 100, damping: 15 } },
        hover: { y: -10, scale: 1.02, transition: { duration: 0.3 } }
    };

    const handleCOVerify = async () => {
        if (!coCode.trim()) return;
        setCoLoading(true);
        setCoError('');
        try {
            const res = await fetch(apiUrl(`/api/auth/check-auth-code?code=${encodeURIComponent(coCode.trim())}`));
            const data = await res.json();
            if (!data.valid) {
                setCoError('Invalid or expired authorization code. Please contact your administrator.');
            } else if (!['Personnel Admin', 'Central Office', 'Regional Office', 'School Division Office'].includes(data.role)) {
                setCoError('This code is not authorized for administrative access.');
            } else {
                setCoVerified(true);
            }
        } catch {
            setCoError('Network error. Please try again.');
        } finally {
            setCoLoading(false);
        }
    };

    const closeCOGate = () => {
        setShowCOGate(false);
        setCoCode('');
        setCoError('');
        setCoLoading(false);
        setCoVerified(false);
    };

    return (
        <PageTransition>
            <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6 relative overflow-hidden font-['Quicksand']">
                {/* Background Accents */}
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#075985]/10 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#FBBF24]/10 rounded-full blur-[100px] pointer-events-none"></div>

                {/* Logo Section */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-12 text-left relative z-10 w-full max-w-xl"
                >
                    <div className="space-y-1">
                        <img src={logo} alt="InsightED Logo" className="h-16 w-auto mb-6" />
                        <h1 className="text-4xl 
                        font-['Quicksand'] font-black text-[#08315F] tracking-tight text-left leading-tight">
                            Welcome to the <br />
                            <span className="text-[#075985] italic uppercase">InsightED Nexus</span>
                        </h1>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2 ml-1">Specialized Portals Gateway</p>
                    </div>
                </motion.div>

                {/* Portals Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl relative z-10 px-4">

                    {/* Recruitment Card */}
                    <motion.div
                        variants={cardVariants}
                        initial="hidden"
                        animate="visible"
                        whileHover="hover"
                        onClick={() => setShowRecruitModal(true)}
                        className="cursor-pointer group relative overflow-hidden rounded-[22px] bg-white p-10 shadow-none border-2 border-[#08315F] flex flex-col justify-between min-h-[400px] transition-all duration-500"
                    >
                        <div className="absolute top-0 right-0 w-48 h-48 bg-[#075985] opacity-10 rounded-full -mr-24 -mt-24 blur-3xl transition-opacity group-hover:opacity-20"></div>
                        <div className="w-20 h-20 rounded-[2rem] bg-[#075985] text-white flex items-center justify-center shadow-xl mb-8 group-hover:scale-110 transition-transform duration-500">
                            <FiBriefcase size={40} />
                        </div>
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <h3 className="text-3xl font-['Quicksand'] font-black text-[#08315F] tracking-tight italic leading-tight uppercase">
                                    <span className="normal-case">Records Management</span>
                                </h3>
                                <p className="text-xs font-black text-[#075985] uppercase tracking-widest">& Career Path</p>
                            </div>
                            <p className="text-slate-500 text-sm font-medium leading-relaxed">
                                Manage official records and professional profiles for 3rd level positions within the department.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 mt-6 text-[#075985] font-black text-xs uppercase tracking-widest group-hover:gap-5 transition-all">
                            <span>Enter Portal</span>
                            <FiArrowRight />
                        </div>
                    </motion.div>

                    {/* Central Office Card */}
                    <motion.div
                        variants={cardVariants}
                        initial="hidden"
                        animate="visible"
                        whileHover="hover"
                        onClick={() => setShowCOGate(true)}
                        className="cursor-pointer group relative overflow-hidden rounded-[22px] bg-white p-10 shadow-none border-2 border-[#08315F] flex flex-col justify-between min-h-[400px] transition-all duration-500"
                    >
                        <div className="absolute top-0 right-0 w-48 h-48 bg-[#FBBF24] opacity-10 rounded-full -mr-24 -mt-24 blur-3xl transition-opacity group-hover:opacity-20"></div>
                        <div className="w-20 h-20 rounded-[2rem] bg-[#FBBF24] text-white flex items-center justify-center shadow-xl mb-8 group-hover:scale-110 transition-transform duration-500">
                            <FiShield size={40} />
                        </div>
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <h3 className="text-3xl font-['Quicksand'] font-black text-[#08315F] tracking-tight italic leading-tight uppercase">
                                    <span className="normal-case">Third Level Dashboard</span>
                                </h3>
                                <p className="text-xs font-black text-[#FBBF24] uppercase tracking-widest">Administrative Portal</p>
                            </div>
                            <p className="text-slate-500 text-sm font-medium leading-relaxed">
                                Users include HRMO or Personnel Division of DepEd Central Office. Access for managing the TLO masterlist and administrative actions.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 mt-6 text-[#FBBF24] font-black text-xs uppercase tracking-widest group-hover:gap-5 transition-all">
                            <span>Administrator Access</span>
                            <FiArrowRight />
                        </div>
                    </motion.div>
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

                                        {/* Step 1 — Auth Code Entry */}
                                        {!coVerified && (
                                            <motion.div key="code-step" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                                                <div>
                                                    <h2 className="text-2xl font-['Quicksand'] font-black text-[#08315F] tracking-tight italic uppercase">Authorization Required</h2>
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Enter your Third Level access code to continue</p>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Authorization Code</label>
                                                    <div className="relative">
                                                        <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                        <input
                                                            type="text"
                                                            value={coCode}
                                                            onChange={e => { setCoCode(e.target.value.toUpperCase()); setCoError(''); }}
                                                            onKeyDown={e => e.key === 'Enter' && handleCOVerify()}
                                                            placeholder="Enter code"
                                                            className="w-full bg-slate-50 border-2 border-slate-100 focus:border-[#0038A8] rounded-2xl py-4 pl-12 pr-4 text-slate-800 font-black tracking-widest outline-none transition-all text-sm uppercase"
                                                        />
                                                    </div>
                                                    {coError && (
                                                        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] font-bold text-red-500 ml-1 mt-1">
                                                            {coError}
                                                        </motion.p>
                                                    )}
                                                </div>

                                                <button
                                                    onClick={handleCOVerify}
                                                    disabled={coLoading || !coCode.trim()}
                                                    className="w-full py-4 bg-[#08315F] text-white font-black text-[10px] uppercase tracking-widest rounded-full shadow-xl shadow-blue-900/20 hover:bg-blue-900 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                                                >
                                                    {coLoading ? <FiLoader className="animate-spin" size={16} /> : <FiShield size={16} />}
                                                    {coLoading ? 'Verifying...' : 'Verify Access'}
                                                </button>
                                            </motion.div>
                                        )}

                                        {/* Step 2 — Access Granted */}
                                        {coVerified && (
                                            <motion.div key="access-step" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                                                <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                                    <FiCheckCircle size={20} className="text-emerald-500 shrink-0" />
                                                    <div>
                                                        <p className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">Access Authorized</p>
                                                        <p className="text-[9px] font-bold text-emerald-500 mt-0.5">Central Office credentials verified.</p>
                                                    </div>
                                                </div>

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
                                                        onClick={() => navigate('/register', { state: { isCO: true, authCode: coCode.trim() } })}
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
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Footer */}
                <div className="mt-16 text-center space-y-4 relative z-10">
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">
                        © 2026 Department of Education • <span className="normal-case">InsightED Nexus</span>
                    </p>
                </div>
            </div>
        </PageTransition>
    );
};

export default NexusGate;

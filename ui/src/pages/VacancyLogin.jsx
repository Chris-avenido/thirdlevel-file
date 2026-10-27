import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    FiMail, FiLock, FiEye, FiEyeOff, FiBriefcase, 
    FiArrowLeft, FiArrowRight, FiCheckCircle, FiShield, 
    FiUserPlus, FiSmartphone, FiX, FiKey 
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import modernLogo from '../assets/modern_logo.png';
import PageTransition from '../components/PageTransition';
import Swal from 'sweetalert2';

const VacancyLogin = () => {
    const navigate = useNavigate();
    const { loginWithCredentials } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passcode, setPasscode] = useState('');
    const [loginMode, setLoginMode] = useState('password'); // 'password' | 'passcode'
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showDialpadModal, setShowDialpadModal] = useState(false);

    // Keyboard support for on-screen dialpad modal
    useEffect(() => {
        if (!showDialpadModal) return;

        const handleKeyDown = (e) => {
            if (/^[0-9]$/.test(e.key)) {
                e.preventDefault();
                setPasscode(prev => (prev.length < 6 ? prev + e.key : prev));
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault();
                setPasscode(prev => prev.slice(0, -1));
            } else if (e.key === 'Escape' || e.key === 'Enter') {
                setShowDialpadModal(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showDialpadModal]);

    const handleLogin = async (e) => {
        e.preventDefault();
        const cleanEmail = email.trim();
        if (!cleanEmail) {
            Swal.fire({
                icon: 'warning',
                title: 'Required Information',
                text: 'Please enter your registered email address.',
                confirmButtonColor: '#08315F'
            });
            return;
        }

        const secret = loginMode === 'password' ? password : passcode;
        if (!secret) {
            Swal.fire({
                icon: 'warning',
                title: 'Required Information',
                text: `Please enter your account ${loginMode === 'password' ? 'password' : '6-digit passcode'}.`,
                confirmButtonColor: '#08315F'
            });
            return;
        }

        if (loginMode === 'passcode' && secret.length !== 6) {
            Swal.fire({
                icon: 'warning',
                title: 'Incomplete Passcode',
                text: 'Please enter a complete 6-digit passcode.',
                confirmButtonColor: '#08315F'
            });
            return;
        }

        setLoading(true);
        try {
            // Pass portal: 'vacancies' to ensure session role is Vacancy Applicant
            const data = await loginWithCredentials(cleanEmail, secret, false, 'vacancies');
            if (data.success) {
                sessionStorage.setItem('active_portal', 'vacancies');
                navigate('/vacancy-dashboard', { replace: true });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Sign In Failed',
                    text: data.error || `Invalid email or ${loginMode === 'password' ? 'password' : 'passcode'}. Please verify your credentials.`,
                    confirmButtonColor: '#08315F'
                });
            }
        } catch (err) {
            console.error('Vacancy login error:', err);
            Swal.fire({
                icon: 'error',
                title: 'Connection Error',
                text: 'Unable to connect to login service. Please try again.',
                confirmButtonColor: '#08315F'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageTransition>
            <div className="min-h-screen bg-gradient-to-br from-[#08315F] via-[#0C4A6E] to-[#0369A1] relative flex items-center justify-center p-4 sm:p-6 font-['Plus_Jakarta_Sans',sans-serif] overflow-hidden">
                
                {/* Decorative Background Glows */}
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-sky-400/15 rounded-full blur-[120px] pointer-events-none"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#FCD116]/10 rounded-full blur-[120px] pointer-events-none"></div>

                {/* Back to Portal Gate Button */}
                <button
                    onClick={() => navigate('/')}
                    className="absolute top-6 left-6 z-20 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider backdrop-blur-md border border-white/20 transition-all active:scale-95 shadow-md"
                >
                    <FiArrowLeft size={16} />
                    <span>Back to Portal Gate</span>
                </button>

                {/* Main Auth Container */}
                <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 bg-white rounded-[32px] shadow-2xl overflow-hidden border border-white/30 my-8">
                    
                    {/* Left Column: Visual Recruitment Branding Panel */}
                    <div className="lg:col-span-5 bg-gradient-to-br from-[#08315F] via-[#0A3D78] to-[#075985] text-white p-8 lg:p-10 flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute -top-16 -right-16 w-48 h-48 bg-sky-400/20 rounded-full blur-2xl pointer-events-none"></div>

                        {/* Top Badge & Logo */}
                        <div className="space-y-6 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-white p-1.5 shadow-md flex items-center justify-center shrink-0">
                                    <img src={modernLogo} alt="Logo" className="w-full h-full object-contain" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FCD116] block">
                                        DepEd InsightED
                                    </span>
                                    <h2 className="text-sm font-black uppercase tracking-tight text-white leading-tight">
                                        Executive Recruitment
                                    </h2>
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-400/30 text-[9px] font-black uppercase tracking-widest text-sky-200">
                                    <FiBriefcase size={11} className="text-sky-300" />
                                    Vacancies & Opportunities
                                </span>
                                <h1 className="text-2xl lg:text-3xl font-black tracking-tight leading-tight uppercase">
                                    Third Level Careers Portal
                                </h1>
                                <p className="text-blue-100/80 text-xs font-medium leading-relaxed">
                                    Dedicated workspace for applicants applying for Third Level executive and managerial vacant positions across the Department of Education.
                                </p>
                            </div>
                        </div>

                        {/* Feature Highlights */}
                        <div className="space-y-3 pt-6 border-t border-white/10 relative z-10 hidden sm:block">
                            <div className="flex items-start gap-2.5 text-xs text-blue-100">
                                <FiCheckCircle size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                                <span>Browse open Director, Assistant Secretary & Superintendent positions</span>
                            </div>
                            <div className="flex items-start gap-2.5 text-xs text-blue-100">
                                <FiCheckCircle size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                                <span>Sign in with Password or secure 6-digit Passcode</span>
                            </div>
                            <div className="flex items-start gap-2.5 text-xs text-blue-100">
                                <FiCheckCircle size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                                <span>Manage personal applicant data stored in vacancy registry</span>
                            </div>
                        </div>

                        {/* Footer watermark */}
                        <div className="pt-6 relative z-10 text-[9px] font-black uppercase tracking-widest text-blue-300/60">
                            Department of Education Philippines
                        </div>
                    </div>

                    {/* Right Column: Sign In Form */}
                    <div className="lg:col-span-7 p-8 sm:p-10 lg:p-12 flex flex-col justify-center bg-white">
                        <div className="max-w-md w-full mx-auto space-y-6">
                            
                            {/* Heading */}
                            <div>
                                <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-[#075985] text-[9px] font-black uppercase tracking-widest">
                                    Sign In Access
                                </span>
                                <h2 className="text-2xl font-black text-[#08315F] uppercase tracking-tight mt-2">
                                    Vacancy Applicant Sign In
                                </h2>
                                <p className="text-xs font-medium text-slate-500 mt-1">
                                    Sign in using your registered email and password or 6-digit passcode.
                                </p>
                            </div>

                            {/* Sign In Form */}
                            <form onSubmit={handleLogin} className="space-y-4">
                                
                                {/* Email Field */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                                        Registered Email Address
                                    </label>
                                    <div className="relative flex items-center">
                                        <FiMail className="absolute left-4 text-slate-400" size={17} />
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            placeholder="deped or personal email (e.g. gmail.com)"
                                            className="w-full pl-11 pr-4 py-3.5 rounded-2xl border-2 border-slate-200 bg-white focus:border-[#08315F] focus:ring-4 focus:ring-[#08315F]/10 outline-none text-xs font-bold text-slate-900 placeholder:text-slate-400 transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Auth Mode Toggle (Password / Passcode) */}
                                <div className="space-y-1.5 pt-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                                        Authentication Method
                                    </label>
                                    <div className="flex bg-slate-100 p-1 rounded-2xl">
                                        <button
                                            type="button"
                                            onClick={() => setLoginMode('password')}
                                            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                                loginMode === 'password'
                                                    ? 'bg-white text-[#08315F] shadow-sm'
                                                    : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                        >
                                            Password
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setLoginMode('passcode')}
                                            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                                loginMode === 'passcode'
                                                    ? 'bg-white text-[#08315F] shadow-sm'
                                                    : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                        >
                                            6-Digit Passcode
                                        </button>
                                    </div>
                                </div>

                                {/* Secret Input (Password or Passcode) */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block ml-1">
                                        {loginMode === 'password' ? 'Account Password' : '6-Digit Security Passcode'}
                                    </label>
                                    <div className="relative flex items-center">
                                        <FiLock className="absolute left-4 text-slate-400" size={17} />
                                        {loginMode === 'password' ? (
                                            <>
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    required
                                                    value={password}
                                                    onChange={e => setPassword(e.target.value)}
                                                    placeholder="Enter your account password"
                                                    autoComplete="current-password"
                                                    className="w-full pl-11 pr-12 py-3.5 rounded-2xl border-2 border-slate-200 bg-white focus:border-[#08315F] focus:ring-4 focus:ring-[#08315F]/10 outline-none text-xs font-bold text-slate-900 placeholder:text-slate-400 transition-all"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-4 text-slate-400 hover:text-slate-600 transition-colors"
                                                >
                                                    {showPassword ? <FiEyeOff size={17} /> : <FiEye size={17} />}
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    required
                                                    value={passcode}
                                                    maxLength={6}
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    autoComplete="off"
                                                    onChange={e => {
                                                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                                                        setPasscode(val);
                                                    }}
                                                    placeholder="•••••• (6-digit passcode)"
                                                    className="w-full pl-11 pr-20 py-3.5 rounded-2xl border-2 border-slate-200 bg-white focus:border-[#08315F] focus:ring-4 focus:ring-[#08315F]/10 outline-none text-xs font-bold text-slate-900 placeholder:text-slate-400 transition-all tracking-wider font-mono"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowDialpadModal(true)}
                                                    className="absolute right-11 text-slate-400 hover:text-[#08315F] transition-colors p-1"
                                                    title="Open On-Screen Keypad"
                                                    aria-label="Open Keypad"
                                                >
                                                    <FiSmartphone size={17} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-4 text-slate-400 hover:text-slate-600 transition-colors p-1"
                                                >
                                                    {showPassword ? <FiEyeOff size={17} /> : <FiEye size={17} />}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 rounded-2xl bg-[#08315F] hover:bg-blue-900 text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-900/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                                >
                                    {loading ? (
                                        <span>Signing In to Workspace...</span>
                                    ) : (
                                        <>
                                            <span>Sign In to Vacancies Portal</span>
                                            <FiArrowRight size={16} />
                                        </>
                                    )}
                                </button>
                            </form>

                            {/* Register Prompt */}
                            <div className="pt-6 border-t border-slate-100 text-center space-y-3">
                                <p className="text-xs font-bold text-slate-500">
                                    Don't have a vacancy applicant account yet?
                                </p>
                                <button
                                    onClick={() => navigate('/register', { state: { portal: 'vacancies', isCO: false } })}
                                    className="w-full py-3.5 px-4 rounded-2xl border-2 border-[#075985]/30 hover:border-[#075985] bg-sky-50/60 hover:bg-sky-50 text-[#075985] text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                >
                                    <FiUserPlus size={16} />
                                    <span>Register as Vacancy Applicant</span>
                                </button>
                            </div>

                        </div>
                    </div>
                </div>

                {/* ── ON-SCREEN PASSCODE DIALPAD MODAL ── */}
                <AnimatePresence>
                    {showDialpadModal && (
                        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl relative border-2 border-[#08315F]"
                            >
                                <div className="text-center mb-6">
                                    <div className="w-12 h-12 bg-blue-50 text-[#08315F] rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                                        <FiKey size={22} />
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase italic">
                                        Enter 6-Digit Passcode
                                    </h2>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                        Vacancy Applicant Keypad
                                    </p>
                                    
                                    {/* 6 Dots Indicator */}
                                    <div className="flex justify-center gap-3 mb-6 mt-5">
                                        {[...Array(6)].map((_, i) => (
                                            <div
                                                key={i}
                                                className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                                                    passcode.length > i
                                                        ? 'bg-[#08315F] border-blue-600 scale-110'
                                                        : 'bg-slate-200 border-transparent'
                                                }`}
                                            />
                                        ))}
                                    </div>

                                    {/* Numeric Dialpad 1-9, 0, Backspace */}
                                    <div className="grid grid-cols-3 gap-4 w-full max-w-[260px] mx-auto">
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                            <button
                                                key={num}
                                                type="button"
                                                onClick={() => passcode.length < 6 && setPasscode(prev => prev + num)}
                                                className="w-16 h-16 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-blue-50 active:scale-95 text-2xl font-black text-slate-700 shadow-sm border border-slate-200/60 transition-all flex items-center justify-center"
                                            >
                                                {num}
                                            </button>
                                        ))}
                                        <div className="col-start-2">
                                            <button
                                                type="button"
                                                onClick={() => passcode.length < 6 && setPasscode(prev => prev + '0')}
                                                className="w-16 h-16 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-blue-50 active:scale-95 text-2xl font-black text-slate-700 shadow-sm border border-slate-200/60 transition-all flex items-center justify-center"
                                            >
                                                0
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setPasscode(prev => prev.slice(0, -1))}
                                            className="w-16 h-16 rounded-2xl hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center text-slate-400 transition-colors"
                                            title="Delete Digit"
                                        >
                                            <FiX className="w-7 h-7" />
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setShowDialpadModal(false)}
                                    className="w-full bg-[#08315F] hover:bg-blue-900 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-900/20 active:scale-95 transition-all uppercase tracking-widest text-xs"
                                >
                                    Done
                                </button>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

            </div>
        </PageTransition>
    );
};

export default VacancyLogin;

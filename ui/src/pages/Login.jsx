import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    FiMail,
    FiLock,
    FiEye,
    FiEyeOff,
    FiArrowRight,
    FiArrowLeft,
    FiAlertCircle,
    FiSmartphone,
    FiKey,
    FiX
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import logo from '../assets/InsightEd1.png';
import PageTransition from '../components/PageTransition';
import LoadingScreen from '../components/LoadingScreen';
import PinLogin from '../components/PinLogin';
import Swal from 'sweetalert2';

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const isCO = location.state?.isCO || false;

    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [focusedInput, setFocusedInput] = useState(null);
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [showForgotPasscodeModal, setShowForgotPasscodeModal] = useState(false);
    const [loginMode, setLoginMode] = useState('password'); // 'password' | 'passcode'
    const [isSchoolHead, setIsSchoolHead] = useState(false); // Standalone is usually for Officials/Applicants
    const [isPortalEnforced, setIsPortalEnforced] = useState(true);
    const [showBackPrompt, setShowBackPrompt] = useState(false);
    const [showDialpadModal, setShowDialpadModal] = useState(false);

    // UI flows
    const [rememberedUser, setRememberedUser] = useState(() => {
        const stored = localStorage.getItem('remembered_user');
        if (stored) {
            try {
                const user = JSON.parse(stored);
                const isCOPortal = location.state?.isCO || false;

                // Check if user role matches the portal constraint
                const roleLower = user.role?.toLowerCase() || '';
                const isAllowed = isCOPortal
                    ? (['personnel admin', 'super user', 'central office', 'regional office', 'school division office'].includes(roleLower))
                    : (roleLower === 'tlo applicant');

                if (isAllowed) return user;

                // If it doesn't match, silently clear it so they see normal login
                localStorage.removeItem('remembered_user');
            } catch (e) {
                localStorage.removeItem('remembered_user');
            }
        }
        return null;
    });
    const [usePassword, setUsePassword] = useState(!localStorage.getItem('remembered_user'));

    // ... hooks already declared above ...

    const { login, loginWithCredentials, verifyPin } = useAuth();

    useEffect(() => {
        // Standalone app defaults
        setIsSchoolHead(false);
        setIsPortalEnforced(true);
    }, []);

    const handleLogin = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);

        try {
            const data = await loginWithCredentials(loginId, password);
            if (data.success) {
                const roleLower = data.user.role?.toLowerCase() || '';
                // Role enforcement
                if (isCO) {
                    if (!['personnel admin', 'super user', 'central office', 'regional office', 'school division office'].includes(roleLower)) {
                        setLoading(false);
                        return Swal.fire('Access Denied', 'This portal is restricted to Administrative Personnel.', 'error');
                    }
                } else {
                    if (roleLower !== 'tlo applicant') {
                        setLoading(false);
                        return Swal.fire('Access Denied', 'This portal is restricted to Third Level Applicants.', 'error');
                    }
                }

                // Store for "PinLogin" feature
                localStorage.setItem('remembered_user', JSON.stringify(data.user));

                // Role-based redirection
                if (['personnel admin', 'super user', 'central office', 'regional office', 'school division office'].includes(roleLower)) {
                    navigate('/home');
                } else {
                    navigate('/official-profiling');
                }
            } else {
                Swal.fire('Login Failed', data.error || 'Invalid credentials', 'error');
            }
        } catch (err) {
            Swal.fire('Error', 'Login failed. Please check your connection.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePinVerify = async (completedPin) => {
        setLoading(true);
        try {
            const data = await verifyPin(loginId, completedPin);
            if (data.success) {
                const roleLower = data.user.role?.toLowerCase() || '';
                // Role enforcement
                if (isCO) {
                    if (!['personnel admin', 'super user', 'central office', 'regional office', 'school division office'].includes(roleLower)) {
                        setLoading(false);
                        return Swal.fire('Access Denied', 'This portal is restricted to Administrative Personnel.', 'error');
                    }
                } else {
                    if (roleLower !== 'tlo applicant') {
                        setLoading(false);
                        return Swal.fire('Access Denied', 'This portal is restricted to Third Level Applicants.', 'error');
                    }
                }

                // Role-based redirection
                if (['personnel admin', 'super user', 'central office', 'regional office', 'school division office'].includes(roleLower)) {
                    navigate('/home');
                } else {
                    navigate('/official-profiling');
                }
            } else {
                Swal.fire('Failed', data.error || 'Invalid passcode', 'error');
            }
        } catch (err) {
            Swal.fire('Error', 'Verification failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (loading && !showDialpadModal) {
        return <LoadingScreen />;
    }

    return (
        <PageTransition>
            <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-transparent">
                {/* DECORATIVE SHAPES */}
                <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-[#075985]/10 rounded-full blur-[100px] animate-blob"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-[#FBBF24]/10 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>
                <div className="absolute top-[40%] left-[20%] w-[300px] h-[300px] bg-[#08315F]/10 rounded-full blur-[80px] animate-blob animation-delay-4000"></div>

                <div className="relative z-10 w-[90%] max-w-md">
                    <div className="bg-white p-8 rounded-[22px] border-2 border-[#08315F] shadow-none transform transition-all hover:scale-[1.01] duration-500 relative">

                        {/* BACK BUTTON */}
                        <button
                            onClick={() => navigate('/')}
                            className="absolute top-6 left-6 p-2 rounded-xl bg-white/50 text-slate-400 hover:text-[#08315F] hover:bg-white transition-all shadow-sm border border-slate-100 group z-20"
                        >
                            <FiArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                        </button>

                        {/* HEADER */}
                        <div className="text-center mb-8">
                            <div className="relative w-24 h-24 mx-auto mb-4 bg-white/50 rounded-2xl shadow-inner flex items-center justify-center p-2">
                                <img src={logo} alt="InsightED Logo" className="w-full h-full object-contain drop-shadow-sm" />
                            </div>
                            <h1 className="text-3xl font-['Quicksand'] font-black text-[#08315F] tracking-tight">InsightED</h1>
                            <p className="text-slate-500 text-sm mt-2 font-medium italic">Recruitment Hub</p>
                        </div>

                        {rememberedUser && !usePassword ? (
                            <PinLogin
                                rememberedUser={rememberedUser}
                                onSwitchAccount={() => {
                                    localStorage.removeItem('remembered_user');
                                    setRememberedUser(null);
                                    setUsePassword(true);
                                }}
                                onUsePassword={() => setUsePassword(true)}
                            />
                        ) : (
                            <form onSubmit={handleLogin} className="space-y-6">
                                <div className="space-y-4">
                                    {/* IDENTIFIER */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Identity</label>
                                        <div className={`relative group transition-all duration-300 ${focusedInput === 'id' ? 'scale-[1.02]' : ''}`}>
                                            <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 ${focusedInput === 'id' ? 'text-[#08315F]' : 'text-slate-400'}`}>
                                                <FiMail className="w-5 h-5" />
                                            </div>
                                            <input
                                                type="text"
                                                value={loginId}
                                                onChange={(e) => setLoginId(e.target.value)}
                                                onFocus={() => setFocusedInput('id')}
                                                onBlur={() => setFocusedInput(null)}
                                                placeholder="Registered Email"
                                                className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-700 font-bold placeholder:text-slate-300 focus:outline-none focus:border-[#08315F] focus:ring-4 focus:ring-[#08315F]/5 transition-all shadow-sm"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* AUTH MODE TOGGLE */}
                                    <div className="flex bg-slate-100 p-1 rounded-2xl">
                                        <button
                                            type="button"
                                            onClick={() => setLoginMode('password')}
                                            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${loginMode === 'password' ? 'bg-white text-[#08315F] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Password
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setLoginMode('passcode')}
                                            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${loginMode === 'passcode' ? 'bg-white text-[#08315F] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Passcode
                                        </button>
                                    </div>

                                    {/* SECRET INPUT */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                            {loginMode === 'password' ? 'Security Password' : '6-Digit Passcode'}
                                        </label>
                                        <div className={`relative group transition-all duration-300 ${focusedInput === 'secret' ? 'scale-[1.02]' : ''}`}>
                                            <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 ${focusedInput === 'secret' ? 'text-[#08315F]' : 'text-slate-400'}`}>
                                                <FiLock className="w-5 h-5" />
                                            </div>
                                            <input
                                                type={showPassword || loginMode === 'passcode' ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                onFocus={() => {
                                                    setFocusedInput('secret');
                                                    if (loginMode === 'passcode') setShowDialpadModal(true);
                                                }}
                                                onBlur={() => setFocusedInput(null)}
                                                placeholder={loginMode === 'password' ? '••••••••' : '0 0 0 0 0 0'}
                                                readOnly={loginMode === 'passcode'}
                                                className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-12 text-slate-700 font-bold placeholder:text-slate-300 focus:outline-none focus:border-[#08315F] focus:ring-4 focus:ring-[#08315F]/5 transition-all shadow-sm"
                                                required
                                            />
                                            {loginMode === 'password' && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#08315F] transition-colors p-1"
                                                >
                                                    {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between px-1">
                                    <button
                                        type="button"
                                        onClick={() => loginMode === 'password' ? setShowForgotModal(true) : setShowForgotPasscodeModal(true)}
                                        className="text-[10px] font-black text-[#08315F] uppercase tracking-widest hover:text-blue-800 transition-colors"
                                    >
                                        Forgot {loginMode}?
                                    </button>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-500/20 transform transition-all active:scale-[0.98] flex items-center justify-center gap-3 group"
                                >
                                    {loading ? 'Authenticating...' : 'Sign In to Portal'}
                                    <FiArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </form>
                        )}

                        {/* FOOTER */}
                        <div className="mt-10 pt-8 border-t border-slate-100 text-center">
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                Don't have an account? <Link to="/register" state={{ isCO }} className="text-[#08315F] hover:text-blue-800 ml-1">Register Now</Link>
                            </p>
                        </div>
                    </div>
                </div>

                {/* MODALS (Dialpad, Forgot etc) */}
                <AnimatePresence>
                    {showDialpadModal && (
                        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl relative border border-white/20"
                            >
                                <div className="text-center mb-6">
                                    <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-2 uppercase italic">Enter Passcode</h2>
                                    <div className="flex justify-center gap-3 mb-8 mt-6">
                                        {[...Array(6)].map((_, i) => (
                                            <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${password.length > i ? 'bg-[#08315F] border-blue-600 scale-110' : 'bg-slate-200 border-transparent'}`} />
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-3 gap-6 w-full max-w-[260px] mx-auto">
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                            <button key={num} type="button" onClick={() => password.length < 6 && setPassword(password + num)} className="w-16 h-16 rounded-full bg-slate-50 hover:bg-slate-200 active:scale-95 text-2xl font-black text-slate-700 shadow-sm transition-all">{num}</button>
                                        ))}
                                        <div className="col-start-2"><button type="button" onClick={() => password.length < 6 && setPassword(password + '0')} className="w-16 h-16 rounded-full bg-slate-50 hover:bg-slate-200 active:scale-95 text-2xl font-black text-slate-700 shadow-sm transition-all">0</button></div>
                                        <button type="button" onClick={() => setPassword(password.slice(0, -1))} className="w-16 h-16 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"><FiX className="w-8 h-8" /></button>
                                    </div>
                                </div>
                                <button onClick={() => setShowDialpadModal(false)} className="w-full bg-[#08315F] text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-500/20 active:scale-95 transition-all uppercase tracking-widest text-xs">Done</button>
                            </motion.div>
                        </div>
                    )}

                    {showForgotModal && (
                        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                                className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl text-center"
                            >
                                <div className="w-20 h-20 bg-blue-50 text-[#08315F] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner"><FiKey className="w-10 h-10" /></div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase italic mb-4">Forgot Password?</h2>
                                <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">Try logging in with your <span className="font-bold text-[#08315F]">6-digit Passcode</span> instead. It's the faster alternative for secure access.</p>
                                <div className="space-y-3">
                                    <button onClick={() => { setLoginMode('passcode'); setShowForgotModal(false); }} className="w-full bg-[#08315F] text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all text-[10px] uppercase tracking-widest">Switch to Passcode</button>
                                    <button onClick={() => setShowForgotModal(false)} className="w-full bg-slate-50 text-slate-400 font-black py-4 rounded-2xl active:scale-95 transition-all text-[10px] uppercase tracking-widest">Cancel</button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </PageTransition>
    );
};

export default Login;

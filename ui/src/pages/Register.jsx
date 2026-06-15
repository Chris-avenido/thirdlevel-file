import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    FiUser,
    FiMail,
    FiLock,
    FiPhone,
    FiCheckCircle,
    FiArrowRight,
    FiArrowLeft,
    FiShield,
    FiSmartphone
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import logo from '../assets/InsightEd1.png';
import PageTransition from '../components/PageTransition';
import LoadingScreen from '../components/LoadingScreen';
import { apiUrl } from '../utils/api';
import Swal from 'sweetalert2';

const Register = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    // Detect if arriving from Central Office auth gate
    const isCO = location.state?.isCO || false;
    const coAuthCode = location.state?.authCode || '';

    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        contactNumber: '',
        password: '',
        confirmPassword: '',
        authCode: isCO ? coAuthCode : '',
        role: isCO ? 'Personnel Admin' : 'TLO Applicant'
    });

    const [otpCode, setOtpCode] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [isOtpVerified, setIsOtpVerified] = useState(false);
    const [otpLoading, setOtpLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    useEffect(() => {
        if (!isCO) {
            setFormData(prev => ({ ...prev, role: 'TLO Applicant' }));
        }
    }, []);

    const handlePhoneChange = (e) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 11);
        setFormData(prev => ({ ...prev, contactNumber: val }));
    };

    const handleSendOtp = async () => {
        if (!formData.email) return Swal.fire('Notice', "Please enter email first", 'info');

        try {
            const checkRes = await fetch(apiUrl(`/api/auth/check-email?email=${formData.email}`));
            const checkData = await checkRes.json();
            if (checkData.exists) {
                return Swal.fire('Notice', "This email is already registered in InsightEd. Please use 'I have an account' to login.", 'info');
            }
        } catch (err) {
            console.error("Check email failed", err);
        }

        setOtpLoading(true);
        try {
            const res = await fetch(apiUrl('/api/auth/send-otp'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email })
            });
            if (res.ok) setOtpSent(true);
            else Swal.fire('Notice', "Failed to send OTP", 'error');
        } catch (err) {
            Swal.fire('Error', "Network error", 'error');
        } finally {
            setOtpLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        setOtpLoading(true);
        console.log(formData.email, otpCode);
        try {
            const res = await fetch(apiUrl('/api/auth/verify-otp'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email, code: otpCode })
            });
            if (res.ok) {
                setIsOtpVerified(true);
                setOtpSent(false);
            } else {
                Swal.fire('Error', "Invalid OTP codedfdsfdfdf", 'error');
            }
        } catch (err) {
            Swal.fire('Error', "Verification error", 'error');
        } finally {
            setOtpLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (formData.password !== formData.confirmPassword) return Swal.fire('Error', "Passwords do not match", 'error');

        setLoading(true);
        try {
            const res = await fetch(apiUrl('/api/auth/register-user'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password,
                    firstName: formData.first_name,
                    lastName: formData.last_name,
                    contactNumber: formData.contactNumber,
                    authCode: formData.authCode
                })
            });
            const data = await res.json();
            if (data.success) {
                login(data.user, data.token);
                setSuccess(true);

                const redirectPath = (['Personnel Admin', 'Admin', 'Super User', 'Central Office', 'Regional Office', 'School Division Office'].includes(data.user.role))
                    ? '/home'
                    : '/official-profiling';

                setTimeout(() => navigate(redirectPath), 2000);
            } else {
                setError(data.error || "Registration failed");
            }
        } catch (err) {
            setError("Server error");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <LoadingScreen />;

    if (success) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-white p-6">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                    <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-500/10">
                        <FiCheckCircle size={48} />
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-4 italic uppercase">Identity Created</h2>
                    <p className="text-slate-500 font-medium mb-8 leading-relaxed max-w-sm mx-auto">Your recruitment profile has been initialized. Redirecting to your dashboard...</p>
                    <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin mx-auto"></div>
                </motion.div>
            </div>
        );
    }

    return (
        <PageTransition>
            <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-transparent">

                <div className="relative z-10 w-[95%] max-w-xl">
                    <div className="bg-white border-2 border-[#08315F] shadow-none rounded-[22px] p-8 md:p-12">

                        {/* HEADER */}
                        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                            <div>
                                <div className="w-16 h-16 bg-white/50 rounded-2xl shadow-inner flex items-center justify-center p-2 mb-6">
                                    <img src={logo} alt="Logo" className="w-full h-full object-contain" />
                                </div>
                                <h1 className="text-4xl font-['Quicksand'] font-black text-[#08315F] tracking-tight italic leading-none uppercase">
                                    Join <span className="text-[#075985] not-italic">Registry</span>
                                </h1>
                                <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-[#075985] animate-pulse"></span>
                                    Step {currentStep} of 3 • {currentStep === 1 ? 'Identity' : currentStep === 2 ? 'Verify' : 'Security'}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                {[1, 2, 3].map(s => (
                                    <div key={s} className={`h-1.5 w-12 rounded-full transition-all duration-500 ${currentStep >= s ? 'bg-[#08315F] w-16 shadow-[0_0_10px_rgba(37,99,235,0.4)]' : 'bg-slate-200'}`}></div>
                                ))}
                            </div>
                        </div>

                        {/* STEP 1: IDENTITY */}
                        {/* STEP 1: IDENTITY */}
                        {currentStep === 1 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">First Name</label>
                                        <div className="relative group">
                                            <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#075985] transition-colors" />
                                            <input type="text" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} placeholder="Juan" className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-800 font-bold focus:outline-none focus:border-[#08315F] transition-all shadow-sm" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Last Name</label>
                                        <div className="relative group">
                                            <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#075985] transition-colors" />
                                            <input type="text" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} placeholder="Dela Cruz" className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-800 font-bold focus:outline-none focus:border-[#08315F] transition-all shadow-sm" />
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        if (formData.first_name && formData.last_name) {
                                            setCurrentStep(2);
                                        } else {
                                            Swal.fire('Notice', "Please complete all fields.", 'info');
                                        }
                                    }}
                                    className="w-full bg-[#08315F] text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 group uppercase tracking-widest text-xs italic"
                                >
                                    Continue to Contact Info
                                    <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        )}

                        {/* STEP 2: CREDENTIALS */}
                        {currentStep === 2 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                {isCO && (
                                    <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                        <FiShield size={16} className="text-[#08315F] shrink-0" />
                                        <p className="text-[10px] font-black text-[#08315F] uppercase tracking-widest">
                                            Central Office accounts must use an official @deped.gov.ph email.
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                                    <div className="flex gap-3">
                                        <div className="relative group flex-1">
                                            <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input type="email" disabled={isOtpVerified || otpSent} value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="example@gmail.com" className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-800 font-bold focus:outline-none focus:border-[#08315F] disabled:opacity-50" />
                                        </div>
                                        {!otpSent && !isOtpVerified && <button onClick={handleSendOtp} disabled={otpLoading || !formData.email} className="bg-[#08315F] text-white font-black px-6 rounded-2xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg text-[10px] uppercase">{otpLoading ? '...' : 'Send OTP'}</button>}
                                    </div>
                                </div>

                                {/* Phone & Auth Code (Moved here) */}
                                <div className={`grid gap-4 ${isCO ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mobile Number</label>
                                        <div className="relative group">
                                            <FiSmartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#075985] transition-colors" />
                                            <input type="text" value={formData.contactNumber} onChange={handlePhoneChange} placeholder="09XXXXXXXXX" className="w-full bg-white border-2 border-slate-100 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-slate-800 font-bold focus:outline-none focus:border-[#08315F] transition-all shadow-sm" />
                                        </div>
                                    </div>
                                    {/* Auth code is pre-verified for CO users — hide the field */}
                                    {!isCO && (
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Portal Auth Code</label>
                                            <div className="relative group">
                                                <FiShield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#075985] transition-colors" />
                                                <input type="text" value={formData.authCode} onChange={(e) => setFormData({ ...formData, authCode: e.target.value })} placeholder="Code" className="w-full bg-white border-2 border-slate-100 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-slate-800 font-bold focus:outline-none focus:border-[#08315F] transition-all shadow-sm" />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {otpSent && !isOtpVerified && (
                                    <div className="space-y-6 animate-in zoom-in-95 duration-300">
                                        <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100 text-center">
                                            <p className="text-[10px] font-black text-[#075985] uppercase tracking-widest mb-4">Verification Code Sent</p>
                                            <div className="relative group">
                                                <input
                                                    type="text"
                                                    maxLength="6"
                                                    value={otpCode}
                                                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                                    placeholder="000000"
                                                    className="w-full text-center text-4xl font-black tracking-[0.5em] py-4 bg-white border-2 border-blue-200 rounded-2xl focus:border-[#08315F] focus:outline-none shadow-inner text-slate-900"
                                                    style={{ WebkitTextFillColor: '#1e293b' }}
                                                />
                                            </div>
                                            <button
                                                onClick={handleVerifyOtp}
                                                className="mt-6 w-full py-4 bg-[#08315F] text-white font-black rounded-xl hover:bg-blue-700 transition-all shadow-lg text-[10px] uppercase tracking-widest"
                                            >
                                                Verify OTP
                                            </button>
                                        </div>
                                        <button onClick={() => setOtpSent(false)} className="w-full text-slate-400 text-[10px] font-black uppercase hover:text-slate-600">Change Email</button>
                                    </div>
                                )}

                                {isOtpVerified && (
                                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600 text-xs font-bold flex items-center gap-3">
                                        <FiCheckCircle className="w-5 h-5" />
                                        Identity verified. Proceed to security.
                                    </div>
                                )}

                                <div className="flex gap-4 pt-4">
                                    <button onClick={() => setCurrentStep(1)} className="flex-1 bg-slate-100 text-slate-500 font-black py-5 rounded-2xl active:scale-95 transition-all text-xs uppercase italic tracking-widest">Back</button>
                                    <button disabled={!isOtpVerified} onClick={() => setCurrentStep(3)} className="flex-[2] bg-[#08315F] text-white font-black py-5 rounded-2xl shadow-xl disabled:bg-slate-200 active:scale-95 transition-all text-xs uppercase italic tracking-widest">Final Step</button>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: SECURITY */}
                        {currentStep === 3 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                                        <div className="relative group">
                                            <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#075985] transition-colors" />
                                            <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="••••••••" className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-800 font-bold focus:outline-none focus:border-[#08315F] shadow-sm" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm Password</label>
                                        <div className="relative group">
                                            <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#075985] transition-colors" />
                                            <input type="password" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} placeholder="••••••••" className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-800 font-bold focus:outline-none focus:border-[#08315F] shadow-sm" />
                                        </div>
                                    </div>
                                </div>
                                {error && <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold">{error}</div>}
                                <div className="flex gap-4">
                                    <button onClick={() => setCurrentStep(2)} className="flex-1 bg-slate-100 text-slate-500 font-black py-5 rounded-2xl active:scale-95 transition-all text-xs uppercase italic tracking-widest">Back</button>
                                    <button onClick={handleSubmit} disabled={loading} className="flex-[2] bg-[#08315F] text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 text-xs uppercase italic tracking-widest">
                                        Create Identity
                                        <FiCheckCircle className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* FOOTER */}
                        <div className="mt-10 pt-8 border-t border-slate-100 text-center">
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                Already have an account? <Link to="/login" className="text-[#075985] hover:text-blue-800 ml-1">Sign In Instead</Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </PageTransition>
    );
};

export default Register;

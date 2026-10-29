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
import logo from '../assets/tlo_logo.png';
import PageTransition from '../components/PageTransition';
import LoadingScreen from '../components/LoadingScreen';
import { apiUrl } from '../utils/api';
import Swal from 'sweetalert2';

const Register = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    // Detect if arriving from Central Office auth gate or Vacancies recruitment
    const isCO = location.state?.isCO || false;
    const isVacancies = location.state?.portal === 'vacancies' || location.state?.isVacancies || false;
    const coAuthCode = location.state?.authCode || '';

    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        contactNumber: '',
        auth_code: '',
        password: '',
        confirmPassword: '',
        passcode: '',
        role: isCO ? 'Central Office' : (isVacancies ? 'Vacancy Applicant' : 'TLO Applicant')
    });


    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const [masterlistCheckStatus, setMasterlistCheckStatus] = useState('idle'); // 'idle' | 'checking' | 'valid' | 'invalid' | 'invalid_domain' | 'already_registered'

    // OTP email verification state
    const [otpCode, setOtpCode] = useState('');
    const [otpSending, setOtpSending] = useState(false);
    const [otpVerifying, setOtpVerifying] = useState(false);
    const [otpError, setOtpError] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);
    const [verifiedEmail, setVerifiedEmail] = useState(''); // email that passed OTP verification

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [resendCooldown]);

    // Debounced masterlist check for non-CO accounts (bypassed for Vacancies applicants)
    useEffect(() => {
        if (isCO || currentStep !== 2) return;

        const email = formData.email.trim();
        const isValidFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

        if (!email || !isValidFormat) {
            setMasterlistCheckStatus('idle');
            return;
        }

        if (!isVacancies && !email.toLowerCase().endsWith('@deped.gov.ph')) {
            setMasterlistCheckStatus('invalid_domain');
            return;
        }

        const checkMasterlist = async () => {
            setMasterlistCheckStatus('checking');
            try {
                const portalParam = isVacancies ? '&portal=vacancies' : '';
                const res = await fetch(apiUrl(`/api/auth/check-masterlist-email?email=${encodeURIComponent(email)}&isCO=${isCO}${portalParam}`));
                if (res.ok) {
                    const data = await res.json();
                    if (data.alreadyRegistered) {
                        setMasterlistCheckStatus('already_registered');
                    } else if (isVacancies || data.inMasterlist) {
                        setMasterlistCheckStatus('valid');
                    } else {
                        setMasterlistCheckStatus('invalid');
                    }
                } else {
                    setMasterlistCheckStatus('idle');
                }
            } catch (err) {
                console.error("Masterlist check failed", err);
                setMasterlistCheckStatus('idle'); // fail closed (handled in submit/otp as well)
            }
        };

        const timer = setTimeout(checkMasterlist, 500);
        return () => clearTimeout(timer);
    }, [formData.email, isCO, isVacancies, currentStep]);

    useEffect(() => {
        if (!isCO) {
            setFormData(prev => ({ ...prev, role: isVacancies ? 'Vacancy Applicant' : 'TLO Applicant' }));
        }
    }, [isCO, isVacancies]);

    const handlePhoneChange = (e) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 11);
        setFormData(prev => ({ ...prev, contactNumber: val }));
    };


    const normalizedEmail = formData.email.toLowerCase().trim();

    // Sends a 6-digit code to the entered email. Returns true if a valid code is (or was recently) sent.
    const sendOtp = async () => {
        setOtpSending(true);
        setOtpError('');
        try {
            const res = await fetch(apiUrl('/api/auth/send-otp'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: normalizedEmail })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success) {
                setOtpCode('');
                setResendCooldown(60);
                return true;
            }
            if (res.status === 429) {
                // A code was already sent moments ago and is still valid
                setResendCooldown(data.retryAfter || 60);
                return true;
            }
            Swal.fire('Error', data.error || 'Failed to send verification code.', 'error');
            return false;
        } catch (err) {
            Swal.fire('Error', 'Unable to send verification code. Please try again.', 'error');
            return false;
        } finally {
            setOtpSending(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!/^\d{6}$/.test(otpCode)) {
            setOtpError('Please enter the 6-digit code.');
            return;
        }
        setOtpVerifying(true);
        setOtpError('');
        try {
            const res = await fetch(apiUrl('/api/auth/verify-otp'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: normalizedEmail, code: otpCode })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success) {
                setVerifiedEmail(normalizedEmail);
                setCurrentStep(4);
            } else {
                setOtpError(data.error || 'Invalid or expired code');
            }
        } catch (err) {
            setOtpError('Unable to verify code. Please try again.');
        } finally {
            setOtpVerifying(false);
        }
    };

    const handleFinalStep = async () => {
        if (!isVacancies && !formData.email.toLowerCase().endsWith('@deped.gov.ph')) {
            Swal.fire('Notice', 'Only official @deped.gov.ph emails are allowed for registration.', 'warning');
            return;
        }
        if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
            Swal.fire('Notice', 'Please enter a valid email address.', 'warning');
            return;
        }
        if (masterlistCheckStatus === 'already_registered') {
            Swal.fire('Notice', 'This email is already registered for this portal. Please login instead.', 'warning');
            return;
        }
        if (isCO && formData.auth_code !== 'nVxCpLrTqWmK') {
            Swal.fire('Error', 'Invalid Authorization Code. Please ensure you have the correct code to register as an Administrator.', 'error');
            return;
        }
        // Vacancy Applicants skip email OTP verification completely
        if (isVacancies) {
            setCurrentStep(4);
            return;
        }
        // Email already verified and unchanged — skip straight to security step
        if (verifiedEmail && verifiedEmail === normalizedEmail) {
            setCurrentStep(4);
            return;
        }
        const sent = await sendOtp();
        if (sent) setCurrentStep(3);
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
                    role: formData.role,
                    passcode: formData.passcode,
                    otpCode: isVacancies ? undefined : otpCode,
                    isCO,
                    portal: isVacancies ? 'vacancies' : undefined
                })
            });
            const data = await res.json();
            if (data.success) {
                login(data.user, data.token);
                setSuccess(true);

                const redirectPath = (['Personnel Admin', 'Admin', 'Super User', 'Central Office', 'Regional Office', 'School Division Office', 'CO_PD', 'RO_HRMO', 'SDO_HRMO'].includes(data.user.role))
                    ? '/home'
                    : (data.user.role === 'Vacancy Applicant' ? '/vacancy-dashboard' : '/official-profiling');

                setTimeout(() => navigate(redirectPath), 2000);
            } else if (data.code === 'OTP_INVALID' && !isVacancies) {
                // Code expired or was invalidated before submitting — re-verify
                setVerifiedEmail('');
                setOtpCode('');
                setOtpError(`${data.error}. Please request a new code.`.replace('..', '.'));
                setCurrentStep(3);
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
                                <h1 className="text-4xl font-['Plus_Jakarta_Sans'] font-black text-[#08315F] tracking-tight italic leading-none uppercase">
                                    {isVacancies ? 'Vacancy ' : 'Join '}<span className="text-[#075985] not-italic">{isVacancies ? 'Applicant' : 'Registry'}</span>
                                </h1>
                                <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-[#075985] animate-pulse"></span>
                                    Step {isVacancies ? (currentStep === 4 ? 3 : currentStep) : currentStep} of {isVacancies ? 3 : 4} • {currentStep === 1 ? 'Identity' : currentStep === 2 ? 'Contact' : currentStep === 3 ? 'Verify Email' : 'Security'}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                {(isVacancies ? [1, 2, 3] : [1, 2, 3, 4]).map(s => {
                                    const activeStep = isVacancies ? (currentStep === 4 ? 3 : currentStep) : currentStep;
                                    return (
                                        <div key={s} className={`h-1.5 w-8 rounded-full transition-all duration-500 ${activeStep >= s ? 'bg-[#08315F] w-12 shadow-[0_0_10px_rgba(37,99,235,0.4)]' : 'bg-slate-200'}`}></div>
                                    );
                                })}
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
                                            <input type="text" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value.toUpperCase() })} placeholder="Juan" className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-800 font-bold focus:outline-none focus:border-[#08315F] transition-all shadow-sm" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Last Name</label>
                                        <div className="relative group">
                                            <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#075985] transition-colors" />
                                            <input type="text" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value.toUpperCase() })} placeholder="Dela Cruz" className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-800 font-bold focus:outline-none focus:border-[#08315F] transition-all shadow-sm" />
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
                                {isVacancies && (
                                    <div className="flex items-center gap-3 p-4 bg-sky-50 rounded-2xl border border-sky-100">
                                        <FiShield size={16} className="text-[#08315F] shrink-0" />
                                        <p className="text-[10px] font-black text-[#08315F] uppercase tracking-widest">
                                            Vacancies Portal: You may register with your DepEd or personal email address.
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                                    <div className="relative group">
                                        <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input 
                                            type="email" 
                                            value={formData.email} 
                                            onChange={(e) => {
                                                setFormData({ ...formData, email: e.target.value });
                                            }} 
                                            placeholder="example@gmail.com" 
                                            className={`w-full bg-white border-2 rounded-2xl py-4 pl-12 pr-10 text-slate-800 font-bold focus:outline-none transition-all ${
                                                masterlistCheckStatus === 'valid' ? 'border-emerald-500 focus:border-emerald-600' : 
                                                masterlistCheckStatus === 'invalid' ? 'border-red-400 focus:border-red-500' : 
                                                'border-slate-100 focus:border-[#08315F]'
                                            }`} 
                                        />

                                        {!isCO && masterlistCheckStatus === 'valid' && (
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500">
                                                <FiCheckCircle size={18} />
                                            </div>
                                        )}
                                        {!isCO && masterlistCheckStatus === 'checking' && (
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                <div className="w-4 h-4 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
                                            </div>
                                        )}
                                    </div>
                                    {!isCO && !isVacancies && masterlistCheckStatus === 'invalid' && (
                                        <div className="mt-2 p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2">
                                            <FiShield className="text-amber-500 shrink-0 mt-0.5" />
                                            <p className="text-[10px] font-bold text-amber-600 leading-relaxed">
                                                Email not found in Masterlist. You may proceed to register, but your account will be set to "For Approval" and requires Central Office review.
                                            </p>
                                        </div>
                                    )}
                                    {!isVacancies && masterlistCheckStatus === 'invalid_domain' && (
                                        <p className="text-[10px] font-bold text-red-500 mt-1 ml-1">
                                            Only @deped.gov.ph emails are allowed for registration.
                                        </p>
                                    )}
                                    {masterlistCheckStatus === 'already_registered' && (
                                        <p className="text-[10px] font-bold text-red-500 mt-1 ml-1">
                                            This email is already registered. Please sign in instead.
                                        </p>
                                    )}
                                </div>

                                {/* Phone & Auth Code */}
                                <div className={`grid gap-4 ${isCO ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mobile Number</label>
                                        <div className="relative group">
                                            <FiSmartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#075985] transition-colors" />
                                            <input type="text" value={formData.contactNumber} onChange={handlePhoneChange} placeholder="09XXXXXXXXX" className="w-full bg-white border-2 border-slate-100 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-slate-800 font-bold focus:outline-none focus:border-[#08315F] transition-all shadow-sm" />
                                        </div>
                                    </div>
                                    {isCO && (
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Auth Code</label>
                                            <div className="relative group">
                                                <FiShield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#075985] transition-colors" />
                                                <input type="text" value={formData.auth_code} onChange={e => setFormData({...formData, auth_code: e.target.value})} placeholder="Enter Auth Code" className="w-full bg-white border-2 border-slate-100 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-slate-800 font-bold focus:outline-none focus:border-[#08315F] transition-all shadow-sm" />
                                            </div>
                                        </div>
                                    )}
                                </div>



                                <div className="flex gap-4 pt-4">
                                    <button onClick={() => setCurrentStep(1)} className="flex-1 bg-slate-100 text-slate-500 font-black py-5 rounded-2xl active:scale-95 transition-all text-xs uppercase italic tracking-widest">Back</button>
                                    <button onClick={handleFinalStep} disabled={otpSending} className="flex-[2] bg-[#08315F] text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all text-xs uppercase italic tracking-widest disabled:opacity-60 disabled:cursor-not-allowed">
                                        {otpSending ? 'Sending Code...' : (isVacancies ? 'Continue to Security' : 'Verify Email')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: EMAIL OTP VERIFICATION */}
                        {currentStep === 3 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                    <FiMail size={18} className="text-[#08315F] shrink-0 mt-0.5" />
                                    <p className="text-xs font-bold text-[#08315F] leading-relaxed">
                                        We sent a 6-digit verification code to <span className="font-black underline break-all">{normalizedEmail}</span>. Enter it below to confirm that this email belongs to you. The code expires in 10 minutes.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="register-otp-input" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Verification Code</label>
                                    <div className="relative group">
                                        <FiShield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#075985] transition-colors" />
                                        <input
                                            id="register-otp-input"
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                            maxLength={6}
                                            autoFocus
                                            value={otpCode}
                                            onChange={(e) => {
                                                setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                                                setOtpError('');
                                            }}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyOtp(); }}
                                            placeholder="000000"
                                            className={`w-full bg-white border-2 rounded-2xl py-4 pl-12 pr-4 text-xl text-center tracking-[0.5em] text-slate-800 font-black focus:outline-none transition-all shadow-sm ${otpError ? 'border-red-400 focus:border-red-500' : 'border-slate-100 focus:border-[#08315F]'}`}
                                        />
                                    </div>
                                    {otpError && (
                                        <p className="text-[10px] font-bold text-red-500 mt-1 ml-1">{otpError}</p>
                                    )}
                                </div>

                                <div className="text-center">
                                    <button
                                        id="register-otp-resend"
                                        type="button"
                                        onClick={sendOtp}
                                        disabled={resendCooldown > 0 || otpSending}
                                        className="text-[10px] font-black uppercase tracking-widest text-[#075985] hover:text-blue-800 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {otpSending ? 'Sending...' : resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't get the code? Resend"}
                                    </button>
                                </div>

                                <div className="flex gap-4">
                                    <button onClick={() => { setOtpError(''); setCurrentStep(2); }} className="flex-1 bg-slate-100 text-slate-500 font-black py-5 rounded-2xl active:scale-95 transition-all text-xs uppercase italic tracking-widest">Change Email</button>
                                    <button
                                        id="register-otp-verify"
                                        onClick={handleVerifyOtp}
                                        disabled={otpVerifying || otpCode.length !== 6}
                                        className="flex-[2] bg-[#08315F] text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all text-xs uppercase italic tracking-widest disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {otpVerifying ? 'Verifying...' : 'Confirm Code'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP 4: SECURITY */}
                        {currentStep === 4 && (
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
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Passcode (For account recovery)</label>
                                        <div className="relative group">
                                            <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#075985] transition-colors" />
                                            <input 
                                                type="text" 
                                                maxLength={6}
                                                value={formData.passcode} 
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                                                    e.target.value = val;
                                                    setFormData({ ...formData, passcode: val });
                                                }} 
                                                placeholder="Enter 6-digit passcode" 
                                                className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-800 font-bold focus:outline-none focus:border-[#08315F] shadow-sm" 
                                            />
                                        </div>
                                    </div>
                                </div>
                                {error && <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold">{error}</div>}
                                {!isVacancies && (
                                    <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                        <FiCheckCircle className="text-emerald-500 shrink-0" size={14} />
                                        <p className="text-[10px] font-bold text-emerald-700 break-all">Email verified: {verifiedEmail}</p>
                                    </div>
                                )}
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
                                Already have an account? <Link to="/login" state={isVacancies ? { redirectTo: '/all-vacancies', isCO: false } : undefined} className="text-[#075985] hover:text-blue-800 ml-1">Sign In Instead</Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </PageTransition>
    );
};

export default Register;

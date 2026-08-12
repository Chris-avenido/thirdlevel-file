import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import Swal from 'sweetalert2';
import PageTransition from '../components/PageTransition';
import logo from '../assets/modern_logo.png';

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleReset = async (e) => {
        e.preventDefault();

        if (!token) {
            Swal.fire('Error', 'Invalid or missing reset token.', 'error');
            return;
        }

        if (password.length < 8) {
            Swal.fire('Error', 'Password must be at least 8 characters long.', 'error');
            return;
        }

        if (password !== confirmPassword) {
            Swal.fire('Error', 'Passwords do not match.', 'error');
            return;
        }

        setLoading(true);
        try {
            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const response = await fetch(`${baseUrl}/api/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword: password })
            });

            const data = await response.json();

            if (response.ok) {
                Swal.fire('Success', data.message, 'success').then(() => {
                    navigate('/');
                });
            } else {
                Swal.fire('Error', data.error || 'Failed to reset password.', 'error');
            }
        } catch (err) {
            Swal.fire('Error', 'Failed to connect to the server.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageTransition>
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl relative border border-white/20">
                    <div className="text-center mb-8">
                        <img src={logo} alt="DepEd Logo" className="w-20 mx-auto mb-6" />
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase italic">Reset Password</h2>
                        <p className="text-slate-500 text-sm mt-2 font-medium">Enter your new password below.</p>
                    </div>

                    <form onSubmit={handleReset} className="space-y-5">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <FiLock className="h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="New Password"
                                className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-4 flex items-center"
                            >
                                {showPassword ? (
                                    <FiEyeOff className="h-5 w-5 text-slate-400 hover:text-slate-600 transition-colors" />
                                ) : (
                                    <FiEye className="h-5 w-5 text-slate-400 hover:text-slate-600 transition-colors" />
                                )}
                            </button>
                        </div>

                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <FiLock className="h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                            </div>
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm New Password"
                                className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute inset-y-0 right-0 pr-4 flex items-center"
                            >
                                {showConfirmPassword ? (
                                    <FiEyeOff className="h-5 w-5 text-slate-400 hover:text-slate-600 transition-colors" />
                                ) : (
                                    <FiEye className="h-5 w-5 text-slate-400 hover:text-slate-600 transition-colors" />
                                )}
                            </button>
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-[#08315F] text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all text-sm uppercase tracking-widest disabled:opacity-70 mt-6"
                        >
                            {loading ? 'Resetting...' : 'Reset Password'}
                        </button>
                    </form>
                </div>
            </div>
        </PageTransition>
    );
};

export default ResetPassword;

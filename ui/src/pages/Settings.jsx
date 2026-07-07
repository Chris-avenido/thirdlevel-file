import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiSave, FiLock, FiUser, FiEye, FiEyeOff, FiLogOut, FiSettings } from 'react-icons/fi';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import AdminSidebar from '../components/AdminSidebar';
import { apiUrl } from '../utils/api';

const Settings = () => {
    const { user, token, setUser, logout } = useAuth();
    
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        password: '',
        confirmPassword: '',
        passcode: '',
        confirmPasscode: ''
    });

    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showPasscode, setShowPasscode] = useState(false);

    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                firstName: user.first_name || '',
                lastName: user.last_name || ''
            }));
        }
    }, [user]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();

        if (formData.password && formData.password !== formData.confirmPassword) {
            Swal.fire('Error', 'Passwords do not match', 'error');
            return;
        }

        if (formData.passcode && formData.passcode !== formData.confirmPasscode) {
            Swal.fire('Error', 'Passcodes do not match', 'error');
            return;
        }

        if (formData.passcode && formData.passcode.length !== 6) {
            Swal.fire('Error', 'Passcode must be exactly 6 digits', 'error');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(apiUrl('/api/auth/user/settings'), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    password: formData.password || undefined,
                    passcode: formData.passcode || undefined
                })
            });

            const data = await res.json();
            if (data.success) {
                Swal.fire({
                    title: 'Success!',
                    text: 'Your settings have been updated.',
                    icon: 'success',
                    confirmButtonColor: '#08315F'
                });
                
                // Clear sensitive fields
                setFormData(prev => ({
                    ...prev,
                    password: '',
                    confirmPassword: '',
                    passcode: '',
                    confirmPasscode: ''
                }));

                // Update context if user data returned
                if (data.user && setUser) {
                    setUser(prev => {
                        const updatedUser = {
                            ...prev,
                            first_name: data.user.first_name,
                            last_name: data.user.last_name
                        };
                        // Persist to localStorage so it survives page refreshes
                        localStorage.setItem('user', JSON.stringify(updatedUser));
                        localStorage.setItem('remembered_user', JSON.stringify(updatedUser));
                        return updatedUser;
                    });
                }
            } else {
                throw new Error(data.error || 'Failed to update settings');
            }
        } catch (err) {
            Swal.fire('Error', err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen bg-transparent font-['Plus_Jakarta_Sans'] overflow-hidden">
            <AdminSidebar />
            
            <main className="flex-1 flex flex-col h-screen overflow-y-auto relative">
                {/* TOP NAVIGATION BAR */}
                <header className="sticky top-0 z-50 bg-[#08315F] backdrop-blur-md border-b border-blue-900 px-8 py-4 flex items-center justify-between shadow-lg shadow-blue-900/20">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white shadow-inner">
                            <FiSettings size={20} />
                        </div>
                        <div>
                            <h1 className="text-lg font-['Plus_Jakarta_Sans'] font-black text-white tracking-tight leading-none italic uppercase">Account <span className="text-blue-300 not-italic">Settings</span></h1>
                            <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest mt-1">Profile & Security</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="hidden md:flex flex-col items-end">
                            <span className="text-xs font-['Plus_Jakarta_Sans'] font-black text-white leading-none">{user?.first_name} {user?.last_name}</span>
                            <span className="text-[9px] font-bold text-[#FBBF24] uppercase tracking-widest mt-1">{user?.role}</span>
                        </div>
                    </div>
                </header>
                
                <div className="p-8 lg:p-12 max-w-4xl mx-auto w-full mt-4">
                    
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-10"
                    >
                        <h1 className="text-3xl font-black text-[#08315F] tracking-tight">Account Settings</h1>
                        <p className="text-slate-500 font-medium mt-2">Update your personal information and security credentials.</p>
                    </motion.div>

                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white rounded-[2rem] border-2 border-[#08315F] p-8 shadow-xl"
                    >
                        <form onSubmit={handleSave} className="space-y-8">
                            
                            {/* Personal Information */}
                            <div>
                                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                                        <FiUser size={20} />
                                    </div>
                                    <h2 className="text-xl font-bold text-[#08315F]">Personal Information</h2>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">First Name</label>
                                        <input 
                                            type="text" 
                                            name="firstName"
                                            value={formData.firstName}
                                            onChange={handleChange}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-[#08315F] font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                            placeholder="Enter first name"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Last Name</label>
                                        <input 
                                            type="text" 
                                            name="lastName"
                                            value={formData.lastName}
                                            onChange={handleChange}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-[#08315F] font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                            placeholder="Enter last name"
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
                                        <input 
                                            type="email" 
                                            value={user?.email || ''}
                                            disabled
                                            className="w-full px-5 py-4 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-bold cursor-not-allowed"
                                        />
                                        <p className="text-[10px] text-slate-400 font-medium ml-1 mt-1">Email address cannot be changed.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Security */}
                            <div>
                                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 mt-8">
                                    <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                                        <FiLock size={20} />
                                    </div>
                                    <h2 className="text-xl font-bold text-[#08315F]">Security Credentials</h2>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">New Password</label>
                                        <div className="relative">
                                            <input 
                                                type={showPassword ? "text" : "password"} 
                                                name="password"
                                                value={formData.password}
                                                onChange={handleChange}
                                                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-[#08315F] font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                placeholder="Leave blank to keep current"
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#08315F] transition-colors"
                                            >
                                                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Confirm Password</label>
                                        <input 
                                            type={showPassword ? "text" : "password"} 
                                            name="confirmPassword"
                                            value={formData.confirmPassword}
                                            onChange={handleChange}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-[#08315F] font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                            placeholder="Confirm new password"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">New Passcode (6-Digit)</label>
                                        <div className="relative">
                                            <input 
                                                type={showPasscode ? "text" : "password"} 
                                                name="passcode"
                                                value={formData.passcode}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\D/g, '').slice(0,6);
                                                    handleChange({ target: { name: 'passcode', value: val } });
                                                }}
                                                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-[#08315F] font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono tracking-widest"
                                                placeholder="••••••"
                                                maxLength={6}
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => setShowPasscode(!showPasscode)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#08315F] transition-colors"
                                            >
                                                {showPasscode ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Confirm Passcode</label>
                                        <input 
                                            type={showPasscode ? "text" : "password"} 
                                            name="confirmPasscode"
                                            value={formData.confirmPasscode}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, '').slice(0,6);
                                                handleChange({ target: { name: 'confirmPasscode', value: val } });
                                            }}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-[#08315F] font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono tracking-widest"
                                            placeholder="••••••"
                                            maxLength={6}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-100 flex justify-end">
                                <button 
                                    type="submit"
                                    disabled={loading}
                                    className="flex items-center gap-3 px-8 py-4 bg-[#08315F] text-white rounded-xl font-bold uppercase tracking-widest hover:bg-blue-900 transition-colors shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    <FiSave size={18} />
                                    {loading ? 'Saving Changes...' : 'Save Settings'}
                                </button>
                            </div>

                        </form>
                    </motion.div>

                </div>
            </main>
        </div>
    );
};

export default Settings;

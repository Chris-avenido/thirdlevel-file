import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronLeft, FiBriefcase, FiSearch, FiLoader, FiAlertTriangle, FiUser, FiLock } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import PageTransition from '../components/PageTransition';
import { apiUrl } from '../utils/api';
import Swal from 'sweetalert2';

const AllVacancies = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user, token, logout } = useAuth();
    
    const [vacancies, setVacancies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    useEffect(() => {
        const fetchVacancies = async () => {
            try {
                const res = await fetch(apiUrl('/api/third-level/vacancies'), {
                    headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
                });
                const data = await res.json();
                if (data.success) {
                    setVacancies(data.data);
                }
            } catch (err) {
                console.error('Failed to fetch vacancies:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchVacancies();
    }, [token]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    const filteredVacancies = vacancies.filter(v => 
        (v.position_title && v.position_title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (v.office && v.office.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (v.strand && v.strand.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const totalPages = Math.ceil(filteredVacancies.length / itemsPerPage);
    const currentVacancies = filteredVacancies.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <PageTransition>
            <div className="min-h-screen bg-transparent font-['Plus_Jakarta_Sans'] text-[#08315F] relative flex flex-col">
                {/* Header Banner */}
                <div className="bg-[#08315F] text-white relative overflow-hidden shadow-lg border-b border-[#0038A8]/20 py-6 px-6 lg:px-8 shrink-0">
                    <div className="absolute -top-[100%] right-[-10%] w-[50%] h-[300%] bg-[#075985] rounded-[100%] opacity-90 pointer-events-none transform rotate-12 z-0"></div>
                    <div className="max-w-[1400px] mx-auto flex flex-col gap-6 relative z-10">
                        {/* Top Navigation Row */}
                        <div className="flex justify-between items-center w-full">
                            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-300 hover:text-white font-bold text-[10px] uppercase tracking-wider transition-all">
                                <FiChevronLeft size={16} /> Back
                            </button>
                            <button onClick={logout} className="flex items-center gap-2 text-slate-300 hover:text-red-400 font-bold text-[10px] uppercase tracking-wider transition-all">
                                <FiLock size={14} /> Sign Out
                            </button>
                        </div>

                        {/* Title Row */}
                        <div className="flex flex-col gap-2 min-w-0">
                            <h1 className="text-xl md:text-2xl lg:text-3xl font-black text-white tracking-tight leading-none truncate">Available Vacancies</h1>
                            <p className="text-blue-200/80 text-xs md:text-sm font-medium mt-1 truncate">Browse and search for third level vacant positions</p>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto p-6 lg:p-10 bg-transparent pb-24">
                    <div className="max-w-[1000px] w-full mx-auto space-y-6">
                        
                        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm focus-within:border-[#0038A8] focus-within:ring-2 focus-within:ring-[#0038A8]/20 transition-all">
                            <div className="pl-4 text-slate-400"><FiSearch size={20} /></div>
                            <input 
                                type="text"
                                placeholder="Search by position title, office, or strand..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-transparent border-none py-3 pr-4 text-sm font-semibold text-slate-800 placeholder:text-slate-400 outline-none"
                            />
                        </div>

                        <div className="bg-white border-2 border-[#08315F] rounded-[22px] p-6 lg:p-8 space-y-5 shadow-none">
                            <div className="grid grid-cols-1 gap-4">
                                {loading ? (
                                    <div className="py-20 text-center bg-transparent rounded-[2rem] border-2 border-dashed border-slate-200">
                                        <FiLoader className="animate-spin mx-auto text-[#075985] mb-4" size={32} />
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fetching Available Vacancies...</p>
                                    </div>
                                ) : filteredVacancies.length === 0 ? (
                                    <div className="py-20 text-center bg-transparent rounded-[2rem] border-2 border-dashed border-slate-200">
                                        <FiAlertTriangle className="mx-auto text-amber-400 mb-4" size={32} />
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{searchQuery ? 'No Matching Vacancies' : 'No Vacant Positions Found'}</p>
                                    </div>
                                ) : (
                                    <>
                                        <AnimatePresence>
                                            {currentVacancies.map(v => (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    key={v.TLOid}
                                                    className="w-full flex flex-col md:flex-row md:items-center justify-between p-6 rounded-[2rem] border-2 border-slate-100 bg-white hover:border-slate-200 hover:shadow-md transition-all gap-4"
                                                >
                                                    <div className="flex items-center gap-5">
                                                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-50 text-slate-400 shrink-0">
                                                            <FiBriefcase size={20} />
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-['Plus_Jakarta_Sans'] font-black text-[#08315F] uppercase tracking-tight italic flex items-center gap-2">
                                                                <span>{v.position_title}</span>
                                                                {v.is_oic && <span className="px-1.5 py-0.5 rounded bg-[#FCD116] text-[#08315F] text-[8px] font-black uppercase tracking-widest leading-none">OIC</span>}
                                                            </h4>
                                                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                                                                <span className="text-[9px] font-bold text-[#075985] uppercase tracking-widest">{v.office}</span>
                                                                <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{v.strand}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => {
                                                                Swal.fire({
                                                                    icon: 'success',
                                                                    title: 'Successfully applied',
                                                                    showConfirmButton: false,
                                                                    timer: 1500
                                                                });
                                                            }}
                                                            className="px-6 py-3 bg-[#08315F] text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-900 transition-colors shadow-sm"
                                                        >
                                                            Apply
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                        
                                        {/* Pagination Controls */}
                                        {totalPages > 1 && (
                                            <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-4">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredVacancies.length)} of {filteredVacancies.length}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                        disabled={currentPage === 1}
                                                        className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-bold disabled:opacity-50 transition-colors"
                                                    >
                                                        Previous
                                                    </button>
                                                    <div className="flex gap-1">
                                                        {[...Array(totalPages)].map((_, i) => (
                                                            <button
                                                                key={i + 1}
                                                                onClick={() => setCurrentPage(i + 1)}
                                                                className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${currentPage === i + 1 ? 'bg-[#08315F] text-white' : 'bg-transparent text-slate-500 hover:bg-slate-50'}`}
                                                            >
                                                                {i + 1}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <button 
                                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                        disabled={currentPage === totalPages}
                                                        className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-bold disabled:opacity-50 transition-colors"
                                                    >
                                                        Next
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PageTransition>
    );
};

export default AllVacancies;

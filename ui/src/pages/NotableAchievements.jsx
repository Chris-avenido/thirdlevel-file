import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSearch, FiFilter, FiDownload, FiUploadCloud, FiPlus, FiEdit2, FiTrash2, FiChevronLeft, FiChevronRight, FiCheckCircle, FiX, FiAward } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import PageTransition from '../components/PageTransition';
import AdminSidebar from '../components/AdminSidebar';
import NotableAchievementsModal from '../components/NotableAchievementsModal';
import Swal from 'sweetalert2';
import { apiUrl } from '../utils/api';

const generateHash = (id) => {
    if (!id) return '';
    const num = Number(id);
    if (isNaN(num)) return String(id);
    // Deterministic scramble to generate a 5-digit number
    const scrambled = (num * 2654435761) % 90000;
    return 10000 + Math.abs(scrambled);
};

const NotableAchievements = () => {
    const { user, token } = useAuth();
    const navigate = useNavigate();

    const [achievements, setAchievements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState({ key: 'index_number', direction: 'asc' });

    // Modals state
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editMode, setEditMode] = useState('add'); // 'add' or 'edit'
    const [formData, setFormData] = useState({ index_number: '', achievement: '' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (user && user.role !== 'Central Office') {
            navigate('/home');
            return;
        }
        fetchAchievements();
    }, [user, navigate]);

    const fetchAchievements = async () => {
        setLoading(true);
        try {
            const res = await fetch(apiUrl('/api/third-level/notable-achievements-full'), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setAchievements(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch notable achievements:', err);
        } finally {
            setLoading(false);
        }
    };

    const uniqueAchievements = useMemo(() => {
        const list = achievements.map(a => a.achievement).filter(Boolean);
        return [...new Set(list)].sort();
    }, [achievements]);

    const filteredRecords = useMemo(() => {
        return achievements.filter(item => {
            if (!searchTerm) return true;
            return (item.achievement || '') === searchTerm;
        });
    }, [achievements, searchTerm]);

    const sortedRecords = useMemo(() => {
        return [...filteredRecords].sort((a, b) => {
            const left = a[sortConfig.key];
            const right = b[sortConfig.key];

            if (sortConfig.key === 'index_number') {
                return sortConfig.direction === 'asc' ? left - right : right - left;
            }

            const leftStr = String(left || '').toLowerCase();
            const rightStr = String(right || '').toLowerCase();
            if (leftStr < rightStr) return sortConfig.direction === 'asc' ? -1 : 1;
            if (leftStr > rightStr) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredRecords, sortConfig]);

    const pageSize = 10;
    const pageCount = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
    const pagedRecords = sortedRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // Actions
    const handleExport = () => {
        if (sortedRecords.length === 0) {
            Swal.fire('No Data', 'There is no data to export.', 'info');
            return;
        }
        const csvContent = "data:text/csv;charset=utf-8,"
            + "No.,Achievement\n"
            + sortedRecords.map(e => `"${e.index_number}","${(e.achievement || '').replace(/"/g, '""')}"`).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Notable_Achievements_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleOpenAdd = () => {
        setEditMode('add');
        const nextId = achievements.length > 0 ? Math.max(...achievements.map(a => Number(a.index_number) || 0)) + 1 : 1;
        setFormData({ index_number: nextId, achievement: '' });
        setIsEditModalOpen(true);
    };

    const handleOpenEdit = (item) => {
        setEditMode('edit');
        setFormData({ index_number: item.index_number, achievement: item.achievement });
        setIsEditModalOpen(true);
    };

    const handleDelete = async (index_number) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `Do you want to delete achievement #${generateHash(index_number)}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e11d48', // rose-600 to match the button
            cancelButtonColor: '#64748b', // slate-500
            confirmButtonText: 'Yes, delete it'
        });

        if (!result.isConfirmed) return;

        try {
            const res = await fetch(apiUrl(`/api/third-level/notable-achievements/${index_number}`), {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                Swal.fire('Deleted!', 'The record has been deleted.', 'success');
                fetchAchievements();
            } else {
                Swal.fire('Error', data.error || 'Failed to delete record.', 'error');
            }
        } catch (err) {
            Swal.fire('Error', 'Network error. Please try again.', 'error');
        }
    };

    const handleSave = async () => {
        if (!formData.index_number || !formData.achievement) {
            Swal.fire('Validation Error', 'Please fill in both fields.', 'error');
            return;
        }

        setSaving(true);
        try {
            const url = editMode === 'add'
                ? apiUrl('/api/third-level/notable-achievements')
                : apiUrl(`/api/third-level/notable-achievements/${formData.index_number}`);

            const res = await fetch(url, {
                method: editMode === 'add' ? 'POST' : 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            const data = await res.json();
            if (data.success) {
                Swal.fire('Success', `Record successfully ${editMode === 'add' ? 'added' : 'updated'}.`, 'success');
                setIsEditModalOpen(false);
                fetchAchievements();
            } else {
                Swal.fire('Error', data.error || 'Failed to save record.', 'error');
            }
        } catch (err) {
            Swal.fire('Error', 'Network error. Please try again.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const pageButtons = useMemo(() => {
        const visible = new Set([1, pageCount, currentPage - 1, currentPage, currentPage + 1].filter(page => page >= 1 && page <= pageCount));
        const pages = [];
        let previous = 0;
        [...visible].sort((a, b) => a - b).forEach(page => {
            if (page - previous > 1) pages.push('ellipsis-' + page);
            pages.push(page);
            previous = page;
        });
        return pages;
    }, [currentPage, pageCount]);

    return (
        <PageTransition>
            <div className="flex h-screen bg-transparent font-['Quicksand'] text-[#08315F] flex-col lg:flex-row relative overflow-hidden">
                <AdminSidebar />
                <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto relative">
                    
                    {/* TOP NAVIGATION BAR */}
                    <header className="sticky top-0 z-50 bg-[#08315F] backdrop-blur-md border-b border-blue-900 px-8 py-4 flex items-center justify-between shadow-lg shadow-blue-900/20 shrink-0">
                        <div className="flex items-center gap-4 text-white">
                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white shadow-inner">
                                <FiAward size={20} />
                            </div>
                            <div>
                                <h1 className="text-lg font-['Quicksand'] font-black text-white tracking-tight leading-none italic uppercase">Notable <span className="text-blue-300 not-italic">Achievements</span></h1>
                                <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest mt-1">
                                    {achievements.length} Total Achievements
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-100 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-500/30 hover:bg-emerald-500 hover:text-white transition-all shadow-sm">
                                <FiUploadCloud size={14} /> Import Data
                            </button>
                            <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-100 rounded-lg text-[9px] font-black uppercase tracking-widest border border-blue-500/30 hover:bg-blue-500 hover:text-white transition-all shadow-sm">
                                <FiDownload size={14} /> Export Data
                            </button>
                            <button onClick={handleOpenAdd} className="flex items-center gap-2 px-4 py-2 bg-white text-[#08315F] rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-50 shadow-md shadow-black/10 transition-all border border-white">
                                <FiPlus size={14} /> Add Record
                            </button>
                        </div>
                    </header>

                    <div className="flex-1 p-8 max-w-[1600px] mx-auto w-full">
                        {/* Filters */}
                        <div className="mb-6 flex flex-col md:flex-row gap-4">
                            <div className="flex-1 max-w-xl flex items-center gap-3">
                                <div className="relative flex-1">
                                    <FiFilter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <select
                                        value={searchTerm}
                                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                        className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:border-[#08315F] shadow-sm transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">All Achievements</option>
                                        {uniqueAchievements.map((ach, idx) => (
                                            <option key={idx} value={ach}>{ach}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                                    </div>
                                </div>
                                <AnimatePresence>
                                    {searchTerm && (
                                        <motion.button
                                            initial={{ opacity: 0, scale: 0.9, width: 0 }}
                                            animate={{ opacity: 1, scale: 1, width: 'auto' }}
                                            exit={{ opacity: 0, scale: 0.9, width: 0 }}
                                            onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                                            className="px-4 py-3 bg-white border border-slate-200 text-slate-500 hover:text-red-500 hover:bg-red-50 hover:border-red-200 rounded-2xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 whitespace-nowrap overflow-hidden"
                                        >
                                            <FiX size={14} /> Clear
                                        </motion.button>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Table Area */}
                        <AnimatePresence mode="wait">
                            {loading ? (
                                <div className="h-64 flex items-center justify-center">
                                    <div className="w-12 h-12 border-4 border-[#08315F]/10 border-t-[#08315F] rounded-full animate-spin"></div>
                                </div>
                            ) : sortedRecords.length === 0 ? (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-[3rem] p-20 text-center border-2 border-dashed border-slate-200">
                                    <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6"><FiSearch size={40} /></div>
                                    <h3 className="text-xl font-['Quicksand'] font-black text-[#08315F] uppercase italic tracking-tight">No Records Found</h3>
                                    <p className="text-slate-400 font-medium mt-2">Adjust your filters or add a new record.</p>
                                </motion.div>
                            ) : (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-200/50 border-2 border-[#08315F]">
                                    <div className="w-full overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                                    <th className="px-6 py-4 w-32">
                                                        <button onClick={() => handleSort('index_number')} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-[#075985] transition-colors">
                                                            No. {sortConfig.key === 'index_number' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                                                        </button>
                                                    </th>
                                                    <th className="px-6 py-4">
                                                        <button onClick={() => handleSort('achievement')} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-[#075985] transition-colors">
                                                            Achievement Details {sortConfig.key === 'achievement' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                                                        </button>
                                                    </th>
                                                    <th className="px-6 py-4 text-right">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Actions</span>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {pagedRecords.map((item) => (
                                                    <motion.tr key={item.index_number} whileHover={{ backgroundColor: 'rgba(248, 250, 252, 0.8)' }} className="group transition-colors relative">
                                                        <td className="px-6 py-4">
                                                            <div className="w-12 h-10 rounded-[1rem] bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center font-black text-blue-400 text-xs border border-white shadow-sm tracking-widest">
                                                                {generateHash(item.index_number)}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="font-['Quicksand'] font-black text-[#08315F] text-sm leading-none group-hover:text-[#08315F] transition-colors line-clamp-2">
                                                                {item.achievement}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => handleOpenEdit(item)} className="flex items-center gap-1 px-2 py-1.5 bg-amber-50 text-amber-600 rounded-md text-[7px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all border border-amber-100 shadow-sm">
                                                                    <FiEdit2 size={10} /> Edit
                                                                </button>
                                                                <button onClick={() => handleDelete(item.index_number)} className="flex items-center gap-1 px-2 py-1.5 bg-rose-50 text-rose-600 rounded-md text-[7px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all border border-rose-100 shadow-sm">
                                                                    <FiTrash2 size={10} /> Delete
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </motion.tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pagination */}
                                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Showing {sortedRecords.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, sortedRecords.length)} of {sortedRecords.length} records
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 text-slate-500 rounded-lg disabled:opacity-40 hover:bg-slate-50">
                                                <FiChevronLeft size={14} />
                                            </button>
                                            {pageButtons.length > 0 ? pageButtons.map(page => typeof page === 'number' ? (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-[10px] font-black border transition-all ${currentPage === page ? 'bg-[#08315F] text-white border-[#08315F]' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-200'}`}
                                                >
                                                    {page}
                                                </button>
                                            ) : (
                                                <span key={page} className="w-8 h-8 flex items-center justify-center text-slate-400 font-black">...</span>
                                            )) : (
                                                <button className="w-8 h-8 flex items-center justify-center rounded-lg text-[10px] font-black border transition-all bg-[#08315F] text-white border-[#08315F]">1</button>
                                            )}
                                            <button disabled={currentPage >= pageCount} onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 text-slate-500 rounded-lg disabled:opacity-40 hover:bg-slate-50">
                                                <FiChevronRight size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* EDIT/ADD MODAL */}
            <AnimatePresence>
                {isEditModalOpen && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col"
                        >
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h2 className="text-xl font-black text-[#08315F] uppercase tracking-tighter">{editMode === 'add' ? 'Add New Record' : 'Edit Record'}</h2>
                                </div>
                                <button onClick={() => setIsEditModalOpen(false)} className="p-2 text-slate-400 hover:text-red-500 bg-white rounded-xl shadow-sm border border-slate-200 transition-all">
                                    <FiX size={18} />
                                </button>
                            </div>

                            <div className="p-8 space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Achievement Details</label>
                                    <textarea
                                        value={formData.achievement}
                                        onChange={e => setFormData({ ...formData, achievement: e.target.value })}
                                        rows={4}
                                        className="w-full bg-slate-50 border border-slate-200 focus:border-[#08315F] rounded-xl py-3 px-4 text-xs font-bold text-slate-700 outline-none transition-all resize-none"
                                    />
                                </div>
                            </div>

                            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                                <button onClick={() => setIsEditModalOpen(false)} className="px-5 py-2.5 bg-white text-slate-500 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-200 hover:bg-slate-100 transition-all">Cancel</button>
                                <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-[#08315F] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:bg-[#075985] transition-all flex items-center gap-2">
                                    {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FiCheckCircle size={16} />}
                                    Save Record
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* IMPORT MODAL */}
            <NotableAchievementsModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={() => { setIsImportModalOpen(false); fetchAchievements(); }}
            />
        </PageTransition>
    );
};

export default NotableAchievements;

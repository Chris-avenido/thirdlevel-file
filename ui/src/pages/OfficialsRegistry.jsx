import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    FiUsers, FiSearch, FiFilter, FiExternalLink, FiChevronRight, 
    FiMoreVertical, FiDownload, FiPlus, FiGrid, FiList,
    FiCheckCircle, FiAlertCircle, FiClock, FiActivity, FiArrowRight,
    FiLogOut, FiUser, FiInfo, FiLayers, FiX, FiTrash2
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import PageTransition from '../components/PageTransition';
import LoadingScreen from '../components/LoadingScreen';
import Swal from 'sweetalert2';
import { apiUrl } from '../utils/api';

const OfficialsRegistry = () => {
    const navigate = useNavigate();
    const { user, logout, token } = useAuth();
    
    // --- SEARCHABLE SELECT COMPONENT ---
    const SearchableSelect = ({ label, options, value, onChange, placeholder, info }) => {
        const [isOpen, setIsOpen] = useState(false);
        const [search, setSearch] = useState('');
        
        const filteredOptions = options.filter(opt => 
            opt.label.toLowerCase().includes(search.toLowerCase()) ||
            opt.sublabel?.toLowerCase().includes(search.toLowerCase())
        );

        const selectedOption = options.find(opt => opt.value === value);

        return (
            <div className="relative">
                {label && <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">{label}</label>}
                {info && <p className="text-[9px] text-slate-400 font-bold mb-3">{info}</p>}
                
                <div 
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full bg-slate-50 border-2 border-transparent hover:border-blue-600/10 cursor-pointer rounded-2xl py-4 px-5 flex justify-between items-center transition-all group"
                >
                    <div className="flex flex-col">
                        <span className={`text-sm font-bold ${selectedOption ? 'text-slate-900' : 'text-slate-400'}`}>
                            {selectedOption ? selectedOption.label : placeholder}
                        </span>
                        {selectedOption?.sublabel && (
                            <span className="text-[10px] text-slate-400 font-bold">{selectedOption.sublabel}</span>
                        )}
                    </div>
                    <FiChevronRight className={`transition-transform duration-300 ${isOpen ? 'rotate-90 text-blue-600' : 'text-slate-300'}`} size={18} />
                </div>

                <AnimatePresence>
                    {isOpen && (
                        <>
                            <div className="fixed inset-0 z-[120]" onClick={() => setIsOpen(false)} />
                            <motion.div 
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                className="absolute left-0 right-0 top-full mt-2 bg-white rounded-3xl shadow-2xl border border-slate-100 z-[130] overflow-hidden flex flex-col max-h-[450px]"
                            >
                                <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                                    <div className="relative">
                                        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input 
                                            autoFocus
                                            type="text"
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search options..."
                                            className="w-full bg-white border-2 border-slate-100 focus:border-blue-600/20 rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-slate-700 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="overflow-y-auto py-2 custom-scrollbar">
                                    {filteredOptions.length > 0 ? (
                                        filteredOptions.map((opt) => (
                                            <div 
                                                key={opt.value}
                                                onClick={() => {
                                                    onChange(opt.value);
                                                    setIsOpen(false);
                                                    setSearch('');
                                                }}
                                                className={`px-5 py-4 cursor-pointer flex flex-col hover:bg-blue-50 transition-colors ${value === opt.value ? 'bg-blue-50/50 border-l-4 border-blue-600' : 'border-l-4 border-transparent'}`}
                                            >
                                                <span className={`text-xs font-black uppercase tracking-tight ${value === opt.value ? 'text-blue-700' : 'text-slate-700'}`}>
                                                    {opt.label}
                                                </span>
                                                {opt.sublabel && (
                                                    <span className="text-[10px] text-slate-400 font-bold mt-0.5">{opt.sublabel}</span>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-10 text-center">
                                            <FiInfo className="mx-auto text-slate-200 mb-2" size={24} />
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No options found</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    const [officials, setOfficials] = useState([]);
    const [applications, setApplications] = useState([]);
    const [processingId, setProcessingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('Third Level'); // 'Third Level' | 'OIC / Chiefs' | 'Legacy'
    const [strandFilter, setStrandFilter] = useState('All');
    const [positionFilter, setPositionFilter] = useState('All');
    const [viewMode, setViewMode] = useState('grid');
    const [strands, setStrands] = useState([]);
    const [tabPositions, setTabPositions] = useState([]); // Positions specifically for the active tab

    const fetchTabPositions = async () => {
        try {
            // Fetch all positions for the current tab to keep the dropdown stable
            const queryParams = new URLSearchParams();
            if (activeTab !== 'Legacy' && activeTab !== 'Applications') {
                queryParams.append('category', activeTab);
                queryParams.append('status', 'Active');
            }
            const res = await fetch(apiUrl(`/api/third-level/officials?${queryParams.toString()}`), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                const uniquePositions = [...new Set(data.data.map(o => o.position_title).filter(Boolean))].sort();
                setTabPositions(uniquePositions);
            }
        } catch (err) {
            console.error('Failed to fetch tab positions:', err);
        }
    };

    useEffect(() => {
        if (activeTab !== 'Applications' && activeTab !== 'Legacy') {
            fetchTabPositions();
        }
    }, [activeTab]);
    const [showIncumbencyModal, setShowIncumbencyModal] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState(null);
    const [incumbents, setIncumbents] = useState([]);
    const [incumbentsLoading, setIncumbentsLoading] = useState(false);
    
    // Admin Action State
    const [showActionModal, setShowActionModal] = useState(false);
    const [actionOfficial, setActionOfficial] = useState(null);
    const [adminAction, setAdminAction] = useState(''); // 'reassign' | 'succeed' | 'vacate'
    const [justification, setJustification] = useState('');
    const [targetSlot, setTargetSlot] = useState('');
    const [vacantSlots, setVacantSlots] = useState([]);
    const [activeOfficials, setActiveOfficials] = useState([]);
    const [successorSlot, setSuccessorSlot] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        fetchStrands();
    }, []);

    useEffect(() => {
        if (activeTab === 'Applications') {
            fetchApplications();
        } else {
            fetchOfficials();
        }
    }, [searchTerm, activeTab, strandFilter, positionFilter]);

    const fetchStrands = async () => {
        try {
            // Simplified fetch for strands - we can also hardcode or fetch distinct from masterlist
            const res = await fetch(apiUrl('/api/third-level/officials?status=All'), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                const uniqueStrands = [...new Set(data.data.map(o => o.strand).filter(Boolean))].sort();
                setStrands(uniqueStrands);
            }
        } catch (err) {
            console.error('Failed to fetch strands:', err);
        }
    };

    const fetchOfficials = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            if (searchTerm) queryParams.append('search', searchTerm);
            if (activeTab !== 'Legacy') {
                queryParams.append('category', activeTab);
                queryParams.append('status', 'All');
            } else {
                queryParams.append('status', 'Legacy'); // Backend handles 'Legacy' as 'no status filter'
            }
            if (strandFilter !== 'All') queryParams.append('strand', strandFilter);
            if (positionFilter !== 'All') queryParams.append('position', positionFilter);

            const res = await fetch(apiUrl(`/api/third-level/officials?${queryParams.toString()}`), {
                headers: {
                    'Authorization': `Bearer ${token || localStorage.getItem('token')}`
                }
            });
            const data = await res.json();
            if (data.success) {
                setOfficials(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch officials:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchIncumbents = async (position, office) => {
        setIncumbentsLoading(true);
        setIncumbents([]);
        try {
            const res = await fetch(apiUrl(`/api/third-level/position-incumbents?position_title=${encodeURIComponent(position)}&office=${encodeURIComponent(office || '')}`), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setIncumbents(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch incumbents:', err);
        } finally {
            setIncumbentsLoading(false);
        }
    };

    const handlePositionClick = (official) => {
        setSelectedPosition({ title: official.position_title, office: official.office });
        setShowIncumbencyModal(true);
        fetchIncumbents(official.position_title, official.office);
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'active': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'pending': return 'bg-amber-50 text-amber-600 border-amber-100';
            case 'inactive': return 'bg-slate-50 text-slate-400 border-slate-100';
            case 'retired': return 'bg-purple-50 text-purple-600 border-purple-100';
            case 'succeeded': return 'bg-cyan-50 text-cyan-600 border-cyan-100';
            case 'vacated': return 'bg-rose-50 text-rose-600 border-rose-100';
            default: return 'bg-blue-50 text-blue-600 border-blue-100';
        }
    };

    const StatusBadge = ({ status }) => (
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(status)}`}>
            {status || 'Unknown'}
        </span>
    );

    const fetchApplications = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            if (searchTerm) queryParams.append('search', searchTerm);
            if (strandFilter !== 'All') queryParams.append('strand', strandFilter);
            if (positionFilter !== 'All') queryParams.append('position', positionFilter);

            const res = await fetch(apiUrl(`/api/third-level/applications?${queryParams.toString()}`), {
                headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success) setApplications(data.data);
        } catch (err) {
            console.error('Failed to fetch applications:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAdminAction = async () => {
        if (!justification) return Swal.fire('Notice', 'Please provide a justification.', 'info');
        if (adminAction === 'reassign' && !targetSlot) return Swal.fire('Notice', 'Please select a target vacant slot.', 'info');

        setActionLoading(true);
        try {
            const res = await fetch(apiUrl('/api/third-level/admin-action'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token || localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    TLOid: actionOfficial.TLOid,
                    action: adminAction,
                    justification,
                    target_TLOid: targetSlot,
                    successor_TLOid: successorSlot || undefined
                })
            });
            const data = await res.json();
            if (data.success) {
                Swal.fire('Notice', `Official ${adminAction}ed successfully.`, 'info');
                setShowActionModal(false);
                fetchOfficials();
            } else {
                Swal.fire('Notice', data.error || 'Action failed.', 'info');
            }
        } catch (err) {
            Swal.fire('Notice', 'Action failed: ' + err.message, 'info');
        } finally {
            setActionLoading(false);
        }
    };

    const openActionModal = async (official, action) => {
        setActionOfficial(official);
        setAdminAction(action);
        setJustification('');
        setTargetSlot('');
        setSuccessorSlot('');
        setShowActionModal(true);
        if (action === 'reassign') {
            try {
                const res = await fetch(apiUrl('/api/third-level/officials?status=Vacant'), {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success) setVacantSlots(data.data);
            } catch (err) {
                console.error('Failed to fetch vacant slots:', err);
            }
        }
        if (action === 'succeed') {
            try {
                const res = await fetch(apiUrl(`/api/third-level/active-officials?exclude_TLOid=${official.TLOid}`), {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success) setActiveOfficials(data.data);
            } catch (err) {
                console.error('Failed to fetch active officials:', err);
            }
        }
    };

    const handleProcessApplication = async (app_TLOid, action, denial_reason = '') => {
        if (!window.confirm(`Are you sure you want to ${action} this application?`)) return;
        
        setProcessingId(app_TLOid);
        try {
            const res = await fetch(apiUrl('/api/third-level/process-application'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token || localStorage.getItem('token')}`
                },
                body: JSON.stringify({ app_TLOid, action, denial_reason })
            });
            const data = await res.json();
            if (data.success) {
                fetchApplications();
                Swal.fire('Notice', `Application ${action}d successfully.`, 'info');
            } else {
                Swal.fire('Notice', data.error || 'Processing failed.', 'info');
            }
        } catch (err) {
            Swal.fire('Notice', 'Processing failed: ' + err.message, 'info');
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <PageTransition>
            <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans overflow-x-hidden">
                
                {/* TOP NAVIGATION BAR */}
                <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-[#004A99] rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
                            <FiUsers size={20} />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-slate-800 tracking-tight leading-none italic uppercase">Personnel <span className="text-[#004A99] not-italic">Registry</span></h1>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Official Leadership Management</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="hidden md:flex flex-col items-end">
                            <span className="text-xs font-black text-slate-800 leading-none">{user?.first_name} {user?.last_name}</span>
                            <span className="text-[9px] font-bold text-[#CE1126] uppercase tracking-widest mt-1">{user?.role}</span>
                        </div>
                        <button onClick={logout} className="p-3 rounded-xl bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all border border-slate-100">
                            <FiLogOut size={18} />
                        </button>
                    </div>
                </header>

                <main className="flex-1 p-8 max-w-[1600px] mx-auto w-full">
                    
                    {/* TABS & CATEGORIES */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                        <div className="flex p-1 bg-slate-100 rounded-2xl w-fit">
                            {['Third Level', 'OIC / Chiefs', 'Legacy', 'Applications'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => { setActiveTab(tab); setPositionFilter('All'); setStrandFilter('All'); }}
                                    className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-[#004A99] shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {tab === 'Legacy' ? 'Legacy Registry' : tab === 'Applications' ? 'Recruitment' : tab}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                                    <FiActivity size={18} />
                                </div>
                                <div>
                                    <span className="block text-2xl font-black text-slate-900 leading-none tracking-tight">
                                        {activeTab === 'Applications' ? applications.length : officials.length}
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Records</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* FILTERS & SEARCH BAR */}
                    <div className="bg-white rounded-[2.5rem] p-6 shadow-xl shadow-slate-200/40 border border-slate-100 mb-8 space-y-6">
                        <div className="flex flex-col lg:flex-row gap-4 items-center">
                            {/* Search */}
                            <div className="relative flex-1 w-full">
                                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input 
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search by name, position, or office..."
                                    className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-4 pl-12 pr-4 text-slate-700 font-bold focus:bg-white focus:border-blue-600/20 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none shadow-inner"
                                />
                            </div>

                            {/* Strand Dropdown */}
                            <div className="w-full lg:w-[280px]">
                                <SearchableSelect 
                                    label=""
                                    placeholder="All Strands"
                                    value={strandFilter}
                                    onChange={setStrandFilter}
                                    options={[
                                        { value: 'All', label: 'All Strands' },
                                        ...strands.map(s => ({ value: s, label: s }))
                                    ]}
                                />
                            </div>

                            {/* Position Dropdown */}
                            {activeTab !== 'Applications' && activeTab !== 'Legacy' && (
                                <div className="w-full lg:w-[280px]">
                                    <SearchableSelect 
                                        label=""
                                        placeholder="All Positions"
                                        value={positionFilter}
                                        onChange={setPositionFilter}
                                        options={[
                                            { value: 'All', label: 'All Positions' },
                                            ...tabPositions.map(p => ({ value: p, label: p }))
                                        ]}
                                    />
                                </div>
                            )}

                            {/* View Switcher */}
                            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                                <button 
                                    onClick={() => setViewMode('table')}
                                    className={`p-3 rounded-xl transition-all ${viewMode === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <FiList size={18} />
                                </button>
                                <button 
                                    onClick={() => setViewMode('grid')}
                                    className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <FiGrid size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* MAIN CONTENT AREA */}
                    <AnimatePresence mode="wait">
                        {loading ? (
                            <div className="h-96 flex items-center justify-center">
                                <div className="w-12 h-12 border-4 border-[#004A99]/10 border-t-[#004A99] rounded-full animate-spin"></div>
                            </div>
                        ) : officials.length === 0 ? (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-[3rem] p-20 text-center border-2 border-dashed border-slate-200">
                                <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6"><FiSearch size={40} /></div>
                                <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">No Records Found</h3>
                                <p className="text-slate-400 font-medium mt-2">Adjust your filters or try a different search term.</p>
                            </motion.div>
                        ) : viewMode === 'table' ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-200/50 border border-slate-100">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Official Profile</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Current Position</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Strand / Office</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {(activeTab === 'Applications' ? applications : officials).map((item) => (
                                                <motion.tr key={item.TLOid} whileHover={{ backgroundColor: 'rgba(248, 250, 252, 0.8)' }} className="group transition-colors">
                                                    <td className="px-8 py-6">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-blue-400 font-black text-lg border border-white shadow-sm overflow-hidden">
                                                                {item.photo_binary_id ? (
                                                                    <img src={apiUrl(`/api/binary/${item.photo_binary_id}`)} alt="" className="w-full h-full object-cover" />
                                                                ) : <FiUser size={20} />}
                                                            </div>
                                                            <div>
                                                                <div className="font-black text-slate-800 text-sm leading-none">
                                                                    {item.first_name ? `${item.first_name} ${item.last_name || ''}` : <span className="text-rose-500 italic tracking-widest text-[10px]">VACANT POSITION</span>}
                                                                </div>
                                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-2">
                                                                    <FiArrowRight className="text-blue-500" size={10} />
                                                                    {item.email}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        {activeTab === 'Applications' ? (
                                                            <div>
                                                                <div className="font-black text-[#CE1126] text-[10px] uppercase tracking-tighter italic mb-1">Applying for:</div>
                                                                <div className="font-black text-[#004A99] text-[11px] uppercase tracking-tight">{item.target_position || 'Unspecified'}</div>
                                                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{item.target_office} · {item.target_strand}</div>
                                                            </div>
                                                        ) : (
                                                            <button 
                                                                onClick={() => handlePositionClick(item)}
                                                                className="text-left group/pos hover:translate-x-1 transition-transform"
                                                            >
                                                                <div className="font-black text-[#004A99] text-[11px] uppercase tracking-tight flex items-center gap-2">
                                                                    {item.position_title || 'Unassigned'}
                                                                    <FiClock className="opacity-0 group-hover/pos:opacity-100 transition-opacity text-slate-400" size={12} />
                                                                </div>
                                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                                    Since {item.date_of_assignment ? new Date(item.date_of_assignment).toLocaleDateString() : 'N/A'}
                                                                </div>
                                                            </button>
                                                        )}
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        {activeTab === 'Applications' ? (
                                                            <div>
                                                                <div className="text-xs font-bold text-slate-700">{item.position_title || 'Current Rank'}</div>
                                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{item.office || 'N/A'}</div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="text-xs font-bold text-slate-700">{item.office || 'Main Office'}</div>
                                                                <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">{item.strand || 'No Strand'}</div>
                                                            </>
                                                        )}
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        {activeTab === 'Applications' ? (
                                                            <div className="flex items-center gap-2">
                                                                <button 
                                                                    disabled={processingId === item.TLOid}
                                                                    onClick={() => handleProcessApplication(item.TLOid, 'approve')}
                                                                    className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100 disabled:opacity-50"
                                                                >
                                                                    Approve
                                                                </button>
                                                                <button 
                                                                    disabled={processingId === item.TLOid}
                                                                    onClick={() => handleProcessApplication(item.TLOid, 'reject')}
                                                                    className="px-4 py-2 bg-rose-50 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all border border-rose-100 disabled:opacity-50"
                                                                >
                                                                    Reject
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <StatusBadge status={item.status} />
                                                        )}
                                                    </td>
                                                    <td className="px-8 py-6 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button 
                                                                onClick={() => navigate(`/official-profiling?email=${item.email}`)}
                                                                title="View Profile"
                                                                className="p-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:bg-[#004A99] hover:text-white hover:border-[#004A99] transition-all shadow-sm"
                                                            >
                                                                <FiExternalLink size={18} />
                                                            </button>
                                                            {activeTab !== 'Applications' && item.first_name && (
                                                                <div className="flex gap-2">
                                                                    <button onClick={() => openActionModal(item, 'reassign')} title="Reassign" className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all border border-amber-100 shadow-sm">
                                                                        <FiLayers size={14} /> Reassign
                                                                    </button>
                                                                    <button onClick={() => openActionModal(item, 'vacate')} title="Vacate" className="flex items-center gap-2 px-3 py-2 bg-rose-50 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all border border-rose-100 shadow-sm">
                                                                        <FiTrash2 size={14} /> Vacate
                                                                    </button>
                                                                    <button onClick={() => openActionModal(item, 'succeed')} title="Succeed" className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all border border-emerald-100 shadow-sm">
                                                                        <FiCheckCircle size={14} /> Succeed
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                { (activeTab === 'Applications' ? applications : officials).map((item) => (
                                    <motion.div
                                        key={item.TLOid}
                                        whileHover={{ y: -8 }}
                                        onClick={() => navigate(`/official-profiling?email=${item.email}`)}
                                        className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/40 cursor-pointer group flex flex-col justify-between h-full relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                                        <div>
                                            <div className="flex justify-between items-start mb-6 relative z-10">
                                                <div className="w-20 h-20 rounded-[1.8rem] bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center text-blue-300 font-black text-3xl border-2 border-white shadow-xl overflow-hidden">
                                                    {item.photo_binary_id ? (
                                                        <img src={apiUrl(`/api/binary/${item.photo_binary_id}`)} alt="" className="w-full h-full object-cover" />
                                                    ) : <FiUser size={32} />}
                                                </div>
                                                {activeTab === 'Applications' ? (
                                                    <span className="px-3 py-1 bg-amber-50 text-amber-600 border border-amber-100 rounded-full text-[9px] font-black uppercase tracking-widest">Applied</span>
                                                ) : <StatusBadge status={item.status} />}
                                            </div>
                                            
                                            <div className="space-y-1 relative z-10">
                                                <h3 className="text-2xl font-black text-slate-800 tracking-tighter leading-tight uppercase italic">
                                                    {item.first_name ? <>{item.first_name} <br/> {item.last_name}</> : <span className="text-rose-500 text-lg">VACANT POSITION</span>}
                                                </h3>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handlePositionClick(item); }}
                                                    className="text-[10px] font-black text-[#004A99] uppercase tracking-[0.2em] hover:text-blue-600 transition-colors text-left flex items-center gap-1"
                                                >
                                                    {activeTab === 'Applications' ? (item.target_position || 'Candidate') : (item.position_title || 'Candidate')}
                                                    <FiClock className="text-slate-400" size={10} />
                                                </button>
                                                
                                                {item.concurrent_positions && (
                                                    <div className="mt-3 bg-emerald-50 rounded-2xl p-4 border border-emerald-100 shadow-sm">
                                                        <div className="text-[8px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                                                            Concurrent Role
                                                        </div>
                                                        <div className="text-[10px] font-bold text-emerald-800 leading-snug">
                                                            {item.concurrent_positions.split(' | ').map((pos, idx) => (
                                                                <div key={idx} className="mb-1 last:mb-0">
                                                                    {pos}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="mt-8 pt-6 border-t border-slate-50 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{activeTab === 'Applications' ? 'Current Office' : 'Strand'}</span>
                                                    <span className="text-[10px] font-bold text-slate-700">{activeTab === 'Applications' ? item.office : item.strand || 'N/A'}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{activeTab === 'Applications' ? 'Target Office' : 'Office'}</span>
                                                    <span className="text-[10px] font-bold text-slate-700 truncate ml-4">{activeTab === 'Applications' ? item.target_office : item.office || 'Main Office'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {activeTab === 'Applications' ? (
                                            <div className="mt-8 flex gap-2 relative z-20" onClick={e => e.stopPropagation()}>
                                                <button 
                                                    disabled={processingId === item.TLOid}
                                                    onClick={() => handleProcessApplication(item.TLOid, 'approve')}
                                                    className="flex-1 py-3 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                                                >
                                                    Approve
                                                </button>
                                                <button 
                                                    disabled={processingId === item.TLOid}
                                                    onClick={() => handleProcessApplication(item.TLOid, 'reject')}
                                                    className="flex-1 py-3 bg-white border-2 border-slate-100 text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all disabled:opacity-50"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="mt-8 pt-6 border-t border-slate-50 flex flex-col gap-4 relative z-20" onClick={e => e.stopPropagation()}>
                                                <div className="flex flex-wrap gap-2">
                                                    {item.first_name && (
                                                        <>
                                                            <button onClick={() => openActionModal(item, 'reassign')} className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-600 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all border border-amber-100 shadow-sm">
                                                                <FiLayers size={12} /> Reassign
                                                            </button>
                                                            <button onClick={() => openActionModal(item, 'vacate')} className="flex items-center gap-2 px-3 py-2 bg-rose-50 text-rose-600 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all border border-rose-100 shadow-sm">
                                                                <FiTrash2 size={12} /> Vacate
                                                            </button>
                                                            <button onClick={() => openActionModal(item, 'succeed')} className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all border border-emerald-100 shadow-sm">
                                                                <FiCheckCircle size={12} /> Succeed
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest italic flex items-center gap-2 group-hover:text-blue-600 transition-colors">
                                                        Full Profile <FiArrowRight size={14} />
                                                    </div>
                                                    <button onClick={() => handlePositionClick(item)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all" title="View History">
                                                        <FiClock size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>

                {/* INCUMBENCY HISTORY MODAL */}
                {createPortal(
                    <AnimatePresence>
                        {showIncumbencyModal && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md">
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                className="bg-white rounded-[3rem] w-full max-w-2xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] border border-white/50 overflow-hidden relative"
                            >
                                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-blue-50 to-transparent"></div>
                                
                                <div className="p-10 relative z-10">
                                    <div className="flex justify-between items-start mb-8">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-[0.2em] mb-2">
                                                <FiClock /> Positional History
                                            </div>
                                            <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">{selectedPosition?.title}</h2>
                                            <p className="text-slate-400 font-medium">{selectedPosition?.office || 'Department of Education'}</p>
                                        </div>
                                        <button onClick={() => setShowIncumbencyModal(false)} className="p-3 rounded-2xl bg-white text-slate-400 hover:text-red-600 shadow-sm border border-slate-100 transition-all">
                                            <FiX size={24} />
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3">Last Known Incumbents</h4>
                                        {incumbentsLoading ? (
                                            <div className="h-48 flex items-center justify-center">
                                                <div className="w-8 h-8 border-3 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                                            </div>
                                        ) : incumbents.length === 0 ? (
                                            <div className="py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                                                <FiClock className="mx-auto text-slate-200 mb-4" size={32} />
                                                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">No historical data recorded</p>
                                            </div>
                                        ) : (
                                            <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                {incumbents.map((inc, i) => (
                                                    <div key={i} className="flex items-center justify-between p-5 bg-slate-50/50 rounded-2xl border border-slate-100 group hover:bg-white hover:shadow-lg hover:shadow-blue-900/5 transition-all">
                                                                <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-blue-500/20">
                                                                {inc.first_name ? inc.first_name[0] : 'V'}{inc.last_name ? inc.last_name[0] : ''}
                                                            </div>
                                                            <div>
                                                                <div className="font-black text-slate-800 text-sm italic uppercase">{inc.first_name || 'VACANT'} {inc.last_name || ''}</div>
                                                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Incumbent Tenure ID: {inc.TLOid}</div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-[10px] font-black text-[#CE1126] uppercase tracking-widest leading-none mb-1">Updated</div>
                                                            <div className="text-[9px] font-bold text-slate-400 uppercase">{new Date(inc.tenure_date).toLocaleDateString()}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-10 bg-blue-600 rounded-2xl p-6 text-white flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <FiInfo size={24} className="opacity-50" />
                                            <p className="text-[10px] font-bold uppercase tracking-wide leading-relaxed">This ledger tracks movements based on administrative updates. Promoting or reassigning an official will append a new entry to this history.</p>
                                        </div>
                                        <button 
                                            onClick={() => setShowIncumbencyModal(false)}
                                            className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                        >
                                            Dismiss
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                {/* ADMIN ACTION MODAL */}
                {createPortal(
                    <AnimatePresence>
                        {showActionModal && (
                            <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 30 }}
                                className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl border border-white/50"
                            >
                                <div className="p-10">
                                    <div className="flex justify-between items-start mb-8">
                                        <div>
                                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2 block">Administrative Action</span>
                                            <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">{adminAction}ING OFFICIAL</h2>
                                            <p className="text-slate-400 font-bold mt-2">{actionOfficial?.first_name} {actionOfficial?.last_name}</p>
                                        </div>
                                        <button onClick={() => setShowActionModal(false)} className="p-3 rounded-2xl bg-slate-50 text-slate-400 hover:text-red-600 transition-all">
                                            <FiX size={20} />
                                        </button>
                                    </div>

                                    <div className="space-y-6">
                                        {adminAction === 'reassign' && (
                                            <SearchableSelect 
                                                label="Select Target Vacant Slot"
                                                placeholder="Choose a position..."
                                                value={targetSlot}
                                                onChange={setTargetSlot}
                                                options={vacantSlots.map(v => ({
                                                    value: v.TLOid,
                                                    label: v.position_title,
                                                    sublabel: `${v.office} (${v.strand || 'No Strand'})`
                                                }))}
                                            />
                                        )}

                                        {adminAction === 'succeed' && (
                                            <SearchableSelect 
                                                label="Select Successor"
                                                info="If selected, the successor will take this position and their old slot becomes vacant."
                                                placeholder="No successor (leave vacant)..."
                                                value={successorSlot}
                                                onChange={setSuccessorSlot}
                                                options={[
                                                    { value: '', label: 'No successor', sublabel: 'Position will stay vacant' },
                                                    ...activeOfficials.map(o => ({
                                                        value: o.TLOid,
                                                        label: `${o.first_name} ${o.last_name}`,
                                                        sublabel: `${o.position_title} — ${o.office}`
                                                    }))
                                                ]}
                                            />
                                        )}

                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Justification / Reason</label>
                                            <textarea 
                                                value={justification}
                                                onChange={(e) => setJustification(e.target.value)}
                                                placeholder="Please provide a detailed reason for this action..."
                                                rows={4}
                                                className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-600/20 rounded-2xl py-4 px-5 text-sm font-bold text-slate-700 outline-none transition-all resize-none"
                                            />
                                        </div>

                                        <button 
                                            disabled={actionLoading}
                                            onClick={handleAdminAction}
                                            className="w-full py-5 bg-[#004A99] text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-blue-900/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            {actionLoading ? 'Processing...' : `Confirm ${adminAction}`}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                <footer className="mt-auto p-12 text-center bg-white border-t border-slate-100 flex flex-col items-center gap-6">
                    <img src="https://cdn.worldvectorlogo.com/logos/deped.svg" className="h-8 opacity-40 grayscale" alt="DepEd" />
                    <div className="space-y-1">
                        <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.3em]">© 2026 Department of Education • InsightEd Nexus Portal</p>
                        <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest italic">Strictly for Personnel Division Administrative Use Only</p>
                    </div>
                </footer>
            </div>
        </PageTransition>
    );
};

export default OfficialsRegistry;

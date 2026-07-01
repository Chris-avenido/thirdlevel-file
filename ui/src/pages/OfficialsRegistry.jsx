import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiUsers, FiSearch, FiFilter, FiExternalLink, FiChevronRight, FiChevronDown,
    FiMoreVertical, FiDownload, FiPlus, FiGrid, FiList,
    FiCheckCircle, FiAlertCircle, FiClock, FiActivity, FiArrowRight,
    FiLogOut, FiUser, FiInfo, FiLayers, FiX, FiTrash2, FiRefreshCw, FiCalendar
} from 'react-icons/fi';
import { GoArrowUpRight } from "react-icons/go";
import { FaIdBadge } from "react-icons/fa";
import { LuChefHat } from "react-icons/lu";
import { MdOutlineToggleOff } from "react-icons/md";
import { useAuth } from '../context/AuthContext';
import PageTransition from '../components/PageTransition';
import LoadingScreen from '../components/LoadingScreen';
import AdminSidebar from '../components/AdminSidebar';
import Swal from 'sweetalert2';
import { apiUrl } from '../utils/api';
import { expandAcronym } from '../utils/officialsUtils';
import ModernDatePicker from '../components/ModernDatePicker';
import sgMap from '../utils/sgMap.json';
import newLogo from '../assets/modern_logo.png';
const JustificationInput = ({ value, onChange, placeholder }) => {
    const [local, setLocal] = useState(value);

    useEffect(() => {
        setLocal(value);
    }, [value]);

    return (
        <textarea
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => onChange(local)}
            placeholder={placeholder}
            rows={4}
            className="w-full bg-slate-50 border-2 border-transparent focus:border-[#08315F]/20 rounded-2xl py-4 px-5 text-sm font-bold text-slate-700 outline-none transition-all resize-none"
        />
    );
};

const AddNewPersonnelForm = ({ onCancel, onSuccess, token }) => {
    const [newPersonnelData, setNewPersonnelData] = useState({ first_name: '', last_name: '', email: '', employee_number: '' });
    const [addPersonnelLoading, setAddPersonnelLoading] = useState(false);

    const handleAddPersonnel = async () => {
        setAddPersonnelLoading(true);
        try {
            const res = await fetch(apiUrl('/api/third-level/add-unassigned-personnel'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token || localStorage.getItem('token')}`
                },
                body: JSON.stringify(newPersonnelData)
            });
            const data = await res.json();
            if (data.success) {
                onSuccess(data.newPersonnel.TLOid);
            } else {
                Swal.fire('Error', data.error || 'Failed to add personnel', 'error');
            }
        } catch (err) {
            Swal.fire('Error', 'Failed to add personnel: ' + err.message, 'error');
        } finally {
            setAddPersonnelLoading(false);
        }
    };

    return (
        <div className="space-y-4 bg-slate-50 p-6 rounded-[2rem] border-2 border-[#08315F]/10">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-black text-[#08315F] uppercase tracking-widest">Add New Personnel</h3>
                <button onClick={onCancel} className="text-[10px] font-bold text-slate-400 hover:text-red-500 uppercase tracking-widest transition-colors">Cancel</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">First Name <span className="text-red-500">*</span></label>
                    <input type="text" value={newPersonnelData.first_name} onChange={(e) => setNewPersonnelData({ ...newPersonnelData, first_name: e.target.value })} className="w-full bg-white border-2 border-slate-200 focus:border-[#08315F]/20 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 outline-none transition-all" />
                </div>
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Last Name <span className="text-red-500">*</span></label>
                    <input type="text" value={newPersonnelData.last_name} onChange={(e) => setNewPersonnelData({ ...newPersonnelData, last_name: e.target.value })} className="w-full bg-white border-2 border-slate-200 focus:border-[#08315F]/20 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 outline-none transition-all" />
                </div>
            </div>
            <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Email Address <span className="text-red-500">*</span></label>
                <input type="email" value={newPersonnelData.email} onChange={(e) => setNewPersonnelData({ ...newPersonnelData, email: e.target.value })} className="w-full bg-white border-2 border-slate-200 focus:border-[#08315F]/20 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 outline-none transition-all" />
            </div>
            <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Employee Number</label>
                <input type="text" value={newPersonnelData.employee_number} onChange={(e) => setNewPersonnelData({ ...newPersonnelData, employee_number: e.target.value })} className="w-full bg-white border-2 border-slate-200 focus:border-[#08315F]/20 rounded-xl py-3 px-4 text-xs font-bold text-slate-700 outline-none transition-all" />
            </div>
            <button
                onClick={handleAddPersonnel}
                disabled={addPersonnelLoading || !newPersonnelData.first_name || !newPersonnelData.last_name || !newPersonnelData.email}
                className="w-full mt-2 bg-[#08315F] hover:bg-[#004A99] text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 flex justify-center items-center gap-2"
            >
                {addPersonnelLoading && <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                Save Personnel
            </button>
        </div>
    );
};

const DebouncedSearchInput = ({ value, onChange, placeholder }) => {
    const [local, setLocal] = useState(value);

    useEffect(() => {
        setLocal(value);
    }, [value]);

    useEffect(() => {
        const timer = setTimeout(() => {
            onChange(local);
        }, 300);
        return () => clearTimeout(timer);
    }, [local, onChange]);

    return (
        <input
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-slate-50 border-2 border-transparent focus:border-[#08315F]/20 rounded-2xl py-4 pl-11 pr-5 text-sm font-bold text-slate-700 outline-none transition-all"
        />
    );
};

const THIRD_LEVEL_POSITIONS = [
    'Secretary',
    'Undersecretary',
    'Assistant Secretary',
    'Director IV',
    'Director III',
    'Regional Director',
    'Assistant Regional Director',
    'Schools Division Superintendent',
    'Assistant Schools Division Superintendent',
    'RD',
    'ARD',
    'SDS',
    'ASDS'
];

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
                    className="w-full bg-slate-50 border-2 border-transparent hover:border-[#08315F]/10 cursor-pointer rounded-2xl py-4 px-5 flex justify-between items-center transition-all group"
                >
                    <div className="flex flex-col">
                        <span className={`text-sm font-bold ${selectedOption ? 'text-slate-900' : 'text-slate-400'}`}>
                            {selectedOption ? selectedOption.label : placeholder}
                        </span>
                        {selectedOption?.sublabel && (
                            <span className="text-[10px] text-slate-400 font-bold">{selectedOption.sublabel}</span>
                        )}
                    </div>
                    <FiChevronRight className={`transition-transform duration-300 ${isOpen ? 'rotate-90 text-[#075985]' : 'text-slate-300'}`} size={18} />
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
                                            className="w-full bg-white border-2 border-slate-100 focus:border-[#08315F]/20 rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-slate-700 outline-none transition-all"
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
                                                className={`px-5 py-4 cursor-pointer flex flex-col hover:bg-blue-50 transition-colors ${value === opt.value ? 'bg-blue-50/50 border-l-4 border-[#08315F]' : 'border-l-4 border-transparent'}`}
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
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddingPersonnel, setIsAddingPersonnel] = useState(false);
    const [statusTab, setStatusTab] = useState('All');
    const [activeTab, setActiveTab] = useState('All');
    const [levelFilter, setLevelFilter] = useState('All');
    const [regionFilter, setRegionFilter] = useState('All');
    const [strandFilter, setStrandFilter] = useState('All');
    const [officeFilter, setOfficeFilter] = useState('All');
    const [positionFilter, setPositionFilter] = useState('All');
    const [designationFilter, setDesignationFilter] = useState('All');
    const [viewMode, setViewMode] = useState('table');
    const [strands, setStrands] = useState([]);
    const [offices, setOffices] = useState([]);
    const [tabPositions, setTabPositions] = useState([]); // Positions specifically for the active tab
    const [designations, setDesignations] = useState([]);
    const [sortConfig, setSortConfig] = useState({ key: 'status', direction: 'asc' });
    const [tableFilters, setTableFilters] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const [oicOnly, setOicOnly] = useState(false);
    const [kpiSummary, setKpiSummary] = useState([]);
    const [totalRecords, setTotalRecords] = useState(0);

    // Filter officials on the client side
    const thirdLevelOfficials = useMemo(() => {
        return kpiSummary.filter(o => !o.is_oic && THIRD_LEVEL_POSITIONS.includes(o.position_title));
    }, [kpiSummary]);

    const thirdLevelOic = useMemo(() => {
        return kpiSummary.filter(o => o.is_oic && THIRD_LEVEL_POSITIONS.includes(o.position_title));
    }, [kpiSummary]);

    const divisionChiefsOic = useMemo(() => {
        return kpiSummary.filter(o => o.is_oic && !THIRD_LEVEL_POSITIONS.includes(o.position_title));
    }, [kpiSummary]);

    const divisionChiefs = useMemo(() => {
        return kpiSummary.filter(o => !o.is_oic && !THIRD_LEVEL_POSITIONS.includes(o.position_title));
    }, [kpiSummary]);

    // Active counts for KPI cards (to match Home page logic which only counts Active)
    const thirdLevelActiveCount = useMemo(() => thirdLevelOfficials.filter(o => o.status === 'Active').length, [thirdLevelOfficials]);
    const thirdLevelOicActiveCount = useMemo(() => thirdLevelOic.filter(o => o.status === 'Active').length, [thirdLevelOic]);
    const divisionChiefsOicActiveCount = useMemo(() => divisionChiefsOic.filter(o => o.status === 'Active').length, [divisionChiefsOic]);
    const divisionChiefsActiveCount = useMemo(() => divisionChiefs.filter(o => o.status === 'Active').length, [divisionChiefs]);

    // Position breakdowns for hover cards
    const sortBreakdown = (counts) => {
        const order = [
            'Secretary',
            'Undersecretary',
            'Assistant Sec',
            'Assistant Secretary',
            'Director IV',
            'Director III',
            'Regional Dir',
            'Regional Director',
            'ARD',
            'Assistant Regional Director',
            'SDS',
            'Schools Division Superintendent',
            'ASDS',
            'Assistant Schools Division Superintendent'
        ];

        const getWeight = (pos) => {
            const cleanPos = pos.replace(/^(OIC-?\s*)|(\s*\(OIC\))$/ig, '').trim();
            const index = order.findIndex(p => p.toLowerCase() === cleanPos.toLowerCase());
            if (index !== -1) return index;

            const fallbackIndex = order.findIndex(p => p.toLowerCase() === pos.toLowerCase());
            return fallbackIndex === -1 ? 999 : fallbackIndex;
        };

        return Object.fromEntries(
            Object.entries(counts).sort((a, b) => {
                const weightA = getWeight(a[0]);
                const weightB = getWeight(b[0]);
                if (weightA !== weightB) return weightA - weightB;
                // fallback to count (descending) or alphabetical
                if (b[1] !== a[1]) return b[1] - a[1];
                return a[0].localeCompare(b[0]);
            })
        );
    };

    const thirdLevelBreakdown = useMemo(() => {
        const counts = {};
        thirdLevelOfficials.forEach(o => {
            if (o.status === 'Active' && o.first_name && o.first_name !== 'VACANT') {
                const pos = o.position_title || 'Unassigned';
                counts[pos] = (counts[pos] || 0) + 1;
            }
        });
        return sortBreakdown(counts);
    }, [thirdLevelOfficials]);

    const thirdLevelOicBreakdown = useMemo(() => {
        const counts = {};
        thirdLevelOic.forEach(o => {
            if (o.status === 'Active' && o.first_name && o.first_name !== 'VACANT') {
                const pos = o.position_title || 'Unassigned';
                counts[pos] = (counts[pos] || 0) + 1;
            }
        });
        return sortBreakdown(counts);
    }, [thirdLevelOic]);

    const divisionChiefsBreakdown = useMemo(() => {
        const counts = {};
        divisionChiefsOic.forEach(o => {
            if (o.status === 'Active' && o.first_name && o.first_name !== 'VACANT') {
                const pos = o.position_title || 'Unassigned';
                counts[pos] = (counts[pos] || 0) + 1;
            }
        });
        return sortBreakdown(counts);
    }, [divisionChiefsOic]);

    const divisionChiefsNotOicBreakdown = useMemo(() => {
        const counts = {};
        divisionChiefs.forEach(o => {
            if (o.status === 'Active' && o.first_name && o.first_name !== 'VACANT') {
                const pos = o.position_title || 'Unassigned';
                counts[pos] = (counts[pos] || 0) + 1;
            }
        });
        return sortBreakdown(counts);
    }, [divisionChiefs]);

    const fetchTabPositions = async () => {
        try {
            // Fetch all positions for the current tab to keep the dropdown stable
            const queryParams = new URLSearchParams();

            // Map the frontend tab to backend category
            let backendCategory = 'Third Level';
            if (activeTab === 'Third Level (OIC)' || activeTab === 'Division Chiefs (OIC)') {
                backendCategory = 'OIC / Chiefs';
            } else if (activeTab === 'Division Chiefs') {
                backendCategory = 'Division Chiefs';
            } else if (activeTab === 'All') {
                backendCategory = 'All';
            }
            queryParams.append('category', backendCategory);
            queryParams.append('status', 'Active');
            const res = await fetch(apiUrl(`/api/third-level/officials?${queryParams.toString()}`), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                let filteredData = data.data;
                if (activeTab === 'Third Level (OIC)') {
                    filteredData = data.data.filter(o => THIRD_LEVEL_POSITIONS.includes(o.position_title));
                } else if (activeTab === 'Division Chiefs (OIC)') {
                    filteredData = data.data.filter(o => !THIRD_LEVEL_POSITIONS.includes(o.position_title));
                } else if (activeTab === 'Division Chiefs') {
                    filteredData = data.data.filter(o => !THIRD_LEVEL_POSITIONS.includes(o.position_title));
                }
                let uniquePositions = [...new Set(filteredData.map(o => o.position_title).filter(Boolean))].sort();

                // Remove Vacant Tests from selector
                uniquePositions = uniquePositions.filter(p => !p.toUpperCase().includes('VACANT TEST'));

                setTabPositions(uniquePositions);
            }
        } catch (err) {
            console.error('Failed to fetch tab positions:', err);
        }
    };

    useEffect(() => {
        fetchTabPositions();
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
    const [vacateReason, setVacateReason] = useState('');
    const [effectivityDate, setEffectivityDate] = useState('');
    const [targetSlot, setTargetSlot] = useState('');
    const [vacantSlots, setVacantSlots] = useState([]);
    const [activeOfficials, setActiveOfficials] = useState([]);
    const [unassignedPersonnel, setUnassignedPersonnel] = useState([]);
    const [unassignedSearch, setUnassignedSearch] = useState('');
    const [unassignedLoading, setUnassignedLoading] = useState(false);
    const [assigneeSlot, setAssigneeSlot] = useState('');
    const [successorSlot, setSuccessorSlot] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const unassignedAbortRef = useRef(null);
    const unassignedCacheRef = useRef(new Map());
    const [selectedOffice, setSelectedOffice] = useState('');

    const uniqueOffices = useMemo(() => {
        const offices = vacantSlots.map(slot => slot.office).filter(Boolean);
        return [...new Set(offices)].sort();
    }, [vacantSlots]);

    const filteredVacantSlots = useMemo(() => {
        if (!selectedOffice) return [];
        return vacantSlots.filter(slot => slot.office === selectedOffice);
    }, [vacantSlots, selectedOffice]);

    const ListRowsIcon = () => (
        <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="18" width="18" xmlns="http://www.w3.org/2000/svg">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
    );

    useEffect(() => {
        fetchKpiSummary();
        fetchStrands();
    }, []);

    useEffect(() => {
        fetchOfficials();
    }, [searchTerm, strandFilter, officeFilter, positionFilter, designationFilter, currentPage, activeTab, statusTab, oicOnly, sortConfig, tableFilters, viewMode, levelFilter, regionFilter]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, activeTab, strandFilter, officeFilter, positionFilter, designationFilter, sortConfig, tableFilters, statusTab, oicOnly, viewMode, levelFilter, regionFilter]);

    const fetchStrands = async () => {
        try {
            // Simplified fetch for strands - we can also hardcode or fetch distinct from masterlist
            const res = await fetch(apiUrl('/api/third-level/officials?status=All'), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                let uniqueStrands = [...new Set(data.data.map(o => o.strand).filter(Boolean))].sort();

                // Exclude Regions and Vacant strands
                uniqueStrands = uniqueStrands.filter(s => {
                    const upper = s.toUpperCase();
                    if (upper.includes('VACANT')) return false;
                    if (upper.startsWith('REGION ')) return false;
                    const regions = ['NCR', 'CAR', 'NIR', 'BARMM', 'CARAGA'];
                    if (regions.includes(upper)) return false;
                    return true;
                });

                setStrands(uniqueStrands);
                let uniqueOffices = [...new Set(data.data.map(o => o.office).filter(Boolean))].sort();
                setOffices(uniqueOffices);
                let uniqueDesignations = [...new Set(data.data.map(o => o.designation).filter(Boolean))].sort();
                setDesignations(uniqueDesignations);
            }
        } catch (err) {
            console.error('Failed to fetch strands:', err);
        }
    };


    const fetchKpiSummary = async () => {
        try {
            const res = await fetch(apiUrl('/api/third-level/officials-kpi-summary'), {
                headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success) {
                setKpiSummary(data.data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchOfficials = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            if (searchTerm) queryParams.append('search', searchTerm);
            if (statusTab !== 'All') {
                queryParams.append('status', statusTab === 'Vacant' ? 'Vacated' : statusTab);
            } else {
                queryParams.append('status', 'All');
            }
            if (activeTab !== 'All') queryParams.append('category', activeTab);
            if (strandFilter !== 'All') queryParams.append('strand', strandFilter);
            if (officeFilter !== 'All') queryParams.append('office', officeFilter);
            if (positionFilter !== 'All') queryParams.append('position', positionFilter);
            if (designationFilter !== 'All') queryParams.append('designation', designationFilter);
            if (levelFilter !== 'All') queryParams.append('level', levelFilter);
            if (regionFilter !== 'All') queryParams.append('region', regionFilter);
            if (oicOnly) queryParams.append('is_oic', 'true');
            if (sortConfig.key) {
                queryParams.append('sortColumn', sortConfig.key);
                queryParams.append('sortDirection', sortConfig.direction);
            }
            // Column filters
            Object.keys(tableFilters).forEach(key => {
                if (tableFilters[key]) queryParams.set(key, tableFilters[key]);
            });

            if (viewMode !== 'directory') {
                const pageSize = 20;
                queryParams.append('page', currentPage);
                queryParams.append('limit', pageSize);
            }

            const res = await fetch(apiUrl(`/api/third-level/officials?${queryParams.toString()}`), {
                headers: {
                    'Authorization': `Bearer ${token || localStorage.getItem('token')}`
                }
            });
            const data = await res.json();
            if (data.success) {
                setOfficials(data.data);
                setTotalRecords(data.total);
            }
        } catch (err) {
            console.error('Failed to fetch officials:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!showActionModal) {
            setIsAddingPersonnel(false);
        }
    }, [showActionModal]);

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
            case 'vacated':
            case 'vacant': return 'bg-rose-50 text-rose-600 border-rose-100';
            default: return 'bg-blue-50 text-[#075985] border-blue-100';
        }
    };

    const StatusBadge = ({ status }) => {
        const displayStatus = status === 'Vacated' ? 'Vacant' : status;
        return (
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(displayStatus)}`}>
                {displayStatus || 'Unknown'}
            </span>
        );
    };

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

    const fetchUnassignedPersonnel = async (search = '') => {
        const normalizedSearch = search.trim();
        if (unassignedCacheRef.current.has(normalizedSearch)) {
            setUnassignedPersonnel(unassignedCacheRef.current.get(normalizedSearch));
            return;
        }

        if (unassignedAbortRef.current) {
            unassignedAbortRef.current.abort();
        }

        const controller = new AbortController();
        unassignedAbortRef.current = controller;
        setUnassignedLoading(true);
        try {
            const queryParams = new URLSearchParams();
            queryParams.append('limit', normalizedSearch ? '75' : '50');
            if (normalizedSearch) queryParams.append('search', normalizedSearch);
            const res = await fetch(apiUrl(`/api/third-level/unassigned-personnel?${queryParams.toString()}`), {
                headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` },
                signal: controller.signal
            });
            const data = await res.json();
            if (data.success) {
                unassignedCacheRef.current.set(normalizedSearch, data.data);
                setUnassignedPersonnel(data.data);
            }
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.error('Failed to fetch unassigned personnel:', err);
        } finally {
            if (unassignedAbortRef.current === controller) {
                unassignedAbortRef.current = null;
                setUnassignedLoading(false);
            }
        }
    };



    const handleAdminAction = async () => {
        if (!justification && adminAction !== 'reassign') return Swal.fire('Notice', 'Please provide a justification.', 'info');
        if ((adminAction === 'vacate' || adminAction === 'reassign') && !effectivityDate) return Swal.fire('Notice', 'Please select a Date of Effectivity.', 'info');
        if (adminAction === 'vacate' && !vacateReason) return Swal.fire('Notice', 'Please select a Reason for Vacating.', 'info');

        if (adminAction === 'reassign') {
            const isVacant = !actionOfficial?.first_name || actionOfficial?.first_name === 'VACANT';
            if (isVacant && !assigneeSlot) {
                return Swal.fire('Notice', 'Please select personnel to reassign to this position.', 'info');
            }
            if (!isVacant && !targetSlot) {
                return Swal.fire('Notice', 'Please select a vacant position to reassign this official to.', 'info');
            }
        }

        setActionLoading(true);
        try {
            const personName = `${actionOfficial?.first_name || ''} ${actionOfficial?.last_name || ''}`.trim();
            const positionName = actionOfficial?.position_title || 'position';

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
                    vacateReason: adminAction === 'vacate' ? vacateReason : undefined,
                    effectivityDate,
                    target_TLOid: targetSlot || undefined,
                    successor_TLOid: successorSlot || undefined,
                    assignee_TLOid: assigneeSlot || undefined
                })
            });
            const data = await res.json();
            if (data.success) {
                const isVacant = !actionOfficial?.first_name || actionOfficial?.first_name === 'VACANT';
                const message = adminAction === 'vacate'
                    ? `${personName || 'Official'} has vacated ${positionName}`
                    : adminAction === 'reassign'
                        ? (isVacant ? `Personnel reassigned to ${positionName}` : `${personName || 'Official'} reassigned successfully.`)
                        : `Official ${adminAction}ed successfully.`;
                Swal.fire('Notice', message, 'info');
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

    const handleCancelVacate = async () => {
        const result = await Swal.fire({
            title: 'Cancel Action?',
            text: 'Are you sure you want to cancel this scheduled action and restore the official to Active status?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#08315F',
            cancelButtonColor: '#ef4444',
            confirmButtonText: 'Yes, cancel it!'
        });
        if (!result.isConfirmed) return;
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
                    action: 'cancel-vacate',
                    justification: 'Cancelled scheduled action'
                })
            });
            const data = await res.json();
            if (data.success) {
                Swal.fire('Notice', 'Action cancelled successfully. Official is now Active.', 'info');
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
        setVacateReason('');

        if ((action === 'vacate' && ['Vacating', 'Resigning', 'Inactive'].includes(official.status)) ||
            (action === 'reassign' && ['Reassigning', 'Pending Assignment'].includes(official.status))) {

            if (official.effectivity_date) {
                const d = new Date(official.effectivity_date);
                const offset = d.getTimezoneOffset();
                const localDate = new Date(d.getTime() - (offset * 60 * 1000));
                setEffectivityDate(localDate.toISOString().split('T')[0]);
            }
            try {
                const res = await fetch(apiUrl(`/api/third-level/officials/${official.TLOid}/last-vacate-update`), {
                    headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
                });
                const data = await res.json();
                if (data.success && data.data) {
                    setVacateReason(data.data.vacate_reason || '');
                    setJustification(data.data.remarks || '');
                }
            } catch (err) {
                console.error('Failed to fetch last update:', err);
            }

            if (action === 'reassign') {
                if (official.reassign_target_tloid) {
                    const targetRow = officials.find(o => o.TLOid === official.reassign_target_tloid);
                    if (targetRow) {
                        setSelectedOffice(targetRow.office || 'Main Office');
                    }
                    setTargetSlot(official.reassign_target_tloid);
                }
                if (official.reassign_assignee_tloid) {
                    setAssigneeSlot(official.reassign_assignee_tloid);
                }
            } else {
                setTargetSlot('');
                setAssigneeSlot('');
                setSelectedOffice('');
            }
        } else {
            setEffectivityDate('');
            setTargetSlot('');
            setAssigneeSlot('');
            setSelectedOffice('');
        }
        setSuccessorSlot('');
        setUnassignedSearch('');
        setVacantSlots([]);
        setShowActionModal(true);
        if (action === 'reassign') {
            const isVacant = !official.first_name || official.first_name === 'VACANT';
            if (isVacant) {
                setUnassignedPersonnel(unassignedCacheRef.current.get('') || []);
            } else {
                try {
                    const res = await fetch(apiUrl('/api/third-level/vacancies'), {
                        headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
                    });
                    const data = await res.json();
                    if (data.success) {
                        let fetchedVacancies = data.data;
                        if (official.reassign_target_tloid) {
                            const targetRow = officials.find(o => o.TLOid === official.reassign_target_tloid);
                            if (targetRow && !fetchedVacancies.some(v => v.TLOid === targetRow.TLOid)) {
                                fetchedVacancies.push(targetRow);
                            }
                        }
                        setVacantSlots(fetchedVacancies);
                    }
                } catch (err) {
                    console.error('Failed to fetch vacancies:', err);
                }
            }
        }
        if (action === 'succeed') {
            try {
                const res = await fetch(apiUrl(`/api/third-level/active-officials?exclude_TLOid=${official.TLOid}`), {
                    headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
                });
                const data = await res.json();
                if (data.success) setActiveOfficials(data.data);
            } catch (err) {
                console.error('Failed to fetch active officials:', err);
            }
        }
    };

    useEffect(() => {
        if (!showActionModal || adminAction !== 'reassign') return;
        const isVacant = !actionOfficial?.first_name || actionOfficial?.first_name === 'VACANT';
        if (!isVacant) return;
        const timer = setTimeout(() => fetchUnassignedPersonnel(unassignedSearch), 350);
        return () => clearTimeout(timer);
    }, [unassignedSearch, showActionModal, adminAction, actionOfficial]);

    const getOfficialLevel = (item) => {
        if (item.region) {
            if (item.region === 'Central Office') return 'Central Office';
            const pos = item.position_title || '';
            const office = item.office || '';
            const isROPosition = /(Regional Director|RD|ARD)/i.test(pos);
            const isSDOPosition = /(Schools Division Superintendent|SDS|ASDS)/i.test(pos);
            if (isSDOPosition) return 'Schools Division Office';
            if (isROPosition || office.toLowerCase().includes('regional office') || office.toLowerCase() === 'ro') return 'Regional Office';
            return 'Schools Division Office';
        }

        const strand = item.strand || '';
        const office = item.office || '';
        const pos = item.position_title || '';
        const division = item.division || '';

        const isROPosition = /(Regional Director|RD|ARD)/i.test(pos);
        const isSDOPosition = /(Schools Division Superintendent|SDS|ASDS)/i.test(pos);
        const isROOffice = office.toLowerCase().includes('regional office') || office.toLowerCase() === 'ro' || (strand && office.toLowerCase() === strand.toLowerCase());

        if (isSDOPosition || division) return 'Schools Division Office';
        if (isROPosition || isROOffice) return 'Regional Office';

        const isRegionStrand = /^(Region|NCR|CAR|NIR|BARMM)/i.test(strand);
        if (isRegionStrand) {
            if (!office || office.toLowerCase() === strand.toLowerCase() || office.toLowerCase().includes('regional office') || office.toLowerCase() === 'ro') return 'Regional Office';
            return 'Schools Division Office';
        }

        return 'Central Office';
    };

    const getOfficialRegion = (item) => {
        if (item.region) return item.region;
        const level = getOfficialLevel(item);
        if (level === 'Central Office') return 'Central Office';

        const strand = (item.strand || '').trim().toUpperCase();
        if (strand.includes('REGION XIII') || strand.includes('CARAGA')) return 'CARAGA';

        const knownRegions = [
            'REGION I', 'REGION II', 'REGION III', 'REGION IV-A', 'REGION IV-B',
            'REGION V', 'REGION VI', 'REGION VII', 'REGION VIII', 'REGION IX',
            'REGION X', 'REGION XI', 'REGION XII', 'NCR', 'CAR', 'NIR', 'BARMM'
        ];

        const found = knownRegions.find(r => strand.startsWith(r));
        if (found) {
            // Convert back to proper case for display
            if (found === 'NCR') return 'NCR';
            if (found === 'CAR') return 'CAR';
            if (found === 'NIR') return 'NIR';
            if (found === 'BARMM') return 'BARMM';
            // Title case the Region format
            return found.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
        }

        return 'Unknown Region';
    };

    const isCentralOfficeView = levelFilter === 'Central Office' || regionFilter === 'Central Office' || tableFilters['region'] === 'Central Office';

    const tableColumns = useMemo(() => ([
        {
            key: 'region',
            label: 'Region',
            width: 'w-[10%]',
            value: (item) => getOfficialRegion(item),
            filterValue: (item) => getOfficialRegion(item)
        },
        {
            key: 'division',
            label: isCentralOfficeView ? 'Strand' : 'Division',
            width: 'w-[15%]',
            value: (item) => (item.region || getOfficialRegion(item)) === 'Central Office' ? (item.strand || item.division || item.office || '') : (item.division || item.office || ''),
            filterValue: (item) => (item.region || getOfficialRegion(item)) === 'Central Office' ? (item.strand || item.division || item.office || 'No Division') : (item.division || item.office || 'No Division')
        },
        {
            key: 'name',
            label: 'Official Profile',
            width: 'w-[25%]',
            value: (item) => `${item.first_name || 'VACANT POSITION'} ${item.last_name || ''}`,
            filterValue: (item) => item.first_name ? `${item.first_name} ${item.last_name || ''}`.trim() : 'VACANT POSITION'
        },
        {
            key: 'position_title',
            label: 'Position',
            width: 'w-[22%]',
            value: (item) => item.position_title || '',
            filterValue: (item) => item.position_title || 'Unassigned'
        },
        {
            key: 'designation',
            label: 'Designation',
            width: 'w-[16%]',
            value: (item) => item.designation || '',
            filterValue: (item) => item.designation || 'No Designation'
        },
        {
            key: 'status',
            label: 'Status',
            width: 'w-[12%]',
            value: (item) => item.status === 'Vacated' ? 'Vacant' : (item.status || ''),
            filterValue: (item) => item.status === 'Vacated' ? 'Vacant' : (item.status || 'Unknown')
        }
    ]), [levelFilter, regionFilter, tableFilters]);

    const tableFilterOptions = useMemo(() => {
        return tableColumns.reduce((options, column) => {
            let dataForColumn = kpiSummary;

            if (levelFilter !== 'All') {
                dataForColumn = dataForColumn.filter(item => getOfficialLevel(item) === levelFilter);
            }
            if (regionFilter !== 'All') {
                dataForColumn = dataForColumn.filter(item => getOfficialRegion(item) === regionFilter);
            }
            if (strandFilter !== 'All') {
                dataForColumn = dataForColumn.filter(item => item.strand === strandFilter);
            }
            if (officeFilter !== 'All') {
                dataForColumn = dataForColumn.filter(item => item.office === officeFilter);
            }
            if (designationFilter !== 'All') {
                dataForColumn = dataForColumn.filter(item => item.designation === designationFilter);
            }
            if (positionFilter !== 'All') {
                dataForColumn = dataForColumn.filter(item => item.position_title === positionFilter);
            }
            if (statusTab !== 'All') {
                const targetStatus = statusTab === 'Vacant' ? 'Vacated' : statusTab;
                dataForColumn = dataForColumn.filter(item => item.status === targetStatus);
            }
            if (oicOnly) {
                dataForColumn = dataForColumn.filter(item => item.is_oic);
            }
            if (activeTab !== 'All') {
                if (activeTab === 'Third Level Officials') {
                    dataForColumn = dataForColumn.filter(item => !item.is_oic && THIRD_LEVEL_POSITIONS.includes(item.position_title));
                } else if (activeTab === 'Third Level (OIC)') {
                    dataForColumn = dataForColumn.filter(item => item.is_oic && THIRD_LEVEL_POSITIONS.includes(item.position_title));
                } else if (activeTab === 'Division Chiefs (OIC)') {
                    dataForColumn = dataForColumn.filter(item => item.is_oic && !THIRD_LEVEL_POSITIONS.includes(item.position_title));
                } else if (activeTab === 'Division Chiefs') {
                    dataForColumn = dataForColumn.filter(item => !item.is_oic && !THIRD_LEVEL_POSITIONS.includes(item.position_title));
                }
            }

            Object.keys(tableFilters).forEach(key => {
                if (key !== column.key && tableFilters[key]) {
                    const filterCol = tableColumns.find(c => c.key === key);
                    if (filterCol) {
                        dataForColumn = dataForColumn.filter(item => {
                            const val = (filterCol.filterValue ? filterCol.filterValue(item) : filterCol.value(item))?.trim();
                            return val === tableFilters[key];
                        });
                    }
                }
            });

            const values = dataForColumn
                .map(item => (column.filterValue ? column.filterValue(item) : column.value(item))?.trim())
                .filter(Boolean);
            
            if (column.key === 'division' && isCentralOfficeView) {
                // Ensure all strands are always visible in the dropdown, even if currently empty
                options[column.key] = [...new Set([...values, ...strands])].sort((a, b) => a.localeCompare(b));
            } else {
                options[column.key] = [...new Set(values)].sort((a, b) => a.localeCompare(b));
            }
            
            return options;
        }, {});
    }, [kpiSummary, tableColumns, tableFilters, levelFilter, regionFilter, strandFilter, officeFilter, designationFilter, positionFilter, statusTab, oicOnly, activeTab, strands, isCentralOfficeView]);

    const dependentOffices = useMemo(() => {
        let data = kpiSummary;
        if (regionFilter !== 'All') {
            data = data.filter(item => getOfficialRegion(item) === regionFilter);
        }
        const availableOffices = data.map(item => item.office).filter(Boolean);
        return [...new Set(availableOffices)].sort((a, b) => a.localeCompare(b));
    }, [kpiSummary, regionFilter]);

    useEffect(() => {
        setOfficeFilter('All');
        setStrandFilter('All');
    }, [regionFilter, levelFilter]);



    const directoryGroups = useMemo(() => {
        if (viewMode !== 'directory') return {};
        const groups = {};
        officials.forEach(item => {
            const key = item.office || item.region || 'Unassigned Office';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        // Sort each group's members by Salary Grade (Descending)
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => {
                const cleanPosA = (a.position_title || '').replace(/^(OIC-?\s*)|(\s*\(OIC\))$/ig, '').trim();
                const cleanPosB = (b.position_title || '').replace(/^(OIC-?\s*)|(\s*\(OIC\))$/ig, '').trim();
                const sgA = sgMap[cleanPosA] || sgMap[a.position_title] || 0;
                const sgB = sgMap[cleanPosB] || sgMap[b.position_title] || 0;

                // If SG is the same, sort alphabetically by name
                if (sgB === sgA) {
                    const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim();
                    const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim();
                    return nameA.localeCompare(nameB);
                }

                return sgB - sgA;
            });
        });

        return groups;
    }, [officials, viewMode]);

    const pageSize = 20;
    const pageCount = Math.ceil(totalRecords / pageSize);
    const pagedRecords = officials;
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

    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
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
            <div className="flex h-screen bg-transparent font-sans overflow-hidden">
                <AdminSidebar />
                <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto relative bg-transparent">
                    {/* TOP NAVIGATION BAR */}
                    <div className="dashboard-theme !bg-transparent pt-8 px-8 lg:px-12 max-w-[1600px] mx-auto w-full">
                        <header className="topbar w-full">
                            <div className="page-title">
                                <div className="text-[10px] font-black text-amber-500 uppercase tracking-[0.15em] mb-1">OFFICIAL LEADERSHIP MANAGEMENT</div>
                                <h1>Personnel Registry</h1>
                                <p>Third Level Officials command dashboard</p>
                            </div>
                            <div className="topbar-actions">
                                <div className="hidden md:flex flex-col justify-center items-end bg-white border-2 border-[#BAE6FD] rounded-full px-6 h-[52px] min-w-[170px] shadow-sm">
                                    <span className="text-[14px] font-['Quicksand'] font-black text-[#08315F] leading-none mb-1">{user?.first_name} {user?.last_name}</span>
                                    <span className="text-[9px] font-bold text-amber-600 uppercase tracking-widest leading-none">{user?.role}</span>
                                </div>
                            </div>
                        </header>
                    </div>

                    <main className="flex-1 px-8 pb-8 pt-6 max-w-[1600px] mx-auto w-full dashboard-theme !bg-transparent">
                        {/* FILTERS & SEARCH BAR */}
                        <div className="mb-6 flex flex-col gap-3">
                            <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-2 bg-white border-[2px] border-[#08315F] rounded-[24px] xl:rounded-full p-2 shadow-sm">

                                {/* SEARCH BAR MOVED TO BOTTOM */}                            {/* DROPDOWNS */}
                                <div className="grid grid-cols-2 lg:grid-cols-5 xl:flex xl:flex-[4] gap-2">
                                    {/* Level Dropdown */}
                                    <div className="relative w-full xl:flex-1 h-[38px] bg-[#F0F9FF] border border-[#BAE6FD] rounded-full focus-within:border-sky-400 transition-colors">
                                        <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} title={levelFilter} className="w-full h-full bg-transparent pl-3 pr-6 text-[11px] font-bold text-[#08315F] outline-none appearance-none cursor-pointer text-ellipsis">
                                            <option value="All">All CO / RO / SDO</option>
                                            <option value="Central Office">Central Office</option>
                                            <option value="Regional Office">Regional Office</option>
                                            <option value="Schools Division Office">Schools Division Office</option>
                                        </select>
                                        <FiChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 text-sky-500 pointer-events-none" size={12} />
                                    </div>

                                    {/* Region Dropdown */}
                                    <div className="relative w-full xl:flex-1 h-[38px] bg-[#F0F9FF] border border-[#BAE6FD] rounded-full focus-within:border-sky-400 transition-colors">
                                        <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} title={regionFilter} className="w-full h-full bg-transparent pl-3 pr-6 text-[11px] font-bold text-[#08315F] outline-none appearance-none cursor-pointer text-ellipsis">
                                            <option value="All">All Regions</option>
                                            <option value="Central Office">Central Office</option>
                                            <option value="Region I">Region I</option>
                                            <option value="Region II">Region II</option>
                                            <option value="Region III">Region III</option>
                                            <option value="Region IV-A">Region IV-A</option>
                                            <option value="Region IV-B">Region IV-B</option>
                                            <option value="Region V">Region V</option>
                                            <option value="Region VI">Region VI</option>
                                            <option value="Region VII">Region VII</option>
                                            <option value="Region VIII">Region VIII</option>
                                            <option value="Region IX">Region IX</option>
                                            <option value="Region X">Region X</option>
                                            <option value="Region XI">Region XI</option>
                                            <option value="Region XII">Region XII</option>
                                            <option value="CARAGA">CARAGA</option>
                                            <option value="NCR">NCR</option>
                                            <option value="CAR">CAR</option>
                                            <option value="NIR">NIR</option>
                                            <option value="BARMM">BARMM</option>
                                        </select>
                                        <FiChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 text-sky-500 pointer-events-none" size={12} />
                                    </div>

                                    {/* Strand / Division Dropdown */}
                                    {levelFilter === 'Central Office' || regionFilter === 'Central Office' ? (
                                        <div className="relative w-full xl:flex-1 h-[38px] bg-[#F0F9FF] border border-[#BAE6FD] rounded-full focus-within:border-sky-400 transition-colors">
                                            <select value={strandFilter} onChange={(e) => setStrandFilter(e.target.value)} title={strandFilter === 'All' ? 'All Strands' : strandFilter} className="w-full h-full bg-transparent pl-3 pr-6 text-[11px] font-bold text-[#08315F] outline-none appearance-none cursor-pointer text-ellipsis">
                                                <option value="All">All Strands</option>
                                                {strands.map(s => (
                                                    <option key={s} value={s}>{s}</option>
                                                ))}
                                            </select>
                                            <FiChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 text-sky-500 pointer-events-none" size={12} />
                                        </div>
                                    ) : (
                                        <div className="relative w-full xl:flex-1 h-[38px] bg-[#F0F9FF] border border-[#BAE6FD] rounded-full focus-within:border-sky-400 transition-colors">
                                            <select value={officeFilter} onChange={(e) => setOfficeFilter(e.target.value)} title={officeFilter === 'All' ? 'All Divisions' : officeFilter} className="w-full h-full bg-transparent pl-3 pr-6 text-[11px] font-bold text-[#08315F] outline-none appearance-none cursor-pointer text-ellipsis">
                                                <option value="All">All Divisions</option>
                                                {dependentOffices.map(o => (
                                                    <option key={o} value={o}>{o}</option>
                                                ))}
                                            </select>
                                            <FiChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 text-sky-500 pointer-events-none" size={12} />
                                        </div>
                                    )}

                                    {/* Designation Dropdown */}
                                    <div className="relative w-full xl:flex-1 h-[38px] bg-[#F0F9FF] border border-[#BAE6FD] rounded-full focus-within:border-sky-400 transition-colors">
                                        <select value={designationFilter} onChange={(e) => setDesignationFilter(e.target.value)} title={designationFilter === 'All' ? 'All Designations' : expandAcronym(designationFilter)} className="w-full h-full bg-transparent pl-3 pr-6 text-[11px] font-bold text-[#08315F] outline-none appearance-none cursor-pointer text-ellipsis">
                                            <option value="All">All Designations</option>
                                            {designations.map(d => (
                                                <option key={d} value={d}>{expandAcronym(d)}</option>
                                            ))}
                                        </select>
                                        <FiChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 text-sky-500 pointer-events-none" size={12} />
                                    </div>

                                    {/* Position Dropdown */}
                                    <div className="relative w-full xl:flex-1 h-[38px] bg-[#F0F9FF] border border-[#BAE6FD] rounded-full focus-within:border-sky-400 transition-colors">
                                        <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)} title={positionFilter} className="w-full h-full bg-transparent pl-3 pr-6 text-[11px] font-bold text-[#08315F] outline-none appearance-none cursor-pointer text-ellipsis">
                                            <option value="All">All Positions</option>
                                            {tabPositions.map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                        <FiChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 text-sky-500 pointer-events-none" size={12} />
                                    </div>

                                </div>

                                {/* BUTTONS */}
                                <div className="flex items-center gap-2 w-full xl:w-auto">
                                    {/* OIC Toggle */}
                                    <button
                                        onClick={() => setOicOnly(!oicOnly)}
                                        className={`h-[38px] px-4 flex-1 xl:flex-none rounded-full transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 border ${oicOnly ? 'bg-[#08315F] border-[#08315F]' : 'bg-[#F0F9FF] border-[#BAE6FD] hover:bg-sky-100'}`}
                                        title="Toggle OIC only"
                                    >
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${oicOnly ? 'text-white' : 'text-[#08315F]'}`}>OIC ONLY</span>
                                        <div className={`w-8 h-4 rounded-full relative transition-colors shrink-0 ${oicOnly ? 'bg-amber-400' : 'bg-slate-300'}`}>
                                            <div className={`absolute top-[2px] left-[2px] w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-300 ${oicOnly ? 'translate-x-[16px]' : 'translate-x-0'}`} />
                                        </div>
                                    </button>

                                    {/* Reset Filters */}
                                    <button
                                        onClick={() => {
                                            setSearchTerm('');
                                            setTableFilters({});
                                            setStatusTab('All');
                                            setActiveTab('All');
                                            setLevelFilter('All');
                                            setRegionFilter('All');
                                            setStrandFilter('All');
                                            setOfficeFilter('All');
                                            setPositionFilter('All');
                                            setDesignationFilter('All');
                                            setOicOnly(false);
                                        }}
                                        className="h-[38px] px-5 flex-1 xl:flex-none bg-transparent text-rose-400 rounded-full border border-rose-200 font-black text-[10px] tracking-widest uppercase hover:bg-rose-50 hover:text-rose-600 transition-colors flex items-center justify-center whitespace-nowrap shrink-0"
                                        title="Reset all filters"
                                    >
                                        Reset
                                    </button>
                                </div>


                            </div>

                            {/* BOTTOM ROW: SEARCH BAR */}
                            <div className="flex items-center gap-2 bg-white border-[2px] border-[#08315F] rounded-[24px] xl:rounded-full p-1.5 shadow-sm w-full mb-6">
                                <div className="relative flex-1 h-[38px]">
                                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#08315F]/50" size={14} />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Search by name, position, or office..."
                                        className="w-full h-full bg-[#F0F9FF] border border-[#BAE6FD] rounded-full py-0 pl-10 pr-4 text-[11px] font-bold text-[#08315F] outline-none focus:border-sky-400 placeholder:text-[#08315F]/50 transition-colors"
                                    />
                                </div>
                                {/* VIEW TOGGLES */}
                                <div className="flex items-center gap-2 shrink-0 px-2">
                                    <button
                                        onClick={() => setViewMode('table')}
                                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${viewMode === 'table' ? 'bg-[#08315F] text-white border-b-[3px] border-[#FBBF24] shadow-sm transform -translate-y-[1px]' : 'bg-[#E0F2FE] text-[#08315F] hover:bg-[#BAE6FD]'}`}
                                        title="Table view"
                                    >
                                        <FiList size={14} />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('grid')}
                                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${viewMode === 'grid' ? 'bg-[#08315F] text-white border-b-[3px] border-[#FBBF24] shadow-sm transform -translate-y-[1px]' : 'bg-[#E0F2FE] text-[#08315F] hover:bg-[#BAE6FD]'}`}
                                    >
                                        <FiGrid size={14} />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('directory')}
                                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${viewMode === 'directory' ? 'bg-[#08315F] text-white border-b-[3px] border-[#FBBF24] shadow-sm transform -translate-y-[1px]' : 'bg-[#E0F2FE] text-[#08315F] hover:bg-[#BAE6FD]'}`}
                                        title="Organizational Directory"
                                    >
                                        <FiLayers size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* STATS CARDS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 w-full">
                            {/* Card 1: Third Level Officials */}
                            <div
                                onClick={() => { setActiveTab(prev => prev === 'Third Level Officials' ? 'All' : 'Third Level Officials'); setPositionFilter('All'); setStrandFilter('All'); setOfficeFilter('All'); setLevelFilter('All'); setRegionFilter('All'); }}
                                className={`min-h-[100px] p-5 bg-white rounded-[16px] border border-[#BAE6FD] border-l-[6px] overflow-hidden cursor-pointer transition-all flex flex-col justify-between ${activeTab === 'Third Level Officials' ? 'border-l-sky-400 shadow-md ring-1 ring-sky-200' : 'border-l-sky-300 hover:shadow-sm'}`}
                            >
                                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-3">Third Level Officials</div>
                                <div className="text-[32px] text-[#08315F] font-normal leading-none mb-3">{thirdLevelActiveCount}</div>
                                <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold leading-none">Sum of active in view</div>
                            </div>

                            {/* Card 2: Third Level (OIC) */}
                            <div
                                onClick={() => { setActiveTab(prev => prev === 'Third Level (OIC)' ? 'All' : 'Third Level (OIC)'); setPositionFilter('All'); setStrandFilter('All'); setOfficeFilter('All'); setLevelFilter('All'); setRegionFilter('All'); }}
                                className={`min-h-[100px] p-5 bg-white rounded-[16px] border border-[#BAE6FD] border-l-[6px] overflow-hidden cursor-pointer transition-all flex flex-col justify-between ${activeTab === 'Third Level (OIC)' ? 'border-l-amber-500 shadow-md ring-1 ring-amber-200' : 'border-l-amber-400 hover:shadow-sm'}`}
                            >
                                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-3">Third Level (OIC)</div>
                                <div className="text-[32px] text-[#08315F] font-normal leading-none mb-3">{thirdLevelOicActiveCount}</div>
                                <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold leading-none">Sum of active in view</div>
                            </div>

                            {/* Card 3: Division Chiefs (OIC) */}
                            <div
                                onClick={() => { setActiveTab(prev => prev === 'Division Chiefs (OIC)' ? 'All' : 'Division Chiefs (OIC)'); setPositionFilter('All'); setStrandFilter('All'); setOfficeFilter('All'); setLevelFilter('All'); setRegionFilter('All'); }}
                                className={`min-h-[100px] p-5 bg-white rounded-[16px] border border-[#BAE6FD] border-l-[6px] overflow-hidden cursor-pointer transition-all flex flex-col justify-between ${activeTab === 'Division Chiefs (OIC)' ? 'border-l-purple-500 shadow-md ring-1 ring-purple-200' : 'border-l-purple-400 hover:shadow-sm'}`}
                            >
                                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-3">Division Chiefs (OIC)</div>
                                <div className="text-[32px] text-[#08315F] font-normal leading-none mb-3">{divisionChiefsOicActiveCount}</div>
                                <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold leading-none">Sum of active in view</div>
                            </div>

                            {/* Card 4: Division Chiefs */}
                            <div
                                onClick={() => { setActiveTab(prev => prev === 'Division Chiefs' ? 'All' : 'Division Chiefs'); setPositionFilter('All'); setStrandFilter('All'); setOfficeFilter('All'); setLevelFilter('All'); setRegionFilter('All'); }}
                                className={`min-h-[100px] p-5 bg-white rounded-[16px] border border-[#BAE6FD] border-l-[6px] overflow-hidden cursor-pointer transition-all flex flex-col justify-between ${activeTab === 'Division Chiefs' ? 'border-l-red-500 shadow-md ring-1 ring-red-200' : 'border-l-red-400 hover:shadow-sm'}`}
                            >
                                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-3">Division Chiefs</div>
                                <div className="text-[32px] text-[#08315F] font-normal leading-none mb-3">{divisionChiefsActiveCount}</div>
                                <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold leading-none">Sum of active in view</div>
                            </div>
                        </div>

                        {/* MAIN CONTENT AREA */}

                        <AnimatePresence mode="wait">
                            {loading ? (
                                <div className="h-96 flex items-center justify-center">
                                    <div className="w-12 h-12 border-4 border-[var(--navy)]/10 border-t-[var(--navy)] rounded-full animate-spin"></div>
                                </div>
                            ) : officials.length === 0 ? (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-20 text-center">
                                    <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6"><FiSearch size={40} /></div>
                                    <h3 className="text-xl font-[var(--font-heading)] font-black text-[var(--navy)] uppercase italic tracking-tight">No Records Found</h3>
                                    <p className="text-slate-400 font-medium mt-2">Adjust your filters or try a different search term.</p>
                                </motion.div>
                            ) : viewMode === 'table' ? (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card !rounded-[30px] !border-[2.5px] !border-[#08315F] overflow-hidden">
                                    <div className="w-full">
                                        <table className="hidden md:table w-full text-left border-collapse table-fixed">
                                            <thead>
                                                <tr className="bg-white border-b border-slate-200">
                                                    {tableColumns.map((column, index) => (
                                                        <th key={column.key} className={`px-2 py-4 text-left align-top relative ${column.width || ''}`}>

                                                            <div className="flex flex-col gap-3 mt-1 pr-4">
                                                                <button
                                                                    onClick={() => handleSort(column.key)}
                                                                    className="flex items-center justify-between h-5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors w-full text-left group"
                                                                >
                                                                    <span>{column.label}</span>
                                                                    <span className={`text-sm leading-none flex items-center w-3 justify-end transition-colors ${sortConfig.key === column.key ? 'text-[#08315F]' : 'text-slate-200 group-hover:text-slate-400'}`}>
                                                                        {sortConfig.key === column.key
                                                                            ? (sortConfig.direction === 'asc' ? '↑' : '↓')
                                                                            : '↓'}
                                                                    </span>
                                                                </button>
                                                                <select
                                                                    value={tableFilters[column.key] || ''}
                                                                    onChange={(e) => setTableFilters(current => ({ ...current, [column.key]: e.target.value }))}
                                                                    className="w-full bg-white border border-sky-200 rounded-lg px-3 py-1.5 text-[11px] font-bold text-[#08315F] outline-none focus:border-sky-400 transition-colors"
                                                                >
                                                                    <option value="">All</option>
                                                                    {(tableFilterOptions[column.key] || []).map(option => (
                                                                        <option key={option} value={option}>{option}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </th>
                                                    ))}

                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200/60 bg-white">
                                                {pagedRecords.map((item) => (
                                                    <tr key={item.TLOid} className="group transition-colors relative hover:bg-slate-50/80">
                                                        <td className="px-3 py-4 align-middle max-w-[120px]">
                                                            <div className="font-black text-[#08315F] text-[10px] uppercase tracking-tight truncate" title={item.status === 'Inactive' ? 'N/A' : (item.region || 'N/A')}>
                                                                <span>{item.status === 'Inactive' ? 'N/A' : (item.region || 'N/A')}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-4 align-middle max-w-[200px]">
                                                            <div className="text-[10px] font-bold text-slate-700 uppercase tracking-widest truncate" title={item.status === 'Inactive' ? 'N/A' : ((item.region || getOfficialRegion(item)) === 'Central Office' ? (item.strand || item.division || 'N/A') : (item.division || 'N/A'))}>
                                                                {item.status === 'Inactive' ? 'N/A' : ((item.region || getOfficialRegion(item)) === 'Central Office' ? (item.strand || item.division || 'N/A') : (item.division || 'N/A'))}
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-4 align-middle">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-blue-400 font-black text-sm border border-white shadow-sm overflow-hidden shrink-0">
                                                                    {item.photo_binary_id ? (
                                                                        <img src={apiUrl(`/api/binary/${item.photo_binary_id}`)} alt="" className="w-full h-full object-cover" />
                                                                    ) : <FiUser size={14} />}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div
                                                                        onClick={() => item.email && navigate(`/official-profiling?email=${item.email}`)}
                                                                        className={`font-['Quicksand'] font-black text-[#08315F] text-sm leading-none transition-colors truncate ${item.email ? 'cursor-pointer hover:text-blue-600 hover:underline' : ''}`}
                                                                        title={item.email ? "View Official Profile" : ""}
                                                                    >
                                                                        {item.first_name ? `${item.first_name} ${item.last_name || ''}` : <span className="text-rose-500 italic tracking-widest text-[10px]">VACANT POSITION</span>}
                                                                    </div>
                                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1.5 truncate">
                                                                        <FiArrowRight className="text-[#075985] shrink-0" size={8} />
                                                                        <span className="truncate">{item.email}</span>
                                                                        {item.status !== 'Inactive' && item.effectivity_date && (
                                                                            <>
                                                                                <span className="mx-1">•</span>
                                                                                <FiCalendar className="text-slate-300 shrink-0" size={8} />
                                                                                {(() => {
                                                                                    const effDate = new Date(item.effectivity_date);
                                                                                    if (isNaN(effDate.getTime())) return <span className="text-slate-400">Invalid</span>;

                                                                                    const today = new Date();
                                                                                    effDate.setHours(0, 0, 0, 0);
                                                                                    today.setHours(0, 0, 0, 0);

                                                                                    const diffTime = today.getTime() - effDate.getTime();
                                                                                    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                                                                                    if (item.status === 'Resigning' || item.status === 'Vacated') {
                                                                                        return <span className="text-rose-500">Vacated {days >= 0 ? `${days}d ago` : `in ${Math.abs(days)}d`}</span>;
                                                                                    }
                                                                                    return <span className={days >= 0 ? 'text-emerald-600' : 'text-blue-500'}>
                                                                                        {days >= 0 ? `${days}d in Pos` : `Starts in ${Math.abs(days)}d`}
                                                                                    </span>;
                                                                                })()}
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-1 py-4 align-middle max-w-[220px]">
                                                            <div
                                                                onClick={() => handlePositionClick(item)}
                                                                title={item.status === 'Inactive' ? 'N/A' : (item.position_title || 'Unassigned')}
                                                                className="flex w-fit max-w-full items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50/80 border border-amber-300 text-amber-600 text-[9px] font-black uppercase tracking-widest shadow-sm cursor-pointer hover:bg-amber-100 hover:border-amber-400 transition-colors"
                                                            >
                                                                <span className="truncate">{item.status === 'Inactive' ? 'N/A' : (item.position_title || 'Unassigned')}</span>
                                                                {item.status !== 'Inactive' && item.is_oic && <span className="px-1.5 py-0.5 rounded-full bg-[#FCD116] text-[#0038A8] text-[8px] font-black uppercase tracking-widest shrink-0">OIC</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-1 py-4 align-middle max-w-[150px]">
                                                            <div
                                                                onClick={() => handlePositionClick(item)}
                                                                title={item.status === 'Inactive' ? 'N/A' : (expandAcronym(item.designation) || 'No Designation')}
                                                                className="text-[10px] font-black text-[#08315F] uppercase tracking-widest truncate cursor-pointer hover:text-blue-600 hover:underline transition-colors w-full"
                                                            >
                                                                {item.status === 'Inactive' ? 'N/A' : (expandAcronym(item.designation) || 'No Designation')}
                                                            </div>
                                                        </td>
                                                        <td className="px-1 py-4 align-middle static md:relative">
                                                            <StatusBadge status={item.status} />

                                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 z-10 bg-white/90 backdrop-blur-md p-1.5 rounded-xl shadow-sm border border-slate-200 pointer-events-none group-hover:pointer-events-auto">
                                                                {item.status !== 'Inactive' && user?.role === 'Central Office' && (
                                                                    <button onClick={() => openActionModal(item, 'reassign')} title="Reassign" className="flex items-center justify-center gap-1 px-2 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all border border-amber-100 shadow-sm shrink-0">
                                                                        <FiLayers size={12} />
                                                                    </button>
                                                                )}
                                                                {item.first_name && item.status !== 'Reassigning' && item.status !== 'Pending Assignment' && user?.role === 'Central Office' && (
                                                                    <button onClick={() => openActionModal(item, 'vacate')} title="Vacate" className="flex items-center justify-center gap-1 px-2 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all border border-rose-100 shadow-sm shrink-0">
                                                                        <FiTrash2 size={12} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        {/* MOBILE CARD VIEW */}
                                        <div className="md:hidden flex flex-col divide-y divide-slate-100">
                                            {pagedRecords.map((item) => (
                                                <div key={item.TLOid} className="p-4 bg-white hover:bg-slate-50/50 transition-colors flex flex-col gap-3">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-blue-400 font-black text-sm border border-white shadow-sm overflow-hidden shrink-0">
                                                                {item.photo_binary_id ? (
                                                                    <img src={apiUrl(`/api/binary/${item.photo_binary_id}`)} alt="" className="w-full h-full object-cover" />
                                                                ) : <FiUser size={16} />}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div onClick={() => item.email && navigate(`/official-profiling?email=${item.email}`)} className="font-['Quicksand'] font-black text-[#08315F] text-sm leading-none transition-colors truncate">
                                                                    {item.first_name ? `${item.first_name} ${item.last_name || ''}` : <span className="text-rose-500 italic tracking-widest text-[10px]">VACANT POSITION</span>}
                                                                </div>
                                                                <div className="text-[10px] font-bold text-slate-400 mt-1 truncate">{item.email || 'No Email'}</div>
                                                            </div>
                                                        </div>
                                                        <div className="shrink-0"><StatusBadge status={item.status} /></div>
                                                    </div>

                                                    <div className="flex flex-col gap-2 mt-1 bg-slate-50/50 rounded-xl p-3 border border-slate-100">
                                                        <div className="flex justify-between items-center text-[10px] gap-2">
                                                            <span className="font-black text-slate-400 uppercase tracking-widest shrink-0">{((item.region || getOfficialRegion(item)) === 'Central Office') ? 'Strand' : 'Office'}</span>
                                                            <span className="font-black text-[#08315F] text-right truncate max-w-[65%]">
                                                                {(item.region) ? `${item.region} • ` : 'N/A • '}{((item.region || getOfficialRegion(item)) === 'Central Office' ? item.strand : item.division) || 'N/A'}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-[10px] gap-2">
                                                            <span className="font-black text-slate-400 uppercase tracking-widest shrink-0">Position</span>
                                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50/80 border border-amber-300 text-amber-600 font-black uppercase tracking-widest shrink-0 max-w-[65%] truncate">
                                                                <span className="truncate">{item.status === 'Inactive' ? 'N/A' : (item.position_title || 'Unassigned')}</span>
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-[10px] gap-2">
                                                            <span className="font-black text-slate-400 uppercase tracking-widest shrink-0">Designation</span>
                                                            <span className="font-black text-[#08315F] text-right truncate max-w-[65%]">{expandAcronym(item.designation) || 'No Designation'}</span>
                                                        </div>
                                                    </div>

                                                    {item.status !== 'Inactive' && user?.role === 'Central Office' && (
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <button onClick={() => openActionModal(item, 'reassign')} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-amber-100 hover:bg-amber-500 hover:text-white transition-all">
                                                                <FiLayers size={12} /> Reassign
                                                            </button>
                                                            {item.first_name && item.status !== 'Reassigning' && item.status !== 'Pending Assignment' && (
                                                                <button onClick={() => openActionModal(item, 'vacate')} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-rose-100 hover:bg-rose-500 hover:text-white transition-all">
                                                                    <FiTrash2 size={12} /> Vacate
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="px-8 py-5 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Showing {totalRecords === 0 ? 0 : ((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} records
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="px-4 py-2 bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40">Previous</button>
                                            {pageButtons.map(page => typeof page === 'number' ? (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`w-9 h-9 rounded-xl text-[10px] font-black border transition-all ${currentPage === page ? 'bg-[#08315F] text-white border-[#004A99]' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-200'}`}
                                                >
                                                    {page}
                                                </button>
                                            ) : (
                                                <span key={page} className="px-1 text-[10px] font-black text-slate-300">...</span>
                                            ))}
                                            <span className="px-2 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Page {currentPage} of {pageCount}</span>
                                            <button disabled={currentPage === pageCount} onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))} className="px-4 py-2 bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40">Next</button>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : viewMode === 'grid' ? (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                        {pagedRecords.map((item) => (
                                            <motion.div
                                                key={item.TLOid}
                                                whileHover={{ y: -4 }}
                                                onClick={() => item.email && navigate(`/official-profiling?email=${item.email}`)}
                                                className={`bg-white rounded-[1.5rem] p-5 border border-[#08315F] shadow-lg shadow-slate-200/40 group flex flex-col justify-between h-full relative overflow-hidden ${item.email ? 'cursor-pointer' : 'cursor-default'}`}
                                            >
                                                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/30 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                                                <div>
                                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                                        <div className="w-12 h-12 rounded-[1rem] bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center text-blue-300 font-black text-xl border-2 border-white shadow-md overflow-hidden shrink-0">
                                                            {item.photo_binary_id ? (
                                                                <img src={apiUrl(`/api/binary/${item.photo_binary_id}`)} alt="" className="w-full h-full object-cover" />
                                                            ) : <FiUser size={20} />}
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            {item.is_oic && <span className="px-2 py-0.5 bg-[#FCD116] text-[#0038A8] border border-yellow-200 rounded-full text-[7px] font-black uppercase tracking-widest">OIC</span>}
                                                            <div className="scale-75 origin-top-right">
                                                                <StatusBadge status={item.status} />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1 relative z-10">
                                                        <h3 className="text-sm font-['Quicksand'] font-black text-[#08315F] tracking-tighter leading-tight uppercase italic line-clamp-2">
                                                            {item.first_name ? <>{item.first_name} {item.last_name}</> : <span className="text-rose-500">VACANT POSITION</span>}
                                                        </h3>
                                                        {item.status !== 'Inactive' && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handlePositionClick(item); }}
                                                                className="text-[8px] font-black text-[#08315F] uppercase tracking-[0.2em] hover:text-[#075985] transition-colors text-left flex items-center gap-1 w-full"
                                                                title="Positional History"
                                                            >
                                                                <span className="truncate">{item.position_title || 'Candidate'}</span>
                                                                <FiClock className="text-slate-400 shrink-0" size={8} />
                                                            </button>
                                                        )}

                                                        {item.concurrent_positions && (
                                                            <div className="mt-2 bg-emerald-50 rounded-xl p-2.5 border border-emerald-100 shadow-sm">
                                                                <div className="text-[6px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-1 flex items-center gap-1">
                                                                    <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></div>
                                                                    Concurrent Role
                                                                </div>
                                                                <div className="text-[8px] font-bold text-emerald-800 leading-snug line-clamp-2">
                                                                    {item.concurrent_positions.split(' | ').map((pos, idx) => (
                                                                        <div key={idx} className="mb-0.5 last:mb-0 truncate">
                                                                            {pos}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="mt-4 pt-3 border-t border-slate-50 space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Strand</span>
                                                            <span className="text-[8px] font-bold text-slate-700 truncate max-w-[60%] text-right">{item.status === 'Inactive' ? 'N/A' : (item.strand || 'N/A')}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Office</span>
                                                            <span className="text-[8px] font-bold text-slate-700 truncate ml-2 text-right">{item.status === 'Inactive' ? 'N/A' : (item.office || 'Main Office')}</span>
                                                        </div>
                                                        {item.updated_at && (
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Updated</span>
                                                                <span className="text-[8px] font-bold text-slate-700 truncate ml-2 text-right">
                                                                    {new Date(item.updated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mt-4 pt-3 border-t border-slate-50 flex flex-col gap-3 relative z-20" onClick={e => e.stopPropagation()}>
                                                    <div className="flex flex-wrap justify-center gap-1.5">
                                                        {item.status !== 'Inactive' && user?.role === 'Central Office' && (
                                                            <button onClick={() => openActionModal(item, 'reassign')} className="flex items-center gap-1 px-2 py-1.5 bg-amber-50 text-amber-600 rounded-md text-[7px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all border border-amber-100 shadow-sm">
                                                                <FiLayers size={10} /> Reassign
                                                            </button>
                                                        )}
                                                        {item.first_name && item.status !== 'Reassigning' && item.status !== 'Pending Assignment' && user?.role === 'Central Office' && (
                                                            <button onClick={() => openActionModal(item, 'vacate')} className="flex items-center gap-1 px-2 py-1.5 bg-rose-50 text-rose-600 rounded-md text-[7px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all border border-rose-100 shadow-sm">
                                                                <FiTrash2 size={10} /> Vacate
                                                            </button>
                                                        )}
                                                    </div>
                                                    {item.status !== 'Inactive' && (
                                                        <div className="flex items-center justify-between">
                                                            <div className="text-[7px] font-black text-slate-300 uppercase tracking-widest italic flex items-center gap-1 group-hover:text-[#075985] transition-colors">
                                                                Full Profile <FiArrowRight size={10} />
                                                            </div>
                                                            <button onClick={() => handlePositionClick(item)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-[#08315F] hover:text-white transition-all" title="Positional History">
                                                                <FiClock size={12} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                    <div className="px-8 py-5 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Showing {totalRecords === 0 ? 0 : ((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} records
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="px-4 py-2 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40">Previous</button>
                                            {pageButtons.map(page => typeof page === 'number' ? (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`w-9 h-9 rounded-xl text-[10px] font-black border transition-all ${currentPage === page ? 'bg-[#08315F] text-white border-[#004A99]' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-200'}`}
                                                >
                                                    {page}
                                                </button>
                                            ) : (
                                                <span key={page} className="px-1 text-[10px] font-black text-slate-300">...</span>
                                            ))}
                                            <span className="px-2 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Page {currentPage} of {pageCount}</span>
                                            <button disabled={currentPage === pageCount} onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))} className="px-4 py-2 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40">Next</button>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
                                    {Object.entries(directoryGroups).map(([groupName, members]) => (
                                        <div key={groupName} className="bg-slate-50/50 p-8 rounded-[3rem] border border-slate-200">
                                            <h3 className="text-center font-black text-2xl text-[#08315F] tracking-tighter mb-8 uppercase">{groupName}</h3>

                                            <div className="flex flex-wrap justify-center gap-6">
                                                {members.map(item => (
                                                    <div key={item.TLOid} className="bg-white border-2 border-slate-200 rounded-3xl p-6 w-[280px] flex flex-col items-center text-center relative shadow-xl shadow-slate-200/50 hover:border-[#075985] transition-colors cursor-pointer" onClick={() => item.email && navigate(`/official-profiling?email=${item.email}`)}>
                                                        <div className="absolute -top-4 bg-[#075985] text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-md w-[90%] truncate">
                                                            {item.position_title || 'Position Unknown'}
                                                        </div>
                                                        <div className="mt-4 font-black text-lg text-slate-800 leading-tight uppercase italic min-h-[50px] flex items-center justify-center">
                                                            {item.first_name ? `${item.first_name} ${item.last_name}` : <span className="text-rose-500 not-italic">VACANT</span>}
                                                        </div>
                                                        <div className="text-[10px] font-bold text-slate-500 mt-2 min-h-[30px] flex items-center justify-center">{item.designation || 'No Designation'}</div>
                                                        <div className="w-full h-px bg-slate-100 my-4"></div>
                                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                            Appointed: <span className="text-[#075985] ml-1">{item.appointment_date ? new Date(item.appointment_date).toLocaleDateString() : item.effectivity_date ? new Date(item.effectivity_date).toLocaleDateString() : 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    {Object.keys(directoryGroups).length === 0 && (
                                        <div className="py-20 text-center">
                                            <FiLayers className="mx-auto text-slate-200 mb-6" size={64} />
                                            <h2 className="text-2xl font-['Quicksand'] font-black text-[#08315F] uppercase tracking-tighter mb-2">No Directory Data</h2>
                                            <p className="text-slate-500 font-bold max-w-md mx-auto">No records found matching the current filters.</p>
                                        </div>
                                    )}
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
                                                    <div className="flex items-center gap-2 text-[#075985] font-black text-[10px] uppercase tracking-[0.2em] mb-2">
                                                        <FiClock /> Positional History
                                                    </div>
                                                    <h2 className="text-3xl font-['Quicksand'] font-black text-[#08315F] tracking-tighter uppercase italic leading-none">{selectedPosition?.title}</h2>
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
                                                    <div className="relative border-l-2 border-slate-100 ml-4 pl-6 space-y-5 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                                                        {incumbents.map((inc, i) => {
                                                            const startYear = inc.appointment_date ? new Date(inc.appointment_date).getFullYear() : 'Unknown';
                                                            const endYear = inc.is_current == 1 ? 'Present' : new Date(inc.tenure_date).getFullYear();
                                                            const yearDisplay = startYear === endYear ? startYear : `${startYear} - ${endYear}`;

                                                            return (
                                                                <div key={i} className="relative group">
                                                                    <div className={`absolute -left-[31px] top-5 w-4 h-4 rounded-full border-4 border-white shadow-sm ${inc.is_current == 1 ? 'bg-emerald-400' : 'bg-slate-300 group-hover:bg-blue-400'} transition-colors z-10`}></div>

                                                                    <div className={`flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl border transition-all ${inc.is_current == 1 ? 'bg-emerald-50/50 border-emerald-100 shadow-sm' : 'bg-white border-slate-100 hover:shadow-lg hover:shadow-blue-900/5 hover:border-blue-100'}`}>
                                                                        <div className="flex items-center gap-4">
                                                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shadow-sm ${inc.is_current == 1 ? 'bg-emerald-500 text-white' : 'bg-[#08315F] text-white group-hover:bg-[#075985]'} transition-colors`}>
                                                                                {inc.first_name ? inc.first_name[0] : 'V'}{inc.last_name ? inc.last_name[0] : ''}
                                                                            </div>
                                                                            <div>
                                                                                <div className="flex items-center gap-2 mb-1">
                                                                                    <h4 className="font-['Quicksand'] font-black text-[#08315F] text-base italic uppercase leading-none">
                                                                                        {inc.first_name || 'VACANT'} {inc.last_name || ''}
                                                                                    </h4>
                                                                                    {inc.is_current == 1 && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-[8px] font-black uppercase tracking-widest">Active</span>}
                                                                                </div>
                                                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {inc.TLOid}</div>
                                                                            </div>
                                                                        </div>

                                                                        <div className="mt-4 md:mt-0 text-left md:text-right bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-xl">
                                                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1 md:justify-end">
                                                                                <FiCalendar size={10} /> Tenure Period
                                                                            </div>
                                                                            <div className={`font-black uppercase tracking-tight ${inc.is_current == 1 ? 'text-emerald-600 text-sm' : 'text-slate-600 text-sm'}`}>
                                                                                {yearDisplay}
                                                                            </div>
                                                                            <div className="text-[8px] font-bold text-slate-400 uppercase mt-1">
                                                                                Updated: {new Date(inc.tenure_date).toLocaleDateString()}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-10 bg-[#08315F] rounded-2xl p-6 text-white flex items-center justify-between">
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
                                        className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl border border-white/50 overflow-hidden flex flex-col max-h-[90vh]"
                                    >
                                        <div className="overflow-y-auto custom-scrollbar w-full h-full">
                                            <div className="p-10">
                                                <div className="flex justify-between items-start mb-8">
                                                    <div>
                                                        <span className="text-[10px] font-black text-[#075985] uppercase tracking-widest mb-2 block">Administrative Action</span>
                                                        <h2 className="text-3xl font-['Quicksand'] font-black text-[#08315F] tracking-tighter uppercase italic leading-none">
                                                            {adminAction === 'reassign'
                                                                ? ((!actionOfficial?.first_name || actionOfficial?.first_name === 'VACANT') ? 'ASSIGN PERSONNEL' : 'REASSIGN OFFICIAL')
                                                                : `${adminAction === 'vacate' ? 'VACATING' : `${adminAction.toUpperCase()}ING`} OFFICIAL`}
                                                        </h2>
                                                        <p className="text-slate-400 font-bold mt-2">
                                                            {adminAction === 'reassign'
                                                                ? ((!actionOfficial?.first_name || actionOfficial?.first_name === 'VACANT') ? actionOfficial?.position_title : `${actionOfficial?.first_name || ''} ${actionOfficial?.last_name || ''}`)
                                                                : `${actionOfficial?.first_name || ''} ${actionOfficial?.last_name || ''}`}
                                                        </p>
                                                    </div>
                                                    <button onClick={() => setShowActionModal(false)} className="p-3 rounded-2xl bg-slate-50 text-slate-400 hover:text-red-600 transition-all">
                                                        <FiX size={20} />
                                                    </button>
                                                </div>

                                                <div className="space-y-6">
                                                    {adminAction === 'reassign' && (
                                                        <div className="space-y-4">
                                                            {(!actionOfficial?.first_name || actionOfficial?.first_name === 'VACANT') ? (
                                                                isAddingPersonnel ? (
                                                                    <AddNewPersonnelForm
                                                                        token={token || localStorage.getItem('token')}
                                                                        onCancel={() => setIsAddingPersonnel(false)}
                                                                        onSuccess={async (newId) => {
                                                                            unassignedCacheRef.current.clear();
                                                                            await fetchUnassignedPersonnel();
                                                                            setAssigneeSlot(newId);
                                                                            setIsAddingPersonnel(false);
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <>
                                                                        <div>
                                                                            <div className="flex justify-between items-end mb-3">
                                                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0">Search Personnel Without Position</label>
                                                                                {user?.role === 'Central Office' && (
                                                                                    <button onClick={() => setIsAddingPersonnel(true)} className="text-[10px] font-black text-[#08315F] hover:text-[#004A99] uppercase tracking-widest transition-colors">+ Add New</button>
                                                                                )}
                                                                            </div>
                                                                            <div className="relative">
                                                                                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                                                                <DebouncedSearchInput
                                                                                    value={unassignedSearch}
                                                                                    onChange={setUnassignedSearch}
                                                                                    placeholder="Search by name or employee number..."
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <SearchableSelect
                                                                            label="Reassign To"
                                                                            info={unassignedLoading ? 'Loading available personnel...' : 'Showing personnel without an active position. Search to narrow the list.'}
                                                                            placeholder={unassignedLoading ? 'Loading personnel...' : 'Choose personnel...'}
                                                                            value={assigneeSlot}
                                                                            onChange={setAssigneeSlot}
                                                                            options={unassignedPersonnel.map(p => ({
                                                                                value: p.TLOid,
                                                                                label: `${p.first_name} ${p.last_name || ''}`.trim(),
                                                                                sublabel: [p.employee_number || p.TLOid, p.email].filter(Boolean).join(' - ')
                                                                            }))}
                                                                        />
                                                                        {!unassignedLoading && unassignedPersonnel.length === 0 && (
                                                                            <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center">
                                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No unassigned personnel found</p>
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                )
                                                            ) : (
                                                                <>
                                                                    <SearchableSelect
                                                                        label="Select Target Office"
                                                                        placeholder="Choose Office..."
                                                                        value={selectedOffice}
                                                                        onChange={(val) => {
                                                                            setSelectedOffice(val);
                                                                            setTargetSlot('');
                                                                        }}
                                                                        options={uniqueOffices.map(o => ({ value: o, label: o }))}
                                                                    />

                                                                    {selectedOffice ? (
                                                                        <SearchableSelect
                                                                            label="Select Vacant Position"
                                                                            placeholder="Choose vacant position..."
                                                                            value={targetSlot}
                                                                            onChange={setTargetSlot}
                                                                            options={filteredVacantSlots.map(slot => ({
                                                                                value: slot.TLOid,
                                                                                label: slot.is_oic ? `${slot.position_title} (OIC)` : slot.position_title,
                                                                                sublabel: slot.strand ? `Strand: ${slot.strand}` : 'No Strand'
                                                                            }))}
                                                                        />
                                                                    ) : (
                                                                        <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center">
                                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Please select an office first to view vacant positions</p>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
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

                                                    {(adminAction === 'reassign' || adminAction === 'vacate') && (
                                                        <div className="mb-4">
                                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Date of Effectivity</label>
                                                            <ModernDatePicker
                                                                value={effectivityDate}
                                                                onChange={(val) => setEffectivityDate(val)}
                                                                className="w-full bg-slate-50 border-2 border-transparent focus:border-[#08315F]/20 rounded-2xl py-4 px-5 text-sm font-bold text-slate-700 outline-none transition-all"
                                                            />
                                                        </div>
                                                    )}

                                                    {adminAction === 'vacate' && (
                                                        <div className="mb-4">
                                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Reason for Vacating</label>
                                                            <select
                                                                value={vacateReason}
                                                                onChange={(e) => setVacateReason(e.target.value)}
                                                                className="w-full bg-slate-50 border-2 border-transparent focus:border-[#08315F]/20 rounded-2xl py-4 px-5 text-sm font-bold text-slate-700 outline-none transition-all"
                                                            >
                                                                <option value="">Select a reason...</option>
                                                                <option value="Resignation">Resignation</option>
                                                                <option value="Retirement">Retirement</option>
                                                                <option value="Reassignment">Reassignment</option>
                                                                <option value="Promotion">Promotion</option>
                                                                <option value="Demotion">Demotion</option>
                                                                <option value="Dismissal">Dismissal</option>
                                                            </select>
                                                        </div>
                                                    )}

                                                    <div>
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Justification / Remarks</label>
                                                        <JustificationInput
                                                            value={justification}
                                                            onChange={setJustification}
                                                            placeholder={adminAction === 'reassign' ? 'Optional reassignment note...' : 'Please provide additional remarks...'}
                                                        />
                                                    </div>

                                                    <div className="flex gap-4">
                                                        <button
                                                            disabled={actionLoading}
                                                            onClick={handleAdminAction}
                                                            className="flex-1 py-5 bg-[#08315F] text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-blue-900/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                                                        >
                                                            {actionLoading ? 'Processing...' : `Confirm ${adminAction}`}
                                                        </button>
                                                        {['Vacating', 'Resigning', 'Inactive', 'Reassigning', 'Pending Assignment'].includes(actionOfficial?.status) && (adminAction === 'vacate' || adminAction === 'reassign') && (
                                                            <button
                                                                disabled={actionLoading}
                                                                onClick={handleCancelVacate}
                                                                className="flex-1 py-5 bg-rose-50 text-rose-600 border-2 border-rose-100 rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-sm hover:bg-rose-100 hover:border-rose-200 transition-all active:scale-95 disabled:opacity-50"
                                                            >
                                                                {actionLoading ? 'Processing...' : 'Cancel Action'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                </div>
                            )}
                        </AnimatePresence>,
                        document.body
                    )}

                    <footer className="mt-auto p-12 text-center bg-white border-t border-slate-100 flex flex-col items-center gap-6">
                        <div className="space-y-1">
                            <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.3em]">© 2026 Department of Education • InsightEd Nexus Portal</p>
                            <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest italic">Strictly for Personnel Division Administrative Use Only</p>
                        </div>
                    </footer>
                </div>
            </div>
        </PageTransition>
    );
};

export default OfficialsRegistry;


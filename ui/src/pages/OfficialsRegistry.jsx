import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiUsers, FiSearch, FiFilter, FiExternalLink, FiChevronRight,
    FiMoreVertical, FiDownload, FiPlus, FiGrid, FiList,
    FiCheckCircle, FiAlertCircle, FiClock, FiActivity, FiArrowRight,
    FiLogOut, FiUser, FiInfo, FiLayers, FiX, FiTrash2, FiRefreshCw
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import PageTransition from '../components/PageTransition';
import LoadingScreen from '../components/LoadingScreen';
import Swal from 'sweetalert2';
import { apiUrl } from '../utils/api';

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
    const [activeTab, setActiveTab] = useState('All');
    const [levelFilter, setLevelFilter] = useState('All');
    const [regionFilter, setRegionFilter] = useState('All');
    const [strandFilter, setStrandFilter] = useState('All');
    const [positionFilter, setPositionFilter] = useState('All');
    const [designationFilter, setDesignationFilter] = useState('All');
    const [viewMode, setViewMode] = useState('table');
    const [strands, setStrands] = useState([]);
    const [tabPositions, setTabPositions] = useState([]); // Positions specifically for the active tab
    const [designations, setDesignations] = useState([]);
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
    const [tableFilters, setTableFilters] = useState({});
    const [currentPage, setCurrentPage] = useState(1);

    // Filter officials on the client side
    const thirdLevelOfficials = useMemo(() => {
        return officials.filter(o => !o.is_oic && THIRD_LEVEL_POSITIONS.includes(o.position_title));
    }, [officials]);

    const thirdLevelOic = useMemo(() => {
        return officials.filter(o => o.is_oic && THIRD_LEVEL_POSITIONS.includes(o.position_title));
    }, [officials]);

    const divisionChiefsOic = useMemo(() => {
        return officials.filter(o => o.is_oic && !THIRD_LEVEL_POSITIONS.includes(o.position_title));
    }, [officials]);

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
            if (o.first_name && o.first_name !== 'VACANT') {
                const pos = o.position_title || 'Unassigned';
                counts[pos] = (counts[pos] || 0) + 1;
            }
        });
        return sortBreakdown(counts);
    }, [thirdLevelOfficials]);

    const thirdLevelOicBreakdown = useMemo(() => {
        const counts = {};
        thirdLevelOic.forEach(o => {
            if (o.first_name && o.first_name !== 'VACANT') {
                const pos = o.position_title || 'Unassigned';
                counts[pos] = (counts[pos] || 0) + 1;
            }
        });
        return sortBreakdown(counts);
    }, [thirdLevelOic]);

    const divisionChiefsBreakdown = useMemo(() => {
        const counts = {};
        divisionChiefsOic.forEach(o => {
            if (o.first_name && o.first_name !== 'VACANT') {
                const pos = o.position_title || 'Unassigned';
                counts[pos] = (counts[pos] || 0) + 1;
            }
        });
        return sortBreakdown(counts);
    }, [divisionChiefsOic]);

    const fetchTabPositions = async () => {
        try {
            // Fetch all positions for the current tab to keep the dropdown stable
            const queryParams = new URLSearchParams();

            // Map the frontend tab to backend category
            let backendCategory = 'Third Level';
            if (activeTab === 'Third Level (OIC)' || activeTab === 'Division Chiefs (OIC)') {
                backendCategory = 'OIC / Chiefs';
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
        fetchStrands();
    }, []);

    useEffect(() => {
        fetchOfficials();
    }, [searchTerm, strandFilter, positionFilter, designationFilter]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, activeTab, strandFilter, positionFilter, designationFilter, sortConfig, tableFilters]);

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
                let uniqueDesignations = [...new Set(data.data.map(o => o.designation).filter(Boolean))].sort();
                setDesignations(uniqueDesignations);
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
            queryParams.append('status', 'All');
            if (strandFilter !== 'All') queryParams.append('strand', strandFilter);
            if (positionFilter !== 'All') queryParams.append('position', positionFilter);
            if (designationFilter !== 'All') queryParams.append('designation', designationFilter);

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

    const openActionModal = async (official, action) => {
        setActionOfficial(official);
        setAdminAction(action);
        setJustification('');
        setTargetSlot('');
        setSuccessorSlot('');
        setAssigneeSlot('');
        setUnassignedSearch('');
        setSelectedOffice('');
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
                        setVacantSlots(data.data);
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

    const tableColumns = useMemo(() => ([
        {
            key: 'name',
            label: 'Official Profile',
            width: 'w-3/12 lg:w-3/12',
            value: (item) => `${item.first_name || 'VACANT POSITION'} ${item.last_name || ''} ${item.email || ''}`,
            filterValue: (item) => item.first_name ? `${item.first_name} ${item.last_name || ''}`.trim() : 'VACANT POSITION'
        },
        {
            key: 'position',
            label: 'Current Position',
            width: 'w-3/12 lg:w-2/12',
            value: (item) => `${item.position_title || ''} ${item.is_oic ? 'OIC' : ''}`,
            filterValue: (item) => `${item.position_title || 'Unassigned'}${item.is_oic ? ' - OIC' : ''}`
        },
        {
            key: 'designation_area',
            label: 'Designation Area',
            width: 'w-2/12',
            value: (item) => `${item.position_title || ''} ${item.is_oic ? 'OIC' : ''}`,
            filterValue: (item) => `${item.position_title || 'Unassigned'}${item.is_oic ? ' - OIC' : ''}`
        },
        {
            key: 'strand',
            label: 'Strand',
            width: 'w-2/12',
            value: (item) => item.strand || '',
            filterValue: (item) => item.strand || 'No Strand'
        },
        {
            key: 'office',
            label: 'Office',
            width: 'w-2/12 lg:w-3/12',
            value: (item) => item.office || '',
            filterValue: (item) => item.office || 'Main Office'
        },
        {
            key: 'status',
            label: 'Status',
            width: 'w-[80px]',
            value: (item) => item.status === 'Vacated' ? 'Vacant' : (item.status || ''),
            filterValue: (item) => item.status === 'Vacated' ? 'Vacant' : (item.status || 'Unknown')
        }
    ]), []);

    const activeRecords = useMemo(() => {
        if (activeTab === 'All') return [...thirdLevelOfficials, ...thirdLevelOic, ...divisionChiefsOic];
        if (activeTab === 'Third Level Officials') return thirdLevelOfficials;
        if (activeTab === 'Third Level (OIC)') return thirdLevelOic;
        if (activeTab === 'Division Chiefs (OIC)') return divisionChiefsOic;
        return thirdLevelOfficials;
    }, [activeTab, thirdLevelOfficials, thirdLevelOic, divisionChiefsOic]);

    const getOfficialLevel = (item) => {
        const strand = item.strand || '';
        const office = item.office || '';
        const pos = item.position_title || '';

        const isRegionStrand = /^(Region|NCR|CAR|NIR)/i.test(strand);
        if (!isRegionStrand) return 'Central Office';

        const isROOffice = !office || office.toLowerCase() === strand.toLowerCase() || office.toLowerCase().includes('regional office') || office.toLowerCase() === 'ro';
        const isROPosition = /(Regional Director|RD|ARD)/i.test(pos);
        const isSDOPosition = /(Schools Division Superintendent|SDS|ASDS)/i.test(pos);

        if (isSDOPosition) return 'Schools Division Office';
        if (isROOffice || isROPosition) return 'Regional Office';

        return 'Schools Division Office';
    };

    const getOfficialRegion = (item) => {
        if (getOfficialLevel(item) === 'Central Office') return 'Central Office';

        const strand = (item.strand || '').trim();
        if (strand.toUpperCase() === 'REGION XIII' || strand.toUpperCase() === 'CARAGA') return 'CARAGA';

        const knownRegions = [
            'Region I', 'Region II', 'Region III', 'Region IV-A', 'Region IV-B',
            'Region V', 'Region VI', 'Region VII', 'Region VIII', 'Region IX',
            'Region X', 'Region XI', 'Region XII', 'NCR', 'CAR', 'NIR', 'BARMM'
        ];

        const found = knownRegions.find(r => r.toLowerCase() === strand.toLowerCase());
        if (found) return found;

        return 'Central Office';
    };
    const tableFilterOptions = useMemo(() => {
        return tableColumns.reduce((options, column) => {
            const values = activeRecords
                .map(item => (column.filterValue ? column.filterValue(item) : column.value(item)).trim())
                .filter(Boolean);
            options[column.key] = [...new Set(values)].sort((a, b) => a.localeCompare(b));
            return options;
        }, {});
    }, [activeRecords, tableColumns]);

    const filteredRecords = useMemo(() => {
        return activeRecords.filter(item => {
            if (levelFilter !== 'All' && getOfficialLevel(item) !== levelFilter) return false;
            if (regionFilter !== 'All' && getOfficialRegion(item) !== regionFilter) return false;

            return tableColumns.every(column => {
                const filter = tableFilters[column.key];
                if (!filter) return true;
                const value = column.filterValue ? column.filterValue(item) : column.value(item);
                return value === filter;
            });
        });
    }, [activeRecords, tableColumns, tableFilters, levelFilter, regionFilter]);

    const sortedRecords = useMemo(() => {
        const column = tableColumns.find(c => c.key === sortConfig.key);
        if (!column) return filteredRecords;
        return [...filteredRecords].sort((a, b) => {
            const left = column.value(a).toLowerCase();
            const right = column.value(b).toLowerCase();
            if (left < right) return sortConfig.direction === 'asc' ? -1 : 1;
            if (left > right) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredRecords, tableColumns, sortConfig]);

    const pageSize = 20;
    const pageCount = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
    const pagedRecords = sortedRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);
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

    const TableHeader = ({ column }) => (
        <th className={`px-3 py-3 text-left align-top ${column.width || ''}`}>
            <div className="flex flex-col gap-2">
                <button
                    onClick={() => handleSort(column.key)}
                    className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-[#075985] transition-colors w-full"
                >
                    <span>{column.label}</span>
                    <span className="text-slate-300 text-sm">
                        {sortConfig.key === column.key
                            ? (sortConfig.direction === 'asc' ? '↑' : '↓')
                            : '↕'}
                    </span>
                </button>
                <select
                    value={tableFilters[column.key] || ''}
                    onChange={(e) => setTableFilters(current => ({ ...current, [column.key]: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold text-slate-600 outline-none focus:border-blue-300 shadow-sm"
                >
                    <option value="">All</option>
                    {(tableFilterOptions[column.key] || []).map(option => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            </div>
        </th>
    );

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
            <div className="min-h-screen bg-transparent flex flex-col font-sans overflow-x-hidden">

                {/* TOP NAVIGATION BAR */}
                <header className="sticky top-0 z-50 bg-[#08315F] backdrop-blur-md border-b border-blue-900 px-8 py-4 flex items-center justify-between shadow-lg shadow-blue-900/20">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white shadow-inner">
                            <FiUsers size={20} />
                        </div>
                        <div>
                            <h1 className="text-lg font-['Quicksand'] font-black text-white tracking-tight leading-none italic uppercase">Personnel <span className="text-blue-300 not-italic">Registry</span></h1>
                            <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest mt-1">Official Leadership Management</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="hidden md:flex flex-col items-end">
                            <span className="text-xs font-['Quicksand'] font-black text-white leading-none">{user?.first_name} {user?.last_name}</span>
                            <span className="text-[9px] font-bold text-[#FBBF24] uppercase tracking-widest mt-1">{user?.role}</span>
                        </div>
                        <button onClick={logout} className="p-3 rounded-xl bg-white/10 text-white hover:bg-red-500 hover:text-white transition-all border border-white/20 hover:border-red-500 shadow-sm">
                            <FiLogOut size={18} />
                        </button>
                    </div>
                </header>

                <main className="flex-1 p-8 max-w-[1600px] mx-auto w-full">

                    {/* STATS CARDS */}
                    <div className="flex justify-center mb-8">
                        <div className="flex flex-wrap items-center justify-center gap-4">
                            {/* Card 1: Third Level Officials */}
                            <div
                                onClick={() => { setActiveTab(prev => prev === 'Third Level Officials' ? 'All' : 'Third Level Officials'); setPositionFilter('All'); setStrandFilter('All'); setLevelFilter('All'); setRegionFilter('All'); }}
                                className={`relative group bg-white p-4 rounded-2xl border ${activeTab === 'Third Level Officials' ? 'border-blue-500 shadow-md ring-4 ring-blue-500/10' : 'border-blue-200 shadow-none hover:border-blue-300'} flex items-center gap-4 cursor-pointer transition-all`}
                            >
                                {activeTab === 'Third Level Officials' && (
                                    <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-[8px] font-black tracking-widest px-2 py-0.5 rounded-full shadow-sm">
                                        ACTIVE
                                    </div>
                                )}
                                <div className="w-10 h-10 bg-blue-50 text-[#075985] rounded-xl flex items-center justify-center">
                                    <FiUsers size={18} />
                                </div>
                                <div>
                                    <span className="block text-2xl font-['Quicksand'] font-black text-[#08315F] leading-none tracking-tight">
                                        {thirdLevelOfficials.length}
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Third Level Officials</span>
                                </div>

                                {/* Hover Breakdown Tooltip */}
                                <div className="absolute right-0 top-full mt-2 w-72 bg-white/95 backdrop-blur-md border border-slate-100 rounded-2xl shadow-2xl p-4 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-[60]">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pb-2 border-b border-slate-100">
                                        Position Breakdown
                                    </div>
                                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                        {Object.entries(thirdLevelBreakdown).length > 0 ? (
                                            Object.entries(thirdLevelBreakdown).map(([position, count]) => (
                                                <div key={position} className="flex justify-between items-center text-xs py-1 border-b border-slate-50 last:border-0">
                                                    <span className="text-slate-600 font-bold truncate pr-2" title={position}>{position}</span>
                                                    <span className="text-slate-900 font-black px-2 py-0.5 bg-blue-50 text-blue-700 rounded-lg shrink-0">{count}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center py-2">No officials</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Third Level (OIC) */}
                            <div
                                onClick={() => { setActiveTab(prev => prev === 'Third Level (OIC)' ? 'All' : 'Third Level (OIC)'); setPositionFilter('All'); setStrandFilter('All'); setLevelFilter('All'); setRegionFilter('All'); }}
                                className={`relative group bg-white p-4 rounded-2xl border ${activeTab === 'Third Level (OIC)' ? 'border-amber-500 shadow-md ring-4 ring-amber-500/10' : 'border-amber-200 shadow-none hover:border-amber-300'} flex items-center gap-4 cursor-pointer transition-all`}
                            >
                                {activeTab === 'Third Level (OIC)' && (
                                    <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-[8px] font-black tracking-widest px-2 py-0.5 rounded-full shadow-sm">
                                        ACTIVE
                                    </div>
                                )}
                                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                                    <FiActivity size={18} />
                                </div>
                                <div>
                                    <span className="block text-2xl font-['Quicksand'] font-black text-[#08315F] leading-none tracking-tight">
                                        {thirdLevelOic.length}
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Third Level (OIC)</span>
                                </div>

                                {/* Hover Breakdown Tooltip */}
                                <div className="absolute right-0 top-full mt-2 w-72 bg-white/95 backdrop-blur-md border border-slate-100 rounded-2xl shadow-2xl p-4 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-[60]">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pb-2 border-b border-slate-100">
                                        Position Breakdown
                                    </div>
                                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                        {Object.entries(thirdLevelOicBreakdown).length > 0 ? (
                                            Object.entries(thirdLevelOicBreakdown).map(([position, count]) => (
                                                <div key={position} className="flex justify-between items-center text-xs py-1 border-b border-slate-50 last:border-0">
                                                    <span className="text-slate-600 font-bold truncate pr-2" title={position}>{position}</span>
                                                    <span className="text-slate-900 font-black px-2 py-0.5 bg-amber-50 text-amber-700 rounded-lg shrink-0">{count}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center py-2">No officials</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: Division Chiefs (OIC) */}
                            <div
                                onClick={() => { setActiveTab(prev => prev === 'Division Chiefs (OIC)' ? 'All' : 'Division Chiefs (OIC)'); setPositionFilter('All'); setStrandFilter('All'); setLevelFilter('All'); setRegionFilter('All'); }}
                                className={`relative group bg-white p-4 rounded-2xl border ${activeTab === 'Division Chiefs (OIC)' ? 'border-emerald-500 shadow-md ring-4 ring-emerald-500/10' : 'border-emerald-200 shadow-none hover:border-emerald-300'} flex items-center gap-4 cursor-pointer transition-all`}
                            >
                                {activeTab === 'Division Chiefs (OIC)' && (
                                    <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[8px] font-black tracking-widest px-2 py-0.5 rounded-full shadow-sm">
                                        ACTIVE
                                    </div>
                                )}
                                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                                    <FiActivity size={18} />
                                </div>
                                <div>
                                    <span className="block text-2xl font-['Quicksand'] font-black text-[#08315F] leading-none tracking-tight">
                                        {divisionChiefsOic.length}
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Division Chiefs (OIC)</span>
                                </div>

                                {/* Hover Breakdown Tooltip */}
                                <div className="absolute right-0 top-full mt-2 w-72 bg-white/95 backdrop-blur-md border border-slate-100 rounded-2xl shadow-2xl p-4 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-[60]">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pb-2 border-b border-slate-100">
                                        Position Breakdown
                                    </div>
                                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                        {Object.entries(divisionChiefsBreakdown).length > 0 ? (
                                            Object.entries(divisionChiefsBreakdown).map(([position, count]) => (
                                                <div key={position} className="flex justify-between items-center text-xs py-1 border-b border-slate-50 last:border-0">
                                                    <span className="text-slate-600 font-bold truncate pr-2" title={position}>{position}</span>
                                                    <span className="text-slate-900 font-black px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg shrink-0">{count}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center py-2">No officials</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* FILTERS & SEARCH BAR */}
                    <div className="bg-white rounded-[2.5rem] p-6 shadow-2xl shadow-sky-200/40 border border-sky-200 mb-8 space-y-6">
                        <div className="flex flex-col lg:flex-row gap-4 items-center">
                            {/* Category Dropdown */}
                            <div className="w-full lg:w-[240px]">
                                <SearchableSelect
                                    label=""
                                    placeholder="Select Category"
                                    value={activeTab}
                                    onChange={(val) => { setActiveTab(val); setPositionFilter('All'); setStrandFilter('All'); setLevelFilter('All'); setRegionFilter('All'); }}
                                    options={[
                                        { value: 'All', label: 'All Categories' },
                                        { value: 'Third Level Officials', label: 'Third Level Officials' },
                                        { value: 'Third Level (OIC)', label: 'Third Level (OIC)' },
                                        { value: 'Division Chiefs (OIC)', label: 'Division Chiefs (OIC)' }
                                    ]}
                                />
                            </div>

                            {/* Level Dropdown */}
                            <div className="w-full lg:w-[240px]">
                                <SearchableSelect
                                    label=""
                                    placeholder="All Levels"
                                    value={levelFilter}
                                    onChange={setLevelFilter}
                                    options={[
                                        { value: 'All', label: 'All Levels' },
                                        { value: 'Central Office', label: 'Central Office' },
                                        { value: 'Regional Office', label: 'Regional Office' },
                                        { value: 'Schools Division Office', label: 'Schools Division Office' }
                                    ]}
                                />
                            </div>

                            {/* Region Dropdown */}
                            <div className="w-full lg:w-[240px]">
                                <SearchableSelect
                                    label=""
                                    placeholder="All Regions"
                                    value={regionFilter}
                                    onChange={setRegionFilter}
                                    options={[
                                        { value: 'All', label: 'All Regions' },
                                        { value: 'Central Office', label: 'Central Office' },
                                        { value: 'Region I', label: 'Region I' },
                                        { value: 'Region II', label: 'Region II' },
                                        { value: 'Region III', label: 'Region III' },
                                        { value: 'Region IV-A', label: 'Region IV-A' },
                                        { value: 'Region IV-B', label: 'Region IV-B' },
                                        { value: 'Region V', label: 'Region V' },
                                        { value: 'Region VI', label: 'Region VI' },
                                        { value: 'Region VII', label: 'Region VII' },
                                        { value: 'Region VIII', label: 'Region VIII' },
                                        { value: 'Region IX', label: 'Region IX' },
                                        { value: 'Region X', label: 'Region X' },
                                        { value: 'Region XI', label: 'Region XI' },
                                        { value: 'Region XII', label: 'Region XII' },
                                        { value: 'CARAGA', label: 'CARAGA' },
                                        { value: 'NCR', label: 'NCR' },
                                        { value: 'CAR', label: 'CAR' },
                                        { value: 'NIR', label: 'NIR' },
                                        { value: 'BARMM', label: 'BARMM' }
                                    ]}
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

                            {/* Designation Dropdown */}
                            <div className="w-full lg:w-[280px]">
                                <SearchableSelect
                                    label=""
                                    placeholder="All Designations"
                                    value={designationFilter}
                                    onChange={setDesignationFilter}
                                    options={[
                                        { value: 'All', label: 'All Designations' },
                                        ...designations.map(d => ({ value: d, label: d }))
                                    ]}
                                />
                            </div>

                            {/* Reset Filters */}
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setTableFilters({});
                                    setActiveTab('All');
                                    setLevelFilter('All');
                                    setRegionFilter('All');
                                    setStrandFilter('All');
                                    setPositionFilter('All');
                                    setDesignationFilter('All');
                                }}
                                className="px-5 py-4 bg-rose-50/50 text-rose-500 rounded-2xl border border-rose-100 font-bold text-xs hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                                title="Reset all filters"
                            >
                                <FiRefreshCw size={16} /> Reset
                            </button>



                            {/* View Switcher */}
                            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 lg:ml-auto">
                                <button
                                    onClick={() => setViewMode('table')}
                                    className={`p-3 rounded-xl transition-all ${viewMode === 'table' ? 'bg-white text-[#075985] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                    title="Table view"
                                >
                                    <ListRowsIcon />
                                </button>
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white text-[#075985] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <FiGrid size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* SEARCH BAR */}
                    <div className="relative w-full mb-8">
                        <FiSearch className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by name, position, or office..."
                            className="w-full bg-white border border-sky-200 rounded-[2rem] py-5 pl-14 pr-6 text-slate-700 font-bold focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20 transition-all outline-none shadow-2xl shadow-sky-200/40"
                        />
                    </div>

                    {/* MAIN CONTENT AREA */}
                    <AnimatePresence mode="wait">
                        {loading ? (
                            <div className="h-96 flex items-center justify-center">
                                <div className="w-12 h-12 border-4 border-[#004A99]/10 border-t-[#004A99] rounded-full animate-spin"></div>
                            </div>
                        ) : sortedRecords.length === 0 ? (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-[3rem] p-20 text-center border-2 border-dashed border-slate-200">
                                <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6"><FiSearch size={40} /></div>
                                <h3 className="text-xl font-['Quicksand'] font-black text-[#08315F] uppercase italic tracking-tight">No Records Found</h3>
                                <p className="text-slate-400 font-medium mt-2">Adjust your filters or try a different search term.</p>
                            </motion.div>
                        ) : viewMode === 'table' ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-200/50 border border-blue-200">
                                <div className="w-full">
                                    <table className="w-full text-left border-collapse table-fixed">
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                                {tableColumns.map(column => <TableHeader key={column.key} column={column} />)}
                                                <th className="px-3 py-3 w-[150px] lg:w-[180px] text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {pagedRecords.map((item) => (
                                                <motion.tr key={item.TLOid} whileHover={{ backgroundColor: 'rgba(248, 250, 252, 0.8)' }} className="group transition-colors">
                                                    <td
                                                        className={`px-3 py-3 align-top ${item.email ? 'cursor-pointer' : ''}`}
                                                        onClick={() => item.email && navigate(`/official-profiling?email=${item.email}`)}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className="w-10 h-10 rounded-[1rem] bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-blue-400 font-black text-lg border border-white shadow-sm overflow-hidden shrink-0 mt-0.5">
                                                                {item.photo_binary_id ? (
                                                                    <img src={apiUrl(`/api/binary/${item.photo_binary_id}`)} alt="" className="w-full h-full object-cover" />
                                                                ) : <FiUser size={18} />}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="font-['Quicksand'] font-black text-[#08315F] text-xs leading-none group-hover:text-[#08315F] group-hover:underline transition-colors truncate">
                                                                    {item.first_name ? `${item.first_name} ${item.last_name || ''}` : <span className="text-rose-500 italic tracking-widest text-[9px]">VACANT POSITION</span>}
                                                                </div>
                                                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-1.5 truncate">
                                                                    <FiArrowRight className="text-[#075985] shrink-0" size={8} />
                                                                    <span className="truncate">{item.email}</span>
                                                                </div>
                                                                {item.updated_at && (
                                                                    <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                                        Updated: {new Date(item.updated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 align-top">
                                                        <button
                                                            onClick={() => handlePositionClick(item)}
                                                            className="text-left group/pos hover:translate-x-1 transition-transform w-full"
                                                        >
                                                            <div className="font-black text-[#08315F] text-[10px] uppercase tracking-tight flex flex-wrap items-start gap-1.5">
                                                                <span className="line-clamp-2">{item.position_title || 'Unassigned'}</span>
                                                                {item.is_oic && <span className="px-1.5 py-0.5 rounded-md bg-[#FCD116] text-[#0038A8] text-[7px] font-black uppercase tracking-widest shrink-0 mt-0.5">OIC</span>}
                                                            </div>
                                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                                Since {item.date_of_assignment ? new Date(item.date_of_assignment).toLocaleDateString() : 'N/A'}
                                                            </div>
                                                        </button>
                                                    </td>
                                                    <td className="px-3 py-3 align-top">
                                                        <div className="font-black text-[#08315F] text-[10px] uppercase tracking-tight flex flex-wrap items-start gap-1.5">
                                                            <span className="line-clamp-2">{item.position_title || 'Unassigned'}</span>
                                                            {item.is_oic && <span className="px-1.5 py-0.5 rounded-md bg-[#FCD116] text-[#0038A8] text-[7px] font-black uppercase tracking-widest shrink-0 mt-0.5">OIC</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 align-top">
                                                        <div className="text-[9px] font-black text-emerald-600 uppercase tracking-widest line-clamp-2">{item.strand || 'No Strand'}</div>
                                                    </td>
                                                    <td className="px-3 py-3 align-top">
                                                        <div className="text-[10px] font-bold text-slate-700 line-clamp-2">{item.office || 'Main Office'}</div>
                                                    </td>
                                                    <td className="px-3 py-3 align-top">
                                                        <StatusBadge status={item.status} />
                                                    </td>
                                                    <td className="px-3 py-3 text-right align-top">
                                                        <div className="flex items-start justify-end gap-1.5">
                                                            {item.email && (
                                                                <button
                                                                    onClick={() => navigate(`/official-profiling?email=${item.email}`)}
                                                                    title="View Profile"
                                                                    className="p-1.5 bg-white border border-slate-200 text-slate-400 rounded-lg hover:bg-[#08315F] hover:text-white hover:border-[#004A99] transition-all shadow-sm shrink-0"
                                                                >
                                                                    <FiExternalLink size={14} />
                                                                </button>
                                                            )}
                                                            <div className="flex flex-wrap items-center justify-end gap-1 w-full max-w-[140px]">
                                                                <button onClick={() => openActionModal(item, 'reassign')} title="Reassign" className="flex-1 min-w-[60px] flex items-center justify-center gap-1 px-1.5 py-1 bg-amber-50 text-amber-600 rounded-md text-[8px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all border border-amber-100 shadow-sm shrink-0">
                                                                    <FiLayers size={10} /> Reassign
                                                                </button>
                                                                {item.first_name && (
                                                                    <>
                                                                        <button onClick={() => openActionModal(item, 'vacate')} title="Vacate" className="flex-1 min-w-[60px] flex items-center justify-center gap-1 px-1.5 py-1 bg-rose-50 text-rose-600 rounded-md text-[8px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all border border-rose-100 shadow-sm shrink-0">
                                                                            <FiTrash2 size={10} /> Vacate
                                                                        </button>
                                                                        <button onClick={() => openActionModal(item, 'succeed')} title="Succeed" className="w-full flex items-center justify-center gap-1 px-1.5 py-1 bg-emerald-50 text-emerald-600 rounded-md text-[8px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all border border-emerald-100 shadow-sm shrink-0">
                                                                            <FiCheckCircle size={10} /> Succeed
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="px-8 py-5 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Showing {sortedRecords.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, sortedRecords.length)} of {sortedRecords.length} records
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
                        ) : (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {pagedRecords.map((item) => (
                                        <motion.div
                                            key={item.TLOid}
                                            whileHover={{ y: -8 }}
                                            onClick={() => item.email && navigate(`/official-profiling?email=${item.email}`)}
                                            className={`bg-white rounded-[2.5rem] p-8 border border-blue-200 shadow-xl shadow-slate-200/40 group flex flex-col justify-between h-full relative overflow-hidden ${item.email ? 'cursor-pointer' : 'cursor-default'}`}
                                        >
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                                            <div>
                                                <div className="flex justify-between items-start mb-6 relative z-10">
                                                    <div className="w-20 h-20 rounded-[1.8rem] bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center text-blue-300 font-black text-3xl border-2 border-white shadow-xl overflow-hidden">
                                                        {item.photo_binary_id ? (
                                                            <img src={apiUrl(`/api/binary/${item.photo_binary_id}`)} alt="" className="w-full h-full object-cover" />
                                                        ) : <FiUser size={32} />}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {item.is_oic && <span className="px-3 py-1 bg-[#FCD116] text-[#0038A8] border border-yellow-200 rounded-full text-[9px] font-black uppercase tracking-widest">OIC</span>}
                                                        <StatusBadge status={item.status} />
                                                    </div>
                                                </div>

                                                <div className="space-y-1 relative z-10">
                                                    <h3 className="text-2xl font-['Quicksand'] font-black text-[#08315F] tracking-tighter leading-tight uppercase italic">
                                                        {item.first_name ? <>{item.first_name} <br /> {item.last_name}</> : <span className="text-rose-500 text-lg">VACANT POSITION</span>}
                                                    </h3>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handlePositionClick(item); }}
                                                        className="text-[10px] font-black text-[#08315F] uppercase tracking-[0.2em] hover:text-[#075985] transition-colors text-left flex items-center gap-1"
                                                    >
                                                        {item.position_title || 'Candidate'}
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
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Strand</span>
                                                        <span className="text-[10px] font-bold text-slate-700">{item.strand || 'N/A'}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Office</span>
                                                        <span className="text-[10px] font-bold text-slate-700 truncate ml-4">{item.office || 'Main Office'}</span>
                                                    </div>
                                                    {item.updated_at && (
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Updated</span>
                                                            <span className="text-[10px] font-bold text-slate-700 truncate ml-4">
                                                                {new Date(item.updated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-8 pt-6 border-t border-slate-50 flex flex-col gap-4 relative z-20" onClick={e => e.stopPropagation()}>
                                                <div className="flex flex-wrap gap-2">
                                                    <button onClick={() => openActionModal(item, 'reassign')} className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-600 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all border border-amber-100 shadow-sm">
                                                        <FiLayers size={12} /> Reassign
                                                    </button>
                                                    {item.first_name && (
                                                        <>
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
                                                    <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest italic flex items-center gap-2 group-hover:text-[#075985] transition-colors">
                                                        Full Profile <FiArrowRight size={14} />
                                                    </div>
                                                    <button onClick={() => handlePositionClick(item)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-[#08315F] hover:text-white transition-all" title="View History">
                                                        <FiClock size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                                <div className="px-8 py-5 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Showing {sortedRecords.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, sortedRecords.length)} of {sortedRecords.length} records
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
                                                <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                    {incumbents.map((inc, i) => (
                                                        <div key={i} className="flex items-center justify-between p-5 bg-slate-50/50 rounded-2xl border border-slate-100 group hover:bg-white hover:shadow-lg hover:shadow-blue-900/5 transition-all">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 rounded-xl bg-[#08315F] text-white flex items-center justify-center font-black text-sm shadow-lg shadow-blue-500/20">
                                                                    {inc.first_name ? inc.first_name[0] : 'V'}{inc.last_name ? inc.last_name[0] : ''}
                                                                </div>
                                                                <div>
                                                                    <div className="font-['Quicksand'] font-black text-[#08315F] text-sm italic uppercase">{inc.first_name || 'VACANT'} {inc.last_name || ''}</div>
                                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Incumbent Tenure ID: {inc.TLOid}</div>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-[10px] font-black text-[#FBBF24] uppercase tracking-widest leading-none mb-1">Updated</div>
                                                                <div className="text-[9px] font-bold text-slate-400 uppercase">{new Date(inc.tenure_date).toLocaleDateString()}</div>
                                                            </div>
                                                        </div>
                                                    ))}
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
                                    className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl border border-white/50"
                                >
                                    <div className="p-10">
                                        <div className="flex justify-between items-start mb-8">
                                            <div>
                                                <span className="text-[10px] font-black text-[#075985] uppercase tracking-widest mb-2 block">Administrative Action</span>
                                                <h2 className="text-3xl font-['Quicksand'] font-black text-[#08315F] tracking-tighter uppercase italic leading-none">
                                                    {adminAction === 'reassign'
                                                        ? ((!actionOfficial?.first_name || actionOfficial?.first_name === 'VACANT') ? 'ASSIGN PERSONNEL' : 'REASSIGN OFFICIAL')
                                                        : `${adminAction}ING OFFICIAL`}
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
                                                        <>
                                                            <div>
                                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Search Personnel Without Position</label>
                                                                <div className="relative">
                                                                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                                                    <input
                                                                        value={unassignedSearch}
                                                                        onChange={(e) => setUnassignedSearch(e.target.value)}
                                                                        placeholder="Search by name or employee number..."
                                                                        className="w-full bg-slate-50 border-2 border-transparent focus:border-[#08315F]/20 rounded-2xl py-4 pl-11 pr-5 text-sm font-bold text-slate-700 outline-none transition-all"
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

                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Justification / Reason</label>
                                                <textarea
                                                    value={justification}
                                                    onChange={(e) => setJustification(e.target.value)}
                                                    placeholder={adminAction === 'reassign' ? 'Optional reassignment note...' : 'Please provide a detailed reason for this action...'}
                                                    rows={4}
                                                    className="w-full bg-slate-50 border-2 border-transparent focus:border-[#08315F]/20 rounded-2xl py-4 px-5 text-sm font-bold text-slate-700 outline-none transition-all resize-none"
                                                />
                                            </div>

                                            <button
                                                disabled={actionLoading}
                                                onClick={handleAdminAction}
                                                className="w-full py-5 bg-[#08315F] text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-blue-900/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
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


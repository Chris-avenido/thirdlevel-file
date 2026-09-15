import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiSearch,
    FiFilter,
    FiDownload,
    FiPlus,
    FiEdit2,
    FiTrash2,
    FiChevronLeft,
    FiChevronRight,
    FiCheckCircle,
    FiX,
    FiBookmark,
    FiLayers,
    FiGrid,
    FiList,
    FiRefreshCw,
    FiCheck,
    FiAlertCircle,
    FiBriefcase,
    FiMapPin,
    FiArrowRight
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import PageTransition from '../components/PageTransition';
import AdminSidebar from '../components/AdminSidebar';
import Swal from 'sweetalert2';
import { apiUrl } from '../utils/api';

const CesPlantilla = () => {
    const { user, token } = useAuth();
    const navigate = useNavigate();

    // Data State
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [kpis, setKpis] = useState({
        totalPlantilla: 0,
        totalFilled: 0,
        totalVacant: 0,
        totalRegions: 0
    });
    const [filterOptions, setFilterOptions] = useState({
        regions: [],
        offices: [],
        positions: [],
        incumbents: [],
        salaryGrades: [],
        appointmentStatuses: [],
        regionOffices: {}
    });

    // View Mode ('table' or 'grid')
    const [viewMode, setViewMode] = useState('table');

    // Filtering & Pagination State
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [regionFilter, setRegionFilter] = useState('All');
    const [officeFilter, setOfficeFilter] = useState('All');
    const [profileFilter, setProfileFilter] = useState('All');
    const [positionFilter, setPositionFilter] = useState('All');
    const [salaryGradeFilter, setSalaryGradeFilter] = useState('All');
    const [appointmentStatusFilter, setAppointmentStatusFilter] = useState('All');
    const [vacancyFilter, setVacancyFilter] = useState('All'); // 'All', 'true', 'false'
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 20;
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [sortConfig, setSortConfig] = useState({ key: 'dbm_item_no', direction: 'asc' });

    // Modal State for Create / Edit
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
    const [modalItem, setModalItem] = useState(null);
    const [formData, setFormData] = useState({
        dbm_item_no: '',
        position_title: '',
        office_bureau_division: '',
        region: '',
        salary_grade: '26',
        incumbent_name: '',
        status_of_appointment: 'Permanent',
        is_vacant: false,
        is_active: true
    });
    const [formErrors, setFormErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Check user write permissions
    const canManagePlantilla = useMemo(() => {
        const allowedRoles = ['Central Office', 'CO_PD', 'Super User', 'Personnel Admin'];
        return allowedRoles.includes(user?.role);
    }, [user?.role]);

    // Available offices dynamically filtered by selected region (matching OfficialsRegistry pattern)
    const availableOffices = useMemo(() => {
        if (regionFilter !== 'All' && filterOptions.regionOffices?.[regionFilter]) {
            return filterOptions.regionOffices[regionFilter];
        }
        return filterOptions.offices || [];
    }, [regionFilter, filterOptions]);

    // Fetch plantilla data
    const fetchPlantilla = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            if (debouncedSearch) queryParams.append('search', debouncedSearch);
            if (regionFilter !== 'All') queryParams.append('region', regionFilter);
            if (officeFilter !== 'All') queryParams.append('office_bureau_division', officeFilter);
            if (profileFilter !== 'All') queryParams.append('incumbent_name', profileFilter);
            if (positionFilter !== 'All') queryParams.append('position_title', positionFilter);
            if (salaryGradeFilter !== 'All') queryParams.append('salary_grade', salaryGradeFilter);
            if (appointmentStatusFilter !== 'All') queryParams.append('status_of_appointment', appointmentStatusFilter);
            if (vacancyFilter !== 'All') queryParams.append('is_vacant', vacancyFilter);
            queryParams.append('page', currentPage);
            queryParams.append('limit', pageSize);
            queryParams.append('sortColumn', sortConfig.key);
            queryParams.append('sortDirection', sortConfig.direction);

            const res = await fetch(apiUrl(`/api/third-level/ces-plantilla?${queryParams.toString()}`), {
                headers: {
                    'Authorization': `Bearer ${token || localStorage.getItem('token')}`
                }
            });

            const data = await res.json();
            if (data.success) {
                setItems(data.data || []);
                setTotalRecords(data.pagination?.total || 0);
                setTotalPages(data.pagination?.totalPages || 1);
                if (data.kpis) {
                    setKpis(data.kpis);
                }
                if (data.filterOptions) {
                    setFilterOptions(data.filterOptions);
                }
            } else {
                console.error('Failed to load plantilla:', data.error);
            }
        } catch (err) {
            console.error('Network error loading plantilla positions:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlantilla();
    }, [debouncedSearch, regionFilter, officeFilter, profileFilter, positionFilter, salaryGradeFilter, appointmentStatusFilter, vacancyFilter, currentPage, pageSize, sortConfig]);

    // Sorting Handler
    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
        setCurrentPage(1);
    };

    // Reset all filters
    const handleResetFilters = () => {
        setSearchTerm('');
        setDebouncedSearch('');
        setRegionFilter('All');
        setOfficeFilter('All');
        setProfileFilter('All');
        setPositionFilter('All');
        setSalaryGradeFilter('All');
        setAppointmentStatusFilter('All');
        setVacancyFilter('All');
        setCurrentPage(1);
    };

    // Open Modal for Create
    const handleOpenCreate = () => {
        setModalMode('create');
        setModalItem(null);
        setFormData({
            dbm_item_no: '',
            position_title: '',
            office_bureau_division: '',
            region: filterOptions.regions[0] || 'Central Office',
            salary_grade: '26',
            incumbent_name: '',
            status_of_appointment: 'Permanent',
            is_vacant: false,
            is_active: true
        });
        setFormErrors({});
        setIsModalOpen(true);
    };

    // Open Modal for Edit
    const handleOpenEdit = (item) => {
        setModalMode('edit');
        setModalItem(item);
        setFormData({
            dbm_item_no: item.dbm_item_no || '',
            position_title: item.position_title || '',
            office_bureau_division: item.office_bureau_division || '',
            region: item.region || '',
            salary_grade: item.salary_grade || '26',
            incumbent_name: item.incumbent_name || '',
            status_of_appointment: item.status_of_appointment || 'Permanent',
            is_vacant: Boolean(item.is_vacant),
            is_active: item.is_active !== undefined ? Boolean(item.is_active) : true
        });
        setFormErrors({});
        setIsModalOpen(true);
    };

    // Form Validation
    const validateForm = () => {
        const errors = {};
        if (!formData.dbm_item_no.trim()) {
            errors.dbm_item_no = 'DBM Plantilla Item No is required.';
        } else {
            const upper = formData.dbm_item_no.trim().toUpperCase();
            if (upper === 'NEW ITEM' || upper === 'N/A (DETAILED)') {
                errors.dbm_item_no = 'Cannot use placeholder items ("New item" or "N/A (Detailed)").';
            }
        }
        if (!formData.position_title.trim()) {
            errors.position_title = 'Position Title is required.';
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Submit Create or Edit
    const handleSubmitForm = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        setSubmitting(true);
        try {
            const isEditing = modalMode === 'edit';
            const endpoint = isEditing 
                ? apiUrl(`/api/third-level/ces-plantilla/${modalItem.id}`)
                : apiUrl('/api/third-level/ces-plantilla');
            const method = isEditing ? 'PUT' : 'POST';

            const res = await fetch(endpoint, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token || localStorage.getItem('token')}`
                },
                body: JSON.stringify(formData)
            });

            const data = await res.json();
            if (data.success) {
                Swal.fire({
                    icon: 'success',
                    title: isEditing ? 'Position Updated' : 'Position Created',
                    text: isEditing 
                        ? `Plantilla item ${formData.dbm_item_no} updated successfully.` 
                        : `New plantilla position ${formData.dbm_item_no} added successfully.`,
                    timer: 2000,
                    showConfirmButton: false
                });
                setIsModalOpen(false);
                fetchPlantilla();
            } else {
                Swal.fire('Error', data.error || 'Failed to save position.', 'error');
            }
        } catch (err) {
            Swal.fire('Error', 'Failed to save position: ' + err.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // Delete Item
    const handleDeleteItem = async (item) => {
        const result = await Swal.fire({
            title: 'Delete Plantilla Position?',
            html: `<div class="text-left text-slate-600 text-sm space-y-2">
                <p>Are you sure you want to permanently delete:</p>
                <div class="p-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-[#08315F]">
                    <div>${item.position_title || 'Position'}</div>
                    <div class="text-xs text-sky-700 font-mono mt-0.5">${item.dbm_item_no}</div>
                </div>
                <p class="text-xs text-rose-500 font-black uppercase tracking-wider">This action cannot be undone.</p>
            </div>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#08315F',
            confirmButtonText: 'Yes, Delete Position',
            cancelButtonText: 'Cancel'
        });

        if (!result.isConfirmed) return;

        try {
            const res = await fetch(apiUrl(`/api/third-level/ces-plantilla/${item.id}`), {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token || localStorage.getItem('token')}`
                }
            });
            const data = await res.json();
            if (data.success) {
                Swal.fire({
                    title: 'Deleted!',
                    text: `Plantilla position ${item.dbm_item_no} was successfully deleted.`,
                    icon: 'success',
                    confirmButtonColor: '#08315F'
                });
                fetchPlantilla();
            } else {
                Swal.fire('Error', data.error || 'Failed to delete position.', 'error');
            }
        } catch (err) {
            Swal.fire('Error', 'Failed to delete position: ' + err.message, 'error');
        }
    };

    // Export CSV
    const handleExportCSV = async () => {
        try {
            const queryParams = new URLSearchParams();
            if (debouncedSearch) queryParams.append('search', debouncedSearch);
            if (regionFilter !== 'All') queryParams.append('region', regionFilter);
            if (officeFilter !== 'All') queryParams.append('office_bureau_division', officeFilter);
            if (profileFilter !== 'All') queryParams.append('incumbent_name', profileFilter);
            if (positionFilter !== 'All') queryParams.append('position_title', positionFilter);
            if (salaryGradeFilter !== 'All') queryParams.append('salary_grade', salaryGradeFilter);
            if (appointmentStatusFilter !== 'All') queryParams.append('status_of_appointment', appointmentStatusFilter);
            if (vacancyFilter !== 'All') queryParams.append('is_vacant', vacancyFilter);
            queryParams.append('limit', 'all');
            queryParams.append('sortColumn', sortConfig.key);
            queryParams.append('sortDirection', sortConfig.direction);

            const res = await fetch(apiUrl(`/api/third-level/ces-plantilla?${queryParams.toString()}`), {
                headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
            });
            const result = await res.json();
            if (!result.success || !result.data?.length) {
                Swal.fire('Notice', 'No data available to export.', 'info');
                return;
            }

            const headers = ['DBM Item No', 'Position Title', 'Office / Bureau / Division', 'Region', 'Salary Grade', 'Incumbent Name', 'Status of Appointment', 'Vacancy Status'];
            const rows = result.data.map(d => [
                `"${(d.dbm_item_no || '').replace(/"/g, '""')}"`,
                `"${(d.position_title || '').replace(/"/g, '""')}"`,
                `"${(d.office_bureau_division || '').replace(/"/g, '""')}"`,
                `"${(d.region || '').replace(/"/g, '""')}"`,
                `"${d.salary_grade || ''}"`,
                `"${(d.incumbent_name || '').replace(/"/g, '""')}"`,
                `"${(d.status_of_appointment || '').replace(/"/g, '""')}"`,
                `"${d.is_vacant ? 'Vacant' : 'Filled'}"`
            ]);

            const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', `CES_Plantilla_Positions_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            Swal.fire('Error', 'Failed to export CSV: ' + err.message, 'error');
        }
    };

    // Dynamic Pagination Buttons (matching OfficialsRegistry.jsx)
    const pageButtons = useMemo(() => {
        const visible = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1].filter(page => page >= 1 && page <= totalPages));
        const pages = [];
        let previous = 0;
        [...visible].sort((a, b) => a - b).forEach(page => {
            if (page - previous > 1) pages.push('ellipsis-' + page);
            pages.push(page);
            previous = page;
        });
        return pages;
    }, [currentPage, totalPages]);

    // Columns Definition with integrated header dropdown filters
    const tableColumns = useMemo(() => [
        {
            key: 'region',
            label: 'Region',
            width: 'w-[10%]',
            filterValue: regionFilter,
            onFilterChange: (val) => {
                setRegionFilter(val);
                setOfficeFilter('All');
                setCurrentPage(1);
            },
            options: filterOptions.regions
        },
        {
            key: 'office_bureau_division',
            label: 'Division / Office',
            width: 'w-[16%]',
            filterValue: officeFilter,
            onFilterChange: (val) => { setOfficeFilter(val); setCurrentPage(1); },
            options: availableOffices
        },
        {
            key: 'profile',
            label: 'Plantilla Profile',
            width: 'w-[25%]',
            filterValue: profileFilter,
            onFilterChange: (val) => { setProfileFilter(val); setCurrentPage(1); },
            options: ['VACANT POSITION', ...(filterOptions.incumbents || [])]
        },
        {
            key: 'position_title',
            label: 'Position Title',
            width: 'w-[15%]',
            filterValue: positionFilter,
            onFilterChange: (val) => { setPositionFilter(val); setCurrentPage(1); },
            options: filterOptions.positions || []
        },
        {
            key: 'salary_grade',
            label: 'SG',
            width: 'w-[7%]',
            filterValue: salaryGradeFilter,
            onFilterChange: (val) => { setSalaryGradeFilter(val); setCurrentPage(1); },
            options: filterOptions.salaryGrades.map(sg => `SG ${sg}`),
            mapOptionValue: (val) => val === 'All' ? 'All' : val.replace(/^SG\s*/, '')
        },
        {
            key: 'status_of_appointment',
            label: 'Appointment',
            width: 'w-[10%]',
            filterValue: appointmentStatusFilter,
            onFilterChange: (val) => { setAppointmentStatusFilter(val); setCurrentPage(1); },
            options: filterOptions.appointmentStatuses
        },
        {
            key: 'is_vacant',
            label: 'Status',
            width: 'w-[9%]',
            filterValue: vacancyFilter === 'All' ? 'All' : (vacancyFilter === 'true' ? 'Vacant' : 'Filled'),
            onFilterChange: (val) => {
                const map = { 'All': 'All', 'Vacant': 'true', 'Filled': 'false' };
                setVacancyFilter(map[val] || 'All');
                setCurrentPage(1);
            },
            options: ['Filled', 'Vacant']
        }
    ], [regionFilter, officeFilter, positionFilter, salaryGradeFilter, appointmentStatusFilter, vacancyFilter, filterOptions, availableOffices]);

    return (
        <PageTransition>
            <div className="flex h-screen bg-transparent font-sans overflow-hidden">
                <AdminSidebar />

                <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto relative bg-transparent">
                    {/* TOP NAVIGATION BAR (IDENTICAL TO OFFICIALS REGISTRY) */}
                    <header className="sticky top-0 z-50 bg-[#08315F] backdrop-blur-md border-b border-blue-900 px-8 py-4 flex items-center justify-between shadow-lg shadow-blue-900/20 shrink-0 w-full">
                        <div className="flex items-center gap-4 text-white">
                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white shadow-inner">
                                <FiBookmark size={20} />
                            </div>
                            <div>
                                <h1 className="text-lg font-['Plus_Jakarta_Sans'] font-black text-white tracking-tight leading-none italic uppercase">
                                    CES Plantilla <span className="text-blue-300 not-italic">Registry</span>
                                </h1>
                                <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest mt-1">
                                    Plantilla Management • Career Executive Service Command Dashboard
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="hidden md:flex flex-col items-end">
                                <span className="text-xs font-['Plus_Jakarta_Sans'] font-black text-white leading-none">
                                    {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : 'System Admin'}
                                </span>
                                <span className="text-[9px] font-bold text-[#FBBF24] uppercase tracking-widest mt-1">
                                    {user?.role || 'Central Office'}
                                </span>
                            </div>
                        </div>
                    </header>

                    <main className="flex-1 px-8 pb-8 pt-6 max-w-[1600px] mx-auto w-full dashboard-theme !bg-transparent">
                        {/* UNIFIED DATA CONTROLS TAB (IDENTICAL PILL STYLE FROM OFFICIALS REGISTRY) */}
                        <div className="bg-white border-2 border-[#08315F] rounded-[24px] p-3 shadow-sm mb-6 flex flex-col gap-2.5">
                            {/* TOP ROW: FILTERS */}
                            <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-2 w-full">
                                {/* DROPDOWNS */}
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 xl:flex xl:flex-[6] gap-2">
                                    {/* Region Dropdown */}
                                    <div className="relative w-full xl:flex-1 h-[44px] bg-[#F0F9FF] border-2 border-[#BAE6FD] rounded-full focus-within:border-sky-400 transition-colors">
                                        <select
                                            value={regionFilter}
                                            onChange={(e) => {
                                                setRegionFilter(e.target.value);
                                                setOfficeFilter('All');
                                                setCurrentPage(1);
                                            }}
                                            title={regionFilter}
                                            className="w-full h-full bg-transparent pl-4 pr-7 text-[16.5px] font-bold text-[#08315F] outline-none appearance-none cursor-pointer text-ellipsis"
                                        >
                                            <option value="All">All Regions</option>
                                            {filterOptions.regions.map(r => (
                                                <option key={r} value={r}>{r}</option>
                                            ))}
                                        </select>
                                        <FiChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-sky-500 pointer-events-none" size={16} />
                                    </div>

                                    {/* Office / Bureau / Division Dropdown */}
                                    <div className="relative w-full xl:flex-1 h-[44px] bg-[#F0F9FF] border-2 border-[#BAE6FD] rounded-full focus-within:border-sky-400 transition-colors">
                                        <select
                                            value={officeFilter}
                                            onChange={(e) => { setOfficeFilter(e.target.value); setCurrentPage(1); }}
                                            title={officeFilter === 'All' ? 'All Offices' : officeFilter}
                                            className="w-full h-full bg-transparent pl-4 pr-7 text-[16.5px] font-bold text-[#08315F] outline-none appearance-none cursor-pointer text-ellipsis"
                                        >
                                            <option value="All">All Offices / Divisions</option>
                                            {availableOffices.map(o => (
                                                <option key={o} value={o}>{o}</option>
                                            ))}
                                        </select>
                                        <FiChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-sky-500 pointer-events-none" size={16} />
                                    </div>

                                    {/* Position Title Dropdown */}
                                    <div className="relative w-full xl:flex-1 h-[44px] bg-[#F0F9FF] border-2 border-[#BAE6FD] rounded-full focus-within:border-sky-400 transition-colors">
                                        <select
                                            value={positionFilter}
                                            onChange={(e) => { setPositionFilter(e.target.value); setCurrentPage(1); }}
                                            title={positionFilter === 'All' ? 'All Positions' : positionFilter}
                                            className="w-full h-full bg-transparent pl-4 pr-7 text-[16.5px] font-bold text-[#08315F] outline-none appearance-none cursor-pointer text-ellipsis"
                                        >
                                            <option value="All">All Positions</option>
                                            {(filterOptions.positions || []).map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                        <FiChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-sky-500 pointer-events-none" size={16} />
                                    </div>

                                    {/* Salary Grade Dropdown */}
                                    <div className="relative w-full xl:flex-1 h-[44px] bg-[#F0F9FF] border-2 border-[#BAE6FD] rounded-full focus-within:border-sky-400 transition-colors">
                                        <select
                                            value={salaryGradeFilter}
                                            onChange={(e) => { setSalaryGradeFilter(e.target.value); setCurrentPage(1); }}
                                            title={salaryGradeFilter === 'All' ? 'All Salary Grades' : `SG ${salaryGradeFilter}`}
                                            className="w-full h-full bg-transparent pl-4 pr-7 text-[16.5px] font-bold text-[#08315F] outline-none appearance-none cursor-pointer text-ellipsis"
                                        >
                                            <option value="All">All Salary Grades</option>
                                            {filterOptions.salaryGrades.map(sg => (
                                                <option key={sg} value={sg}>SG {sg}</option>
                                            ))}
                                        </select>
                                        <FiChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-sky-500 pointer-events-none" size={16} />
                                    </div>

                                    {/* Appointment Status Dropdown */}
                                    <div className="relative w-full xl:flex-1 h-[44px] bg-[#F0F9FF] border-2 border-[#BAE6FD] rounded-full focus-within:border-sky-400 transition-colors">
                                        <select
                                            value={appointmentStatusFilter}
                                            onChange={(e) => { setAppointmentStatusFilter(e.target.value); setCurrentPage(1); }}
                                            title={appointmentStatusFilter === 'All' ? 'All Appointments' : appointmentStatusFilter}
                                            className="w-full h-full bg-transparent pl-4 pr-7 text-[16.5px] font-bold text-[#08315F] outline-none appearance-none cursor-pointer text-ellipsis"
                                        >
                                            <option value="All">All Appointments</option>
                                            {filterOptions.appointmentStatuses.map(st => (
                                                <option key={st} value={st}>{st}</option>
                                            ))}
                                        </select>
                                        <FiChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-sky-500 pointer-events-none" size={16} />
                                    </div>

                                    {/* Vacancy Status Dropdown */}
                                    <div className="relative w-full xl:flex-1 h-[44px] bg-[#F0F9FF] border-2 border-[#BAE6FD] rounded-full focus-within:border-sky-400 transition-colors">
                                        <select
                                            value={vacancyFilter}
                                            onChange={(e) => { setVacancyFilter(e.target.value); setCurrentPage(1); }}
                                            title={vacancyFilter === 'All' ? 'All Positions' : (vacancyFilter === 'true' ? 'Vacant Only' : 'Filled Only')}
                                            className="w-full h-full bg-transparent pl-4 pr-7 text-[16.5px] font-bold text-[#08315F] outline-none appearance-none cursor-pointer text-ellipsis"
                                        >
                                            <option value="All">All Statuses</option>
                                            <option value="false">Filled Positions</option>
                                            <option value="true">Vacant Positions</option>
                                        </select>
                                        <FiChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-sky-500 pointer-events-none" size={16} />
                                    </div>
                                </div>

                                {/* BUTTONS */}
                                <div className="flex items-center gap-2 w-full xl:w-auto">
                                    {/* Reset Filters */}
                                    <button
                                        onClick={handleResetFilters}
                                        className="h-[44px] px-5 flex-1 xl:flex-none bg-transparent text-rose-500 rounded-full border-2 border-rose-200 font-black text-[15px] tracking-widest uppercase hover:bg-rose-50 hover:text-rose-600 transition-colors flex items-center justify-center whitespace-nowrap shrink-0"
                                        title="Reset all filters"
                                    >
                                        Reset
                                    </button>

                                    {/* Export CSV Button */}
                                    <button
                                        onClick={handleExportCSV}
                                        className="h-[44px] px-5 flex-1 xl:flex-none bg-[#F0F9FF] text-[#08315F] rounded-full border-2 border-[#BAE6FD] font-black text-[15px] tracking-widest uppercase hover:bg-sky-100 transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                                        title="Export CSV"
                                    >
                                        <FiDownload size={15} className="text-sky-500" />
                                        <span>Export CSV</span>
                                    </button>

                                    {/* Add Position Button (For authorized roles) */}
                                    {canManagePlantilla && (
                                        <button
                                            onClick={handleOpenCreate}
                                            className="h-[44px] px-5 flex-1 xl:flex-none bg-[#08315F] text-white rounded-full border-2 border-[#08315F] font-black text-[15px] tracking-widest uppercase hover:bg-[#004A99] transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 shadow-sm"
                                            title="Add New CES Plantilla Position"
                                        >
                                            <FiPlus size={16} className="text-[#FBBF24]" />
                                            <span>Add Position</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* BOTTOM ROW: SEARCH BAR & VIEW TOGGLES */}
                            <div className="flex items-center gap-2 w-full">
                                <div className="relative flex-1 h-[44px]">
                                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#08315F]/50" size={16} />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Search by DBM item no, position, bureau, division, or incumbent..."
                                        className="w-full h-full bg-[#F0F9FF] border-2 border-[#BAE6FD] rounded-full py-0 pl-11 pr-4 text-[16.5px] font-bold text-[#08315F] outline-none focus:border-sky-400 placeholder:text-[#08315F]/50 transition-colors"
                                    />
                                </div>
                                {/* VIEW TOGGLES */}
                                <div className="flex items-center gap-2 shrink-0 px-1">
                                    <button
                                        onClick={() => setViewMode('table')}
                                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${viewMode === 'table' ? 'bg-[#08315F] text-white border-b-[3px] border-[#FBBF24] shadow-sm transform -translate-y-[1px]' : 'bg-[#E0F2FE] text-[#08315F] hover:bg-[#BAE6FD]'}`}
                                        title="Table view"
                                    >
                                        <FiList size={16} />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('grid')}
                                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${viewMode === 'grid' ? 'bg-[#08315F] text-white border-b-[3px] border-[#FBBF24] shadow-sm transform -translate-y-[1px]' : 'bg-[#E0F2FE] text-[#08315F] hover:bg-[#BAE6FD]'}`}
                                        title="Grid view"
                                    >
                                        <FiGrid size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* STATS CARDS (EXACT MATCH TO OFFICIALS REGISTRY KPI CARDS) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 w-full">
                            {/* Card 1: Total Plantilla Positions */}
                            <div
                                onClick={() => {
                                    setVacancyFilter('All');
                                    setCurrentPage(1);
                                }}
                                className={`min-h-[100px] p-5 bg-white rounded-[16px] border-2 border-[#BAE6FD] border-l-[6px] overflow-hidden cursor-pointer transition-all flex flex-col justify-between ${vacancyFilter === 'All' ? 'border-l-sky-400 shadow-md ring-1 ring-sky-200' : 'border-l-sky-300 hover:shadow-sm'}`}
                            >
                                <div className="text-[15px] text-slate-500 uppercase tracking-widest font-bold mb-3">Total Plantilla Positions</div>
                                <div className="text-[48px] text-[#08315F] font-normal leading-none mb-3 font-['Plus_Jakarta_Sans']">
                                    {loading ? '...' : kpis.totalPlantilla}
                                </div>
                                <div className="text-[13.5px] text-slate-400 uppercase tracking-widest font-bold leading-none">Authorized Plantilla Items</div>
                            </div>

                            {/* Card 2: Total Vacant Positions */}
                            <div
                                onClick={() => {
                                    setVacancyFilter(prev => prev === 'true' ? 'All' : 'true');
                                    setCurrentPage(1);
                                }}
                                className={`min-h-[100px] p-5 bg-white rounded-[16px] border-2 border-[#BAE6FD] border-l-[6px] overflow-hidden cursor-pointer transition-all flex flex-col justify-between ${vacancyFilter === 'true' ? 'border-l-rose-500 shadow-md ring-1 ring-rose-200' : 'border-l-rose-400 hover:shadow-sm'}`}
                            >
                                <div className="text-[15px] text-slate-500 uppercase tracking-widest font-bold mb-3">Total Vacant Positions</div>
                                <div className="text-[48px] text-[#08315F] font-normal leading-none mb-3 font-['Plus_Jakarta_Sans']">
                                    {loading ? '...' : kpis.totalVacant}
                                </div>
                                <div className="text-[13.5px] text-slate-400 uppercase tracking-widest font-bold leading-none">Unfilled / Open Items</div>
                            </div>

                            {/* Card 3: Total Filled Positions */}
                            <div
                                onClick={() => {
                                    setVacancyFilter(prev => prev === 'false' ? 'All' : 'false');
                                    setCurrentPage(1);
                                }}
                                className={`min-h-[100px] p-5 bg-white rounded-[16px] border-2 border-[#BAE6FD] border-l-[6px] overflow-hidden cursor-pointer transition-all flex flex-col justify-between ${vacancyFilter === 'false' ? 'border-l-emerald-500 shadow-md ring-1 ring-emerald-200' : 'border-l-emerald-400 hover:shadow-sm'}`}
                            >
                                <div className="text-[15px] text-slate-500 uppercase tracking-widest font-bold mb-3">Total Filled Positions</div>
                                <div className="text-[48px] text-[#08315F] font-normal leading-none mb-3 font-['Plus_Jakarta_Sans']">
                                    {loading ? '...' : kpis.totalFilled}
                                </div>
                                <div className="text-[13.5px] text-slate-400 uppercase tracking-widest font-bold leading-none">Positions with Active Incumbent</div>
                            </div>

                            {/* Card 4: Covered Regions */}
                            <div className="min-h-[100px] p-5 bg-white rounded-[16px] border-2 border-[#BAE6FD] border-l-[6px] border-l-indigo-400 overflow-hidden transition-all flex flex-col justify-between shadow-sm">
                                <div className="text-[15px] text-slate-500 uppercase tracking-widest font-bold mb-3">Covered Regions</div>
                                <div className="text-[48px] text-[#08315F] font-normal leading-none mb-3 font-['Plus_Jakarta_Sans']">
                                    {loading ? '...' : kpis.totalRegions}
                                </div>
                                <div className="text-[13.5px] text-slate-400 uppercase tracking-widest font-bold leading-none">Administrative Jurisdictions</div>
                            </div>
                        </div>

                        {/* MAIN CONTENT AREA */}
                        <AnimatePresence mode="wait">
                            {loading ? (
                                <div className="h-96 flex items-center justify-center">
                                    <div className="w-12 h-12 border-4 border-[#08315F]/10 border-t-[#08315F] rounded-full animate-spin"></div>
                                </div>
                            ) : items.length === 0 ? (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-[30px] border-2 border-[#08315F] p-20 text-center shadow-sm">
                                    <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <FiSearch size={40} />
                                    </div>
                                    <h3 className="text-xl font-['Plus_Jakarta_Sans'] font-black text-[#08315F] uppercase italic tracking-tight">No Plantilla Positions Found</h3>
                                    <p className="text-slate-400 font-medium mt-2">Adjust your filters or try a different search term.</p>
                                    <button
                                        onClick={handleResetFilters}
                                        className="mt-6 px-6 py-2.5 bg-[#08315F] text-white rounded-full font-black text-[15px] uppercase tracking-wider hover:bg-[#004A99] transition-all"
                                    >
                                        Reset Filters
                                    </button>
                                </motion.div>
                            ) : viewMode === 'table' ? (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card !rounded-[30px] !border-2 !border-[#08315F] overflow-hidden bg-white shadow-sm">
                                    <div className="w-full">
                                        <table className="hidden md:table w-full text-left border-collapse table-fixed">
                                            <thead>
                                                <tr className="bg-white border-b-2 border-slate-200">
                                                    {tableColumns.map((column) => (
                                                        <th key={column.key} className={`px-2 py-4 text-left align-top relative ${column.width || ''}`}>
                                                            <div className="flex flex-col gap-3 mt-1 pr-4">
                                                                <button
                                                                    onClick={() => handleSort(column.key === 'profile' ? 'incumbent_name' : column.key)}
                                                                    className="flex items-center justify-between h-5 text-[13.5px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors w-full text-left group"
                                                                >
                                                                    <span>{column.label}</span>
                                                                    <span className={`text-base leading-none flex items-center w-3 justify-end transition-colors ${sortConfig.key === (column.key === 'profile' ? 'incumbent_name' : column.key) ? 'text-[#08315F]' : 'text-slate-200 group-hover:text-slate-400'}`}>
                                                                        {sortConfig.key === (column.key === 'profile' ? 'incumbent_name' : column.key)
                                                                            ? (sortConfig.direction === 'asc' ? '↑' : '↓')
                                                                            : '↓'}
                                                                    </span>
                                                                </button>
                                                                {column.options ? (
                                                                    <select
                                                                        value={column.filterValue || 'All'}
                                                                        onChange={(e) => {
                                                                            const val = column.mapOptionValue ? column.mapOptionValue(e.target.value) : e.target.value;
                                                                            column.onFilterChange(val);
                                                                        }}
                                                                        title={column.filterValue || 'All'}
                                                                        className="w-full bg-white border-2 border-sky-200 rounded-lg py-1.5 font-bold text-[#08315F] outline-none focus:border-sky-400 transition-colors px-3 text-[16.5px] truncate"
                                                                    >
                                                                        <option value="All">All</option>
                                                                        {column.options.map(option => (
                                                                            <option key={option} value={option}>{option}</option>
                                                                        ))}
                                                                    </select>
                                                                ) : (
                                                                    <div className="h-[38px] flex items-center">
                                                                        <span className="text-[12px] font-bold text-slate-300 uppercase tracking-wider">—</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </th>
                                                    ))}
                                                    {canManagePlantilla && (
                                                        <th className="px-3 py-4 text-center align-top relative w-[8%]">
                                                            <div className="flex flex-col gap-3 mt-1">
                                                                <div className="h-5 flex items-center justify-center text-[13.5px] font-black text-slate-400 uppercase tracking-widest">
                                                                    Actions
                                                                </div>
                                                                <div className="h-[38px]"></div>
                                                            </div>
                                                        </th>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y-2 divide-slate-200/60 bg-white">
                                                {items.map((item) => (
                                                    <tr key={item.id} className="group transition-colors relative hover:bg-slate-50/80">
                                                        {/* Region */}
                                                        <td className="px-3 py-4 align-middle max-w-[120px]">
                                                            <div className="font-black text-[#08315F] text-[15px] uppercase tracking-tight truncate" title={item.region || 'N/A'}>
                                                                <span>{item.region || 'N/A'}</span>
                                                            </div>
                                                        </td>

                                                        {/* Office / Bureau / Division */}
                                                        <td className="px-2 py-4 align-middle max-w-[200px]">
                                                            <div className="text-[15px] font-bold text-slate-700 uppercase tracking-widest truncate" title={item.office_bureau_division || 'N/A'}>
                                                                {item.office_bureau_division || 'N/A'}
                                                            </div>
                                                        </td>

                                                        {/* Incumbent / Plantilla Profile (Matching OfficialsRegistry style) */}
                                                        <td className="px-2 py-4 align-middle">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-blue-500 font-black text-sm border-2 border-white shadow-sm overflow-hidden shrink-0">
                                                                    <FiBriefcase size={18} />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <div className="font-['Plus_Jakarta_Sans'] font-black text-[#08315F] text-[20px] leading-none transition-colors truncate">
                                                                            {item.is_vacant || !item.incumbent_name || item.incumbent_name.toUpperCase() === 'VACANT' ? (
                                                                                <span className="text-rose-500 italic tracking-widest text-[15px]">VACANT POSITION</span>
                                                                            ) : (
                                                                                <span>{item.incumbent_name}</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-[13.5px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1.5 truncate">
                                                                        <FiArrowRight className="text-[#075985] shrink-0" size={10} />
                                                                        <span className="text-[#075985] font-black tracking-normal" title="DBM Plantilla Item No.">
                                                                            {item.dbm_item_no}
                                                                        </span>
                                                                        {item.source_row_number && (
                                                                            <>
                                                                                <span className="mx-1 text-slate-300">•</span>
                                                                                <span className="text-slate-400 font-bold" title="Source Row Number">
                                                                                    Row #{item.source_row_number}
                                                                                </span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* Position Title */}
                                                        <td className="px-2 py-4 align-middle">
                                                            <div className="text-[15px] font-bold text-[#08315F] uppercase tracking-wide truncate" title={item.position_title}>
                                                                {item.position_title || 'Unassigned'}
                                                            </div>
                                                        </td>

                                                        {/* Salary Grade */}
                                                        <td className="px-2 py-4 align-middle text-center">
                                                            {item.salary_grade ? (
                                                                <span className="inline-block px-2.5 py-1 rounded-full bg-slate-100 border-2 border-slate-200 text-[#08315F] text-[12px] font-black uppercase tracking-wider">
                                                                    SG {item.salary_grade}
                                                                </span>
                                                            ) : '—'}
                                                        </td>

                                                        {/* Status of Appointment */}
                                                        <td className="px-2 py-4 align-middle">
                                                            {item.status_of_appointment ? (
                                                                <span className="inline-block px-2.5 py-1 rounded-full bg-sky-50 text-[#075985] border-2 border-sky-200 text-[12px] font-black uppercase tracking-wider truncate max-w-full" title={item.status_of_appointment}>
                                                                    {item.status_of_appointment}
                                                                </span>
                                                            ) : '—'}
                                                        </td>

                                                        {/* Vacancy Status & Post Occupancy Badge */}
                                                        <td className="px-2 py-4 align-middle text-center">
                                                            <div className="flex flex-col items-center justify-center gap-1">
                                                                <span className={`px-3 py-0.5 rounded-full text-[13px] font-black uppercase tracking-widest border-2 ${item.is_vacant ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                                                                    {item.is_vacant ? 'Vacant' : 'Filled'}
                                                                </span>
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${item.is_active !== false ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                                    {item.is_active !== false ? 'Active Post' : 'Inactive Post'}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        {/* Actions */}
                                                        {canManagePlantilla && (
                                                            <td className="px-3 py-4 align-middle text-center">
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    <button
                                                                        onClick={() => handleOpenEdit(item)}
                                                                        title="Edit Position"
                                                                        className="p-2 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-500 hover:text-white border-2 border-amber-200 transition-all active:scale-95 shadow-sm"
                                                                    >
                                                                        <FiEdit2 size={13} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteItem(item)}
                                                                        title="Delete Position"
                                                                        className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white border-2 border-rose-200 transition-all active:scale-95 shadow-sm"
                                                                    >
                                                                        <FiTrash2 size={13} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        {/* Mobile View Cards (md:hidden) */}
                                        <div className="md:hidden divide-y-2 divide-slate-200/60 bg-white">
                                            {items.map((item) => (
                                                <div key={item.id} className="p-4 hover:bg-slate-50/50 transition-colors flex flex-col gap-3">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-blue-500 font-black text-sm border-2 border-white shadow-sm overflow-hidden shrink-0">
                                                                <FiBriefcase size={18} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="font-['Plus_Jakarta_Sans'] font-black text-[#08315F] text-[18px] leading-tight truncate">
                                                                    {item.is_vacant || !item.incumbent_name || item.incumbent_name.toUpperCase() === 'VACANT' ? (
                                                                        <span className="text-rose-500 italic tracking-widest text-[14px]">VACANT POSITION</span>
                                                                    ) : (
                                                                        <span>{item.incumbent_name}</span>
                                                                    )}
                                                                </div>
                                                                <div className="text-[13px] font-bold text-[#075985] font-mono mt-0.5 truncate">
                                                                    {item.dbm_item_no}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border-2 shrink-0 ${item.is_vacant ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                                                            {item.is_vacant ? 'Vacant' : 'Filled'}
                                                        </span>
                                                    </div>

                                                    <div className="flex flex-col gap-1.5 bg-slate-50/50 rounded-xl p-3 border-2 border-slate-200 text-[13.5px]">
                                                        <div className="flex justify-between items-center gap-2">
                                                            <span className="font-black text-slate-400 uppercase tracking-widest shrink-0">Position</span>
                                                            <span className="font-black text-[#08315F] text-right truncate">{item.position_title || 'Unassigned'}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center gap-2">
                                                            <span className="font-black text-slate-400 uppercase tracking-widest shrink-0">Region / Office</span>
                                                            <span className="font-bold text-slate-700 text-right truncate">{item.region} • {item.office_bureau_division || 'No Division'}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center gap-2">
                                                            <span className="font-black text-slate-400 uppercase tracking-widest shrink-0">SG / Status</span>
                                                            <span className="font-bold text-[#08315F] text-right">SG {item.salary_grade || '—'} • {item.status_of_appointment || '—'}</span>
                                                        </div>
                                                    </div>

                                                    {canManagePlantilla && (
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <button
                                                                onClick={() => handleOpenEdit(item)}
                                                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 rounded-lg text-[13.5px] font-black uppercase tracking-widest border-2 border-amber-200 hover:bg-amber-500 hover:text-white transition-all"
                                                            >
                                                                <FiEdit2 size={13} /> Edit
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteItem(item)}
                                                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 rounded-lg text-[13.5px] font-black uppercase tracking-widest border-2 border-rose-200 hover:bg-rose-600 hover:text-white transition-all"
                                                            >
                                                                <FiTrash2 size={13} /> Delete
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* TABLE FOOTER / PAGINATION (IDENTICAL TO OFFICIALS REGISTRY) */}
                                        <div className="px-8 py-5 bg-white border-t-2 border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <span className="text-[15px] font-black text-slate-400 uppercase tracking-widest">
                                                Showing {totalRecords === 0 ? 0 : ((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} records
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    disabled={currentPage === 1}
                                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                    className="px-4 py-2 bg-white border-2 border-slate-200 text-slate-500 rounded-xl text-[15px] font-black uppercase tracking-widest disabled:opacity-40 hover:bg-slate-50 transition-colors"
                                                >
                                                    Previous
                                                </button>
                                                {pageButtons.map(page => typeof page === 'number' ? (
                                                    <button
                                                        key={page}
                                                        onClick={() => setCurrentPage(page)}
                                                        className={`w-10 h-10 rounded-xl text-[15px] font-black border-2 transition-all ${currentPage === page ? 'bg-[#08315F] text-white border-[#004A99]' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-200'}`}
                                                    >
                                                        {page}
                                                    </button>
                                                ) : (
                                                    <span key={page} className="px-1 text-[15px] font-black text-slate-300">...</span>
                                                ))}
                                                <span className="px-2 py-2 text-[15px] font-black text-slate-400 uppercase tracking-widest">
                                                    Page {currentPage} of {totalPages}
                                                </span>
                                                <button
                                                    disabled={currentPage === totalPages}
                                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                    className="px-4 py-2 bg-white border-2 border-slate-200 text-slate-500 rounded-xl text-[15px] font-black uppercase tracking-widest disabled:opacity-40 hover:bg-slate-50 transition-colors"
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                /* GRID VIEW (IDENTICAL CARD DESIGN SYSTEM) */
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {items.map((item) => (
                                            <motion.div
                                                key={item.id}
                                                whileHover={{ y: -4 }}
                                                className="bg-white rounded-[1.5rem] p-5 border-2 border-[#08315F] shadow-lg shadow-slate-200/40 group flex flex-col justify-between h-full relative overflow-hidden"
                                            >
                                                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/30 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                                                <div>
                                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                                        <div className="w-12 h-12 rounded-[1rem] bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center text-blue-500 font-black text-xl border-2 border-white shadow-md overflow-hidden shrink-0">
                                                            <FiBriefcase size={20} />
                                                        </div>
                                                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                                            {item.salary_grade && (
                                                                <span className="px-2 py-0.5 bg-sky-50 text-[#075985] border-2 border-sky-200 rounded-full text-[11px] font-black uppercase tracking-widest">
                                                                    SG {item.salary_grade}
                                                                </span>
                                                            )}
                                                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-widest border-2 ${item.is_vacant ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                                                                {item.is_vacant ? 'Vacant' : 'Filled'}
                                                            </span>
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${item.is_active !== false ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                                {item.is_active !== false ? 'Active' : 'Inactive'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1 relative z-10">
                                                        <h3 className="text-[20px] font-['Plus_Jakarta_Sans'] font-black text-[#08315F] tracking-tighter leading-tight uppercase italic line-clamp-2" title={item.position_title}>
                                                            {item.position_title || 'Unassigned Position'}
                                                        </h3>
                                                        <p className="text-[13px] font-bold text-[#075985] font-mono tracking-tight">
                                                            {item.dbm_item_no}
                                                        </p>
                                                        <div className="pt-2 text-[15px] font-bold text-slate-700">
                                                            {item.is_vacant || !item.incumbent_name || item.incumbent_name.toUpperCase() === 'VACANT' ? (
                                                                <span className="text-rose-500 italic tracking-widest font-black text-[13.5px]">VACANT POSITION</span>
                                                            ) : (
                                                                <span className="font-black text-slate-800">{item.incumbent_name}</span>
                                                            )}
                                                        </div>
                                                        <div className="text-[12px] font-bold text-slate-400 uppercase tracking-wider pt-1">
                                                            {item.region} • {item.office_bureau_division || 'No Division'}
                                                        </div>
                                                    </div>
                                                </div>

                                                {canManagePlantilla && (
                                                    <div className="flex items-center gap-2 mt-4 pt-3 border-t-2 border-slate-100 relative z-10">
                                                        <button
                                                            onClick={() => handleOpenEdit(item)}
                                                            className="flex-1 py-2 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-500 hover:text-white border-2 border-amber-200 text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                                                        >
                                                            <FiEdit2 size={13} /> Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteItem(item)}
                                                            className="flex-1 py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white border-2 border-rose-200 text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                                                        >
                                                            <FiTrash2 size={13} /> Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </motion.div>
                                        ))}
                                    </div>

                                    {/* GRID VIEW PAGINATION FOOTER */}
                                    <div className="px-8 py-5 bg-white border-2 border-[#08315F] rounded-[24px] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                                        <span className="text-[15px] font-black text-slate-400 uppercase tracking-widest">
                                            Showing {totalRecords === 0 ? 0 : ((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} records
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                disabled={currentPage === 1}
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                className="px-4 py-2 bg-white border-2 border-slate-200 text-slate-500 rounded-xl text-[15px] font-black uppercase tracking-widest disabled:opacity-40 hover:bg-slate-50 transition-colors"
                                            >
                                                Previous
                                            </button>
                                            {pageButtons.map(page => typeof page === 'number' ? (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`w-10 h-10 rounded-xl text-[15px] font-black border-2 transition-all ${currentPage === page ? 'bg-[#08315F] text-white border-[#004A99]' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-200'}`}
                                                >
                                                    {page}
                                                </button>
                                            ) : (
                                                <span key={page} className="px-1 text-[15px] font-black text-slate-300">...</span>
                                            ))}
                                            <span className="px-2 py-2 text-[15px] font-black text-slate-400 uppercase tracking-widest">
                                                Page {currentPage} of {totalPages}
                                            </span>
                                            <button
                                                disabled={currentPage === totalPages}
                                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                className="px-4 py-2 bg-white border-2 border-slate-200 text-slate-500 rounded-xl text-[15px] font-black uppercase tracking-widest disabled:opacity-40 hover:bg-slate-50 transition-colors"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </main>

                    {/* CREATE / EDIT MODAL (MATCHING OFFICIALS REGISTRY 3rem MODAL DESIGN SYSTEM) */}
                    {createPortal(
                        <AnimatePresence>
                            {isModalOpen && (
                                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: 30 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 30 }}
                                        className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl border-2 border-white/50 overflow-hidden flex flex-col max-h-[90vh]"
                                    >
                                        <div className="overflow-y-auto custom-scrollbar w-full h-full p-10">
                                            <div className="flex justify-between items-start mb-8">
                                                <div>
                                                    <span className="text-[15px] font-black text-[#075985] uppercase tracking-widest mb-2 block">
                                                        {modalMode === 'create' ? 'Plantilla Entry Creation' : 'Plantilla Modification'}
                                                    </span>
                                                    <h2 className="text-[36px] font-['Plus_Jakarta_Sans'] font-black text-[#08315F] tracking-tighter uppercase italic leading-none">
                                                        {modalMode === 'create' ? 'Add Plantilla Position' : 'Edit Plantilla Position'}
                                                    </h2>
                                                    <p className="text-slate-400 font-bold text-[17px] mt-2">
                                                        {modalMode === 'create'
                                                            ? 'Register an authorized CES plantilla item into the database'
                                                            : `Editing item: ${modalItem?.dbm_item_no || ''}`}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => setIsModalOpen(false)}
                                                    className="p-3 rounded-2xl bg-slate-50 text-slate-400 hover:text-red-600 transition-all border-2 border-slate-200"
                                                >
                                                    <FiX size={20} />
                                                </button>
                                            </div>

                                            <form onSubmit={handleSubmitForm} className="space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                    {/* DBM Item No */}
                                                    <div className="md:col-span-2">
                                                        <label className="text-[15px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
                                                            DBM Plantilla Item No <span className="text-rose-500">*</span>
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={formData.dbm_item_no}
                                                            onChange={(e) => setFormData(p => ({ ...p, dbm_item_no: e.target.value }))}
                                                            placeholder="e.g. OSEC-DECSB-DIR4-1-1998"
                                                            className={`w-full bg-slate-50 border-2 rounded-2xl py-4 px-5 text-[18px] font-bold text-slate-700 outline-none transition-all ${formErrors.dbm_item_no ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200 focus:border-[#08315F]/20'}`}
                                                        />
                                                        {formErrors.dbm_item_no && (
                                                            <p className="text-[13.5px] text-rose-500 font-bold mt-1.5">{formErrors.dbm_item_no}</p>
                                                        )}
                                                    </div>

                                                    {/* Position Title */}
                                                    <div className="md:col-span-2">
                                                        <label className="text-[15px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
                                                            Position Title <span className="text-rose-500">*</span>
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={formData.position_title}
                                                            onChange={(e) => setFormData(p => ({ ...p, position_title: e.target.value }))}
                                                            placeholder="e.g. Director IV, Schools Division Superintendent"
                                                            className={`w-full bg-slate-50 border-2 rounded-2xl py-4 px-5 text-[18px] font-bold text-slate-700 outline-none transition-all ${formErrors.position_title ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200 focus:border-[#08315F]/20'}`}
                                                        />
                                                        {formErrors.position_title && (
                                                            <p className="text-[13.5px] text-rose-500 font-bold mt-1.5">{formErrors.position_title}</p>
                                                        )}
                                                    </div>

                                                    {/* Office / Bureau / Division */}
                                                    <div className="md:col-span-2">
                                                        <label className="text-[15px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
                                                            Office / Bureau / Division
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={formData.office_bureau_division}
                                                            onChange={(e) => setFormData(p => ({ ...p, office_bureau_division: e.target.value }))}
                                                            placeholder="e.g. Bureau of Curriculum Development, Division of Cebu"
                                                            className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#08315F]/20 rounded-2xl py-4 px-5 text-[18px] font-bold text-slate-700 outline-none transition-all"
                                                        />
                                                    </div>

                                                    {/* Region */}
                                                    <div>
                                                        <label className="text-[15px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
                                                            Region
                                                        </label>
                                                        <input
                                                            type="text"
                                                            list="regions-list"
                                                            value={formData.region}
                                                            onChange={(e) => setFormData(p => ({ ...p, region: e.target.value }))}
                                                            placeholder="Select or enter Region"
                                                            className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#08315F]/20 rounded-2xl py-4 px-5 text-[18px] font-bold text-slate-700 outline-none transition-all"
                                                        />
                                                        <datalist id="regions-list">
                                                            {filterOptions.regions.map(r => (
                                                                <option key={r} value={r} />
                                                            ))}
                                                        </datalist>
                                                    </div>

                                                    {/* Salary Grade */}
                                                    <div>
                                                        <label className="text-[15px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
                                                            Salary Grade
                                                        </label>
                                                        <select
                                                            value={formData.salary_grade}
                                                            onChange={(e) => setFormData(p => ({ ...p, salary_grade: e.target.value }))}
                                                            className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#08315F]/20 rounded-2xl py-4 px-5 text-[18px] font-bold text-slate-700 outline-none transition-all"
                                                        >
                                                            {['25', '26', '27', '28', '29', '30', '31'].map(sg => (
                                                                <option key={sg} value={sg}>Salary Grade {sg}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Incumbent Name */}
                                                    <div className="md:col-span-2">
                                                        <label className="text-[15px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
                                                            Incumbent Name (or enter "VACANT")
                                                        </label>
                                                        <input
                                                            type="text"
                                                            list="incumbents-list"
                                                            value={formData.incumbent_name}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setFormData(p => ({
                                                                    ...p,
                                                                    incumbent_name: val,
                                                                    is_vacant: val.trim().toUpperCase() === 'VACANT' ? true : p.is_vacant
                                                                }));
                                                            }}
                                                            placeholder="LAST NAME, FIRST NAME M.I. or VACANT"
                                                            className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#08315F]/20 rounded-2xl py-4 px-5 text-[18px] font-bold text-slate-700 outline-none transition-all"
                                                        />
                                                        <datalist id="incumbents-list">
                                                            <option value="VACANT" />
                                                            {filterOptions.incumbents?.map(inc => (
                                                                <option key={inc} value={inc} />
                                                            ))}
                                                        </datalist>
                                                    </div>

                                                    {/* Status of Appointment */}
                                                    <div>
                                                        <label className="text-[15px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
                                                            Status of Appointment
                                                        </label>
                                                        <select
                                                            value={formData.status_of_appointment}
                                                            onChange={(e) => setFormData(p => ({ ...p, status_of_appointment: e.target.value }))}
                                                            className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#08315F]/20 rounded-2xl py-4 px-5 text-[18px] font-bold text-slate-700 outline-none transition-all"
                                                        >
                                                            {['Permanent', 'Coterminous', 'Temporary', 'Permanent (Detailed)', 'Permanent (Secondment)', 'Coterminous (Secondment)'].map(st => (
                                                                <option key={st} value={st}>{st}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Is Vacant Checkbox */}
                                                    <div className="flex items-center pt-8">
                                                        <label className="flex items-center gap-3 cursor-pointer select-none">
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.is_vacant}
                                                                onChange={(e) => {
                                                                    const checked = e.target.checked;
                                                                    setFormData(p => ({
                                                                        ...p,
                                                                        is_vacant: checked,
                                                                        incumbent_name: checked && !p.incumbent_name ? 'VACANT' : p.incumbent_name
                                                                    }));
                                                                }}
                                                                className="w-6 h-6 rounded-lg text-[#08315F] border-2 border-slate-300 focus:ring-[#08315F] cursor-pointer"
                                                            />
                                                            <span className="text-[15px] font-black uppercase tracking-wider text-slate-700">
                                                                Mark as Vacant Position
                                                            </span>
                                                        </label>
                                                    </div>

                                                    {/* Is Active Checkbox */}
                                                    <div className="flex items-center pt-8">
                                                        <label className="flex items-center gap-3 cursor-pointer select-none">
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.is_active}
                                                                onChange={(e) => {
                                                                    setFormData(p => ({
                                                                        ...p,
                                                                        is_active: e.target.checked
                                                                    }));
                                                                }}
                                                                className="w-6 h-6 rounded-lg text-[#08315F] border-2 border-slate-300 focus:ring-[#08315F] cursor-pointer"
                                                            />
                                                            <span className="text-[15px] font-black uppercase tracking-wider text-slate-700">
                                                                Active Post Occupancy
                                                            </span>
                                                        </label>
                                                    </div>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="flex gap-4 pt-4">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsModalOpen(false)}
                                                        className="py-5 px-8 bg-slate-100 text-slate-600 rounded-[1.5rem] font-black text-[16.5px] uppercase tracking-[0.2em] hover:bg-slate-200 transition-all border-2 border-slate-200"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        disabled={submitting}
                                                        className="flex-1 py-5 bg-[#08315F] text-white rounded-[1.5rem] font-black text-[16.5px] uppercase tracking-[0.2em] shadow-xl shadow-blue-900/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 border-2 border-transparent"
                                                    >
                                                        {submitting ? 'Processing...' : (modalMode === 'create' ? 'Save New Position' : 'Update Position')}
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    </motion.div>
                                </div>
                            )}
                        </AnimatePresence>,
                        document.body
                    )}

                    {/* FOOTER (IDENTICAL TO OFFICIALS REGISTRY) */}
                    <footer className="mt-auto p-12 text-center bg-white border-t-2 border-slate-100 flex flex-col items-center gap-6">
                        <div className="space-y-1">
                            <p className="text-slate-400 text-[13.5px] font-black uppercase tracking-[0.3em]">© 2026 Department of Education • InsightEd Nexus Portal</p>
                            <p className="text-[12px] font-bold text-slate-300 uppercase tracking-widest italic">Strictly for Personnel Division Administrative Use Only</p>
                        </div>
                    </footer>
                </div>
            </div>
        </PageTransition>
    );
};

export default CesPlantilla;

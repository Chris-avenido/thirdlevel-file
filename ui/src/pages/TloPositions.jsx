import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiBriefcase,
  FiSearch,
  FiPlus,
  FiRefreshCw,
  FiX,
  FiChevronDown,
  FiChevronUp,
  FiLayers,
  FiEdit2,
  FiTrash2,
  FiMapPin,
  FiAward,
  FiCheckCircle,
  FiAlertCircle,
  FiCheck,
  FiFilter,
  FiUser,
  FiUserCheck,
  FiCalendar,
  FiClock,
  FiExternalLink,
  FiInfo,
  FiTag
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import AdminSidebar from '../components/AdminSidebar';
import PageTransition from '../components/PageTransition';
import LoadingScreen from '../components/LoadingScreen';
import Swal from 'sweetalert2';
import { apiUrl } from '../utils/api';

const TloPositions = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // Positions Data State
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Dynamic KPIs (Derived from backend API, never hardcoded)
  const [kpis, setKpis] = useState({
    total_positions: 0,
    unique_titles: 0,
    total_regions: 0,
    highest_salary_grade: null
  });

  // Filter Options from API
  const [filterOptions, setFilterOptions] = useState({
    regions: [],
    salaryGrades: [],
    titles: []
  });

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('All');
  const [salaryGradeFilter, setSalaryGradeFilter] = useState('All');

  // Pagination & Sorting State (Strict base ordering: id ASC)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState('id');
  const [sortOrder, setSortOrder] = useState('ASC');

  // Modal State (Create / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [currentPositionId, setCurrentPositionId] = useState(null);
  const [formData, setFormData] = useState({
    position_title: '',
    position_code: '',
    salary_grade: '26',
    region: '',
    division: '',
    bureau: '',
    description: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Position Assignment History Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedPositionForHistory, setSelectedPositionForHistory] = useState(null);
  const [positionHistory, setPositionHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load Filter Options
  const fetchFilterOptions = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/third-level/tlo-positions/options'), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success && data.data) {
        setFilterOptions(data.data);
      }
    } catch (err) {
      console.error('[TloPositions] Failed to fetch filter options:', err);
    }
  }, [token]);

  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  // Fetch Positions List
  const fetchPositions = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        sortBy,
        sortOrder
      });

      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      if (regionFilter !== 'All') params.append('region', regionFilter);
      if (salaryGradeFilter !== 'All') params.append('salary_grade', salaryGradeFilter);

      const res = await fetch(apiUrl(`/api/third-level/tlo-positions?${params.toString()}`), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (data.success) {
        setPositions(data.data || []);
        if (data.pagination) {
          setTotalRecords(data.pagination.total || 0);
          setTotalPages(data.pagination.totalPages || 1);
        }
        if (data.kpis) {
          setKpis(data.kpis);
        }
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed to Load Positions',
          text: data.error || 'An unexpected error occurred.',
          confirmButtonColor: '#08315F'
        });
      }
    } catch (err) {
      console.error('[TloPositions] Error fetching positions:', err);
      Swal.fire({
        icon: 'error',
        title: 'Network Error',
        text: 'Could not connect to the positions API server.',
        confirmButtonColor: '#08315F'
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, currentPage, pageSize, sortBy, sortOrder, debouncedSearch, regionFilter, salaryGradeFilter]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  // Popover search queries
  const [popoverRegionSearch, setPopoverRegionSearch] = useState('');
  const [popoverTitleSearch, setPopoverTitleSearch] = useState('');

  // Interactive Card Click Handlers
  const handleCardClickTotal = () => {
    setRegionFilter('All');
    setSalaryGradeFilter('All');
    setSearchTerm('');
    setSortBy('id');
    setSortOrder('ASC');
    setCurrentPage(1);
  };

  const handleCardClickTitles = () => {
    if (sortBy === 'position_title') {
      setSortOrder(prev => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy('position_title');
      setSortOrder('ASC');
    }
    setCurrentPage(1);
  };

  const handleCardClickRegions = () => {
    if (regionFilter !== 'All') {
      setRegionFilter('All');
    }
    setCurrentPage(1);
  };

  const handleCardClickHighestSg = () => {
    const highestSg = String(kpis.highest_salary_grade || '31');
    if (salaryGradeFilter === highestSg) {
      setSalaryGradeFilter('All');
    } else {
      setSalaryGradeFilter(highestSg);
    }
    setCurrentPage(1);
  };

  // Selection handlers from card hover popovers
  const handleSelectRegionFromPopover = (reg) => {
    setRegionFilter(reg);
    setSearchTerm('');
    setCurrentPage(1);
  };

  const handleSelectSalaryGradeFromPopover = (sg) => {
    setSalaryGradeFilter(String(sg));
    setCurrentPage(1);
  };

  const handleSelectTitleFromPopover = (title) => {
    setSearchTerm(title);
    setRegionFilter('All');
    setSalaryGradeFilter('All');
    setCurrentPage(1);
  };

  // Memoized card breakdown lists for hover popovers
  const filteredRegionsBreakdown = useMemo(() => {
    const list = (kpis.region_breakdown && kpis.region_breakdown.length > 0)
      ? kpis.region_breakdown
      : (filterOptions.regions || []).map(r => ({ region: r, count: positions.filter(p => p.region === r).length }));

    if (!popoverRegionSearch.trim()) return list;
    return list.filter(item => item.region && item.region.toLowerCase().includes(popoverRegionSearch.toLowerCase().trim()));
  }, [kpis.region_breakdown, filterOptions.regions, positions, popoverRegionSearch]);

  const filteredTitlesBreakdown = useMemo(() => {
    const list = (kpis.title_breakdown && kpis.title_breakdown.length > 0)
      ? kpis.title_breakdown
      : (filterOptions.titles || []).map(t => ({ position_title: t, count: positions.filter(p => p.position_title === t).length }));

    if (!popoverTitleSearch.trim()) return list;
    return list.filter(item => item.position_title && item.position_title.toLowerCase().includes(popoverTitleSearch.toLowerCase().trim()));
  }, [kpis.title_breakdown, filterOptions.titles, positions, popoverTitleSearch]);

  const filteredSalaryGradesBreakdown = useMemo(() => {
    return (kpis.salary_grade_breakdown && kpis.salary_grade_breakdown.length > 0)
      ? kpis.salary_grade_breakdown
      : (filterOptions.salaryGrades || []).map(sg => ({ salary_grade: sg, count: positions.filter(p => p.salary_grade === sg).length }));
  }, [kpis.salary_grade_breakdown, filterOptions.salaryGrades, positions]);

  // Card active states
  const isTotalActive = regionFilter === 'All' && salaryGradeFilter === 'All' && !searchTerm && sortBy === 'id';
  const isTitlesActive = sortBy === 'position_title' || (Boolean(searchTerm) && (kpis.title_breakdown || []).some(t => t.position_title.toLowerCase() === searchTerm.toLowerCase()));
  const isRegionsActive = regionFilter !== 'All';
  const isHighestSgActive = salaryGradeFilter === String(kpis.highest_salary_grade);

  // Sorting Handler (Strict default: id ASC)
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(prev => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(column);
      setSortOrder('ASC');
    }
    setCurrentPage(1);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setModalMode('create');
    setCurrentPositionId(null);
    setFormData({
      position_title: '',
      position_code: '',
      salary_grade: '26',
      region: '',
      division: '',
      bureau: '',
      description: ''
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // View Assignment History for Position
  const handleViewHistory = async (position) => {
    if (!position || !position.id) return;
    setSelectedPositionForHistory(position);
    setPositionHistory([]);
    setIsHistoryModalOpen(true);
    setLoadingHistory(true);

    try {
      const res = await fetch(apiUrl(`/api/third-level/tlo-positions/${position.id}/assignments`), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setPositionHistory(data.data || []);
      } else {
        console.error('[TloPositions] Failed to fetch position assignments:', data.error);
      }
    } catch (err) {
      console.error('[TloPositions] Error fetching assignment history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (position) => {
    setModalMode('edit');
    setCurrentPositionId(position.id);
    setFormData({
      position_title: position.position_title || '',
      position_code: position.position_code || '',
      salary_grade: position.salary_grade || '26',
      region: position.region || '',
      division: position.division || '',
      bureau: position.bureau || '',
      description: position.description || ''
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Form Validation
  const validateForm = () => {
    const errors = {};
    if (!formData.position_title || !formData.position_title.trim()) {
      errors.position_title = 'Position Title is required.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Modal (Create or Update)
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const url = modalMode === 'create'
        ? apiUrl('/api/third-level/tlo-positions')
        : apiUrl(`/api/third-level/tlo-positions/${currentPositionId}`);

      const method = modalMode === 'create' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        Swal.fire({
          icon: 'success',
          title: modalMode === 'create' ? 'Position Created' : 'Position Updated',
          text: data.message || 'Position catalog saved successfully.',
          timer: 2000,
          showConfirmButton: false
        });
        fetchPositions();
        fetchFilterOptions();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Operation Failed',
          text: data.error || 'Failed to save position.',
          confirmButtonColor: '#08315F'
        });
      }
    } catch (err) {
      console.error('[TloPositions] Form submit error:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'An error occurred while saving the position.',
        confirmButtonColor: '#08315F'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Safe Delete with FK Active Assignment Check
  const handleDeletePosition = async (position) => {
    try {
      const refRes = await fetch(apiUrl(`/api/third-level/tlo-positions/${position.id}/references`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const refData = await refRes.json();

      const activeCount = refData.active_assignments || 0;
      const totalCount = refData.total_assignments || 0;
      const assignments = refData.assignments || [];

      if (activeCount > 0) {
        const officialNames = assignments
          .filter(a => a.status !== 'Inactive')
          .map(a => `<li><strong>${a.official_name || 'Assigned Official'}</strong> (${a.capacity || 'Full'}, ID: ${a.tloid || 'N/A'})</li>`)
          .join('');

        const confirmResult = await Swal.fire({
          icon: 'warning',
          title: 'Active Assignment(s) Detected!',
          html: `
            <div style="text-align: left; font-size: 0.9rem; color: #334155; line-height: 1.5;">
              <p>This position (<strong>${position.position_title}</strong>, ID: #${position.id}) currently has <strong>${activeCount} active official assignment(s)</strong>:</p>
              <ul style="margin-top: 8px; margin-bottom: 12px; padding-left: 20px; background: #FEF3C7; padding: 10px 24px; border-radius: 8px; border: 1px solid #FDE68A;">
                ${officialNames}
              </ul>
              <p style="color: #DC2626; font-weight: bold;">
                Warning: Deleting this position will detach these active assignments and set their position reference to NULL.
              </p>
              <p style="margin-top: 6px;">Are you absolutely sure you wish to permanently delete this position?</p>
            </div>
          `,
          showCancelButton: true,
          confirmButtonText: 'Yes, Delete Anyway',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#DC2626',
          cancelButtonColor: '#64748B',
          reverseButtons: true
        });

        if (!confirmResult.isConfirmed) return;
        await executeDelete(position.id, true);
      } else {
        const promptText = totalCount > 0
          ? `This position has ${totalCount} inactive/historical assignment record(s). Deleting will remove the position from the catalog. Proceed?`
          : `Are you sure you want to delete "${position.position_title}" (#${position.id})? This action cannot be undone.`;

        const confirmResult = await Swal.fire({
          icon: 'question',
          title: 'Delete Position?',
          text: promptText,
          showCancelButton: true,
          confirmButtonText: 'Yes, Delete',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#DC2626',
          cancelButtonColor: '#64748B'
        });

        if (!confirmResult.isConfirmed) return;
        await executeDelete(position.id, false);
      }
    } catch (err) {
      console.error('[TloPositions] Delete error:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to process position deletion.',
        confirmButtonColor: '#08315F'
      });
    }
  };

  const executeDelete = async (id, force) => {
    try {
      const res = await fetch(apiUrl(`/api/third-level/tlo-positions/${id}${force ? '?force=true' : ''}`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Position Deleted',
          text: data.message || 'Position removed successfully.',
          timer: 2000,
          showConfirmButton: false
        });
        fetchPositions();
        fetchFilterOptions();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Deletion Blocked',
          text: data.message || data.error || 'Could not delete position.',
          confirmButtonColor: '#08315F'
        });
      }
    } catch (err) {
      console.error('[TloPositions] Execute delete error:', err);
      Swal.fire({
        icon: 'error',
        title: 'Delete Failed',
        text: 'Failed to delete position due to a network error.',
        confirmButtonColor: '#08315F'
      });
    }
  };

  if (loading && positions.length === 0) return <LoadingScreen />;

  return (
    <PageTransition>
      <div className="flex h-screen bg-transparent font-sans overflow-hidden">
        {/* Navigation Sidebar */}
        <AdminSidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto relative bg-transparent">
          {/* TOP NAVIGATION BAR (Exact Match to PositionAssignments) */}
          <header className="sticky top-0 z-50 bg-[#08315F] backdrop-blur-md border-b border-blue-900 px-8 py-4 flex items-center justify-between shadow-lg shadow-blue-900/20 shrink-0 w-full">
            <div className="flex items-center gap-4 text-white">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white shadow-inner">
                <FiLayers size={20} />
              </div>
              <div>
                <h1 className="text-lg font-['Plus_Jakarta_Sans'] font-black text-white tracking-tight leading-none italic uppercase">
                  Positions <span className="text-blue-300 not-italic">Library</span>
                </h1>
                <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest mt-1">
                  Plantilla Inventory & Catalog • Third Level Officials Command Dashboard
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

          {/* MAIN CONTAINER */}
          <main className="flex-1 px-8 pb-8 pt-6 max-w-[1600px] mx-auto w-full dashboard-theme !bg-transparent">
            {/* UNIFIED DATA CONTROLS TAB */}
            <div className="bg-white border-2 border-[#08315F] rounded-[24px] p-3 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-3 w-full">
              {/* Left/Center: Search Bar & Dropdown Filters */}
              <div className="flex flex-col md:flex-row items-center gap-2.5 flex-1 w-full min-w-0">
                {/* Search Bar */}
                <div className="relative flex-1 w-full h-[44px]">
                  <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#08315F]/50" size={16} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by position title, code, region, division, bureau, or salary grade..."
                    className="w-full h-full bg-[#F0F9FF] border-2 border-[#BAE6FD] rounded-full py-0 pl-11 pr-10 text-[14px] font-bold text-[#08315F] outline-none focus:border-sky-400 placeholder:text-[#08315F]/50 transition-colors"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      title="Clear search"
                    >
                      <FiX size={16} />
                    </button>
                  )}
                </div>

                {/* Region Filter */}
                <div className="relative w-full md:w-56 h-[44px] shrink-0">
                  <select
                    value={regionFilter}
                    onChange={(e) => {
                      setRegionFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full h-full bg-[#F0F9FF] border-2 border-[#BAE6FD] rounded-full px-4 text-[13px] font-black text-[#08315F] outline-none focus:border-sky-400 appearance-none pr-10 cursor-pointer"
                  >
                    <option value="All">All Regions</option>
                    {filterOptions.regions.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-[#08315F]/60 pointer-events-none w-4 h-4" />
                </div>

                {/* Salary Grade Filter */}
                <div className="relative w-full md:w-44 h-[44px] shrink-0">
                  <select
                    value={salaryGradeFilter}
                    onChange={(e) => {
                      setSalaryGradeFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full h-full bg-[#F0F9FF] border-2 border-[#BAE6FD] rounded-full px-4 text-[13px] font-black text-[#08315F] outline-none focus:border-sky-400 appearance-none pr-10 cursor-pointer"
                  >
                    <option value="All">All Grades</option>
                    {filterOptions.salaryGrades.map(sg => (
                      <option key={sg} value={sg}>SG {sg}</option>
                    ))}
                  </select>
                  <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-[#08315F]/60 pointer-events-none w-4 h-4" />
                </div>

                {/* Reset Filters */}
                {(searchTerm || regionFilter !== 'All' || salaryGradeFilter !== 'All' || sortBy !== 'id') && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setRegionFilter('All');
                      setSalaryGradeFilter('All');
                      setSortBy('id');
                      setSortOrder('ASC');
                      setCurrentPage(1);
                    }}
                    className="h-[44px] px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full border-2 border-slate-200 font-black text-[12px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                    title="Reset all filters"
                  >
                    <FiX size={14} />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {/* Right Side: Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                <button
                  onClick={() => fetchPositions(true)}
                  disabled={refreshing}
                  className="h-[44px] px-5 bg-[#F0F9FF] hover:bg-sky-100 text-[#08315F] rounded-full border-2 border-[#BAE6FD] font-black text-[13.5px] tracking-widest uppercase transition-colors flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50 active:scale-95 cursor-pointer"
                  title="Refresh data"
                >
                  <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-sky-600' : ''}`} />
                  <span>Refresh</span>
                </button>

                <button
                  onClick={handleOpenCreate}
                  className="h-[44px] px-6 bg-[#08315F] hover:bg-[#004A99] text-white rounded-full font-black text-[13.5px] tracking-widest uppercase transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-md active:scale-95 border-2 border-transparent cursor-pointer"
                >
                  <FiPlus className="w-4 h-4 stroke-[3]" />
                  <span>Add Plantilla Position</span>
                </button>
              </div>
            </div>

            {/* STATS CARDS (with interactive filter functions and rich hover popovers) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 w-full relative z-30">
              {/* Card 1: Total Plantilla Positions */}
              <div className="relative group">
                <div
                  onClick={handleCardClickTotal}
                  className={`min-h-[108px] p-5 bg-white rounded-[18px] border-2 border-[#BAE6FD] border-l-[6px] transition-all flex flex-col justify-between cursor-pointer select-none ${
                    isTotalActive
                      ? 'border-l-sky-500 shadow-md ring-2 ring-sky-200 bg-sky-50/20'
                      : 'border-l-sky-400 hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[13.5px] text-slate-500 uppercase tracking-widest font-black">
                      Total Plantilla Positions
                    </div>
                    {isTotalActive && (
                      <span className="flex items-center gap-1 text-[10px] font-black text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full border border-sky-200 uppercase tracking-wider">
                        <FiCheck className="w-3 h-3" /> Active
                      </span>
                    )}
                  </div>
                  <div className="text-[44px] text-[#08315F] font-normal leading-none my-1 font-['Plus_Jakarta_Sans']">
                    {(kpis.total_positions || totalRecords).toLocaleString()}
                  </div>
                  <div className="text-[12px] text-slate-400 uppercase tracking-widest font-bold leading-none flex items-center justify-between">
                    <span>Authorized catalog inventory</span>
                    <span className="text-sky-600 font-black text-[11px] opacity-0 group-hover:opacity-100 transition-opacity">
                      Click to Reset →
                    </span>
                  </div>
                </div>

                {/* Hover Popover: Total Positions Overview */}
                <div className="absolute top-[calc(100%+6px)] left-0 w-full sm:w-[320px] opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 z-50">
                  <div className="bg-white/95 backdrop-blur-md rounded-2xl border-2 border-[#BAE6FD] shadow-[0_20px_40px_-10px_rgba(8,49,95,0.25)] p-4 text-left">
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
                          <FiLayers size={13} />
                        </div>
                        <span className="text-[13px] font-black text-[#08315F] uppercase tracking-wider">Inventory Summary</span>
                      </div>
                      <span className="text-[11px] font-black text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                        {kpis.total_positions || totalRecords} Total
                      </span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-600 font-bold">Distinct Executive Titles</span>
                        <span className="font-black text-[#08315F] bg-white px-2 py-0.5 rounded-md border border-slate-200">{kpis.unique_titles || 0}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-600 font-bold">Covered Regions</span>
                        <span className="font-black text-[#08315F] bg-white px-2 py-0.5 rounded-md border border-slate-200">{kpis.total_regions || 0} Regions</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-600 font-bold">Highest Salary Grade</span>
                        <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">SG {kpis.highest_salary_grade || '31'}</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] font-black text-sky-700 uppercase tracking-wider text-center">
                      ⚡ Click card to show all positions & reset filters
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Distinct Leadership Titles */}
              <div className="relative group">
                <div
                  onClick={handleCardClickTitles}
                  className={`min-h-[108px] p-5 bg-white rounded-[18px] border-2 border-[#BAE6FD] border-l-[6px] transition-all flex flex-col justify-between cursor-pointer select-none ${
                    isTitlesActive
                      ? 'border-l-rose-500 shadow-md ring-2 ring-rose-200 bg-rose-50/20'
                      : 'border-l-rose-400 hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[13.5px] text-slate-500 uppercase tracking-widest font-black">
                      Distinct Leadership Titles
                    </div>
                    {isTitlesActive && (
                      <span className="flex items-center gap-1 text-[10px] font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200 uppercase tracking-wider">
                        <FiCheck className="w-3 h-3" /> Sorted
                      </span>
                    )}
                  </div>
                  <div className="text-[44px] text-[#08315F] font-normal leading-none my-1 font-['Plus_Jakarta_Sans']">
                    {(kpis.unique_titles || 0).toLocaleString()}
                  </div>
                  <div className="text-[12px] text-slate-400 uppercase tracking-widest font-bold leading-none flex items-center justify-between">
                    <span>Unique executive designations</span>
                    <span className="text-rose-600 font-black text-[11px] opacity-0 group-hover:opacity-100 transition-opacity">
                      Click to Sort →
                    </span>
                  </div>
                </div>

                {/* Hover Popover: Distinct Titles Breakdown */}
                <div className="absolute top-[calc(100%+6px)] left-0 sm:left-auto sm:right-0 md:left-0 w-full sm:w-[340px] opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 z-50">
                  <div className="bg-white/95 backdrop-blur-md rounded-2xl border-2 border-[#BAE6FD] shadow-[0_20px_40px_-10px_rgba(8,49,95,0.25)] p-4 text-left">
                    <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">
                          <FiAward size={13} />
                        </div>
                        <span className="text-[13px] font-black text-[#08315F] uppercase tracking-wider">Leadership Designations</span>
                      </div>
                      <span className="text-[11px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                        {filteredTitlesBreakdown.length} Titles
                      </span>
                    </div>

                    {/* Quick Search inside titles popover */}
                    <div className="relative mb-2">
                      <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                      <input
                        type="text"
                        value={popoverTitleSearch}
                        onChange={(e) => setPopoverTitleSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Search designation title..."
                        className="w-full bg-slate-50 border border-slate-200 focus:border-rose-400 rounded-xl py-1 pl-7 pr-3 text-[11.5px] font-bold text-slate-700 outline-none placeholder:text-slate-400 transition-colors"
                      />
                    </div>

                    {/* List of titles with counts */}
                    <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                      {filteredTitlesBreakdown.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-400 font-bold">No designations found</div>
                      ) : (
                        filteredTitlesBreakdown.map((t, idx) => {
                          const isSelected = searchTerm.toLowerCase() === t.position_title.toLowerCase();
                          return (
                            <button
                              key={t.position_title || idx}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectTitleFromPopover(t.position_title);
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-rose-100 text-rose-900 font-black border border-rose-300'
                                  : 'hover:bg-rose-50 text-slate-700 hover:text-rose-900 font-bold'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate pr-2">
                                <span className="text-[10px] font-mono text-slate-400 shrink-0">#{idx + 1}</span>
                                <span className="truncate" title={t.position_title}>{t.position_title}</span>
                              </div>
                              <span className="text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full shrink-0">
                                {t.count}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] font-black text-rose-700 uppercase tracking-wider text-center">
                      💡 Click any title to filter • Click card to sort
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: Covered Regions (Hover per region & Quick Filter) */}
              <div className="relative group">
                <div
                  onClick={handleCardClickRegions}
                  className={`min-h-[108px] p-5 bg-white rounded-[18px] border-2 border-[#BAE6FD] border-l-[6px] transition-all flex flex-col justify-between cursor-pointer select-none ${
                    isRegionsActive
                      ? 'border-l-amber-500 shadow-md ring-2 ring-amber-200 bg-amber-50/20'
                      : 'border-l-amber-400 hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[13.5px] text-slate-500 uppercase tracking-widest font-black">
                      Covered Regions
                    </div>
                    {isRegionsActive && (
                      <span className="flex items-center gap-1 text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 uppercase tracking-wider truncate max-w-[120px]">
                        <FiCheck className="w-3 h-3 shrink-0" /> {regionFilter !== 'All' ? regionFilter : 'Regional'}
                      </span>
                    )}
                  </div>
                  <div className="text-[44px] text-[#08315F] font-normal leading-none my-1 font-['Plus_Jakarta_Sans']">
                    {(kpis.total_regions || 0).toLocaleString()}
                  </div>
                  <div className="text-[12px] text-slate-400 uppercase tracking-widest font-bold leading-none flex items-center justify-between">
                    <span>DepEd nationwide coverage</span>
                    <span className="text-amber-600 font-black text-[11px] opacity-0 group-hover:opacity-100 transition-opacity">
                      Hover for Regions →
                    </span>
                  </div>
                </div>

                {/* Hover Popover: Region Breakdown (Hover per region list with position counts) */}
                <div className="absolute top-[calc(100%+6px)] left-0 sm:left-auto sm:right-0 w-full sm:w-[350px] opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 z-50">
                  <div className="bg-white/95 backdrop-blur-md rounded-2xl border-2 border-[#BAE6FD] shadow-[0_20px_40px_-10px_rgba(8,49,95,0.25)] p-4 text-left">
                    <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                          <FiMapPin size={13} />
                        </div>
                        <span className="text-[13px] font-black text-[#08315F] uppercase tracking-wider">Region Breakdown</span>
                      </div>
                      <span className="text-[11px] font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        {filteredRegionsBreakdown.length} Regions
                      </span>
                    </div>

                    {/* Search bar inside region popover */}
                    <div className="relative mb-2">
                      <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                      <input
                        type="text"
                        value={popoverRegionSearch}
                        onChange={(e) => setPopoverRegionSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Search region name..."
                        className="w-full bg-slate-50 border border-slate-200 focus:border-amber-400 rounded-xl py-1 pl-7 pr-3 text-[11.5px] font-bold text-slate-700 outline-none placeholder:text-slate-400 transition-colors"
                      />
                    </div>

                    {/* Scrollable list of covered regions with counts */}
                    <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                      {filteredRegionsBreakdown.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-400 font-bold">No matching regions found</div>
                      ) : (
                        filteredRegionsBreakdown.map((r, idx) => {
                          const isSelected = regionFilter === r.region;
                          return (
                            <button
                              key={r.region || idx}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectRegionFromPopover(r.region);
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-100 text-amber-950 font-black border border-amber-300'
                                  : 'hover:bg-amber-50 text-slate-700 hover:text-amber-900 font-bold'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate pr-2">
                                <span className="text-[10px] font-mono text-slate-400 shrink-0">#{idx + 1}</span>
                                <span className="truncate" title={r.region}>{r.region}</span>
                              </div>
                              <span className="text-[11px] font-black bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                                {r.count} items
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] font-black text-amber-800 uppercase tracking-wider text-center">
                      💡 Click any region to filter • Click card to toggle
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 4: Highest Salary Grade */}
              <div className="relative group">
                <div
                  onClick={handleCardClickHighestSg}
                  className={`min-h-[108px] p-5 bg-white rounded-[18px] border-2 border-[#BAE6FD] border-l-[6px] transition-all flex flex-col justify-between cursor-pointer select-none ${
                    isHighestSgActive
                      ? 'border-l-indigo-500 shadow-md ring-2 ring-indigo-200 bg-indigo-50/20'
                      : 'border-l-indigo-400 hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[13.5px] text-slate-500 uppercase tracking-widest font-black">
                      Highest Salary Grade
                    </div>
                    {isHighestSgActive && (
                      <span className="flex items-center gap-1 text-[10px] font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200 uppercase tracking-wider">
                        <FiCheck className="w-3 h-3" /> SG {salaryGradeFilter !== 'All' ? salaryGradeFilter : (kpis.highest_salary_grade || '31')}
                      </span>
                    )}
                  </div>
                  <div className="text-[44px] text-[#08315F] font-normal leading-none my-1 font-['Plus_Jakarta_Sans']">
                    {kpis.highest_salary_grade ? `SG ${kpis.highest_salary_grade}` : 'SG 31'}
                  </div>
                  <div className="text-[12px] text-slate-400 uppercase tracking-widest font-bold leading-none flex items-center justify-between">
                    <span>Executive ceiling grade</span>
                    <span className="text-indigo-600 font-black text-[11px] opacity-0 group-hover:opacity-100 transition-opacity">
                      Click to Filter SG →
                    </span>
                  </div>
                </div>

                {/* Hover Popover: Salary Grades Breakdown */}
                <div className="absolute top-[calc(100%+6px)] right-0 w-full sm:w-[320px] opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 z-50">
                  <div className="bg-white/95 backdrop-blur-md rounded-2xl border-2 border-[#BAE6FD] shadow-[0_20px_40px_-10px_rgba(8,49,95,0.25)] p-4 text-left">
                    <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          <FiBriefcase size={13} />
                        </div>
                        <span className="text-[13px] font-black text-[#08315F] uppercase tracking-wider">Salary Grade Breakdown</span>
                      </div>
                      <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                        {filteredSalaryGradesBreakdown.length} Grades
                      </span>
                    </div>

                    {/* List of salary grades with counts */}
                    <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                      {filteredSalaryGradesBreakdown.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-400 font-bold">No salary grades found</div>
                      ) : (
                        filteredSalaryGradesBreakdown.map((sg, idx) => {
                          const isSelected = salaryGradeFilter === String(sg.salary_grade);
                          return (
                            <button
                              key={sg.salary_grade || idx}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectSalaryGradeFromPopover(sg.salary_grade);
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-100 text-indigo-900 font-black border border-indigo-300'
                                  : 'hover:bg-indigo-50 text-slate-700 hover:text-indigo-900 font-bold'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-slate-400 text-[10px]">#{idx + 1}</span>
                                <span className="font-black text-[#08315F]">Salary Grade {sg.salary_grade}</span>
                              </div>
                              <span className="text-[11px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                                {sg.count} positions
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] font-black text-indigo-700 uppercase tracking-wider text-center">
                      💡 Click any grade to filter • Click card for highest
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* MAIN DATA TABLE CARD (Exact Match to PositionAssignments) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="card !rounded-[30px] !border-2 !border-[#08315F] overflow-hidden bg-white shadow-sm"
            >
              <div className="w-full">
                {/* Desktop Table View */}
                <table className="hidden md:table w-full text-left border-collapse table-fixed">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200 select-none">
                          {/* 1. ID Column */}
                          <th
                            onClick={() => handleSort('id')}
                            className="px-4 py-3.5 text-left text-[12px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 hover:text-[#08315F] transition-colors w-[8%]"
                          >
                            <div className="flex items-center gap-1.5">
                              <span>ID</span>
                              {sortBy === 'id' ? (
                                sortOrder === 'ASC' ? <FiChevronUp className="text-[#08315F]" size={14} /> : <FiChevronDown className="text-[#08315F]" size={14} />
                              ) : (
                                <span className="text-slate-300 text-xs">↕</span>
                              )}
                            </div>
                          </th>

                          {/* 2. Region Column */}
                          <th
                            onClick={() => handleSort('region')}
                            className="px-4 py-3.5 text-left text-[12px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 hover:text-[#08315F] transition-colors w-[14%]"
                          >
                            <div className="flex items-center gap-1.5">
                              <span>Region</span>
                              {sortBy === 'region' ? (
                                sortOrder === 'ASC' ? <FiChevronUp className="text-[#08315F]" size={14} /> : <FiChevronDown className="text-[#08315F]" size={14} />
                              ) : (
                                <span className="text-slate-300 text-xs">↕</span>
                              )}
                            </div>
                          </th>

                          {/* 3. Division / Bureau Column */}
                          <th className="px-4 py-3.5 text-left text-[12px] font-black text-slate-500 uppercase tracking-wider w-[16%]">
                            Division
                          </th>

                          {/* 4. Position Title Column */}
                          <th
                            onClick={() => handleSort('position_title')}
                            className="px-4 py-3.5 text-left text-[12px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 hover:text-[#08315F] transition-colors w-[32%]"
                          >
                            <div className="flex items-center gap-1.5">
                              <span>Position Title</span>
                              {sortBy === 'position_title' ? (
                                sortOrder === 'ASC' ? <FiChevronUp className="text-[#08315F]" size={14} /> : <FiChevronDown className="text-[#08315F]" size={14} />
                              ) : (
                                <span className="text-slate-300 text-xs">↕</span>
                              )}
                            </div>
                          </th>

                          {/* 5. Salary Grade Column */}
                          <th
                            onClick={() => handleSort('salary_grade')}
                            className="px-4 py-3.5 text-left text-[12px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 hover:text-[#08315F] transition-colors w-[14%]"
                          >
                            <div className="flex items-center gap-1.5">
                              <span>Salary Grade</span>
                              {sortBy === 'salary_grade' ? (
                                sortOrder === 'ASC' ? <FiChevronUp className="text-[#08315F]" size={14} /> : <FiChevronDown className="text-[#08315F]" size={14} />
                              ) : (
                                <span className="text-slate-300 text-xs">↕</span>
                              )}
                            </div>
                          </th>

                          {/* 6. Position Code Column */}
                          <th
                            onClick={() => handleSort('position_code')}
                            className="px-4 py-3.5 text-left text-[12px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 hover:text-[#08315F] transition-colors w-[16%]"
                          >
                            <div className="flex items-center gap-1.5">
                              <span>Code</span>
                              {sortBy === 'position_code' ? (
                                sortOrder === 'ASC' ? <FiChevronUp className="text-[#08315F]" size={14} /> : <FiChevronDown className="text-[#08315F]" size={14} />
                              ) : (
                                <span className="text-slate-300 text-xs">↕</span>
                              )}
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {positions.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-16 text-center">
                              <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FiLayers size={32} />
                              </div>
                              <h3 className="text-lg font-['Plus_Jakarta_Sans'] font-black text-[#08315F] uppercase italic tracking-tight">
                                No Positions Found
                              </h3>
                              <p className="text-slate-400 font-medium text-sm mt-1 max-w-md mx-auto">
                                {searchTerm || regionFilter !== 'All' || salaryGradeFilter !== 'All'
                                  ? 'Adjust your search query or reset your region and grade filters.'
                                  : 'Click "Add Plantilla Position" to add an official position entry.'}
                              </p>
                            </td>
                          </tr>
                        ) : (
                          positions.map((item) => {
                          const sgNum = parseInt(item.salary_grade, 10);
                          const isHighSg = !isNaN(sgNum) && sgNum >= 28;

                          return (
                            <tr
                              key={item.id}
                              onClick={() => handleViewHistory(item)}
                              className="hover:bg-sky-50/70 transition-colors relative group border-b border-slate-100 cursor-pointer"
                              title="Click to view position assignment history"
                            >
                              {/* 1. ID Badge */}
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className="px-2.5 py-1 rounded-lg font-mono font-bold text-[12px] bg-sky-50 text-[#08315F] border border-sky-200">
                                  #{item.id}
                                </span>
                              </td>

                              {/* 2. Region */}
                              <td className="px-4 py-4 whitespace-nowrap">
                                {item.region ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectRegionFromPopover(item.region);
                                    }}
                                    title={`Click to filter table by ${item.region}`}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[12.5px] font-bold text-slate-700 bg-slate-100 hover:bg-[#08315F] hover:text-white border-2 border-slate-200 hover:border-[#08315F] transition-all cursor-pointer shadow-2xs group/reg"
                                  >
                                    <FiMapPin className="w-3.5 h-3.5 text-slate-400 group-hover/reg:text-amber-300 transition-colors" />
                                    <span>{item.region}</span>
                                  </button>
                                ) : (
                                  <span className="text-slate-300 font-mono text-[12px]">—</span>
                                )}
                              </td>

                              {/* 3. Division / Bureau */}
                              <td className="px-4 py-4">
                                <div className="truncate">
                                  <div className="text-[13px] font-bold text-slate-700 truncate">
                                    {item.division || item.bureau || <span className="text-slate-300">—</span>}
                                  </div>
                                  {item.division && item.bureau && (
                                    <div className="text-[11px] text-slate-400 truncate">
                                      {item.bureau}
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* 4. Position Title */}
                              <td className="px-4 py-4">
                                <div className="font-['Plus_Jakarta_Sans'] font-black text-[15px] text-[#08315F] leading-snug truncate" title={item.position_title}>
                                  {item.position_title}
                                </div>
                                {item.description && (
                                  <div className="text-[12px] font-medium text-slate-400 truncate mt-0.5" title={item.description}>
                                    {item.description}
                                  </div>
                                )}
                              </td>

                              {/* 5. Salary Grade */}
                              <td className="px-4 py-4 whitespace-nowrap">
                                {item.salary_grade ? (
                                  <span
                                    className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border-2 ${
                                      isHighSg
                                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                                        : 'bg-blue-50 text-[#075985] border-blue-200'
                                    }`}
                                  >
                                    SG {item.salary_grade}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 text-[12px]">—</span>
                                )}
                              </td>

                              {/* 6. Position Code & Action Overlay */}
                              <td className="px-4 py-4 whitespace-nowrap relative">
                                {item.position_code ? (
                                  <span className="font-mono text-[11px] font-bold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 shadow-2xs">
                                    {item.position_code}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 font-mono text-[12px]">—</span>
                                )}

                                {/* Group Hover Action Toolbar (Matching PositionAssignments) */}
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 z-10 bg-white/95 backdrop-blur-md p-1.5 rounded-xl shadow-md border-2 border-slate-200 pointer-events-none group-hover:pointer-events-auto">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenEdit(item);
                                    }}
                                    title="Edit position details"
                                    className="flex items-center justify-center gap-1 px-3 py-1.5 bg-sky-50 text-[#08315F] rounded-lg text-[12.5px] font-black uppercase tracking-widest hover:bg-[#08315F] hover:text-white transition-all border-2 border-sky-200 shadow-2xs shrink-0 cursor-pointer"
                                  >
                                    <FiEdit2 size={13} />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeletePosition(item);
                                    }}
                                    title="Delete position from catalog"
                                    className="flex items-center justify-center gap-1 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[12.5px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all border-2 border-rose-200 shadow-2xs shrink-0 cursor-pointer"
                                  >
                                    <FiTrash2 size={13} />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }))}
                      </tbody>
                    </table>

                    {/* Mobile Card View (Matching PositionAssignments) */}
                    <div className="md:hidden flex flex-col divide-y-2 divide-slate-100">
                      {positions.length === 0 ? (
                        <div className="p-12 text-center">
                          <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FiLayers size={32} />
                          </div>
                          <h3 className="text-lg font-['Plus_Jakarta_Sans'] font-black text-[#08315F] uppercase italic tracking-tight">
                            No Positions Found
                          </h3>
                          <p className="text-slate-400 font-medium text-sm mt-1 max-w-md mx-auto">
                            {searchTerm || regionFilter !== 'All' || salaryGradeFilter !== 'All'
                              ? 'Adjust your search query or reset your region and grade filters.'
                              : 'Click "Add Plantilla Position" to add an official position entry.'}
                          </p>
                        </div>
                      ) : (
                        positions.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleViewHistory(item)}
                          className="p-4 bg-white hover:bg-slate-50/70 transition-colors flex flex-col gap-3 cursor-pointer"
                          title="Click to view position assignment history"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#08315F] font-black text-xs flex items-center justify-center border-2 border-sky-200 shadow-sm shrink-0">
                                #{item.id}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-['Plus_Jakarta_Sans'] font-black text-[#08315F] text-[16px] leading-tight truncate">
                                  {item.position_title}
                                </h4>
                                <div className="text-[12px] font-bold text-slate-400 mt-0.5 truncate font-mono">
                                  {item.position_code || '—'}
                                </div>
                              </div>
                            </div>

                            {item.salary_grade && (
                              <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-50 text-[#075985] border-2 border-blue-200 shrink-0">
                                SG {item.salary_grade}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-col gap-2 mt-1 bg-slate-50/70 rounded-2xl p-3.5 border-2 border-slate-200 text-[13px]">
                            <div className="flex justify-between items-center gap-2">
                              <span className="font-black text-slate-400 uppercase tracking-widest shrink-0">Region</span>
                              <div className="text-right truncate">
                                {item.region ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectRegionFromPopover(item.region);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11.5px] font-bold text-slate-700 bg-slate-100 hover:bg-[#08315F] hover:text-white border border-slate-200 transition-all cursor-pointer"
                                  >
                                    <FiMapPin size={11} className="text-slate-400" />
                                    <span className="truncate">{item.region}</span>
                                  </button>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </div>
                            </div>
                            <div className="flex justify-between items-center gap-2">
                              <span className="font-black text-slate-400 uppercase tracking-widest shrink-0">Division / Bureau</span>
                              <span className="font-bold text-slate-700 text-right truncate">
                                {item.division || item.bureau || '—'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEdit(item);
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-sky-50 text-[#08315F] rounded-xl text-[13px] font-black uppercase tracking-widest border-2 border-sky-200 hover:bg-[#08315F] hover:text-white transition-all shadow-2xs"
                            >
                              <FiEdit2 size={13} /> Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePosition(item);
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 rounded-xl text-[13px] font-black uppercase tracking-widest border-2 border-rose-200 hover:bg-rose-500 hover:text-white transition-all shadow-2xs"
                            >
                              <FiTrash2 size={13} /> Delete
                            </button>
                          </div>
                        </div>
                      )))}
                    </div>

                    {/* TABLE FOOTER / PAGINATION (Exact Match to PositionAssignments) */}
                    <div className="px-8 py-5 bg-white border-t-2 border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <span className="text-[14px] font-black text-slate-400 uppercase tracking-widest">
                          Showing {totalRecords === 0 ? 0 : ((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalRecords)} of {totalRecords.toLocaleString()} positions
                        </span>

                        <div className="flex items-center gap-2 pl-4 border-l-2 border-slate-100">
                          <span className="text-[12px] font-black text-slate-400 uppercase tracking-wider">Per Page:</span>
                          <select
                            value={pageSize}
                            onChange={(e) => {
                              setPageSize(parseInt(e.target.value, 10));
                              setCurrentPage(1);
                            }}
                            className="bg-slate-50 border-2 border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                          >
                            <option value="10">10</option>
                            <option value="20">20</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          disabled={currentPage === 1 || loading}
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className="h-[38px] px-4 rounded-full border-2 border-[#BAE6FD] bg-[#F0F9FF] text-[#08315F] font-black text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed hover:bg-sky-100 transition-all cursor-pointer"
                        >
                          Prev
                        </button>
                        <span className="px-4 text-[13px] font-black text-[#08315F]">
                          Page {currentPage} of {totalPages}
                        </span>
                        <button
                          disabled={currentPage >= totalPages || loading}
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className="h-[38px] px-4 rounded-full border-2 border-[#BAE6FD] bg-[#F0F9FF] text-[#08315F] font-black text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed hover:bg-sky-100 transition-all cursor-pointer"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
          </main>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CREATE / EDIT POSITION (PORTAL, EXACT MATCH TO PositionAssignments) */}
      {/* ========================================================================= */}
      {createPortal(
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 30 }}
                className="bg-white rounded-[2.5rem] sm:rounded-[3rem] w-full max-w-2xl shadow-2xl border-2 border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
              >
                {/* Modal Header */}
                <div className="p-6 sm:p-8 pb-4 flex justify-between items-start border-b-2 border-slate-100">
                  <div>
                    <span className="text-[13px] font-black text-[#075985] uppercase tracking-widest mb-1 block">
                      Plantilla Action
                    </span>
                    <h2 className="text-[26px] sm:text-[32px] font-['Plus_Jakarta_Sans'] font-black text-[#08315F] tracking-tighter uppercase italic leading-none">
                      {modalMode === 'create' ? 'Add Plantilla Position' : 'Edit Position Details'}
                    </h2>
                    <p className="text-slate-400 font-bold text-[14px] mt-1.5">
                      {modalMode === 'create'
                        ? 'Create a new authorized position in the public.tlo_positions master catalog.'
                        : `Modify details for position #${currentPositionId} in public.tlo_positions.`}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="p-3 rounded-2xl bg-slate-50 text-slate-400 hover:text-red-600 transition-all border-2 border-slate-200 cursor-pointer"
                    title="Close"
                  >
                    <FiX size={18} />
                  </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmitForm} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  <div className="p-6 sm:p-8 pb-8 overflow-y-auto space-y-5 flex-1 min-h-0 custom-scrollbar">
                    {/* 1. Position Title */}
                    <div>
                      <label className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                        Position Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Director IV, Schools Division Superintendent"
                        value={formData.position_title}
                        onChange={(e) => setFormData(prev => ({ ...prev, position_title: e.target.value }))}
                        className={`w-full bg-slate-50 border-2 focus:border-[#08315F]/20 rounded-2xl py-3.5 px-4 text-[15px] font-bold text-slate-700 outline-none transition-all ${
                          formErrors.position_title ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                        }`}
                      />
                      {formErrors.position_title && (
                        <p className="text-[12px] text-red-500 font-bold mt-1">
                          {formErrors.position_title}
                        </p>
                      )}
                    </div>

                    {/* 2. Position Code and Salary Grade Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Position Code */}
                      <div>
                        <label className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                          Position Code (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. TLO-DIR4-001"
                          value={formData.position_code}
                          onChange={(e) => setFormData(prev => ({ ...prev, position_code: e.target.value }))}
                          className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#08315F]/20 rounded-2xl py-3.5 px-4 text-[15px] font-bold text-slate-700 outline-none transition-all"
                        />
                      </div>

                      {/* Salary Grade */}
                      <div>
                        <label className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                          Salary Grade
                        </label>
                        <div className="relative">
                          <select
                            value={formData.salary_grade}
                            onChange={(e) => setFormData(prev => ({ ...prev, salary_grade: e.target.value }))}
                            className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#08315F]/20 rounded-2xl py-3.5 px-4 text-[15px] font-bold text-slate-700 outline-none transition-all appearance-none pr-10 cursor-pointer"
                          >
                            <option value="24">SG 24 (Division Chief / Principal IV)</option>
                            <option value="25">SG 25</option>
                            <option value="26">SG 26 (Assistant Schools Division Superintendent)</option>
                            <option value="27">SG 27 (Schools Division Superintendent)</option>
                            <option value="28">SG 28 (Director III / Assistant Regional Director)</option>
                            <option value="29">SG 29 (Director IV / Regional Director)</option>
                            <option value="30">SG 30 (Assistant Secretary)</option>
                            <option value="31">SG 31 (Undersecretary)</option>
                          </select>
                          <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none w-4 h-4" />
                        </div>
                      </div>
                    </div>

                    {/* 3. Region */}
                    <div>
                      <label className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                        Region (Optional)
                      </label>
                      <input
                        type="text"
                        list="modal-region-suggestions"
                        placeholder="e.g. REGION I, CENTRAL OFFICE, NATIONAL CAPITAL REGION"
                        value={formData.region}
                        onChange={(e) => setFormData(prev => ({ ...prev, region: e.target.value }))}
                        className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#08315F]/20 rounded-2xl py-3.5 px-4 text-[15px] font-bold text-slate-700 outline-none transition-all"
                      />
                      <datalist id="modal-region-suggestions">
                        {filterOptions.regions.map(r => (
                          <option key={r} value={r} />
                        ))}
                      </datalist>
                    </div>

                    {/* 4. Division & Bureau Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Division */}
                      <div>
                        <label className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                          Division (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Division of Ilocos Norte"
                          value={formData.division}
                          onChange={(e) => setFormData(prev => ({ ...prev, division: e.target.value }))}
                          className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#08315F]/20 rounded-2xl py-3.5 px-4 text-[15px] font-bold text-slate-700 outline-none transition-all"
                        />
                      </div>

                      {/* Bureau */}
                      <div>
                        <label className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                          Bureau (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Bureau of Human Resource"
                          value={formData.bureau}
                          onChange={(e) => setFormData(prev => ({ ...prev, bureau: e.target.value }))}
                          className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#08315F]/20 rounded-2xl py-3.5 px-4 text-[15px] font-bold text-slate-700 outline-none transition-all"
                        />
                      </div>
                    </div>

                    {/* 5. Description */}
                    <div>
                      <label className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                        Description / Remarks (Optional)
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Additional functional context or jurisdiction notes..."
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#08315F]/20 rounded-2xl py-3.5 px-4 text-[15px] font-bold text-slate-700 outline-none transition-all resize-none"
                      />
                    </div>
                  </div>

                  {/* Modal Footer (Exact match to PositionAssignments) */}
                  <div className="p-6 sm:p-8 pt-4 border-t-2 border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-end items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="w-full sm:w-auto px-6 py-3.5 rounded-2xl border-2 border-slate-200 text-slate-500 font-black text-[13.5px] uppercase tracking-widest hover:bg-slate-100 transition-all text-center cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full sm:w-auto px-8 py-3.5 bg-[#08315F] hover:bg-[#004A99] text-white rounded-2xl text-[13.5px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex justify-center items-center gap-2 border-2 border-transparent shadow-lg shadow-blue-900/20 active:scale-95 cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <FiRefreshCw className="w-4 h-4 animate-spin" />
                          <span>Saving Position...</span>
                        </>
                      ) : (
                        <>
                          <FiCheckCircle className="w-4 h-4" />
                          <span>{modalMode === 'create' ? 'Create Position' : 'Save Changes'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL: POSITION ASSIGNMENT HISTORY (PORTAL) */}
      {/* ========================================================================= */}
      {createPortal(
        <AnimatePresence>
          {isHistoryModalOpen && selectedPositionForHistory && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 30 }}
                className="bg-white rounded-[2.5rem] sm:rounded-[3rem] w-full max-w-4xl shadow-2xl border-2 border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
              >
                {/* Modal Header */}
                <div className="p-6 sm:p-8 pb-4 flex justify-between items-start border-b-2 border-slate-100 bg-gradient-to-r from-blue-50/40 via-sky-50/20 to-white">
                  <div className="min-w-0 flex-1 pr-4">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[12px] font-black text-[#075985] uppercase tracking-widest bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200">
                        Position Assignment History
                      </span>
                      <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        ID #{selectedPositionForHistory.id}
                      </span>
                      {selectedPositionForHistory.salary_grade && (
                        <span className="text-[11px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full">
                          SG {selectedPositionForHistory.salary_grade}
                        </span>
                      )}
                    </div>
                    <h2 className="text-[22px] sm:text-[28px] font-['Plus_Jakarta_Sans'] font-black text-[#08315F] tracking-tight truncate leading-tight">
                      {selectedPositionForHistory.position_title}
                    </h2>
                    <div className="flex items-center gap-2 text-slate-500 font-bold text-[13px] mt-1 flex-wrap">
                      <span>{selectedPositionForHistory.region || 'Central Office'}</span>
                      <span>•</span>
                      <span>{selectedPositionForHistory.division || selectedPositionForHistory.bureau || 'General Bureau / Division'}</span>
                      {selectedPositionForHistory.position_code && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-[12px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">Code: {selectedPositionForHistory.position_code}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setIsHistoryModalOpen(false)}
                    className="p-3 rounded-2xl bg-white text-slate-400 hover:text-red-600 transition-all border-2 border-slate-200 cursor-pointer shadow-xs shrink-0"
                    title="Close"
                  >
                    <FiX size={18} />
                  </button>
                </div>

                {/* Modal Content Body */}
                <div className="p-6 sm:p-8 overflow-y-auto space-y-5 flex-1 min-h-0 custom-scrollbar bg-slate-50/40">
                  {/* Status Banner */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-white border-2 border-slate-200 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          positionHistory.some(a => a.status === 'Active' && !a.end_date)
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            : 'bg-amber-50 text-amber-600 border border-amber-200'
                        }`}>
                          <FiUserCheck size={20} />
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Current Status</p>
                          <p className={`text-[15px] font-black ${
                            positionHistory.some(a => a.status === 'Active' && !a.end_date)
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}>
                            {positionHistory.some(a => a.status === 'Active' && !a.end_date)
                              ? 'Currently Occupied'
                              : 'Currently Vacant'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border-2 border-slate-200 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#08315F] border border-blue-200 flex items-center justify-center">
                          <FiClock size={20} />
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Total Deployment Records</p>
                          <p className="text-[15px] font-black text-[#08315F]">
                            {positionHistory.length} assignment record{positionHistory.length === 1 ? '' : 's'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Loading State */}
                  {loadingHistory ? (
                    <div className="p-12 text-center bg-white rounded-3xl border-2 border-slate-200">
                      <FiRefreshCw size={28} className="animate-spin text-[#08315F] mx-auto mb-3" />
                      <p className="text-[14px] font-black text-[#08315F] uppercase tracking-wider">Loading Assignment History...</p>
                      <p className="text-slate-400 text-xs font-bold mt-1">Retrieving official deployment records from tlo_assignments</p>
                    </div>
                  ) : positionHistory.length === 0 ? (
                    /* Empty State */
                    <div className="p-12 text-center bg-white rounded-3xl border-2 border-slate-200">
                      <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200">
                        <FiBriefcase size={30} />
                      </div>
                      <h3 className="text-lg font-['Plus_Jakarta_Sans'] font-black text-[#08315F] uppercase italic tracking-tight">
                        No Assignment Records Found
                      </h3>
                      <p className="text-slate-400 font-medium text-sm mt-1.5 max-w-md mx-auto">
                        This position has never had an official assigned to it in the database. It is currently vacant and available for deployment in Position Assignments.
                      </p>
                    </div>
                  ) : (
                    /* Assignment History Table & Cards */
                    <div className="space-y-3">
                      <h4 className="text-[13px] font-black text-slate-400 uppercase tracking-widest">
                        Assignment Log ({positionHistory.length})
                      </h4>

                      {/* Desktop Table View */}
                      <div className="hidden md:block bg-white rounded-2xl border-2 border-slate-200 overflow-hidden shadow-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                              <th className="px-4 py-3">Official</th>
                              <th className="px-3 py-3 text-center">Status</th>
                              <th className="px-3 py-3 text-center">Capacity</th>
                              <th className="px-4 py-3">Inclusive Dates</th>
                              <th className="px-4 py-3">Designation / Remarks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-[13px]">
                            {positionHistory.map((a) => {
                              const isActive = a.status === 'Active' && !a.end_date;
                              const officialDisplayName = a.official_name || `${a.first_name || ''} ${a.last_name || ''}`.trim() || 'Official';
                              return (
                                <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                                  {/* Official Info */}
                                  <td className="px-4 py-3.5 align-top">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-[#08315F] font-black text-xs border border-blue-200 shrink-0">
                                        {a.first_name ? a.first_name[0] : 'O'}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <p className="font-['Plus_Jakarta_Sans'] font-black text-[#08315F] leading-tight truncate">
                                            {officialDisplayName}
                                          </p>
                                          {a.tloid && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/official-profiling?tloid=${encodeURIComponent(a.tloid)}&TLOid=${encodeURIComponent(a.tloid)}${a.email ? `&email=${encodeURIComponent(a.email)}` : ''}`);
                                              }}
                                              title="View Official Profile"
                                              className="text-[#004A99] hover:text-[#08315F] transition-colors p-0.5 cursor-pointer"
                                            >
                                              <FiExternalLink size={12} />
                                            </button>
                                          )}
                                        </div>
                                        {a.tloid && (
                                          <p className="text-[11px] font-bold text-slate-400 font-mono">
                                            TLO ID: #{a.tloid}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </td>

                                  {/* Status */}
                                  <td className="px-3 py-3.5 align-middle text-center whitespace-nowrap">
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border ${
                                      isActive
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-slate-50 text-slate-500 border-slate-200'
                                    }`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                      {isActive ? 'Active' : 'Inactive'}
                                    </span>
                                  </td>

                                  {/* Capacity */}
                                  <td className="px-3 py-3.5 align-middle text-center whitespace-nowrap">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border ${
                                      a.capacity === 'Full' || a.capacity === 'Full-fledged'
                                        ? 'bg-blue-50 text-[#075985] border-blue-200'
                                        : a.capacity === 'OIC' || a.capacity === 'Officer-in-Charge (OIC)'
                                          ? 'bg-[#FCD116]/20 border-[#FCD116] text-[#0038A8]'
                                          : 'bg-purple-50 text-purple-700 border-purple-200'
                                    }`}>
                                      {a.capacity === 'Full' ? 'Full-fledged' : a.capacity === 'OIC' ? 'OIC' : a.capacity || '—'}
                                    </span>
                                  </td>

                                  {/* Inclusive Dates */}
                                  <td className="px-4 py-3.5 align-top whitespace-nowrap">
                                    <div className="flex items-center gap-1.5 font-mono text-[12px] font-bold text-slate-700">
                                      <FiCalendar size={13} className="text-slate-400 shrink-0" />
                                      <span>
                                        {a.start_date ? String(a.start_date).split('T')[0] : '—'}
                                      </span>
                                      <span className="text-slate-300">→</span>
                                      <span className={isActive ? 'text-emerald-700 font-black' : ''}>
                                        {isActive ? 'Present' : (a.end_date ? String(a.end_date).split('T')[0] : '—')}
                                      </span>
                                    </div>
                                  </td>

                                  {/* Designation / Remarks */}
                                  <td className="px-4 py-3.5 align-top">
                                    {a.designation && (
                                      <p className="text-[12px] font-bold text-purple-700 mb-0.5">
                                        {a.designation}
                                      </p>
                                    )}
                                    {a.remarks ? (
                                      <p className="text-[12px] text-slate-500 font-medium line-clamp-2" title={a.remarks}>
                                        {a.remarks}
                                      </p>
                                    ) : (
                                      !a.designation && <span className="text-slate-300 font-mono text-xs">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Cards View */}
                      <div className="md:hidden space-y-2.5">
                        {positionHistory.map((a) => {
                          const isActive = a.status === 'Active' && !a.end_date;
                          const officialDisplayName = a.official_name || `${a.first_name || ''} ${a.last_name || ''}`.trim() || 'Official';
                          return (
                            <div key={a.id} className="p-4 rounded-2xl bg-white border-2 border-slate-200 space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-[#08315F] font-black text-xs border border-blue-200 shrink-0">
                                    {a.first_name ? a.first_name[0] : 'O'}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-['Plus_Jakarta_Sans'] font-black text-[#08315F] text-[15px] leading-tight truncate">
                                      {officialDisplayName}
                                    </p>
                                    {a.tloid && (
                                      <p className="text-[11px] font-bold text-slate-400 font-mono">
                                        TLO ID: #{a.tloid}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-black uppercase tracking-wider border shrink-0 ${
                                  isActive
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-slate-50 text-slate-500 border-slate-200'
                                }`}>
                                  {isActive ? 'Active' : 'Inactive'}
                                </span>
                              </div>

                              <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-[12px] border border-slate-100">
                                <div className="flex justify-between items-center">
                                  <span className="font-black text-slate-400 uppercase tracking-wider">Capacity</span>
                                  <span className="font-black text-[#08315F]">{a.capacity || '—'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="font-black text-slate-400 uppercase tracking-wider">Inclusive Dates</span>
                                  <span className="font-mono font-bold text-slate-700">
                                    {a.start_date ? String(a.start_date).split('T')[0] : '—'} → {isActive ? 'Present' : (a.end_date ? String(a.end_date).split('T')[0] : '—')}
                                  </span>
                                </div>
                                {a.designation && (
                                  <div className="flex justify-between items-center">
                                    <span className="font-black text-slate-400 uppercase tracking-wider">Special Desig.</span>
                                    <span className="font-bold text-purple-700 text-right">{a.designation}</span>
                                  </div>
                                )}
                                {a.remarks && (
                                  <div className="flex justify-between items-start gap-2 pt-1 border-t border-slate-200/60">
                                    <span className="font-black text-slate-400 uppercase tracking-wider shrink-0">Remarks</span>
                                    <span className="text-slate-600 text-right">{a.remarks}</span>
                                  </div>
                                )}
                              </div>

                              {a.tloid && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/official-profiling?tloid=${encodeURIComponent(a.tloid)}&TLOid=${encodeURIComponent(a.tloid)}${a.email ? `&email=${encodeURIComponent(a.email)}` : ''}`);
                                  }}
                                  className="w-full py-2 px-3 bg-blue-50 text-[#08315F] hover:bg-[#08315F] hover:text-white rounded-xl text-[12px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all border border-blue-200 cursor-pointer"
                                >
                                  <FiExternalLink size={13} />
                                  <span>Open Official Profile</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="p-5 sm:p-6 border-t-2 border-slate-100 bg-slate-50/50 flex justify-end items-center">
                  <button
                    type="button"
                    onClick={() => setIsHistoryModalOpen(false)}
                    className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-[#08315F] hover:bg-[#004A99] text-white font-black text-[13.5px] uppercase tracking-widest transition-all text-center cursor-pointer shadow-md shadow-blue-900/10 active:scale-95"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </PageTransition>
  );
};

export default TloPositions;

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  FiCheck
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import AdminSidebar from '../components/AdminSidebar';
import PageTransition from '../components/PageTransition';
import LoadingScreen from '../components/LoadingScreen';
import Swal from 'sweetalert2';
import { apiUrl } from '../utils/api';

const TloPositions = () => {
  const { user, token } = useAuth();

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

  // Category Quick Pill State
  const [categoryPill, setCategoryPill] = useState('ALL');

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

  // Quick Category Pill Change
  const handleCategoryPillChange = (pill) => {
    setCategoryPill(pill);
    setCurrentPage(1);

    if (pill === 'ALL') {
      setRegionFilter('All');
      setSalaryGradeFilter('All');
      setSearchTerm('');
    } else if (pill === 'CENTRAL') {
      setRegionFilter('CENTRAL OFFICE');
      setSalaryGradeFilter('All');
    } else if (pill === 'REGIONAL') {
      setRegionFilter('All');
      setSearchTerm('Region');
    } else if (pill === 'EXEC_SG') {
      setRegionFilter('All');
      setSalaryGradeFilter('28');
    } else if (pill === 'SDS_ASDS') {
      setRegionFilter('All');
      setSalaryGradeFilter('26');
    }
  };

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
            {/* UNIFIED DATA CONTROLS TAB (Exact Match to PositionAssignments) */}
            <div className="bg-white border-2 border-[#08315F] rounded-[24px] p-3 shadow-sm mb-6 flex flex-col gap-2.5">
              {/* TOP ROW: CATEGORY PILL SWITCHER & ACTION BUTTONS */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 w-full">
                {/* Category Quick Pills */}
                <div className="flex items-center gap-1.5 p-1 bg-[#F0F9FF] border-2 border-[#BAE6FD] rounded-full overflow-x-auto custom-scrollbar">
                  {[
                    { id: 'ALL', label: 'All Positions' },
                    { id: 'CENTRAL', label: 'Central Office' },
                    { id: 'REGIONAL', label: 'Regional' },
                    { id: 'EXEC_SG', label: 'Executive (SG 28-31)' },
                    { id: 'SDS_ASDS', label: 'Superintendents (SG 26-27)' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => handleCategoryPillChange(tab.id)}
                      className={`h-[36px] px-4 rounded-full text-[12.5px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                        categoryPill === tab.id
                          ? 'bg-[#08315F] text-white shadow-sm'
                          : 'text-[#08315F] hover:bg-sky-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Buttons: Refresh & Add Plantilla Position */}
                <div className="flex items-center gap-2 shrink-0">
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

              {/* BOTTOM ROW: SEARCH BAR & DROPDOWN FILTERS */}
              <div className="flex flex-col md:flex-row items-center gap-2.5 w-full">
                {/* Search Bar */}
                <div className="relative flex-1 w-full h-[44px]">
                  <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#08315F]/50" size={16} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by position title, code, region, division, bureau, or salary grade..."
                    className="w-full h-full bg-[#F0F9FF] border-2 border-[#BAE6FD] rounded-full py-0 pl-11 pr-10 text-[14.5px] font-bold text-[#08315F] outline-none focus:border-sky-400 placeholder:text-[#08315F]/50 transition-colors"
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
                <div className="relative w-full md:w-64 h-[44px]">
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
                <div className="relative w-full md:w-48 h-[44px]">
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
                {(searchTerm || regionFilter !== 'All' || salaryGradeFilter !== 'All' || categoryPill !== 'ALL') && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setRegionFilter('All');
                      setSalaryGradeFilter('All');
                      setCategoryPill('ALL');
                      setCurrentPage(1);
                    }}
                    className="h-[44px] px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full border-2 border-slate-200 font-black text-[12px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 shrink-0"
                    title="Reset all filters"
                  >
                    <FiX size={14} />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>

            {/* STATS CARDS (Exact Match to PositionAssignments & OfficialsRegistry) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 w-full">
              {/* Card 1: Total Positions */}
              <div
                className="min-h-[100px] p-5 bg-white rounded-[16px] border-2 border-[#BAE6FD] border-l-[6px] border-l-sky-500 overflow-hidden transition-all flex flex-col justify-between hover:shadow-sm"
              >
                <div className="text-[14px] text-slate-500 uppercase tracking-widest font-bold mb-2">
                  Total Plantilla Positions
                </div>
                <div className="text-[44px] text-[#08315F] font-normal leading-none mb-2">
                  {(kpis.total_positions || totalRecords).toLocaleString()}
                </div>
                <div className="text-[12.5px] text-slate-400 uppercase tracking-widest font-bold leading-none">
                  Authorized catalog inventory
                </div>
              </div>

              {/* Card 2: Distinct Titles */}
              <div
                className="min-h-[100px] p-5 bg-white rounded-[16px] border-2 border-[#BAE6FD] border-l-[6px] border-l-rose-400 overflow-hidden transition-all flex flex-col justify-between hover:shadow-sm"
              >
                <div className="text-[14px] text-slate-500 uppercase tracking-widest font-bold mb-2">
                  Distinct Leadership Titles
                </div>
                <div className="text-[44px] text-[#08315F] font-normal leading-none mb-2">
                  {(kpis.unique_titles || 0).toLocaleString()}
                </div>
                <div className="text-[12.5px] text-slate-400 uppercase tracking-widest font-bold leading-none">
                  Unique executive designations
                </div>
              </div>

              {/* Card 3: Covered Regions */}
              <div
                className="min-h-[100px] p-5 bg-white rounded-[16px] border-2 border-[#BAE6FD] border-l-[6px] border-l-amber-400 overflow-hidden transition-all flex flex-col justify-between hover:shadow-sm"
              >
                <div className="text-[14px] text-slate-500 uppercase tracking-widest font-bold mb-2">
                  Covered Regions
                </div>
                <div className="text-[44px] text-[#08315F] font-normal leading-none mb-2">
                  {(kpis.total_regions || 0).toLocaleString()}
                </div>
                <div className="text-[12.5px] text-slate-400 uppercase tracking-widest font-bold leading-none">
                  DepEd nationwide coverage
                </div>
              </div>

              {/* Card 4: Highest Salary Grade */}
              <div
                className="min-h-[100px] p-5 bg-white rounded-[16px] border-2 border-[#BAE6FD] border-l-[6px] border-l-indigo-400 overflow-hidden transition-all flex flex-col justify-between hover:shadow-sm"
              >
                <div className="text-[14px] text-slate-500 uppercase tracking-widest font-bold mb-2">
                  Highest Salary Grade
                </div>
                <div className="text-[44px] text-[#08315F] font-normal leading-none mb-2">
                  {kpis.highest_salary_grade ? `SG ${kpis.highest_salary_grade}` : 'SG 31'}
                </div>
                <div className="text-[12.5px] text-slate-400 uppercase tracking-widest font-bold leading-none">
                  Executive ceiling grade
                </div>
              </div>
            </div>

            {/* MAIN DATA TABLE CARD (Exact Match to PositionAssignments) */}
            <AnimatePresence mode="wait">
              {positions.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card p-20 text-center bg-white rounded-[30px] border-2 border-[#08315F]"
                >
                  <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FiLayers size={40} />
                  </div>
                  <h3 className="text-xl font-['Plus_Jakarta_Sans'] font-black text-[#08315F] uppercase italic tracking-tight">
                    No Positions Found
                  </h3>
                  <p className="text-slate-400 font-medium mt-2">
                    {searchTerm || regionFilter !== 'All' || salaryGradeFilter !== 'All'
                      ? 'Adjust your search query or reset your region and grade filters.'
                      : 'Click "Add Plantilla Position" to add an official position entry.'}
                  </p>
                </motion.div>
              ) : (
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
                          {/* ID Column */}
                          <th
                            onClick={() => handleSort('id')}
                            className="px-4 py-3.5 text-left text-[12px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 hover:text-[#08315F] transition-colors w-[10%]"
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

                          {/* Position Title Column */}
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

                          {/* Position Code Column */}
                          <th
                            onClick={() => handleSort('position_code')}
                            className="px-4 py-3.5 text-left text-[12px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 hover:text-[#08315F] transition-colors w-[14%]"
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

                          {/* Salary Grade Column */}
                          <th
                            onClick={() => handleSort('salary_grade')}
                            className="px-4 py-3.5 text-left text-[12px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 hover:text-[#08315F] transition-colors w-[12%]"
                          >
                            <div className="flex items-center gap-1.5">
                              <span>Grade</span>
                              {sortBy === 'salary_grade' ? (
                                sortOrder === 'ASC' ? <FiChevronUp className="text-[#08315F]" size={14} /> : <FiChevronDown className="text-[#08315F]" size={14} />
                              ) : (
                                <span className="text-slate-300 text-xs">↕</span>
                              )}
                            </div>
                          </th>

                          {/* Region Column */}
                          <th
                            onClick={() => handleSort('region')}
                            className="px-4 py-3.5 text-left text-[12px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 hover:text-[#08315F] transition-colors w-[16%]"
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

                          {/* Division / Bureau Column */}
                          <th className="px-4 py-3.5 text-left text-[12px] font-black text-slate-500 uppercase tracking-wider w-[16%]">
                            Division / Bureau
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {positions.map((item) => {
                          const sgNum = parseInt(item.salary_grade, 10);
                          const isHighSg = !isNaN(sgNum) && sgNum >= 28;

                          return (
                            <tr
                              key={item.id}
                              className="hover:bg-sky-50/50 transition-colors relative group border-b border-slate-100"
                            >
                              {/* ID Badge */}
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className="px-2.5 py-1 rounded-lg font-mono font-bold text-[12px] bg-sky-50 text-[#08315F] border border-sky-200">
                                  #{item.id}
                                </span>
                              </td>

                              {/* Position Title */}
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

                              {/* Position Code */}
                              <td className="px-4 py-4 whitespace-nowrap">
                                {item.position_code ? (
                                  <span className="font-mono text-[11px] font-bold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 shadow-2xs">
                                    {item.position_code}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 font-mono text-[12px]">—</span>
                                )}
                              </td>

                              {/* Salary Grade */}
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

                              {/* Region */}
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className="text-[13px] font-bold text-slate-700">
                                  {item.region || <span className="text-slate-300">—</span>}
                                </span>
                              </td>

                              {/* Division / Bureau & Action Overlay */}
                              <td className="px-4 py-4 relative">
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

                                {/* Group Hover Action Toolbar (Matching PositionAssignments) */}
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 z-10 bg-white/95 backdrop-blur-md p-1.5 rounded-xl shadow-md border-2 border-slate-200 pointer-events-none group-hover:pointer-events-auto">
                                  <button
                                    onClick={() => handleOpenEdit(item)}
                                    title="Edit position details"
                                    className="flex items-center justify-center gap-1 px-3 py-1.5 bg-sky-50 text-[#08315F] rounded-lg text-[12.5px] font-black uppercase tracking-widest hover:bg-[#08315F] hover:text-white transition-all border-2 border-sky-200 shadow-2xs shrink-0 cursor-pointer"
                                  >
                                    <FiEdit2 size={13} />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeletePosition(item)}
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
                        })}
                      </tbody>
                    </table>

                    {/* Mobile Card View (Matching PositionAssignments) */}
                    <div className="md:hidden flex flex-col divide-y-2 divide-slate-100">
                      {positions.map((item) => (
                        <div key={item.id} className="p-4 bg-white hover:bg-slate-50/50 transition-colors flex flex-col gap-3">
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
                              <span className="font-bold text-slate-700 text-right truncate">
                                {item.region || '—'}
                              </span>
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
                              onClick={() => handleOpenEdit(item)}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-sky-50 text-[#08315F] rounded-xl text-[13px] font-black uppercase tracking-widest border-2 border-sky-200 hover:bg-[#08315F] hover:text-white transition-all shadow-2xs"
                            >
                              <FiEdit2 size={13} /> Edit
                            </button>
                            <button
                              onClick={() => handleDeletePosition(item)}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 rounded-xl text-[13px] font-black uppercase tracking-widest border-2 border-rose-200 hover:bg-rose-500 hover:text-white transition-all shadow-2xs"
                            >
                              <FiTrash2 size={13} /> Delete
                            </button>
                          </div>
                        </div>
                      ))}
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
              )}
            </AnimatePresence>
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
    </PageTransition>
  );
};

export default TloPositions;

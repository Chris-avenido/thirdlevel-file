import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiBriefcase,
  FiFileText,
  FiSearch,
  FiFilter,
  FiRefreshCw,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
  FiCalendar,
  FiX,
  FiChevronDown,
  FiChevronUp,
  FiChevronRight,
  FiUsers,
  FiDownload,
  FiEye,
  FiCheck,
  FiAward,
  FiPhone,
  FiMail,
  FiClock,
  FiLayers,
  FiPaperclip,
  FiMapPin,
  FiUser
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import AdminSidebar from '../components/AdminSidebar';
import PageTransition from '../components/PageTransition';
import LoadingScreen from '../components/LoadingScreen';
import ViewApplicationDetailsModal from '../components/ViewApplicationDetailsModal';
import Swal from 'sweetalert2';
import { apiUrl } from '../utils/api';

const AdminVacancies = () => {
  const { user, token } = useAuth();

  // Data States
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kpiCounts, setKpiCounts] = useState({
    total: 0,
    submitted: 0,
    under_review: 0,
    shortlisted: 0,
    appointed: 0,
    rejected: 0
  });

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [cesStageFilter, setCesStageFilter] = useState('All');
  const [letFilter, setLetFilter] = useState('All'); // 'All', 'yes', 'no'
  const [emtFilter, setEmtFilter] = useState('All'); // 'All', 'yes', 'no'

  // Sorting State
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Modal State
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch Applications
  const fetchApplications = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const authToken = token || localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(apiUrl('/api/third-level/vacancy-applications/all'), {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setApplications(data.data);
        if (data.kpis) {
          setKpiCounts({
            total: parseInt(data.kpis.total, 10) || data.data.length,
            submitted: parseInt(data.kpis.submitted, 10) || 0,
            under_review: parseInt(data.kpis.under_review, 10) || 0,
            shortlisted: parseInt(data.kpis.shortlisted, 10) || 0,
            appointed: parseInt(data.kpis.appointed ?? data.kpis.approved ?? 0, 10),
            rejected: parseInt(data.kpis.rejected, 10) || 0
          });
        } else {
          // Compute fallback KPIs
          const total = data.data.length;
          const submitted = data.data.filter(a => a.status === 'Submitted').length;
          const under_review = data.data.filter(a => a.status === 'Under Review').length;
          const shortlisted = data.data.filter(a => a.status === 'Shortlisted').length;
          const appointed = data.data.filter(a => a.status === 'Appointed' || a.status === 'Approved').length;
          const rejected = data.data.filter(a => a.status === 'Rejected').length;
          setKpiCounts({ total, submitted, under_review, shortlisted, appointed, rejected });
        }
      } else {
        throw new Error(data.error || 'Failed to load vacancy applications');
      }
    } catch (err) {
      console.error('[fetchApplications Error]:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error Loading Applications',
        text: err.message || 'Unable to retrieve applications from server.',
        confirmButtonColor: '#08315F'
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  // Unique CES Stages for filter dropdown
  const uniqueCesStages = useMemo(() => {
    const set = new Set();
    applications.forEach(a => {
      if (a.ces_eligibility_stage) set.add(a.ces_eligibility_stage);
    });
    return Array.from(set).sort();
  }, [applications]);

  // Sorting Handler
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(prev => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(column);
      setSortOrder('ASC');
    }
    setCurrentPage(1);
  };

  // Filtered & Sorted Applications
  const filteredApplications = useMemo(() => {
    let result = applications.filter(app => {
      // Status Filter
      if (statusFilter !== 'All') {
        if (statusFilter === 'Appointed') {
          if (app.status !== 'Appointed' && app.status !== 'Approved') return false;
        } else if (app.status !== statusFilter) {
          return false;
        }
      }

      // CES Stage Filter
      if (cesStageFilter !== 'All' && app.ces_eligibility_stage !== cesStageFilter) {
        return false;
      }

      // LET Passer Filter
      if (letFilter === 'yes' && !app.is_let_passer) return false;
      if (letFilter === 'no' && app.is_let_passer) return false;

      // EMT Passer Filter
      if (emtFilter === 'yes' && !app.is_emt_passer) return false;
      if (emtFilter === 'no' && app.is_emt_passer) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const appNo = (app.application_no || '').toLowerCase();
        const fullName = `${app.surname || ''} ${app.first_name || ''} ${app.middle_name || ''}`.toLowerCase();
        const email = (app.email || '').toLowerCase();
        const contact = (app.contact_number || '').toLowerCase();
        const pos = (app.position_applying_for || '').toLowerCase();
        const plantilla = (app.plantilla_office || '').toLowerCase();
        const currentPos = (app.current_position || '').toLowerCase();
        const targetId = (app.target_vacancy_id || '').toLowerCase();

        const match =
          appNo.includes(q) ||
          fullName.includes(q) ||
          email.includes(q) ||
          contact.includes(q) ||
          pos.includes(q) ||
          plantilla.includes(q) ||
          currentPos.includes(q) ||
          targetId.includes(q);

        if (!match) return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      let valA = a[sortBy] ?? '';
      let valB = b[sortBy] ?? '';

      if (sortBy === 'created_at') {
        valA = new Date(valA).getTime() || 0;
        valB = new Date(valB).getTime() || 0;
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB || '').toLowerCase();
      }

      if (valA < valB) return sortOrder === 'ASC' ? -1 : 1;
      if (valA > valB) return sortOrder === 'ASC' ? 1 : -1;
      return 0;
    });

    return result;
  }, [applications, statusFilter, cesStageFilter, letFilter, emtFilter, searchQuery, sortBy, sortOrder]);

  // Pagination calculations
  const totalRecords = filteredApplications.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const paginatedApplications = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredApplications.slice(startIndex, startIndex + pageSize);
  }, [filteredApplications, currentPage, pageSize]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, cesStageFilter, letFilter, emtFilter, pageSize]);

  // Handle Status Update from Modal
  const handleApplicationUpdated = (updatedApp) => {
    setApplications(prev => prev.map(a => (a.id === updatedApp.id ? { ...a, ...updatedApp } : a)));
    setSelectedApplication(prev => (prev && prev.id === updatedApp.id ? { ...prev, ...updatedApp } : prev));
    // Refetch silent to refresh KPI counts accurately
    fetchApplications(true);
  };

  // Export to CSV Function
  const handleExportCSV = () => {
    if (applications.length === 0) {
      Swal.fire({ icon: 'info', title: 'No Data', text: 'There are no vacancy applications to export.', confirmButtonColor: '#08315F' });
      return;
    }

    const headers = [
      'Application No',
      'Applicant UID',
      'Surname',
      'First Name',
      'Middle Name',
      'Email',
      'Contact Number',
      'Date of Birth',
      'Position Applying For',
      'Target Vacancy ID',
      'Current Position',
      'Plantilla Office',
      'Current Designation',
      'Assigned OIC Office',
      'LET Passer',
      'EMT Passer',
      'CES Eligibility Stage',
      'CES Stage Date',
      'Status',
      'Remarks',
      'Date Filed',
      'Last Updated'
    ];

    const rows = filteredApplications.map(a => [
      `"${a.application_no || ''}"`,
      `"${a.applicant_uid || ''}"`,
      `"${(a.surname || '').replace(/"/g, '""')}"`,
      `"${(a.first_name || '').replace(/"/g, '""')}"`,
      `"${(a.middle_name || '').replace(/"/g, '""')}"`,
      `"${a.email || ''}"`,
      `"${a.contact_number || ''}"`,
      `"${a.date_of_birth ? new Date(a.date_of_birth).toISOString().split('T')[0] : ''}"`,
      `"${(a.position_applying_for || '').replace(/"/g, '""')}"`,
      `"${a.target_vacancy_id || ''}"`,
      `"${(a.current_position || '').replace(/"/g, '""')}"`,
      `"${(a.plantilla_office || '').replace(/"/g, '""')}"`,
      `"${(a.current_designation || '').replace(/"/g, '""')}"`,
      `"${(a.assigned_oic_office || '').replace(/"/g, '""')}"`,
      `"${a.is_let_passer ? 'Yes' : 'No'}"`,
      `"${a.is_emt_passer ? 'Yes' : 'No'}"`,
      `"${(a.ces_eligibility_stage || '').replace(/"/g, '""')}"`,
      `"${a.ces_stage_date ? new Date(a.ces_stage_date).toISOString().split('T')[0] : ''}"`,
      `"${a.status || ''}"`,
      `"${(a.remarks || '').replace(/"/g, '""')}"`,
      `"${a.created_at ? new Date(a.created_at).toLocaleString() : ''}"`,
      `"${a.updated_at ? new Date(a.updated_at).toLocaleString() : ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DepEd_Vacancy_Applications_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Status Badge Helper
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Submitted':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Submitted
          </span>
        );
      case 'Under Review':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Under Review
          </span>
        );
      case 'Shortlisted':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            Shortlisted
          </span>
        );
      case 'Appointed':
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
            <FiCheck className="w-3 h-3 text-emerald-600 stroke-[3]" />
            Appointed
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
            <FiX className="w-3 h-3 text-rose-600 stroke-[3]" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
            {status || 'Submitted'}
          </span>
        );
    }
  };

  // Count Attached Documents Helper
  const countAttachedDocuments = (app) => {
    const docKeys = [
      'letter_of_intent_binary_id',
      'pds_binary_id',
      'work_experience_sheet_binary_id',
      'cv_binary_id',
      'outstanding_accomplishments_binary_id',
      'service_records_binary_id',
      'transcript_of_records_binary_id',
      'performance_eval_binary_id',
      'self_certification_binary_id',
      'id_picture_binary_id',
      'applicant_profile_doc_binary_id',
      'other_documents_binary_id'
    ];
    return docKeys.filter(k => Boolean(app[k])).length;
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setCesStageFilter('All');
    setLetFilter('All');
    setEmtFilter('All');
    setSortBy('created_at');
    setSortOrder('DESC');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    statusFilter !== 'All' ||
    cesStageFilter !== 'All' ||
    letFilter !== 'All' ||
    emtFilter !== 'All' ||
    sortBy !== 'created_at' ||
    sortOrder !== 'DESC';

  if (loading && applications.length === 0) {
    return <LoadingScreen />;
  }

  return (
    <PageTransition>
      <div className="flex h-screen bg-transparent font-sans overflow-hidden">
        {/* Navigation Sidebar */}
        <AdminSidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto relative bg-transparent">
          {/* TOP NAVIGATION BAR (Exact Match to TloPositions) */}
          <header className="sticky top-0 z-50 bg-[#08315F] backdrop-blur-md border-b border-blue-900 px-8 py-4 flex items-center justify-between shadow-lg shadow-blue-900/20 shrink-0 w-full">
            <div className="flex items-center gap-4 text-white">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white shadow-inner">
                <FiBriefcase size={20} />
              </div>
              <div>
                <h1 className="text-lg font-['Plus_Jakarta_Sans'] font-black text-white tracking-tight leading-none italic uppercase">
                  Vacancy <span className="text-blue-300 not-italic">Applications</span>
                </h1>
                <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest mt-1">
                  Recruitment &amp; Selection • TIMON (Third Level Incumbent and Management Operations Network)
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

          {/* MAIN CONTAINER (Exact Match to TloPositions) */}
          <main className="flex-1 px-8 pb-8 pt-6 max-w-[1600px] mx-auto w-full dashboard-theme !bg-transparent">
            {/* UNIFIED DATA CONTROLS TAB */}
            <div className="bg-white border-2 border-[#08315F] rounded-[24px] p-3 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-3 w-full">
              {/* Left/Center: Search Bar & Dropdown Filters & Quick Filters */}
              <div className="flex flex-col md:flex-row items-center gap-2.5 flex-1 w-full min-w-0 flex-wrap">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-[260px] w-full h-[44px]">
                  <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#08315F]/50" size={16} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by application no, applicant name, email, position, plantilla..."
                    className="w-full h-full bg-[#F0F9FF] border-2 border-[#BAE6FD] rounded-full py-0 pl-11 pr-10 text-[14px] font-bold text-[#08315F] outline-none focus:border-sky-400 placeholder:text-[#08315F]/50 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      title="Clear search"
                    >
                      <FiX size={16} />
                    </button>
                  )}
                </div>

                {/* Status Filter */}
                <div className="relative w-full md:w-52 h-[44px] shrink-0">
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full h-full bg-[#F0F9FF] border-2 border-[#BAE6FD] rounded-full px-4 text-[13px] font-black text-[#08315F] outline-none focus:border-sky-400 appearance-none pr-10 cursor-pointer"
                  >
                    <option value="All">All Statuses ({applications.length})</option>
                    <option value="Submitted">Submitted ({kpiCounts.submitted})</option>
                    <option value="Under Review">Under Review ({kpiCounts.under_review})</option>
                    <option value="Shortlisted">Shortlisted ({kpiCounts.shortlisted})</option>
                    <option value="Appointed">Appointed ({kpiCounts.appointed})</option>
                    <option value="Rejected">Rejected ({kpiCounts.rejected})</option>
                  </select>
                  <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-[#08315F]/60 pointer-events-none w-4 h-4" />
                </div>

                {/* CES Stage Filter */}
                <div className="relative w-full md:w-48 h-[44px] shrink-0">
                  <select
                    value={cesStageFilter}
                    onChange={(e) => {
                      setCesStageFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full h-full bg-[#F0F9FF] border-2 border-[#BAE6FD] rounded-full px-4 text-[13px] font-black text-[#08315F] outline-none focus:border-sky-400 appearance-none pr-10 cursor-pointer"
                  >
                    <option value="All">All CES Stages</option>
                    {uniqueCesStages.map(stage => (
                      <option key={stage} value={stage}>{stage}</option>
                    ))}
                  </select>
                  <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-[#08315F]/60 pointer-events-none w-4 h-4" />
                </div>

                {/* Quick Filter: LET Passer */}
                <button
                  onClick={() => setLetFilter(prev => prev === 'yes' ? 'All' : 'yes')}
                  className={`h-[44px] px-4 rounded-full border-2 font-black text-[12px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                    letFilter === 'yes'
                      ? 'bg-[#08315F] text-white border-[#08315F]'
                      : 'bg-[#F0F9FF] text-[#08315F] hover:bg-sky-100 border-[#BAE6FD]'
                  }`}
                  title="Filter LET Passers"
                >
                  <span>LET Passer</span>
                  {letFilter === 'yes' && <FiCheck size={14} />}
                </button>

                {/* Quick Filter: EMT Passer */}
                <button
                  onClick={() => setEmtFilter(prev => prev === 'yes' ? 'All' : 'yes')}
                  className={`h-[44px] px-4 rounded-full border-2 font-black text-[12px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                    emtFilter === 'yes'
                      ? 'bg-[#08315F] text-white border-[#08315F]'
                      : 'bg-[#F0F9FF] text-[#08315F] hover:bg-sky-100 border-[#BAE6FD]'
                  }`}
                  title="Filter EMT Passers"
                >
                  <span>EMT Passer</span>
                  {emtFilter === 'yes' && <FiCheck size={14} />}
                </button>

                {/* Reset Filters */}
                {hasActiveFilters && (
                  <button
                    onClick={handleResetFilters}
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
                  onClick={() => fetchApplications(true)}
                  disabled={refreshing}
                  className="h-[44px] px-5 bg-[#F0F9FF] hover:bg-sky-100 text-[#08315F] rounded-full border-2 border-[#BAE6FD] font-black text-[13.5px] tracking-widest uppercase transition-colors flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50 active:scale-95 cursor-pointer"
                  title="Refresh data"
                >
                  <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-sky-600' : ''}`} />
                  <span>Refresh</span>
                </button>

                <button
                  onClick={handleExportCSV}
                  className="h-[44px] px-6 bg-[#08315F] hover:bg-[#004A99] text-white rounded-full font-black text-[13.5px] tracking-widest uppercase transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-md active:scale-95 border-2 border-transparent cursor-pointer"
                  title="Export applications to CSV"
                >
                  <FiDownload className="w-4 h-4 stroke-[3]" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* STATS CARDS (Exact Match to TloPositions layout, borders & styling) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6 w-full relative z-30">
              {/* Card 1: Total Applications */}
              <div className="relative group">
                <div
                  onClick={() => {
                    setStatusFilter('All');
                    setCurrentPage(1);
                  }}
                  className={`min-h-[108px] p-5 bg-white rounded-[18px] border-2 border-[#BAE6FD] border-l-[6px] transition-all flex flex-col justify-between cursor-pointer select-none ${
                    statusFilter === 'All'
                      ? 'border-l-sky-500 shadow-md ring-2 ring-sky-200 bg-sky-50/20'
                      : 'border-l-sky-400 hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[13.5px] text-slate-500 uppercase tracking-widest font-black">
                      Total Applications
                    </div>
                    {statusFilter === 'All' && (
                      <span className="flex items-center gap-1 text-[10px] font-black text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full border border-sky-200 uppercase tracking-wider">
                        <FiCheck className="w-3 h-3" /> Active
                      </span>
                    )}
                  </div>
                  <div className="text-[44px] text-[#08315F] font-normal leading-none my-1 font-['Plus_Jakarta_Sans']">
                    {kpiCounts.total.toLocaleString()}
                  </div>
                  <div className="text-[12px] text-slate-400 uppercase tracking-widest font-bold leading-none flex items-center justify-between">
                    <span>All submitted filings</span>
                    <span className="text-sky-600 font-black text-[11px] opacity-0 group-hover:opacity-100 transition-opacity">
                      Click to Filter →
                    </span>
                  </div>
                </div>

                {/* Hover Popover: Registry Summary */}
                <div className="absolute top-[calc(100%+6px)] left-0 w-full sm:w-[320px] opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 z-50">
                  <div className="bg-white/95 backdrop-blur-md rounded-2xl border-2 border-[#BAE6FD] shadow-[0_20px_40px_-10px_rgba(8,49,95,0.25)] p-4 text-left">
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
                          <FiLayers size={13} />
                        </div>
                        <span className="text-[13px] font-black text-[#08315F] uppercase tracking-wider">Registry Summary</span>
                      </div>
                      <span className="text-[11px] font-black text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                        {kpiCounts.total} Total
                      </span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-600 font-bold">Initial Filings</span>
                        <span className="font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">{kpiCounts.submitted}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-600 font-bold">Under Review</span>
                        <span className="font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">{kpiCounts.under_review}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-600 font-bold">Shortlisted Pool</span>
                        <span className="font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">{kpiCounts.shortlisted}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-600 font-bold">Appointed Candidates</span>
                        <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">{kpiCounts.appointed}</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] font-black text-sky-700 uppercase tracking-wider text-center">
                      ⚡ Click card to show all applications &amp; reset filter
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Submitted / Initial Filings */}
              <div className="relative group">
                <div
                  onClick={() => {
                    setStatusFilter(statusFilter === 'Submitted' ? 'All' : 'Submitted');
                    setCurrentPage(1);
                  }}
                  className={`min-h-[108px] p-5 bg-white rounded-[18px] border-2 border-[#BAE6FD] border-l-[6px] transition-all flex flex-col justify-between cursor-pointer select-none ${
                    statusFilter === 'Submitted'
                      ? 'border-l-blue-600 shadow-md ring-2 ring-blue-200 bg-blue-50/20'
                      : 'border-l-blue-500 hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[13.5px] text-slate-500 uppercase tracking-widest font-black">
                      Initial Filings
                    </div>
                    {statusFilter === 'Submitted' && (
                      <span className="flex items-center gap-1 text-[10px] font-black text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200 uppercase tracking-wider">
                        <FiCheck className="w-3 h-3" /> Filtered
                      </span>
                    )}
                  </div>
                  <div className="text-[44px] text-blue-700 font-normal leading-none my-1 font-['Plus_Jakarta_Sans']">
                    {kpiCounts.submitted.toLocaleString()}
                  </div>
                  <div className="text-[12px] text-slate-400 uppercase tracking-widest font-bold leading-none flex items-center justify-between">
                    <span>Submitted status</span>
                    <span className="text-blue-600 font-black text-[11px] opacity-0 group-hover:opacity-100 transition-opacity">
                      Click to Filter →
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Under Review */}
              <div className="relative group">
                <div
                  onClick={() => {
                    setStatusFilter(statusFilter === 'Under Review' ? 'All' : 'Under Review');
                    setCurrentPage(1);
                  }}
                  className={`min-h-[108px] p-5 bg-white rounded-[18px] border-2 border-[#BAE6FD] border-l-[6px] transition-all flex flex-col justify-between cursor-pointer select-none ${
                    statusFilter === 'Under Review'
                      ? 'border-l-amber-500 shadow-md ring-2 ring-amber-200 bg-amber-50/20'
                      : 'border-l-amber-400 hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[13.5px] text-slate-500 uppercase tracking-widest font-black">
                      Being Evaluated
                    </div>
                    {statusFilter === 'Under Review' && (
                      <span className="flex items-center gap-1 text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 uppercase tracking-wider">
                        <FiCheck className="w-3 h-3" /> Filtered
                      </span>
                    )}
                  </div>
                  <div className="text-[44px] text-amber-700 font-normal leading-none my-1 font-['Plus_Jakarta_Sans']">
                    {kpiCounts.under_review.toLocaleString()}
                  </div>
                  <div className="text-[12px] text-slate-400 uppercase tracking-widest font-bold leading-none flex items-center justify-between">
                    <span>Under review stage</span>
                    <span className="text-amber-600 font-black text-[11px] opacity-0 group-hover:opacity-100 transition-opacity">
                      Click to Filter →
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 4: Shortlisted Stage */}
              <div className="relative group">
                <div
                  onClick={() => {
                    setStatusFilter(statusFilter === 'Shortlisted' ? 'All' : 'Shortlisted');
                    setCurrentPage(1);
                  }}
                  className={`min-h-[108px] p-5 bg-white rounded-[18px] border-2 border-[#BAE6FD] border-l-[6px] transition-all flex flex-col justify-between cursor-pointer select-none ${
                    statusFilter === 'Shortlisted'
                      ? 'border-l-purple-500 shadow-md ring-2 ring-purple-200 bg-purple-50/20'
                      : 'border-l-purple-400 hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[13.5px] text-slate-500 uppercase tracking-widest font-black">
                      Qualified Stage
                    </div>
                    {statusFilter === 'Shortlisted' && (
                      <span className="flex items-center gap-1 text-[10px] font-black text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200 uppercase tracking-wider">
                        <FiCheck className="w-3 h-3" /> Filtered
                      </span>
                    )}
                  </div>
                  <div className="text-[44px] text-purple-700 font-normal leading-none my-1 font-['Plus_Jakarta_Sans']">
                    {kpiCounts.shortlisted.toLocaleString()}
                  </div>
                  <div className="text-[12px] text-slate-400 uppercase tracking-widest font-bold leading-none flex items-center justify-between">
                    <span>Shortlisted pool</span>
                    <span className="text-purple-600 font-black text-[11px] opacity-0 group-hover:opacity-100 transition-opacity">
                      Click to Filter →
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 5: Official Masterlist / Appointed */}
              <div className="relative group">
                <div
                  onClick={() => {
                    setStatusFilter(statusFilter === 'Appointed' ? 'All' : 'Appointed');
                    setCurrentPage(1);
                  }}
                  className={`min-h-[108px] p-5 bg-white rounded-[18px] border-2 border-[#BAE6FD] border-l-[6px] transition-all flex flex-col justify-between cursor-pointer select-none ${
                    statusFilter === 'Appointed'
                      ? 'border-l-emerald-500 shadow-md ring-2 ring-emerald-200 bg-emerald-50/20'
                      : 'border-l-emerald-400 hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[13.5px] text-slate-500 uppercase tracking-widest font-black">
                      Official Masterlist
                    </div>
                    {statusFilter === 'Appointed' && (
                      <span className="flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 uppercase tracking-wider">
                        <FiCheck className="w-3 h-3" /> Filtered
                      </span>
                    )}
                  </div>
                  <div className="text-[44px] text-emerald-700 font-normal leading-none my-1 font-['Plus_Jakarta_Sans']">
                    {kpiCounts.appointed.toLocaleString()}
                  </div>
                  <div className="text-[12px] text-slate-400 uppercase tracking-widest font-bold leading-none flex items-center justify-between">
                    <span>Appointed &amp; Active</span>
                    <span className="text-emerald-600 font-black text-[11px] opacity-0 group-hover:opacity-100 transition-opacity">
                      Click to Filter →
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* MAIN DATA TABLE CARD (Exact Match to TloPositions) */}
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
                      {/* 1. Application No */}
                      <th
                        onClick={() => handleSort('application_no')}
                        className="px-4 py-3.5 text-left text-[12px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 hover:text-[#08315F] transition-colors w-[13%]"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Application No</span>
                          {sortBy === 'application_no' ? (
                            sortOrder === 'ASC' ? <FiChevronUp className="text-[#08315F]" size={14} /> : <FiChevronDown className="text-[#08315F]" size={14} />
                          ) : (
                            <span className="text-slate-300 text-xs">↕</span>
                          )}
                        </div>
                      </th>

                      {/* 2. Applicant Name */}
                      <th
                        onClick={() => handleSort('surname')}
                        className="px-4 py-3.5 text-left text-[12px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 hover:text-[#08315F] transition-colors w-[23%]"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Applicant Details</span>
                          {sortBy === 'surname' ? (
                            sortOrder === 'ASC' ? <FiChevronUp className="text-[#08315F]" size={14} /> : <FiChevronDown className="text-[#08315F]" size={14} />
                          ) : (
                            <span className="text-slate-300 text-xs">↕</span>
                          )}
                        </div>
                      </th>

                      {/* 3. Position Applying For */}
                      <th
                        onClick={() => handleSort('position_applying_for')}
                        className="px-4 py-3.5 text-left text-[12px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 hover:text-[#08315F] transition-colors w-[20%]"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Position Applying For</span>
                          {sortBy === 'position_applying_for' ? (
                            sortOrder === 'ASC' ? <FiChevronUp className="text-[#08315F]" size={14} /> : <FiChevronDown className="text-[#08315F]" size={14} />
                          ) : (
                            <span className="text-slate-300 text-xs">↕</span>
                          )}
                        </div>
                      </th>

                      {/* 4. Current Plantilla & Office */}
                      <th className="px-4 py-3.5 text-left text-[12px] font-black text-slate-500 uppercase tracking-wider w-[17%]">
                        Current Plantilla / Designation
                      </th>

                      {/* 5. CES Eligibility */}
                      <th className="px-4 py-3.5 text-left text-[12px] font-black text-slate-500 uppercase tracking-wider w-[12%]">
                        CES Eligibility
                      </th>

                      {/* 6. Docs */}
                      <th className="px-3 py-3.5 text-center text-[12px] font-black text-slate-500 uppercase tracking-wider w-[6%]">
                        Docs
                      </th>

                      {/* 7. Status */}
                      <th
                        onClick={() => handleSort('status')}
                        className="px-4 py-3.5 text-center text-[12px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 hover:text-[#08315F] transition-colors w-[9%]"
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span>Status</span>
                          {sortBy === 'status' ? (
                            sortOrder === 'ASC' ? <FiChevronUp className="text-[#08315F]" size={14} /> : <FiChevronDown className="text-[#08315F]" size={14} />
                          ) : (
                            <span className="text-slate-300 text-xs">↕</span>
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedApplications.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-16 text-center">
                          <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FiFileText size={32} />
                          </div>
                          <h3 className="text-lg font-['Plus_Jakarta_Sans'] font-black text-[#08315F] uppercase italic tracking-tight">
                            No Vacancy Applications Found
                          </h3>
                          <p className="text-slate-400 font-medium text-sm mt-1 max-w-md mx-auto">
                            {hasActiveFilters
                              ? 'Adjust your search query or reset your status and CES stage filters.'
                              : 'No vacancy applications have been registered in the database yet.'}
                          </p>
                          {hasActiveFilters && (
                            <button
                              onClick={handleResetFilters}
                              className="mt-4 px-4 py-2 bg-[#08315F] hover:bg-[#004A99] text-white rounded-full text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                            >
                              Reset All Filters
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      paginatedApplications.map((app) => {
                        const docsAttached = countAttachedDocuments(app);
                        const hasIdPicture = Boolean(app.id_picture_binary_id);
                        const formattedPhone =
                          app.contact_number && app.contact_number.length === 11
                            ? `${app.contact_number.slice(0, 4)}-${app.contact_number.slice(4, 7)}-${app.contact_number.slice(7)}`
                            : app.contact_number || '—';

                        return (
                          <tr
                            key={app.id}
                            onClick={() => {
                              if (app.is_already_appointed_elsewhere) return;
                              setSelectedApplication(app);
                              setIsModalOpen(true);
                            }}
                            className={`hover:bg-sky-50/70 transition-colors relative group border-b border-slate-100 ${
                              app.is_already_appointed_elsewhere
                                ? 'bg-slate-50/60 opacity-60 cursor-not-allowed select-none'
                                : 'cursor-pointer'
                            }`}
                            title={
                              app.is_already_appointed_elsewhere
                                ? `Reappointment Disabled: Applicant is already appointed as ${app.appointed_tlo_id} (${app.masterlist_position_title || 'Official'}) in Masterlist.`
                                : 'Click to view application details & evaluations'
                            }
                          >
                            {/* 1. Application No */}
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-lg font-mono font-bold text-[12px] bg-sky-50 text-[#08315F] border border-sky-200">
                                {app.application_no}
                              </span>
                              {app.created_at && (
                                <div className="text-[10px] text-slate-400 font-semibold mt-1">
                                  {new Date(app.created_at).toLocaleDateString()}
                                </div>
                              )}
                            </td>

                            {/* 2. Applicant Details */}
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-slate-200 shadow-xs flex items-center justify-center font-black text-xs text-[#08315F] shrink-0 overflow-hidden">
                                  {hasIdPicture ? (
                                    <img
                                      src={apiUrl(`/api/binary/${app.id_picture_binary_id}`)}
                                      alt=""
                                      className="w-full h-full object-cover"
                                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                  ) : null}
                                  <span className="select-none">{(app.first_name || 'U')[0]}{(app.surname || 'A')[0]}</span>
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-['Plus_Jakarta_Sans'] font-black text-[#08315F] text-[14px] uppercase truncate">
                                      {app.surname}, {app.first_name} {app.middle_name || ''}
                                    </span>
                                    {app.is_already_appointed_elsewhere ? (
                                      <span
                                        title={`Already appointed as ${app.appointed_tlo_id} in Masterlist`}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-black uppercase tracking-tight bg-amber-50 text-amber-800 border border-amber-300 shrink-0"
                                      >
                                        <FiAlertCircle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                        {app.appointed_tlo_id}
                                      </span>
                                    ) : app.appointed_tlo_id ? (
                                      <span
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-black uppercase tracking-tight bg-emerald-50 text-emerald-800 border border-emerald-300 shrink-0"
                                      >
                                        <FiCheck className="w-2.5 h-2.5 text-emerald-600 shrink-0 stroke-[3]" />
                                        {app.appointed_tlo_id}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 truncate mt-0.5">
                                    <FiMail size={11} className="text-slate-400 shrink-0" />
                                    <span className="truncate">{app.email}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-[10.5px] font-medium text-slate-400 truncate">
                                    <FiPhone size={10} className="text-slate-400 shrink-0" />
                                    <span>{formattedPhone}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* 3. Position Applying For */}
                            <td className="px-4 py-4">
                              <div className="font-['Plus_Jakarta_Sans'] font-black text-[14px] text-[#08315F] leading-snug truncate" title={app.position_applying_for}>
                                {app.position_applying_for}
                              </div>
                              {app.target_vacancy_id && (
                                <div className="mt-1">
                                  <span className="inline-block text-[10px] font-mono font-bold text-[#075985] bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">
                                    {app.target_vacancy_id}
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* 4. Current Plantilla & Office / Designation */}
                            <td className="px-4 py-4">
                              <div className="truncate">
                                <div className="text-[12.5px] font-black text-slate-800 uppercase truncate">
                                  {!app.current_position || app.current_position.toLowerCase() === 'n/a' ? 'N/A' : app.current_position}
                                </div>
                                {app.plantilla_office && app.plantilla_office.toLowerCase() !== 'n/a' && (
                                  <div className="text-[11px] font-medium text-slate-500 truncate mt-0.5" title={app.plantilla_office}>
                                    {app.plantilla_office}
                                  </div>
                                )}
                                {app.assigned_oic_office && !['n/a', 'na', 'none', ''].includes(app.assigned_oic_office.trim().toLowerCase()) && (
                                  <div className="text-[10px] text-amber-700 font-bold truncate mt-0.5">
                                    OIC: {app.assigned_oic_office}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* 5. CES Eligibility */}
                            <td className="px-4 py-4">
                              <div className="font-bold text-slate-800 text-[11.5px] leading-tight truncate" title={app.ces_eligibility_stage || 'N/A'}>
                                {app.ces_eligibility_stage || 'N/A'}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 text-[10px] font-black">
                                {app.is_let_passer && (
                                  <span className="bg-sky-50 text-[#075985] px-1.5 py-0.5 rounded border border-sky-200">
                                    LET
                                  </span>
                                )}
                                {app.is_emt_passer && (
                                  <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">
                                    EMT
                                  </span>
                                )}
                                {app.ces_stage_date && (
                                  <span className="text-slate-400 font-medium">
                                    {new Date(app.ces_stage_date).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* 6. Docs */}
                            <td className="px-3 py-4 text-center whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-black ${
                                  docsAttached === 12
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                <FiPaperclip size={10} />
                                {docsAttached}/12
                              </span>
                            </td>

                            {/* 7. Status & Action */}
                            <td className="px-4 py-4 whitespace-nowrap text-center relative">
                              <div className="flex flex-col items-center justify-center gap-1">
                                {renderStatusBadge(app.status)}
                                {app.is_already_appointed_elsewhere && (
                                  <span
                                    title="Candidate already appointed in Masterlist."
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight bg-amber-50 text-amber-800 border border-amber-300"
                                  >
                                    <FiAlertCircle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                    Reappoint Blocked
                                  </span>
                                )}
                              </div>

                              {/* Hover Action Toolbar (Matching TloPositions) */}
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 z-10 bg-white/95 backdrop-blur-md p-1.5 rounded-xl shadow-md border-2 border-slate-200 pointer-events-none group-hover:pointer-events-auto">
                                {app.is_already_appointed_elsewhere ? (
                                  <button
                                    type="button"
                                    disabled
                                    className="flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-400 rounded-lg text-[12px] font-black uppercase tracking-widest border-2 border-slate-200 cursor-not-allowed opacity-60"
                                  >
                                    <FiEye size={13} />
                                    <span>Disabled</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedApplication(app);
                                      setIsModalOpen(true);
                                    }}
                                    title="View full application details"
                                    className="flex items-center justify-center gap-1 px-3 py-1.5 bg-sky-50 text-[#08315F] rounded-lg text-[12px] font-black uppercase tracking-widest hover:bg-[#08315F] hover:text-white transition-all border-2 border-sky-200 shadow-2xs shrink-0 cursor-pointer"
                                  >
                                    <FiEye size={13} />
                                    <span>View</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

                {/* Mobile Card View (Exact Match to TloPositions) */}
                <div className="md:hidden flex flex-col divide-y-2 divide-slate-100">
                  {paginatedApplications.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FiFileText size={32} />
                      </div>
                      <h3 className="text-lg font-['Plus_Jakarta_Sans'] font-black text-[#08315F] uppercase italic tracking-tight">
                        No Applications Found
                      </h3>
                      <p className="text-slate-400 font-medium text-sm mt-1 max-w-md mx-auto">
                        {hasActiveFilters
                          ? 'Adjust your search query or reset your filters.'
                          : 'No vacancy applications have been recorded yet.'}
                      </p>
                    </div>
                  ) : (
                    paginatedApplications.map((app) => {
                      const docsAttached = countAttachedDocuments(app);
                      return (
                        <div
                          key={app.id}
                          onClick={() => {
                            if (app.is_already_appointed_elsewhere) return;
                            setSelectedApplication(app);
                            setIsModalOpen(true);
                          }}
                          className={`p-4 bg-white hover:bg-slate-50/70 transition-colors flex flex-col gap-3 cursor-pointer ${
                            app.is_already_appointed_elsewhere ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#08315F] font-black text-xs flex items-center justify-center border-2 border-sky-200 shadow-sm shrink-0">
                                {app.application_no?.slice(-4) || '#'}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-['Plus_Jakarta_Sans'] font-black text-[#08315F] text-[15px] leading-tight truncate">
                                  {app.surname}, {app.first_name} {app.middle_name || ''}
                                </h4>
                                <div className="text-[12px] font-bold text-slate-400 mt-0.5 truncate font-mono">
                                  {app.application_no}
                                </div>
                              </div>
                            </div>

                            <div>
                              {renderStatusBadge(app.status)}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 mt-1 bg-slate-50/70 rounded-2xl p-3.5 border-2 border-slate-200 text-[13px]">
                            <div className="flex justify-between items-center gap-2">
                              <span className="font-black text-slate-400 uppercase tracking-widest shrink-0">Applying For</span>
                              <span className="font-black text-[#08315F] text-right truncate">
                                {app.position_applying_for}
                              </span>
                            </div>
                            <div className="flex justify-between items-center gap-2">
                              <span className="font-black text-slate-400 uppercase tracking-widest shrink-0">Plantilla</span>
                              <span className="font-bold text-slate-700 text-right truncate">
                                {app.plantilla_office || 'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center gap-2">
                              <span className="font-black text-slate-400 uppercase tracking-widest shrink-0">Docs</span>
                              <span className="font-bold text-emerald-700 text-right">
                                {docsAttached}/12 Attached
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            {!app.is_already_appointed_elsewhere ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedApplication(app);
                                  setIsModalOpen(true);
                                }}
                                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-sky-50 text-[#08315F] rounded-xl text-[13px] font-black uppercase tracking-widest border-2 border-sky-200 hover:bg-[#08315F] hover:text-white transition-all shadow-2xs"
                              >
                                <FiEye size={13} /> View Details
                              </button>
                            ) : (
                              <div className="w-full text-center py-1 text-[11px] font-bold text-amber-700 bg-amber-50 rounded-lg border border-amber-200">
                                Reappointment Disabled
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* TABLE FOOTER / PAGINATION (Exact Match to TloPositions) */}
                <div className="px-8 py-5 bg-white border-t-2 border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span className="text-[14px] font-black text-slate-400 uppercase tracking-widest">
                      Showing {totalRecords === 0 ? 0 : ((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalRecords)} of {totalRecords.toLocaleString()} applications
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

        {/* View Details Modal with Central Office Evaluation capabilities */}
        <ViewApplicationDetailsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          application={selectedApplication}
          allowStatusUpdate={true}
          onStatusUpdated={handleApplicationUpdated}
        />
      </div>
    </PageTransition>
  );
};

export default AdminVacancies;


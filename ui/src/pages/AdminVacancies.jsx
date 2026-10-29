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
  FiPaperclip
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

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
        text: err.message || 'Unable to retrieve applications from server.'
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

  // Filtered Applications
  const filteredApplications = useMemo(() => {
    return applications.filter(app => {
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
  }, [applications, statusFilter, cesStageFilter, letFilter, emtFilter, searchQuery]);

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
      Swal.fire({ icon: 'info', title: 'No Data', text: 'There are no vacancy applications to export.' });
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Submitted
          </span>
        );
      case 'Under Review':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Under Review
          </span>
        );
      case 'Shortlisted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            Shortlisted
          </span>
        );
      case 'Appointed':
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
            <FiCheck className="w-3 h-3 text-emerald-600 stroke-[3]" />
            Appointed
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
            <FiX className="w-3 h-3 text-rose-600 stroke-[3]" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
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
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    statusFilter !== 'All' ||
    cesStageFilter !== 'All' ||
    letFilter !== 'All' ||
    emtFilter !== 'All';

  if (loading && applications.length === 0) {
    return <LoadingScreen />;
  }

  return (
    <PageTransition>
      <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800">
        {/* Navigation Sidebar */}
        <AdminSidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto relative">
          {/* TOP NAVIGATION BAR */}
          <header className="sticky top-0 z-50 bg-[#08315F] backdrop-blur-md border-b border-blue-900 px-8 py-4 flex items-center justify-between shadow-lg shadow-blue-900/20 shrink-0">
            <div className="flex items-center gap-4">
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

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1720px] w-full mx-auto space-y-6">
            {/* Top Executive Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase bg-[#08315F] text-white">
                    Central Office Registry
                  </span>
                  <span className="text-xs text-slate-400 font-bold">•</span>
                  <span className="text-xs font-bold text-slate-500">Third Level Positions</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-[#08315F] tracking-tight uppercase flex items-center gap-3">
                  <FiBriefcase className="w-7 h-7 text-[#08315F]" />
                  <span>Vacancy Applications</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                  Complete central office database and evaluation repository for all third-level vacancy applications.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 self-start md:self-center">
                <button
                  onClick={() => fetchApplications(true)}
                  disabled={refreshing}
                  className="h-[42px] px-4 bg-[#F0F9FF] hover:bg-sky-100 text-[#08315F] rounded-full border-2 border-[#BAE6FD] font-black text-xs tracking-wider uppercase transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  title="Refresh application data"
                >
                  <FiRefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-sky-600' : ''}`} />
                  <span>Refresh</span>
                </button>

                <button
                  onClick={handleExportCSV}
                  className="h-[42px] px-5 bg-[#08315F] hover:bg-[#004A99] text-white rounded-full font-black text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  title="Export complete applications dataset to CSV"
                >
                  <FiDownload className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* KPI STATS CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
              {/* Card 1: Total Applications */}
              <div
                onClick={() => setStatusFilter('All')}
                className={`p-4 bg-white rounded-2xl border-2 border-[#BAE6FD] border-l-[6px] transition-all flex flex-col justify-between cursor-pointer select-none shadow-2xs ${
                  statusFilter === 'All'
                    ? 'border-l-sky-600 ring-2 ring-sky-200 bg-sky-50/20'
                    : 'border-l-sky-500 hover:shadow-md hover:-translate-y-0.5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 uppercase tracking-widest font-black">
                    Total Applications
                  </span>
                  {statusFilter === 'All' && (
                    <span className="text-[9px] font-black text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded-full border border-sky-200">
                      Active
                    </span>
                  )}
                </div>
                <div className="text-3xl sm:text-4xl text-[#08315F] font-black leading-none my-1 font-['Plus_Jakarta_Sans']">
                  {kpiCounts.total.toLocaleString()}
                </div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  All submitted applications
                </span>
              </div>

              {/* Card 2: Submitted */}
              <div
                onClick={() => setStatusFilter('Submitted')}
                className={`p-4 bg-white rounded-2xl border-2 border-[#BAE6FD] border-l-[6px] transition-all flex flex-col justify-between cursor-pointer select-none shadow-2xs ${
                  statusFilter === 'Submitted'
                    ? 'border-l-blue-600 ring-2 ring-blue-200 bg-blue-50/20'
                    : 'border-l-blue-500 hover:shadow-md hover:-translate-y-0.5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 uppercase tracking-widest font-black">
                    Submitted
                  </span>
                  {statusFilter === 'Submitted' && (
                    <span className="text-[9px] font-black text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full border border-blue-200">
                      Active
                    </span>
                  )}
                </div>
                <div className="text-3xl sm:text-4xl text-blue-700 font-black leading-none my-1 font-['Plus_Jakarta_Sans']">
                  {kpiCounts.submitted.toLocaleString()}
                </div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Initial filings
                </span>
              </div>

              {/* Card 3: Under Review */}
              <div
                onClick={() => setStatusFilter('Under Review')}
                className={`p-4 bg-white rounded-2xl border-2 border-[#BAE6FD] border-l-[6px] transition-all flex flex-col justify-between cursor-pointer select-none shadow-2xs ${
                  statusFilter === 'Under Review'
                    ? 'border-l-amber-600 ring-2 ring-amber-200 bg-amber-50/20'
                    : 'border-l-amber-500 hover:shadow-md hover:-translate-y-0.5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 uppercase tracking-widest font-black">
                    Under Review
                  </span>
                  {statusFilter === 'Under Review' && (
                    <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full border border-amber-200">
                      Active
                    </span>
                  )}
                </div>
                <div className="text-3xl sm:text-4xl text-amber-700 font-black leading-none my-1 font-['Plus_Jakarta_Sans']">
                  {kpiCounts.under_review.toLocaleString()}
                </div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Being evaluated
                </span>
              </div>

              {/* Card 4: Shortlisted */}
              <div
                onClick={() => setStatusFilter('Shortlisted')}
                className={`p-4 bg-white rounded-2xl border-2 border-[#BAE6FD] border-l-[6px] transition-all flex flex-col justify-between cursor-pointer select-none shadow-2xs ${
                  statusFilter === 'Shortlisted'
                    ? 'border-l-purple-600 ring-2 ring-purple-200 bg-purple-50/20'
                    : 'border-l-purple-500 hover:shadow-md hover:-translate-y-0.5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 uppercase tracking-widest font-black">
                    Shortlisted
                  </span>
                  {statusFilter === 'Shortlisted' && (
                    <span className="text-[9px] font-black text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full border border-purple-200">
                      Active
                    </span>
                  )}
                </div>
                <div className="text-3xl sm:text-4xl text-purple-700 font-black leading-none my-1 font-['Plus_Jakarta_Sans']">
                  {kpiCounts.shortlisted.toLocaleString()}
                </div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Qualified stage
                </span>
              </div>

              {/* Card 5: Appointed */}
              <div
                onClick={() => setStatusFilter('Appointed')}
                className={`p-4 bg-white rounded-2xl border-2 border-[#BAE6FD] border-l-[6px] transition-all flex flex-col justify-between cursor-pointer select-none shadow-2xs ${
                  statusFilter === 'Appointed'
                    ? 'border-l-emerald-600 ring-2 ring-emerald-200 bg-emerald-50/20'
                    : 'border-l-emerald-500 hover:shadow-md hover:-translate-y-0.5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 uppercase tracking-widest font-black">
                    Appointed
                  </span>
                  {statusFilter === 'Appointed' && (
                    <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full border border-emerald-200">
                      Active
                    </span>
                  )}
                </div>
                <div className="text-3xl sm:text-4xl text-emerald-700 font-black leading-none my-1 font-['Plus_Jakarta_Sans']">
                  {kpiCounts.appointed.toLocaleString()}
                </div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Official masterlist
                </span>
              </div>
            </div>

            {/* SEARCH AND FILTER CONTROLS */}
            <div className="p-4 sm:p-5 bg-white rounded-2xl border-2 border-[#BAE6FD] shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Application No, Applicant Name, Email, Position, Plantilla Office..."
                    className="w-full pl-11 pr-10 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-[#08315F] transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <FiX size={16} />
                    </button>
                  )}
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-wider shrink-0">Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer focus:border-[#08315F]"
                  >
                    <option value="All">All Statuses ({applications.length})</option>
                    <option value="Submitted">Submitted ({kpiCounts.submitted})</option>
                    <option value="Under Review">Under Review ({kpiCounts.under_review})</option>
                    <option value="Shortlisted">Shortlisted ({kpiCounts.shortlisted})</option>
                    <option value="Appointed">Appointed ({kpiCounts.appointed})</option>
                    <option value="Rejected">Rejected ({kpiCounts.rejected})</option>
                  </select>
                </div>

                {/* CES Stage Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-wider shrink-0">CES Stage:</span>
                  <select
                    value={cesStageFilter}
                    onChange={(e) => setCesStageFilter(e.target.value)}
                    className="bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer focus:border-[#08315F] max-w-[200px]"
                  >
                    <option value="All">All CES Stages</option>
                    {uniqueCesStages.map(stage => (
                      <option key={stage} value={stage}>{stage}</option>
                    ))}
                  </select>
                </div>

                {/* Reset Filters Button */}
                {hasActiveFilters && (
                  <button
                    onClick={handleResetFilters}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl border border-rose-200 text-xs font-black uppercase tracking-wider transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
                  >
                    <FiX size={14} />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {/* Passer Pills Row */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Quick Filters:</span>
                
                {/* LET Passer Pill */}
                <button
                  onClick={() => setLetFilter(prev => prev === 'yes' ? 'All' : 'yes')}
                  className={`px-3 py-1 rounded-full font-black text-[11px] uppercase tracking-wider transition-colors cursor-pointer border ${
                    letFilter === 'yes'
                      ? 'bg-[#08315F] text-white border-[#08315F]'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'
                  }`}
                >
                  LET Passer {letFilter === 'yes' && '✓'}
                </button>

                {/* EMT Passer Pill */}
                <button
                  onClick={() => setEmtFilter(prev => prev === 'yes' ? 'All' : 'yes')}
                  className={`px-3 py-1 rounded-full font-black text-[11px] uppercase tracking-wider transition-colors cursor-pointer border ${
                    emtFilter === 'yes'
                      ? 'bg-[#08315F] text-white border-[#08315F]'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'
                  }`}
                >
                  EMT Passer {emtFilter === 'yes' && '✓'}
                </button>

                <div className="ml-auto text-[11px] font-bold text-slate-400">
                  Showing {totalRecords} matching application{totalRecords === 1 ? '' : 's'}
                </div>
              </div>
            </div>

            {/* DATA TABLE CONTAINER */}
            <div className="bg-white rounded-2xl border-2 border-[#08315F] shadow-sm overflow-hidden flex flex-col">
              <div className="overflow-x-auto min-w-full">
                <table className="w-full text-left border-collapse min-w-[1240px]">
                  <thead>
                    <tr className="bg-[#08315F] text-white text-[11.5px] font-black uppercase tracking-wider">
                      <th className="py-3.5 px-4 w-[160px]">Application No</th>
                      <th className="py-3.5 px-4 w-[260px]">Applicant Name</th>
                      <th className="py-3.5 px-4 w-[220px]">Position Applying For</th>
                      <th className="py-3.5 px-4 w-[200px]">Current Plantilla &amp; Office</th>
                      <th className="py-3.5 px-4 w-[160px]">Designation / OIC</th>
                      <th className="py-3.5 px-4 w-[170px]">CES Eligibility</th>
                      <th className="py-3.5 px-4 w-[100px] text-center">Docs</th>
                      <th className="py-3.5 px-4 w-[130px] text-center">Status</th>
                      <th className="py-3.5 px-4 w-[110px]">Date Filed</th>
                      <th className="py-3.5 px-4 w-[100px] text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                    {paginatedApplications.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <FiFileText size={36} className="text-slate-300 stroke-[1.5]" />
                            <p className="font-bold text-sm text-slate-500">No vacancy applications found</p>
                            <p className="text-xs text-slate-400">
                              {hasActiveFilters
                                ? 'Try adjusting your search query or status filter.'
                                : 'No vacancy applications have been recorded yet.'}
                            </p>
                            {hasActiveFilters && (
                              <button
                                onClick={handleResetFilters}
                                className="mt-2 px-4 py-1.5 bg-[#08315F] text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
                              >
                                Clear Filters
                              </button>
                            )}
                          </div>
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
                            className={`transition-colors group border-b border-slate-100 ${
                              app.is_already_appointed_elsewhere
                                ? 'bg-slate-100/60 opacity-60 cursor-not-allowed select-none'
                                : 'hover:bg-sky-50/50 cursor-pointer'
                            }`}
                            title={
                              app.is_already_appointed_elsewhere
                                ? `Reappointment Disabled: Applicant is already appointed as ${app.appointed_tlo_id} (${app.masterlist_position_title || 'Official'}) in Masterlist.`
                                : undefined
                            }
                          >
                            {/* Application No */}
                            <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-sky-50 text-[#08315F] border border-sky-200 font-black text-[11.5px] tracking-wide font-sans">
                                {app.application_no}
                              </span>
                            </td>

                            {/* Applicant Name & Identity */}
                            <td className="py-3.5 px-4 align-middle">
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
                                  <div className="flex items-center gap-2">
                                    <span className="font-['Plus_Jakarta_Sans'] font-black text-[#08315F] text-[13.5px] uppercase truncate">
                                      {app.surname}, {app.first_name} {app.middle_name || ''}
                                    </span>
                                    {app.is_already_appointed_elsewhere ? (
                                      <span
                                        title={`Already appointed as ${app.appointed_tlo_id} (${app.masterlist_position_title || 'Official'}) in Masterlist`}
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

                            {/* Position Applying For */}
                            <td className="py-3.5 px-4 align-middle">
                              <div className="min-w-0">
                                <p className="font-black text-slate-900 text-[13px] leading-tight break-words">{app.position_applying_for}</p>
                                {app.target_vacancy_id && (
                                  <span className="inline-block mt-1 text-[10px] font-bold text-[#075985] bg-sky-50 border border-sky-200 px-2 py-0.5 rounded">
                                    {app.target_vacancy_id}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Current Plantilla & Office */}
                            <td className="py-3.5 px-4 align-middle">
                              <div className="min-w-0">
                                <p className="font-black text-slate-800 text-[12.5px] uppercase truncate">
                                  {!app.current_position || app.current_position.toLowerCase() === 'n/a' ? 'N/A' : app.current_position}
                                </p>
                                {app.plantilla_office && app.plantilla_office.toLowerCase() !== 'n/a' && (
                                  <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">{app.plantilla_office}</p>
                                )}
                              </div>
                            </td>

                            {/* Designation / OIC */}
                            <td className="py-3.5 px-4 align-middle">
                              <div className="min-w-0">
                                <p className="font-black text-slate-800 text-[12.5px] uppercase truncate">
                                  {!app.current_designation || app.current_designation.toLowerCase() === 'n/a' ? 'N/A' : app.current_designation}
                                </p>
                                {app.assigned_oic_office && !['n/a', 'na', 'none', ''].includes(app.assigned_oic_office.trim().toLowerCase()) && (
                                  <p className="text-[10px] text-amber-700 font-bold truncate mt-0.5">OIC: {app.assigned_oic_office}</p>
                                )}
                              </div>
                            </td>

                            {/* CES Eligibility */}
                            <td className="py-3.5 px-4 align-middle">
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 text-[11.5px] leading-tight break-words">
                                  {app.ces_eligibility_stage || 'N/A'}
                                </p>
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
                              </div>
                            </td>

                            {/* Documents Attached */}
                            <td className="py-3.5 px-4 align-middle text-center">
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

                            {/* Status */}
                            <td className="py-3.5 px-4 align-middle text-center">
                              <div className="flex flex-col items-center gap-1">
                                {renderStatusBadge(app.status)}
                                {app.is_already_appointed_elsewhere && (
                                  <span
                                    title={`Reappointment disabled: Candidate already appointed as ${app.appointed_tlo_id} in the Masterlist.`}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs"
                                  >
                                    <FiAlertCircle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                    Reappoint Disabled
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Date Filed */}
                            <td className="py-3.5 px-4 align-middle whitespace-nowrap text-[11.5px] text-slate-500 font-medium">
                              {app.created_at ? new Date(app.created_at).toLocaleDateString() : '—'}
                            </td>

                            {/* Action Button */}
                            <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                              {app.is_already_appointed_elsewhere ? (
                                <button
                                  type="button"
                                  disabled
                                  title={`Disabled: Applicant already appointed as ${app.appointed_tlo_id} in Masterlist. Reappointment is not allowed.`}
                                  className="px-3 py-1.5 bg-slate-100 text-slate-400 rounded-xl border border-slate-200 font-black text-[11px] uppercase tracking-wider inline-flex items-center gap-1 cursor-not-allowed opacity-60 shadow-none select-none"
                                >
                                  <FiEye size={12} className="text-slate-400" />
                                  <span>Disabled</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedApplication(app);
                                    setIsModalOpen(true);
                                  }}
                                  className="px-3 py-1.5 bg-[#F0F9FF] hover:bg-[#08315F] text-[#08315F] hover:text-white rounded-xl border border-[#BAE6FD] font-black text-[11px] uppercase tracking-wider transition-colors inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <FiEye size={12} />
                                  <span>View</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* TABLE FOOTER / PAGINATION */}
              <div className="px-6 py-4 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Showing {totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1}-
                    {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords.toLocaleString()} applications
                  </span>

                  <div className="flex items-center gap-2 pl-4 border-l-2 border-slate-100">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Per Page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(parseInt(e.target.value, 10));
                        setCurrentPage(1);
                      }}
                      className="bg-slate-50 border-2 border-slate-200 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-700 outline-none cursor-pointer"
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
                    className="h-8 px-3.5 rounded-full border-2 border-[#BAE6FD] bg-[#F0F9FF] text-[#08315F] font-black text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed hover:bg-sky-100 transition-all cursor-pointer"
                  >
                    Prev
                  </button>
                  <span className="px-3 text-xs font-black text-[#08315F]">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    disabled={currentPage >= totalPages || loading}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="h-8 px-3.5 rounded-full border-2 border-[#BAE6FD] bg-[#F0F9FF] text-[#08315F] font-black text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed hover:bg-sky-100 transition-all cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
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

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../utils/api';
import PageTransition from '../components/PageTransition';
import AdminSidebar from '../components/AdminSidebar';
import { FiSearch, FiUserPlus, FiUploadCloud, FiDownload, FiFlag, FiList, FiHome, FiLogOut } from 'react-icons/fi';

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

const getOfficialLevel = (item) => {
    const strand = item.strand || item.target_office || '';
    const office = item.office || item.target_office || '';
    const pos = item.position_title || item.target_position || '';

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

    const strand = (item.strand || item.target_office || '').trim();
    if (strand.toUpperCase() === 'REGION XIII' || strand.toUpperCase() === 'CARAGA') return 'CARAGA';

    const knownRegions = [
        'Region I', 'Region II', 'Region III', 'Region IV-A', 'Region IV-B',
        'Region V', 'Region VI', 'Region VII', 'Region VIII', 'Region IX',
        'Region X', 'Region XI', 'Region XII', 'NCR', 'CAR', 'NIR', 'BARMM'
    ];

    const found = knownRegions.find(r => r.toLowerCase() === strand.toLowerCase() || strand.toLowerCase().includes(r.toLowerCase()));
    if (found) return found;

    return 'Central Office';
};

const Home = () => {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  
  const [applications, setApplications] = useState([]);
  const [officials, setOfficials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeQueueFilter, setActiveQueueFilter] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [appsRes, offRes] = await Promise.all([
          fetch(apiUrl('/api/third-level/applications'), {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(apiUrl('/api/third-level/officials?status=Active'), {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);
        
        const appsData = await appsRes.json();
        const offData = await offRes.json();
        
        if (appsData.success) setApplications(appsData.data);
        if (offData.success) setOfficials(offData.data);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    if (token) fetchData();
  }, [token]);

  // KPIs Logic
  const thirdLevelCount = useMemo(() => {
    return officials.filter(o => THIRD_LEVEL_POSITIONS.includes(o.position_title)).length;
  }, [officials]);

  const divisionChiefsCount = useMemo(() => {
    return officials.filter(o => !THIRD_LEVEL_POSITIONS.includes(o.position_title)).length;
  }, [officials]);

  const sortBreakdown = (counts) => {
    const order = [
        'Secretary', 'Undersecretary', 'Assistant Sec', 'Assistant Secretary',
        'Director IV', 'Director III', 'Regional Dir', 'Regional Director',
        'ARD', 'Assistant Regional Director', 'SDS', 'Schools Division Superintendent',
        'ASDS', 'Assistant Schools Division Superintendent'
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
            if (b[1] !== a[1]) return b[1] - a[1];
            return a[0].localeCompare(b[0]);
        })
    );
  };

  const thirdLevelBreakdown = useMemo(() => {
    const counts = {};
    officials.filter(o => THIRD_LEVEL_POSITIONS.includes(o.position_title)).forEach(o => {
        if (o.first_name && o.first_name !== 'VACANT') {
            const pos = o.position_title || 'Unassigned';
            counts[pos] = (counts[pos] || 0) + 1;
        }
    });
    return sortBreakdown(counts);
  }, [officials]);

  const divisionChiefsBreakdown = useMemo(() => {
    const counts = {};
    officials.filter(o => !THIRD_LEVEL_POSITIONS.includes(o.position_title)).forEach(o => {
        if (o.first_name && o.first_name !== 'VACANT') {
            const pos = o.position_title || 'Unassigned';
            counts[pos] = (counts[pos] || 0) + 1;
        }
    });
    return sortBreakdown(counts);
  }, [officials]);

  const pendingVerifications = applications.length;
  
  const incompleteProfiles = useMemo(() => {
    return officials.filter(o => !o.photo_binary_id || !o.pds_binary_id || !o.contact_details).length;
  }, [officials]);
  
  const flaggedProfiles = useMemo(() => {
    return officials.filter(o => o.pending_admin_case || o.ombudsman_case).length;
  }, [officials]);

  const incompleteRegionBreakdown = useMemo(() => {
    const counts = {};
    const incompleteOfficials = officials.filter(o => !o.photo_binary_id || !o.pds_binary_id || !o.contact_details);
    incompleteOfficials.forEach(o => {
        const region = getOfficialRegion(o);
        counts[region] = (counts[region] || 0) + 1;
    });
    
    return Object.fromEntries(
        Object.entries(counts).sort((a, b) => {
            if (b[1] !== a[1]) return b[1] - a[1];
            return a[0].localeCompare(b[0]);
        })
    );
  }, [officials]);

  const pendingRegionBreakdown = useMemo(() => {
    const counts = {};
    applications.forEach(app => {
        const region = getOfficialRegion(app);
        counts[region] = (counts[region] || 0) + 1;
    });
    
    return Object.fromEntries(
        Object.entries(counts).sort((a, b) => {
            if (b[1] !== a[1]) return b[1] - a[1];
            return a[0].localeCompare(b[0]);
        })
    );
  }, [applications]);

  const flaggedRegionBreakdown = useMemo(() => {
    const counts = {};
    const flaggedOfficials = officials.filter(o => o.pending_admin_case || o.ombudsman_case);
    flaggedOfficials.forEach(o => {
        const region = getOfficialRegion(o);
        counts[region] = (counts[region] || 0) + 1;
    });
    
    return Object.fromEntries(
        Object.entries(counts).sort((a, b) => {
            if (b[1] !== a[1]) return b[1] - a[1];
            return a[0].localeCompare(b[0]);
        })
    );
  }, [officials]);

  // Action Queue: combining pending apps and incomplete profiles for display
  const actionQueue = useMemo(() => {
    let queue = [];
    
    // Recent applications that need review
    applications.forEach(app => {
      queue.push({
        id: app.TLOid,
        email: app.email,
        name: `${app.first_name || ''} ${app.last_name || ''}`.trim(),
        desc: `Recent profile application · ${app.target_office || 'Unassigned'}`,
        status: 'For Review',
        badgeClass: 'warn',
        type: 'pending'
      });
    });
    
    // Incomplete active profiles
    officials.filter(o => !o.photo_binary_id || !o.pds_binary_id || !o.contact_details).forEach(o => {
      queue.push({
        id: o.TLOid,
        email: o.email,
        name: `${o.first_name || ''} ${o.last_name || ''}`.trim(),
        desc: `Missing valid PDS/Photo/Contact · ${o.office || 'Unassigned'}`,
        status: 'Action Required',
        badgeClass: 'risk',
        type: 'incomplete'
      });
    });

    // Flagged profiles
    officials.filter(o => o.pending_admin_case || o.ombudsman_case).forEach(o => {
      queue.push({
        id: o.TLOid,
        email: o.email,
        name: `${o.first_name || ''} ${o.last_name || ''}`.trim(),
        desc: `Administrative/Ombudsman Case Pending`,
        status: 'Flagged',
        badgeClass: 'risk',
        type: 'expiring'
      });
    });
    
    // Filter by category
    if (activeQueueFilter !== 'all') {
      queue = queue.filter(q => q.type === activeQueueFilter);
    }
    
    // Filter by search
    if (search) {
      queue = queue.filter(q => q.name.toLowerCase().includes(search.toLowerCase()) || q.desc.toLowerCase().includes(search.toLowerCase()));
    }
    
    return queue.slice(0, 8);
  }, [applications, officials, search, activeQueueFilter]);

  const searchResults = useMemo(() => {
    if (!search || search.length < 2) return [];
    const lowerSearch = search.toLowerCase();
    return officials.filter(o => 
      (o.first_name && o.first_name.toLowerCase().includes(lowerSearch)) ||
      (o.last_name && o.last_name.toLowerCase().includes(lowerSearch)) ||
      (o.TLOid && o.TLOid.toLowerCase().includes(lowerSearch)) ||
      (o.email && o.email.toLowerCase().includes(lowerSearch))
    ).slice(0, 5);
  }, [officials, search]);

  const toggleFilter = (filter) => {
    setActiveQueueFilter(prev => prev === filter ? 'all' : filter);
  };

  return (
    <PageTransition>
      <div className="flex min-h-screen bg-[#f0f9ff] text-[#0f172a] font-['Quicksand',system-ui,sans-serif]">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto relative">
          {/* TOP NAVIGATION BAR */}
          <header className="sticky top-0 z-50 bg-[#08315F] backdrop-blur-md border-b border-blue-900 px-8 py-4 flex items-center justify-between shadow-lg shadow-blue-900/20">
              <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white shadow-inner">
                      <FiHome size={20} />
                  </div>
                  <div>
                      <h1 className="text-lg font-['Quicksand'] font-black text-white tracking-tight leading-none italic uppercase">Executive <span className="text-blue-300 not-italic">Dashboard</span></h1>
                      <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest mt-1">InsightED Top-Level Metrics</p>
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
        <style>{`
          .dashboard-wrap { max-width:1180px; margin:auto; padding:28px; }
          .hero { background:#08315f; color:white; border-radius:28px; padding:28px; }
          .hero small { color:#fbbf24; font-weight:900; letter-spacing:.16em; text-transform:uppercase; }
          .hero h1 { margin:10px 0 8px; font-size:42px; line-height:1; font-weight:900; }
          .search-bar { margin:-24px auto 22px; max-width:850px; background:white; border:2px solid #bae6fd; border-radius:22px; padding:14px; display:flex; gap:10px; box-shadow:0 18px 40px #08315f22; position:relative; z-index:20; }
          .search-bar input { width:100%; border:0; outline:0; font-size:16px; font-weight:700; color:#0f172a; background:transparent; }
          .search-bar button { border:0; background:#075985; color:white; border-radius:14px; padding:12px 18px; font-weight:900; cursor:pointer; transition:background 0.2s; }
          .search-bar button:hover { background:#0369a1; }
          .kpis { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
          .kpi { position:relative; background:white; border:2px solid #bae6fd; border-radius:22px; padding:18px; border-left-width:8px; transition:all 0.2s; }
          .kpi:hover { transform: translateY(-2px); box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); }
          .kpi.amber { border-left-color:#f59e0b; } 
          .kpi.red { border-left-color:#dc2626; } 
          .kpi.blue { border-left-color:#0284c7; }
          .kpi.active-filter { background:#f8fafc; outline: 3px solid #bae6fd; outline-offset: -2px; }
          .kpi p { margin:0; color:#64748b; font-size:12px; font-weight:900; text-transform:uppercase; }
          .kpi h2 { margin:8px 0 0; font-size:34px; color:#08315f; }
          .kpi-tooltip { position:absolute; right:0; top:100%; margin-top:8px; width:280px; background:rgba(255,255,255,0.95); backdrop-filter:blur(8px); border:1px solid #e2e8f0; border-radius:16px; box-shadow:0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); padding:16px; opacity:0; pointer-events:none; transition:all 0.2s; z-index:60; max-height:240px; overflow-y:auto; }
          .kpi-tooltip::-webkit-scrollbar { width: 4px; }
          .kpi-tooltip::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 4px; }
          .kpi:hover .kpi-tooltip { opacity:1; pointer-events:auto; }
          .kpi-tooltip h4 { margin:0 0 12px; font-size:10px; font-weight:900; color:#94a3b8; text-transform:uppercase; letter-spacing:0.1em; border-bottom:1px solid #f1f5f9; padding-bottom:8px; }
          .kpi-tooltip-row { display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:1px solid #f8fafc; font-size:12px; }
          .kpi-tooltip-row:last-child { border-bottom:0; }
          .kpi-tooltip-row span.label { color:#475569; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding-right:8px; }
          .kpi-tooltip-row span.count { color:#0f172a; font-weight:900; background:#e0f2fe; padding:2px 8px; border-radius:8px; }
          .grid-layout { display:grid; grid-template-columns:1fr 300px; gap:16px; margin-top:16px; }
          .dash-card { background:white; border:2px solid #bae6fd; border-radius:24px; overflow:hidden; }
          .dash-head { padding:18px 20px; border-bottom:1px solid #e2e8f0; }
          .dash-head h3 { margin:0; color:#08315f; font-size:1.25rem; font-weight:800; }
          .dash-head p { margin:4px 0 0; color:#64748b; font-size:0.875rem; }
          .chips { padding:14px 20px; border-bottom:1px solid #e2e8f0; display:flex; gap:8px; flex-wrap:wrap; }
          .chip { background:#e0f2fe; color:#075985; border-radius:999px; padding:8px 12px; font-size:12px; font-weight:900; }
          .queue-row { display:grid; grid-template-columns:1fr auto; gap:12px; padding:16px 20px; border-bottom:1px solid #f1f5f9; align-items:center; cursor:pointer; transition:background 0.2s; }
          .queue-row:hover { background:#f8fafc; }
          .queue-row strong { display:block; color:#0f172a; font-size:1rem; } 
          .queue-row span { color:#64748b; font-size:12px; }
          .queue-badge { border-radius:999px; padding:8px 10px; font-size:11px; font-weight:900; height:max-content; white-space:nowrap; }
          .queue-badge.warn { background:#fef3c7; color:#92400e; } 
          .queue-badge.risk { background:#fee2e2; color:#991b1b; }
          .side { padding:18px; display:grid; gap:10px; align-content:start; }
          .action-btn { border:1px solid #bae6fd; background:#f8fafc; border-radius:16px; padding:14px; font-weight:900; color:#08315f; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:8px; justify-content:center; }
          .action-btn:hover { background:#e0f2fe; border-color:#7dd3fc; }
          .action-btn.primary { background:#075985; color:white; border-color:#075985; }
          .action-btn.primary:hover { background:#0369a1; border-color:#0369a1; }
          @media(max-width:800px){ 
            .kpis { grid-template-columns:repeat(2,1fr); }
            .grid-layout { grid-template-columns:1fr; } 
            .search-bar { flex-direction:column; } 
            .hero h1 { font-size:32px; } 
          }
          @media(max-width:500px){ 
            .kpis { grid-template-columns:1fr; }
          }
        `}</style>
        
        <div className="dashboard-wrap">
          <section className="hero">
            <small>InsightED Third Level</small>
            <h1>Executive Registry Dashboard</h1>
            <p>Monitor official credentials, review profiling applications, and manage the administrative masterlist.</p>
          </section>
          
          <form className="search-bar" onSubmit={e => {
              e.preventDefault();
              if (search) navigate('/officials-registry');
          }}>
            <div className="w-full relative flex flex-1">
              <input 
                placeholder="Search name, personnel ID, department, email…" 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && search.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-4 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50">
                  {searchResults.length > 0 ? searchResults.map(o => (
                    <div 
                      key={o.TLOid} 
                      className="px-6 py-4 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 flex justify-between items-center transition-colors"
                      onClick={() => navigate(`/official-profiling?email=${encodeURIComponent(o.email)}`)}
                    >
                      <div>
                        <div className="font-bold text-slate-800">{o.first_name} {o.last_name}</div>
                        <div className="text-xs text-slate-500 font-medium">{o.position_title || 'Unassigned'} • {o.office || 'No Office'}</div>
                      </div>
                      <div className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-lg uppercase tracking-widest">{o.TLOid}</div>
                    </div>
                  )) : (
                    <div className="px-6 py-4 text-sm font-bold text-slate-400 uppercase tracking-widest text-center">No matching personnel found</div>
                  )}
                </div>
              )}
            </div>
            <button type="submit">Search</button>
          </form>
          
          <section className="kpis">
            <div className={`kpi amber ${activeQueueFilter === 'pending' ? 'active-filter' : ''}`} onClick={() => toggleFilter('pending')} style={{cursor: 'pointer'}}>
              <p>Pending Verifications</p>
              <h2>{loading ? '-' : pendingVerifications}</h2>
              <div className="kpi-tooltip" onClick={e => e.stopPropagation()}>
                <h4>Region Breakdown</h4>
                {Object.keys(pendingRegionBreakdown).length > 0 ? Object.entries(pendingRegionBreakdown).map(([region, count]) => (
                  <div key={region} className="kpi-tooltip-row">
                    <span className="label" title={region}>{region}</span>
                    <span className="count">{count}</span>
                  </div>
                )) : (
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center mt-2">No records</div>
                )}
              </div>
            </div>
            <div className={`kpi red ${activeQueueFilter === 'incomplete' ? 'active-filter' : ''}`} onClick={() => toggleFilter('incomplete')} style={{cursor: 'pointer'}}>
              <p>Incomplete Profiles</p>
              <h2>{loading ? '-' : incompleteProfiles}</h2>
              <div className="kpi-tooltip" onClick={e => e.stopPropagation()}>
                <h4>Region Breakdown</h4>
                {Object.keys(incompleteRegionBreakdown).length > 0 ? Object.entries(incompleteRegionBreakdown).map(([region, count]) => (
                  <div key={region} className="kpi-tooltip-row">
                    <span className="label" title={region}>{region}</span>
                    <span className="count">{count}</span>
                  </div>
                )) : (
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center mt-2">No records</div>
                )}
              </div>
            </div>
            <div className={`kpi blue ${activeQueueFilter === 'expiring' ? 'active-filter' : ''}`} onClick={() => toggleFilter('expiring')} style={{cursor: 'pointer'}}>
              <p>Expiring IDs</p>
              <h2>{loading ? '-' : flaggedProfiles}</h2>
              <div className="kpi-tooltip" onClick={e => e.stopPropagation()}>
                <h4>Region Breakdown</h4>
                {Object.keys(flaggedRegionBreakdown).length > 0 ? Object.entries(flaggedRegionBreakdown).map(([region, count]) => (
                  <div key={region} className="kpi-tooltip-row">
                    <span className="label" title={region}>{region}</span>
                    <span className="count">{count}</span>
                  </div>
                )) : (
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center mt-2">No records</div>
                )}
              </div>
            </div>
          </section>
          
          <section className="grid-layout">
            <main className="dash-card">
              <div className="dash-head flex justify-between items-center">
                <div>
                  <h3>Action Queue</h3>
                  <p>
                    {activeQueueFilter === 'all' && "Records requiring review or correction."}
                    {activeQueueFilter === 'pending' && "Showing only pending verification records."}
                    {activeQueueFilter === 'incomplete' && "Showing only incomplete profiles."}
                    {activeQueueFilter === 'expiring' && "Showing only profiles with pending cases/expiring IDs."}
                  </p>
                </div>
                {activeQueueFilter !== 'all' && (
                  <button 
                    onClick={() => setActiveQueueFilter('all')}
                    className="text-[10px] font-black text-slate-400 hover:text-slate-700 uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-xl transition-colors"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
              <div className="chips">
                <span className="chip">Status</span>
                <span className="chip">Department</span>
                <span className="chip">Missing ID</span>
                <span className="chip">Flagged</span>
              </div>
              
              {loading ? (
                <div className="p-8 text-center text-slate-400 font-bold text-sm">Loading queue...</div>
              ) : actionQueue.length > 0 ? (
                actionQueue.map((item, idx) => (
                  <div key={idx} className="queue-row" onClick={() => navigate(item.email ? `/official-profiling?email=${encodeURIComponent(item.email)}` : '/officials-registry')}>
                    <div>
                      <strong>{item.name || 'Unknown User'}</strong>
                      <span>{item.desc}</span>
                    </div>
                    <b className={`queue-badge ${item.badgeClass}`}>{item.status}</b>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400 font-bold text-sm">No pending actions</div>
              )}
            </main>
            
            <aside className="dash-card side">
              <button className="action-btn" onClick={() => navigate('/officials-registry')} style={{ backgroundColor: '#0f172a', color: '#fff', borderColor: '#0f172a' }}>
                <FiList /> Open Full Registry
              </button>
              <div className="h-px bg-slate-100 my-1"></div>
              <button className="action-btn primary">
                <FiUserPlus /> Add New Personnel
              </button>
              <button className="action-btn">
                <FiUploadCloud /> Bulk Upload Roster
              </button>
              <button className="action-btn">
                <FiDownload /> Export Compliance Report
              </button>
              <button className="action-btn">
                <FiFlag /> Review Flagged Profiles
                {flaggedProfiles > 0 && (
                  <span className="ml-auto bg-red-100 text-red-600 text-[10px] py-1 px-2 rounded-full font-black">
                    {flaggedProfiles}
                  </span>
                )}
              </button>
            </aside>
          </section>
        </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default Home;

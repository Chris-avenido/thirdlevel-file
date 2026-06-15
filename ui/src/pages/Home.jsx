import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../utils/api';
import PageTransition from '../components/PageTransition';
import { FiSearch, FiUserPlus, FiUploadCloud, FiDownload, FiFlag } from 'react-icons/fi';

const Home = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  
  const [applications, setApplications] = useState([]);
  const [officials, setOfficials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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
  const pendingVerifications = applications.length;
  
  const incompleteProfiles = useMemo(() => {
    return officials.filter(o => !o.photo_binary_id || !o.pds_binary_id || !o.contact_details).length;
  }, [officials]);
  
  // Example metric for "Expiring IDs" or "Flagged Profiles"
  const expiringIds = useMemo(() => {
    return officials.filter(o => o.pending_admin_case || o.ombudsman_case).length;
  }, [officials]);

  // Action Queue: combining pending apps and incomplete profiles for display
  const actionQueue = useMemo(() => {
    let queue = [];
    
    // Recent applications that need review
    applications.slice(0, 5).forEach(app => {
      queue.push({
        id: app.TLOid,
        name: `${app.first_name || ''} ${app.last_name || ''}`.trim(),
        desc: `Recent profile update · ${app.target_office || 'Unassigned'}`,
        status: 'For Review',
        badgeClass: 'warn'
      });
    });
    
    // Incomplete active profiles
    officials.filter(o => !o.photo_binary_id || !o.pds_binary_id).slice(0, 5).forEach(o => {
      queue.push({
        id: o.TLOid,
        name: `${o.first_name || ''} ${o.last_name || ''}`.trim(),
        desc: `Missing valid PDS/Photo upload · ${o.office || 'Unassigned'}`,
        status: 'Action Required',
        badgeClass: 'risk'
      });
    });
    
    // Filter by search
    if (search) {
      queue = queue.filter(q => q.name.toLowerCase().includes(search.toLowerCase()) || q.desc.toLowerCase().includes(search.toLowerCase()));
    }
    
    return queue.slice(0, 6);
  }, [applications, officials, search]);

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#f0f9ff] text-[#0f172a] font-['Inter',system-ui,sans-serif]">
        <style>{`
          .dashboard-wrap { max-width:1180px; margin:auto; padding:28px; }
          .hero { background:#08315f; color:white; border-radius:28px; padding:28px; }
          .hero small { color:#fbbf24; font-weight:900; letter-spacing:.16em; text-transform:uppercase; }
          .hero h1 { margin:10px 0 8px; font-size:42px; line-height:1; }
          .search-bar { margin:-24px auto 22px; max-width:850px; background:white; border:2px solid #bae6fd; border-radius:22px; padding:14px; display:flex; gap:10px; box-shadow:0 18px 40px #08315f22; position:relative; z-index:10; }
          .search-bar input { flex:1; border:0; outline:0; font-size:16px; font-weight:700; color:#0f172a; }
          .search-bar button { border:0; background:#075985; color:white; border-radius:14px; padding:12px 18px; font-weight:900; cursor:pointer; transition:background 0.2s; }
          .search-bar button:hover { background:#0369a1; }
          .kpis { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
          .kpi { background:white; border:2px solid #bae6fd; border-radius:22px; padding:18px; border-left-width:8px; }
          .kpi.amber { border-left-color:#f59e0b; } 
          .kpi.red { border-left-color:#dc2626; } 
          .kpi.blue { border-left-color:#0284c7; }
          .kpi p { margin:0; color:#64748b; font-size:12px; font-weight:900; text-transform:uppercase; }
          .kpi h2 { margin:8px 0 0; font-size:34px; color:#08315f; }
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
            .kpis, .grid-layout { grid-template-columns:1fr; } 
            .search-bar { flex-direction:column; } 
            .hero h1 { font-size:32px; } 
          }
        `}</style>
        
        <div className="dashboard-wrap">
          <section className="hero">
            <small>Personnel Operations</small>
            <h1>Profile Action Workspace</h1>
            <p>Find records, fix missing information, and complete verification tasks.</p>
          </section>
          
          <form className="search-bar" onSubmit={e => e.preventDefault()}>
            <input 
              placeholder="Search name, personnel ID, department, email…" 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button type="submit">Search</button>
          </form>
          
          <section className="kpis">
            <div className="kpi amber">
              <p>Pending Verifications</p>
              <h2>{loading ? '-' : pendingVerifications}</h2>
            </div>
            <div className="kpi red">
              <p>Incomplete Profiles</p>
              <h2>{loading ? '-' : incompleteProfiles}</h2>
            </div>
            <div className="kpi blue">
              <p>Expiring IDs</p>
              <h2>{loading ? '-' : expiringIds}</h2>
            </div>
          </section>
          
          <section className="grid-layout">
            <main className="dash-card">
              <div className="dash-head">
                <h3>Action Queue</h3>
                <p>Records requiring review or correction.</p>
              </div>
              <div className="chips">
                <span className="chip">Status</span>
                <span className="chip">Department</span>
                <span className="chip">Missing ID</span>
              </div>
              
              {loading ? (
                <div className="p-8 text-center text-slate-400 font-bold text-sm">Loading queue...</div>
              ) : actionQueue.length > 0 ? (
                actionQueue.map((item, idx) => (
                  <div key={idx} className="queue-row" onClick={() => navigate('/officials-registry')}>
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
              <button className="action-btn primary" onClick={() => navigate('/officials-registry')}>
                <FiUserPlus /> Add New Personnel
              </button>
              <button className="action-btn" onClick={() => navigate('/officials-registry')}>
                <FiUploadCloud /> Bulk Upload Roster
              </button>
              <button className="action-btn" onClick={() => navigate('/officials-registry')}>
                <FiDownload /> Export Compliance Report
              </button>
              <button className="action-btn" onClick={() => navigate('/officials-registry')}>
                <FiFlag /> Review Flagged Profiles
              </button>
            </aside>
          </section>
        </div>
      </div>
    </PageTransition>
  );
};

export default Home;

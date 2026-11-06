

const ApprovalTabs = ({ navigate, officials, statusTab }) => {
  return (
    <>
      {(statusTab === 'For Approval' || statusTab === 'Rejected' || statusTab === 'Applications') && (
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/officials-registry')}
            className={`px-5 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition-all border-2 ${statusTab !== 'For Approval' && statusTab !== 'Rejected' && statusTab !== 'Applications' ? 'bg-[#08315F] text-white border-[#08315F] shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
          >
            Active Registry
          </button>
          <button
            onClick={() => navigate('/officials-registry?status=For%20Approval')}
            className={`px-5 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition-all border-2 ${statusTab === 'For Approval' ? 'bg-[#08315F] text-white border-[#08315F] shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
          >
            Pending Approvals
          </button>
          <button
            onClick={() => navigate('/officials-registry?status=Rejected')}
            className={`px-5 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition-all border-2 ${statusTab === 'Rejected' ? 'bg-rose-600 text-white border-rose-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
          >
            Rejected
          </button>
          <button
            onClick={() => navigate('/officials-registry?status=Applications')}
            className={`px-5 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition-all border-2 ${statusTab === 'Applications' ? 'bg-[#0038A8] text-white border-[#0038A8] shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
          >
            TIMON Applications
          </button>
        </div>
      )}
    </>
  );
};

export default ApprovalTabs;

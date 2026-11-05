

const ApprovalTabs = ({ navigate, officials, statusTab }) => {
  return (
    <>
                        {(statusTab === 'For Approval' || statusTab === 'Rejected') && (
                            <div className="flex items-center gap-4 mb-6">
                                <button
                                    onClick={() => navigate('/officials-registry?status=For%20Approval')}
                                    className={`px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[18px] transition-all border-2 ${statusTab === 'For Approval' ? 'bg-[#08315F] text-white border-[#08315F] shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                                >
                                    Pending Approvals
                                </button>
                                <button
                                    onClick={() => navigate('/officials-registry?status=Rejected')}
                                    className={`px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[18px] transition-all border-2 ${statusTab === 'Rejected' ? 'bg-rose-600 text-white border-rose-600 shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                                >
                                    Rejected
                                </button>
                            </div>
                        )}
    </>
  );
};

export default ApprovalTabs;

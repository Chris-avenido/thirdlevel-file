import React from 'react';
import { FiHome } from 'react-icons/fi';
import { useAuth } from '../../../context/AuthContext';

const DashboardHeader = ({ recordCount, statusText = "Registry Verified" }) => {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-[#08315F] backdrop-blur-md border-b border-blue-900 px-8 py-4 flex items-center justify-between shadow-lg shadow-blue-900/20 shrink-0 w-full">
      <div className="flex items-center gap-4 text-white">
        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white shadow-inner">
          <FiHome size={20} />
        </div>
        <div>
          <h1 className="text-lg font-['Plus_Jakarta_Sans'] font-black text-white tracking-tight leading-none italic uppercase">
            Main <span className="text-blue-300 not-italic">Dashboard</span>
          </h1>
          <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest mt-1">
            Third-Level Officials Inventory &amp; Monitoring • {recordCount} Records Loaded
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden md:flex flex-col items-end">
          <span className="text-xs font-['Plus_Jakarta_Sans'] font-black text-white leading-none">
            {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : 'System Admin'}
          </span>
          <span className="text-[9px] font-bold text-[#FBBF24] uppercase tracking-widest mt-1">
            {user?.role || statusText}
          </span>
        </div>
      </div>
    </header>
  );
};

export default React.memo(DashboardHeader);

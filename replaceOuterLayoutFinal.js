const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'ui/src/pages/OfficialProfiling.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Helper to replace multi-line blocks using regex with newline support (\r?\n)
function replaceBlock(oldStr, newStr) {
    const escaped = oldStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\s+/g, '\\s+');
    const regex = new RegExp(escaped, 'g');
    if (regex.test(content)) {
        content = content.replace(regex, newStr);
        console.log('Replaced block successfully');
    } else {
        console.log('Failed to match block:', oldStr.substring(0, 50));
    }
}

// 1. Mobile Sidebar Navigation update
const oldMobileSidebarNav = `<div className="space-y-1">
                                        {TABS.filter(t => dataSource !== 'masterlist' || t.id !== 'application').map(t => {
                                            const isLocked = t.id === 'application' && completeness < 100;
                                            const active = tab === t.id;
                                            const completed = isTabCompleted(t.id);
                                            return (
                                                <button
                                                    key={t.id}
                                                    disabled={isLocked}
                                                    onClick={() => {
                                                        if (!isLocked) {
                                                            setTab(t.id);
                                                            setIsMobileMenuOpen(false);
                                                        }
                                                    }}
                                                    className={\`w-full flex items-center justify-between gap-3 px-3 py-3 rounded-xl text-left text-[12px] font-semibold transition-all
                                                        \${active ? 'bg-[#0a1e3f] text-white shadow-md shadow-blue-900/20' : 'text-slate-600 hover:bg-slate-55 hover:text-slate-800'}
                                                        \${isLocked ? 'opacity-40 cursor-not-allowed grayscale' : ''}\`}
                                                >
                                                    <span className="flex items-center gap-3 min-w-0">
                                                        <t.icon size={16} className="shrink-0" />
                                                        <span className="truncate">{t.label}</span>
                                                    </span>
                                                    {isLocked ? (
                                                        <FiLock size={12} className="shrink-0 opacity-50" />
                                                    ) : completed ? (
                                                        <FiCheckCircle size={14} className={active ? 'text-emerald-300' : 'text-emerald-500'} />
                                                    ) : active ? (
                                                        <FiArrowRight size={12} className="shrink-0" />
                                                    ) : null}
                                                </button>
                                            );
                                        })}
                                    </div>`;

// Let's replace the mobile sidebar navigation directly using line by line or simple target
content = content.replace(
    /className={`w-full flex items-center justify-between gap-3 px-3 py-3 rounded-xl text-left text-\[12px\] font-semibold transition-all\s+\$\{active \? 'bg-\[#0a1e3f\] text-white shadow-md shadow-blue-900\/20' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'\}/g,
    `className={\`w-full flex items-center justify-between gap-3 px-3 py-3 rounded-lg text-left text-[12px] font-bold transition-all
                                                        \${active ? 'bg-[#0a1e3f] text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}\`}`
);

// Update FiArrowRight to FiChevronRight for mobile active arrow
content = content.replace(
    /completed \? \(\s*<FiCheckCircle size=\{14\} className=\{active \? 'text-emerald-350' : 'text-emerald-500'\} \/>\s*\) : active \? \(\s*<FiArrowRight size=\{12\} className="shrink-0" \/>\s*\) : null/g,
    `completed ? (
                                                        <FiCheckCircle size={14} className={active ? 'text-emerald-300' : 'text-emerald-500'} />
                                                    ) : active ? (
                                                        <FiChevronRight size={14} className="shrink-0 text-white" />
                                                    ) : null`
);

// 2. Desktop Sidebar Navigation update
content = content.replace(
    /className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left text-\[11px\] font-semibold transition-all\s+\$\{active \? 'bg-\[#0a1e3f\] text-white shadow-md shadow-blue-900\/20' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'\}/g,
    `className={\`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left text-[11px] font-bold transition-all
                                                    \${active ? 'bg-[#0a1e3f] text-white' : 'text-slate-500 hover:bg-slate-55 hover:text-slate-800'}\`}`
);

content = content.replace(
    /completed \? \(\s*<FiCheckCircle size=\{13\} className=\{active \? 'text-emerald-300' : 'text-emerald-500'\} \/>\s*\) : active \? \(\s*<FiArrowRight size=\{12\} className="shrink-0" \/>\s*\) : null/g,
    `completed ? (
                                                    <FiCheckCircle size={13} className={active ? 'text-emerald-300' : 'text-emerald-500'} />
                                                ) : active ? (
                                                    <FiChevronRight size={14} className="shrink-0 text-white" />
                                                ) : null`
);

// Replace mapping to support divider lines
const oldMappingBlock = `{TABS.filter(t => dataSource !== 'masterlist' || t.id !== 'application').map(t => {
                                        const isLocked = t.id === 'application' && completeness < 100;
                                        const active = tab === t.id;
                                        const completed = isTabCompleted(t.id);
                                        return (`;

const newMappingBlock = `{TABS.filter(t => dataSource !== 'masterlist' || t.id !== 'application').map(t => {
                                        const isLocked = t.id === 'application' && completeness < 100;
                                        const active = tab === t.id;
                                        const completed = isTabCompleted(t.id);
                                        return (
                                            <React.Fragment key={t.id}>
                                                {t.id === 'application' && <div className="my-3 border-t border-slate-100 mx-3" />}`;
content = content.replace(oldMappingBlock, newMappingBlock);

// Replace ending of map to close React.Fragment
const oldMappingEnd = `</button>
                                        );
                                    })}`;

const newMappingEnd = `</button>
                                            </React.Fragment>
                                        );
                                    })}`;
content = content.replace(oldMappingEnd, newMappingEnd);

// Let's do the same for mobile sidebar mapping to render divider
content = content.replace(
    `{TABS.filter(t => dataSource !== 'masterlist' || t.id !== 'application').map(t => {
                                            const isLocked = t.id === 'application' && completeness < 100;
                                            const active = tab === t.id;
                                            const completed = isTabCompleted(t.id);
                                            return (`,
    `{TABS.filter(t => dataSource !== 'masterlist' || t.id !== 'application').map(t => {
                                            const isLocked = t.id === 'application' && completeness < 100;
                                            const active = tab === t.id;
                                            const completed = isTabCompleted(t.id);
                                            return (
                                                <React.Fragment key={t.id}>
                                                    {t.id === 'application' && <div className="my-3 border-t border-slate-100 mx-3" />}`
);

// Mobile map ending
// We need to be careful with unique indentation/whitespace
const oldMobileMapEnd = `</button>
                                            );
                                        })}`;
const newMobileMapEnd = `</button>
                                                </React.Fragment>
                                            );
                                        })}`;
content = content.replace(oldMobileMapEnd, newMobileMapEnd);

// 3. Update OIC status toggle text class to match design reference style exactly
content = content.replace(
    `<span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                                    {profile.is_oic ? 'Designated as OIC' : 'Regular Appointment'}
                                                                </span>`,
    `<span className="text-xs font-bold text-slate-700">
                                                                    {profile.is_oic ? 'Officer-in-Charge (OIC)' : 'Regular Appointment'}
                                                                </span>`
);

// 4. Update tab font weights and text colors for inactive
content = content.replace("text-slate-600 hover:bg-slate-50 hover:text-slate-800", "text-slate-500 hover:bg-slate-50 hover:text-slate-800");

fs.writeFileSync(filePath, content, 'utf8');
console.log('Finished regex updates');

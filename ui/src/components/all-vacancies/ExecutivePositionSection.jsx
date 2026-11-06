import React from 'react';
import { Briefcase as FiBriefcase, MapPin as FiMapPin } from '@phosphor-icons/react';
import { EXECUTIVE_POSITIONS, DEPED_REGIONS } from './constants';

const ExecutivePositionSection = ({
    appliedPosition,
    setAppliedPosition,
    targetRegion,
    setTargetRegion
}) => {
    return (
        <div className="bg-white border-2 border-slate-200 rounded-[24px] p-6 md:p-8 space-y-6 shadow-sm">
            <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                    <FiBriefcase className="text-brand-800" size={20} />
                    <h3 className="text-base font-black text-brand-800 uppercase tracking-wide">
                        1. Target Executive Designation & Region
                    </h3>
                </div>
                <p className="text-xs font-semibold text-slate-500 mt-1 leading-relaxed">
                    Select one of the four sanctioned Third Level Executive designations and your target deployment region. Submissions are processed through the general executive pool and do not require selecting an individual plantilla item.
                </p>
            </div>

            {/* Target Executive Position Dropdown */}
            <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                    Target Executive Position <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <FiBriefcase size={18} />
                    </div>
                    <select
                        value={appliedPosition}
                        onChange={e => setAppliedPosition(e.target.value)}
                        className="w-full bg-white border-2 border-slate-200 rounded-xl py-3 pl-12 pr-4 text-xs font-bold text-slate-800 outline-none focus:border-brand-800 transition-all cursor-pointer shadow-sm"
                    >
                        <option value="">Select target executive position...</option>
                        {EXECUTIVE_POSITIONS.map(pos => (
                            <option key={pos.code} value={pos.code}>
                                {pos.title}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Target Region Dropdown */}
            <div className="space-y-2 pt-2">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                    Target DepEd Region <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <FiMapPin size={18} />
                    </div>
                    <select
                        value={targetRegion}
                        onChange={e => setTargetRegion(e.target.value)}
                        className="w-full bg-white border-2 border-slate-200 rounded-xl py-3 pl-12 pr-4 text-xs font-bold text-slate-800 outline-none focus:border-brand-800 transition-all cursor-pointer shadow-sm"
                    >
                        <option value="">Select target DepEd region...</option>
                        {DEPED_REGIONS.map(reg => (
                            <option key={reg} value={reg}>
                                {reg}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
};

export default ExecutivePositionSection;


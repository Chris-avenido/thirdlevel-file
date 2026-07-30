import React from 'react';
import { FiCalendar } from 'react-icons/fi';

const YearInput = ({ 
    value, 
    onChange, 
    min = 1900, 
    max = new Date().getFullYear(),
    placeholder = "YYYY",
    required = false,
    label = "",
    errorText = "",
    disabled = false
}) => {
    // Generate years from max down to min
    const years = [];
    for (let y = max; y >= min; y--) {
        years.push(y);
    }

    const handleChange = (e) => {
        onChange(e.target.value);
    };

    return (
        <div className="w-full">
            <div className="relative group">
                <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
                <select
                    value={value || ''}
                    onChange={handleChange}
                    disabled={disabled}
                    className={`w-full bg-white border ${errorText ? 'border-red-400 focus:border-red-500' : 'border-slate-200 focus:border-[#08315F]'} rounded-xl py-2 pl-10 pr-3 text-sm text-slate-800 focus:outline-none transition-all shadow-sm disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed appearance-none cursor-pointer`}
                >
                    <option value="">{placeholder}</option>
                    {years.map(y => (
                        <option key={y} value={String(y)}>{y}</option>
                    ))}
                </select>
            </div>
            {errorText && (
                <p className="text-red-500 text-[10px] mt-1 ml-1 font-medium">{errorText}</p>
            )}
        </div>
    );
};

export default YearInput;

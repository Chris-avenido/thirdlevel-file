import React, { useState, useRef, useEffect } from 'react';
import { FiCalendar, FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi';
import { AnimatePresence, motion } from 'framer-motion';

const YearInput = ({
    value,
    onChange,
    min = 1900,
    max = new Date().getFullYear(),
    placeholder = "YYYY",
    required = false,
    label = "",
    errorText = "",
    disabled = false,
    className = ""
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dropUp, setDropUp] = useState(false);
    const [alignRight, setAlignRight] = useState(true);
    const currentYear = new Date().getFullYear();
    const selectedYear = value ? parseInt(value, 10) : null;

    // Decade page: show 12 years at a time
    const initialDecadeStart = selectedYear
        ? Math.floor(selectedYear / 12) * 12
        : Math.floor(currentYear / 12) * 12;
    const [decadeStart, setDecadeStart] = useState(initialDecadeStart);

    const containerRef = useRef(null);
    const pickerRef = useRef(null);

    // Detect if popup should open upwards or align left/right
    useEffect(() => {
        if (isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            if (spaceBelow < 310 && rect.top > spaceBelow) {
                setDropUp(true);
            } else {
                setDropUp(false);
            }

            if (rect.right < 320 && (window.innerWidth - rect.left) >= 300) {
                setAlignRight(false);
            } else {
                setAlignRight(true);
            }
        }
    }, [isOpen]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Reset decade when opening
    useEffect(() => {
        if (isOpen) {
            const start = selectedYear
                ? Math.floor(selectedYear / 12) * 12
                : Math.floor(currentYear / 12) * 12;
            setDecadeStart(start);
        }
    }, [isOpen]);

    const yearsGrid = [];
    for (let i = 0; i < 12; i++) {
        yearsGrid.push(decadeStart + i);
    }

    const handleSelect = (yr) => {
        onChange(String(yr));
        setIsOpen(false);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange('');
        setIsOpen(false);
    };

    const canGoBack = decadeStart > min;
    const canGoForward = decadeStart + 12 <= max;

    return (
        <div className="w-full relative" ref={containerRef}>
            {/* Trigger */}
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full bg-white border-2 ${errorText ? 'border-red-400' : isOpen ? 'border-[#08315F] ring-2 ring-[#08315F]/10' : 'border-slate-200 hover:border-slate-300'} 
                    rounded-xl py-2 px-3 pl-9 pr-8 text-[15px] sm:text-[16px] min-h-[44px] h-[44px] flex items-center transition-all shadow-sm cursor-pointer select-none
                    ${disabled ? 'bg-slate-50 text-slate-700 cursor-not-allowed border-slate-200' : 'text-slate-800'} ${className}`}
            >
                <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                <span className={`truncate leading-normal ${selectedYear ? (disabled ? 'text-slate-700 font-bold' : 'text-slate-800 font-bold') : 'text-slate-400 font-medium'}`}>
                    {selectedYear || placeholder}
                </span>
                {selectedYear && !disabled && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
                        title="Clear year"
                    >
                        <FiX size={12} />
                    </button>
                )}
            </div>

            {/* Year Picker Popup */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={pickerRef}
                        initial={{ opacity: 0, y: dropUp ? 8 : -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: dropUp ? 8 : -8, scale: 0.96 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className={`absolute z-[100] ${dropUp ? 'bottom-full mb-2' : 'top-full mt-2'} ${alignRight ? 'right-0' : 'left-0'} w-72 sm:w-80 max-w-[calc(100vw-2.5rem)] bg-white rounded-2xl shadow-2xl shadow-slate-900/20 border-2 border-slate-200 overflow-hidden flex flex-col max-h-[min(380px,calc(100vh-2rem))]`}
                    >
                        {/* Header with navigation */}
                        <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-[#08315F] to-[#0A4A8A] shrink-0">
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); if (canGoBack) setDecadeStart(d => d - 12); }}
                                disabled={!canGoBack}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                                <FiChevronLeft size={16} />
                            </button>
                            <span className="text-[14px] sm:text-[15px] font-black text-white uppercase tracking-wider whitespace-nowrap">
                                {yearsGrid[0]} — {yearsGrid[yearsGrid.length - 1]}
                            </span>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); if (canGoForward) setDecadeStart(d => d + 12); }}
                                disabled={!canGoForward}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                                <FiChevronRight size={16} />
                            </button>
                        </div>

                        {/* Year grid */}
                        <div className="grid grid-cols-3 gap-1.5 p-2.5 overflow-y-auto">
                            {yearsGrid.map(yr => {
                                const isSelected = yr === selectedYear;
                                const isCurrent = yr === currentYear;
                                const isDisabled = yr < min || yr > max;

                                return (
                                    <button
                                        type="button"
                                        key={yr}
                                        onClick={(e) => { e.stopPropagation(); if (!isDisabled) handleSelect(yr); }}
                                        disabled={isDisabled}
                                        className={`relative py-2 rounded-xl text-[14px] sm:text-[15px] font-bold transition-all duration-200 cursor-pointer
                                            ${isSelected
                                                ? 'bg-[#08315F] text-white shadow-md shadow-blue-900/20 scale-[1.02]'
                                                : isDisabled
                                                    ? 'text-slate-300 cursor-not-allowed'
                                                    : 'text-slate-600 hover:bg-[#08315F]/8 hover:text-[#08315F] active:scale-95'
                                            }`}
                                    >
                                        {yr}
                                        {isCurrent && !isSelected && (
                                            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#08315F]" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Quick select footer */}
                        <div className="flex items-center justify-between px-3 pb-2.5 pt-1.5 border-t border-slate-100 shrink-0 bg-slate-50/50">
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleSelect(currentYear); }}
                                className="text-[12px] sm:text-[13px] font-bold text-[#08315F] uppercase tracking-wider hover:underline transition-all px-2 py-1 rounded-lg hover:bg-[#08315F]/5 cursor-pointer"
                            >
                                This Year
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleClear(e); }}
                                className="text-[12px] sm:text-[13px] font-bold text-slate-400 uppercase tracking-wider hover:text-red-500 hover:underline transition-all px-2 py-1 rounded-lg hover:bg-red-50 cursor-pointer"
                            >
                                Clear
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {errorText && (
                <p className="text-red-500 text-[15px] mt-1 ml-1 font-medium">{errorText}</p>
            )}
        </div>
    );
};

export default YearInput;

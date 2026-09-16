import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiBriefcase,
  FiUserCheck,
  FiSearch,
  FiFilter,
  FiPlus,
  FiRefreshCw,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
  FiCalendar,
  FiX,
  FiChevronDown,
  FiChevronUp,
  FiChevronRight,
  FiUsers,
  FiLayers,
  FiEdit2,
  FiCheck,
  FiInfo,
  FiAward,
  FiArrowRight,
  FiUser
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import AdminSidebar from '../components/AdminSidebar';
import PageTransition from '../components/PageTransition';
import LoadingScreen from '../components/LoadingScreen';
import Swal from 'sweetalert2';
import { apiUrl } from '../utils/api';

// =============================================================================
// HELPER: Smart Token Expansion & Relevance-Based Ranking for Position Search
// =============================================================================
const filterAndRankPositions = (positions, query) => {
  if (!query || !query.trim()) return positions;
  
  const rawQ = query.trim().toLowerCase();
  const tokens = rawQ.split(/\s+/).filter(Boolean);

  // Synonyms and Roman numeral mappings
  const expandedTokens = tokens.map(t => {
    const list = [t];
    if (t === '4' || t === 'iv') list.push('4', 'iv');
    if (t === '3' || t === 'iii') list.push('3', 'iii');
    if (t === '2' || t === 'ii') list.push('2', 'ii');
    if (t === '1' || t === 'i') list.push('1', 'i');
    if (t === 'dir') list.push('dir', 'director');
    if (t === 'sec') list.push('sec', 'secretary');
    if (t === 'usec') list.push('usec', 'undersecretary');
    if (t === 'asec') list.push('asec', 'assistant secretary');
    if (t === 'rd') list.push('rd', 'regional director');
    if (t === 'ard') list.push('ard', 'assistant regional director');
    if (t === 'sds') list.push('sds', 'schools division superintendent');
    if (t === 'asds') list.push('asds', 'assistant schools division superintendent');
    return list;
  });

  const scored = [];

  for (const p of positions) {
    const title = (p.position_title || '').toLowerCase();
    const code = (p.position_code || '').toLowerCase();
    const region = (p.region || '').toLowerCase();
    const bureau = (p.bureau || '').toLowerCase();
    const division = (p.division || '').toLowerCase();
    const sg = (p.salary_grade || '').toLowerCase();

    const fullText = `${code} ${title} ${region} ${bureau} ${division} ${sg}`;

    // Every token must match somewhere in fullText
    const matchesAllTokens = expandedTokens.every(synonyms =>
      synonyms.some(syn => fullText.includes(syn))
    );

    if (!matchesAllTokens) continue;

    let score = 0;

    // Exact match on code or title
    if (code === rawQ || title === rawQ) score += 3000;

    // Title starts with exact raw query (e.g. "Director IV" starts with "dir")
    if (title.startsWith(rawQ)) score += 2000;

    // Code starts with exact raw query (e.g. "DIR4" starts with "dir")
    if (code.startsWith(rawQ)) score += 1800;

    // Title starts with any synonym of first token
    if (expandedTokens[0].some(syn => title.startsWith(syn))) score += 1500;

    // Code starts with any synonym of first token
    if (expandedTokens[0].some(syn => code.startsWith(syn))) score += 1200;

    // Word boundary in title starts with token
    const words = title.split(/\s+/);
    if (words.some(w => expandedTokens[0].some(syn => w.startsWith(syn)))) score += 600;

    // Bonus for matching number/level in title or code
    tokens.forEach(t => {
      if (['4', 'iv', '3', 'iii', '2', 'ii', '1', 'i'].includes(t)) {
        if (title.includes(t) || code.includes(t)) score += 500;
      }
    });

    scored.push({ position: p, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.position.position_title.localeCompare(b.position.position_title);
  });

  return scored.map(s => s.position);
};

// =============================================================================
// =============================================================================
// SUB-COMPONENT: Searchable Official Dropdown (Combobox)
// Matching OfficialsRegistry Design with Viewport-Portalled Overlay
// =============================================================================
const OfficialCombobox = ({ officials, selectedId, onSelect, placeholder = "Select an Official..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0, maxHeight: 360, placement: 'bottom' });

  const selectedOfficial = useMemo(() => {
    return officials.find(o => String(o.id) === String(selectedId)) || null;
  }, [officials, selectedId]);

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const spaceBelow = viewportHeight - rect.bottom - 16;
      const spaceAbove = rect.top - 16;
      const preferredHeight = 360;

      const width = Math.min(rect.width, viewportWidth - 24);
      const left = Math.max(12, Math.min(rect.left, viewportWidth - width - 12));

      if (spaceBelow < 220 && spaceAbove > spaceBelow) {
        const maxHeight = Math.min(preferredHeight, Math.max(160, spaceAbove));
        setDropdownPos({
          top: Math.max(8, rect.top - maxHeight - 6),
          left,
          width,
          maxHeight,
          placement: 'top'
        });
      } else {
        const maxHeight = Math.min(preferredHeight, Math.max(160, spaceBelow));
        setDropdownPos({
          top: rect.bottom + 6,
          left,
          width,
          maxHeight,
          placement: 'bottom'
        });
      }
    }
  };

  const toggleOpen = () => {
    const next = !isOpen;
    if (next) {
      updatePosition();
      if (triggerRef.current) {
        setTimeout(() => {
          triggerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          updatePosition();
        }, 50);
      }
    }
    setIsOpen(next);
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScroll = () => updatePosition();
      const handleResize = () => updatePosition();
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!query.trim()) return officials;
    const q = query.toLowerCase();
    return officials.filter(o =>
      (o.official_name && o.official_name.toLowerCase().includes(q)) ||
      (o.tloid && o.tloid.toLowerCase().includes(q)) ||
      (o.first_name && o.first_name.toLowerCase().includes(q)) ||
      (o.last_name && o.last_name.toLowerCase().includes(q))
    );
  }, [officials, query]);

  return (
    <div className="relative w-full" ref={triggerRef}>
      {/* Selected Box / Toggle Button */}
      <div
        onClick={toggleOpen}
        className={`w-full bg-slate-50 border-2 border-slate-200 hover:border-[#08315F]/20 cursor-pointer rounded-2xl py-3.5 px-4 flex justify-between items-center transition-all group ${
          isOpen ? 'border-[#08315F] ring-2 ring-[#08315F]/10 bg-white' : ''
        }`}
      >
        <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
          {selectedOfficial ? (
            <>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-[#08315F] font-black text-xs border border-blue-200 shrink-0 shadow-2xs">
                {selectedOfficial.first_name ? selectedOfficial.first_name[0] : 'O'}
              </div>
              <div className="truncate flex-1 min-w-0">
                <span className="font-['Plus_Jakarta_Sans'] font-black text-[15px] text-[#08315F] block truncate">
                  {selectedOfficial.official_name || `${selectedOfficial.first_name} ${selectedOfficial.last_name}`}
                </span>
                <span className="text-[11px] font-mono font-bold text-[#075985]">
                  {selectedOfficial.tloid}
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 text-[14px] font-bold">
              <FiSearch className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">{placeholder}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {selectedOfficial && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onSelect('');
              }}
              className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              title="Clear selection"
            >
              <FiX className="w-3.5 h-3.5" />
            </span>
          )}
          <FiChevronRight
            className={`transition-transform duration-300 ${isOpen ? 'rotate-90 text-[#075985]' : 'text-slate-300'}`}
            size={18}
          />
        </div>
      </div>

      {/* Portalled Floating Dropdown Menu (Free from any parent clipping/overflow) */}
      {isOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[125]" onClick={() => setIsOpen(false)} />
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: dropdownPos.placement === 'top' ? 6 : -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: dropdownPos.placement === 'top' ? 6 : -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              top: `${dropdownPos.top}px`,
              left: `${dropdownPos.left}px`,
              width: `${dropdownPos.width}px`,
              maxHeight: `${dropdownPos.maxHeight}px`,
              zIndex: 130
            }}
            className="bg-white rounded-3xl shadow-[0_25px_60px_-15px_rgba(8,49,95,0.35)] border-2 border-slate-200 overflow-hidden flex flex-col"
          >
            {/* Search Input inside Dropdown */}
            <div className="p-3 border-b-2 border-slate-100 bg-slate-50/90 sticky top-0 z-10 flex items-center gap-2 shrink-0">
              <FiSearch className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search official name or TLO ID..."
                className="w-full bg-white border-2 border-slate-200 focus:border-[#08315F]/20 rounded-xl py-2 px-3 text-[13px] font-bold text-slate-700 outline-none transition-all"
              />
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 shrink-0">
                {filtered.length} found
              </span>
            </div>

            {/* Options List */}
            <div className="overflow-y-auto divide-y divide-slate-100 flex-1 p-1 custom-scrollbar">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-slate-400 font-bold uppercase tracking-wider">
                  No officials matching "{query}"
                </div>
              ) : (
                filtered.map((off) => {
                  const isSelected = String(off.id) === String(selectedId);
                  const hasActive = off.active_assignments && off.active_assignments.length > 0;
                  return (
                    <div
                      key={off.id}
                      onClick={() => {
                        onSelect(off.id);
                        setIsOpen(false);
                        setQuery('');
                      }}
                      className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-blue-50/70 border-l-4 border-[#08315F]'
                          : 'hover:bg-slate-50 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                            isSelected
                              ? 'bg-[#08315F] text-white'
                              : 'bg-gradient-to-br from-blue-50 to-indigo-50 text-[#08315F] border border-blue-200'
                          }`}
                        >
                          {off.first_name ? off.first_name[0] : 'O'}
                        </div>
                        <div className="truncate flex-1 min-w-0">
                          <p className="font-['Plus_Jakarta_Sans'] font-black text-[14px] text-slate-900 truncate">
                            {off.official_name || `${off.first_name} ${off.last_name}`}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap sm:flex-nowrap">
                            <span className="font-mono text-[10px] text-[#075985] font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-100 shrink-0">
                              {off.tloid}
                            </span>
                            {hasActive && (
                              <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 truncate max-w-[200px] sm:max-w-xs" title={`Active: ${off.active_assignments[0].position_title}`}>
                                Active: {off.active_assignments[0].position_title}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-[#08315F] text-white flex items-center justify-center shrink-0 shadow-2xs">
                          <FiCheck className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </>,
        document.body
      )}
    </div>
  );
};

// =============================================================================
// SUB-COMPONENT: Searchable Position Dropdown (Combobox)
// Matching OfficialsRegistry Design with Viewport-Portalled Overlay
// =============================================================================
const PositionCombobox = ({ positions, selectedId, onSelect, placeholder = "Select a Position..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0, maxHeight: 360, placement: 'bottom' });

  const selectedPosition = useMemo(() => {
    return positions.find(p => String(p.id) === String(selectedId)) || null;
  }, [positions, selectedId]);

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const spaceBelow = viewportHeight - rect.bottom - 16;
      const spaceAbove = rect.top - 16;
      const preferredHeight = 360;

      const width = Math.min(rect.width, viewportWidth - 24);
      const left = Math.max(12, Math.min(rect.left, viewportWidth - width - 12));

      if (spaceBelow < 220 && spaceAbove > spaceBelow) {
        const maxHeight = Math.min(preferredHeight, Math.max(160, spaceAbove));
        setDropdownPos({
          top: Math.max(8, rect.top - maxHeight - 6),
          left,
          width,
          maxHeight,
          placement: 'top'
        });
      } else {
        const maxHeight = Math.min(preferredHeight, Math.max(160, spaceBelow));
        setDropdownPos({
          top: rect.bottom + 6,
          left,
          width,
          maxHeight,
          placement: 'bottom'
        });
      }
    }
  };

  const toggleOpen = () => {
    const next = !isOpen;
    if (next) {
      updatePosition();
      if (triggerRef.current) {
        setTimeout(() => {
          triggerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          updatePosition();
        }, 50);
      }
    }
    setIsOpen(next);
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScroll = () => updatePosition();
      const handleResize = () => updatePosition();
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    return filterAndRankPositions(positions, query);
  }, [positions, query]);

  return (
    <div className="relative w-full" ref={triggerRef}>
      <div
        onClick={toggleOpen}
        className={`w-full bg-slate-50 border-2 border-slate-200 hover:border-[#08315F]/20 cursor-pointer rounded-2xl py-3.5 px-4 flex justify-between items-center transition-all group ${
          isOpen ? 'border-[#08315F] ring-2 ring-[#08315F]/10 bg-white' : ''
        }`}
      >
        <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
          {selectedPosition ? (
            <>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 font-black text-xs flex items-center justify-center shrink-0 border border-amber-200 shadow-2xs">
                {selectedPosition.position_code || 'POS'}
              </div>
              <div className="truncate flex-1 min-w-0">
                <span className="font-['Plus_Jakarta_Sans'] font-black text-[14.5px] text-[#08315F] block truncate" title={selectedPosition.position_title}>
                  {selectedPosition.position_title}
                </span>
                <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider truncate block">
                  {selectedPosition.region || 'CO'} • {selectedPosition.bureau || selectedPosition.division || 'Central Office'} (SG {selectedPosition.salary_grade || '—'})
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 text-[14px] font-bold">
              <FiBriefcase className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">{placeholder}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {selectedPosition && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onSelect('');
              }}
              className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              title="Clear selection"
            >
              <FiX className="w-3.5 h-3.5" />
            </span>
          )}
          <FiChevronRight
            className={`transition-transform duration-300 ${isOpen ? 'rotate-90 text-[#075985]' : 'text-slate-300'}`}
            size={18}
          />
        </div>
      </div>

      {/* Portalled Floating Position Menu (Free from modal and footer clipping) */}
      {isOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[125]" onClick={() => setIsOpen(false)} />
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: dropdownPos.placement === 'top' ? 6 : -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: dropdownPos.placement === 'top' ? 6 : -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              top: `${dropdownPos.top}px`,
              left: `${dropdownPos.left}px`,
              width: `${dropdownPos.width}px`,
              maxHeight: `${dropdownPos.maxHeight}px`,
              zIndex: 130
            }}
            className="bg-white rounded-3xl shadow-[0_25px_60px_-15px_rgba(8,49,95,0.35)] border-2 border-slate-200 overflow-hidden flex flex-col"
          >
            <div className="p-3 border-b-2 border-slate-100 bg-slate-50/90 sticky top-0 z-10 flex items-center gap-2 shrink-0">
              <FiSearch className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search position title, code, region, bureau..."
                className="w-full bg-white border-2 border-slate-200 focus:border-[#08315F]/20 rounded-xl py-2 px-3 text-[13px] font-bold text-slate-700 outline-none transition-all"
              />
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200 shrink-0">
                {filtered.length} available
              </span>
            </div>

            <div className="overflow-y-auto divide-y divide-slate-100 flex-1 p-1 custom-scrollbar">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-slate-400 font-bold uppercase tracking-wider">
                  No positions matching "{query}"
                </div>
              ) : (
                filtered.map((pos) => {
                  const isSelected = String(pos.id) === String(selectedId);
                  return (
                    <div
                      key={pos.id}
                      onClick={() => {
                        onSelect(pos.id);
                        setIsOpen(false);
                        setQuery('');
                      }}
                      className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-blue-50/70 border-l-4 border-[#08315F]'
                          : 'hover:bg-slate-50 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                        <span className="px-2 py-1 bg-amber-50 text-amber-800 font-mono font-bold text-[10px] rounded-lg border border-amber-200 shrink-0">
                          {pos.position_code || 'POS'}
                        </span>
                        <div className="truncate flex-1 min-w-0">
                          <p className="font-['Plus_Jakarta_Sans'] font-black text-[14px] text-slate-900 truncate" title={pos.position_title}>
                            {pos.position_title}
                          </p>
                          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 truncate">
                            {pos.region || 'CO'} • {pos.bureau || pos.division || 'General'} | SG {pos.salary_grade || '—'}
                          </p>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-[#08315F] text-white flex items-center justify-center shrink-0 shadow-2xs">
                          <FiCheck className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </>,
        document.body
      )}
    </div>
  );
};

// =============================================================================
// SUB-COMPONENT: Searchable Special Designation Dropdown (Vacant Only)
// Matching OfficialsRegistry Design with Viewport-Portalled Overlay
// =============================================================================
const SpecialDesignationCombobox = ({ vacantPositions, value, onChange, excludePositionId, placeholder = "Select Special Designation (Vacant Only)..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0, maxHeight: 360, placement: 'bottom' });

  const availablePositions = useMemo(() => {
    if (!excludePositionId) return vacantPositions;
    return vacantPositions.filter(p => String(p.id) !== String(excludePositionId));
  }, [vacantPositions, excludePositionId]);

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const spaceBelow = viewportHeight - rect.bottom - 16;
      const spaceAbove = rect.top - 16;
      const preferredHeight = 360;

      const width = Math.min(rect.width, viewportWidth - 24);
      const left = Math.max(12, Math.min(rect.left, viewportWidth - width - 12));

      if (spaceBelow < 220 && spaceAbove > spaceBelow) {
        const maxHeight = Math.min(preferredHeight, Math.max(160, spaceAbove));
        setDropdownPos({
          top: Math.max(8, rect.top - maxHeight - 6),
          left,
          width,
          maxHeight,
          placement: 'top'
        });
      } else {
        const maxHeight = Math.min(preferredHeight, Math.max(160, spaceBelow));
        setDropdownPos({
          top: rect.bottom + 6,
          left,
          width,
          maxHeight,
          placement: 'bottom'
        });
      }
    }
  };

  const toggleOpen = () => {
    const next = !isOpen;
    if (next) {
      updatePosition();
      if (triggerRef.current) {
        setTimeout(() => {
          triggerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          updatePosition();
        }, 50);
      }
    }
    setIsOpen(next);
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScroll = () => updatePosition();
      const handleResize = () => updatePosition();
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    return filterAndRankPositions(availablePositions, query);
  }, [availablePositions, query]);

  return (
    <div className="relative w-full" ref={triggerRef}>
      {/* Selected Box / Toggle Button */}
      <div
        onClick={toggleOpen}
        className={`w-full bg-slate-50 border-2 border-slate-200 hover:border-[#08315F]/20 cursor-pointer rounded-2xl py-3.5 px-4 flex justify-between items-center transition-all group ${
          isOpen ? 'border-[#08315F] ring-2 ring-[#08315F]/10 bg-white' : ''
        }`}
      >
        <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
          {value ? (
            <>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 font-bold text-xs flex items-center justify-center shrink-0 border border-purple-200 shadow-2xs">
                <FiAward className="w-4 h-4" />
              </div>
              <div className="truncate flex-1 min-w-0">
                <span className="font-['Plus_Jakarta_Sans'] font-black text-[14.5px] text-[#08315F] block truncate" title={value}>
                  {value}
                </span>
                <span className="text-[11px] text-purple-600 font-bold uppercase tracking-wider block">
                  Special Designation (Vacant)
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 text-[14px] font-bold">
              <FiAward className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">{placeholder}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {value && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              title="Clear Special Designation"
            >
              <FiX className="w-3.5 h-3.5" />
            </span>
          )}
          <FiChevronRight
            className={`transition-transform duration-300 ${isOpen ? 'rotate-90 text-[#075985]' : 'text-slate-300'}`}
            size={18}
          />
        </div>
      </div>

      {/* Portalled Floating Special Designation Menu (Free from modal and footer clipping) */}
      {isOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[125]" onClick={() => setIsOpen(false)} />
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: dropdownPos.placement === 'top' ? 6 : -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: dropdownPos.placement === 'top' ? 6 : -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              top: `${dropdownPos.top}px`,
              left: `${dropdownPos.left}px`,
              width: `${dropdownPos.width}px`,
              maxHeight: `${dropdownPos.maxHeight}px`,
              zIndex: 130
            }}
            className="bg-white rounded-3xl shadow-[0_25px_60px_-15px_rgba(8,49,95,0.35)] border-2 border-slate-200 overflow-hidden flex flex-col"
          >
            {/* Search Input */}
            <div className="p-3 border-b-2 border-slate-100 bg-slate-50/90 sticky top-0 z-10 flex items-center gap-2 shrink-0">
              <FiSearch className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search vacant positions for designation..."
                className="w-full bg-white border-2 border-slate-200 focus:border-[#08315F]/20 rounded-xl py-2 px-3 text-[13px] font-bold text-slate-700 outline-none transition-all"
              />
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-1.5 rounded-lg border border-purple-200 shrink-0">
                {filtered.length} vacant
              </span>
            </div>

            {/* Options List */}
            <div className="overflow-y-auto divide-y divide-slate-100 flex-1 p-1 custom-scrollbar">
              {/* Option to clear / No Special Designation */}
              <div
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                  setQuery('');
                }}
                className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-3 ${
                  !value
                    ? 'bg-purple-50/70 border-l-4 border-purple-600'
                    : 'hover:bg-slate-50 border-l-4 border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                    <FiX className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="font-['Plus_Jakarta_Sans'] font-black text-[14px] text-slate-800">None (No Special Designation)</p>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Regular appointment only</p>
                  </div>
                </div>
                {!value && (
                  <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <FiCheck className="w-3 h-3" />
                  </div>
                )}
              </div>

              {filtered.length === 0 ? (
                <div className="py-6 text-center text-[13px] text-slate-400 font-bold uppercase tracking-wider">
                  No vacant positions matching "{query}"
                </div>
              ) : (
                filtered.map((pos) => {
                  const label = `${pos.position_title}${pos.bureau ? ` - ${pos.bureau}` : pos.division ? ` - ${pos.division}` : pos.region ? ` - ${pos.region}` : ''}`;
                  const isSelected = value === label || value === pos.position_title;
                  return (
                    <div
                      key={pos.id}
                      onClick={() => {
                        onChange(label);
                        setIsOpen(false);
                        setQuery('');
                      }}
                      className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-purple-50/70 border-l-4 border-purple-600'
                          : 'hover:bg-slate-50 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 font-mono font-bold text-[10px] rounded-lg shrink-0">
                          {pos.position_code || 'POS'}
                        </span>
                        <div className="truncate flex-1 min-w-0">
                          <p className="font-['Plus_Jakarta_Sans'] font-black text-[14px] text-slate-900 truncate" title={pos.position_title}>
                            {pos.position_title}
                          </p>
                          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 truncate">
                            {pos.region || 'CO'} • {pos.bureau || pos.division || 'General'} | SG {pos.salary_grade || '—'}
                          </p>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                          <FiCheck className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </>,
        document.body
      )}
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT: Position Assignments
// Following OfficialsRegistry Design
// =============================================================================
const PositionAssignments = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // Data States
  const [assignments, setAssignments] = useState([]);
  const [vacantPositions, setVacantPositions] = useState([]);
  const [officials, setOfficials] = useState([]);
  const [stats, setStats] = useState({
    totalAssignments: 0,
    activeAssignments: 0,
    inactiveAssignments: 0,
    vacantPositionsCount: 0,
    totalPositionsCount: 0,
    totalOfficialsCount: 0
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Modals
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [submittingAssign, setSubmittingAssign] = useState(false);
  const [formData, setFormData] = useState({
    tlo_masterlist_id: '',
    position_id: '',
    capacity: 'Full',
    start_date: new Date().toISOString().split('T')[0],
    designation: '',
    remarks: ''
  });

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAssignmentToEdit, setSelectedAssignmentToEdit] = useState(null);
  const [editPositions, setEditPositions] = useState([]);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editFormData, setEditFormData] = useState({
    tlo_masterlist_id: '',
    position_id: '',
    capacity: 'Full',
    start_date: '',
    designation: '',
    remarks: ''
  });

  // Deactivate Modal State
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [selectedAssignmentToDeactivate, setSelectedAssignmentToDeactivate] = useState(null);
  const [deactivateData, setDeactivateData] = useState({
    end_date: new Date().toISOString().split('T')[0],
    remarks: ''
  });
  const [submittingDeactivate, setSubmittingDeactivate] = useState(false);

  const authHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token || localStorage.getItem('token')}`
  }), [token]);

  // Fetch Assignments & Stats
  const fetchAssignments = async () => {
    try {
      let url = apiUrl('/api/third-level/assignments');
      const params = new URLSearchParams();
      if (statusFilter !== 'All') params.append('status', statusFilter);
      if (searchTerm) params.append('search', searchTerm);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, { headers: authHeaders });
      if (!res.ok) throw new Error('Failed to load assignments');
      const data = await res.json();
      setAssignments(data.data || []);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error('Error fetching assignments:', err);
    }
  };

  // Fetch Vacant Positions (Only vacant)
  const fetchVacantPositions = async () => {
    try {
      const res = await fetch(apiUrl('/api/third-level/assignments/vacant-positions'), { headers: authHeaders });
      if (!res.ok) throw new Error('Failed to load vacant positions');
      const data = await res.json();
      setVacantPositions(data.data || []);
    } catch (err) {
      console.error('Error fetching vacant positions:', err);
    }
  };

  // Fetch Officials for Assignment Dropdown
  const fetchOfficials = async () => {
    try {
      const res = await fetch(apiUrl('/api/third-level/assignments/officials'), { headers: authHeaders });
      if (!res.ok) throw new Error('Failed to load officials');
      const data = await res.json();
      setOfficials(data.data || []);
    } catch (err) {
      console.error('Error fetching officials:', err);
    }
  };

  // Initial Load
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchAssignments(), fetchVacantPositions(), fetchOfficials()]);
      setLoading(false);
    };
    loadAll();
  }, [statusFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchAssignments(), fetchVacantPositions(), fetchOfficials()]);
    setRefreshing(false);
  };

  // Active assigned position IDs
  const activeAssignedPosIds = useMemo(() => {
    return new Set(
      assignments
        .filter(a => a.status && a.status.toLowerCase() !== 'inactive')
        .map(a => String(a.position_id))
    );
  }, [assignments]);

  // Vacant positions strictly filtered: positions that are already assigned are NOT displayed unless status is inactive
  const displayVacantPositions = useMemo(() => {
    return vacantPositions.filter(p => !activeAssignedPosIds.has(String(p.id)));
  }, [vacantPositions, activeAssignedPosIds]);

  // Edit modal positions
  const displayEditPositions = useMemo(() => {
    return editPositions.filter(p => {
      if (selectedAssignmentToEdit && String(p.id) === String(selectedAssignmentToEdit.position_id)) {
        return true;
      }
      return !activeAssignedPosIds.has(String(p.id));
    });
  }, [editPositions, activeAssignedPosIds, selectedAssignmentToEdit]);

  // Filtered & Paginated assignments for table
  const filteredAssignments = useMemo(() => {
    let list = assignments;
    if (statusFilter !== 'All') {
      list = list.filter(a => a.status && a.status.toLowerCase() === statusFilter.toLowerCase());
    }
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(a =>
        (a.official_name && a.official_name.toLowerCase().includes(q)) ||
        (a.first_name && a.first_name.toLowerCase().includes(q)) ||
        (a.last_name && a.last_name.toLowerCase().includes(q)) ||
        (a.tloid && a.tloid.toLowerCase().includes(q)) ||
        (a.position_title && a.position_title.toLowerCase().includes(q)) ||
        (a.position_code && a.position_code.toLowerCase().includes(q)) ||
        (a.region && a.region.toLowerCase().includes(q)) ||
        (a.bureau && a.bureau.toLowerCase().includes(q)) ||
        (a.division && a.division.toLowerCase().includes(q)) ||
        (a.designation && a.designation.toLowerCase().includes(q))
      );
    }
    return list;
  }, [assignments, statusFilter, searchTerm]);

  // Reset page when search or status tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredAssignments.length / pageSize));
  const pagedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAssignments.slice(start, start + pageSize);
  }, [filteredAssignments, currentPage, pageSize]);

  const pageButtons = useMemo(() => {
    const visible = new Set([1, pageCount, currentPage - 1, currentPage, currentPage + 1].filter(page => page >= 1 && page <= pageCount));
    const pages = [];
    let previous = 0;
    [...visible].sort((a, b) => a - b).forEach(page => {
      if (page - previous > 1) pages.push('ellipsis-' + page);
      pages.push(page);
      previous = page;
    });
    return pages;
  }, [currentPage, pageCount]);

  // Open Assign Modal
  const handleOpenAssignModal = () => {
    setFormData({
      tlo_masterlist_id: '',
      position_id: '',
      capacity: 'Full',
      start_date: new Date().toISOString().split('T')[0],
      designation: '',
      remarks: ''
    });
    fetchVacantPositions();
    setShowAssignModal(true);
  };

  const selectedOfficialObj = useMemo(() => {
    if (!formData.tlo_masterlist_id) return null;
    return officials.find(o => String(o.id) === String(formData.tlo_masterlist_id));
  }, [officials, formData.tlo_masterlist_id]);

  // Submit New Assignment
  const handleSubmitAssignment = async (e) => {
    e.preventDefault();

    if (!formData.tlo_masterlist_id) {
      Swal.fire('Missing Information', 'Please select an official from the dropdown.', 'warning');
      return;
    }
    if (!formData.position_id) {
      Swal.fire('Missing Information', 'Please select a vacant position from the dropdown.', 'warning');
      return;
    }

    setSubmittingAssign(true);
    try {
      const res = await fetch(apiUrl('/api/third-level/assignments'), {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          Swal.fire({
            icon: 'error',
            title: 'Position Not Vacant',
            text: data.error || 'This position is no longer vacant. Another administrator may have just assigned it.',
            confirmButtonColor: '#08315F'
          });
          fetchVacantPositions();
          return;
        }
        throw new Error(data.error || 'Failed to create assignment');
      }

      Swal.fire({
        icon: 'success',
        title: 'Assignment Created',
        text: data.message,
        confirmButtonColor: '#08315F',
        timer: 2000
      });

      setShowAssignModal(false);
      handleRefresh();
    } catch (err) {
      Swal.fire('Error', err.message || 'An error occurred while creating assignment.', 'error');
    } finally {
      setSubmittingAssign(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = async (assignment) => {
    setSelectedAssignmentToEdit(assignment);
    setEditFormData({
      tlo_masterlist_id: assignment.tlo_masterlist_id,
      position_id: assignment.position_id,
      capacity: assignment.capacity || 'Full',
      start_date: assignment.start_date ? assignment.start_date.split('T')[0] : '',
      designation: assignment.designation || '',
      remarks: assignment.remarks || ''
    });

    try {
      const res = await fetch(
        apiUrl(`/api/third-level/assignments/vacant-positions?include_position_id=${assignment.position_id}`),
        { headers: authHeaders }
      );
      if (res.ok) {
        const data = await res.json();
        setEditPositions(data.data || []);
      }
    } catch (e) {
      console.error(e);
      setEditPositions(vacantPositions);
    }

    setShowEditModal(true);
  };

  // Submit Edit Assignment
  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    if (!selectedAssignmentToEdit) return;

    if (!editFormData.tlo_masterlist_id) {
      Swal.fire('Missing Information', 'Please select an official.', 'warning');
      return;
    }
    if (!editFormData.position_id) {
      Swal.fire('Missing Information', 'Please select a position.', 'warning');
      return;
    }

    setSubmittingEdit(true);
    try {
      const res = await fetch(apiUrl(`/api/third-level/assignments/${selectedAssignmentToEdit.id}`), {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(editFormData)
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          Swal.fire({
            icon: 'error',
            title: 'Target Position Occupied',
            text: data.error || 'The selected position is currently assigned to another official.',
            confirmButtonColor: '#08315F'
          });
          return;
        }
        throw new Error(data.error || 'Failed to update assignment');
      }

      Swal.fire({
        icon: 'success',
        title: 'Assignment Updated',
        text: 'The assignment record and deployment details have been successfully updated.',
        confirmButtonColor: '#08315F',
        timer: 2000
      });

      setShowEditModal(false);
      setSelectedAssignmentToEdit(null);
      handleRefresh();
    } catch (err) {
      Swal.fire('Error', err.message || 'Failed to update assignment.', 'error');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Open Deactivate Modal
  const handleOpenDeactivateModal = (assignment) => {
    setSelectedAssignmentToDeactivate(assignment);
    setDeactivateData({
      end_date: new Date().toISOString().split('T')[0],
      remarks: ''
    });
    setShowDeactivateModal(true);
  };

  // Submit Deactivate
  const handleSubmitDeactivate = async (e) => {
    e.preventDefault();
    if (!selectedAssignmentToDeactivate) return;

    setSubmittingDeactivate(true);
    try {
      const res = await fetch(apiUrl(`/api/third-level/assignments/${selectedAssignmentToDeactivate.id}/deactivate`), {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify(deactivateData)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to deactivate assignment');

      Swal.fire({
        icon: 'success',
        title: 'Assignment Ended',
        text: 'The position has now become vacant and available for reassignment.',
        confirmButtonColor: '#08315F',
        timer: 2000
      });

      setShowDeactivateModal(false);
      setSelectedAssignmentToDeactivate(null);
      handleRefresh();
    } catch (err) {
      Swal.fire('Error', err.message || 'Failed to deactivate assignment.', 'error');
    } finally {
      setSubmittingDeactivate(false);
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <PageTransition>
      <div className="flex h-screen bg-transparent font-sans overflow-hidden">
        {/* Navigation Sidebar */}
        <AdminSidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto relative bg-transparent">
          {/* TOP NAVIGATION BAR (Matching OfficialsRegistry) */}
          <header className="sticky top-0 z-50 bg-[#08315F] backdrop-blur-md border-b border-blue-900 px-8 py-4 flex items-center justify-between shadow-lg shadow-blue-900/20 shrink-0 w-full">
            <div className="flex items-center gap-4 text-white">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white shadow-inner">
                <FiBriefcase size={20} />
              </div>
              <div>
                <h1 className="text-lg font-['Plus_Jakarta_Sans'] font-black text-white tracking-tight leading-none italic uppercase">
                  Position <span className="text-blue-300 not-italic">Assignments</span>
                </h1>
                <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest mt-1">
                  Plantilla Deployment & Staffing • Third Level Officials Command Dashboard
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

          <main className="flex-1 px-8 pb-8 pt-6 max-w-[1600px] mx-auto w-full dashboard-theme !bg-transparent">
            {/* UNIFIED DATA CONTROLS TAB (Matching OfficialsRegistry) */}
            <div className="bg-white border-2 border-[#08315F] rounded-[24px] p-3 shadow-sm mb-6 flex flex-col gap-2.5">
              {/* TOP ROW: STATUS PILL SWITCHER & ACTION BUTTONS */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
                {/* Status Tabs */}
                <div className="flex items-center gap-1.5 p-1 bg-[#F0F9FF] border-2 border-[#BAE6FD] rounded-full">
                  {['All', 'Active', 'Inactive'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`h-[36px] px-5 rounded-full text-[13.5px] font-black uppercase tracking-widest transition-all ${
                        statusFilter === st
                          ? 'bg-[#08315F] text-white shadow-sm'
                          : 'text-[#08315F] hover:bg-sky-100'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                {/* Buttons: Refresh & New Position Assignment */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="h-[44px] px-5 bg-[#F0F9FF] hover:bg-sky-100 text-[#08315F] rounded-full border-2 border-[#BAE6FD] font-black text-[13.5px] tracking-widest uppercase transition-colors flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50 active:scale-95"
                    title="Refresh data"
                  >
                    <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-sky-600' : ''}`} />
                    <span>Refresh</span>
                  </button>

                  <button
                    onClick={handleOpenAssignModal}
                    className="h-[44px] px-6 bg-[#08315F] hover:bg-[#004A99] text-white rounded-full font-black text-[13.5px] tracking-widest uppercase transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-md active:scale-95 border-2 border-transparent"
                  >
                    <FiPlus className="w-4 h-4" />
                    <span>New Position Assignment</span>
                  </button>
                </div>
              </div>

              {/* BOTTOM ROW: SEARCH BAR */}
              <div className="relative w-full h-[44px]">
                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#08315F]/50" size={16} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by official name, TLO ID, position title, code, bureau, or region..."
                  className="w-full h-full bg-[#F0F9FF] border-2 border-[#BAE6FD] rounded-full py-0 pl-11 pr-10 text-[15px] font-bold text-[#08315F] outline-none focus:border-sky-400 placeholder:text-[#08315F]/50 transition-colors"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    title="Clear search"
                  >
                    <FiX size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* STATS CARDS (Exact match to OfficialsRegistry styling) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 w-full">
              {/* Card 1: Active Assignments */}
              <div
                onClick={() => setStatusFilter(prev => prev === 'Active' ? 'All' : 'Active')}
                className={`min-h-[100px] p-5 bg-white rounded-[16px] border-2 border-[#BAE6FD] border-l-[6px] overflow-hidden cursor-pointer transition-all flex flex-col justify-between ${
                  statusFilter === 'Active' ? 'border-l-sky-500 shadow-md ring-1 ring-sky-200' : 'border-l-sky-400 hover:shadow-sm'
                }`}
              >
                <div className="text-[14px] text-slate-500 uppercase tracking-widest font-bold mb-2">Total Active Assignments</div>
                <div className="text-[44px] text-[#08315F] font-normal leading-none mb-2">{stats.activeAssignments}</div>
                <div className="text-[12.5px] text-slate-400 uppercase tracking-widest font-bold leading-none">Currently deployed in view</div>
              </div>

              {/* Card 2: Vacant Positions */}
              <div
                className="min-h-[100px] p-5 bg-white rounded-[16px] border-2 border-[#BAE6FD] border-l-[6px] overflow-hidden transition-all flex flex-col justify-between border-l-rose-400 hover:shadow-sm"
              >
                <div className="text-[14px] text-slate-500 uppercase tracking-widest font-bold mb-2">Total Vacant Positions</div>
                <div className="text-[44px] text-[#08315F] font-normal leading-none mb-2">{stats.vacantPositionsCount}</div>
                <div className="text-[12.5px] text-slate-400 uppercase tracking-widest font-bold leading-none">Available for assignment</div>
              </div>

              {/* Card 3: Registered Officials */}
              <div
                className="min-h-[100px] p-5 bg-white rounded-[16px] border-2 border-[#BAE6FD] border-l-[6px] overflow-hidden transition-all flex flex-col justify-between border-l-amber-400 hover:shadow-sm"
              >
                <div className="text-[14px] text-slate-500 uppercase tracking-widest font-bold mb-2">Registered Officials</div>
                <div className="text-[44px] text-[#08315F] font-normal leading-none mb-2">{stats.totalOfficialsCount}</div>
                <div className="text-[12.5px] text-slate-400 uppercase tracking-widest font-bold leading-none">In TLO Masterlist</div>
              </div>

              {/* Card 4: Plantilla Positions */}
              <div
                className="min-h-[100px] p-5 bg-white rounded-[16px] border-2 border-[#BAE6FD] border-l-[6px] overflow-hidden transition-all flex flex-col justify-between border-l-indigo-400 hover:shadow-sm"
              >
                <div className="text-[14px] text-slate-500 uppercase tracking-widest font-bold mb-2">Plantilla Positions</div>
                <div className="text-[44px] text-[#08315F] font-normal leading-none mb-2">{stats.totalPositionsCount}</div>
                <div className="text-[12.5px] text-slate-400 uppercase tracking-widest font-bold leading-none">Authorized plantilla items</div>
              </div>
            </div>

            {/* MAIN CONTENT AREA: TABLE & CARDS (Matching OfficialsRegistry) */}
            <AnimatePresence mode="wait">
              {filteredAssignments.length === 0 ? (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-20 text-center bg-white rounded-[30px] border-2 border-[#08315F]">
                  <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FiBriefcase size={40} />
                  </div>
                  <h3 className="text-xl font-['Plus_Jakarta_Sans'] font-black text-[#08315F] uppercase italic tracking-tight">No Assignment Records Found</h3>
                  <p className="text-slate-400 font-medium mt-2">
                    {searchTerm ? 'Adjust your search query or reset status filters.' : 'Click "New Position Assignment" to deploy an official into an available plantilla post.'}
                  </p>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card !rounded-[30px] !border-2 !border-[#08315F] overflow-hidden bg-white shadow-sm">
                  <div className="w-full">
                    {/* Desktop Table View */}
                    <table className="hidden md:table w-full text-left border-collapse table-fixed">
                      <thead>
                        <tr className="bg-white border-b-2 border-slate-200">
                          <th className="px-5 py-4 text-left align-top text-[13px] font-black text-slate-400 uppercase tracking-widest w-[28%]">
                            Official Name & TLO ID
                          </th>
                          <th className="px-4 py-4 text-left align-top text-[13px] font-black text-slate-400 uppercase tracking-widest w-[26%]">
                            Position Title & Code
                          </th>
                          <th className="px-2 py-4 text-center align-top text-[13px] font-black text-slate-400 uppercase tracking-widest w-[8%]">
                            SG
                          </th>
                          <th className="px-3 py-4 text-left align-top text-[13px] font-black text-slate-400 uppercase tracking-widest w-[16%]">
                            Office / Region
                          </th>
                          <th className="px-2 py-4 text-center align-top text-[13px] font-black text-slate-400 uppercase tracking-widest w-[11%]">
                            Capacity
                          </th>
                          <th className="px-2 py-4 text-center align-top text-[13px] font-black text-slate-400 uppercase tracking-widest w-[11%]">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y-2 divide-slate-200/60 bg-white">
                        {pagedRecords.map((item) => {
                          const isActive = item.status === 'Active' && !item.end_date;
                          return (
                            <tr key={item.id} className="group transition-colors relative hover:bg-slate-50/80">
                              {/* Official Name & TLO ID */}
                              <td className="px-5 py-4 align-middle">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-[#08315F] font-black text-sm border-2 border-white shadow-sm overflow-hidden shrink-0">
                                    {item.first_name ? item.first_name[0] : 'O'}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-['Plus_Jakarta_Sans'] font-black text-[#08315F] text-[17px] leading-snug truncate">
                                      {item.official_name || `${item.first_name || ''} ${item.last_name || ''}`}
                                    </div>
                                    <div className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 flex items-center gap-1.5 truncate">
                                      <FiArrowRight className="text-[#075985] shrink-0" size={10} />
                                      <span className="font-mono font-bold text-[#075985]">{item.tloid}</span>
                                      {item.start_date && (
                                        <>
                                          <span className="text-slate-300">•</span>
                                          <FiCalendar className="text-slate-300 shrink-0" size={10} />
                                          <span>{new Date(item.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Position Title & Code */}
                              <td className="px-4 py-4 align-middle">
                                <div className="space-y-1">
                                  <div className="flex w-fit max-w-full items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50/80 border-2 border-amber-300 text-amber-700 text-[12.5px] font-black uppercase tracking-tight shadow-2xs">
                                    <span className="truncate" title={item.position_title}>{item.position_title}</span>
                                  </div>
                                  <div className="text-[11.5px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 truncate">
                                    <span className="font-mono">{item.position_code || 'POS'}</span>
                                    {item.designation && (
                                      <>
                                        <span className="text-slate-300">•</span>
                                        <span className="text-purple-600 font-bold truncate" title={item.designation}>
                                          Desig: {item.designation}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Salary Grade */}
                              <td className="px-2 py-4 align-middle text-center">
                                <span className="font-black text-[#08315F] text-[15px]">
                                  {item.salary_grade ? `SG ${item.salary_grade}` : '—'}
                                </span>
                              </td>

                              {/* Office / Region */}
                              <td className="px-3 py-4 align-middle">
                                <div className="text-[14px] font-black text-[#08315F] uppercase tracking-tight truncate" title={item.region || 'CENTRAL OFFICE'}>
                                  {item.region || 'CENTRAL OFFICE'}
                                </div>
                                <div className="text-[11.5px] font-bold text-slate-400 uppercase tracking-widest truncate mt-0.5" title={item.bureau || item.division || 'General'}>
                                  {item.bureau || item.division || '—'}
                                </div>
                              </td>

                              {/* Capacity Badge */}
                              <td className="px-2 py-4 align-middle text-center">
                                <span className={`inline-block px-3 py-1 rounded-full text-[12px] font-black uppercase tracking-widest border-2 ${
                                  item.capacity === 'Full'
                                    ? 'bg-blue-50 text-[#075985] border-blue-200'
                                    : item.capacity === 'OIC'
                                    ? 'bg-[#FCD116]/20 border-[#FCD116] text-[#0038A8]'
                                    : 'bg-purple-50 text-purple-700 border-purple-200'
                                }`}>
                                  {item.capacity}
                                </span>
                              </td>

                              {/* Status & Floating Action Toolbar */}
                              <td className="px-2 py-4 align-middle text-center static md:relative">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-black uppercase tracking-widest border-2 ${
                                  isActive
                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                    : 'bg-slate-50 text-slate-400 border-slate-200'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                  {isActive ? 'Active' : 'Inactive'}
                                </span>

                                {/* Group Hover Action Toolbar (Matching OfficialsRegistry) */}
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 z-10 bg-white/95 backdrop-blur-md p-1.5 rounded-xl shadow-md border-2 border-slate-200 pointer-events-none group-hover:pointer-events-auto">
                                  <button
                                    onClick={() => handleOpenEditModal(item)}
                                    title="Edit assignment details or reassign"
                                    className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-sky-50 text-[#08315F] rounded-lg text-[13px] font-black uppercase tracking-widest hover:bg-[#08315F] hover:text-white transition-all border-2 border-sky-200 shadow-2xs shrink-0"
                                  >
                                    <FiEdit2 size={13} />
                                    <span>Edit</span>
                                  </button>
                                  {isActive && (
                                    <button
                                      onClick={() => handleOpenDeactivateModal(item)}
                                      title="End assignment to free this position"
                                      className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[13px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all border-2 border-rose-200 shadow-2xs shrink-0"
                                    >
                                      <FiX size={13} />
                                      <span>End</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Mobile Card View (Matching OfficialsRegistry) */}
                    <div className="md:hidden flex flex-col divide-y-2 divide-slate-100">
                      {pagedRecords.map((item) => {
                        const isActive = item.status === 'Active' && !item.end_date;
                        return (
                          <div key={item.id} className="p-4 bg-white hover:bg-slate-50/50 transition-colors flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-[#08315F] font-black text-sm border-2 border-white shadow-sm shrink-0">
                                  {item.first_name ? item.first_name[0] : 'O'}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-['Plus_Jakarta_Sans'] font-black text-[#08315F] text-[17px] leading-tight truncate">
                                    {item.official_name || `${item.first_name || ''} ${item.last_name || ''}`}
                                  </div>
                                  <div className="text-[12px] font-bold text-slate-400 mt-0.5 truncate font-mono">
                                    {item.tloid}
                                  </div>
                                </div>
                              </div>
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest border-2 shrink-0 ${
                                isActive
                                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                  : 'bg-slate-50 text-slate-400 border-slate-200'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                {isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>

                            <div className="flex flex-col gap-2 mt-1 bg-slate-50/70 rounded-2xl p-3.5 border-2 border-slate-200">
                              <div className="flex justify-between items-center text-[13px] gap-2">
                                <span className="font-black text-slate-400 uppercase tracking-widest shrink-0">Position</span>
                                <span className="font-black text-[#08315F] text-right truncate max-w-[65%]">
                                  {item.position_title}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-[13px] gap-2">
                                <span className="font-black text-slate-400 uppercase tracking-widest shrink-0">Office</span>
                                <span className="font-bold text-slate-700 text-right truncate max-w-[65%]">
                                  {item.region || 'CO'} • {item.bureau || item.division || '—'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-[13px] gap-2">
                                <span className="font-black text-slate-400 uppercase tracking-widest shrink-0">Capacity</span>
                                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-widest border-2 ${
                                  item.capacity === 'Full'
                                    ? 'bg-blue-50 text-[#075985] border-blue-200'
                                    : item.capacity === 'OIC'
                                    ? 'bg-[#FCD116]/20 border-[#FCD116] text-[#0038A8]'
                                    : 'bg-purple-50 text-purple-700 border-purple-200'
                                }`}>
                                  {item.capacity}
                                </span>
                              </div>
                              {item.designation && (
                                <div className="flex justify-between items-center text-[13px] gap-2">
                                  <span className="font-black text-slate-400 uppercase tracking-widest shrink-0">Special Desig.</span>
                                  <span className="font-bold text-purple-700 text-right truncate max-w-[65%]">
                                    {item.designation}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-1">
                              <button
                                onClick={() => handleOpenEditModal(item)}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-sky-50 text-[#08315F] rounded-xl text-[13px] font-black uppercase tracking-widest border-2 border-sky-200 hover:bg-[#08315F] hover:text-white transition-all shadow-2xs"
                              >
                                <FiEdit2 size={13} /> Edit
                              </button>
                              {isActive && (
                                <button
                                  onClick={() => handleOpenDeactivateModal(item)}
                                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 rounded-xl text-[13px] font-black uppercase tracking-widest border-2 border-rose-200 hover:bg-rose-500 hover:text-white transition-all shadow-2xs"
                                >
                                  <FiX size={13} /> End
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* TABLE FOOTER / PAGINATION (Matching OfficialsRegistry) */}
                    <div className="px-8 py-5 bg-white border-t-2 border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <span className="text-[14px] font-black text-slate-400 uppercase tracking-widest">
                        Showing {filteredAssignments.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, filteredAssignments.length)} of {filteredAssignments.length} records
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className="px-4 py-2 bg-white border-2 border-slate-200 text-slate-500 rounded-xl text-[14px] font-black uppercase tracking-widest disabled:opacity-40 transition-all hover:bg-slate-50"
                        >
                          Previous
                        </button>
                        {pageButtons.map(page => typeof page === 'number' ? (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-10 h-10 rounded-xl text-[14px] font-black border-2 transition-all ${
                              currentPage === page
                                ? 'bg-[#08315F] text-white border-[#004A99] shadow-sm'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-blue-200'
                            }`}
                          >
                            {page}
                          </button>
                        ) : (
                          <span key={page} className="px-1 text-[14px] font-black text-slate-300">...</span>
                        ))}
                        <span className="px-2 py-2 text-[14px] font-black text-slate-400 uppercase tracking-widest">
                          Page {currentPage} of {pageCount}
                        </span>
                        <button
                          disabled={currentPage === pageCount}
                          onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))}
                          className="px-4 py-2 bg-white border-2 border-slate-200 text-slate-500 rounded-xl text-[14px] font-black uppercase tracking-widest disabled:opacity-40 transition-all hover:bg-slate-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: NEW POSITION ASSIGNMENT (PORTAL, MATCHING OfficialsRegistry) */}
      {/* ========================================================================= */}
      {createPortal(
        <AnimatePresence>
          {showAssignModal && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 30 }}
                className="bg-white rounded-[2.5rem] sm:rounded-[3rem] w-full max-w-2xl shadow-2xl border-2 border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
              >
                {/* Modal Header */}
                <div className="p-6 sm:p-8 pb-4 flex justify-between items-start border-b-2 border-slate-100">
                  <div>
                    <span className="text-[13px] font-black text-[#075985] uppercase tracking-widest mb-1 block">Staffing Action</span>
                    <h2 className="text-[26px] sm:text-[32px] font-['Plus_Jakarta_Sans'] font-black text-[#08315F] tracking-tighter uppercase italic leading-none">
                      New Position Assignment
                    </h2>
                    <p className="text-slate-400 font-bold text-[14px] mt-1.5">
                      Deploy an official into a verified vacant plantilla position.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAssignModal(false)}
                    className="p-3 rounded-2xl bg-slate-50 text-slate-400 hover:text-red-600 transition-all border-2 border-slate-200"
                    title="Close"
                  >
                    <FiX size={18} />
                  </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmitAssignment} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  <div className="p-6 sm:p-8 pb-8 overflow-y-auto space-y-5 flex-1 min-h-0 custom-scrollbar">
                    {/* 1. Official Selection */}
                    <div>
                      <label className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                        1. Select Official <span className="text-red-500">*</span>
                      </label>
                      <OfficialCombobox
                        officials={officials}
                        selectedId={formData.tlo_masterlist_id}
                        onSelect={(id) => setFormData({ ...formData, tlo_masterlist_id: id })}
                        placeholder="Search official by name or TLO ID..."
                      />

                      {/* Advisory notice */}
                      {selectedOfficialObj && selectedOfficialObj.active_assignments && selectedOfficialObj.active_assignments.length > 0 && (
                        <div className="mt-2.5 p-3.5 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-start gap-2.5 text-[13px] text-amber-900">
                          <FiAlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold">Notice: Official already holds an active assignment</p>
                            <p className="text-[12px] text-amber-700 mt-0.5">
                              Currently assigned to <strong>{selectedOfficialObj.active_assignments[0].position_title}</strong> as <strong>{selectedOfficialObj.active_assignments[0].capacity}</strong>. You may proceed if designating concurrently or as OIC.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 2. Vacant Position Selection */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest block">
                          2. Select Vacant Position <span className="text-red-500">*</span>
                        </label>
                        <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 shrink-0">
                          {displayVacantPositions.length} Vacant Available
                        </span>
                      </div>

                      <PositionCombobox
                        positions={displayVacantPositions}
                        selectedId={formData.position_id}
                        onSelect={(id) => setFormData({ ...formData, position_id: id })}
                        placeholder="Search vacant positions..."
                      />
                    </div>

                    {/* 3. Capacity & Start Date */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                          Capacity / Type <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <select
                            value={formData.capacity}
                            onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                            className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#08315F]/20 rounded-2xl py-3.5 px-4 text-[15px] font-bold text-slate-700 outline-none transition-all appearance-none pr-10 cursor-pointer"
                          >
                            <option value="Full">Full (Substantive / Regular)</option>
                            <option value="OIC">OIC (Officer-in-Charge)</option>
                            <option value="Concurrent">Concurrent</option>
                          </select>
                          <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none w-4 h-4" />
                        </div>
                      </div>

                      <div>
                        <label className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                          Start Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={formData.start_date}
                          onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                          required
                          className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#08315F]/20 rounded-2xl py-3 px-4 text-[15px] font-bold text-slate-700 outline-none transition-all"
                        />
                      </div>
                    </div>

                    {/* 4. Special Designation (Vacant Only) */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest block">
                          Special Designation (Vacant Only)
                        </label>
                        <span className="text-[11px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 shrink-0">
                          Optional
                        </span>
                      </div>
                      <SpecialDesignationCombobox
                        vacantPositions={displayVacantPositions}
                        value={formData.designation}
                        onChange={(val) => setFormData({ ...formData, designation: val })}
                        excludePositionId={formData.position_id}
                        placeholder="Select Special Designation (Vacant Only)..."
                      />
                    </div>

                    {/* 5. Remarks */}
                    <div>
                      <label className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                        Remarks / Notes
                      </label>
                      <input
                        type="text"
                        value={formData.remarks}
                        onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                        placeholder="e.g., Special Order No. 2026-081"
                        className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#08315F]/20 rounded-2xl py-3 px-4 text-[15px] font-bold text-slate-700 outline-none transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Fixed Modal Footer */}
                  <div className="p-6 sm:p-8 pt-4 border-t-2 border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-3 shrink-0 bg-white">
                    <button
                      type="button"
                      onClick={() => setShowAssignModal(false)}
                      className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white border-2 border-slate-200 text-slate-500 font-black uppercase tracking-widest text-[13.5px] hover:bg-slate-50 transition-all text-center active:scale-95"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingAssign}
                      className="w-full sm:w-auto px-8 py-3.5 bg-[#08315F] hover:bg-[#004A99] text-white rounded-2xl text-[13.5px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex justify-center items-center gap-2 border-2 border-transparent shadow-lg shadow-blue-900/20 active:scale-95"
                    >
                      {submittingAssign ? (
                        <>
                          <FiRefreshCw className="w-4 h-4 animate-spin" />
                          <span>Verifying & Assigning...</span>
                        </>
                      ) : (
                        <>
                          <FiCheckCircle className="w-4 h-4" />
                          <span>Confirm Assignment</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT ASSIGNMENT (PORTAL, MATCHING OfficialsRegistry) */}
      {/* ========================================================================= */}
      {createPortal(
        <AnimatePresence>
          {showEditModal && selectedAssignmentToEdit && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 30 }}
                className="bg-white rounded-[2.5rem] sm:rounded-[3rem] w-full max-w-2xl shadow-2xl border-2 border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
              >
                {/* Header */}
                <div className="p-6 sm:p-8 pb-4 flex justify-between items-start border-b-2 border-slate-100">
                  <div>
                    <span className="text-[13px] font-black text-[#075985] uppercase tracking-widest mb-1 block">Staffing Action</span>
                    <h2 className="text-[26px] sm:text-[32px] font-['Plus_Jakarta_Sans'] font-black text-[#08315F] tracking-tighter uppercase italic leading-none">
                      Edit Position Assignment
                    </h2>
                    <p className="text-slate-400 font-bold text-[14px] mt-1.5">
                      Modify deployment details or reassign to another position.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="p-3 rounded-2xl bg-slate-50 text-slate-400 hover:text-red-600 transition-all border-2 border-slate-200"
                    title="Close"
                  >
                    <FiX size={18} />
                  </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmitEdit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  <div className="p-6 sm:p-8 pb-8 overflow-y-auto space-y-5 flex-1 min-h-0 custom-scrollbar">
                    {/* 1. Official Selection */}
                    <div>
                      <label className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                        Official <span className="text-red-500">*</span>
                      </label>
                      <OfficialCombobox
                        officials={officials}
                        selectedId={editFormData.tlo_masterlist_id}
                        onSelect={(id) => setEditFormData({ ...editFormData, tlo_masterlist_id: id })}
                        placeholder="Search official..."
                      />
                    </div>

                    {/* 2. Position Selection */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest block">
                          Position (Current or Reassign to Vacant Slot) <span className="text-red-500">*</span>
                        </label>
                        <span className="text-[11px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 shrink-0">
                          {displayEditPositions.length} Selectable
                        </span>
                      </div>

                      <PositionCombobox
                        positions={displayEditPositions}
                        selectedId={editFormData.position_id}
                        onSelect={(id) => setEditFormData({ ...editFormData, position_id: id })}
                        placeholder="Search positions..."
                      />
                    </div>

                    {/* 3. Capacity & Start Date */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                          Capacity / Type <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <select
                            value={editFormData.capacity}
                            onChange={(e) => setEditFormData({ ...editFormData, capacity: e.target.value })}
                            className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#08315F]/20 rounded-2xl py-3.5 px-4 text-[15px] font-bold text-slate-700 outline-none transition-all appearance-none pr-10 cursor-pointer"
                          >
                            <option value="Full">Full (Substantive / Regular)</option>
                            <option value="OIC">OIC (Officer-in-Charge)</option>
                            <option value="Concurrent">Concurrent</option>
                          </select>
                          <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none w-4 h-4" />
                        </div>
                      </div>

                      <div>
                        <label className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                          Start Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={editFormData.start_date}
                          onChange={(e) => setEditFormData({ ...editFormData, start_date: e.target.value })}
                          required
                          className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#08315F]/20 rounded-2xl py-3 px-4 text-[15px] font-bold text-slate-700 outline-none transition-all"
                        />
                      </div>
                    </div>

                    {/* 4. Special Designation */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest block">
                          Special Designation (Vacant Only)
                        </label>
                        <span className="text-[11px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 shrink-0">
                          Optional
                        </span>
                      </div>
                      <SpecialDesignationCombobox
                        vacantPositions={displayVacantPositions}
                        value={editFormData.designation}
                        onChange={(val) => setEditFormData({ ...editFormData, designation: val })}
                        excludePositionId={editFormData.position_id}
                        placeholder="Select Special Designation (Vacant Only)..."
                      />
                    </div>

                    {/* 5. Remarks */}
                    <div>
                      <label className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                        Remarks / Notes
                      </label>
                      <input
                        type="text"
                        value={editFormData.remarks}
                        onChange={(e) => setEditFormData({ ...editFormData, remarks: e.target.value })}
                        placeholder="e.g., Reassignment Order Ref"
                        className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#08315F]/20 rounded-2xl py-3 px-4 text-[15px] font-bold text-slate-700 outline-none transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Fixed Footer */}
                  <div className="p-6 sm:p-8 pt-4 border-t-2 border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-3 shrink-0 bg-white">
                    <button
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white border-2 border-slate-200 text-slate-500 font-black uppercase tracking-widest text-[13.5px] hover:bg-slate-50 transition-all text-center active:scale-95"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingEdit}
                      className="w-full sm:w-auto px-8 py-3.5 bg-[#08315F] hover:bg-[#004A99] text-white rounded-2xl text-[13.5px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex justify-center items-center gap-2 border-2 border-transparent shadow-lg shadow-blue-900/20 active:scale-95"
                    >
                      {submittingEdit ? (
                        <>
                          <FiRefreshCw className="w-4 h-4 animate-spin" />
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <>
                          <FiCheckCircle className="w-4 h-4" />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: END / DEACTIVATE ASSIGNMENT (PORTAL, MATCHING OfficialsRegistry) */}
      {/* ========================================================================= */}
      {createPortal(
        <AnimatePresence>
          {showDeactivateModal && selectedAssignmentToDeactivate && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 30 }}
                className="bg-white rounded-[2.5rem] sm:rounded-[3rem] w-full max-w-lg shadow-2xl border-2 border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
              >
                {/* Header */}
                <div className="p-6 sm:p-8 pb-4 flex justify-between items-start border-b-2 border-slate-100">
                  <div>
                    <span className="text-[13px] font-black text-rose-500 uppercase tracking-widest mb-1 block">Staffing Action</span>
                    <h2 className="text-[26px] sm:text-[32px] font-['Plus_Jakarta_Sans'] font-black text-[#08315F] tracking-tighter uppercase italic leading-none">
                      End Assignment
                    </h2>
                    <p className="text-slate-400 font-bold text-[14px] mt-1.5">
                      Deactivate assignment and restore position to vacant status.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDeactivateModal(false)}
                    className="p-3 rounded-2xl bg-slate-50 text-slate-400 hover:text-red-600 transition-all border-2 border-slate-200"
                    title="Close"
                  >
                    <FiX size={18} />
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmitDeactivate} className="p-6 sm:p-8 flex flex-col gap-4 overflow-y-auto">
                  <div className="p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl space-y-2">
                    <div>
                      <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Official</p>
                      <p className="text-[15px] font-['Plus_Jakarta_Sans'] font-black text-[#08315F] mt-0.5">
                        {selectedAssignmentToDeactivate.official_name} ({selectedAssignmentToDeactivate.tloid})
                      </p>
                    </div>
                    <div>
                      <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Current Position</p>
                      <p className="text-[14px] font-bold text-slate-800 mt-0.5">
                        {selectedAssignmentToDeactivate.position_title} ({selectedAssignmentToDeactivate.position_code})
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                      Effective End Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={deactivateData.end_date}
                      onChange={(e) => setDeactivateData({ ...deactivateData, end_date: e.target.value })}
                      required
                      className="w-full bg-slate-50 border-2 border-slate-200 focus:border-rose-500 rounded-2xl py-3 px-4 text-[15px] font-bold text-slate-700 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                      Reason / Deactivation Remarks
                    </label>
                    <textarea
                      value={deactivateData.remarks}
                      onChange={(e) => setDeactivateData({ ...deactivateData, remarks: e.target.value })}
                      rows={3}
                      placeholder="e.g., Completed term / Reassigned to new post"
                      className="w-full bg-slate-50 border-2 border-slate-200 focus:border-rose-500 rounded-2xl py-3 px-4 text-[14px] font-bold text-slate-700 outline-none resize-none transition-all placeholder:text-slate-400"
                    />
                  </div>

                  <div className="pt-4 border-t-2 border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-3 mt-2">
                    <button
                      type="button"
                      onClick={() => setShowDeactivateModal(false)}
                      className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white border-2 border-slate-200 text-slate-500 font-black uppercase tracking-widest text-[13.5px] hover:bg-slate-50 transition-all text-center active:scale-95"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingDeactivate}
                      className="w-full sm:w-auto px-8 py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-[13.5px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex justify-center items-center gap-2 border-2 border-transparent shadow-lg shadow-rose-900/20 active:scale-95"
                    >
                      {submittingDeactivate ? (
                        <>
                          <FiRefreshCw className="w-4 h-4 animate-spin" />
                          <span>Ending...</span>
                        </>
                      ) : (
                        <>
                          <FiCheckCircle className="w-4 h-4" />
                          <span>Confirm End Assignment</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </PageTransition>
  );
};

export default PositionAssignments;

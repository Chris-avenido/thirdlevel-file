import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX,
  FiSearch,
  FiChevronDown,
  FiChevronRight,
  FiCheck,
  FiCheckCircle,
  FiRefreshCw,
  FiLayers,
  FiHelpCircle
} from 'react-icons/fi';
import Swal from 'sweetalert2';
import { apiUrl } from '../utils/api';

// =============================================================================
// Helper: Position Ranking & Search
// =============================================================================
const filterAndRankPositions = (positions, query) => {
  if (!query || !query.trim()) return positions;

  const rawQ = query.trim().toLowerCase();
  const tokens = rawQ.split(/\s+/).filter(Boolean);

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

    const matchesAllTokens = expandedTokens.every(synonyms =>
      synonyms.some(syn => fullText.includes(syn))
    );

    if (!matchesAllTokens) continue;

    let score = 0;
    if (code === rawQ || title === rawQ) score += 3000;
    if (title.startsWith(rawQ)) score += 2000;
    if (code.startsWith(rawQ)) score += 1800;
    if (expandedTokens[0].some(syn => title.startsWith(syn))) score += 1500;
    if (expandedTokens[0].some(syn => code.startsWith(syn))) score += 1200;

    const words = title.split(/\s+/);
    if (words.some(w => expandedTokens[0].some(syn => w.startsWith(syn)))) score += 600;

    tokens.forEach(t => {
      if (['4', 'iv', '3', 'iii', '2', 'ii', '1', 'i'].includes(t)) {
        if (title.includes(t) || code.includes(t)) score += 500;
      }
    });

    scored.push({ p, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.p);
};

// =============================================================================
// SUB-COMPONENT: Searchable Official Dropdown (Combobox)
// =============================================================================
const OfficialCombobox = ({ officials, selectedId, onSelect, placeholder = "Select an Official..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0, maxHeight: 360, placement: 'bottom' });

  const selectedOfficial = useMemo(() => {
    return officials.find(o => String(o.id) === String(selectedId) || (Array.isArray(o.other_masterlist_ids) && o.other_masterlist_ids.includes(Number(selectedId)))) || null;
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

  // Deduplicate officials by unique name / identity so duplicates never render twice
  const uniqueOfficials = useMemo(() => {
    if (!Array.isArray(officials)) return [];
    const seen = new Set();
    const result = [];
    for (const off of officials) {
      // Exclude officials whose status is 'For Approval' / 'For Approve' or not 'Active'
      const statusLower = (off.status || off.official_status || '').toLowerCase();
      if (statusLower.includes('approv') || (statusLower && statusLower !== 'active')) {
        continue;
      }
      const nameKey = (off.official_name || `${off.first_name || ''} ${off.last_name || ''}`).trim().toUpperCase();
      const key = nameKey || `id_${off.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(off);
      }
    }
    return result;
  }, [officials]);

  const filtered = useMemo(() => {
    if (!query.trim()) return uniqueOfficials;
    const q = query.toLowerCase();
    return uniqueOfficials.filter(o =>
      (o.official_name && o.official_name.toLowerCase().includes(q)) ||
      (o.tloid && o.tloid.toLowerCase().includes(q)) ||
      (o.first_name && o.first_name.toLowerCase().includes(q)) ||
      (o.last_name && o.last_name.toLowerCase().includes(q)) ||
      (Array.isArray(o.active_designations) && o.active_designations.some(d => d && d.toLowerCase().includes(q)))
    );
  }, [uniqueOfficials, query]);

  return (
    <div className="relative w-full" ref={triggerRef}>
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
                {selectedOfficial.plantilla_item_no && (
                  <span className="text-[11px] font-mono font-bold text-[#075985]">
                    {selectedOfficial.plantilla_item_no}
                  </span>
                )}
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
                placeholder="Search official name or active designation..."
                className="w-full bg-white border-2 border-slate-200 focus:border-[#08315F]/20 rounded-xl py-2 px-3 text-[13px] font-bold text-slate-700 outline-none transition-all"
              />
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 shrink-0">
                {filtered.length} found
              </span>
            </div>

            <div className="overflow-y-auto divide-y divide-slate-100 flex-1 p-1 custom-scrollbar">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-slate-400 font-bold uppercase tracking-wider">
                  No officials matching "{query}"
                </div>
              ) : (
                filtered.map((off) => {
                  const isSelected = String(off.id) === String(selectedId);
                  const activeDesignations = (Array.isArray(off.active_designations) && off.active_designations.length > 0)
                    ? off.active_designations
                    : (off.active_assignments && off.active_assignments.length > 0)
                      ? off.active_assignments.map(a => a.designation || (a.capacity === 'OIC' ? `OIC - ${a.position_title}` : a.position_title))
                      : [];

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
                        <div className="flex-1 min-w-0">
                          <p className="font-['Plus_Jakarta_Sans'] font-black text-[14px] text-slate-900 truncate">
                            {off.official_name || `${off.first_name} ${off.last_name}`}
                          </p>
                          {activeDesignations.length > 0 && (
                            <div className="flex flex-wrap gap-1 items-center mt-1">
                              {activeDesignations.map((desig, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-flex items-center leading-tight whitespace-normal"
                                  title={`Active: ${desig}`}
                                >
                                  Active: {desig}
                                </span>
                              ))}
                            </div>
                          )}
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
            <div className="truncate flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-['Plus_Jakarta_Sans'] font-black text-[15px] text-[#08315F] truncate">
                  {selectedPosition.position_title}
                </span>
                <span className="font-mono text-[10px] text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 font-bold shrink-0">
                  {selectedPosition.position_code}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                <span className="font-bold text-[#075985]">{selectedPosition.region || 'CENTRAL OFFICE'}</span>
                {selectedPosition.bureau && <span>• {selectedPosition.bureau}</span>}
                {selectedPosition.salary_grade && <span className="font-bold text-slate-700">• SG {selectedPosition.salary_grade}</span>}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 text-[14px] font-bold">
              <FiSearch className="w-4 h-4 text-slate-400 shrink-0" />
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
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 shrink-0">
                {filtered.length} found
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
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-['Plus_Jakarta_Sans'] font-black text-[14px] text-slate-900 truncate">
                            {pos.position_title}
                          </p>
                          <span className="font-mono text-[9px] text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 font-bold shrink-0">
                            {pos.position_code}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span className="font-bold text-[#08315F]">{pos.region || 'CENTRAL OFFICE'}</span>
                          {pos.bureau && <span>• {pos.bureau}</span>}
                          {pos.division && <span>• {pos.division}</span>}
                          {pos.salary_grade && <span className="font-bold text-slate-700">• SG {pos.salary_grade}</span>}
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
// MAIN COMPONENT: Staffing Action / New Position Assignment Modal
// Replaces the legacy "Executive Dashboard Reassign Official" modal
// =============================================================================
export const NewPositionAssignmentModal = ({
  isOpen,
  onClose,
  onRefresh,
  token,
  initialOfficial = null
}) => {
  const [officials, setOfficials] = useState([]);
  const [vacantPositions, setVacantPositions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    tlo_masterlist_id: '',
    position_id: '',
    capacity: 'Full-fledged',
    start_date: new Date().toISOString().split('T')[0],
    remarks: ''
  });

  const [vacateDecisions, setVacateDecisions] = useState({});

  const authToken = token || localStorage.getItem('token');
  const authHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  }), [authToken]);

  // Fetch Vacant Positions
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

  // Reset & Load Data on Open
  useEffect(() => {
    if (isOpen) {
      setFormData({
        tlo_masterlist_id: '',
        position_id: '',
        capacity: 'Full-fledged',
        start_date: new Date().toISOString().split('T')[0],
        remarks: ''
      });
      setVacateDecisions({});
      setLoading(true);
      Promise.all([fetchVacantPositions(), fetchOfficials()]).finally(() => setLoading(false));
    }
  }, [isOpen]);

  // Pre-select initialOfficial if passed
  useEffect(() => {
    if (isOpen && initialOfficial && officials.length > 0) {
      const targetTloid = (initialOfficial.TLOid || initialOfficial.tloid || initialOfficial.tlo_id || '').toLowerCase();
      const targetId = String(initialOfficial.id || initialOfficial.tlo_masterlist_id || '');
      const match = officials.find(o =>
        (targetId && String(o.id) === targetId) ||
        (targetTloid && o.tloid && o.tloid.toLowerCase() === targetTloid)
      );
      if (match) {
        setFormData(prev => ({ ...prev, tlo_masterlist_id: match.id }));
      }
    }
  }, [isOpen, initialOfficial, officials]);

  // Resolve currently selected official
  const selectedOfficialObj = useMemo(() => {
    if (!formData.tlo_masterlist_id) return null;
    return officials.find(o => String(o.id) === String(formData.tlo_masterlist_id) || (Array.isArray(o.other_masterlist_ids) && o.other_masterlist_ids.includes(Number(formData.tlo_masterlist_id)))) || null;
  }, [officials, formData.tlo_masterlist_id]);

  // Active positions of currently selected official
  const displayedAssignments = useMemo(() => {
    if (!selectedOfficialObj) return [];
    if (Array.isArray(selectedOfficialObj.active_assignments) && selectedOfficialObj.active_assignments.length > 0) {
      return selectedOfficialObj.active_assignments;
    }
    if (Array.isArray(selectedOfficialObj.existing_assignments) && selectedOfficialObj.existing_assignments.length > 0) {
      return selectedOfficialObj.existing_assignments.filter(a => !a.status || a.status.toLowerCase() !== 'inactive');
    }
    return [];
  }, [selectedOfficialObj]);

  // Default vacate decisions when selected official changes
  useEffect(() => {
    if (displayedAssignments.length > 0) {
      setVacateDecisions(prev => {
        const next = { ...prev };
        displayedAssignments.forEach(a => {
          if (next[a.id] === undefined) {
            next[a.id] = true; // default to vacate
          }
        });
        return next;
      });
    } else {
      setVacateDecisions({});
    }
  }, [displayedAssignments]);

  // Handle Form Submission
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

    setSubmitting(true);
    try {
      const vacatedAssignIds = Object.keys(vacateDecisions)
        .filter(id => vacateDecisions[id] === true)
        .map(id => parseInt(id, 10));

      const payload = {
        tlo_masterlist_id: parseInt(formData.tlo_masterlist_id, 10),
        position_id: parseInt(formData.position_id, 10),
        capacity: formData.capacity,
        start_date: formData.start_date,
        remarks: formData.remarks || null,
        vacate_previous_position: vacatedAssignIds.length > 0,
        vacate_assignment_ids: vacatedAssignIds
      };

      const res = await fetch(apiUrl('/api/third-level/assignments'), {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload)
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
        text: data.message || 'Official successfully assigned.',
        confirmButtonColor: '#08315F',
        timer: 2000
      });

      onClose();
      if (typeof onRefresh === 'function') {
        onRefresh();
      }
    } catch (err) {
      Swal.fire('Error', err.message || 'An error occurred while creating assignment.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const vacateCount = displayedAssignments.filter(ea => vacateDecisions[ea.id] === true).length;
  const retainCount = displayedAssignments.length - vacateCount;

  let submitButtonText = 'Confirm Assignment';
  if (displayedAssignments.length > 0) {
    if (vacateCount > 0 && retainCount > 0) {
      submitButtonText = `Assign & Vacate ${vacateCount} (Retain ${retainCount})`;
    } else if (vacateCount > 0) {
      submitButtonText = `Assign & Vacate ${vacateCount} ${vacateCount === 1 ? 'Position' : 'Positions'}`;
    } else {
      submitButtonText = 'Confirm Assignment (Retain Current)';
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm">
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
              type="button"
              onClick={onClose}
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
                  onSelect={(id) => setFormData(prev => ({ ...prev, tlo_masterlist_id: id }))}
                  placeholder="Search official by name or TLO ID..."
                />
              </div>

              {/* Official's Active Positions: Display all active positions of selected official */}
              {selectedOfficialObj && (
                <div className="bg-slate-50/90 border-2 border-slate-200 rounded-2xl p-4 sm:p-5">
                  <div className="mb-3.5 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FiLayers className="w-4 h-4 text-[#075985]" />
                        <h3 className="text-[13px] font-black text-[#08315F] uppercase tracking-wider">
                          Current Positions of Official
                        </h3>
                      </div>
                      <span className="text-[10.5px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-sky-100 text-[#075985] border border-sky-200 shrink-0">
                        {displayedAssignments.length} {displayedAssignments.length === 1 ? 'Active Position' : 'Active Positions'}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-slate-500">
                      {displayedAssignments.length > 0
                        ? 'Select below which position(s) should be vacated:'
                        : 'No active positions currently held by this official.'}
                    </p>
                  </div>

                  {displayedAssignments.length === 0 ? (
                    <div className="p-4 bg-white rounded-xl border-2 border-dashed border-slate-200 text-center">
                      <p className="text-[12.5px] font-bold text-slate-400">
                        No active positions found for this official.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                      {displayedAssignments.map((ea) => {
                        const isVacate = vacateDecisions[ea.id] === true;
                        return (
                          <div
                            key={ea.id}
                            className={`p-4 rounded-xl border-2 transition-all bg-white ${
                              isVacate
                                ? 'border-amber-500 ring-2 ring-amber-400/30 shadow-xs'
                                : 'border-slate-200 shadow-2xs'
                            }`}
                          >
                            {/* Position info */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-slate-800 text-[13.5px]">
                                    {ea.position_title}
                                  </span>
                                  <span className="font-mono text-[9.5px] text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 font-bold">
                                    {ea.position_code || 'POS'}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-slate-500 mt-1">
                                  <span className="font-bold text-[#08315F]">{ea.region || 'CENTRAL OFFICE'}</span>
                                  {ea.bureau && <span>• {ea.bureau}</span>}
                                  {ea.salary_grade && <span className="font-bold text-slate-700">• SG {ea.salary_grade}</span>}
                                  {ea.start_date && (
                                    <span className="font-mono text-slate-400">
                                      • Since {new Date(ea.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                  ea.capacity === 'Full' || ea.capacity === 'Full-fledged'
                                    ? 'bg-blue-50 text-[#075985] border-blue-200'
                                    : ea.capacity === 'OIC' || ea.capacity === 'Officer-in-Charge (OIC)'
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : 'bg-purple-50 text-purple-700 border-purple-200'
                                }`}>
                                  Current: {ea.capacity === 'Full' ? 'Full-fledged' : ea.capacity === 'OIC' ? 'Officer-in-Charge (OIC)' : ea.capacity || 'Full-fledged'}
                                </span>
                              </div>
                            </div>

                            {/* Question per position */}
                            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              <div className="flex items-center gap-2">
                                <FiHelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                <div>
                                  <span className="text-[12px] font-black text-slate-800 uppercase tracking-wide">
                                    Need to vacate this position?
                                  </span>
                                  <p className="text-[11px] text-slate-500">
                                    {isVacate ? (
                                      <span className="text-amber-700 font-bold">
                                        Will be marked Inactive and returned to the vacant pool.
                                      </span>
                                    ) : (
                                      <span className="text-[#075985] font-semibold">
                                        Will remain Active alongside new deployment (Retained).
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>

                              {/* Decision buttons per position */}
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setVacateDecisions(prev => ({ ...prev, [ea.id]: true }))}
                                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider border-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                                    isVacate
                                      ? 'bg-amber-500 border-amber-600 text-white shadow-xs'
                                      : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                                  }`}
                                >
                                  <FiCheck className="w-3.5 h-3.5 stroke-[3]" />
                                  YES — Vacate
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setVacateDecisions(prev => ({ ...prev, [ea.id]: false }))}
                                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider border-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                                    !isVacate
                                      ? 'bg-[#08315F] border-[#08315F] text-white shadow-xs'
                                      : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                                  }`}
                                >
                                  <FiX className="w-3.5 h-3.5 stroke-[3]" />
                                  NO — Retain
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Capacity / Type */}
              <div>
                <label className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                  Capacity / Type <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={
                      formData.capacity === 'Full' || formData.capacity === 'Full-fledged'
                        ? 'Full-fledged'
                        : formData.capacity === 'OIC' || formData.capacity === 'Officer-in-Charge (OIC)'
                          ? 'Officer-in-Charge (OIC)'
                          : formData.capacity
                    }
                    onChange={(e) => setFormData(prev => ({ ...prev, capacity: e.target.value }))}
                    className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#08315F]/20 rounded-2xl py-3.5 px-4 text-[15px] font-bold text-slate-700 outline-none transition-all appearance-none pr-10 cursor-pointer"
                  >
                    <option value="Full-fledged">Full-fledged</option>
                    <option value="Officer-in-Charge (OIC)">Officer-in-Charge (OIC)</option>
                  </select>
                  <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none w-4 h-4" />
                </div>
              </div>

              {/* 2. Vacant Position Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest block">
                    2. Select Vacant Position <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 shrink-0">
                    {vacantPositions.length} Vacant Available
                  </span>
                </div>

                <PositionCombobox
                  positions={vacantPositions}
                  selectedId={formData.position_id}
                  onSelect={(id) => setFormData(prev => ({ ...prev, position_id: id }))}
                  placeholder="Search vacant positions..."
                />
              </div>

              {/* 3. Deployment Details: Start Date & Remarks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    required
                    className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#08315F]/20 rounded-2xl py-3 px-4 text-[15px] font-bold text-slate-700 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-[13.5px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                    Remarks / Notes
                  </label>
                  <input
                    type="text"
                    value={formData.remarks}
                    onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                    placeholder="e.g., Special Order No. 2026-081"
                    className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#08315F]/20 rounded-2xl py-3 px-4 text-[15px] font-bold text-slate-700 outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Fixed Modal Footer */}
            <div className="p-6 sm:p-8 pt-4 border-t-2 border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-3 shrink-0 bg-white">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white border-2 border-slate-200 text-slate-500 font-black uppercase tracking-widest text-[13.5px] hover:bg-slate-50 transition-all text-center active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto px-8 py-3.5 bg-[#08315F] hover:bg-[#004A99] text-white rounded-2xl text-[13.5px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex justify-center items-center gap-2 border-2 border-transparent shadow-lg shadow-blue-900/20 active:scale-95 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <FiRefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying & Assigning...</span>
                  </>
                ) : (
                  <>
                    <FiCheckCircle className="w-4 h-4" />
                    <span>{submitButtonText}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default NewPositionAssignmentModal;

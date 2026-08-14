import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiSearch, FiArrowRight, FiUploadCloud, FiAlertCircle, FiCheck } from 'react-icons/fi';
import Swal from 'sweetalert2';
import { apiUrl } from '../utils/api';

// ─── Helper ──────────────────────────────────────────────────────────────────
const fullName = (o) =>
  `${o?.first_name || ''} ${o?.middle_name ? o.middle_name + ' ' : ''}${o?.last_name || ''}${o?.suffix ? ' ' + o.suffix : ''}`.trim();

// ─── Component ───────────────────────────────────────────────────────────────
const ReassignOfficialModal = ({ isOpen, onClose, onRefresh, token }) => {
  // Step 1 – official search/select
  const [query, setQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  // Step 2 – destination fields
  const [newRegion, setNewRegion] = useState('');
  const [newDivision, setNewDivision] = useState('');
  const [newDesignation, setNewDesignation] = useState('');

  // Lookup options (reuse GET /api/third-level/positions)
  const [options, setOptions] = useState({ regions: [], regionDivisions: {}, designations: [] });
  const [allOfficials, setAllOfficials] = useState([]);

  // File upload
  const [file, setFile] = useState(null);
  const fileRef = useRef();

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [loadingOfficials, setLoadingOfficials] = useState(false);

  // Dropdown positioning — escapes overflow-y:auto clip boundary
  const inputRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (dropdownOpen && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  }, [dropdownOpen, query]);

  // ── Reset on open/close ──
  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setSelected(null);
    setNewRegion('');
    setNewDivision('');
    setNewDesignation('');
    setFile(null);
    setDropdownOpen(false);
    fetchOfficials();
    fetchOptions();
  }, [isOpen]);

  const fetchOfficials = async () => {
    setLoadingOfficials(true);
    try {
      const res = await fetch(apiUrl('/api/third-level/officials-kpi-summary'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setAllOfficials(data.data.filter(o => o.status === 'Active' && o.first_name && o.first_name !== 'VACANT'));
      }
    } catch (err) {
      console.error('[ReassignModal] Failed to fetch officials', err);
    } finally {
      setLoadingOfficials(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const res = await fetch(apiUrl('/api/third-level/positions'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setOptions({
          regions: data.regions || [],
          regionDivisions: data.regionDivisions || {},
          designations: data.designations || []
        });
      }
    } catch (err) {
      console.error('[ReassignModal] Failed to fetch options', err);
    }
  };

  // ── Official search filtering ──
  const filteredOfficials = query.trim().length < 1
    ? []
    : allOfficials.filter(o => {
        const name = fullName(o).toLowerCase();
        const email = (o.email || '').toLowerCase();
        const q = query.toLowerCase();
        return name.includes(q) || email.includes(q);
      }).slice(0, 10);

  const selectOfficial = (o) => {
    setSelected(o);
    setQuery(fullName(o));
    setDropdownOpen(false);
    setNewRegion('');
    setNewDivision('');
    setNewDesignation('');
  };

  // ── Divisions for selected region ──
  const isRegionOrOfficeName = (str) => {
    if (!str) return true;
    const up = String(str).trim().toUpperCase();
    if (newRegion && up === newRegion.trim().toUpperCase()) return true;
    if ((options.regions || []).some(r => r.toUpperCase() === up)) return true;
    return /^REGION\s+/i.test(up) || up === 'REGIONAL OFFICE' || up === 'CENTRAL OFFICE' || up === 'N/A';
  };

  const availableDivisions = (newRegion
    ? (options.regionDivisions[newRegion] || [])
    : []
  ).filter(d => !isRegionOrOfficeName(d));

  // ── Same-assignment guard ──
  const isSameAssignment =
    selected &&
    newRegion &&
    newDivision &&
    newDesignation &&
    newRegion.trim().toUpperCase() === (selected.region || '').trim().toUpperCase() &&
    newDivision.trim().toUpperCase() === (selected.division || '').trim().toUpperCase() &&
    newDesignation.trim().toUpperCase() === (selected.designation || '').trim().toUpperCase();

  const canSubmit =
    selected &&
    newRegion.trim() &&
    newDivision.trim() &&
    newDesignation.trim() &&
    file &&
    !isSameAssignment &&
    !submitting;

  // ── Submit handler ──
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tloId', selected.TLOid);
      formData.append('newRegion', newRegion.trim());
      formData.append('newDivision', newDivision.trim());
      formData.append('newDesignation', newDesignation.trim());

      const reassignRes = await fetch(apiUrl('/api/third-level/reassign-official'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const reassignData = await reassignRes.json();
      if (!reassignRes.ok || !reassignData.success) {
        throw new Error(reassignData.error || 'Reassignment failed');
      }

      await Swal.fire({
        icon: 'success',
        title: 'Official Reassigned',
        text: `${fullName(selected)} has been successfully reassigned to ${newDivision}, ${newRegion}.`,
        confirmButtonColor: '#075985'
      });
      onRefresh();
      onClose();
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Reassignment Failed',
        text: err.message || 'An unexpected error occurred.',
        confirmButtonColor: '#075985'
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(8,49,95,0.72)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-xl flex flex-col rounded-[28px] shadow-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #f0f9ff 0%, #ffffff 60%)',
          border: '2px solid #bae6fd',
          maxHeight: '92vh'
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-7 py-5"
          style={{
            background: 'linear-gradient(135deg, #08315f 0%, #0c4a6e 100%)',
            borderBottom: '1px solid rgba(255,255,255,0.08)'
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.12)' }}
            >
              <FiArrowRight size={18} color="white" />
            </div>
            <div>
              <p className="text-[9px] font-black text-blue-300 uppercase tracking-[0.2em] leading-none mb-0.5">
                Executive Dashboard
              </p>
              <h2 className="text-base font-black text-white leading-none tracking-tight">
                Reassign Official
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            <FiX size={16} color="white" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-7 py-6 space-y-5">

          {/* — Official Search — */}
          <section>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
              Select Official
            </label>
            <div className="relative">
              <FiSearch
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sky-500 pointer-events-none"
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setDropdownOpen(true);
                  if (!e.target.value) setSelected(null);
                }}
                onFocus={() => setDropdownOpen(true)}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                placeholder={loadingOfficials ? 'Loading officials…' : 'Search by name or email…'}
                className="w-full pl-9 pr-4 py-2.5 rounded-[14px] text-[13px] font-semibold text-slate-700 outline-none transition-all"
                style={{
                  background: '#f0f9ff',
                  border: '2px solid #bae6fd',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.04)'
                }}
                disabled={loadingOfficials}
              />
              {dropdownOpen && filteredOfficials.length > 0 && (
                <ul
                  style={{
                    position: 'fixed',
                    top: dropdownPos.top,
                    left: dropdownPos.left,
                    width: dropdownPos.width,
                    zIndex: 99999,
                    border: '2px solid #bae6fd',
                    background: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 10px 30px -5px rgba(8,49,95,0.18)',
                    overflow: 'hidden',
                    maxHeight: '240px',
                    overflowY: 'auto'
                  }}
                >
                  {filteredOfficials.map((o) => (
                    <li
                      key={o.TLOid}
                      onMouseDown={() => selectOfficial(o)}
                      className="flex flex-col px-4 py-3 cursor-pointer transition-colors hover:bg-sky-50 border-b border-slate-50 last:border-0"
                    >
                      <span className="font-black text-[13px] text-slate-800">{fullName(o)}</span>
                      <span className="text-[11px] text-slate-400 font-semibold">
                        {o.position_title || o.designation || '—'} · {o.region || '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {dropdownOpen && query.trim().length > 0 && filteredOfficials.length === 0 && !loadingOfficials && (
                <div
                  style={{
                    position: 'fixed',
                    top: dropdownPos.top,
                    left: dropdownPos.left,
                    width: dropdownPos.width,
                    zIndex: 99999,
                    border: '2px solid #bae6fd',
                    background: 'white',
                    borderRadius: '16px',
                    padding: '12px 16px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#94a3b8'
                  }}
                >
                  No active officials found for "{query}"
                </div>
              )}

            </div>
          </section>

          {/* — Current Assignment (read-only) — */}
          {selected && (
            <section
              className="rounded-[18px] px-5 py-4"
              style={{
                background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                border: '2px solid #bae6fd'
              }}
            >
              <p className="text-[9px] font-black text-sky-600 uppercase tracking-[0.2em] mb-3">
                Current Assignment
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <InfoRow label="Name" value={fullName(selected)} span={2} />
                <InfoRow label="Position" value={selected.position_title || '—'} />
                <InfoRow label="Designation" value={selected.designation || '—'} />
                <InfoRow label="Region" value={selected.region || '—'} />
                <InfoRow label="Division" value={selected.division || '—'} />
              </div>
            </section>
          )}

          {/* — Destination Fields — */}
          {selected && (
            <section>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">
                New Assignment
              </p>
              <div className="space-y-3">
                {/* Region */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    New Region <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={newRegion}
                      onChange={(e) => { setNewRegion(e.target.value); setNewDivision(''); }}
                      className="w-full appearance-none pl-4 pr-8 py-2.5 rounded-[14px] text-[13px] font-semibold text-slate-700 outline-none transition-all"
                      style={{ background: '#f8fafc', border: '2px solid #e2e8f0' }}
                    >
                      <option value="">Select Region…</option>
                      {options.regions.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <FiArrowRight
                      size={12}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90"
                    />
                  </div>
                </div>

                {/* Division */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    New Division <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={newDivision}
                      onChange={(e) => setNewDivision(e.target.value)}
                      disabled={!newRegion}
                      className="w-full appearance-none pl-4 pr-8 py-2.5 rounded-[14px] text-[13px] font-semibold text-slate-700 outline-none transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: '#f8fafc', border: '2px solid #e2e8f0' }}
                    >
                      <option value="">{newRegion ? 'Select Division…' : 'Select a region first…'}</option>
                      {availableDivisions.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <FiArrowRight
                      size={12}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90"
                    />
                  </div>
                </div>

                {/* Designation */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    New Designation <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newDesignation}
                    onChange={(e) => setNewDesignation(e.target.value)}
                    placeholder="e.g. Officer-in-Charge, Division Chief…"
                    className="w-full pl-4 pr-4 py-2.5 rounded-[14px] text-[13px] font-semibold text-slate-700 outline-none transition-all"
                    style={{ background: '#f8fafc', border: '2px solid #e2e8f0' }}
                    list="designation-suggestions-rm"
                  />
                  <datalist id="designation-suggestions-rm">
                    {options.designations.map(d => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Same-assignment guard */}
              {isSameAssignment && (
                <div className="flex items-start gap-2 mt-3 px-4 py-2.5 rounded-[12px] bg-amber-50 border border-amber-200">
                  <FiAlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] font-bold text-amber-700">
                    New assignment is identical to the current one. Please change at least one field.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* — Reassignment Order Upload — */}
          {selected && (
            <section>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Reassignment Order (PDF) <span className="text-rose-400">*</span>
              </label>
              <div
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-[18px] px-5 py-6 cursor-pointer transition-all"
                style={{
                  border: file ? '2px solid #22c55e' : '2px dashed #bae6fd',
                  background: file ? '#f0fdf4' : '#f0f9ff'
                }}
              >
                {file ? (
                  <>
                    <FiCheck size={22} className="text-green-500" />
                    <p className="text-[12px] font-black text-green-700">{file.name}</p>
                    <p className="text-[10px] text-slate-400 font-semibold">
                      {(file.size / 1024).toFixed(1)} KB · Click to change
                    </p>
                  </>
                ) : (
                  <>
                    <FiUploadCloud size={22} className="text-sky-400" />
                    <p className="text-[12px] font-black text-slate-600">Click to upload PDF</p>
                    <p className="text-[10px] text-slate-400 font-semibold">PDF only, max 10 MB</p>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </section>
          )}
        </div>

        {/* ── Footer ── */}
        <div
          className="flex items-center justify-end gap-3 px-7 py-4"
          style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}
        >
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-[14px] text-[12px] font-black text-slate-500 transition-colors"
            style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-6 py-2.5 rounded-[14px] text-[12px] font-black text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #075985 0%, #0c4a6e 100%)',
              boxShadow: canSubmit ? '0 4px 14px rgba(7,89,133,0.35)' : 'none'
            }}
          >
            {submitting ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Reassigning…
              </>
            ) : (
              <>
                <FiCheck size={13} /> Confirm Reassignment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── InfoRow sub-component ──────────────────────────────────────────────────
const InfoRow = ({ label, value, span = 1 }) => (
  <div className={`flex flex-col gap-0.5 ${span === 2 ? 'col-span-2' : ''}`}>
    <span className="text-[9px] font-black text-sky-500 uppercase tracking-widest">{label}</span>
    <span className="text-[12px] font-bold text-slate-700">{value}</span>
  </div>
);

export default ReassignOfficialModal;

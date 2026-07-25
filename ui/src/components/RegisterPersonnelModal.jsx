import React, { useState, useEffect } from 'react';
import { FiX, FiCheck, FiUser, FiMail, FiBriefcase } from 'react-icons/fi';
import Swal from 'sweetalert2';
import { apiUrl } from '../utils/api';

const THIRD_LEVEL_POSITIONS = [
  'Secretary',
  'Undersecretary',
  'Assistant Secretary',
  'Director IV',
  'Director III',
  'Regional Director',
  'Assistant Regional Director',
  'Schools Division Superintendent',
  'Assistant Schools Division Superintendent',
  'RD',
  'ARD',
  'SDS',
  'ASDS'
];

const RegisterPersonnelModal = ({ isOpen, onClose, onSuccess, token }) => {
  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    strand: '',
    region: '',
    office: '',
    division: '',
    position_title: '',
    designation: '',
    email: '',
    alt_email_1: '',
    alt_email_2: '',
    contact_details: '',
    alt_contact_1: '',
    alt_contact_2: ''
  });
  const [positions, setPositions] = useState([]);
  const [options, setOptions] = useState({
    strands: [],
    regions: [],
    offices: [],
    divisions: []
  });
  const [loading, setLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState('idle'); // 'idle' | 'checking' | 'duplicate' | 'valid'

  useEffect(() => {
    if (isOpen) {
      setFormData({
        first_name: '', middle_name: '', last_name: '', 
        strand: '', region: '', office: '', division: '',
        position_title: '', designation: '', email: '', 
        alt_email_1: '', alt_email_2: '', contact_details: '', 
        alt_contact_1: '', alt_contact_2: ''
      });
      setEmailStatus('idle');
      fetchPositions();
    }
  }, [isOpen]);

  const fetchPositions = async () => {
    try {
      const res = await fetch(apiUrl('/api/third-level/positions'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        // Merge fetched distinct positions with standard positions
        const fetchedPositions = data.positions || [];
        const mergedPositions = [...new Set([...THIRD_LEVEL_POSITIONS, ...fetchedPositions])].sort();
        setPositions(mergedPositions);
        
        setOptions({
          strands: data.strands || [],
          regions: data.regions || [],
          offices: data.offices || [],
          divisions: data.divisions || []
        });
      }
    } catch (err) {
      console.error('Failed to fetch positions', err);
    }
  };

  useEffect(() => {
    if (!formData.email) {
      setEmailStatus('idle');
      return;
    }
    const isValidFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
    if (!isValidFormat) {
      setEmailStatus('idle');
      return;
    }

    if (!formData.email.toLowerCase().endsWith('@deped.gov.ph')) {
      setEmailStatus('invalid_domain');
      return;
    }

    const checkDuplicate = async () => {
      setEmailStatus('checking');
      try {
        const res = await fetch(apiUrl(`/api/auth/check-masterlist-email?email=${encodeURIComponent(formData.email.trim())}`));
        if (res.ok) {
          const data = await res.json();
          if (data.inMasterlist) {
            setEmailStatus('duplicate');
          } else {
            setEmailStatus('valid');
          }
        } else {
          setEmailStatus('idle');
        }
      } catch (err) {
        console.error('Duplicate check failed', err);
        setEmailStatus('idle');
      }
    };

    const timer = setTimeout(checkDuplicate, 500);
    return () => clearTimeout(timer);
  }, [formData.email]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const normalizedEmail = formData.email.toLowerCase().trim();
    if (!normalizedEmail.endsWith('@deped.gov.ph')) {
      Swal.fire('Error', 'Only @deped.gov.ph emails are allowed for DepEd Email.', 'error');
      return;
    }
    if (emailStatus === 'duplicate') {
      Swal.fire('Error', 'This email already exists in the masterlist.', 'error');
      return;
    }
    if (!formData.first_name || !formData.last_name || !formData.position_title || !formData.email) {
      Swal.fire('Error', 'Please fill in all required fields.', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/third-level/register-personnel'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire('Success', data.message || 'Personnel registered successfully', 'success');
        onSuccess();
        onClose();
      } else {
        Swal.fire('Error', data.error || 'Failed to register personnel', 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Network error', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-r from-blue-900 to-blue-800 p-6 text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold">Register Third Level Personnel</h2>
            <p className="text-blue-100 text-sm mt-1">Add a new official to the masterlist</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <FiX size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">First Name</label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value.toUpperCase() })}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all uppercase"
                  placeholder="JUAN"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Middle Name</label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={formData.middle_name}
                  onChange={(e) => setFormData({ ...formData, middle_name: e.target.value.toUpperCase() })}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all uppercase"
                  placeholder="SANTOS"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Last Name</label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value.toUpperCase() })}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all uppercase"
                  placeholder="DELA CRUZ"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Designation</label>
              <div className="relative">
                <FiBriefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  placeholder="e.g. OIC-Director"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Position</label>
            <div className="relative">
              <FiBriefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                required
                value={formData.position_title}
                onChange={(e) => setFormData({ ...formData, position_title: e.target.value })}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all appearance-none"
              >
                <option value="" disabled>Select a position...</option>
                {positions.map((pos) => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Strand</label>
              <input
                type="text"
                list="strands-list"
                value={formData.strand}
                onChange={(e) => setFormData({ ...formData, strand: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                placeholder="Select or Type Strand"
              />
              <datalist id="strands-list">
                {options.strands.map((opt, idx) => <option key={idx} value={opt} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Region</label>
              <input
                type="text"
                list="regions-list"
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                placeholder="Select or Type Region"
              />
              <datalist id="regions-list">
                {options.regions.map((opt, idx) => <option key={idx} value={opt} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Office</label>
              <input
                type="text"
                list="offices-list"
                value={formData.office}
                onChange={(e) => setFormData({ ...formData, office: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                placeholder="Select or Type Office"
              />
              <datalist id="offices-list">
                {options.offices.map((opt, idx) => <option key={idx} value={opt} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Division</label>
              <input
                type="text"
                list="divisions-list"
                value={formData.division}
                onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                placeholder="Select or Type Division"
              />
              <datalist id="divisions-list">
                {options.divisions.map((opt, idx) => <option key={idx} value={opt} />)}
              </datalist>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">DepEd Email</label>
            <div className="relative">
              <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full pl-10 pr-10 py-3 bg-slate-50 border rounded-xl font-medium focus:outline-none transition-all ${(emailStatus === 'duplicate' || emailStatus === 'invalid_domain') ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : emailStatus === 'valid' ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500' : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500'}`}
                placeholder="juan.delacruz@deped.gov.ph"
              />
              {emailStatus === 'valid' && (
                <FiCheck className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" size={18} />
              )}
              {emailStatus === 'checking' && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            {emailStatus === 'invalid_domain' && (
              <p className="text-red-500 text-xs font-bold mt-2">Email must end with @deped.gov.ph.</p>
            )}
            {emailStatus === 'duplicate' && (
              <p className="text-red-500 text-xs font-bold mt-2">This email already exists in the masterlist.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Alternative Email 1</label>
              <input
                type="email"
                value={formData.alt_email_1}
                onChange={(e) => setFormData({ ...formData, alt_email_1: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                placeholder="Alt Email 1"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Alternative Email 2</label>
              <input
                type="email"
                value={formData.alt_email_2}
                onChange={(e) => setFormData({ ...formData, alt_email_2: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                placeholder="Alt Email 2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Contact Details</label>
              <input
                type="text"
                value={formData.contact_details}
                onChange={(e) => setFormData({ ...formData, contact_details: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                placeholder="Contact Details"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Alt Contact Details 1</label>
                <input
                  type="text"
                  value={formData.alt_contact_1}
                  onChange={(e) => setFormData({ ...formData, alt_contact_1: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  placeholder="Alt Contact 1"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Alt Contact Details 2</label>
                <input
                  type="text"
                  value={formData.alt_contact_2}
                  onChange={(e) => setFormData({ ...formData, alt_contact_2: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  placeholder="Alt Contact 2"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-white/90 backdrop-blur pb-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || emailStatus === 'duplicate' || emailStatus === 'checking' || emailStatus === 'invalid_domain'}
              className="px-6 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Registering...
                </>
              ) : 'Register Personnel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterPersonnelModal;

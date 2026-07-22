import React, { useState, useEffect } from 'react';
import { FiX, FiCheck, FiUser, FiMail, FiBriefcase } from 'react-icons/fi';
import Swal from 'sweetalert2';
import { apiUrl } from '../utils/api';

const RegisterPersonnelModal = ({ isOpen, onClose, onSuccess, token }) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    position_title: '',
    email: ''
  });
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState('idle'); // 'idle' | 'checking' | 'duplicate' | 'valid'

  useEffect(() => {
    if (isOpen) {
      setFormData({ first_name: '', last_name: '', position_title: '', email: '' });
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
        setPositions(data.positions || []);
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
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-r from-blue-900 to-blue-800 p-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Register Third Level Personnel</h2>
            <p className="text-blue-100 text-sm mt-1">Add a new official to the masterlist</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <FiX size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
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

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">DepEd Email</label>
            <div className="relative">
              <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full pl-10 pr-10 py-3 bg-slate-50 border rounded-xl font-medium focus:outline-none transition-all ${emailStatus === 'duplicate' ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : emailStatus === 'valid' ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500' : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500'}`}
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
            {emailStatus === 'duplicate' && (
              <p className="text-red-500 text-xs font-bold mt-2">This email already exists in the masterlist.</p>
            )}
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || emailStatus === 'duplicate' || emailStatus === 'checking'}
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

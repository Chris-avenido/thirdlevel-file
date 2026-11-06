import React from 'react';
import { FiUser, FiInfo } from 'react-icons/fi';
import { formatContactNumber } from './constants';

const PersonalEmploymentSection = ({
    personalData,
    setPersonalData
}) => {
    const handleChange = (e) => {
        const { name, value } = e.target;
        let finalValue = value;

        if (['surname', 'first_name', 'middle_name'].includes(name)) {
            finalValue = finalValue.toUpperCase();
        }

        if (name === 'date_of_birth' && value) {
            const todayStr = new Date().toISOString().split('T')[0];
            if (value > todayStr) {
                return;
            }
        }

        setPersonalData(prev => ({
            ...prev,
            [name]: finalValue
        }));
    };

    const handleContactChange = (e) => {
        const formatted = formatContactNumber(e.target.value);
        setPersonalData(prev => ({
            ...prev,
            contact_number: formatted
        }));
    };

    return (
        <div className="bg-white border-2 border-slate-200 rounded-[24px] p-6 md:p-8 space-y-6 shadow-sm">
            <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                    <FiUser className="text-[#08315F]" size={20} />
                    <h3 className="text-base font-black text-[#08315F] uppercase tracking-wide">
                        2. Personal Details & Current Employment
                    </h3>
                </div>
                <p className="text-xs font-semibold text-slate-500 mt-1">
                    Official personal identity and current plantilla assignment in accordance with DepEd executive guidelines.
                </p>
            </div>

            {/* ALL CAPS Standard Info Box */}
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/70 flex items-start gap-3">
                <FiInfo size={18} className="text-amber-700 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-900 space-y-0.5">
                    <p className="font-bold">Official DepEd Standard: ALL CAPS</p>
                    <p className="text-amber-800">
                        Please type your surname, first name, and middle name in <strong>ALL CAPITAL LETTERS</strong> as required by DepEd guidelines.
                    </p>
                </div>
            </div>

            {/* Name Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                        Surname [ALL CAPS] <span className="text-rose-500">*</span>
                    </label>
                    <input
                        type="text"
                        name="surname"
                        value={personalData.surname || ''}
                        onChange={handleChange}
                        placeholder="DELA CRUZ"
                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-[#08315F] outline-none text-xs font-bold text-slate-900 bg-white uppercase transition-all shadow-sm"
                        required
                    />
                </div>

                <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                        First Name [ALL CAPS] <span className="text-rose-500">*</span>
                    </label>
                    <input
                        type="text"
                        name="first_name"
                        value={personalData.first_name || ''}
                        onChange={handleChange}
                        placeholder="JUAN"
                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-[#08315F] outline-none text-xs font-bold text-slate-900 bg-white uppercase transition-all shadow-sm"
                        required
                    />
                </div>

                <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                        Middle Name [ALL CAPS]
                    </label>
                    <input
                        type="text"
                        name="middle_name"
                        value={personalData.middle_name || ''}
                        onChange={handleChange}
                        placeholder="SANTOS"
                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-[#08315F] outline-none text-xs font-bold text-slate-900 bg-white uppercase transition-all shadow-sm"
                    />
                </div>
            </div>

            {/* Date of Birth & Telephone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                        Date of Birth
                    </label>
                    <input
                        type="date"
                        name="date_of_birth"
                        max={new Date().toISOString().split('T')[0]}
                        value={personalData.date_of_birth || ''}
                        onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-[#08315F] outline-none text-xs font-bold text-slate-900 bg-white shadow-sm"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">Cannot be a future date</span>
                </div>

                <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                        Telephone / Contact Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                        type="tel"
                        name="contact_number"
                        value={personalData.contact_number || ''}
                        onChange={handleContactChange}
                        placeholder="0917-123-4567"
                        maxLength={13}
                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-[#08315F] outline-none text-xs font-bold text-slate-900 bg-white shadow-sm font-mono tracking-wide"
                        required
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">11 digits (formatted with dashes)</span>
                </div>
            </div>

            {/* Current Position & Plantilla Office */}
            <div className="space-y-4 pt-2">
                <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                        What is your current position? <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-500 block mb-2 font-medium">
                        [For other positions, do not abbreviate. e.g. Education Program Supervisor, Public Schools District Supervisor]
                    </span>
                    <input
                        type="text"
                        name="current_position"
                        value={personalData.current_position || ''}
                        onChange={handleChange}
                        placeholder="e.g. Chief Education Supervisor"
                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-[#08315F] outline-none text-xs font-bold text-slate-900 bg-white shadow-sm"
                        required
                    />
                </div>

                <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                        In what Schools Division Office or Regional Office does your plantilla item belong to? <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-500 block mb-2 font-medium">
                        [i.e. SDO-Pasig City; SDO-Cebu City; Regional Office; For non-DepEd, include Agency and Office Assignment]
                    </span>
                    <input
                        type="text"
                        name="plantilla_office"
                        value={personalData.plantilla_office || ''}
                        onChange={handleChange}
                        placeholder="e.g. SDO-Pasig City or Regional Office IV-A"
                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-[#08315F] outline-none text-xs font-bold text-slate-900 bg-white shadow-sm"
                        required
                    />
                </div>
            </div>
        </div>
    );
};

export default PersonalEmploymentSection;


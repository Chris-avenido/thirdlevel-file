import React, { useState, useEffect } from 'react';
import { FiCalendar, FiAlertCircle } from 'react-icons/fi';

const YearInput = ({ 
    value, 
    onChange, 
    min = 1900, 
    max = new Date().getFullYear(),
    placeholder = "YYYY",
    required = false,
    label = "",
    errorText = ""
}) => {
    const [inputValue, setInputValue] = useState(value || '');
    const [error, setError] = useState('');

    useEffect(() => {
        setInputValue(value || '');
        if (value) validate(value);
    }, [value, min, max]);

    const validate = (val) => {
        if (!val && required) {
            setError('This field is required');
            return false;
        }
        if (!val) {
            setError('');
            return true;
        }
        
        const num = parseInt(val, 10);
        if (isNaN(num)) {
            setError('Please enter a valid year');
            return false;
        }
        if (num < min || num > max) {
            setError(`Year must be between ${min} and ${max}`);
            return false;
        }
        setError('');
        return true;
    };

    const handleChange = (e) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
        setInputValue(val);
        validate(val);
        onChange(val);
    };

    const handleBlur = () => {
        validate(inputValue);
    };

    return (
        <div className="w-full">
            <div className="relative group">
                <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={inputValue}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder={placeholder}
                    className={`w-full bg-white border ${error || errorText ? 'border-red-400 focus:border-red-500' : 'border-slate-200 focus:border-[#08315F]'} rounded-xl py-2 pl-10 pr-3 text-sm text-slate-800 focus:outline-none transition-all shadow-sm`}
                />
                {(error || errorText) && (
                    <FiAlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500" />
                )}
            </div>
            {(error || errorText) && (
                <p className="text-red-500 text-[10px] mt-1 ml-1 font-medium">{error || errorText}</p>
            )}
            {!(error || errorText) && (
                <p className="text-slate-400 text-[10px] mt-1 ml-1 font-medium">Enter a year between {min} and {max}</p>
            )}
        </div>
    );
};

export default YearInput;

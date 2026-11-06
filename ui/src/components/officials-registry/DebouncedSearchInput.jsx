import { useState, useEffect } from 'react';

const DebouncedSearchInput = ({ value, onChange, placeholder }) => {
    const [local, setLocal] = useState(value);

    useEffect(() => {
        setLocal(value);
    }, [value]);

    useEffect(() => {
        const timer = setTimeout(() => {
            onChange(local);
        }, 300);
        return () => clearTimeout(timer);
    }, [local, onChange]);

    return (
        <input
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            className="w-full bg-white border-2 border-slate-200 focus:border-[#08315F]/20 rounded-2xl py-4 pl-11 pr-5 text-[21px] font-bold text-slate-700 placeholder:text-slate-400 outline-none transition-all"
        />
    );
};


export default DebouncedSearchInput;

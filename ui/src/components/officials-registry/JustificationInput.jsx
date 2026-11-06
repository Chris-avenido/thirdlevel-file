import { useState, useEffect } from 'react';

const JustificationInput = ({ value, onChange, placeholder }) => {
    const [local, setLocal] = useState(value);

    useEffect(() => {
        setLocal(value);
    }, [value]);

    return (
        <textarea
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => onChange(local)}
            placeholder={placeholder}
            rows={4}
            className="w-full bg-white border-2 border-slate-200 focus:border-brand-800/20 rounded-2xl py-4 px-5 text-[21px] font-bold text-slate-700 placeholder:text-slate-400 outline-none transition-all resize-none"
        />
    );
};


export default JustificationInput;

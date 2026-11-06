import React from 'react';
import { FiEdit3 } from 'react-icons/fi';
import { APPLICANT_EXAM_DATA } from '../../constants/applicantExamQuestions';

const ExamPartBEssays = ({ partBAnswers, setPartBAnswers }) => {
    const handleEssayChange = (essayId, text) => {
        setPartBAnswers(prev => ({
            ...prev,
            [essayId]: text
        }));
    };

    return (
        <div className="bg-white border-2 border-[#08315F] rounded-[24px] p-6 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-3">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0038A8]">
                    Assessment • Part B
                </span>
                <h3 className="text-base font-black text-[#08315F] mt-0.5">
                    Executive Decision Essays
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1">
                    Provide detailed, structured responses demonstrating strategic perspective and leadership acumen.
                </p>
            </div>

            <div className="space-y-6">
                {APPLICANT_EXAM_DATA.essays.map((essay) => (
                    <div key={essay.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                        <div className="flex items-center gap-2">
                            <FiEdit3 className="text-[#08315F]" size={14} />
                            <span className="text-xs font-black text-[#08315F] uppercase">
                                {essay.title}
                            </span>
                        </div>
                        <p className="text-xs text-slate-700 font-semibold leading-relaxed">
                            {essay.prompt}
                        </p>
                        <textarea
                            rows={4}
                            value={partBAnswers[essay.id] || ''}
                            onChange={(e) => handleEssayChange(essay.id, e.target.value)}
                            placeholder="Type your response here..."
                            className="w-full bg-white p-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#08315F] outline-none transition-colors resize-y"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ExamPartBEssays;


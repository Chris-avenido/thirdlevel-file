import { FiInfo } from 'react-icons/fi';
import ModernDatePicker from '../ModernDatePicker';
import { inp } from './constants';
import { Field, SectionLabel } from './formParts';

const PerformanceTab = ({ isEditing, profile, setP, tab }) => {
  return (
    <>
                                                {tab === 'performance' && (
                                                    <div className="space-y-6">
                                                        {/* Performance Section */}
                                                        <div className="bg-white border-2 border-[#08315F] rounded-[22px] p-8 shadow-none space-y-6">
                                                            <SectionLabel color="#0038A8">IPCRF / OPCRF</SectionLabel>

                                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                                                {/* Rating 1 */}
                                                                <div className="p-6 bg-[#08315F]/5 rounded-[2rem] border-2 border-[#0038A8]/10 space-y-4">
                                                                    <p className="text-[15px] font-black text-[#08315F] uppercase tracking-widest">Latest Rating (1st)</p>
                                                                    <div className="space-y-3">
                                                                        <Field label="Rating (Max 5.000)">
                                                                            <input disabled={!isEditing} type="number" step="0.001" min="1.0" max="5.0" value={profile.performance_rating_1} onChange={e => { let v = e.target.value; if (v !== '' && Number(v) > 5) v = '5.0'; setP('performance_rating_1', v); }} onBlur={e => { let v = e.target.value; if (v !== '') { let n = Number(v); if (n > 5) n = 5; if (n < 1) n = 1; setP('performance_rating_1', n.toString()); } }} placeholder="4.850" className={inp} />
                                                                        </Field>
                                                                        <Field label="Rating Period">
                                                                            <div className="relative">
                                                                                <ModernDatePicker disabled={!isEditing} isMonthPicker value={profile.performance_rating_1_period} onChange={val => setP('performance_rating_1_period', val)} maxDate={new Date()} minDate={profile.performance_rating_2_period ? new Date(profile.performance_rating_2_period + "-01") : undefined} className={inp} />

                                                                            </div>
                                                                        </Field>
                                                                    </div>
                                                                </div>

                                                                {/* Rating 2 */}
                                                                <div className="p-6 bg-[#08315F]/5 rounded-[2rem] border-2 border-[#0038A8]/10 space-y-4">
                                                                    <p className="text-[15px] font-black text-[#08315F] uppercase tracking-widest">Previous Rating (2nd)</p>
                                                                    <div className="space-y-3">
                                                                        <Field label="Rating (Max 5.000)">
                                                                            <input disabled={!isEditing} type="number" step="0.001" min="1.0" max="5.0" value={profile.performance_rating_2} onChange={e => { let v = e.target.value; if (v !== '' && Number(v) > 5) v = '5.0'; setP('performance_rating_2', v); }} onBlur={e => { let v = e.target.value; if (v !== '') { let n = Number(v); if (n > 5) n = 5; if (n < 1) n = 1; setP('performance_rating_2', n.toString()); } }} placeholder="4.750" className={inp} />
                                                                        </Field>
                                                                        <Field label="Rating Period">
                                                                            <div className="relative">
                                                                                <ModernDatePicker disabled={!isEditing} isMonthPicker value={profile.performance_rating_2_period} onChange={val => setP('performance_rating_2_period', val)} maxDate={profile.performance_rating_1_period ? new Date(profile.performance_rating_1_period + "-01") : new Date()} minDate={profile.performance_rating_3_period ? new Date(profile.performance_rating_3_period + "-01") : undefined} className={inp} />

                                                                            </div>
                                                                        </Field>
                                                                    </div>
                                                                </div>

                                                                {/* Rating 3 */}
                                                                <div className="p-6 bg-[#08315F]/5 rounded-[2rem] border-2 border-[#0038A8]/10 space-y-4">
                                                                    <p className="text-[15px] font-black text-[#08315F] uppercase tracking-widest">Oldest Rating (3rd)</p>
                                                                    <div className="space-y-3">
                                                                        <Field label="Rating (Max 5.000)">
                                                                            <input disabled={!isEditing} type="number" step="0.001" min="1.0" max="5.0" value={profile.performance_rating_3} onChange={e => { let v = e.target.value; if (v !== '' && Number(v) > 5) v = '5.0'; setP('performance_rating_3', v); }} onBlur={e => { let v = e.target.value; if (v !== '') { let n = Number(v); if (n > 5) n = 5; if (n < 1) n = 1; setP('performance_rating_3', n.toString()); } }} placeholder="4.650" className={inp} />
                                                                        </Field>
                                                                        <Field label="Rating Period">
                                                                            <div className="relative">
                                                                                <ModernDatePicker disabled={!isEditing} isMonthPicker value={profile.performance_rating_3_period} onChange={val => setP('performance_rating_3_period', val)} maxDate={profile.performance_rating_2_period ? new Date(profile.performance_rating_2_period + "-01") : new Date()} className={inp} />

                                                                            </div>
                                                                        </Field>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="p-6 bg-[#F4F8FB]/30 rounded-[2rem] border-2 border-blue-100 space-y-5">
                                                                <div className="flex items-center gap-3">
                                                                    <p className="text-[15px] font-black text-[#075985] uppercase tracking-widest">CESPES Rating</p>
                                                                    <span className="text-[13.5px] font-bold text-blue-400 italic flex items-center gap-1"><FiInfo size={14} /> Career Executive Service Performance Evaluation System</span>
                                                                </div>

                                                                {/* 1st Semester */}
                                                                <div className="space-y-3">
                                                                    <p className="text-[13.5px] font-black text-slate-500 uppercase tracking-widest">1st Semester</p>
                                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                                        <Field label="CESPES Rating (1st)">
                                                                            <input disabled={!isEditing}
                                                                                type="number"
                                                                                step="0.01"
                                                                                min="1.0"
                                                                                max="5.0"
                                                                                value={profile.cespes_1_rating}
                                                                                onChange={e => { let v = e.target.value; if (v !== '' && Number(v) > 5) v = '5.0'; setP('cespes_1_rating', v); }}
                                                                                onBlur={e => { let v = e.target.value; if (v !== '') { let n = Number(v); if (n > 5) n = 5; if (n < 1) n = 1; setP('cespes_1_rating', n.toString()); } }}
                                                                                placeholder="0.00"
                                                                                className={inp}
                                                                            />
                                                                        </Field>
                                                                        <Field label="Period (1st)">
                                                                            <div className="relative">
                                                                                <ModernDatePicker disabled={!isEditing}
                                                                                    isMonthPicker
                                                                                    value={profile.cespes_rating_1_period}
                                                                                    onChange={val => setP('cespes_rating_1_period', val)}
                                                                                    maxDate={profile.cespes_rating_2_period ? new Date(profile.cespes_rating_2_period + "-01") : new Date()}
                                                                                    className={`${inp} pr-10`}
                                                                                />
                                                                            </div>
                                                                        </Field>
                                                                    </div>
                                                                </div>

                                                                {/* 2nd Semester */}
                                                                <div className="space-y-3">
                                                                    <p className="text-[13.5px] font-black text-slate-500 uppercase tracking-widest">2nd Semester</p>
                                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                                        <Field label="CESPES Rating (2nd)">
                                                                            <input disabled={!isEditing}
                                                                                type="number"
                                                                                step="0.01"
                                                                                min="1.0"
                                                                                max="5.0"
                                                                                value={profile.cespes_2_rating}
                                                                                onChange={e => { let v = e.target.value; if (v !== '' && Number(v) > 5) v = '5.0'; setP('cespes_2_rating', v); }}
                                                                                onBlur={e => { let v = e.target.value; if (v !== '') { let n = Number(v); if (n > 5) n = 5; if (n < 1) n = 1; setP('cespes_2_rating', n.toString()); } }}
                                                                                placeholder="0.00"
                                                                                className={inp}
                                                                            />
                                                                        </Field>
                                                                        <Field label="Period (2nd)">
                                                                            <div className="relative">
                                                                                <ModernDatePicker disabled={!isEditing}
                                                                                    isMonthPicker
                                                                                    value={profile.cespes_rating_2_period}
                                                                                    onChange={val => setP('cespes_rating_2_period', val)}
                                                                                    maxDate={new Date()}
                                                                                    minDate={profile.cespes_rating_1_period ? new Date(profile.cespes_rating_1_period + "-01") : undefined}
                                                                                    className={`${inp} pr-10`}
                                                                                />
                                                                            </div>
                                                                        </Field>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
    </>
  );
};

export default PerformanceTab;

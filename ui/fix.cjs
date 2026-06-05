const fs = require('fs');
let code = fs.readFileSync('src/pages/OfficialProfiling.jsx', 'utf8');

code = code.replace(/<FiCalendar[\s\S]*?\/>/g, (match) => {
    // Only remove the ones that have absolute right-x top-1/2
    if (match.includes('absolute right-') && match.includes('-translate-y-1/2')) {
        return '';
    }
    return match;
});

code = code.replace(/<input type=\"month\" value=\{profile.performance_rating_1_period\} onChange=\{e => setP\('performance_rating_1_period', e\.target\.value\)\} className=\{\`\$\{inp\} pr-10\`\} \/>/g, 
    '<ModernDatePicker isMonthPicker value={profile.performance_rating_1_period} onChange={val => setP(\'performance_rating_1_period\', val)} className={inp} />');
    
code = code.replace(/<input type=\"month\" value=\{profile.performance_rating_2_period\} onChange=\{e => setP\('performance_rating_2_period', e\.target\.value\)\} className=\{\`\$\{inp\} pr-10\`\} \/>/g, 
    '<ModernDatePicker isMonthPicker value={profile.performance_rating_2_period} onChange={val => setP(\'performance_rating_2_period\', val)} className={inp} />');
    
code = code.replace(/<input type=\"month\" value=\{profile.cespes_rating_1_period\} onChange=\{e => setP\('cespes_rating_1_period', e\.target\.value\)\} className=\{\`\$\{inp\} pr-10\`\} \/>/g, 
    '<ModernDatePicker isMonthPicker value={profile.cespes_rating_1_period} onChange={val => setP(\'cespes_rating_1_period\', val)} className={inp} />');

code = code.replace(/<input type=\"month\" value=\{profile.cespes_rating_2_period\} onChange=\{e => setP\('cespes_rating_2_period', e\.target\.value\)\} className=\{\`\$\{inp\} pr-10\`\} \/>/g, 
    '<ModernDatePicker isMonthPicker value={profile.cespes_rating_2_period} onChange={val => setP(\'cespes_rating_2_period\', val)} className={inp} />');

fs.writeFileSync('src/pages/OfficialProfiling.jsx', code);

import fs from 'fs';
import path from 'path';

const filePath = path.join('e:', 'christop', 'staging', 'ui', 'src', 'pages', 'OfficialsRegistry.jsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
    if (line.includes('onClick') || line.includes('Link') || line.includes('navigate') || line.includes('href')) {
        if (line.includes('item') || line.includes('official') || line.includes('row') || line.includes('profile')) {
            console.log(`${index + 1}: ${line.trim()}`);
        }
    }
});

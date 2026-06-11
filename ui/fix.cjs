const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace the class names with exact hex codes to guarantee rendering
    content = content.replace(/insight-navy/g, '[#08315F]');
    content = content.replace(/insight-blue/g, '[#075985]');
    content = content.replace(/insight-gold/g, '[#FBBF24]');
    
    // Add the logo to NexusGate.jsx if it's that file
    if (filePath.includes('NexusGate.jsx')) {
        const target = '<h1 className="text-4xl font-heading font-black text-[#08315F] tracking-tight text-left leading-tight">';
        const replacement = '<img src={logo} alt="InsightED Logo" className="h-16 w-auto mb-6" />\n                        <h1 className="text-4xl font-heading font-black text-[#08315F] tracking-tight text-left leading-tight">';
        content = content.replace(target, replacement);
    }
    
    fs.writeFileSync(filePath, content);
    console.log('Fixed', filePath);
}

fixFile('e:/christop/staging/ui/src/pages/NexusGate.jsx');
fixFile('e:/christop/staging/ui/src/pages/Gate.jsx');

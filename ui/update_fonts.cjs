const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.jsx') || file.endsWith('.css')) results.push(file);
        }
    });
    return results;
}

const files = walk('e:/christop/staging/ui/src');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    if (file.endsWith('.css')) {
        if (content.includes('Quicksand')) {
            content = content.replace(/family=Quicksand[^\&]*\&/g, 'family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&');
            content = content.replace(/"Quicksand"/g, '"Plus Jakarta Sans"');
            content = content.replace(/Quicksand/g, 'Plus Jakarta Sans');
            changed = true;
        }
    }

    if (file.endsWith('.jsx')) {
        if (content.includes('Quicksand')) {
            content = content.replace(/font-\['Quicksand'\]/g, "font-['Plus_Jakarta_Sans']");
            content = content.replace(/font-\['Quicksand',system-ui,sans-serif\]/g, "font-['Plus_Jakarta_Sans',system-ui,sans-serif]");
            content = content.replace(/'Quicksand'/g, "'Plus_Jakarta_Sans'");
            content = content.replace(/"Quicksand"/g, "'Plus_Jakarta_Sans'");
            changed = true;
        }
    }

    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated', file);
    }
});

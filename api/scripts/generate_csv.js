import pool from './api/src/config/db.js';
import fs from 'fs';
import path from 'path';

async function generateCSV() {
    try {
        const client = await pool.connect();
        const res = await client.query('SELECT * FROM third_level_official_masterlist ORDER BY "TLOid" ASC');
        const rows = res.rows;
        
        let csvContent = "TLO_id,Strand,Region,Office,Division,Name,Position,Designation,Email,Alternative Email 1,Alternative Email 2,Contact Details,Alternative Contact Details 1,Alternative Contact Details 2\n";
        
        for (const row of rows) {
            const escapeCsv = (str) => {
                if (str === null || str === undefined) return '';
                const s = String(str).trim();
                if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                    return '"' + s.replace(/"/g, '""') + '"';
                }
                return s;
            };

            const tloId = escapeCsv(row.TLOid);
            const strand = escapeCsv(row.strand);
            const region = escapeCsv(row.region);
            const office = escapeCsv(row.office);
            const division = escapeCsv(row.division);
            const name = escapeCsv(row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : row.first_name || '');
            const position = escapeCsv(row.position_title);
            const designation = escapeCsv(row.designation);
            const email = escapeCsv(row.email);
            const altEmail1 = escapeCsv(row.alt_email_1);
            const altEmail2 = escapeCsv(row.alt_email_2);
            const contactDetails = escapeCsv(row.contact_details);
            const altContact1 = escapeCsv(row.alt_contact_1);
            const altContact2 = escapeCsv(row.alt_contact_2);
            
            csvContent += `${tloId},${strand},${region},${office},${division},${name},${position},${designation},${email},${altEmail1},${altEmail2},${contactDetails},${altContact1},${altContact2}\n`;
        }

        fs.writeFileSync(path.join(process.cwd(), 'ui', 'src', 'assets', 'layout_exported_v2.csv'), csvContent);
        console.log("Exported layout_exported_v2.csv successfully!");
        client.release();
        process.exit(0);
    } catch (err) {
        console.error("Export failed", err);
        process.exit(1);
    }
}

generateCSV();

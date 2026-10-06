import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as XLSX from 'xlsx';

const execFileAsync = promisify(execFile);

export async function parsePdsDocument(fileBuffer, originalName = 'document.pdf') {
    const isPdf = originalName.toLowerCase().endsWith('.pdf') || (fileBuffer && fileBuffer.slice(0, 4).toString() === '%PDF');
    
    if (isPdf) {
        // Run Python PDS extractor with PyMuPDF and Windows OCR
        const tempDir = os.tmpdir();
        const tempPdfPath = path.join(tempDir, `pds_upload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.pdf`);
        fs.writeFileSync(tempPdfPath, fileBuffer);

        try {
            const scriptPath = path.join(process.cwd(), 'src', 'utils', 'pds_extractor.py');
            const { stdout } = await execFileAsync('python', [scriptPath, tempPdfPath], {
                timeout: 30000,
                maxBuffer: 10 * 1024 * 1024,
                windowsHide: true
            });
            const parsed = JSON.parse(stdout);
            return parsed;
        } catch (err) {
            console.error('[PDS PDF Parser Error]:', err.message);
            return { success: false, error: err.message, data: null };
        } finally {
            if (fs.existsSync(tempPdfPath)) {
                try { fs.unlinkSync(tempPdfPath); } catch (_) {}
            }
        }
    } else {
        // Handle Excel / CSV PDS
        try {
            const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true, raw: false, defval: '' });
            // If we have an Excel PDS workbook, parse sheets
            // We can return standard structure
            return { success: true, isExcel: true, data: null };
        } catch (err) {
            return { success: false, error: err.message, data: null };
        }
    }
}

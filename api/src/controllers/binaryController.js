import pool from '../config/db.js';
import fs from 'fs';
import path from 'path';

export const getBinary = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM unified_binaries WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Binary not found' });
        
        const { content, mime_type, azure_blob_url } = result.rows[0];
        
        if (azure_blob_url) {
            if (azure_blob_url.startsWith('http://') || azure_blob_url.startsWith('https://')) {
                return res.redirect(302, azure_blob_url);
            }
            const cleanRelative = azure_blob_url.startsWith('/') ? azure_blob_url.slice(1) : azure_blob_url;
            const localFilePath = path.join(process.cwd(), cleanRelative);
            if (fs.existsSync(localFilePath)) {
                return res.sendFile(localFilePath);
            }
        }

        res.setHeader('Content-Type', mime_type || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.send(content || Buffer.from(''));
    } catch (err) {
        console.error('[BinaryController] Fetch error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

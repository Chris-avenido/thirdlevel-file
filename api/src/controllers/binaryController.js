import pool from '../config/db.js';

export const getBinary = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT content, mime_type, azure_blob_url FROM unified_binaries WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Binary not found' });
        
        const { content, mime_type, azure_blob_url } = result.rows[0];
        
        if (azure_blob_url) {
            return res.redirect(302, azure_blob_url);
        }

        res.setHeader('Content-Type', mime_type);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.send(content);
    } catch (err) {
        console.error('[BinaryController] Fetch error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

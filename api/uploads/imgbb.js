// api/uploads/imgbb.js
import { getDb } from '../_db.js';
import { requireAuth, corsHeaders } from '../_auth.js';

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const user = requireAuth(req, res);
  if (!user) return;

  const API_KEY = process.env.IMGBB_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'IMGBB_API_KEY is not configured in Vercel environment variables.' });

  try {
    const { files, entity_type, entity_id } = req.body || {};
    if (!files?.length) return res.status(400).json({ error: 'No files provided.' });
    if (files.length > 10) return res.status(400).json({ error: 'Maximum 10 files per upload.' });

    const MAX_BYTES = 10 * 1024 * 1024;
    const uploaded  = [];
    const sql = getDb();

    for (const file of files) {
      if (!file.data) return res.status(400).json({ error: `File "${file.name}" is missing base64 data.` });

      const byteLen = Math.ceil(file.data.length * 0.75);
      if (byteLen > MAX_BYTES) return res.status(400).json({ error: `File "${file.name}" exceeds the 10 MB limit.` });

      // Upload to ImgBB
      const form = new URLSearchParams();
      form.append('key',   API_KEY);
      form.append('image', file.data);
      form.append('name',  file.name.replace(/\.[^.]+$/, '').slice(0, 60));

      const imgRes = await fetch('https://api.imgbb.com/1/upload', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    form.toString(),
      });

      const imgData = await imgRes.json();
      if (!imgData.success) {
        return res.status(502).json({ error: `ImgBB rejected "${file.name}": ${imgData?.error?.message ?? 'unknown error'}` });
      }

      const url       = imgData.data.url;
      const thumb_url = imgData.data.thumb?.url ?? null;
      const delete_url = imgData.data.delete_url ?? null;

      // Persist to DB
      let dbId = null;
      try {
        const [row] = await sql`
          INSERT INTO media_uploads
            (uploaded_by, entity_type, entity_id, file_name, file_type, file_size, cdn_url, thumb_url, delete_url)
          VALUES
            (${user.sub}, ${entity_type || null}, ${entity_id || null},
             ${file.name}, ${file.type || 'image/jpeg'}, ${file.size || 0},
             ${url}, ${thumb_url}, ${delete_url})
          RETURNING id`;
        dbId = row?.id ?? null;
      } catch (dbErr) {
        console.warn('DB insert for media failed (non-fatal):', dbErr.message);
      }

      uploaded.push({ id: dbId, name: file.name, url, thumb_url, type: file.type });
    }

    return res.status(200).json({ uploaded, count: uploaded.length });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
}

// api/permissions/index.js
import { getDb } from '../_db.js';
import { requireAuth, corsHeaders } from '../_auth.js';

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = requireAuth(req, res);
  if (!user) return;

  if (user.role !== 'superuser') return res.status(403).json({ error: 'Superuser access required' });

  const sql = getDb();

  if (req.method === 'GET') {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: 'userId required' });
      const permissions = await sql`SELECT * FROM user_permissions WHERE user_id = ${userId}`;
      return res.status(200).json({ permissions });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  if (req.method === 'PUT') {
    try {
      const { userId, permissions } = req.body || {};
      if (!userId || !permissions) return res.status(400).json({ error: 'userId and permissions required' });

      for (const [module, access_level] of Object.entries(permissions)) {
        // Cast to string in JS — no TypeScript "as" allowed in .js files
        const level = String(access_level);
        await sql`
          INSERT INTO user_permissions (user_id, module, access_level, granted_by, updated_at)
          VALUES (${userId}, ${module}, ${level}, ${user.sub}, NOW())
          ON CONFLICT (user_id, module) DO UPDATE
            SET access_level = EXCLUDED.access_level,
                granted_by   = EXCLUDED.granted_by,
                updated_at   = NOW()`;
      }

      await sql`
        INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, details)
        VALUES (
          ${user.sub}, ${user.full_name}, 'UPDATE_PERMISSIONS',
          'users', ${userId}, ${JSON.stringify(permissions)}
        )`;
      return res.status(200).json({ message: 'Permissions updated' });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

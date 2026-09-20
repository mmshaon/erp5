// api/auth/me.js
import { getDb } from '../_db.js';
import { requireAuth, corsHeaders } from '../_auth.js';

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const payload = requireAuth(req, res);
  if (!payload) return;

  try {
    const sql = getDb();
    const [user] = await sql`SELECT id, username, email, full_name, role, department FROM users WHERE id = ${payload.sub} AND is_active = true`;
    if (!user) return res.status(401).json({ error: 'User not found or deactivated.' });

    const permissions = await sql`SELECT module, access_level FROM user_permissions WHERE user_id = ${user.id}`;
    const permMap = {};
    permissions.forEach(p => { permMap[p.module] = p.access_level; });

    return res.status(200).json({ user: { ...user, permissions: permMap } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

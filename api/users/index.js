// api/users/index.js
import { getDb } from '../_db.js';
import { requireAuth, hashPassword, corsHeaders } from '../_auth.js';

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = requireAuth(req, res);
  if (!user) return;

  const sql = getDb();

  if (req.method === 'GET') {
    if (user.role !== 'superuser' && user.permissions?.users !== 'superuser') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    try {
      const users = await sql`
        SELECT id, username, email, full_name, role, department,
               is_active, created_at, last_login
        FROM users ORDER BY created_at DESC
      `;
      return res.status(200).json({ users });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    if (user.role !== 'superuser') return res.status(403).json({ error: 'Superuser only' });
    try {
      const { username, email, full_name, password, role, department } = req.body || {};
      if (!username || !email || !full_name || !password) {
        return res.status(400).json({ error: 'username, email, full_name and password are required' });
      }
      if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

      const [newUser] = await sql`
        INSERT INTO users (username, email, password_hash, full_name, role, department, created_by)
        VALUES (${username.trim()}, ${email.trim()}, ${hashPassword(password)},
                ${full_name.trim()}, ${role || 'staff'}, ${department?.trim() || null}, ${user.sub})
        RETURNING id, username, email, full_name, role, department, is_active, created_at, last_login
      `;

      const modules = ['finance','users','bookings','content','reports','media','settings'];
      for (const mod of modules) {
        await sql`
          INSERT INTO user_permissions (user_id, module, access_level, granted_by)
          VALUES (${newUser.id}, ${mod}, 'none', ${user.sub})
          ON CONFLICT (user_id, module) DO NOTHING
        `;
      }

      await sql`
        INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id)
        VALUES (${user.sub}, ${user.full_name}, 'CREATE_USER', 'users', ${newUser.id})
      `;

      return res.status(201).json({ user: newUser });
    } catch (err) {
      console.error(err);
      if (err.message?.includes('unique')) {
        return res.status(409).json({ error: 'Username or email already exists.' });
      }
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

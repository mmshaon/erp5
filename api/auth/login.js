// api/auth/login.js
import { getDb } from '../_db.js';
import { signJWT, hashPassword, corsHeaders } from '../_auth.js';

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { username, password } = req.body || {};
    if (!username?.trim() || !password?.trim()) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const sql    = getDb();
    const hashed = hashPassword(password);

    const users = await sql`
      SELECT id, username, email, full_name, role, department, is_active
      FROM users
      WHERE (LOWER(username) = LOWER(${username.trim()}) OR LOWER(email) = LOWER(${username.trim()}))
        AND password_hash = ${hashed}
        AND is_active = true
      LIMIT 1`;

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = users[0];
    const permissions = await sql`SELECT module, access_level FROM user_permissions WHERE user_id = ${user.id}`;
    const permMap = {};
    permissions.forEach(p => { permMap[p.module] = p.access_level; });

    await sql`UPDATE users SET last_login = NOW() WHERE id = ${user.id}`;

    const token = signJWT({
      sub:         user.id,
      username:    user.username,
      full_name:   user.full_name,
      role:        user.role,
      permissions: permMap,
    });

    return res.status(200).json({
      token,
      user: {
        id:          user.id,
        username:    user.username,
        email:       user.email,
        full_name:   user.full_name,
        role:        user.role,
        department:  user.department,
        permissions: permMap,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

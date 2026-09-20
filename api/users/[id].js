// api/users/[id].js
import { getDb } from '../_db.js';
import { requireAuth, hashPassword, corsHeaders } from '../_auth.js';

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = requireAuth(req, res);
  if (!user) return;

  if (user.role !== 'superuser') return res.status(403).json({ error: 'Superuser only' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'User ID required' });

  if (req.method === 'PATCH') {
    try {
      const sql = getDb();
      const { is_active, role, department, full_name, email, password } = req.body || {};

      // Build dynamic update — only change fields that were sent
      const updates = [];
      const values  = [];

      if (full_name  !== undefined) { updates.push('full_name');    values.push(full_name); }
      if (email      !== undefined) { updates.push('email');        values.push(email); }
      if (is_active  !== undefined) { updates.push('is_active');    values.push(is_active); }
      if (role       !== undefined) { updates.push('role');         values.push(role); }
      if (department !== undefined) { updates.push('department');   values.push(department || null); }
      if (password   && password.trim()) {
        updates.push('password_hash');
        values.push(hashPassword(password.trim()));
      }

      if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

      // NeonDB tagged template doesn't support dynamic columns directly,
      // so we build raw SQL carefully using parameterised values
      const setClauses = updates.map((col, i) => `${col} = $${i + 1}`).join(', ');
      values.push(id); // last param = WHERE id

      const result = await sql(
        `UPDATE users SET ${setClauses}, updated_at = NOW() WHERE id = $${values.length} RETURNING id, username, full_name, email, role, department, is_active`,
        values
      );

      if (!result || result.length === 0) return res.status(404).json({ error: 'User not found' });

      await sql`
        INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id)
        VALUES (${user.sub}, ${user.full_name}, 'UPDATE_USER', 'users', ${id})
      `;

      return res.status(200).json({ user: result[0] });
    } catch (err) {
      console.error('PATCH /users/[id] error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const sql = getDb();
      if (id === user.sub) return res.status(400).json({ error: 'Cannot delete your own account' });
      await sql`UPDATE users SET is_active = false, updated_at = NOW() WHERE id = ${id}`;
      return res.status(200).json({ message: 'User deactivated' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

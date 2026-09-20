// api/expenses/approve.js
import { getDb } from '../_db.js';
import { requireAuth, corsHeaders } from '../_auth.js';

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = requireAuth(req, res);
  if (!user) return;

  const isSu = user.role === 'superuser' || user.permissions?.finance === 'superuser';
  if (!isSu) return res.status(403).json({ error: 'Superuser only' });

  try {
    const { expense_id, action, comment } = req.body || {};
    if (!expense_id || !action) return res.status(400).json({ error: 'expense_id and action required' });
    if (!['approve','reject','hold'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
    if (action === 'reject' && !comment?.trim()) return res.status(400).json({ error: 'Rejection requires a comment.' });

    const statusMap = { approve:'approved', reject:'rejected', hold:'hold' };
    const sql = getDb();
    const [expense] = await sql`
      UPDATE expenses
      SET status = ${statusMap[action]}, approved_by = ${user.sub},
          approved_at = NOW(), rejection_comment = ${comment||null}
      WHERE id = ${expense_id} AND status IN ('pending','hold')
      RETURNING id, form_number, status`;

    if (!expense) return res.status(404).json({ error: 'Not found or already processed.' });

    await sql`
      INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id)
      VALUES (${user.sub}, ${user.full_name}, ${action.toUpperCase()+'_EXPENSE'}, 'expenses', ${expense_id})`;

    return res.status(200).json({ expense });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

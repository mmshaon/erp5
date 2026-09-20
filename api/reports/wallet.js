// api/reports/wallet.js
import { getDb } from '../_db.js';
import { requireAuth, corsHeaders } from '../_auth.js';

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = requireAuth(req, res);
  if (!user) return;

  const sql = getDb();
  const isSu = user.role === 'superuser';

  if (req.method === 'GET') {
    try {
      const targetId = req.query.userId || user.sub;
      if (targetId !== user.sub && !isSu) return res.status(403).json({ error: 'Forbidden' });
      const [balance] = await sql`SELECT * FROM user_wallet_balance WHERE user_id = ${targetId}`;
      const advances  = await sql`SELECT * FROM cash_advances WHERE user_id = ${targetId} ORDER BY received_at DESC`;
      return res.status(200).json({ balance: balance||{total_received:0,total_expenses:0,current_balance:0}, advances });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  if (req.method === 'POST') {
    if (!isSu) return res.status(403).json({ error: 'Superuser only' });
    try {
      const { user_id, amount, description, reference } = req.body || {};
      if (!user_id || !amount) return res.status(400).json({ error: 'user_id and amount required' });
      const [advance] = await sql`
        INSERT INTO cash_advances (user_id, amount, description, reference, approved_by, status)
        VALUES (${user_id}, ${amount}, ${description||null}, ${reference||null}, ${user.sub}, 'approved')
        RETURNING *`;
      return res.status(201).json({ advance });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

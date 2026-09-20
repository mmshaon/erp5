// api/reports/dashboard.js
import { getDb } from '../_db.js';
import { requireAuth, corsHeaders } from '../_auth.js';

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = requireAuth(req, res);
  if (!user) return;

  const sql = getDb();
  const isSu = user.role === 'superuser' || user.permissions?.finance === 'superuser';

  try {
    const [expenseStats] = isSu
      ? await sql`SELECT COUNT(*) AS total_count, COALESCE(SUM(grand_total) FILTER (WHERE status='approved'),0) AS approved_total, COUNT(*) FILTER (WHERE status='pending') AS pending_count, COUNT(*) FILTER (WHERE status='approved') AS approved_count, COUNT(*) FILTER (WHERE status='rejected') AS rejected_count FROM expenses`
      : await sql`SELECT COUNT(*) AS total_count, COALESCE(SUM(grand_total) FILTER (WHERE status='approved'),0) AS approved_total, COUNT(*) FILTER (WHERE status='pending') AS pending_count, COUNT(*) FILTER (WHERE status='approved') AS approved_count, COUNT(*) FILTER (WHERE status='rejected') AS rejected_count FROM expenses WHERE submitted_by = ${user.sub}`;

    const [invoiceStats] = isSu
      ? await sql`SELECT COUNT(*) AS total_count, COALESCE(SUM(grand_total) FILTER (WHERE status='approved'),0) AS approved_total, COUNT(*) FILTER (WHERE status='pending') AS pending_count, COUNT(*) FILTER (WHERE status='approved') AS approved_count FROM invoices`
      : await sql`SELECT COUNT(*) AS total_count, COALESCE(SUM(grand_total) FILTER (WHERE status='approved'),0) AS approved_total, COUNT(*) FILTER (WHERE status='pending') AS pending_count, COUNT(*) FILTER (WHERE status='approved') AS approved_count FROM invoices WHERE submitted_by = ${user.sub}`;

    let pendingApprovals = 0;
    if (isSu) {
      const [pc] = await sql`SELECT ((SELECT COUNT(*) FROM expenses WHERE status='pending') + (SELECT COUNT(*) FROM invoices WHERE status='pending')) AS total_pending`;
      pendingApprovals = Number(pc.total_pending);
    }

    const monthlyTrend = await sql`
      SELECT TO_CHAR(submitted_at,'Mon YY') AS month, TO_CHAR(submitted_at,'YYYY-MM') AS month_key,
             COALESCE(SUM(grand_total) FILTER (WHERE status='approved'),0) AS total
      FROM expenses WHERE submitted_at >= NOW() - INTERVAL '6 months'
      GROUP BY month, month_key ORDER BY month_key`;

    const [walletBalance] = await sql`SELECT * FROM user_wallet_balance WHERE user_id = ${user.sub}`;

    return res.status(200).json({
      expenses:          expenseStats,
      invoices:          invoiceStats,
      pending_approvals: pendingApprovals,
      monthly_trend:     monthlyTrend,
      wallet:            walletBalance || { total_received:0, total_expenses:0, current_balance:0 },
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// api/expenses/index.js
import { getDb } from '../_db.js';
import { requireAuth, corsHeaders } from '../_auth.js';

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = requireAuth(req, res);
  if (!user) return;

  const sql = getDb();
  const isSu   = user.role === 'superuser' || user.permissions?.finance === 'superuser';
  const isView = user.permissions?.finance === 'view_only';
  const isSub  = user.permissions?.finance === 'submit_only';

  if (req.method === 'GET') {
    if (isSub) return res.status(403).json({ error: 'Submit-only access cannot view records.' });
    try {
      const expenses = isSu || isView
        ? await sql`
            SELECT e.*, u.full_name AS submitted_by_name, ec.name AS category_name
            FROM expenses e
            LEFT JOIN users u ON u.id = e.submitted_by
            LEFT JOIN expense_categories ec ON ec.id = e.category_id
            ORDER BY e.submitted_at DESC LIMIT 500`
        : await sql`
            SELECT e.*, u.full_name AS submitted_by_name, ec.name AS category_name
            FROM expenses e
            LEFT JOIN users u ON u.id = e.submitted_by
            LEFT JOIN expense_categories ec ON ec.id = e.category_id
            WHERE e.submitted_by = ${user.sub}
            ORDER BY e.submitted_at DESC LIMIT 200`;
      return res.status(200).json({ expenses });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    if (isView) return res.status(403).json({ error: 'View-only access cannot submit.' });
    try {
      const { project_name, project_location, category_id, notes, line_items, media_urls } = req.body || {};
      if (!line_items?.length) return res.status(400).json({ error: 'At least one line item is required.' });

      let total_amount = 0, tax_total = 0;
      for (const li of line_items) {
        const sub = parseFloat(li.quantity) * parseFloat(li.unit_price);
        const tax = sub * (parseFloat(li.tax_percent ?? 15) / 100);
        if (isNaN(sub) || isNaN(tax)) return res.status(400).json({ error: 'Invalid numeric values in line items.' });
        total_amount += sub; tax_total += tax;
      }
      const grand_total = total_amount + tax_total;

      const [seq] = await sql`SELECT nextval('expense_seq') AS n`;
      const form_number = `EXP-${new Date().getFullYear()}-${String(seq.n).padStart(5,'0')}`;

      const [expense] = await sql`
        INSERT INTO expenses
          (form_number, submitted_by, submitted_by_name, project_name, project_location,
           category_id, notes, total_amount, tax_total, grand_total, media_urls, is_locked, status)
        VALUES
          (${form_number}, ${user.sub}, ${user.full_name},
           ${project_name||null}, ${project_location||null}, ${category_id||null},
           ${notes||null}, ${total_amount}, ${tax_total}, ${grand_total},
           ${JSON.stringify(media_urls||[])}, true, 'pending')
        RETURNING id, form_number, status`;

      for (let i = 0; i < line_items.length; i++) {
        const li = line_items[i];
        await sql`
          INSERT INTO expense_line_items
            (expense_id, description, quantity, unit, unit_price, tax_percent, sort_order)
          VALUES
            (${expense.id}, ${li.description}, ${parseFloat(li.quantity)||1},
             ${li.unit||null}, ${parseFloat(li.unit_price)||0},
             ${parseFloat(li.tax_percent)||15}, ${i})`;
      }

      await sql`
        INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id)
        VALUES (${user.sub}, ${user.full_name}, 'SUBMIT_EXPENSE', 'expenses', ${expense.id})`;

      return res.status(201).json({ expense });
    } catch (err) {
      console.error('POST /expenses error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

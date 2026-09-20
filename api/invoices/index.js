// api/invoices/index.js
import { getDb } from '../_db.js';
import { requireAuth, corsHeaders } from '../_auth.js';

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = requireAuth(req, res);
  if (!user) return;

  const sql  = getDb();
  const isSu   = user.role === 'superuser' || user.permissions?.finance === 'superuser';
  const isView = user.permissions?.finance === 'view_only';
  const isSub  = user.permissions?.finance === 'submit_only';

  if (req.method === 'GET') {
    if (isSub) return res.status(403).json({ error: 'Submit-only access cannot view records.' });
    try {
      const invoices = isSu || isView
        ? await sql`SELECT i.*, u.full_name AS submitted_by_name FROM invoices i LEFT JOIN users u ON u.id = i.submitted_by ORDER BY i.submitted_at DESC LIMIT 500`
        : await sql`SELECT i.*, u.full_name AS submitted_by_name FROM invoices i LEFT JOIN users u ON u.id = i.submitted_by WHERE i.submitted_by = ${user.sub} ORDER BY i.submitted_at DESC LIMIT 200`;
      return res.status(200).json({ invoices });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  if (req.method === 'POST') {
    if (isView) return res.status(403).json({ error: 'View-only access.' });
    try {
      const { client_name, client_address, client_vat_number, project_name, po_number,
              due_date, payment_terms, notes, line_items, media_urls } = req.body || {};
      if (!client_name?.trim()) return res.status(400).json({ error: 'client_name is required.' });
      if (!line_items?.length)  return res.status(400).json({ error: 'At least one line item required.' });

      let subtotal = 0, tax_total = 0;
      for (const li of line_items) {
        const sub = parseFloat(li.quantity) * parseFloat(li.unit_price);
        subtotal  += sub;
        tax_total += sub * (parseFloat(li.tax_percent ?? 15) / 100);
      }
      const grand_total = subtotal + tax_total;
      const [seq] = await sql`SELECT nextval('invoice_seq') AS n`;
      const invoice_number = `INV-${new Date().getFullYear()}-${String(seq.n).padStart(5,'0')}`;

      const [invoice] = await sql`
        INSERT INTO invoices
          (invoice_number, submitted_by, submitted_by_name, client_name, client_address,
           client_vat_number, project_name, po_number, due_date, payment_terms,
           subtotal, tax_total, grand_total, notes, media_urls, status)
        VALUES
          (${invoice_number}, ${user.sub}, ${user.full_name}, ${client_name.trim()},
           ${client_address||null}, ${client_vat_number||null}, ${project_name||null},
           ${po_number||null}, ${due_date||null}, ${payment_terms||null},
           ${subtotal}, ${tax_total}, ${grand_total}, ${notes||null},
           ${JSON.stringify(media_urls||[])}, 'pending')
        RETURNING id, invoice_number, status`;

      for (let i = 0; i < line_items.length; i++) {
        const li = line_items[i];
        await sql`
          INSERT INTO invoice_line_items (invoice_id, description, quantity, unit, unit_price, tax_percent, sort_order)
          VALUES (${invoice.id}, ${li.description}, ${parseFloat(li.quantity)||1},
                 ${li.unit||null}, ${parseFloat(li.unit_price)||0}, ${parseFloat(li.tax_percent)||15}, ${i})`;
      }

      await sql`INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id) VALUES (${user.sub}, ${user.full_name}, 'SUBMIT_INVOICE', 'invoices', ${invoice.id})`;
      return res.status(201).json({ invoice });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

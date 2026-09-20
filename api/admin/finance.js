// api/admin/finance.js
// Alpha Ultimate ERP — Finance Module Serverless Handler
// Handles: GET/POST for expenses + invoices with strict immutability,
//          approval actions, notification triggers, and data isolation.

import { getDb }                     from '../_db.js';
import { requireAuth, corsHeaders }  from '../_auth.js';

// ── Permission helpers ────────────────────────────────────────
function getFinanceLevel(user) {
  if (user.role === 'superuser') return 'superuser';
  return user.permissions?.finance ?? 'none';
}
function isSu(user)   { return getFinanceLevel(user) === 'superuser'; }
function canView(user) {
  const l = getFinanceLevel(user);
  return l === 'view_only' || l === 'superuser';
}
function canSubmit(user) {
  const l = getFinanceLevel(user);
  return l === 'submit_only' || l === 'superuser';
}

// ── Notification helper ───────────────────────────────────────
async function notify(sql, userId, title, body, entityType, entityId) {
  try {
    await sql`
      INSERT INTO notifications (user_id, title, body, entity_type, entity_id)
      VALUES (${userId}, ${title}, ${body}, ${entityType}, ${entityId})`;
  } catch (e) {
    // Non-fatal — notification failure must not block main transaction
    console.warn('Notification insert failed:', e.message);
  }
}

// ── Audit log helper ──────────────────────────────────────────
async function audit(sql, user, action, entityType, entityId, details, ip) {
  try {
    await sql`
      INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, details, ip_address)
      VALUES (${user.sub}, ${user.full_name}, ${action}, ${entityType}, ${entityId},
              ${details ? JSON.stringify(details) : null}, ${ip || null})`;
  } catch (e) {
    console.warn('Audit log insert failed:', e.message);
  }
}

// ── Validate line items ───────────────────────────────────────
function calcTotals(lineItems) {
  let total_amount = 0;
  let tax_total    = 0;
  for (const li of lineItems) {
    const sub = parseFloat(li.quantity)  * parseFloat(li.unit_price);
    const tax = sub * (parseFloat(li.tax_percent ?? 15) / 100);
    if (isNaN(sub) || isNaN(tax)) return null;
    total_amount += sub;
    tax_total    += tax;
  }
  return { total_amount, tax_total, grand_total: total_amount + tax_total };
}

// ──────────────────────────────────────────────────────────────
//  MAIN HANDLER
//  Routes:
//    GET    /api/admin/finance?type=expenses|invoices
//    POST   /api/admin/finance?type=expenses|invoices
//    POST   /api/admin/finance?type=approve   { entity_type, entity_id, action, comment }
//    GET    /api/admin/finance?type=stats
//    GET    /api/admin/finance?type=pending_count
// ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = requireAuth(req, res);
  if (!user) return;

  const sql  = getDb();
  const type = req.query?.type || 'expenses';
  const ip   = req.headers['x-forwarded-for']?.split(',')[0] ?? req.socket?.remoteAddress;

  // ── GET /api/admin/finance?type=pending_count ─────────────
  if (req.method === 'GET' && type === 'pending_count') {
    if (!isSu(user)) return res.status(403).json({ error: 'Superuser only.' });
    try {
      const [row] = await sql`SELECT * FROM pending_approvals_count`;
      return res.status(200).json(row);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET /api/admin/finance?type=stats ─────────────────────
  if (req.method === 'GET' && type === 'stats') {
    if (!isSu(user)) return res.status(403).json({ error: 'Superuser only.' });
    try {
      const [stats] = await sql`
        SELECT
          (SELECT COUNT(*)                   FROM expenses)             AS total_expenses,
          (SELECT COALESCE(SUM(grand_total),0) FROM expenses WHERE status='approved') AS approved_expense_total,
          (SELECT COUNT(*) FROM expenses WHERE status='pending')        AS pending_expenses,
          (SELECT COUNT(*) FROM expenses WHERE status='approved')       AS approved_expenses,
          (SELECT COUNT(*) FROM expenses WHERE status='rejected')       AS rejected_expenses,
          (SELECT COUNT(*)                   FROM invoices)             AS total_invoices,
          (SELECT COALESCE(SUM(grand_total),0) FROM invoices WHERE status='approved') AS approved_invoice_total,
          (SELECT COUNT(*) FROM invoices WHERE status='pending')        AS pending_invoices`;
      return res.status(200).json(stats);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET /api/admin/finance?type=expenses ──────────────────
  if (req.method === 'GET' && type === 'expenses') {
    const level = getFinanceLevel(user);
    if (level === 'none')         return res.status(403).json({ error: 'No access to finance module.' });
    if (level === 'submit_only')  return res.status(403).json({ error: 'Submit-only users cannot view records.' });

    try {
      const expenses = isSu(user)
        ? await sql`
            SELECT e.*, ec.name AS category_name,
                   u.email AS submitted_by_email
            FROM   expenses e
            LEFT   JOIN users u             ON u.id  = e.submitted_by
            LEFT   JOIN expense_categories ec ON ec.id = e.category_id
            ORDER  BY e.submitted_at DESC LIMIT 500`
        : await sql`
            SELECT e.*, ec.name AS category_name,
                   u.email AS submitted_by_email
            FROM   expenses e
            LEFT   JOIN users u             ON u.id  = e.submitted_by
            LEFT   JOIN expense_categories ec ON ec.id = e.category_id
            WHERE  e.submitted_by = ${user.sub}
            ORDER  BY e.submitted_at DESC LIMIT 200`;

      // For each expense, attach line items
      const ids = expenses.map(e => e.id);
      const lineItems = ids.length
        ? await sql`
            SELECT * FROM expense_line_items
            WHERE  expense_id = ANY(${ids}::uuid[])
            ORDER  BY sort_order`
        : [];

      const liMap = {};
      lineItems.forEach(li => {
        if (!liMap[li.expense_id]) liMap[li.expense_id] = [];
        liMap[li.expense_id].push(li);
      });
      const result = expenses.map(e => ({ ...e, line_items: liMap[e.id] || [] }));

      return res.status(200).json({ expenses: result });
    } catch (err) {
      console.error('GET expenses error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET /api/admin/finance?type=invoices ──────────────────
  if (req.method === 'GET' && type === 'invoices') {
    const level = getFinanceLevel(user);
    if (level === 'none')        return res.status(403).json({ error: 'No access to finance module.' });
    if (level === 'submit_only') return res.status(403).json({ error: 'Submit-only users cannot view records.' });

    try {
      const invoices = isSu(user)
        ? await sql`
            SELECT i.*, u.email AS submitted_by_email
            FROM   invoices i
            LEFT   JOIN users u ON u.id = i.submitted_by
            ORDER  BY i.submitted_at DESC LIMIT 500`
        : await sql`
            SELECT i.*, u.email AS submitted_by_email
            FROM   invoices i
            LEFT   JOIN users u ON u.id = i.submitted_by
            WHERE  i.submitted_by = ${user.sub}
            ORDER  BY i.submitted_at DESC LIMIT 200`;

      const ids = invoices.map(i => i.id);
      const lineItems = ids.length
        ? await sql`
            SELECT * FROM invoice_line_items
            WHERE  invoice_id = ANY(${ids}::uuid[])
            ORDER  BY sort_order`
        : [];

      const liMap = {};
      lineItems.forEach(li => {
        if (!liMap[li.invoice_id]) liMap[li.invoice_id] = [];
        liMap[li.invoice_id].push(li);
      });
      const result = invoices.map(i => ({ ...i, line_items: liMap[i.id] || [] }));

      return res.status(200).json({ invoices: result });
    } catch (err) {
      console.error('GET invoices error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST /api/admin/finance?type=expenses ─────────────────
  if (req.method === 'POST' && type === 'expenses') {
    if (!canSubmit(user)) return res.status(403).json({ error: 'You do not have permission to submit expenses.' });

    try {
      const { project_name, project_location, category_id, notes, line_items, media_urls } = req.body || {};

      if (!line_items?.length) return res.status(400).json({ error: 'At least one line item is required.' });
      for (const li of line_items) {
        if (!li.description?.trim()) return res.status(400).json({ error: 'Every line item must have a description.' });
        if (parseFloat(li.unit_price) <= 0) return res.status(400).json({ error: 'Unit price must be greater than 0.' });
      }

      const totals = calcTotals(line_items);
      if (!totals) return res.status(400).json({ error: 'Invalid numeric values in line items.' });

      const [seq] = await sql`SELECT nextval('expense_seq') AS n`;
      const form_number = `EXP-${new Date().getFullYear()}-${String(seq.n).padStart(5, '0')}`;

      // ── Immutable INSERT — server stamps: submitted_by, submitted_by_name, submitted_at
      const [expense] = await sql`
        INSERT INTO expenses
          (form_number, submitted_by, submitted_by_name,
           project_name, project_location, category_id, notes,
           total_amount, tax_total, grand_total,
           media_urls, is_locked, status)
        VALUES
          (${form_number}, ${user.sub}, ${user.full_name},
           ${project_name || null}, ${project_location || null},
           ${category_id  || null}, ${notes || null},
           ${totals.total_amount}, ${totals.tax_total}, ${totals.grand_total},
           ${JSON.stringify(media_urls || [])}, true, 'pending')
        RETURNING id, form_number, status, submitted_at`;

      // Insert line items
      for (let i = 0; i < line_items.length; i++) {
        const li = line_items[i];
        await sql`
          INSERT INTO expense_line_items
            (expense_id, description, quantity, unit, unit_price, tax_percent, sort_order)
          VALUES
            (${expense.id}, ${li.description.trim()},
             ${parseFloat(li.quantity) || 1}, ${li.unit?.trim() || null},
             ${parseFloat(li.unit_price) || 0}, ${parseFloat(li.tax_percent) || 15}, ${i})`;
      }

      // Notify all superusers about pending approval
      const suUsers = await sql`
        SELECT id FROM users WHERE role = 'superuser' AND is_active = true`;
      for (const su of suUsers) {
        await notify(sql, su.id,
          `New Expense Pending — ${form_number}`,
          `${user.full_name} submitted ${form_number} for SAR ${totals.grand_total.toFixed(2)}`,
          'expenses', expense.id);
      }

      await audit(sql, user, 'SUBMIT_EXPENSE', 'expenses', expense.id,
        { form_number, grand_total: totals.grand_total }, ip);

      return res.status(201).json({ expense });
    } catch (err) {
      console.error('POST expenses error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST /api/admin/finance?type=invoices ─────────────────
  if (req.method === 'POST' && type === 'invoices') {
    if (!canSubmit(user)) return res.status(403).json({ error: 'You do not have permission to submit invoices.' });

    try {
      const {
        client_name, client_address, client_vat_number,
        project_name, po_number, due_date, payment_terms,
        notes, line_items, media_urls
      } = req.body || {};

      if (!client_name?.trim()) return res.status(400).json({ error: 'Client name is required.' });
      if (!line_items?.length)  return res.status(400).json({ error: 'At least one line item is required.' });

      const totals = calcTotals(line_items);
      if (!totals) return res.status(400).json({ error: 'Invalid numeric values in line items.' });

      const [seq] = await sql`SELECT nextval('invoice_seq') AS n`;
      const invoice_number = `INV-${new Date().getFullYear()}-${String(seq.n).padStart(5, '0')}`;

      const [invoice] = await sql`
        INSERT INTO invoices
          (invoice_number, submitted_by, submitted_by_name,
           client_name, client_address, client_vat_number,
           project_name, po_number, due_date, payment_terms,
           subtotal, tax_total, grand_total, notes,
           media_urls, status)
        VALUES
          (${invoice_number}, ${user.sub}, ${user.full_name},
           ${client_name.trim()}, ${client_address || null}, ${client_vat_number || null},
           ${project_name || null}, ${po_number || null},
           ${due_date || null}, ${payment_terms || null},
           ${totals.total_amount}, ${totals.tax_total}, ${totals.grand_total},
           ${notes || null}, ${JSON.stringify(media_urls || [])}, 'pending')
        RETURNING id, invoice_number, status, submitted_at`;

      for (let i = 0; i < line_items.length; i++) {
        const li = line_items[i];
        await sql`
          INSERT INTO invoice_line_items
            (invoice_id, description, quantity, unit, unit_price, tax_percent, sort_order)
          VALUES
            (${invoice.id}, ${li.description.trim()},
             ${parseFloat(li.quantity) || 1}, ${li.unit?.trim() || null},
             ${parseFloat(li.unit_price) || 0}, ${parseFloat(li.tax_percent) || 15}, ${i})`;
      }

      const suUsers = await sql`SELECT id FROM users WHERE role='superuser' AND is_active=true`;
      for (const su of suUsers) {
        await notify(sql, su.id,
          `New Invoice Pending — ${invoice_number}`,
          `${user.full_name} submitted invoice for ${client_name} — SAR ${totals.grand_total.toFixed(2)}`,
          'invoices', invoice.id);
      }

      await audit(sql, user, 'SUBMIT_INVOICE', 'invoices', invoice.id,
        { invoice_number, grand_total: totals.grand_total }, ip);

      return res.status(201).json({ invoice });
    } catch (err) {
      console.error('POST invoices error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST /api/admin/finance?type=approve ──────────────────
  //   Body: { entity_type: 'expenses'|'invoices', entity_id, action: 'approve'|'reject'|'hold', comment? }
  if (req.method === 'POST' && type === 'approve') {
    if (!isSu(user)) return res.status(403).json({ error: 'Only superusers can approve records.' });

    try {
      const { entity_type, entity_id, action, comment } = req.body || {};
      if (!entity_type || !entity_id || !action)
        return res.status(400).json({ error: 'entity_type, entity_id, and action are required.' });
      if (!['approve', 'reject', 'hold'].includes(action))
        return res.status(400).json({ error: 'action must be approve | reject | hold' });
      if (action === 'reject' && !comment?.trim())
        return res.status(400).json({ error: 'A rejection comment is mandatory.' });

      const statusMap = { approve: 'approved', reject: 'rejected', hold: 'hold' };
      const newStatus = statusMap[action];

      let updated;
      if (entity_type === 'expenses') {
        [updated] = await sql`
          UPDATE expenses
          SET    status = ${newStatus}, approved_by = ${user.sub},
                 approved_at = NOW(), rejection_comment = ${comment || null}
          WHERE  id = ${entity_id} AND status IN ('pending','hold')
          RETURNING id, form_number, status, submitted_by`;
      } else if (entity_type === 'invoices') {
        [updated] = await sql`
          UPDATE invoices
          SET    status = ${newStatus}, approved_by = ${user.sub},
                 approved_at = NOW(), rejection_comment = ${comment || null}
          WHERE  id = ${entity_id} AND status IN ('pending','hold')
          RETURNING id, invoice_number, status, submitted_by`;
      } else {
        return res.status(400).json({ error: 'entity_type must be expenses or invoices.' });
      }

      if (!updated) return res.status(404).json({ error: 'Record not found or already processed.' });

      // Notify the submitter
      const ref = updated.form_number || updated.invoice_number;
      const title = action === 'approve'
        ? `✓ ${ref} Approved`
        : action === 'reject'
          ? `✗ ${ref} Rejected`
          : `⏸ ${ref} On Hold`;
      const body = action === 'reject'
        ? `Your submission was rejected. Comment: ${comment}`
        : `Your submission status changed to ${newStatus}.`;

      await notify(sql, updated.submitted_by, title, body, entity_type, updated.id);
      await audit(sql, user, `${action.toUpperCase()}_${entity_type.toUpperCase().slice(0,-1)}`,
        entity_type, updated.id, { action, comment: comment || null }, ip);

      return res.status(200).json({ updated });
    } catch (err) {
      console.error('approve error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET /api/admin/finance?type=notifications ─────────────
  if (req.method === 'GET' && type === 'notifications') {
    try {
      const notes = await sql`
        SELECT * FROM notifications
        WHERE  user_id = ${user.sub}
        ORDER  BY created_at DESC LIMIT 50`;
      const [{ count }] = await sql`
        SELECT COUNT(*)::int AS count FROM notifications
        WHERE  user_id = ${user.sub} AND is_read = false`;
      return res.status(200).json({ notifications: notes, unread_count: count });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST /api/admin/finance?type=mark_read ────────────────
  if (req.method === 'POST' && type === 'mark_read') {
    try {
      const { notification_id } = req.body || {};
      if (notification_id) {
        await sql`
          UPDATE notifications SET is_read = true
          WHERE id = ${notification_id} AND user_id = ${user.sub}`;
      } else {
        await sql`
          UPDATE notifications SET is_read = true
          WHERE user_id = ${user.sub}`;
      }
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

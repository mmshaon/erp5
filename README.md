# Alpha Ultimate ERP — v5

> **Full-stack ERP for construction & cleaning subcontracting businesses in Saudi Arabia.**  
> React 18 · Vite · Vercel Serverless · NeonDB (PostgreSQL) · TailwindCSS v3 · JWT Auth

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Prerequisites](#3-prerequisites)
4. [NeonDB Setup (Step-by-Step)](#4-neondb-setup)
5. [ImgBB API Key Setup](#5-imgbb-setup)
6. [Local Development](#6-local-development)
7. [Vercel Deployment](#7-vercel-deployment)
8. [GitHub Setup & Git Push from Termux](#8-termux-git-push)
9. [Module Reference](#9-module-reference)
10. [Permission System](#10-permission-system)
11. [API Endpoints Reference](#11-api-endpoints)
12. [File Upload System](#12-file-upload)
13. [PDF & Excel Reports](#13-reports)
14. [Environment Variables](#14-environment-variables)
15. [Troubleshooting](#15-troubleshooting)
16. [Default Credentials](#16-default-credentials)
17. [Security Checklist](#17-security-checklist)

---

## 1. Project Overview

Alpha Ultimate ERP is a production-grade, cloud-native management system built for **Alpha Ultimate Ltd**, a construction and cleaning subcontracting company based in **Riyadh, Saudi Arabia**.

### Key Capabilities

| Feature | Detail |
|---|---|
| **Immutable Forms** | All expense/invoice entries are server-locked on submission — zero editing after submit |
| **Granular Permissions** | Per-user, per-module access: None / View Only / Submit Only / Superuser |
| **Approval Engine** | Pending queue with Approve / Reject (mandatory comment) / Hold workflow |
| **Wallet System** | Per-user: `Total Cash Received − Approved Expenses = Current Balance` |
| **Camera Upload** | Direct camera capture on mobile with 10MB/file + 25MB/form limits |
| **PDF Reports** | A4 branded invoices with logo, CR number, address, page numbers, export timestamp |
| **Excel Export** | Multi-sheet XLSX with Expenses + Invoices sheets |
| **Real-time Notifications** | In-app bell icon polls every 30s; triggers on approval status changes |
| **Bilingual UI** | English + Bengali toggle (easily extendable) |
| **Mobile Responsive** | Collapsible sidebar, mobile-first forms |
| **Audit Log** | Append-only immutable trail of all user actions |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (React 18 + Vite + TailwindCSS + React Router v6)  │
│  Deployed as: Vercel Static Site                            │
└──────────────────────┬──────────────────────────────────────┘
                       │ /api/* fetch calls (JWT Bearer token)
┌──────────────────────▼──────────────────────────────────────┐
│  Vercel Serverless Functions (Node.js ESM, /api directory)  │
│                                                             │
│  /api/auth/login.js        — POST login, returns JWT        │
│  /api/auth/me.js           — GET current user               │
│  /api/admin/finance.js     — GET/POST expenses, invoices,   │
│                              approvals, notifications        │
│  /api/expenses/index.js    — Expense CRUD + data isolation  │
│  /api/expenses/approve.js  — Approve/Reject/Hold            │
│  /api/invoices/index.js    — Invoice CRUD                   │
│  /api/invoices/approve.js  — Approve/Reject/Hold            │
│  /api/users/index.js       — User management (superuser)    │
│  /api/users/[id].js        — Edit/toggle single user        │
│  /api/permissions/index.js — Permission matrix CRUD         │
│  /api/reports/dashboard.js — Aggregated dashboard stats     │
│  /api/reports/wallet.js    — Personal wallet balance        │
│  /api/uploads/imgbb.js     — File upload → ImgBB CDN        │
└──────────────────────┬──────────────────────────────────────┘
                       │ @neondatabase/serverless (WebSocket)
┌──────────────────────▼──────────────────────────────────────┐
│  NeonDB — Serverless PostgreSQL (Free Tier)                 │
│                                                             │
│  users  user_permissions  expenses  expense_line_items      │
│  invoices  invoice_line_items  cash_advances  assets        │
│  liabilities  investments  media_uploads  notifications     │
│  audit_log  system_settings  expense_categories             │
└─────────────────────────────────────────────────────────────┘
```

### JWT Flow

```
Login → POST /api/auth/login
      ← { token, user: { id, role, permissions: { finance, users, ... } } }

All subsequent requests:
Headers: Authorization: Bearer <token>
Server: verifyJWT() → extract { sub, role, permissions } → enforce access level
```

---

## 3. Prerequisites

| Tool | Version | Install |
|---|---|---|
| **Node.js** | 18 LTS or 20 LTS | https://nodejs.org |
| **npm** | Bundled with Node | — |
| **Git** | 2.x | https://git-scm.com |
| **Vercel CLI** (optional for local) | latest | `npm i -g vercel` |
| **NeonDB Account** | Free | https://neon.tech |
| **GitHub Account** | — | https://github.com |
| **ImgBB Account** | Free | https://imgbb.com |

---

## 4. NeonDB Setup

### Step 1 — Create a Neon project

1. Go to **https://console.neon.tech** and sign up (free).
2. Click **"New Project"**.
3. Name: `alpha-ultimate-erp`
4. Region: Choose **Middle East** (if available) or **US East 2** (closest to Saudi Arabia with low latency).
5. Click **"Create project"**.

### Step 2 — Get your connection string

1. In your Neon dashboard → **"Connection Details"** tab.
2. Select **"Connection string"** format.
3. Copy the full string — it looks like:
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. **IMPORTANT:** Keep the `?sslmode=require` at the end — required for secure connections.

### Step 3 — Run the schema

1. In the Neon dashboard, click **"SQL Editor"** (left sidebar).
2. Open the file `sql/schema.sql` from this project.
3. **Select All** (Ctrl+A) and **Copy** the entire contents.
4. Paste it into the Neon SQL Editor.
5. Click **"Run"**.
6. You should see: `INSERT 0 9` (categories), `INSERT 0 1` (admin user), `INSERT 0 11` (permissions).

### Step 4 — Verify

Run this in the SQL Editor to confirm:
```sql
SELECT id, username, email, role FROM users;
SELECT module, access_level FROM user_permissions WHERE user_id = (SELECT id FROM users WHERE username='admin');
```

You should see the `admin` user with `superuser` on all 11 modules.

---

## 5. ImgBB Setup

ImgBB provides free image hosting CDN — no credit card required.

1. Go to **https://imgbb.com** and create a free account.
2. Navigate to **https://api.imgbb.com** (click "Get API key").
3. Copy your API key (looks like: `abc123def456...`).
4. Add it as `IMGBB_API_KEY` in your environment (see Section 14).

> **Note:** ImgBB free tier supports up to 32MB per image and stores permanently.
> For non-image files (PDF, DOCX, XLSX, ZIP, TXT), the system still encodes them as base64 and stores the CDN URL. ImgBB will reject non-image files in that case — for those, you'd need to switch the upload handler to Vercel Blob or Supabase Storage. The system is designed to swap providers via the `api/uploads/imgbb.js` handler.

---

## 6. Local Development

### Step 1 — Clone and install

```bash
git clone https://github.com/alphashaon89/alpha-ultimate-erp.git
cd alpha-ultimate-erp
npm install
```

### Step 2 — Create local environment file

```bash
cp .env.example .env.local
```

Edit `.env.local` with your actual values:
```env
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=your-long-random-hex-string-minimum-64-characters
IMGBB_API_KEY=your-imgbb-api-key
```

### Step 3 — Run locally with Vercel CLI (recommended)

The serverless functions in `/api` require Vercel's local runtime to work:

```bash
# Install Vercel CLI globally (once)
npm install -g vercel

# First time: link to your Vercel project
vercel link

# Start local dev server (runs both Vite + serverless functions)
vercel dev
```

Open **http://localhost:3000**

### Alternative: Vite only (frontend without API)

```bash
npm run dev
# Opens http://localhost:5173
# API calls will fail unless you have a separate backend running
```

### Step 4 — Login

- URL: http://localhost:3000/login
- Username: `admin`
- Password: `Admin@12345`

> **IMPORTANT:** Change this password immediately after first login.

---

## 7. Vercel Deployment

### Step 1 — Create Vercel account

1. Go to **https://vercel.com** and sign up with GitHub.

### Step 2 — Import GitHub repo

1. Vercel Dashboard → **"Add New Project"**
2. Select **"Import Git Repository"**
3. Find `alpha-ultimate-erp` and click **"Import"**

### Step 3 — Configure build settings

Vercel should auto-detect Vite. Confirm:
- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

### Step 4 — Add Environment Variables

In Vercel → Project → **Settings → Environment Variables**, add:

| Name | Value | Environment |
|---|---|---|
| `DATABASE_URL` | Your NeonDB connection string | Production, Preview, Development |
| `JWT_SECRET` | Your 64+ char hex secret | Production, Preview, Development |
| `IMGBB_API_KEY` | Your ImgBB key | Production, Preview, Development |

### Step 5 — Deploy

Click **"Deploy"**. Vercel will:
1. Install dependencies
2. Run TypeScript check
3. Build with Vite
4. Deploy to global CDN

Your app will be live at: `https://alpha-ultimate-erp.vercel.app` (or your custom domain).

### Step 6 — Custom Domain (optional)

Vercel → Project → **Settings → Domains** → Add your domain → Follow DNS instructions.

---

## 8. Termux Git Push

The file `termux-push.sh` is a complete, self-contained script for pushing from an Android device using Termux.

### First-time setup (run once)

```bash
# 1. Install Termux from F-Droid (not Play Store — Play Store version is outdated)
#    https://f-droid.org/packages/com.termux/

# 2. Open Termux and navigate to your project
#    (If you've downloaded the zip, extract it first)

# 3. Give the script execute permission
chmod +x termux-push.sh

# 4. Run setup — this installs git, stores your GitHub token
bash termux-push.sh setup
```

**What setup does:**
- Runs `pkg install git curl openssh`
- Configures your git identity (name + email)
- Prompts for your GitHub Personal Access Token
- Stores it securely in `~/.git-credentials`
- Verifies the token against GitHub API
- Initialises git repo and sets remote origin

### Create a GitHub Personal Access Token

1. GitHub → **Settings → Developer Settings → Personal Access Tokens → Tokens (classic)**
2. **"Generate new token (classic)"**
3. Name: `termux-erp-push`
4. Expiration: 90 days (or No expiration)
5. Scopes: ✅ **repo** (check the top-level box — gives full repo control)
6. Click **"Generate token"**
7. **Copy immediately** — GitHub won't show it again

### Every subsequent push

```bash
# From inside the erp-v5 folder:
bash termux-push.sh
```

This will:
1. Check credentials are stored
2. Stage all changed files (`git add -A`)
3. Commit with timestamp message
4. Force-push to `main` branch
5. Vercel auto-deploys from the push

### Other commands

```bash
bash termux-push.sh status  # Show working tree status + last 5 commits
bash termux-push.sh log     # Show commit graph
bash termux-push.sh setup   # Re-run setup (if token expired, etc.)
```

### If you get "Push failed" errors

Most common causes and fixes:

```bash
# Token expired — get new one and re-run setup:
bash termux-push.sh setup

# Repo doesn't exist on GitHub:
# Create it at https://github.com/new
# Name: alpha-ultimate-erp
# Private: YES
# DO NOT check "Add README" (leave empty)

# Wrong username in script — edit termux-push.sh and change:
# GITHUB_USER="your-actual-github-username"

# Network issues:
# Toggle WiFi/mobile data and try again
```

---

## 9. Module Reference

### Dashboard
Real-time stats with animated counters, area/pie/bar charts (Recharts), live clock. Shows: Approved Expenses, Approved Invoices, Wallet Balance, Pending Approvals queue count. Quick-action buttons for common tasks.

### Expenses Module
- **List view:** Table of all expenses with form number, status badges, amounts, dates. Superusers see all; others see only their own.
- **New Expense Form:** Immutable — auto-stamps Date, Time, User ID, Name, Email. Multi-line items with real-time totals. Camera/file upload.
- **Submission lock:** After submit → immediately redirected to list. Cannot return to edit.

### Invoices Module
Same pattern as Expenses but for client-facing invoices. Includes: Client Name, VAT Number, PO Number, Due Date, Payment Terms.

### Wallet
Personal financial summary: `Total Cash Received (advances) - Approved Expenses = Current Balance`. Shows full advance history. Color-coded (green = positive, red = negative balance).

### Approvals (Superuser only)
Tabbed queue: Expenses | Invoices. Each card shows form number, submitter, amount. Actions:
- **✓ Approve** — sets status=approved, notifies submitter
- **⏸ Hold** — sets status=hold (can be re-approved later)
- **✕ Reject** — requires mandatory admin comment, notifies submitter

### Users (Superuser only)
Create/edit/deactivate users. Fields: Username, Email, Full Name, Password, Role (staff/manager/superuser), Department.

### Permissions (Superuser only)
Granular Permission Matrix. Assign per-user, per-module access levels. See Section 10.

### Reports (Superuser only)
Export buttons: XLSX (multi-sheet) and PDF (A4 branded with logo, CR number, auto-stamp). Shows full tables of all expenses and invoices.

---

## 10. Permission System

### Modules

| Module Key | What it Controls |
|---|---|
| `finance` | Expenses, invoices, financial records |
| `approvals` | Approve/reject pending items |
| `reports` | Export PDF/XLSX reports |
| `users` | Create/edit user accounts |
| `settings` | System configuration |
| `bookings` | Project booking management |
| `assets` | Asset register (future module) |
| `liabilities` | Loans/credits (future module) |
| `investments` | Investment portfolio (future module) |
| `media` | File upload/management |
| `content` | Public-facing content |

### Access Levels

| Level | Code | What the user can do |
|---|---|---|
| No Access | `none` | Module is hidden. All API calls return 403. |
| View Only | `view_only` | Can see records. No form buttons rendered. Cannot submit. |
| Submit Only | `submit_only` | Can fill and submit new records. **Cannot view previous submissions.** |
| Superuser | `superuser` | Full CRUD + approve/reject + system settings. |

### How it works (technical)

1. On login, the server fetches `user_permissions` from DB and includes them in the JWT:
   ```json
   { "sub": "uuid", "role": "staff", "permissions": { "finance": "submit_only", "media": "view_only" } }
   ```
2. Every API request reads the JWT and checks: `user.permissions.finance === 'submit_only'`
3. Frontend hides/shows buttons based on the same permissions from `localStorage`
4. SQL queries enforce data isolation: non-superusers always get `WHERE submitted_by = user_id`

---

## 11. API Endpoints

All endpoints require: `Authorization: Bearer <token>` (except `/api/auth/login`)

### Auth

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Login with username/password → returns JWT + user |
| GET  | `/api/auth/me`    | Verify token, return current user |

### Finance (unified handler)

| Method | Path | Description |
|---|---|---|
| GET  | `/api/admin/finance?type=expenses`       | List expenses (isolated by permission) |
| POST | `/api/admin/finance?type=expenses`       | Submit new expense (immutable) |
| GET  | `/api/admin/finance?type=invoices`       | List invoices |
| POST | `/api/admin/finance?type=invoices`       | Submit new invoice |
| POST | `/api/admin/finance?type=approve`        | Approve/reject/hold (superuser only) |
| GET  | `/api/admin/finance?type=notifications`  | Get user notifications + unread count |
| POST | `/api/admin/finance?type=mark_read`      | Mark notification(s) as read |
| GET  | `/api/admin/finance?type=stats`          | Dashboard aggregate stats |
| GET  | `/api/admin/finance?type=pending_count`  | Pending approval count (for bell badge) |

### Expenses (legacy compatible)

| Method | Path | Description |
|---|---|---|
| GET  | `/api/expenses`          | List expenses |
| POST | `/api/expenses`          | Submit expense |
| POST | `/api/expenses/approve`  | Approve/reject/hold expense |

### Invoices

| Method | Path | Description |
|---|---|---|
| GET  | `/api/invoices`          | List invoices |
| POST | `/api/invoices`          | Submit invoice |
| POST | `/api/invoices/approve`  | Approve/reject/hold invoice |

### Users

| Method | Path | Description |
|---|---|---|
| GET    | `/api/users`         | List all users (superuser) |
| POST   | `/api/users`         | Create user (superuser) |
| PATCH  | `/api/users/[id]`    | Edit user (superuser) |
| DELETE | `/api/users/[id]`    | Delete user (superuser) |

### Permissions

| Method | Path | Description |
|---|---|---|
| GET | `/api/permissions?userId=<id>` | Get user's permissions |
| PUT | `/api/permissions`             | Save user's permissions |

### Reports

| Method | Path | Description |
|---|---|---|
| GET | `/api/reports/dashboard` | Dashboard stats |
| GET | `/api/reports/wallet`    | Personal wallet balance + advances |

### Uploads

| Method | Path | Description |
|---|---|---|
| POST | `/api/uploads/imgbb` | Upload files to ImgBB CDN |

---

## 12. File Upload System

### How it works

1. User selects file(s) via `<input type="file" accept="image/*,.pdf,.docx,.xlsx,.txt,.zip" capture="environment" multiple>` — on mobile, this opens the camera directly
2. Files are read as base64 in the browser (`FileReader`)
3. Staged locally with preview thumbnails (images only)
4. On "Upload" click → POST to `/api/uploads/imgbb` with base64 payload
5. Server uploads to ImgBB API → gets back permanent CDN URL
6. URL stored in `media_uploads` table and attached to the form as `media_urls[]`

### Limits

| Limit | Value |
|---|---|
| Per file | 10 MB |
| Total payload per form | 25 MB |
| Max files per upload call | 10 |

### Supported file types

`image/*` (JPG, PNG, WEBP, GIF), `.pdf`, `.docx`, `.xlsx`, `.txt`, `.zip`

> For non-image files, ImgBB will reject them. To support all file types, replace the ImgBB handler with Vercel Blob (`@vercel/blob`) — the code structure in `api/uploads/imgbb.js` is designed for easy provider swapping.

---

## 13. PDF & Excel Reports

### PDF Export

Generated with `jsPDF` + `jspdf-autotable`. Features:
- Strict **A4 size** (210 × 297mm portrait)
- **Cover page** with company branding, summary stats
- **Expense summary table** with all records
- **Per-invoice pages** with green sidebar layout, client details, line items, VAT breakdown, grand total
- **Auto-stamp**: export timestamp + admin user ID
- **Footer**: Page numbers, print timestamp
- File name: `Alpha-Ultimate-FinancialReport-YYYY-MM-DD.pdf`

### Excel Export

Generated with `xlsx` library. Features:
- Multi-sheet workbook: **Expenses** tab + **Invoices** tab
- All fields: Form #, Submitted By, Project/Client, Amount, Status, Date
- File name: `Alpha-Ultimate-Report-YYYY-MM-DD.xlsx`

---

## 14. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | NeonDB PostgreSQL connection string (must end with `?sslmode=require`) |
| `JWT_SECRET` | ✅ | Secret for HMAC-SHA256 JWT signing. Min 64 characters. Generate with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `IMGBB_API_KEY` | ✅ | ImgBB API key from https://api.imgbb.com |

---

## 15. Troubleshooting

### "DATABASE_URL is not set"
- Verify env var is added in Vercel → Project → Settings → Environment Variables
- Make sure it's enabled for **Production** environment
- Redeploy after adding env vars

### "Invalid or expired token"
- JWT has 7-day expiry by default
- Log out and log back in
- If happening immediately, check `JWT_SECRET` is set correctly in both local and Vercel

### Login fails with "Invalid username or password"
- Make sure you ran the full `schema.sql` in NeonDB
- Default credentials: `admin` / `Admin@12345`
- Check the user exists: `SELECT username, is_active FROM users;` in Neon SQL Editor

### Files not uploading
- Check `IMGBB_API_KEY` is correct
- ImgBB only accepts image formats (JPG/PNG/WEBP/GIF) — PDFs will be rejected
- Check browser console for the specific error message

### Vercel build fails with TypeScript errors
```bash
# Run locally to see the exact errors
npm run build
# Fix errors then push again
```

### Vercel function timeout
- Vercel Hobby plan has 10s function timeout
- Complex DB queries should complete within this limit
- If exceeding, upgrade to Vercel Pro (60s limit) or optimise queries

### Termux push fails: "Permission denied"
```bash
chmod +x termux-push.sh
bash termux-push.sh setup  # Re-run setup to refresh token
```

### Nothing happening after push to GitHub
- Check Vercel dashboard → Deployments tab for build logs
- Make sure the Vercel project is connected to the correct GitHub repo
- Verify auto-deploy is enabled: Vercel → Project → Settings → Git

---

## 16. Default Credentials

> ⚠️ **CHANGE THESE IMMEDIATELY after first deployment!**

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `Admin@12345` |
| Email | `admin@alpha-ultimate.com` |
| Role | `superuser` |

### How to change the admin password

Option A — Via the Users page (in-app):
1. Login as admin
2. Go to **Users** → click edit on the admin user
3. Enter new password → Save

Option B — Via NeonDB SQL Editor:
```sql
UPDATE users
SET password_hash = encode(digest('YourNewPassword123!', 'sha256'), 'hex')
WHERE username = 'admin';
```

---

## 17. Security Checklist

Before going live, verify:

- [ ] Changed default `admin` password from `Admin@12345`
- [ ] Set a strong, unique `JWT_SECRET` (64+ character hex string)
- [ ] `DATABASE_URL` is set in Vercel env vars (not committed to git)
- [ ] `.env.local` is in `.gitignore` (never push secrets to GitHub)
- [ ] NeonDB project is set to allow connections only from Vercel's IP range (optional, advanced)
- [ ] Reviewed user permissions — no staff user has `superuser` access accidentally
- [ ] ImgBB API key is set
- [ ] Tested: Submit-only users cannot view other users' records (data isolation)
- [ ] Tested: Rejection comments are required — cannot approve blank rejections
- [ ] Tested: Immutable forms — cannot edit after submission

---

## Project Structure

```
erp-v5/
├── api/                          # Vercel Serverless Functions
│   ├── _auth.js                  # JWT sign/verify, password hash helpers
│   ├── _db.js                    # NeonDB connection singleton
│   ├── admin/
│   │   └── finance.js            # Unified finance handler (expenses, invoices, approvals, notifications)
│   ├── auth/
│   │   ├── login.js              # POST /api/auth/login
│   │   └── me.js                 # GET /api/auth/me
│   ├── expenses/
│   │   ├── index.js              # GET/POST /api/expenses
│   │   └── approve.js            # POST /api/expenses/approve
│   ├── invoices/
│   │   ├── index.js              # GET/POST /api/invoices
│   │   └── approve.js            # POST /api/invoices/approve
│   ├── users/
│   │   ├── index.js              # GET/POST /api/users
│   │   └── [id].js               # PATCH/DELETE /api/users/:id
│   ├── permissions/
│   │   └── index.js              # GET/PUT /api/permissions
│   ├── reports/
│   │   ├── dashboard.js          # GET /api/reports/dashboard
│   │   └── wallet.js             # GET /api/reports/wallet
│   └── uploads/
│       └── imgbb.js              # POST /api/uploads/imgbb
├── sql/
│   └── schema.sql                # Full NeonDB schema (run once)
├── src/
│   ├── assets/
│   │   └── logo.jpg              # Alpha Ultimate branding
│   ├── components/
│   │   └── admin/
│   │       ├── ERPExpenseForm.tsx      # Immutable form + camera upload
│   │       └── PermissionMatrix.tsx   # Granular permission assignment UI
│   ├── lib/
│   │   ├── AuthContext.tsx        # JWT auth context + localStorage
│   │   ├── LangContext.tsx        # EN/BN bilingual context
│   │   ├── auth.ts               # Permission level helpers
│   │   └── api.ts                # Typed fetch wrapper
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── ERPLayout.tsx          # Shell: sidebar + notification bell
│   │   ├── Dashboard.tsx          # Charts, stats, quick actions
│   │   ├── ExpensesPage.tsx
│   │   ├── ExpenseFormPage.tsx    # → ERPExpenseForm
│   │   ├── InvoicesPage.tsx
│   │   ├── InvoiceFormPage.tsx
│   │   ├── ApprovalDashboard.tsx
│   │   ├── UsersPage.tsx
│   │   ├── PermissionsPage.tsx    # → PermissionMatrix
│   │   ├── ReportsPage.tsx        # PDF + XLSX export
│   │   └── WalletPage.tsx
│   ├── App.tsx                   # Routes + Auth guard
│   ├── index.css                 # Design system CSS variables + utilities
│   ├── main.tsx                  # React entry point
│   └── vite-env.d.ts
├── public/
│   ├── assets/                   # Logo PNGs (16px, 32px, 64px, 192px, 512px)
│   ├── favicon.svg
│   └── manifest.json             # PWA manifest
├── .env.example                  # Template for environment variables
├── .gitignore
├── index.html                    # Vite HTML entry
├── package.json                  # v5.0.0 — all dependencies
├── postcss.config.js
├── tailwind.config.js
├── termux-push.sh                # ← Termux git push script
├── tsconfig.json
├── tsconfig.node.json
├── vercel.json                   # Vercel config with security headers
└── vite.config.ts                # Vite + code splitting
```

---

## License

Private & Confidential — Alpha Ultimate Ltd, Riyadh, Saudi Arabia.  
All rights reserved © 2025.

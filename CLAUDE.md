# CLAUDE.md

Orientation for developers and AI agents working in this repository.

---

## What this is

**stemrc** is the **STEM Research Club student portal for Green Level HS (GLHS)** —
a single-page web app oriented around science-fair (ISEF / NCSEF) participation.
Members and admins share a dashboard to log meeting attendance via daily codes,
sign up for mentor/volunteer shifts, browse & download official ISEF regulatory
forms with guidance, upload research documents for admin review, and file/answer
questions.

> This is the STEM **research** club dashboard — **distinct from STEM Racing**
> (the F1-in-Schools team, a separate activity).

**Current state: fully operational.** Auth, database, and file storage run on
**Supabase** (project `stemrc`, free tier, org "GLHS STEMRC"); hosting is
**Vercel** (project `stem-dashboard-glhs`, Hobby tier) at
https://stem-dashboard-glhs.vercel.app. Role (`student` vs `admin`) comes from
the `profiles` table. Students self-register on the login page (Create Account:
name, email, password → `auth.signUp` with name in user metadata); a DB trigger
auto-creates their profile as `student`. Email confirmation is DISABLED in
Supabase auth settings (free-tier SMTP can't reach student inboxes). Admins are
promoted by setting `role = 'admin'` on the profile row.

The app opens on a **public homepage** (`HomePage` in App.jsx) with club info,
officers, and a "Member Login" button that leads to `LoginPage` → the portal.
Signed-in users can hop between portal and homepage ("View Homepage" in the
sidebar ↔ "Open Portal" on the homepage) via the `view` state in `App`.
Theme: Green Level colors — green for interactive elements (`green-700`), navy
for identity, the hero band, the portal sidebar, and the footer (`blue-950`).

## The 30-second mental model

```
index.html → src/main.jsx → src/App.jsx   ← ~2,400 lines = the WHOLE app UI
                                 │
   src/lib/supabase.js (client) + static data (ISEF_FORMS, WIZARD_QUESTIONS) + reusable UI (Modal, Toast, DocViewerModal)
                                 │
   Sidebar → activeTab dispatch (no router) → 6 tab components
                                 │
   each tab fetches its own data from Supabase; RLS scopes rows per role
```

Six tabs: **Attendance** (admin sets a daily code in `attendance_codes`; students
check in via the `log_attendance` RPC), **Mentor Sign-Up** (shifts + signups,
capacity enforced by a DB trigger), **Forms** (an 8-question wizard that recommends
which ISEF forms a project needs + per-form guidance + PDF view/download — fully
static), **Research Hub** (uploads to the private `documents` storage bucket, 5 MB
cap; admin approve/deny), **Questions** (tickets + replies), **Roster** (admin-only
attendance matrix; meeting dates = rows in `attendance_codes`).

## Backend (Supabase)

- Schema, RLS policies, functions, and the storage bucket live in
  `supabase/schema.sql` + `supabase/followup.sql` — the source of truth for the DB.
- Env vars: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (publishable key) in
  `.env.local` locally (gitignored; see `.env.example`) and in Vercel project
  settings for production. The publishable key is safe to expose; RLS is the
  security boundary — never weaken a policy casually.
- Students never read `attendance_codes`; check-in goes through the
  security-definer RPC `log_attendance(p_code)`.
- Free-tier note: a Supabase free project **pauses after ~1 week with no
  traffic** and must be resumed from the dashboard. Regular club use prevents it.

## Repository layout

| Path | What it is |
|------|------------|
| `src/App.jsx` | **the entire application** — mock data, icons, reusable UI, all 6 tabs, root `App` |
| `src/main.jsx` | React bootstrap (`createRoot` → `<App/>`) |
| `index.html` | HTML shell / app title; loads Inter font |
| `src/index.css` | Tailwind directives / global styles |
| `public/pdfs/` | **18 real ISEF & NCSEF 2025–2026 forms**, served statically at `/pdfs/...` |
| `dist/` | committed production build output |
| `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `.nvmrc` | build/style config (Node 18) |

## Running it

```bash
# Node 18 (.nvmrc pins it; fnm/nvm will pick it up)
npm install
npm run dev            # Vite dev server
npm run build          # production build → dist/
```

## Deploy

- **Vercel** (`vercel.json`: framework vite, build `npm run build`, output `dist`).
- **Build quirk (don't "fix" it):** the npm scripts call Vite as
  `node node_modules/vite/bin/vite.js` rather than the `vite` bin — a deliberate
  workaround for a Vercel exit-126 / `.bin` permission problem. Keep it.

## Conventions & gotchas (read before editing)

- **The Forms wizard maps to real forms.** `WIZARD_QUESTIONS` `required` tags map to
  `ISEF_FORMS`, which point at the real PDFs in `public/pdfs/`. When updating forms,
  keep the wizard tags, the `ISEF_FORMS` entries, and the PDF files in sync.
- **PDFs render natively** — there is no PDF library; the `DocViewerModal` uses the
  browser's native rendering with `MOCK_DOC_PREVIEWS` text fallbacks. Don't add a heavy
  PDF dependency.
- **No router.** Navigation is `activeTab` state in `App`. Add a tab = a component +
  a `Sidebar` entry + a dispatch branch.
- **Migration leftover:** `.claude/settings.local.json` still references Windows paths /
  PowerShell — harmless, clean up when convenient.

## Honest scope

A real, deployed app on free tiers: Supabase (auth + Postgres + storage, RLS
throughout) and Vercel hosting. Known gaps: no in-app password change or reset
(admins reset passwords in the Supabase dashboard — email-based reset would need
custom SMTP), no in-app account creation (admins add users in the dashboard),
and profile names default to the email prefix unless set via user metadata or
edited by an admin.

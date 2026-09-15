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

**Current state: front-end only.** All data is hardcoded mock state held in React;
there is **no backend, no database, no auth server.** Role (`student` vs `admin`)
comes from which mock account you sign in with (`CLUB_USERS`); there is no visible
demo UI. The obvious next frontier is real persistence/auth.

The app opens on a **public homepage** (`HomePage` in App.jsx) with club info,
officers, and a "Member Login" button that leads to `LoginPage` → the portal.
Theme: Green Level colors — green for interactive elements (`green-700`), navy
for headings/identity (`blue-900`/`blue-950`).

## The 30-second mental model

```
index.html → src/main.jsx → src/App.jsx   ← ~2,000 lines = the WHOLE app
                                 │
   mock data (CLUB_USERS, ISEF_FORMS, WIZARD_QUESTIONS, INITIAL_*)  +  reusable UI (Modal, Toast, DocViewerModal)
                                 │
   Sidebar → activeTab dispatch (no router) → 6 tab components
                                 │
   top-level state in App: user, activeRole, activeTab, attendanceLogs, documents, tickets
```

Six tabs: **Attendance** (daily code `RESEARCH2026`), **Mentor Sign-Up** (shifts),
**Forms** (an 8-question wizard that recommends which ISEF forms a project needs +
per-form guidance + PDF view/download), **Research Hub** (doc upload + admin
approve/deny), **Questions** (tickets), **Roster** (admin-only).

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

- **Everything is mock data in `App.jsx`.** Two mock accounts (`student@stemrc.org`,
  `admin@stemrc.org`); the attendance code is `RESEARCH2026`. These are not secrets.
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

A front-end-only prototype with mock data — no persistence, auth server, or backend.
It demonstrates the full club workflow (attendance, shifts, ISEF form guidance, doc
review, Q&A) but nothing is saved across reloads. State that plainly; the real next
step is a backend + auth.

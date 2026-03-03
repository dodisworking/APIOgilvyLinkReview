## Production Review Hub (Web-Only, Mobile First)

This is a mobile-first website for:
- day-by-day production schedule
- Frame.io review link version history
- role-based access (Client, Editor, Ogilvy, hidden Admin)
- email alerts when links are posted

No Xcode is needed. This is a pure web app.

## Quick Start

1) Install dependencies

```bash
npm install
```

2) Configure email variables (Gmail)

```bash
cp .env.example .env.local
```

Set:
- `GMAIL_USER`: your Gmail address
- `GMAIL_APP_PASSWORD`: Gmail app password (not your normal password)
- `NEXT_PUBLIC_ADMIN_PASSWORD`: hidden admin password (defaults to `123`)
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key

3) Run dev server

```bash
npm run dev
```

4) Open `http://localhost:3000` on desktop or phone browser.

## Default Behavior

- Data is seeded from your provided schedule.
- If Supabase env vars are set, app reads/writes shared data in Supabase.
- If Supabase env vars are not set, app falls back to browser `localStorage`.
- Editors can post Frame.io links by version and notify selected teams.
- Admin can add/remove contacts and send targeted blast reminders.
- Admin can also edit schedule day/time/notes for each video.

## Supabase Setup (Recommended)

1) In Supabase SQL editor, run:
- `supabase/schema.sql`
- `supabase/seed.sql`

2) Create auth users in Supabase Auth.

3) Add matching rows in `profiles` with role:
- `editor`
- `client`
- `ogilvy`
- `admin`

The schema includes role model tables and RLS policies.

## Notes

- If Gmail env vars are missing, link posting still works, but email send will fail with a clear message.
- For production security, replace simple hidden admin access with strict auth-only admin access.

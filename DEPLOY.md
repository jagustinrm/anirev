# Deploying this app to Vercel

This document collects the exact steps and the environment variables required to deploy the Next.js app in `next-app` to Vercel.

1) Connect repository to Vercel
- Go to https://vercel.com/new and import the repository `jagustinrm/anirev`.
- Vercel detects Next.js automatically. Proceed to create the project.

2) Important environment variables (set these in Project Settings → Environment Variables on Vercel)
- NEXT_PUBLIC_SUPABASE_URL = https://<YOUR-PROJECT>.supabase.co
- NEXT_PUBLIC_SUPABASE_ANON_KEY = <Publishable_key> (anteriormente llamada anon key)
- SUPABASE_SERVICE_ROLE_KEY = <Secret_key> (anteriormente llamada service_role key; server-only; no exponer en el cliente)
- SUPABASE_DB_URL = postgres://<user>:<pass>@<host>:5432/<db>  (only if you plan to run migrations from CI)
- NEXT_PUBLIC_APP_URL = https://<your-vercel-domain>

Notes:
- Add variables for both Preview and Production as needed. On Vercel you can set values per environment.

3) Run DB migrations
- Before allowing production traffic, run the SQL migrations located in `backend/supabase-migrations.sql`. You can run them locally or from a CI runner that has `SUPABASE_DB_URL` set.

PowerShell example (local):
```powershell
# run migrations locally (you must set SUPABASE_DB_URL first)
$env:SUPABASE_DB_URL = 'postgres://user:pass@host:5432/db'
node .\scripts\run-migrations.js
Remove-Item Env:\SUPABASE_DB_URL
```

4) Google OAuth (Supabase) — quick checklist
- Create OAuth Client ID in Google Cloud Console.
- Set Authorized redirect URI to: `https://<YOUR-SUPABASE>.supabase.co/auth/v1/callback`
- In Supabase Dashboard → Authentication → Providers → Google: paste Client ID + Client Secret and enable.
- In Supabase Dashboard → Authentication → Settings → Redirect URLs: add your Vercel domain `https://<your-vercel-domain>` and `http://localhost:3000` (for local testing).

5) After deploying
- Visit Your Vercel deployment URL, test login (email + Google), create a review and Add to My List.
- Check Vercel Deploy logs (for build errors) and Supabase Logs (for database/auth issues).

6) Optional production hardening
- Use Upstash / Redis Cloud for shared caching (replace in-memory maps in API routes).
- Revisit RLS policies in Supabase and ensure `SUPABASE_SERVICE_ROLE_KEY` is only used in server-side code.

If you want, I can (pick one):
- Add a small `vercel` GitHub Action to run migrations post-deploy (requires SUPABASE_DB_URL secret), or
- Create a step-by-step walkthrough while you configure Vercel UI (I'll wait for you to do each action and validate).

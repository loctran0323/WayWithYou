# Deploy HandyRides on Vercel

Vercel runs Django as a **serverless Python function** (not a long-running server). It works, but **Render or Heroku are usually simpler** for full Django + Postgres. Use Vercel if you already use it for other projects.

## What was added in the repo

- **`api/wsgi.py`** – Exposes `app` for Vercel’s Python runtime (required).
- **`vercel.json`** – Routes all traffic to that handler and runs `collectstatic` at build time.
- **`ALLOWED_HOSTS`** – Includes `.vercel.app` by default.

## Requirements

1. **Postgres (required)**  
   SQLite does **not** persist on Vercel’s filesystem. Create a database (e.g. [Neon](https://neon.tech), [Supabase](https://supabase.com), or [Vercel Postgres](https://vercel.com/storage/postgres)) and set **`DATABASE_URL`** in the Vercel project **Environment Variables**.

2. **Environment variables** (Vercel → Project → Settings → Environment Variables)

   | Name | Example / notes |
   |------|------------------|
   | `DATABASE_URL` | From Neon/Supabase (must include `sslmode=require` if your provider needs it) |
   | `SECRET_KEY` | Long random string (production) |
   | `DEBUG` | `False` |
   | `ALLOWED_HOSTS` | `.vercel.app` or your custom domain, comma-separated |

3. **Migrations and data (one-time)**  
   Vercel does not run `migrate` on every deploy by default. After the first successful deploy, run migrations against production from your machine:

   ```bash
   # Install Vercel CLI: npm i -g vercel
   vercel env pull .env.production   # pulls env vars (or copy DATABASE_URL manually)
   export DATABASE_URL="postgresql://..."   # same value as in Vercel
   python manage.py migrate
   python manage.py load_initial_data       # optional: Princeton rides if DB is empty
   ```

   Or use your host’s SQL console / a small CI job that runs `migrate` only when you choose.

## Deploy steps

1. Push the project to **GitHub**.
2. Go to [vercel.com](https://vercel.com) → **Add New** → **Project** → import the repo.
3. **Framework Preset:** Other (or let Vercel detect).
4. **Build Command:** leave default if it matches `vercel.json` (`pip install ... && collectstatic`).
5. **Output Directory:** leave empty (not a static export).
6. Add **`DATABASE_URL`** (and other env vars) for **Production** (and Preview if you want).
7. **Deploy**.

Your app will be at `https://<project>.vercel.app`. Paths like `/rides/` work the same as locally.

## Caveats

- **Cold starts** – First request after idle can be slow.
- **No `Procfile` on Vercel** – `release` / `load_initial_data` from Heroku do not run; handle migrations yourself.
- **Function size / timeouts** – Very large projects may hit limits; upgrade plan if needed.

For a class project, **Render** (see `DEPLOY.md`) is often easier: one web service + Postgres + automatic migrate hook.

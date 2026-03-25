# Deploy HandyRides to a website

Your app is ready to deploy. Use **Render** (free tier, no credit card) or **Heroku**.

**Vercel:** Django is possible but serverless and needs external Postgres—see **`DEPLOY_VERCEL.md`**.

---

## Option 1: Render (recommended, free)

1. **Push your code to GitHub** (if not already):
   ```bash
   git init
   git add .
   git commit -m "HandyRides app"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

2. **Go to [render.com](https://render.com)** and sign up (free with GitHub).

3. **New → Web Service**
   - Connect your GitHub repo.
   - **Name:** handirides (or any name).
   - **Environment:** Python 3.
   - **Build command:**
     ```bash
     pip install -r requirements.txt && python manage.py collectstatic --noinput
     ```
   - **Start command:** Use this so **migrations and sample data run without Shell** (needed on **free** tier — Shell may be unavailable):
     ```bash
     python manage.py migrate --noinput && python manage.py load_initial_data && gunicorn HandyRides.wsgi
     ```
     If you prefer to run migrate yourself (e.g. paid Shell), you can use only: `gunicorn HandyRides.wsgi`
   - **Python version (required):** Django 3.1 does **not** work on Python 3.12+ (missing `distutils`). Do **one** of:
     - Add **Environment** variable `PYTHON_VERSION` = `3.10.14`, **or**
     - Commit the repo’s **`.python-version`** file (already in this project: `3.10.14`) and redeploy.
     If logs show **Python 3.14** and `ModuleNotFoundError: No module named 'distutils'`, you are still on the wrong Python—set `PYTHON_VERSION` in the Render dashboard and **Clear build cache & deploy**.

   If the deploy log shows `Running 'gunicorn app:app'` and **ModuleNotFoundError: No module named 'app'**, fix **Start Command** as above (include `gunicorn HandyRides.wsgi` at the end), then redeploy.

4. **Add a PostgreSQL database (required — without this you get `no such table: auth_user`)**
   - Render Dashboard → **New** → **PostgreSQL** (free tier exists).
   - Pick a name, region (same as your Web Service if possible), **Create Database**.
   - Wait until it shows **Available**, then open that database.
   - Find **Internal Database URL** (under *Connections* or *Info*). Copy it.
   - Open your **Web Service** (not the DB) → **Environment** → **Add Environment Variable**:
     - **Key:** `DATABASE_URL`
     - **Value:** paste the **Internal Database URL** exactly.
   - **Save Changes** — Render will redeploy. Your app will use Postgres instead of empty SQLite.

5. **Optional env vars** (Web Service → Environment):
   - `DEBUG` = `False`
   - `SECRET_KEY` = (a long random string for production)
   - `ALLOWED_HOSTS` = `.onrender.com` (or leave default)

6. **Save** – Render will build and deploy. Your site will be at `https://YOUR-SERVICE-NAME.onrender.com`.

7. **Database tables + Princeton rides (free tier)**  
   If you used the **start command** above, each deploy runs `migrate` and `load_initial_data` automatically (`load_initial_data` does nothing once rides exist).  
   **Without** that start command, you’d run those in Shell (paid) or from your laptop with `DATABASE_URL` set to your Render Postgres **External** URL.

---

## Option 2: Heroku

1. **Install [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)** and log in:
   ```bash
   heroku login
   ```

2. **Create app and add Postgres:**
   ```bash
   cd /Users/loctran/Downloads/Orf401S26_HandiRides
   heroku create
   heroku addons:create heroku-postgresql:mini
   ```

3. **Deploy:**
   ```bash
   git init
   git add .
   git commit -m "Deploy HandyRides"
   git push heroku main
   ```
   (If your branch is `master`, use `git push heroku master`.)

4. **Migrations run automatically** (Procfile `release`). Open the app:
   ```bash
   heroku open
   ```

5. **Princeton rides load automatically** on first deploy (Procfile runs `load_initial_data` after migrate). To load them again or manually:
   ```bash
   heroku run python manage.py load_initial_data
   ```

---

## After deploy

- **Static files:** Served by WhiteNoise; no extra config if you used the build command above.
- **Database:** SQLite locally; Postgres on Render/Heroku via `DATABASE_URL`.
- **Map/route:** Works with OSM + client-side fallback; set `MAPBOX_ACCESS_TOKEN` in env for Mapbox routes.

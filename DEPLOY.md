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
   - **Start command:**
     ```bash
     gunicorn HandyRides.wsgi
     ```

4. **Add a PostgreSQL database**
   - Dashboard → **New → PostgreSQL**.
   - Create the DB, then go to your Web Service → **Environment**.
   - Copy **Internal Database URL** from the new PostgreSQL service and add:
     - Key: `DATABASE_URL`  
     - Value: (paste the Internal Database URL)

5. **Optional env vars** (Web Service → Environment):
   - `DEBUG` = `False`
   - `SECRET_KEY` = (a long random string for production)
   - `ALLOWED_HOSTS` = `.onrender.com` (or leave default)

6. **Save** – Render will build and deploy. Your site will be at `https://YOUR-SERVICE-NAME.onrender.com`.

7. **Load Princeton rides (one-time)**  
   In the Render **Shell** for your Web Service:
   ```bash
   python manage.py load_initial_data
   ```
   This loads `princeton_rides.json` so the site has all the Princeton-area rides. (If the table already has data, it skips.)

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

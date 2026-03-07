# Seoapp

SEO audit tool that crawls websites, analyzes 20+ SEO metrics, and generates detailed reports (HTML/PDF/DOCX). Features real-time progress via SSE, multi-language support (EN/UK/RU), subscription plans with Paddle billing, and white-label branding.

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS v4
- **Backend:** Python FastAPI (crawling + analysis), Next.js API routes (auth + DB)
- **Database:** SQLite via Prisma ORM
- **Auth:** NextAuth v5 (Google OAuth + credentials)
- **Browser:** Playwright (headless Chromium for crawling + screenshots)
- **Billing:** Paddle
- **i18n:** next-intl (frontend), custom JSON-based (backend)

## Prerequisites

- Node.js 20+
- Python 3.11+
- System packages (Ubuntu/Debian):

```bash
apt update && apt install -y python3-venv python3-pip nginx certbot python3-certbot-nginx \
    libpango1.0-dev libcairo2-dev libgdk-pixbuf2.0-dev libffi-dev \
    libjpeg-dev libgif-dev librsvg2-dev
```

WeasyPrint (PDF export) requires the `libpango`, `libcairo`, and `libgdk-pixbuf` system libraries listed above.

## Initial Setup

### 1. Create app user and clone

```bash
sudo useradd -m -s /bin/bash seoapp
sudo mkdir -p /var/www/seoapp
sudo chown seoapp:seoapp /var/www/seoapp

# Clone to a temp location (deploy.sh syncs to /var/www/seoapp)
git clone <repo-url> /tmp/seoapp
```

### 2. Python environment

```bash
sudo -u seoapp python3 -m venv /var/www/seoapp/venv
sudo -u seoapp /var/www/seoapp/venv/bin/pip install -r /tmp/seoapp/requirements.txt
```

### 3. Playwright browsers

```bash
sudo -u seoapp PLAYWRIGHT_BROWSERS_PATH='/var/www/seoapp/.cache/ms-playwright' \
    /var/www/seoapp/venv/bin/playwright install chromium
```

### 4. Frontend setup

```bash
cd /tmp/seoapp/frontend
npm install
```

### 5. Environment variables

```bash
# Frontend
sudo -u seoapp cp /tmp/seoapp/frontend/.env.example /var/www/seoapp/frontend/.env
sudo -u seoapp nano /var/www/seoapp/frontend/.env

# Backend (optional — only needed if overriding defaults)
sudo -u seoapp nano /var/www/seoapp/.env
```

See [Environment Variables](#environment-variables) below for all options.

### 6. Database

```bash
cd /tmp/seoapp/frontend
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
```

### 7. First deploy

```bash
cd /tmp/seoapp
bash deploy.sh --force
```

### 8. Systemd services

```bash
sudo cp /var/www/seoapp/seoapp.service /etc/systemd/system/
sudo cp /var/www/seoapp/nextjs-seoapp.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable seoapp nextjs-seoapp
sudo systemctl start seoapp nextjs-seoapp
```

### 9. Nginx + SSL

```bash
sudo cp /var/www/seoapp/nginx-seoapp.conf /etc/nginx/sites-available/seoapp.conf
sudo ln -sf /etc/nginx/sites-available/seoapp.conf /etc/nginx/sites-enabled/
# Edit server_name in the config to match your domain
sudo nginx -t && sudo systemctl reload nginx

# SSL (replace with your domain)
sudo certbot --nginx -d seo.yourdomain.com
```

## Environment Variables

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | SQLite path, e.g. `file:./prod.db` |
| `AUTH_SECRET` | Yes | Random string for NextAuth session encryption |
| `AUTH_URL` | Yes | Public URL, e.g. `https://seo.yourdomain.com` |
| `AUTH_GOOGLE_ID` | No | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | No | Google OAuth client secret |
| `FASTAPI_URL` | Yes | Internal FastAPI URL, e.g. `http://127.0.0.1:8000` |
| `NEXT_PUBLIC_FASTAPI_URL` | Yes | Public FastAPI URL (same as above for same-server setup) |
| `ADMIN_EMAIL` | No | Email that gets admin role on sign-up |
| `CRON_SECRET` | No | Auth token for cron job endpoints |
| `TOKEN_ENCRYPTION_KEY` | No | 32-byte hex key for OAuth token encryption |
| `PADDLE_API_KEY` | No | Paddle server-side API key |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | No | Paddle client-side token |
| `NEXT_PUBLIC_PADDLE_ENV` | No | `sandbox` or `production` |
| `PADDLE_WEBHOOK_SECRET` | No | Paddle webhook signature secret |
| `SMTP_HOST` | No | SMTP server for transactional emails |
| `SMTP_PORT` | No | SMTP port (default: 587) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `EMAIL_FROM` | No | Sender email address |

### Backend (`.env` in project root)

| Variable | Required | Default | Description |
|---|---|---|---|
| `CORS_ORIGINS` | No | `http://localhost:3000,...` | Allowed CORS origins |
| `PAGESPEED_API_KEY` | No | None | Google PageSpeed Insights API key |
| `MAX_PAGES` | No | `100` | Max pages to crawl per audit |
| `PARALLEL_REQUESTS` | No | `8` | Concurrent crawl requests |
| `TOTAL_TIMEOUT` | No | `600` | Total crawl timeout (seconds) |

## Deployment

To deploy updates:

```bash
cd /tmp/seoapp   # or wherever you cloned
git pull
bash deploy.sh
```

Use `--force` to skip all caching and do a full reinstall:

```bash
bash deploy.sh --force
```

The script handles: file sync, dependency install (skips if unchanged), build, database migrations, service restart, and health checks.

## Project Structure

```
app/                        # FastAPI backend
  main.py                   # Routes, audit orchestration
  crawler.py                # Async BFS crawler with Playwright
  config.py                 # Settings (env vars)
  analyzers/                # 20+ SEO analyzer modules
  locales/                  # Backend i18n (en/uk/ru)
  templates/                # Jinja2 report templates

frontend/
  src/
    app/                    # Next.js App Router
      [locale]/             # Locale-prefixed routes
      api/                  # API routes (auth, audit, billing)
    components/             # React components
    hooks/                  # Custom hooks
    lib/                    # Auth, Prisma, utilities
  prisma/                   # Schema, migrations, seed
  messages/                 # Frontend i18n (en/uk/ru)

deploy.sh                   # Deployment script
seoapp.service              # systemd — FastAPI
nextjs-seoapp.service       # systemd — Next.js
nginx-seoapp.conf           # Nginx reverse proxy config
```

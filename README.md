# seoapp

seo audit and indexing tool. crawls websites, runs 20+ checks, generates reports (html/pdf/docx), and submits pages to google/bing for indexing.

**[live](https://seo.lvdev.co)**

## what it does

- crawls any website with headless chromium (playwright)
- runs 20+ analyzers in parallel - meta tags, headings, images, links, speed, schema, security, mobile, duplicates, redirects, and more
- generates downloadable reports in html, pdf, and docx
- real-time progress via server-sent events
- submits pages to google and bing indexing apis
- subscription plans with paddle billing
- white-label branding support
- i18n - english, ukrainian, russian

## stack

- **frontend** - next.js 16, react 19, typescript, tailwind css v4
- **backend** - python fastapi (crawling + analysis), next.js api routes (auth + db)
- **database** - sqlite via prisma
- **auth** - nextauth v5 (google oauth + credentials)
- **browser** - playwright (headless chromium)
- **billing** - paddle

## setup

requires node.js 20+ and python 3.11+

```bash
# backend
python3 -m venv venv
venv/bin/pip install -r requirements.txt
venv/bin/playwright install chromium

# frontend
cd frontend
cp .env.example .env  # fill in your values
npm install
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
```

## running locally

```bash
# terminal 1 - backend
uvicorn app.main:app --reload

# terminal 2 - frontend
cd frontend && npm run dev
```

open http://localhost:3000

## deploy

```bash
bash deploy.sh         # incremental
bash deploy.sh --force # full rebuild
```

uses nginx + systemd. see `deploy.sh`, `seoapp.service`, `nextjs-seoapp.service`, and `nginx-seoapp.conf`.

## structure

```
app/                    # fastapi backend
  main.py               # routes + audit orchestration
  crawler.py            # async bfs crawler with playwright
  analyzers/            # 20+ seo analyzer modules
  locales/              # backend i18n
  templates/            # report templates

frontend/
  src/
    app/                # next.js app router
      [locale]/         # locale-prefixed routes
      api/              # api routes (auth, audit, indexing, billing)
    components/         # react components
    lib/                # auth, prisma, api client
  prisma/               # schema + migrations
  messages/             # frontend i18n
```

## license

MIT

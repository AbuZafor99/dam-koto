# PriceBD - Smart Price Comparison for Bangladesh

AI-powered price comparison website for Bangladeshi online stores. Search any product, compare prices across stores, and find the best deals.

## Features

- 🔍 Search any product — scans multiple Bangladeshi stores
- 💰 Shows offer/sale prices (not just original prices)
- 📊 Prices ranked lowest first
- 🏪 Blocks Daraz, Facebook Marketplace, YouTube
- 🏷️ New/Used product filter
- ⚡ AI-powered price extraction with regex + LLM fallback
- 🔒 Rate limiting, input sanitization, and caching

## Tech Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS 4** + **shadcn/ui**
- **z-ai-web-dev-sdk** for web search & AI extraction

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/pricebd.git
cd pricebd

# 2. Install dependencies
npm install

# 3. Create .env file (you need a Z-AI API key)
echo "ZAI_API_KEY=your_api_key_here" > .env

# 4. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel (Recommended)

**⚠️ GitHub Pages won't work** — this app has server-side API routes that need a Node.js runtime. GitHub Pages only serves static files.

### Option 1: Vercel (Free & Easiest)

1. Go to [vercel.com](https://vercel.com) and sign up with GitHub
2. Click **"Add New Project"** → Import your `pricebd` repo
3. Add environment variable: `ZAI_API_KEY` = your API key
4. Click **Deploy** — done! You get a live URL like `pricebd.vercel.app`

### Option 2: Other Platforms

| Platform | How |
|----------|-----|
| **Railway** | Connect GitHub repo → add env var → auto-deploy |
| **Render** | New Web Service → connect repo → add env var |
| **Fly.io** | `fly launch` → `fly secrets set ZAI_API_KEY=xxx` → `fly deploy` |

## Project Structure

```
pricebd/
├── src/
│   ├── app/
│   │   ├── page.tsx          # Main single-page UI
│   │   ├── layout.tsx        # Root layout + metadata
│   │   ├── globals.css       # Global styles
│   │   └── api/
│   │       └── search/
│   │           └── route.ts  # Search API (web search + AI extraction)
│   ├── components/ui/        # shadcn/ui components
│   ├── hooks/                # React hooks
│   └── lib/                  # Utility functions
├── public/                   # Static assets
├── package.json
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ZAI_API_KEY` | ✅ Yes | API key for z-ai-web-dev-sdk (web search + AI) |

## How It Works

1. User searches a product name
2. Backend runs web search via `z-ai-web-dev-sdk`
3. Results are filtered (blocked domains, accessories, irrelevant items)
4. Regex extracts prices first (fast path)
5. LLM extracts prices from remaining results (deep path)
6. Results merged, deduplicated, ranked by price
7. Cached for 5 minutes for faster repeat searches

## License

MIT

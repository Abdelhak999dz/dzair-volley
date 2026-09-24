# Cloudflare — the enforcement layer (recommended)

> Menu names and free-plan quotas change from time to time; if a label below differs slightly in your
> dashboard, look for the equivalent setting. I could not test these against a live account.

Cloudflare's free plan is the strongest anti-scraping/anti-bot layer you can put in front of a static
site, because it stops abusive traffic **before** it reaches your host. Put the domain behind Cloudflare
(orange cloud on), then apply the settings below. Nothing here needs code changes.

## 1. One-click switches (Security → Bots)
| Setting | Value |
|---|---|
| **Block AI Scrapers and Crawlers** (Bots → *AI Crawl Control* / "Block AI bots") | **On** |
| **Bot Fight Mode** | **On** |
| **Browser Integrity Check** (Settings → Security) | **On** |
| **Security Level** | Medium (High while under attack) |
| **Always Use HTTPS** + **Automatic HTTPS Rewrites** | On |
| **Minimum TLS version** | 1.2 |
| **HSTS** | On (max-age 12 months) |

## 2. Custom WAF rules (Security → WAF → Custom rules, 5 free)

**Rule 1 — block AI crawlers & bulk scrapers by User-Agent** → Action: **Block**
```
(lower(http.user_agent) contains "gptbot") or
(lower(http.user_agent) contains "chatgpt-user") or
(lower(http.user_agent) contains "oai-searchbot") or
(lower(http.user_agent) contains "claudebot") or
(lower(http.user_agent) contains "claude-web") or
(lower(http.user_agent) contains "anthropic-ai") or
(lower(http.user_agent) contains "ccbot") or
(lower(http.user_agent) contains "bytespider") or
(lower(http.user_agent) contains "perplexity") or
(lower(http.user_agent) contains "google-extended") or
(lower(http.user_agent) contains "amazonbot") or
(lower(http.user_agent) contains "meta-external") or
(lower(http.user_agent) contains "diffbot") or
(lower(http.user_agent) contains "imagesift") or
(lower(http.user_agent) contains "scrapy") or
(lower(http.user_agent) contains "httrack") or
(lower(http.user_agent) contains "python-requests") or
(lower(http.user_agent) contains "headlesschrome") or
(lower(http.user_agent) contains "puppeteer") or
(lower(http.user_agent) contains "playwright") or
(http.user_agent eq "")
```
*(Googlebot, Bingbot and the WhatsApp/Telegram/Facebook link-preview bots are not in this list, so
search and sharing keep working.)*

**Rule 2 — challenge suspicious automation** (Enterprise *Bot Management* only — skip on Free/Pro;
Bot Fight Mode above covers the basics there) → Action: **Managed Challenge**
```
(cf.bot_management.score lt 30 and not cf.bot_management.verified_bot)
```

**Rule 3 — challenge foreign hot-linking of your media** → Action: **Managed Challenge**
```
(http.request.uri.path matches "\.(jpe?g|png|gif|webp|mp4|webm)$") and
(http.referer ne "") and
(not http.referer contains "YOUR-DOMAIN.com")
```

## 3. Rate limiting (Security → WAF → Rate limiting rules, 1 free)
* Match: *all requests* — **60 requests per 10 seconds per IP** → Action: **Block for 10 minutes**.

## 4. Caching (keeps traffic off your origin)
* Caching → Configuration → Browser Cache TTL: *Respect existing headers*.
* Rule: `/assets/*` → Cache Level **Cache Everything**, Edge TTL **1 month**.

## 5. Supabase side (Dashboard, no code)
* Authentication → Sign In → **disable "Allow new users to sign up"** (only your admin exists).
* Authentication → Attack Protection → **enable CAPTCHA** and **leaked-password protection**.
* Settings → API → **Max rows = 500** (limits bulk pulls through the REST API).
* Reports/Logs: watch *API requests* for spikes; the `rate_limits` table shows blocked buckets.

## What this cannot do
A page that anonymous visitors can read can always be read by a determined person with a real browser,
a residential proxy and a human-like pattern. These layers make bulk copying slow, noisy and blockable;
they do not make public content secret. Keep anything truly private out of public tables.

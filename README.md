# Dzair Volley

Premium React + Vite platform for global & international volleyball —
FIVB, Olympic Games, World Championship, Nations League, and continental leagues.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (usually http://localhost:5173).

## What's inside

- **Hero** — full-viewport real volleyball match video background with a
  high-contrast dark gradient overlay, and a glowing circular gold badge
  logo (see "Using your real logo" below) — click it to open the admin login.
  Its stat row is 100% real: live/finished results and upcoming-match counts
  come straight from the live API (hidden entirely if the API isn't
  configured/loading, never shown as a placeholder), and the news/video
  counts come from real local content — no fabricated numbers anywhere.
- **Live Results** — real live/finished indoor-volleyball matches, fetched
  from a real API (see "Live volleyball data" below), with real country
  flags next to national teams and a "Show all" toggle once there are more
  than 6 matches. No mock scores.
- **Match Schedules** — real upcoming fixtures (next 7 days) with live
  per-second countdowns, real flags, and the same "Show all" toggle.
- **Videos** — real, freely-licensed playable video clips (click to play),
  with Instagram/Facebook-styled like, comment, and share buttons.
- **News** — real headlines with real photos, with the same engagement buttons.

Comments are real — clicking the comment button opens an inline box where
anyone can write and post an actual comment, saved to `localStorage` and
shown immediately. Sharing opens a real share panel (WhatsApp, Facebook, X,
copy-link, plus native share on supported devices) rather than a browser
`alert()`.

All engagement counters (views, likes, comments) start at **0** — launch-ready,
not pre-seeded with placeholder numbers. Liking increments the real count by
exactly +1 and is remembered per-visitor in `localStorage` (so reloading the
page never lets you double-count your own reaction), and a video/article's
view count ticks up once the first time you actually open it.

The whole layout — navbar, video/news grids, match cards, schedule cards,
and the admin dashboard (including its tables) — is responsive down to small
phone widths, with dedicated breakpoints so nothing overflows the screen.

News/video seed content lives in `src/App.jsx` — swap it for a live API/CMS
feed to keep it current in production.

## Live volleyball data

Live Results and Match Schedules pull **real indoor-volleyball** matches
(never beach volleyball) via the **Highlightly Volleyball API**
(`volleyball.highlightly.net`), called in `src/services/volleyballApi.js`.
Every request is made **directly from the visitor's own browser straight to
Highlightly's API, using the real API key** — there is no server-side/
serverless proxy of any kind, and **no third-party CORS relay** (an
unreliable public relay such as `corsproxy.io`/`api.allorigins.win` was
used previously and has been removed entirely — it was the source of
matches silently coming back empty or the page getting stuck on "loading").

**The live-data source, called directly with the key:**
- **Highlightly / RapidAPI Volleyball API** (`volleyball.highlightly.net`)
  — a documented REST API, called **directly from the browser** (its own
  CORS headers permit this) using `VITE_HIGHLIGHTLY_API_KEY` (or, as an
  alternative, `VITE_RAPIDAPI_KEY` for the RapidAPI marketplace listing —
  used automatically whenever `VITE_HIGHLIGHTLY_API_KEY` isn't set). See
  `.env.example` for how to set either one.

The integration lives entirely in `src/services/volleyballApi.js` (direct
fetch, normalizing, caching) and `src/hooks/useVolleyballApi.js` (React
hooks with loading/error states), consumed by `LiveResults.jsx` and
`MatchSchedules.jsx` — neither component needed to change.

**No server-side proxy, no CORS relay — every request is direct.** There is
no `api/` serverless function of any kind and no third-party relay in the
request path: every request is made straight from the visitor's own
browser to Highlightly's API with the real key attached, which is what
"exclusively and directly from the API keys" means in practice — no
same-origin middleman, no server-side code to deploy or keep warm, nothing
beyond a static site. Because there is no server between the browser and
the upstream API, there is also nothing to shield the Highlightly/RapidAPI
key from the network tab or the public JS bundle — see `.env.example` for
what that means in practice, and how the local cache protects the key's
daily quota instead. Absolute last resort: if the live fetch and every
cache layer comes back empty, Live Results falls back to
`src/data/volleyballSeed.js` — a small,
manually-verified, clearly-dated set of real results from the most recent
major tournament (never fabricated matches, and never used for the
Match Schedules/upcoming section, since a wrong kickoff time is actively
misleading in a way a slightly-dated final score is not). Refresh that
file's contents occasionally so the last-resort case stays reasonably
current.

A few honest notes on the data:
- Team flags are real images (via [FlagCDN](https://flagcdn.com)), resolved
  by matching the team's name against a built-in country-name → ISO-code map
  in `src/services/countryFlags.js`. Common qualifiers a source appends —
  "Women", "Men", "U17", "U21", etc. — are stripped before matching, so
  "Hungary Women" or "Algeria U17" still resolve to the right flag. This
  works for national-team competitions (Nations League, World Championship,
  Olympics) where the team name *is* the country name. For domestic club
  matches (e.g. a league like SuperLega), the club name won't match a
  country — that correctly falls back to a neutral ball icon rather than
  guessing/misrepresenting a flag.
- Live Results scans the **past 14 days** (`RESULTS_LOOKBACK_DAYS` in
  `volleyballApi.js`) for every live/finished match, so it reflects all
  recently completed matches rather than a narrow same-day window — adjust
  that constant if you want a longer or shorter history.
- Fetches cover every country/league a source returns for the requested
  dates — there's no hardcoded list of leagues — so coverage is as global
  as the combined sources' own data.
- Responses are cached in `localStorage` for 4 hours (`CACHE_TTL_MS` in
  `volleyballApi.js`) — this is what protects the Highlightly/RapidAPI key's
  daily quota now that every request is made directly from the browser:
  once a date has been fetched once, every further request for it (this
  page, a reload, another visit) is served from `localStorage` with zero
  network calls until the cache expires — with a 30-minute cooldown ("circuit breaker") that
  kicks in the moment the source confirms it is rate-limiting/blocking
  requests (HTTP 429/403), so a rate-limited visitor never keeps hammering
  a dead source — the pipeline just relies on the cache layers below until
  the cooldown clears.
- **Shared cache across visitors (fixes "الخدمة مزدحمة مؤقتاً" under real
  traffic):** a `localStorage`-only cache still lets several people browsing
  at once fire duplicate outbound requests for the same date. When Supabase
  is configured (it is, out of the box), every fetch first checks the
  `volleyball_cache` table (`supabase/schema.sql`, RPCs
  `get_volleyball_cache` / `set_volleyball_cache`) before ever calling a
  third-party source, and a rate-limit hit trips a *shared* cooldown there
  too. In practice only the first browser that needs a given date, across
  every visitor on every device, actually spends a request — everyone else
  is served from Supabase instead. If Supabase isn't configured, this layer
  is skipped automatically and the per-browser `localStorage`
  cache/cooldown above still works exactly as before.
- Live Results groups matches into tabs by whatever leagues are actually
  returned (fully dynamic) rather than a fixed, possibly-empty category
  list. Both sections show only the first 6 matches by default, with a
  "Show all" button to expand the full list.
- **The live-data key:** `VITE_HIGHLIGHTLY_API_KEY` / `VITE_RAPIDAPI_KEY` is
  bundled into the public JS like any `VITE_*` value and is visible to
  anyone who opens the browser's network tab or reads the JS bundle — that
  is an intentional trade-off of this direct-from-browser, no-proxy setup,
  not a bug. The aggressive
  `localStorage` cache above (and the shared Supabase cache, and the
  circuit breaker) are what keep the real number of upstream calls — and
  therefore the exposure of that key's daily quota — small; they do not
  hide the key itself. If you ever need the key fully hidden from
  visitors, that requires reintroducing some form of server-side call
  (e.g. a Vercel serverless function or a Supabase Edge Function) between
  the browser and Highlightly/RapidAPI — this build intentionally has none.

## Language switcher (30+ world languages) & live content translation

The navbar includes a language dropdown covering Arabic, English and French
(the three "core" languages with a full hand-written UI translation) plus
~28 more world languages (Spanish, German, Russian, Chinese, Japanese,
Korean, Hindi, Urdu, Persian, Hebrew, Turkish, Portuguese, Italian, Dutch,
the Nordic languages, Polish, Romanian, Greek, Czech, Ukrainian, Indonesian,
Malay, Thai, Vietnamese, Swahili, Amharic, Hausa, ...) — see `LANGUAGES` in
`src/context/LanguageContext.jsx`. Switching languages updates every
interface string for the three core languages (nav, hero, section headers,
buttons, admin dashboard, ...) and flips the page direction — RTL for
Arabic/Hebrew/Persian/Urdu, LTR otherwise. The selected language is
remembered in `localStorage`.

**Dynamic content is translated live, for real, for every language in the
list** — news titles/summaries/categories and reel captions are sent to a
real translation API (MyMemory, free & keyless) the moment a visitor picks a
non-Arabic language, and the result is cached (session + `localStorage`) so
the same text is never re-translated twice. See
`src/services/translationService.js` (the API call + cache) and
`src/hooks/useLiveTranslate.js` (the React hook components use). Nothing
here is placeholder/fake text — if the API is unreachable, the original
Arabic text is shown rather than an error.

The site is dark-mode only by design (Dark Navy/Gold) — there is no
light-theme toggle.

## Admin content persistence

News (`src/context/NewsContext.jsx`) and reels/videos
(`src/context/ReelsContext.jsx`) are the real, single source of truth for
everything published from the admin dashboard's "الأخبار" and "الفيديوهات"
sections. Anything added, deleted, liked, commented on, or viewed syncs live
to every device/tab via Supabase when it's configured (see the next
section for the exact table SQL) — falling back to
`src/hooks/usePersistentState.js` (`localStorage`, per-browser only)
otherwise, the same fallback pattern used everywhere else in this app.

Match results and schedules for the global live feed are **not**
admin-managed — they come live from the real API described above. Algerian
championship ("البطولة الجزائرية") matches — the standings table, results
list and admin match form — are managed by the admin and are described in
the next section.

## News & reels: Supabase sync

**Required Supabase setup** (only needed for real-time, cross-device sync —
the app works with local-only persistence otherwise):

1. **Tables** — create the `news` and `reels` tables:
   ```sql
   create table public.news (
     id bigint primary key,
     title text not null,
     category text,
     date date,
     summary text,
     image text,
     views int default 0,
     likes int default 0,
     comments int default 0,
     created_at timestamptz default now()
   );

   alter table public.news enable row level security;
   create policy "Public can read news"
     on public.news for select using (true);
   create policy "Authenticated admins can manage news"
     on public.news for all using (auth.role() = 'authenticated');

   create table public.reels (
     id bigint primary key,
     title text not null,
     category text,
     video_url text not null,
     poster text,
     views int default 0,
     likes int default 0,
     comments int default 0,
     created_at timestamptz default now()
   );

   alter table public.reels enable row level security;
   create policy "Public can read reels"
     on public.reels for select using (true);
   create policy "Authenticated admins can manage reels"
     on public.reels for all using (auth.role() = 'authenticated');
   ```
   The public `select` policies also allow visitors' like/comment/view
   counters to update in real time for everyone watching the page, since
   those go through the same admin-configured table.
2. **Realtime** — enable Realtime (Database → Replication) for both the
   `news` and `reels` tables so a new article/video — and its like/comment/
   view counts — broadcasts to every connected client the instant it
   changes.

If Supabase isn't configured, or a table doesn't exist yet, adding/deleting
news and reels still works — it just falls back to `localStorage`
(per-browser) instead of syncing across devices. Note that once Supabase
*is* configured, the public site reads news/reels from those tables only
(the same behavior as the Algerian matches and site settings below) — if
you want the built-in seed articles/videos to keep showing, insert them
into the tables once via the SQL editor.

## Algerian championship: real sets, standings & Supabase sync

`src/context/AlgerianMatchesContext.jsx` is the real, single source of truth
for every "البطولة الجزائرية" match — both admin-entered results (with real
per-set scores) and upcoming fixtures. It's consumed by the admin match
form, the public results/fixtures lists, and the standings table
(`src/services/algerianStandings.js`), so a result saved in the admin panel
is reflected everywhere immediately, on every device, in real time when
Supabase is configured (falling back to `localStorage` otherwise — the same
fallback pattern used elsewhere in this app).

**Entering a result:** the admin "إضافة نتيجة مباراة" form takes the real
score of each set (1st through 5th — the 4th/5th are only used if the match
actually went that far) rather than a typed-in final score. The final score
(e.g. `3-1`) is always *derived* from those real sets, so it can never
disagree with them. That per-set data also feeds the standings table's
"Set P / Set C" and "Pts P / Pts C" columns and their coefficients, and is
shown, the instant it's saved, as a labeled "الشوط الأول..الخامس" pill row
under the final score on each result card — the same pill-row layout used
by the live-results match cards.

**Required Supabase setup** (only needed for real-time, cross-device sync —
the app works with local-only persistence otherwise):

1. **Table** — create the `algerian_matches` table:
   ```sql
   create table public.algerian_matches (
     id bigint primary key,
     match_type text not null default 'result',
     division_id text,
     division_label text,
     group_id text,
     group_label text,
     round_label text,
     home_team text not null,
     away_team text not null,
     home_team_logo text,
     away_team_logo text,
     score text,
     set1_home int, set1_away int,
     set2_home int, set2_away int,
     set3_home int, set3_away int,
     set4_home int, set4_away int,
     set5_home int, set5_away int,
     match_date date,
     match_time text,
     created_at timestamptz default now()
   );

   alter table public.algerian_matches enable row level security;
   create policy "Public can read Algerian matches"
     on public.algerian_matches for select using (true);
   create policy "Authenticated admins can manage Algerian matches"
     on public.algerian_matches for all using (auth.role() = 'authenticated');
   ```
   `round_label` is a free-text round/matchday label (e.g. "الجولة 1"
   through "الجولة 18" or higher, per the Algerian Volleyball
   Federation's fixture calendar) — entirely optional, and the admin is
   free to type any value, not just a suggested one. `match_date` is
   already nullable — the admin can publish an entire round's fixtures
   with no date set yet, and fill each one in later (see "Editing an
   existing match" below); this requires no schema change on an
   existing table, since `match_date` was never `not null`. If you
   already created this table before this update, just add the new
   column:
   ```sql
   alter table public.algerian_matches add column if not exists round_label text;
   ```
2. **Realtime** — enable Realtime (Database → Replication) for the
   `algerian_matches` table so a new result/fixture — or a later edit,
   such as filling in a date — broadcasts to every connected client
   (standings table, results list, live match cards) the instant it's
   saved.

If Supabase isn't configured, or the table doesn't exist yet, adding,
editing, and deleting matches still works — it just falls back to
`localStorage` (per-browser) instead of syncing across devices.

### Editing an existing match (e.g. adding a date later)

Every match in the admin's "مباريات الكرة الطائرة الجزائرية" table has an
"تعديل" (Edit) button next to "حذف" (Delete). Clicking it loads that
match back into the form above — division, round, teams, score/sets, and
date — so the admin can change any field (most commonly: filling in or
correcting the match date once it's known) and save. This calls
`updateMatch(id, updates)` from `src/context/AlgerianMatchesContext.jsx`,
which applies the change optimistically, writes it for real via
`supabase.from('algerian_matches').update(...)`, and — because of the
same realtime subscription used for inserts/deletes — every other
visitor's page updates instantly, with no reload, anywhere in the world.

## Division/section tabs (البطولة الجزائرية)

The division/section tabs (القسم الوطني الأول أ/ب رجال, القسم الوطني
الأول سيدات, كأس الجزائر أكابر, كأس الجزائر للفئات الشبانية) are laid out
in a single horizontal row, side by side, and no longer carry any
crest/logo image next to their label — on the public page or in the admin
view. This applies to both the individual division tabs and the previous
single "main championship" logo next to the section title; neither is
rendered anywhere anymore. The underlying `division_crests` table/admin
upload code (`src/context/AlgerianMatchesContext.jsx`,
`src/components/DivisionCrestEditor.jsx`) is still present but no longer
wired into the UI, so no Supabase migration is required to pick up this
change — it simply isn't called.

This is unrelated to per-team crests (see "Team crests" below), which
remain fully in place and unaffected by this change.

## Team crests (per-match team logos)

Individual **team** crests (uploaded per match, for the home/away team, in
the "إضافة نتيجة مباراة جزائرية" admin form) are a separate feature from
the division/section logos removed above, and are untouched by this
change — see `src/components/TeamCrest.jsx` and the
`home_team_logo`/`away_team_logo` columns on `algerian_matches`.

## Using your real logo (logo1.png / logo2.jpeg)

`public/` deliberately holds only these two brand image files (plus the
non-branding security/SEO files described elsewhere in this README —
`robots.txt`, `_headers`, `ai.txt`, `.well-known/security.txt`):

| File | Used for |
|------|----------|
| `public/logo1.png` | Browser tab icon (favicon) — set in `index.html`. |
| `public/logo2.jpeg` | The site logo in the Navbar, the Hero badge and the admin sidebar (default `logoUrl` in `src/context/SiteSettingsContext.jsx`), drawn in a circular frame (`rounded-full`, defined at the end of `src/index.css`). |

`volley.sh` installs them for you: put your own `logo1.png` and `logo2.jpeg`
next to the script (or in the folder you run it from) before running it. If
a file is missing, the built-in placeholder — kept *outside* `public/`, at
`branding-assets/placeholder-logo1.png` / `branding-assets/placeholder-logo2.jpeg`
so it never clutters the deployed site — is copied under that name so
nothing renders broken. To change them later, overwrite the two files in
`public/` and hard-refresh the browser (favicons are cached aggressively).

Notes:

* An admin can still replace the header logo live from the site (camera
  icon). That upload is stored in Supabase `site_settings.logo_url` and takes
  priority over the `logo2.jpeg` default.
* If Supabase was set up with an older `schema.sql`, re-run the current one
  (it is idempotent): it moves a row that still holds the old `'/Logo.jpeg'`
  default over to `'/logo2.jpeg'`.
* A browser that already opened the site keeps a cached copy of the previous
  branding in `localStorage` (key `dzair-volley-site-settings`); clear it once
  to see the new default.

## Dynamic site branding (logo, hero image, site name)

The site name, header/hero logo, and hero banner image are no longer
hardcoded — they're managed live from `src/context/SiteSettingsContext.jsx`
and editable directly on the site by a logged-in admin:

* **Header** — hover the logo for a small camera-icon overlay (upload a new
  logo image) and a pencil icon next to the site name (inline rename).
* **Hero section** — the big circular badge has its own camera-icon overlay,
  letting the admin set a distinct hero banner image separate from the
  header logo.

Changes save immediately and sync in real time to every open tab/device via
Supabase (when configured — see below); without Supabase they still persist
locally via `localStorage`, the same fallback pattern used elsewhere in this
app.

**Required Supabase setup** (only needed for real-time, cross-device sync —
the app works with local-only persistence otherwise):

1. **Table** — create a `site_settings` table with a single row (`id = 1`):
   ```sql
   create table public.site_settings (
     id integer primary key default 1,
     site_name text default 'Dzair Volley',
     logo_url text default '/logo2.jpeg',
     hero_banner_url text,
     updated_at timestamptz default now()
   );
   insert into public.site_settings (id) values (1);

   alter table public.site_settings enable row level security;
   create policy "Public can read site settings"
     on public.site_settings for select using (true);
   create policy "Authenticated admins can update site settings"
     on public.site_settings for all using (auth.role() = 'authenticated');
   ```
2. **Realtime** — enable Realtime (Database → Replication) for the
   `site_settings` table so updates broadcast to every connected client.
3. **Storage bucket** — create a **public** bucket named `site-assets` for
   logo/banner uploads:
   ```sql
   insert into storage.buckets (id, name, public) values ('site-assets', 'site-assets', true);
   create policy "Public can read site assets"
     on storage.objects for select using (bucket_id = 'site-assets');
   create policy "Authenticated admins can upload site assets"
     on storage.objects for insert with check (bucket_id = 'site-assets' and auth.role() = 'authenticated');
   create policy "Authenticated admins can update site assets"
     on storage.objects for update using (bucket_id = 'site-assets' and auth.role() = 'authenticated');
   ```

If Supabase isn't configured, or the table/bucket don't exist yet, uploads
and edits still work — they just fall back to `localStorage` (per-browser)
instead of syncing across devices.

## Real visitor counter & site rating: Supabase sync

The footer's live visitor counter and 5-star site rating
(`src/components/VisitorCounter.jsx`) are both **real, not simulated**:
they start at **0** and only ever move in response to an actual page
load or an actual submitted rating — never a fabricated seed number or
a randomized "live" tick.

When Supabase is configured (it is, out of the box — see above), both
numbers are stored server-side in a single-row `site_stats` table and
kept in sync in real time across every visitor/device: each real page
load atomically increments the shared visitor count once per browser
session, and each real submitted rating atomically updates the shared
average, broadcasting to every other open tab/device instantly.
Without Supabase configured, the same real (non-fake) counting/rating
logic falls back to `localStorage`, scoped to that one browser only,
still starting from 0.

**Required Supabase setup** (only needed for the real-time, cross-device
shared counter/rating — the app works with local-only, per-browser
counting otherwise):

1. **Table** — a single row (`id = 1`) holding the running totals:
   ```sql
   create table public.site_stats (
     id smallint primary key default 1,
     visitors bigint not null default 0,
     rating_sum bigint not null default 0,
     rating_count bigint not null default 0,
     updated_at timestamptz not null default now(),
     constraint site_stats_single_row check (id = 1)
   );
   insert into public.site_stats (id) values (1)
     on conflict (id) do nothing;

   alter table public.site_stats enable row level security;
   create policy "Public can read site stats"
     on public.site_stats for select using (true);
   -- No insert/update/delete policy for anon/authenticated: all writes
   -- go exclusively through the SECURITY DEFINER functions below, so
   -- direct table writes stay locked down even for signed-in visitors.

   -- Required for Realtime UPDATE payloads to include the full row (and
   -- for the app's own realtime subscription — see VisitorCounter.jsx —
   -- to receive `payload.new` reliably) rather than just the primary key.
   alter table public.site_stats replica identity full;
   ```
2. **Atomic RPC functions** — used instead of a plain `update` so
   concurrent visitors incrementing/rating at the same instant can never
   race or clobber each other's write. Both are written defensively with
   `insert ... on conflict` so a rating/visit is still recorded correctly
   even if the seed row above was somehow never inserted (this is the fix
   for "rating 5 stars leaves the count stuck at 0": a missing/never-run
   seed row, or an update matching zero rows, used to silently do nothing
   — these functions now always affect exactly one row):
   ```sql
   create or replace function public.increment_visitor_count()
   returns bigint
   language plpgsql
   security definer
   set search_path = public
   as $$
   declare
     result bigint;
   begin
     insert into public.site_stats (id, visitors)
       values (1, 1)
     on conflict (id) do update
       set visitors = public.site_stats.visitors + 1,
           updated_at = now()
     returning visitors into result;
     return result;
   end;
   $$;

   create or replace function public.submit_site_rating(p_new int, p_previous int default 0)
   returns table (rating_sum bigint, rating_count bigint)
   language plpgsql
   security definer
   set search_path = public
   as $$
   begin
     insert into public.site_stats (id, rating_sum, rating_count)
       values (1, p_new, 1)
     on conflict (id) do update
       set rating_sum = public.site_stats.rating_sum - p_previous + p_new,
           rating_count = public.site_stats.rating_count
             + case when p_previous = 0 then 1 else 0 end,
           updated_at = now();

     return query
       select s.rating_sum, s.rating_count from public.site_stats s where s.id = 1;
   end;
   $$;

   grant execute on function public.increment_visitor_count() to anon, authenticated;
   grant execute on function public.submit_site_rating(int, int) to anon, authenticated;
   ```
3. **Realtime** — enable Realtime (Database → Replication) for the
   `site_stats` table **and** make sure it's actually added to the
   `supabase_realtime` publication (the Replication UI toggle does this,
   but if you're running the SQL by hand instead, run the line below too
   — without it, `postgres_changes` events never fire and the UI will
   look stuck even though the database values *are* updating correctly):
   ```sql
   alter publication supabase_realtime add table public.site_stats;
   ```

If Supabase isn't configured, or the table/functions don't exist yet,
the counter and rating still work — they just fall back to real
per-browser counting in `localStorage` instead of a shared cross-device
total.

## Algerian team crest (dv.jpg)

Every Algerian club/national-team badge in the "نتائج ومباريات جزائرية"
section (and the admin "add match" form) is rendered by
`src/components/TeamCrest.jsx`. It looks for `public/dv.jpg` and displays
it as a circular crest — just drop your official artwork in `public/`
**using the exact filename `dv.jpg`**, no code changes needed. Until that
file exists (or if it fails to load), the badge falls back automatically
to the previous generated cyan/green/gold volleyball emblem, so nothing
ever renders broken.

## Admin panel

Click the glowing circular logo badge in the center of the Hero section to
open the dashboard login.

- Email address field (local demo default): `abdelhak`
- Password: `000000`

> When Supabase Auth is configured, this field is a real email address and
> `supabase.auth.signInWithPassword({ email, password })` is used instead —
> see "Admin content persistence" and the Supabase setup section above.

From the dashboard you can add/remove news and videos (with video + poster
URLs), and manage the image gallery by URL — all in local React state,
persisted to `localStorage`, no backend required.

**A note on this login for production:** the credentials above are checked
client-side in `src/components/LoginModal.jsx`, which is standard/expected
for a static frontend demo but means they're visible to anyone who reads the
shipped JavaScript. Before a real public launch, put this dashboard behind
real backend authentication (or at minimum a server-side gate) rather than
relying on this client-only check.

## Security notes

- All user-visible text (news titles, video titles, etc.) is rendered as
  plain React text — never `dangerouslySetInnerHTML` — so it's automatically
  HTML-escaped and safe from injected markup/scripts.
- The admin dashboard rejects any image/video URL that isn't `http://` or
  `https://` (blocking `javascript:`, `data:`, and similar schemes from
  being smuggled into an `<img>`/`<video src>`), and trims/strips control
  characters from free-text fields before they're stored.
- `localStorage` here only ever holds public content (news/videos/gallery/
  language choice/engagement counts) — no credentials or personal data are
  persisted client-side.

## Build for production

```bash
npm run build
npm run preview
```

---
© 2026 Dzair Volley — جميع الحقوق محفوظة لدى V0RT3X


---

## 2026 update — video fix, cover images, security hardening, full Supabase schema

Everything below is documented in detail (Arabic) in **[REPORT.md](./REPORT.md)**.

**Do this once after extracting:**

1. `npm install && npm run build` (or `npm run dev`).
2. Supabase → **SQL Editor** → run **`supabase/schema.sql`** (creates/updates every table, the admin
   allow-list, RLS, safe counter/rating/visitor functions, the `site-assets` storage bucket and Realtime).
   Make sure your admin account exists under *Authentication → Users* first — the script registers
   `abdelhakbetch@gmail.com` as admin (edit that e-mail in section 1b if yours differs).
3. Supabase → Authentication → turn **off** "Allow new users to sign up".
4. Deploy behind the security headers that match your host: `public/_headers` (Netlify / Cloudflare
   Pages), `vercel.json` (Vercel), `deploy/nginx.conf`, `deploy/apache.htaccess`; and follow
   `deploy/CLOUDFLARE_WAF.md` for bot / AI-scraper blocking.

**What changed in the code**

| Area | Change |
|---|---|
| Videos (black screen) | New `VideoPlayer` (`controls`, `playsInline`, `preload="metadata"`, iOS first-frame hint, safe embeds for YouTube / Facebook / Instagram / Vimeo / TikTok / Dailymotion / Drive, readable error instead of a black box). Uploads now go to Supabase Storage instead of base64-in-database. |
| News covers | Complete image shown (`object-fit: contain`) over a blurred copy of itself in a fluid 16:9 frame — never cropped. |
| Security | CSP + security headers, anti-framing, optional domain lock (`VITE_ALLOWED_HOSTS`), automation blocking (`VITE_BLOCK_AUTOMATION`), input sanitisation, client + server rate limits, admin allow-list (`is_admin()`), no demo credentials in production builds. |
| Supabase | `supabase/schema.sql`: all tables, RLS (public read / admin-only write), RPCs for counters/visits/ratings, Storage policies, Realtime publication. |
| Responsive | Defensive layout rules verified with no horizontal overflow from 320 px to 1920 px. |

---

## Video player — Plyr

Every direct / uploaded video (reel cards **and** their modal) plays through [Plyr](https://plyr.io),
installed as the npm package `plyr` (declared in `package.json`, installed by `npm install`, bundled by
Vite — the strict CSP means nothing is loaded from a CDN, and Plyr's icon sprite is injected inline).

| File | Role |
|---|---|
| `src/components/PlyrVideo.jsx` | New. One Plyr player: creates the `<video>` + Plyr imperatively (no React/Plyr DOM conflicts), forwards media events, holds the cover image until the first frame is painted, tears everything down cleanly. |
| `src/components/VideoPlayer.jsx` | Card = cover + Plyr big play button; tapping opens the modal *inside the tap* (so autoplay with sound is allowed, incl. iOS Safari). Modal = full Plyr control bar with its own fullscreen button; the frame follows the clip's aspect ratio. |
| `src/services/plyrI18n.js` | New. Plyr's control labels in ar / en / fr. |
| `src/index.css` | New section "6) REELS / VIDEOS — Plyr player": theme (cyan accent), card / modal / fullscreen layout, pull-to-refresh guards extended to Plyr's elements. |

Behaviour that is deliberately unchanged: the `position: fixed` body scroll-lock while the modal is open (now
restored *instantly* on close), `overscroll-behavior` / `touch-action` pull-to-refresh guards, the sandboxed
platform-embed iframes (YouTube, Vimeo, …), the legacy base64 → Blob path, and **no page reload** anywhere —
closing the player only changes React state, and the card's player is rebuilt so its cover is back at once.
The hero background video and the admin upload preview are decorative / preview elements, not players, and are
untouched.

---

## Smart caching v2 — keeping the API key safe under heavy traffic

Live Results / Match Schedules never call the third-party API once per
visitor. Every date goes through these layers, in order
(`src/services/volleyballApi.js`):

1. **Local cache** (`localStorage`) with a *tiered* TTL per date — today and
   yesterday 4 h, upcoming days 6 h, 2–6 days ago 24 h, 7+ days ago 72 h
   (`ttlForDay`). A fresh hit means no network at all.
2. **Shared cache** (Supabase `volleyball_cache`) — one visitor's fetch serves
   everyone else.
3. **Refresh lease** (`claim_volleyball_refresh`, `supabase/schema.sql` §5.5) —
   when a date's shared entry has expired, only ONE browser site-wide is
   allowed to refresh it from the API. Everyone else is instantly served the
   newest cached copy (flagged `stale`) and never touches the API. There is
   also a site-wide ceiling of refreshes per UTC day (`v_daily_ceiling`,
   default 200) — raise it in the SQL if your plan allows more.
4. **Per-browser hard budget** (`UPSTREAM_BUDGET_PER_DAY`, default 120) and the
   existing 429/403 circuit breaker.
5. **Background refresh** — open tabs re-check every 15 minutes
   (`useVolleyballApi.js`); this only reads the cache unless a TTL expired.

Result: 10,000 visitors cost the API roughly the same as 1 — steady state is
about 40–60 upstream requests per day for the whole site.

**One-time step:** re-run `supabase/schema.sql` in the Supabase SQL Editor so
the lease function exists (safe to re-run). Until then the site keeps working
with layers 1, 2 and 4 only.

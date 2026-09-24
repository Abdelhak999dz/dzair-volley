-- =====================================================================
--  DZAIR VOLLEY — complete Supabase schema  (idempotent: safe to re-run)
-- =====================================================================
--  HOW TO RUN
--    1. Supabase Dashboard → Authentication → Users → create (or confirm)
--       the admin account you log into the dashboard with.
--    2. Supabase Dashboard → SQL Editor → paste this WHOLE file → Run.
--       (The editor runs it as one transaction: if anything fails,
--        nothing is applied, so you can never end up half-configured.)
--    3. If step 1 happened AFTER a previous run, run only section 1b
--       again (the "seed admin" INSERT) so the new account is registered.
--
--  WHAT IT DOES
--    1. Admin allow-list (public.admin_users + is_admin())
--    2. Server-side rate limiting (per-IP, hashed)
--    3. Tables: news, reels, algerian_matches, division_crests,
--               site_settings, site_stats       (+ validation constraints)
--    4. Row Level Security: everyone READS, only ADMINS write
--    5. Safe anonymous write paths (RPCs): counters, visits, ratings
--    6. Storage bucket `site-assets` (admin-only writes, size/type limits)
--    7. Realtime publication → admin edits appear instantly for everyone
--    8. Shared volleyball match-data cache (`volleyball_cache` +
--       get/set RPCs) — protects the client-side Highlightly/RapidAPI
--       quota by letting every visitor's browser reuse one another's
--       fetches instead of each browser calling the third-party API
--       independently (see src/services/volleyballApi.js)
--
--  NOTE ON "authenticated": in the old README policies, ANY signed-in
--  Supabase user was treated as an admin. If sign-ups are enabled on the
--  project, that meant anybody could register and edit the whole site.
--  Every write policy below requires public.is_admin() instead.
--  Also disable public sign-ups: Authentication → Providers/Sign In →
--  turn OFF "Allow new users to sign up".
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. ADMIN ALLOW-LIST
-- ---------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);

-- RLS on with NO policies: the table is invisible/unwritable through the
-- public API. Only SQL run by you (SQL Editor) or is_admin() can touch it.
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- 1b. SEED ADMIN — put YOUR admin login e-mail(s) here, then run.
insert into public.admin_users (user_id, note)
select u.id, 'primary admin'
from auth.users u
where lower(u.email) in (lower('abdelhakbetch@gmail.com'))
on conflict (user_id) do nothing;


-- ---------------------------------------------------------------------
-- 2. SERVER-SIDE RATE LIMITING
--    Used by the anonymous write functions below. Only a salted-less MD5
--    of the caller IP is stored (never the raw IP), and old rows are
--    purged automatically. Limits are deliberately generous because many
--    mobile carriers put hundreds of users behind ONE public IP (CGNAT):
--    they stop scripts, not real audiences.
-- ---------------------------------------------------------------------
create table if not exists public.rate_limits (
  bucket       text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (bucket, window_start)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.client_fingerprint()
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  headers json;
  ip      text;
begin
  begin
    headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    headers := null;
  end;

  ip := coalesce(
    nullif(headers ->> 'cf-connecting-ip', ''),
    nullif(trim(split_part(coalesce(headers ->> 'x-forwarded-for', ''), ',', 1)), ''),
    nullif(headers ->> 'x-real-ip', ''),
    'unknown'
  );
  return md5(ip);
end;
$$;

-- Raises 'rate_limited' when the caller made more than p_max calls with
-- this key inside the current p_window_seconds window. (The exception
-- rolls the increment back, so a blocked caller stays blocked until the
-- window rolls over instead of digging deeper.)
create or replace function public.rate_limit_check(p_key text, p_max integer, p_window_seconds integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket text := p_key || ':' || public.client_fingerprint();
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits   integer;
begin
  insert into public.rate_limits as r (bucket, window_start, hits)
  values (v_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;

  -- opportunistic clean-up (≈2 % of calls) keeps the table tiny
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;

  if v_hits > p_max then
    raise exception 'rate_limited' using errcode = 'P0001', hint = 'Too many requests, slow down.';
  end if;
end;
$$;

revoke all on function public.rate_limit_check(text, integer, integer) from public, anon, authenticated;
revoke all on function public.client_fingerprint() from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. TABLES
-- ---------------------------------------------------------------------

-- 3.1 news ------------------------------------------------------------
create table if not exists public.news (
  id         bigint primary key,
  title      text not null,
  category   text,
  date       date default current_date,
  summary    text,
  image      text,               -- public URL (Storage or https) — NOT base64
  views      integer not null default 0,
  likes      integer not null default 0,
  comments   integer not null default 0,
  created_at timestamptz default now()
);

-- 3.2 reels (videos) ---------------------------------------------------
create table if not exists public.reels (
  id         bigint primary key,
  title      text not null,
  category   text,
  video_url  text not null,      -- direct file URL, or YouTube/Facebook/... link
  poster     text,
  views      integer not null default 0,
  likes      integer not null default 0,
  comments   integer not null default 0,
  created_at timestamptz default now()
);

-- 3.3 algerian_matches (results, fixtures, standings source) -----------
create table if not exists public.algerian_matches (
  id             bigint primary key,
  match_type     text not null default 'result',
  division_id    text,
  division_label text,
  group_id       text,
  group_label    text,
  round_label    text,
  home_team      text not null,
  away_team      text not null,
  home_team_logo text,
  away_team_logo text,
  score          text,
  set1_home int, set1_away int,
  set2_home int, set2_away int,
  set3_home int, set3_away int,
  set4_home int, set4_away int,
  set5_home int, set5_away int,
  match_date     date,
  match_time     text,
  created_at     timestamptz default now()
);
alter table public.algerian_matches add column if not exists round_label text;

-- 3.4 division_crests (league emblem per division) ---------------------
create table if not exists public.division_crests (
  division_id text primary key,
  crest_url   text,
  updated_at  timestamptz not null default now()
);

-- 3.5 site_settings (single row: name, logo, hero banner) --------------
create table if not exists public.site_settings (
  id              integer primary key default 1,
  site_name       text default 'Dzair Volley',
  logo_url        text default '/logo2.jpeg',
  hero_banner_url text,
  updated_at      timestamptz default now(),
  constraint site_settings_single_row check (id = 1)
);
-- Existing projects: `create table if not exists` never changes an existing
-- table's default, and a row still holding the old case-sensitive default
-- ('/Logo.jpeg' -> 404 on Linux hosts) would override the app's built-in
-- logo. Point the default at logo2.jpeg and migrate ONLY rows that still
-- hold one of the two legacy defaults; an admin-uploaded logo is untouched.
alter table public.site_settings alter column logo_url set default '/logo2.jpeg';
insert into public.site_settings (id) values (1) on conflict (id) do nothing;
update public.site_settings
   set logo_url = '/logo2.jpeg'
 where id = 1 and logo_url in ('/Logo.jpeg', '/logo.jpeg');

-- 3.6 site_stats (single row: visitors + rating totals) ----------------
create table if not exists public.site_stats (
  id           smallint primary key default 1,
  visitors     bigint not null default 0,
  rating_sum   bigint not null default 0,
  rating_count bigint not null default 0,
  updated_at   timestamptz not null default now(),
  constraint site_stats_single_row check (id = 1)
);
insert into public.site_stats (id) values (1) on conflict (id) do nothing;
-- Full old row in Realtime UPDATE payloads (VisitorCounter.jsx relies on it).
alter table public.site_stats replica identity full;


-- ---------------------------------------------------------------------
-- 3b. VALIDATION CONSTRAINTS
--     Length / range caps (NOT VALID = existing rows aren't re-checked at
--     creation time). They keep a rogue or compromised client from
--     stuffing megabytes of text into a row. URL-shaped columns are
--     guarded separately in 3c because a CHECK would also re-fire on
--     every UPDATE of a legacy row that still holds an old base64 image.
-- ---------------------------------------------------------------------
create or replace function public.dv_add_check(p_table text, p_name text, p_expr text)
returns void
language plpgsql
as $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = p_name and conrelid = p_table::regclass
  ) then
    execute format('alter table %s add constraint %I check (%s) not valid', p_table, p_name, p_expr);
  end if;
end;
$$;

-- news
select public.dv_add_check('public.news', 'news_title_len',    'char_length(title) between 1 and 300');
select public.dv_add_check('public.news', 'news_category_len', 'category is null or char_length(category) <= 100');
select public.dv_add_check('public.news', 'news_summary_len',  'summary is null or char_length(summary) <= 20000');
select public.dv_add_check('public.news', 'news_counters_nonneg', 'views >= 0 and likes >= 0 and comments >= 0');

-- reels
select public.dv_add_check('public.reels', 'reels_title_len',    'char_length(title) between 1 and 300');
select public.dv_add_check('public.reels', 'reels_category_len', 'category is null or char_length(category) <= 100');
select public.dv_add_check('public.reels', 'reels_video_url_nonempty', 'char_length(video_url) > 0');
select public.dv_add_check('public.reels', 'reels_counters_nonneg', 'views >= 0 and likes >= 0 and comments >= 0');

-- algerian_matches
select public.dv_add_check('public.algerian_matches', 'matches_type',      $c$match_type in ('result', 'upcoming')$c$);
select public.dv_add_check('public.algerian_matches', 'matches_team_len',  'char_length(home_team) between 1 and 120 and char_length(away_team) between 1 and 120');
select public.dv_add_check('public.algerian_matches', 'matches_label_len', $c$coalesce(char_length(division_label), 0) <= 200 and coalesce(char_length(group_label), 0) <= 200 and coalesce(char_length(round_label), 0) <= 100 and coalesce(char_length(match_time), 0) <= 20 and coalesce(char_length(score), 0) <= 20$c$);
select public.dv_add_check('public.algerian_matches', 'matches_set_scores',
  'coalesce(set1_home, 0) between 0 and 99 and coalesce(set1_away, 0) between 0 and 99 and coalesce(set2_home, 0) between 0 and 99 and coalesce(set2_away, 0) between 0 and 99 and coalesce(set3_home, 0) between 0 and 99 and coalesce(set3_away, 0) between 0 and 99 and coalesce(set4_home, 0) between 0 and 99 and coalesce(set4_away, 0) between 0 and 99 and coalesce(set5_home, 0) between 0 and 99 and coalesce(set5_away, 0) between 0 and 99');

-- division_crests

-- site_settings
select public.dv_add_check('public.site_settings', 'settings_name_len', 'site_name is null or char_length(site_name) <= 80');

drop function public.dv_add_check(text, text, text);


-- 3c. URL GUARD (trigger, not CHECK)
--     Every media/URL column must hold an http(s) URL or a site-relative
--     path (max 2048 chars) — never a base64 blob. It is a trigger that
--     only inspects a column when its value is being INSERTED or CHANGED,
--     so legacy rows that still contain old base64 media keep working
--     (likes, views and unrelated edits don't trip over them) while every
--     new value is forced to be a real URL.
create or replace function public.enforce_url_columns()
returns trigger
language plpgsql
as $$
declare
  col     text;
  val     text;
  old_val text;
begin
  foreach col in array tg_argv loop
    val := to_jsonb(new) ->> col;
    if tg_op = 'UPDATE' then
      old_val := to_jsonb(old) ->> col;
      if val is not distinct from old_val then
        continue;
      end if;
    end if;
    if val is not null and val <> '' and (val !~* '^(https?://|/)' or char_length(val) > 2048) then
      raise exception 'invalid_url_in_column_%', col using errcode = '23514',
        hint = 'Upload the file to Storage and save its public URL instead of embedding it.';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists dv_url_guard on public.news;
create trigger dv_url_guard before insert or update on public.news
  for each row execute function public.enforce_url_columns('image');

drop trigger if exists dv_url_guard on public.reels;
create trigger dv_url_guard before insert or update on public.reels
  for each row execute function public.enforce_url_columns('video_url', 'poster');

drop trigger if exists dv_url_guard on public.algerian_matches;
create trigger dv_url_guard before insert or update on public.algerian_matches
  for each row execute function public.enforce_url_columns('home_team_logo', 'away_team_logo');

drop trigger if exists dv_url_guard on public.division_crests;
create trigger dv_url_guard before insert or update on public.division_crests
  for each row execute function public.enforce_url_columns('crest_url');

drop trigger if exists dv_url_guard on public.site_settings;
create trigger dv_url_guard before insert or update on public.site_settings
  for each row execute function public.enforce_url_columns('logo_url', 'hero_banner_url');


-- ---------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY — everyone reads, ONLY ADMINS write
-- ---------------------------------------------------------------------
alter table public.news             enable row level security;
alter table public.reels            enable row level security;
alter table public.algerian_matches enable row level security;
alter table public.division_crests  enable row level security;
alter table public.site_settings    enable row level security;
alter table public.site_stats       enable row level security;

-- Remove the old permissive policies from the previous README.
drop policy if exists "Public can read news"                        on public.news;
drop policy if exists "Authenticated admins can manage news"        on public.news;
drop policy if exists "Public can read reels"                       on public.reels;
drop policy if exists "Authenticated admins can manage reels"       on public.reels;
drop policy if exists "Public can read Algerian matches"            on public.algerian_matches;
drop policy if exists "Authenticated admins can manage Algerian matches" on public.algerian_matches;
drop policy if exists "Public can read site settings"               on public.site_settings;
drop policy if exists "Authenticated admins can update site settings" on public.site_settings;
drop policy if exists "Public can read site stats"                  on public.site_stats;

do $$
declare
  t text;
begin
  foreach t in array array['news', 'reels', 'algerian_matches', 'division_crests', 'site_settings']
  loop
    execute format('drop policy if exists %I on public.%I', t || ' public read',  t);
    execute format('drop policy if exists %I on public.%I', t || ' admin insert', t);
    execute format('drop policy if exists %I on public.%I', t || ' admin update', t);
    execute format('drop policy if exists %I on public.%I', t || ' admin delete', t);

    execute format('create policy %I on public.%I for select to anon, authenticated using (true)',
                   t || ' public read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_admin())',
                   t || ' admin insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())',
                   t || ' admin update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_admin())',
                   t || ' admin delete', t);
  end loop;
end;
$$;

-- site_stats: readable by all; NO write policy at all — every change goes
-- through the SECURITY DEFINER functions in section 5.
drop policy if exists "site_stats public read" on public.site_stats;
create policy "site_stats public read" on public.site_stats
  for select to anon, authenticated using (true);

-- Defence in depth: even if a policy were ever mis-written, the anonymous
-- role has no table privilege to modify anything.
revoke insert, update, delete, truncate on
  public.news, public.reels, public.algerian_matches, public.division_crests,
  public.site_settings, public.site_stats
from anon;
revoke truncate on
  public.news, public.reels, public.algerian_matches, public.division_crests,
  public.site_settings, public.site_stats
from authenticated;
revoke insert, update, delete on public.site_stats from authenticated;


-- ---------------------------------------------------------------------
-- 5. SAFE ANONYMOUS WRITE PATHS (RPC)
--    Visitors never get UPDATE rights on content tables. The only things
--    they can change are counters, through these narrow functions.
-- ---------------------------------------------------------------------

-- 5.1 like / view / comment counters on news + reels
create or replace function public.bump_counter(p_table text, p_id bigint, p_field text, p_delta integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new integer;
begin
  if p_table not in ('news', 'reels') then
    raise exception 'invalid_table' using errcode = '22023';
  end if;
  if p_field not in ('views', 'likes', 'comments') then
    raise exception 'invalid_field' using errcode = '22023';
  end if;
  if p_delta is null or p_delta not in (-1, 1) or (p_field = 'views' and p_delta <> 1) then
    raise exception 'invalid_delta' using errcode = '22023';
  end if;

  -- overall ceiling per caller, and a tighter one per item/field
  perform public.rate_limit_check('bump', 240, 60);
  perform public.rate_limit_check('bump:' || p_table || ':' || p_id::text || ':' || p_field, 60, 3600);

  execute format(
    'update public.%I set %I = greatest(0, coalesce(%I, 0) + $1) where id = $2 returning %I',
    p_table, p_field, p_field, p_field
  ) into v_new using p_delta, p_id;

  return v_new;   -- NULL when the id doesn't exist
end;
$$;

-- 5.2 visitor counter
create or replace function public.increment_visitor_count()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  result bigint;
begin
  perform public.rate_limit_check('visit', 300, 3600);

  insert into public.site_stats (id, visitors)
    values (1, 1)
  on conflict (id) do update
    set visitors = public.site_stats.visitors + 1,
        updated_at = now()
  returning visitors into result;
  return result;
end;
$$;

-- 5.3 site rating (1-5 stars). Inputs are validated and the running total
-- is clamped so the average can never leave the 1-5 range, whatever a
-- hostile client sends as "previous".
create or replace function public.submit_site_rating(p_new int, p_previous int default 0)
returns table (rating_sum bigint, rating_count bigint)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if p_new is null or p_new < 1 or p_new > 5 then
    raise exception 'invalid_rating' using errcode = '22023';
  end if;
  if p_previous is null or p_previous < 0 or p_previous > 5 then
    raise exception 'invalid_rating' using errcode = '22023';
  end if;

  perform public.rate_limit_check('rating', 60, 3600);

  insert into public.site_stats (id, rating_sum, rating_count)
    values (1, p_new, 1)
  on conflict (id) do update
    set rating_count = public.site_stats.rating_count
          + case when p_previous = 0 then 1 else 0 end,
        rating_sum = greatest(
          public.site_stats.rating_count + case when p_previous = 0 then 1 else 0 end,
          least(
            5 * (public.site_stats.rating_count + case when p_previous = 0 then 1 else 0 end),
            public.site_stats.rating_sum - p_previous + p_new
          )
        ),
        updated_at = now();

  return query
    select s.rating_sum, s.rating_count from public.site_stats s where s.id = 1;
end;
$$;

revoke all on function public.bump_counter(text, bigint, text, integer) from public;
revoke all on function public.increment_visitor_count()                 from public;
revoke all on function public.submit_site_rating(int, int)              from public;
grant execute on function public.bump_counter(text, bigint, text, integer) to anon, authenticated;
grant execute on function public.increment_visitor_count()                 to anon, authenticated;
grant execute on function public.submit_site_rating(int, int)              to anon, authenticated;

-- 5.4 shared volleyball match-data cache (cross-visitor)
--    The client-side Highlightly/RapidAPI key (src/services/volleyballApi.js)
--    is a VITE_ variable, so it is compiled into the public JS bundle and
--    EVERY visitor's browser calls the third-party API directly with that
--    same shared free-tier key. Before this table, each browser only had
--    its OWN localStorage cache, so several people browsing at once could
--    still fire several separate outbound requests for the same date and
--    exhaust the whole quota in minutes ("الخدمة مزدحمة مؤقتاً"). This
--    table lets every visitor's browser, on every device, read back the
--    most recent successful fetch for a date — and a shared "quota is
--    exhausted" cooldown marker — from here FIRST, so only the first
--    browser that needs a given date actually calls Highlightly/RapidAPI;
--    everyone else is served from Supabase instead (our own project, with
--    much more generous limits than the third-party free tier).
--    Access only ever goes through the two narrow RPCs below (never the
--    raw table), which validate the key shape and payload size — this can
--    never become a place to stash arbitrary data.
create table if not exists public.volleyball_cache (
  cache_key  text        primary key,
  payload    jsonb       not null,
  updated_at timestamptz not null default now()
);
alter table public.volleyball_cache enable row level security;
revoke all on public.volleyball_cache from anon, authenticated;

-- Read one cached entry (a date's match list, or the shared cooldown
-- marker). Returns zero rows when nothing is cached yet — the client
-- treats that exactly like a cache miss.
create or replace function public.get_volleyball_cache(p_key text)
returns table (payload jsonb, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select c.payload, c.updated_at from public.volleyball_cache c where c.cache_key = p_key;
$$;

-- Write one cached entry. Restricted to the exact key shapes the app
-- itself produces ("matches:YYYY-MM-DD" or the fixed "circuit:cooldown"
-- marker) and a generous but bounded payload size, and rate-limited per
-- caller like every other anonymous write path here.
create or replace function public.set_volleyball_cache(p_key text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_key is null or p_key !~ '^(matches:\d{4}-\d{2}-\d{2}|circuit:cooldown)$' then
    raise exception 'invalid_key' using errcode = '22023';
  end if;
  if p_payload is null or pg_column_size(p_payload) > 200000 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  perform public.rate_limit_check('vbcache_write', 120, 60);

  insert into public.volleyball_cache as c (cache_key, payload, updated_at)
  values (p_key, p_payload, now())
  on conflict (cache_key) do update
    set payload = excluded.payload, updated_at = excluded.updated_at;

  -- opportunistic clean-up (≈2 % of calls) keeps the table from growing
  -- forever with dates nobody will ever ask for again.
  if random() < 0.02 then
    delete from public.volleyball_cache where updated_at < now() - interval '30 days';
  end if;
end;
$$;

revoke all on function public.get_volleyball_cache(text)        from public;
revoke all on function public.set_volleyball_cache(text, jsonb) from public;
grant execute on function public.get_volleyball_cache(text)        to anon, authenticated;
grant execute on function public.set_volleyball_cache(text, jsonb) to anon, authenticated;

-- 5.5 refresh lease + daily refresh ceiling (smart caching v2)
--    The cache above protects the API key from repeat calls, but the moment a
--    date's shared entry expires every visitor arriving in the next few
--    seconds would still call Highlightly/RapidAPI at once (a "thundering
--    herd"). `claim_volleyball_refresh` fixes that: for each cache key it
--    hands out ONE short lease at a time. The browser that gets `true`
--    refreshes that date and publishes the result with
--    set_volleyball_cache; every other browser gets `false` and is simply
--    served the newest cached copy instead — without touching the API.
--    It also enforces a site-wide ceiling on refreshes per UTC day
--    (v_daily_ceiling below — raise it if your provider plan allows more).
--    Safe to re-run. If this block is not installed yet, the client falls
--    back to its previous per-browser behaviour, so nothing breaks.
create table if not exists public.volleyball_refresh_lease (
  cache_key    text        primary key,
  leased_until timestamptz not null
);
alter table public.volleyball_refresh_lease enable row level security;
revoke all on public.volleyball_refresh_lease from anon, authenticated;

create table if not exists public.volleyball_refresh_budget (
  day  date    primary key,
  used integer not null default 0
);
alter table public.volleyball_refresh_budget enable row level security;
revoke all on public.volleyball_refresh_budget from anon, authenticated;

create or replace function public.claim_volleyball_refresh(p_key text, p_lease_seconds integer default 90)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Site-wide ceiling: max number of per-date refreshes granted per UTC day.
  -- Steady state needs ~40-60 (one refresh ≈ 1-2 upstream requests); this
  -- leaves room for a cold start and retries without ever allowing a runaway.
  v_daily_ceiling constant integer := 200;
  v_day  date := (now() at time zone 'utc')::date;
  v_used integer;
begin
  if p_key is null or p_key !~ '^matches:\d{4}-\d{2}-\d{2}$' then
    raise exception 'invalid_key' using errcode = '22023';
  end if;
  p_lease_seconds := least(greatest(coalesce(p_lease_seconds, 90), 15), 600);

  perform public.rate_limit_check('vbcache_lease', 240, 60);

  -- 1. today's site-wide ceiling already used up? -> nobody refreshes.
  select b.used into v_used from public.volleyball_refresh_budget b where b.day = v_day;
  if coalesce(v_used, 0) >= v_daily_ceiling then
    return false;
  end if;

  -- 2. atomically take the per-key lease; only succeeds when there is no
  --    lease yet, or the previous holder's lease has expired.
  insert into public.volleyball_refresh_lease as l (cache_key, leased_until)
  values (p_key, now() + make_interval(secs => p_lease_seconds))
  on conflict (cache_key) do update
    set leased_until = excluded.leased_until
    where l.leased_until <= now();
  if not found then
    return false;
  end if;

  -- 3. count it against today's ceiling.
  insert into public.volleyball_refresh_budget as b (day, used)
  values (v_day, 1)
  on conflict (day) do update set used = b.used + 1;

  -- opportunistic clean-up (≈2 % of calls)
  if random() < 0.02 then
    delete from public.volleyball_refresh_budget where day < v_day - 7;
    delete from public.volleyball_refresh_lease where leased_until < now() - interval '1 day';
  end if;

  return true;
end;
$$;

revoke all on function public.claim_volleyball_refresh(text, integer) from public;
grant execute on function public.claim_volleyball_refresh(text, integer) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 6. STORAGE — bucket `site-assets`
--    Public READ by URL (so images/videos load for everyone), but
--    listing the bucket and every write are admin-only. Size and MIME
--    limits are enforced by Storage itself.
--    50 MB is the per-file ceiling of the Supabase free plan; raise it
--    here (and MAX_VIDEO_BYTES in src/services/mediaStorage.js) on a
--    paid plan.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-assets', 'site-assets', true, 52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'
  ]
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read site assets"                on storage.objects;
drop policy if exists "Authenticated admins can upload site assets" on storage.objects;
drop policy if exists "Authenticated admins can update site assets" on storage.objects;
drop policy if exists "site-assets admin read"   on storage.objects;
drop policy if exists "site-assets admin insert" on storage.objects;
drop policy if exists "site-assets admin update" on storage.objects;
drop policy if exists "site-assets admin delete" on storage.objects;

-- Files are fetched through the public object URL (no policy needed).
-- This SELECT policy only lets admins LIST/upsert, so nobody can
-- enumerate every file in the bucket.
create policy "site-assets admin read" on storage.objects
  for select to authenticated using (bucket_id = 'site-assets' and public.is_admin());
create policy "site-assets admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'site-assets' and public.is_admin());
create policy "site-assets admin update" on storage.objects
  for update to authenticated using (bucket_id = 'site-assets' and public.is_admin())
  with check (bucket_id = 'site-assets' and public.is_admin());
create policy "site-assets admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'site-assets' and public.is_admin());


-- ---------------------------------------------------------------------
-- 7. REALTIME — admin changes appear instantly for every visitor
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['news', 'reels', 'algerian_matches', 'division_crests', 'site_settings', 'site_stats']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- =====================================================================
--  DONE. Optional hardening in the Supabase dashboard (no SQL):
--   • Authentication → Sign In: disable "Allow new users to sign up".
--   • Authentication → Attack Protection: enable CAPTCHA + leaked-password check.
--   • Settings → API → "Max rows": set to 500 (limits bulk scraping via REST).
--   • Give the admin account a NEW strong password (not the demo one).
-- =====================================================================

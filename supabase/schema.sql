-- ============================================================
--  Vocabulary app — Supabase schema
--  Paste into Supabase SQL Editor (or `supabase db push`).
--  Auth: Clerk. DB access: Next.js server uses the SERVICE ROLE
--  key and scopes every query by the Clerk userId in app code.
--  (Service role bypasses RLS, so user tables need no policies.)
-- ============================================================

-- ---------- updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- ============================================================
--  CONTENT (shared, read-only for clients)
-- ============================================================
create table if not exists public.courses (
  id          integer primary key,
  slug        text unique,          -- stable name, e.g. '1000vocab', 'prepvocab'
  title_vi    text not null,
  title_en    text,
  created_at  timestamptz not null default now()
);
-- for DBs created before `slug` existed:
alter table public.courses add column if not exists slug text;
create unique index if not exists courses_slug_key on public.courses(slug);

create table if not exists public.lessons (
  id          integer primary key,
  course_id   integer not null references public.courses(id) on delete cascade,
  sort        integer not null default 0,
  title_en    text,
  title_vi    text,
  code        text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_lessons_course_sort on public.lessons(course_id, sort);

create table if not exists public.words (
  id                  integer primary key,
  lesson_id           integer not null references public.lessons(id) on delete cascade,
  term                text not null,
  pos                 text,
  phonetic_uk         text,
  phonetic_us         text,
  meaning_vi          text,
  meaning_en          text,
  meaning_ja          text,
  meaning_ko          text,
  meaning_th          text,
  meaning_zh          text,
  example_en          text,
  example_vi          text,
  audio_url           text,   -- Supabase Storage public URL (word pronunciation)
  audio_sentence_url  text,   -- example-sentence audio (optional)
  image_url           text,   -- Supabase Storage public URL (word picture)
  created_at          timestamptz not null default now()
);
create index if not exists idx_words_lesson on public.words(lesson_id);

-- ============================================================
--  PER-USER state (Clerk user id = text)
-- ============================================================

-- Spaced-repetition state, one row per (user, word)
create table if not exists public.user_word_progress (
  user_id           text not null,
  word_id           integer not null references public.words(id) on delete cascade,
  proficiency       integer not null default 0,        -- 0..9 (MochiDemy model)
  memory_level      integer not null default 1,        -- 1..5 (notebook bucket)
  ease              real    not null default 2.5,       -- SM-2-ish ease factor
  interval_days     real    not null default 0,         -- current interval
  due_at            timestamptz,                        -- next review time
  last_reviewed_at  timestamptz,
  correct_count     integer not null default 0,
  wrong_count       integer not null default 0,
  status            text    not null default 'active',  -- active | inactive
  first_learned_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (user_id, word_id)
);
-- review queue: due active words for a user, soonest first
create index if not exists idx_uwp_due on public.user_word_progress(user_id, due_at)
  where status = 'active';
create index if not exists idx_uwp_user_level on public.user_word_progress(user_id, memory_level);
create trigger trg_uwp_updated before update on public.user_word_progress
  for each row execute function public.set_updated_at();

-- Daily streak
create table if not exists public.user_streaks (
  user_id          text primary key,
  current_streak   integer not null default 0,
  longest_streak   integer not null default 0,
  last_active_date date,
  daily_goal       integer not null default 20,
  updated_at       timestamptz not null default now()
);
create trigger trg_streak_updated before update on public.user_streaks
  for each row execute function public.set_updated_at();

-- Per-day activity (for streak calendar + stats)
create table if not exists public.user_daily_activity (
  user_id        text not null,
  activity_date  date not null,
  words_learned  integer not null default 0,
  words_reviewed integer not null default 0,
  xp             integer not null default 0,
  primary key (user_id, activity_date)
);
create index if not exists idx_uda_user_date on public.user_daily_activity(user_id, activity_date desc);

-- Free-form per-user settings
create table if not exists public.user_settings (
  user_id     text primary key,
  settings    jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
create trigger trg_settings_updated before update on public.user_settings
  for each row execute function public.set_updated_at();

-- ============================================================
--  ROW LEVEL SECURITY
--  Recommended (server-scoped) setup: enable RLS everywhere.
--  Content tables get public read; user tables get NO policies
--  (only the service-role server client touches them — it bypasses RLS).
-- ============================================================
alter table public.courses              enable row level security;
alter table public.lessons              enable row level security;
alter table public.words                enable row level security;
alter table public.user_word_progress   enable row level security;
alter table public.user_streaks         enable row level security;
alter table public.user_daily_activity  enable row level security;
alter table public.user_settings        enable row level security;

-- public read for content
drop policy if exists "content read courses" on public.courses;
create policy "content read courses" on public.courses for select using (true);
drop policy if exists "content read lessons" on public.lessons;
create policy "content read lessons" on public.lessons for select using (true);
drop policy if exists "content read words" on public.words;
create policy "content read words" on public.words for select using (true);

-- (user_* tables intentionally have no policies; accessed via service role only)

-- ============================================================
--  STORAGE buckets for media
-- ============================================================
insert into storage.buckets (id, name, public)
values ('images','images',true), ('audio','audio',true)
on conflict (id) do nothing;

-- ------------------------------------------------------------
--  OPTIONAL: Clerk-JWT RLS (only if you wire Clerk → Supabase JWT
--  via a Supabase third-party auth / JWT template). Leave commented
--  unless you switch away from the service-role approach.
-- ------------------------------------------------------------
-- create policy "own progress" on public.user_word_progress
--   for all using ((auth.jwt() ->> 'sub') = user_id)
--   with check ((auth.jwt() ->> 'sub') = user_id);
-- (repeat for user_streaks / user_daily_activity / user_settings)

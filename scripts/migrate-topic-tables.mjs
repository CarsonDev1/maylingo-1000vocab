// Idempotently create the 30-day topic-program tables on Supabase Postgres.
// Safe to run on a populated DB. Env (.env.local): SUPABASE_DB_HOST, SUPABASE_DB_PASSWORD.
import pg from "pg";
import { loadEnv } from "./_supabase.mjs";

loadEnv();
const host = process.env.SUPABASE_DB_HOST;
const password = process.env.SUPABASE_DB_PASSWORD;
if (!host || !password) {
  console.error("Missing SUPABASE_DB_HOST / SUPABASE_DB_PASSWORD in .env.local");
  process.exit(1);
}

const SQL = `
create table if not exists public.topic_days (
  day_no       integer primary key,
  lesson_id    integer not null references public.lessons(id),
  title_en     text,
  title_vi     text,
  slides       jsonb   not null default '[]'::jsonb,
  model        text,
  generated_at timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
drop trigger if exists topic_days_updated_at on public.topic_days;
create trigger topic_days_updated_at before update on public.topic_days
  for each row execute function public.set_updated_at();

create table if not exists public.user_topic_progress (
  user_id      text    not null,
  day_no       integer not null,
  completed_at timestamptz not null default now(),
  best_score   integer,
  primary key (user_id, day_no)
);
create index if not exists idx_utp_user on public.user_topic_progress(user_id);

create table if not exists public.user_topic_srs (
  user_id          text    not null,
  word_id          integer not null references public.words(id) on delete cascade,
  proficiency      integer not null default 1,
  memory_level     integer not null default 1,
  ease             real    not null default 2.5,
  interval_days    real    not null default 0,
  due_at           timestamptz,
  last_reviewed_at timestamptz,
  correct_count    integer not null default 0,
  wrong_count      integer not null default 0,
  status           text    not null default 'active',
  first_learned_at timestamptz,
  primary key (user_id, word_id)
);
create index if not exists idx_uts_user_due on public.user_topic_srs(user_id, due_at);
`;

const client = new pg.Client({
  host, port: 5432, user: "postgres", password, database: "postgres",
  ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000,
});

try {
  await client.connect();
  console.error("Connected:", host);
  await client.query(SQL);
  await client.query("notify pgrst, 'reload schema';");
  const { rows } = await client.query(
    "select table_name from information_schema.tables where table_schema='public' and table_name in ('topic_days','user_topic_progress','user_topic_srs') order by table_name",
  );
  console.error("topic tables present:", rows.map((r) => r.table_name).join(", ") || "(none)");
  await client.end();
  process.exit(0);
} catch (e) {
  console.error("MIGRATE ERROR:", e.message);
  await client.end().catch(() => {});
  process.exit(2);
}

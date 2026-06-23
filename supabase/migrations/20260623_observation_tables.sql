create table if not exists public.observation_sessions (
  id uuid primary key default gen_random_uuid(),
  school_code text not null,
  theme_id text not null,
  session_date date not null,
  created_at timestamptz not null default now(),
  constraint observation_sessions_school_code_check check (
    school_code in ('01', '02', '15', '59', '69')
  ),
  constraint observation_sessions_theme_id_check check (
    theme_id in (
      'sawi-berubah-warna','jagung-menari','uji-asam-basa',
      'fotosintesis','serangga-serbuk-sari'
    )
  )
);

create table if not exists public.observation_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.observation_sessions(id) on delete cascade,
  child_name text not null,
  score_1 smallint not null check (score_1 between 1 and 4),
  score_2 smallint not null check (score_2 between 1 and 4),
  score_3 smallint not null check (score_3 between 1 and 4),
  score_4 smallint not null check (score_4 between 1 and 4),
  score_5 smallint not null check (score_5 between 1 and 4),
  score_6 smallint not null check (score_6 between 1 and 4),
  score_7 smallint not null check (score_7 between 1 and 4),
  score_8 smallint not null check (score_8 between 1 and 4),
  score_9 smallint not null check (score_9 between 1 and 4),
  score_10 smallint not null check (score_10 between 1 and 4),
  score_11 smallint not null check (score_11 between 1 and 4),
  score_12 smallint not null check (score_12 between 1 and 4),
  total_score smallint not null check (total_score between 12 and 48),
  average_score numeric(4,2) not null,
  category text not null check (category in ('BSB', 'BSH', 'MB', 'BB')),
  created_at timestamptz not null default now()
);

create index if not exists obs_sessions_school_idx on public.observation_sessions (school_code);
create index if not exists obs_sessions_date_idx on public.observation_sessions (session_date desc);
create index if not exists obs_records_session_idx on public.observation_records (session_id);


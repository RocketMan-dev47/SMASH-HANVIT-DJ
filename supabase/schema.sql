-- 학년 대항 점수판. Supabase 대시보드의 SQL Editor에 붙여 넣고 Run을 누르세요.
create table if not exists grade_runs (
  run_id uuid primary key,
  grade smallint not null check (grade between 1 and 3),
  score integer not null check (score between 0 and 5000000),
  updated_at timestamptz not null default now()
);

-- 표를 직접 읽고 쓰는 건 막고, 아래 함수와 보기(view)로만 허용합니다.
alter table grade_runs enable row level security;

-- 같은 판(run_id)은 가장 높은 점수만 남깁니다.
create or replace function submit_run(p_run uuid, p_grade int, p_score int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_grade not between 1 and 3 or p_score not between 0 and 5000000 then
    return;
  end if;
  insert into grade_runs (run_id, grade, score) values (p_run, p_grade, p_score)
  on conflict (run_id) do update
    set score = greatest(grade_runs.score, excluded.score), updated_at = now()
    where grade_runs.grade = excluded.grade;
end $$;
grant execute on function submit_run(uuid, int, int) to anon;

create or replace view grade_board as
select grade, count(*) as runs, coalesce(sum(score), 0) as total, max(score) as best
from grade_runs
group by grade;
grant select on grade_board to anon;


-- 시즌제(학기별 순위). 이미 위 내용을 실행한 적이 있으면 아래만 실행하세요.
alter table grade_runs add column if not exists season text not null default 'all';
drop function if exists submit_run(uuid, int, int);
create or replace function submit_run(p_run uuid, p_grade int, p_score int, p_season text default 'all')
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_grade not between 1 and 3 or p_score not between 0 and 5000000 or length(p_season) > 10 then
    return;
  end if;
  insert into grade_runs (run_id, grade, score, season) values (p_run, p_grade, p_score, p_season)
  on conflict (run_id) do update
    set score = greatest(grade_runs.score, excluded.score), updated_at = now()
    where grade_runs.grade = excluded.grade;
end $$;
grant execute on function submit_run(uuid, int, int, text) to anon;

drop view if exists grade_board;
create view grade_board as
select season, grade, count(*) as runs, coalesce(sum(score), 0) as total, max(score) as best
from grade_runs
group by season, grade;
grant select on grade_board to anon;


-- 3학년 응원 메시지 벽(선택). 신고 3번이면 자동으로 숨겨져요. 운영 전에 선생님과 꼭 상의하세요.
create table if not exists cheer_messages (
  id bigserial primary key,
  text text not null check (char_length(text) between 1 and 60),
  reports int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
alter table cheer_messages enable row level security;
create or replace function add_cheer(p_text text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if char_length(trim(p_text)) between 1 and 60 then
    insert into cheer_messages (text) values (trim(p_text));
  end if;
end $$;
grant execute on function add_cheer(text) to anon;
create or replace function report_cheer(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update cheer_messages set reports = reports + 1, hidden = (reports + 1 >= 3) where id = p_id;
end $$;
grant execute on function report_cheer(bigint) to anon;
create or replace view cheer_board as
select id, text, created_at from cheer_messages where not hidden;
grant select on cheer_board to anon;


-- 분실물 지도(모두가 같은 지도를 보려면 실행). 30일 지난 핀과 해결된 핀은 안 보여요.
create table if not exists lost_items (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('lost', 'found')),
  name text not null check (char_length(name) between 1 and 24),
  note text check (char_length(note) <= 80),
  x real not null, z real not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
alter table lost_items enable row level security;
create or replace function add_lost(p_kind text, p_name text, p_note text, p_x real, p_z real)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_kind not in ('lost', 'found') or char_length(trim(p_name)) not between 1 and 24 or char_length(coalesce(p_note, '')) > 80 then return; end if;
  -- 1분에 20개 넘게 몰리면 막아요(도배 방지)
  if (select count(*) from lost_items where created_at > now() - interval '1 minute') > 20 then return; end if;
  insert into lost_items (kind, name, note, x, z) values (p_kind, trim(p_name), p_note, p_x, p_z);
end $$;
create or replace function resolve_lost(p_id bigint)
returns void language sql security definer set search_path = public as $$
  update lost_items set resolved = true where id = p_id;
$$;
grant execute on function add_lost(text, text, text, real, real) to anon;
grant execute on function resolve_lost(bigint) to anon;
create or replace view lost_board as
select id, kind, name, note, x, z, created_at from lost_items
where not resolved and created_at > now() - interval '30 days';
grant select on lost_board to anon;


-- ============================================================
-- HASA 텔레메트리(익명 사용 통계) + 관리자 전용 읽기
-- 학생 기기: log_events로 '쓰기'만 가능. 표를 직접 읽을 수는 없어요.
-- 개발자: admin_events에 관리자 키를 넣어야 '읽기' 가능.
-- ============================================================
create extension if not exists pgcrypto with schema extensions;

create table if not exists telemetry_events (
  id bigint generated always as identity primary key,
  session text not null check (char_length(session) <= 64),
  name text not null check (char_length(name) <= 32),
  data jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index if not exists telemetry_events_at on telemetry_events (at desc);
alter table telemetry_events enable row level security;

create or replace function log_events(p_events jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare e jsonb; s text;
begin
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 50 then return; end if;
  s := left(coalesce(p_events->0->>'session', ''), 64);
  -- 세션 하나가 1분에 300개 넘게 보내면 막아요(도배 방지)
  if (select count(*) from telemetry_events where session = s and at > now() - interval '1 minute') > 300 then return; end if;
  for e in select * from jsonb_array_elements(p_events) loop
    if char_length(coalesce(e->>'name', '')) between 1 and 32 and char_length(coalesce((e->'data')::text, '')) <= 1000 then
      insert into telemetry_events (session, name, data) values (left(e->>'session', 64), e->>'name', coalesce(e->'data', '{}'::jsonb));
    end if;
  end loop;
  -- 90일 지난 기록은 가끔씩 지워요
  if random() < 0.01 then delete from telemetry_events where at < now() - interval '90 days'; end if;
end $$;
grant execute on function log_events(jsonb) to anon;

-- 관리자 키는 '해시'만 저장해요(키 자체는 어디에도 안 남아요).
create table if not exists admin_secret (id int primary key default 1 check (id = 1), key_hash text not null);
alter table admin_secret enable row level security;

create or replace function admin_events(p_key text, p_since timestamptz)
returns table (session text, name text, data jsonb, at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from admin_secret where key_hash = encode(digest(p_key, 'sha256'), 'hex')) then
    raise exception 'invalid key' using errcode = '28000';
  end if;
  return query select t.session, t.name, t.data, t.at from telemetry_events t where t.at >= p_since order by t.at desc limit 50000;
end $$;
grant execute on function admin_events(text, timestamptz) to anon;

-- ↓ 아래 한 줄에서 '여기에-나만-아는-긴-키'를 바꿔서 한 번 실행하세요(다시 실행하면 키가 바뀌어요).
-- insert into admin_secret (id, key_hash) values (1, encode(extensions.digest('여기에-나만-아는-긴-키', 'sha256'), 'hex'))
--   on conflict (id) do update set key_hash = excluded.key_hash;


-- ============================================================
-- 선생님 일정(마스터키) · 건의함
-- ============================================================
create table if not exists teacher_secret (id int primary key default 1 check (id = 1), key_hash text not null);
alter table teacher_secret enable row level security;
create table if not exists school_events (
  id bigint generated always as identity primary key,
  date date not null, "end" date, name text not null check (char_length(name) between 1 and 40),
  kind text not null default 'event' check (kind in ('exam', 'event', 'holiday', 'notice')),
  created_at timestamptz not null default now()
);
alter table school_events enable row level security;
create or replace view school_board as select id, date, "end", name, kind from school_events where coalesce("end", date) >= current_date - 400;
grant select on school_board to anon;

create or replace function add_school_event(p_key text, p_date date, p_end date, p_name text, p_kind text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from teacher_secret where key_hash = encode(digest(p_key, 'sha256'), 'hex')) then
    raise exception 'invalid key' using errcode = '28000';
  end if;
  insert into school_events (date, "end", name, kind) values (p_date, p_end, left(trim(p_name), 40), coalesce(nullif(p_kind, ''), 'event'));
end $$;
create or replace function remove_school_event(p_key text, p_id bigint)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from teacher_secret where key_hash = encode(digest(p_key, 'sha256'), 'hex')) then
    raise exception 'invalid key' using errcode = '28000';
  end if;
  delete from school_events where id = p_id;
end $$;
grant execute on function add_school_event(text, date, date, text, text) to anon;
grant execute on function remove_school_event(text, bigint) to anon;
-- 선생님 마스터키 정하기(관리자 키와 다르게!):
-- insert into teacher_secret (id, key_hash) values (1, encode(extensions.digest('선생님-마스터키', 'sha256'), 'hex'))
--   on conflict (id) do update set key_hash = excluded.key_hash;

create table if not exists suggestions (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('feature', 'place', 'bug', 'etc')),
  text text not null check (char_length(text) between 4 and 300),
  grade int not null default 0 check (grade between 0 and 3),
  created_at timestamptz not null default now()
);
alter table suggestions enable row level security;
create or replace function add_suggestion(p_kind text, p_text text, p_grade int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from suggestions where created_at > now() - interval '1 minute') > 10 then return; end if;
  insert into suggestions (kind, text, grade) values (p_kind, left(p_text, 300), coalesce(p_grade, 0));
end $$;
grant execute on function add_suggestion(text, text, int) to anon;
create or replace function admin_suggestions(p_key text)
returns table (id bigint, kind text, text text, grade int, created_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from admin_secret where key_hash = encode(digest(p_key, 'sha256'), 'hex')) then
    raise exception 'invalid key' using errcode = '28000';
  end if;
  return query select s.id, s.kind, s.text, s.grade, s.created_at from suggestions s order by s.created_at desc limit 500;
end $$;
grant execute on function admin_suggestions(text) to anon;


-- ============================================================
-- 선생님 대시보드: 전교 공지 · 응원의 벽 관리(선생님 마스터키)
-- ============================================================
create table if not exists notices (
  id bigint generated always as identity primary key,
  text text not null check (char_length(text) between 1 and 120),
  until date,
  created_at timestamptz not null default now()
);
alter table notices enable row level security;
create or replace view notice_board as
  select id, text, until, created_at from notices where until is null or until >= current_date order by created_at desc limit 1;
grant select on notice_board to anon;

create or replace function teacher_ok(p_key text) returns boolean language sql security definer set search_path = public, extensions as $$
  select exists (select 1 from teacher_secret where key_hash = encode(digest(p_key, 'sha256'), 'hex'));
$$;
create or replace function set_notice(p_key text, p_text text, p_until date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not teacher_ok(p_key) then raise exception 'invalid key' using errcode = '28000'; end if;
  delete from notices;
  if char_length(trim(coalesce(p_text, ''))) > 0 then insert into notices (text, until) values (left(trim(p_text), 120), p_until); end if;
end $$;
create or replace function teacher_cheers(p_key text)
returns table (id bigint, text text, reports int, hidden boolean, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not teacher_ok(p_key) then raise exception 'invalid key' using errcode = '28000'; end if;
  return query select c.id, c.text, c.reports, c.hidden, c.created_at from cheer_messages c order by c.created_at desc limit 300;
end $$;
create or replace function set_cheer_hidden(p_key text, p_id bigint, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not teacher_ok(p_key) then raise exception 'invalid key' using errcode = '28000'; end if;
  update cheer_messages set hidden = p_hidden, reports = case when p_hidden then reports else 0 end where id = p_id;
end $$;
grant execute on function set_notice(text, text, date) to anon;
grant execute on function teacher_cheers(text) to anon;
grant execute on function set_cheer_hidden(text, bigint, boolean) to anon;
revoke execute on function teacher_ok(text) from anon;

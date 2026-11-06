-- SMASH 한빛 2.0 온라인 모드: 협동 레이드 · 레이싱 고스트 공유 · 주간 순위 · 온라인 전체 끄기
-- schema.sql을 먼저 실행한 뒤 이 파일 전체를 SQL Editor에 붙여넣고 Run 하세요. 여러 번 실행해도 안전해요.
-- 모든 표는 RLS로 막아 두고, 게임은 아래 함수(security definer)로만 읽고 써요. 개인 정보는 저장하지 않아요.

-- ===== 협동 레이드 =====
create table if not exists raids (
  id text primary key,                 -- 예: 2026-11-05-lunch
  hp bigint not null,
  started_at timestamptz not null default now(),
  won_at timestamptz
);
create table if not exists raid_hits (
  id bigserial primary key,
  raid_id text not null references raids(id) on delete cascade,
  grade int not null check (grade between 0 and 3),
  dmg bigint not null check (dmg between 1 and 60000),
  client text not null,
  at timestamptz not null default now()
);
create index if not exists raid_hits_raid on raid_hits (raid_id);
create index if not exists raid_hits_client on raid_hits (client, at);
alter table raids enable row level security;
alter table raid_hits enable row level security;

-- 레이드 시작(이미 있으면 그대로): 체력은 20만~500만 사이로 제한
create or replace function raid_start(p_id text, p_hp bigint)
returns json language plpgsql security definer set search_path = public as $$
declare r raids;
begin
  if length(p_id) > 40 then raise exception 'bad id'; end if;
  insert into raids (id, hp) values (p_id, greatest(200000, least(p_hp, 5000000))) on conflict (id) do nothing;
  select * into r from raids where id = p_id;
  return json_build_object('id', r.id, 'hp', r.hp, 'won', r.won_at is not null);
end $$;

-- 피해 보내기: 기기당 1분에 40번까지, 한 번에 최대 6만
create or replace function raid_hit(p_id text, p_grade int, p_dmg bigint, p_client text)
returns json language plpgsql security definer set search_path = public as $$
declare r raids; tot bigint; recent int;
begin
  select * into r from raids where id = p_id;
  if r.id is null or r.won_at is not null then return raid_state(p_id); end if;
  select count(*) into recent from raid_hits where client = left(p_client, 16) and at > now() - interval '1 minute';
  if recent >= 40 then return raid_state(p_id); end if;
  insert into raid_hits (raid_id, grade, dmg, client) values (p_id, greatest(0, least(p_grade, 3)), greatest(1, least(p_dmg, 60000)), left(p_client, 16));
  select coalesce(sum(dmg), 0) into tot from raid_hits where raid_id = p_id;
  if tot >= r.hp then update raids set won_at = now() where id = p_id and won_at is null; end if;
  return raid_state(p_id);
end $$;

-- 레이드 상황: 전체 체력, 깎은 양, 학년별 기여
create or replace function raid_state(p_id text)
returns json language sql security definer set search_path = public as $$
  select json_build_object(
    'id', r.id, 'hp', r.hp, 'won', r.won_at is not null,
    'total', coalesce((select sum(dmg) from raid_hits h where h.raid_id = r.id), 0),
    'g1', coalesce((select sum(dmg) from raid_hits h where h.raid_id = r.id and grade = 1), 0),
    'g2', coalesce((select sum(dmg) from raid_hits h where h.raid_id = r.id and grade = 2), 0),
    'g3', coalesce((select sum(dmg) from raid_hits h where h.raid_id = r.id and grade = 3), 0),
    'players', (select count(distinct client) from raid_hits h where h.raid_id = r.id)
  ) from raids r where r.id = p_id
$$;

-- ===== 레이싱 고스트 공유 · 주간 순위 =====
create table if not exists race_ghosts (
  circuit text not null,
  week text not null,                  -- 예: 2026-W45
  client text not null,
  name text not null,
  grade int not null default 0,
  lap_ms int not null,
  data jsonb not null,
  at timestamptz not null default now(),
  primary key (circuit, week, client)
);
alter table race_ghosts enable row level security;

-- 내 최고 랩 고스트 올리기(더 빠를 때만 바꿔요). 30초~10분, 고스트 크기 60 KB까지
create or replace function submit_ghost(p_circuit text, p_week text, p_client text, p_name text, p_grade int, p_lap int, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_lap < 30000 or p_lap > 600000 then return; end if;
  if length(p_data::text) > 60000 or length(p_circuit) > 12 or length(p_week) > 10 then return; end if;
  insert into race_ghosts (circuit, week, client, name, grade, lap_ms, data)
  values (p_circuit, p_week, left(p_client, 16), left(p_name, 20), greatest(0, least(p_grade, 3)), p_lap, p_data)
  on conflict (circuit, week, client) do update
    set lap_ms = excluded.lap_ms, data = excluded.data, name = excluded.name, grade = excluded.grade, at = now()
    where race_ghosts.lap_ms > excluded.lap_ms;
end $$;

-- 이번 주 순위(고스트 데이터는 빼고)
create or replace function weekly_top(p_circuit text, p_week text, p_limit int default 10)
returns table (name text, grade int, lap_ms int, client text) language sql security definer set search_path = public as $$
  select name, grade, lap_ms, client from race_ghosts where circuit = p_circuit and week = p_week order by lap_ms asc limit least(greatest(p_limit, 1), 30)
$$;

-- 고스트 한 개 받기
create or replace function get_ghost(p_circuit text, p_week text, p_client text)
returns jsonb language sql security definer set search_path = public as $$
  select json_build_object('t', lap_ms / 1000.0, 's', data, 'name', name)::jsonb from race_ghosts where circuit = p_circuit and week = p_week and client = p_client
$$;

-- ===== 온라인 전체 끄기(선생님) =====
create table if not exists app_flags (key text primary key, value jsonb not null, at timestamptz not null default now());
alter table app_flags enable row level security;

create or replace function get_flags()
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from app_flags
$$;

create or replace function set_flag(p_key text, p_flag text, p_value jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not teacher_ok(p_key) then raise exception '선생님 키가 맞지 않아요'; end if;
  if p_flag not in ('online_off', 'raid_off') then raise exception 'unknown flag'; end if;
  insert into app_flags (key, value) values (p_flag, p_value) on conflict (key) do update set value = excluded.value, at = now();
end $$;

-- 게임(로그인 없는 익명 키)이 쓸 수 있는 함수만 열어요
grant execute on function raid_start(text, bigint) to anon;
grant execute on function raid_hit(text, int, bigint, text) to anon;
grant execute on function raid_state(text) to anon;
grant execute on function submit_ghost(text, text, text, text, int, int, jsonb) to anon;
grant execute on function weekly_top(text, text, int) to anon;
grant execute on function get_ghost(text, text, text) to anon;
grant execute on function get_flags() to anon;
grant execute on function set_flag(text, text, jsonb) to anon;

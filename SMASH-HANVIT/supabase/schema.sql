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

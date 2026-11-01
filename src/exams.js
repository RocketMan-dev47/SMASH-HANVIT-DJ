// 시험 D-day. config.json의 exams에 학사일정 날짜를 넣어 주세요.
export function nextExam(exams, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return (exams || [])
    .map((e) => {
      const start = new Date(`${e.date}T00:00`);
      const end = e.end ? new Date(`${e.end}T00:00`) : start;
      return { ...e, days: Math.round((start - today) / 86400000), during: today >= start && today <= end };
    })
    .filter((e) => e.days >= 0 || e.during)
    .sort((a, b) => a.days - b.days)[0] || null;
}

// 시험 2주 전부터 하루에 5%씩 점수가 올라 시험 기간에는 1.7배가 돼요.
export function examBonus(e) {
  if (!e) return 1;
  if (e.during || e.days <= 0) return 1.7;
  if (e.days > 14) return 1;
  return 1 + (14 - e.days) * 0.05;
}

export function examLabel(e) {
  if (!e) return '';
  if (e.during) return `${e.name} 기간`;
  return `${e.name} ${e.days === 0 ? 'D-DAY' : `D-${e.days}`}`;
}

// 시험이 끝난 다음 날이면 그 시험을 돌려줘요(운동장 불꽃놀이).
export function celebration(exams, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (const e of exams || []) {
    const end = new Date(`${e.end || e.date}T00:00`);
    const after = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
    if (after.getTime() === today.getTime()) return e;
  }
  return null;
}

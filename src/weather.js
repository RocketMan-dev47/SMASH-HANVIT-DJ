// 실시간 대전 날씨(Open-Meteo, 키 없이 쓰는 공개 API). 오늘 날짜일 때만 게임에 반영해요.
const NAMES = [
  [[0], '맑음', 'clear'], [[1, 2], '구름 조금', 'clear'], [[3], '흐림', 'cloud'], [[45, 48], '안개', 'fog'],
  [[51, 53, 55, 56, 57], '이슬비', 'rain'], [[61, 63, 65, 66, 67], '비', 'rain'], [[71, 73, 75, 77], '눈', 'snow'],
  [[80, 81, 82], '소나기', 'rain'], [[85, 86], '눈 소나기', 'snow'], [[95, 96, 99], '뇌우', 'storm'],
];

export async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day,cloud_cover&timezone=Asia%2FSeoul`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.status);
  const d = await r.json();
  const c = d.current;
  const hit = NAMES.find(([codes]) => codes.includes(c.weather_code)) || [[], '맑음', 'clear'];
  return { temp: Math.round(c.temperature_2m), name: hit[1], kind: hit[2], day: !!c.is_day, cloud: c.cloud_cover };
}

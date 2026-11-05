// Supabase Edge Function: 대전 버스 실시간 도착 정보 중계(국토교통부 TAGO 버스도착정보 API)
// 공공데이터포털 서비스 키는 서버에만 두고(TAGO_KEY), 브라우저에는 결과만 보내요.
// 배포: supabase secrets set TAGO_KEY=발급받은키  →  supabase functions deploy bus --no-verify-jwt
// 정류소ID(nodeId)는 config.json의 bus.nodeId 또는 아래 기본값을 바꿔 쓰세요(예: DJB8001793 형식).
const NODE = Deno.env.get('BUS_NODE') ?? 'DJB00000000';
const CITY = '25'; // 대전

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const key = Deno.env.get('TAGO_KEY');
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'max-age=20' };
  if (!key) return new Response(JSON.stringify({ error: 'TAGO_KEY 없음' }), { status: 500, headers: cors });
  // ?stop=22670 처럼 정류소 번호(ARS)로 오면 TAGO 정류소 ID(nodeId)를 찾아요
  let node = url.searchParams.get('node') ?? NODE;
  const ars = url.searchParams.get('stop');
  if (ars) {
    try {
      const q = `https://apis.data.go.kr/1613000/BusSttnInfoInqireService/getSttnNoList?serviceKey=${encodeURIComponent(key)}&_type=json&cityCode=${CITY}&nodeNo=${encodeURIComponent(ars)}&numOfRows=5`;
      const d0 = await (await fetch(q)).json();
      let it = d0?.response?.body?.items?.item ?? [];
      if (!Array.isArray(it)) it = [it];
      const hit = it.find((x: Record<string, unknown>) => String(x.nodeno) === ars) ?? it[0];
      if (hit?.nodeid) node = String(hit.nodeid);
    } catch { /* 못 찾으면 기본값 */ }
  }
  const api = `https://apis.data.go.kr/1613000/ArvlInfoInqireService/getSttnAcctoArvlPrearngeInfoList?serviceKey=${encodeURIComponent(key)}&_type=json&cityCode=${CITY}&nodeId=${node}&numOfRows=30`;
  try {
    const r = await fetch(api);
    const d = await r.json();
    let items = d?.response?.body?.items?.item ?? [];
    if (!Array.isArray(items)) items = [items];
    const out = items.map((x: Record<string, unknown>) => ({
      no: String(x.routeno), min: Math.round(Number(x.arrtime) / 60), stops: Number(x.arrprevstationcnt), type: String(x.routetp ?? ''),
    })).sort((a: { min: number }, b: { min: number }) => a.min - b.min);
    return new Response(JSON.stringify(out), { headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: cors });
  }
});

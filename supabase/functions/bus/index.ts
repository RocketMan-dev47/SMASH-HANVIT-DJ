// Supabase Edge Function: 대전 버스 실시간 도착 정보 중계(국토교통부 TAGO 버스도착정보 API)
// 공공데이터포털 서비스 키는 서버에만 두고(TAGO_KEY), 브라우저에는 결과만 보내요.
// 배포: supabase secrets set TAGO_KEY=발급받은키  →  supabase functions deploy bus --no-verify-jwt
// 정류소ID(nodeId)는 config.json의 bus.nodeId 또는 아래 기본값을 바꿔 쓰세요(예: DJB8001793 형식).
const NODE = Deno.env.get('BUS_NODE') ?? 'DJB00000000';
const CITY = '25'; // 대전

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const key = Deno.env.get('TAGO_KEY');
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'max-age=20' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors }); // 브라우저 사전 확인
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
    const text = await r.text();
    let d: any = null;
    try { d = JSON.parse(text); } catch { return new Response(JSON.stringify({ error: (text.match(/<returnAuthMsg>([^<]+)/)?.[1] || text.slice(0, 120)) }), { status: 502, headers: cors }); }
    const code = d?.response?.header?.resultCode;
    if (code && code !== '00') return new Response(JSON.stringify({ error: d?.response?.header?.resultMsg || code }), { status: 502, headers: cors });
    let items = d?.response?.body?.items?.item ?? [];
    if (!Array.isArray(items)) items = [items];
    const buses = items.map((x: Record<string, unknown>) => ({
      no: String(x.routeno), type: String(x.routetp ?? ''), sec: Number(x.arrtime), min: Math.max(0, Math.round(Number(x.arrtime) / 60)),
      stops: Number(x.arrprevstationcnt), low: String(x.vehicletp ?? '').includes('저상'), stop: String(x.nodenm ?? ''),
    })).sort((a: { sec: number }, b: { sec: number }) => a.sec - b.sec);
    return new Response(JSON.stringify({ node, buses, at: new Date().toISOString() }), { headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: cors });
  }
});

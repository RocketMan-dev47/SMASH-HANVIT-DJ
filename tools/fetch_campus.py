#!/usr/bin/env python3
"""OpenStreetMap과 AWS Terrain Tiles에서 학교 지도를 받아 data/campus.json을 만듭니다.

쓰는 법
  1) 학교 찾기:      python3 tools/fetch_campus.py find 한빛고
  2) 데이터 만들기:  python3 tools/fetch_campus.py build --way 123456789
     경계가 없으면:  python3 tools/fetch_campus.py build --center 36.30 127.40 --radius 220

필요한 것: Pillow (pip install pillow). 땅 높이를 안 받으려면 --no-terrain.
"""
import argparse
import io
import json
import math
import os
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request

OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
UA = "hanvit-smash/1.0 (school fan game; educational)"
DAEJEON_BBOX = (36.15, 127.20, 36.55, 127.60)  # 남, 서, 북, 동

ROAD_WIDTH = {
    "motorway": 14, "trunk": 12, "primary": 11, "secondary": 9, "tertiary": 8,
    "residential": 6, "unclassified": 6, "living_street": 5, "service": 4.5,
    "pedestrian": 4, "track": 3, "cycleway": 2, "footway": 2, "path": 1.5,
    "steps": 2, "motorway_link": 7, "trunk_link": 7, "primary_link": 7,
    "secondary_link": 6, "tertiary_link": 6,
}
SKIP_BUILDING = {"roof", "carport", "no", "construction", "ruins"}
RESIDENTIAL_WORDS = ["아파트", "APT", "빌라", "오피스텔"]


# ---------- 네트워크 ----------
USE_CURL = False


def curl_get(url, data=None, timeout=90):
    cmd = ["curl", "-sS", "--fail", "-L", "--max-time", str(int(timeout)), "-A", UA]
    if data is not None:
        cmd += ["--data-binary", "@-"]
    cmd.append(url)
    r = subprocess.run(cmd, input=data, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError("curl: " + r.stderr.decode("utf-8", "ignore").strip()[:200])
    return r.stdout


def http_get(url, data=None, timeout=90):
    # 맥 기본 파이썬(3.9)은 SSL 부품이 오래돼 일부 서버와 연결을 못 해요. 그럴 땐 맥에 있는 curl을 대신 써요.
    global USE_CURL
    if not USE_CURL:
        try:
            req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            if "SSL" not in str(e) and "CERTIFICATE" not in str(e).upper():
                raise
            if not shutil.which("curl"):
                raise
            print("  파이썬 보안 연결이 안 돼서 curl로 바꿔 받을게요.", file=sys.stderr)
            USE_CURL = True
    return curl_get(url, data, timeout)


def overpass(query):
    body = urllib.parse.urlencode({"data": query}).encode()
    last = None
    for url in OVERPASS:
        for attempt in range(2):
            try:
                return json.loads(http_get(url, body, timeout=180))
            except Exception as e:  # noqa: BLE001
                last = e
                print(f"  Overpass 요청 실패 ({url}, {attempt + 1}번째): {e}", file=sys.stderr)
                time.sleep(3)
    raise SystemExit(f"Overpass 서버에 연결하지 못했어요: {last}")


# ---------- 좌표 ----------
class Projector:
    """위도·경도를 학교 중심 기준 미터 좌표로 바꿉니다. x는 동쪽, z는 남쪽."""

    def __init__(self, lat0, lon0):
        self.lat0, self.lon0 = lat0, lon0
        self.kx = math.cos(math.radians(lat0)) * 111320.0
        self.kz = 110574.0

    def xz(self, lat, lon):
        return [round((lon - self.lon0) * self.kx, 2), round(-(lat - self.lat0) * self.kz, 2)]

    def latlon(self, x, z):
        return self.lat0 - z / self.kz, self.lon0 + x / self.kx


def ring_area(pts):
    a = 0.0
    for i in range(len(pts)):
        x1, z1 = pts[i]
        x2, z2 = pts[(i + 1) % len(pts)]
        a += x1 * z2 - x2 * z1
    return a / 2


def ring_centroid(pts):
    a = cx = cz = 0.0
    for i in range(len(pts)):
        x1, z1 = pts[i]
        x2, z2 = pts[(i + 1) % len(pts)]
        f = x1 * z2 - x2 * z1
        a += f
        cx += (x1 + x2) * f
        cz += (z1 + z2) * f
    if abs(a) < 1e-9:
        return [sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)]
    return [cx / (3 * a), cz / (3 * a)]


def point_in_poly(pt, poly):
    x, z = pt
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, zi = poly[i]
        xj, zj = poly[j]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi) + xi:
            inside = not inside
        j = i
    return inside


def join_rings(segments):
    """여러 조각의 길(way)을 이어 닫힌 고리로 만듭니다. segments: [[(lat,lon),...], ...]"""
    segs = [list(s) for s in segments if len(s) >= 2]
    rings = []
    while segs:
        ring = segs.pop(0)
        changed = True
        while ring[0] != ring[-1] and changed:
            changed = False
            for i, s in enumerate(segs):
                if s[0] == ring[-1]:
                    ring += s[1:]
                elif s[-1] == ring[-1]:
                    ring += list(reversed(s))[1:]
                elif s[-1] == ring[0]:
                    ring = s[:-1] + ring
                elif s[0] == ring[0]:
                    ring = list(reversed(s))[:-1] + ring
                else:
                    continue
                segs.pop(i)
                changed = True
                break
        if len(ring) >= 4:
            rings.append(ring)
    return rings


def geom_latlon(el):
    return [(g["lat"], g["lon"]) for g in el.get("geometry", []) if g]


def element_rings(el):
    """way나 multipolygon relation의 바깥 고리들을 (lat,lon) 목록으로 돌려줍니다."""
    if el["type"] == "way":
        g = geom_latlon(el)
        return [g] if len(g) >= 4 and g[0] == g[-1] else []
    if el["type"] == "relation":
        outers = [geom_latlon(m) for m in el.get("members", []) if m.get("role", "outer") in ("outer", "") and m.get("type") == "way"]
        return join_rings(outers)
    return []


# ---------- 찾기 ----------
def cmd_find(args):
    s, w, n, e = args.bbox or DAEJEON_BBOX
    q = args.query.replace('"', "")
    query = f"""[out:json][timeout:60];
nwr["amenity"~"school|college|university"]["name"~"{q}"]({s},{w},{n},{e});
out tags center;"""
    data = overpass(query)
    els = data.get("elements", [])
    if not els:
        print("찾은 학교가 없어요. 이름을 더 짧게 넣어 보세요 (예: 한빛).")
        return
    for el in els:
        name = el.get("tags", {}).get("name", "(이름 없음)")
        c = el.get("center") or {"lat": el.get("lat"), "lon": el.get("lon")}
        kind = {"way": "경계 있음", "relation": "경계 있음(여러 조각)", "node": "점만 있음"}[el["type"]]
        print(f"- {name}  [{el['type']} {el['id']}]  {kind}  ({c['lat']:.5f}, {c['lon']:.5f})")
        if el["type"] in ("way", "relation"):
            print(f"    → python3 tools/fetch_campus.py build --{el['type']} {el['id']}")
        else:
            print(f"    → python3 tools/fetch_campus.py build --center {c['lat']:.5f} {c['lon']:.5f} --radius 220")


# ---------- 높이 추정 ----------
def parse_float(v):
    if v is None:
        return None
    try:
        return float(str(v).lower().replace("m", "").replace(",", ".").strip().split(";")[0])
    except ValueError:
        return None


def guess_levels(tags, area):
    kind = tags.get("building", "yes")
    if kind in ("school", "college", "university", "dormitory"):
        return 4
    if kind in ("house", "detached", "residential", "semidetached_house"):
        return 2
    if kind in ("garage", "garages", "shed", "kiosk", "hut", "toilets", "service"):
        return 1
    if area < 80:
        return 1
    if area < 300:
        return 2
    return 3


# ---------- 땅 높이 ----------
def lonlat_to_pixel(lat, lon, z):
    n = 2 ** z * 256
    x = (lon + 180.0) / 360.0 * n
    lat_r = math.radians(lat)
    y = (1.0 - math.log(math.tan(lat_r) + 1.0 / math.cos(lat_r)) / math.pi) / 2.0 * n
    return x, y


def fetch_terrain(proj, x0, z0, w, d, spacing, zoom=15):
    try:
        from PIL import Image
    except ImportError:
        print("Pillow가 없어서 땅을 평평하게 둡니다. (pip install pillow)", file=sys.stderr)
        return None
    nx = int(round(w / spacing)) + 1
    nz = int(round(d / spacing)) + 1
    tiles = {}

    def tile(tx, ty):
        key = (tx, ty)
        if key not in tiles:
            url = TILE_URL.format(z=zoom, x=tx, y=ty)
            try:
                img = Image.open(io.BytesIO(http_get(url, timeout=60))).convert("RGB")
                tiles[key] = img.load()
            except Exception as e:  # noqa: BLE001
                print(f"  고도 타일을 못 받았어요 {url}: {e}", file=sys.stderr)
                tiles[key] = None
        return tiles[key]

    def elev(px, py):
        tx, ty = int(px // 256), int(py // 256)
        t = tile(tx, ty)
        if t is None:
            return None
        r, g, b = t[int(px) % 256, int(py) % 256]
        return r * 256 + g + b / 256 - 32768

    def sample(lat, lon):
        px, py = lonlat_to_pixel(lat, lon, zoom)
        px -= 0.5
        py -= 0.5
        fx, fy = math.floor(px), math.floor(py)
        ax, ay = px - fx, py - fy
        vals = [elev(fx, fy), elev(fx + 1, fy), elev(fx, fy + 1), elev(fx + 1, fy + 1)]
        if any(v is None for v in vals):
            return None
        top = vals[0] * (1 - ax) + vals[1] * ax
        bot = vals[2] * (1 - ax) + vals[3] * ax
        return top * (1 - ay) + bot * ay

    grid = []
    missing = 0
    for j in range(nz):
        row = []
        for i in range(nx):
            lat, lon = proj.latlon(x0 + i * spacing, z0 + j * spacing)
            v = sample(lat, lon)
            if v is None or v < -100:
                missing += 1
                v = None
            row.append(v)
        grid.append(row)
    vals = [v for row in grid for v in row if v is not None]
    if not vals:
        return None
    fill = sorted(vals)[len(vals) // 2]
    grid = [[fill if v is None else v for v in row] for row in grid]
    # 30 m 자료라 들쭉날쭉해서 두 번 부드럽게 폅니다.
    for _ in range(2):
        g2 = []
        for j in range(nz):
            r2 = []
            for i in range(nx):
                s = c = 0.0
                for dj in (-1, 0, 1):
                    for di in (-1, 0, 1):
                        jj, ii = j + dj, i + di
                        if 0 <= jj < nz and 0 <= ii < nx:
                            s += grid[jj][ii]
                            c += 1
                r2.append(s / c)
            g2.append(r2)
        grid = g2
    lo = min(min(r) for r in grid)
    flat = [round(v - lo, 2) for row in grid for v in row]
    print(f"  땅 높이: {nx}×{nz} 칸, 높낮이 차 {max(flat):.1f} m (해발 {lo:.0f} m 기준), 빈칸 {missing}")
    return {"x0": x0, "z0": z0, "w": w, "d": d, "nx": nx, "nz": nz, "elev0": round(lo, 1), "h": flat}


# ---------- 만들기 ----------
def cmd_build(args):
    boundary_ll = None
    name = args.name
    if args.way or args.relation:
        typ, oid = ("way", args.way) if args.way else ("relation", args.relation)
        print(f"학교 경계를 받는 중… ({typ} {oid})")
        data = overpass(f"[out:json][timeout:60];{typ}({oid});out geom;")
        els = data.get("elements", [])
        if not els:
            raise SystemExit("그 번호의 경계를 찾지 못했어요. find 명령으로 번호를 다시 확인해 주세요.")
        rings = element_rings(els[0])
        if not rings:
            raise SystemExit("경계가 닫힌 모양이 아니에요. --center 와 --radius 방식을 써 주세요.")
        boundary_ll = max(rings, key=len)
        name = name or els[0].get("tags", {}).get("name")
        core = boundary_ll[:-1] if boundary_ll[0] == boundary_ll[-1] else boundary_ll
        lat0 = sum(p[0] for p in core) / len(core)
        lon0 = sum(p[1] for p in core) / len(core)
    elif args.center:
        lat0, lon0 = args.center
    else:
        raise SystemExit("--way, --relation, --center 중 하나가 필요해요.")

    proj = Projector(lat0, lon0)
    boundary = [proj.xz(*p) for p in boundary_ll] if boundary_ll else None
    if boundary and boundary[0] == boundary[-1]:
        boundary = boundary[:-1]

    if boundary:
        xs = [p[0] for p in boundary]
        zs = [p[1] for p in boundary]
        bx0, bx1, bz0, bz1 = min(xs), max(xs), min(zs), max(zs)
    else:
        r = args.radius
        bx0, bx1, bz0, bz1 = -r, r, -r, r
    m = args.margin
    x0, x1, z0, z1 = bx0 - m, bx1 + m, bz0 - m, bz1 + m
    s_lat, w_lon = proj.latlon(x0, z1)
    n_lat, e_lon = proj.latlon(x1, z0)
    bbox = f"{s_lat:.6f},{w_lon:.6f},{n_lat:.6f},{e_lon:.6f}"

    print("건물·길·녹지를 받는 중…")
    query = f"""[out:json][timeout:120];
(
  way["building"]({bbox});
  relation["building"]["type"="multipolygon"]({bbox});
  way["highway"]({bbox});
  way["leisure"]({bbox});
  way["landuse"]({bbox});
  way["natural"]({bbox});
  way["amenity"="parking"]({bbox});
  node["natural"="tree"]({bbox});
);
out geom;"""
    data = overpass(query)
    result = build_campus(data, proj, boundary, args, (x0, z0, x1, z1), name)

    if not args.no_terrain:
        print("땅 높이를 받는 중…")
        terr = fetch_terrain(proj, round(x0, 1), round(z0, 1), round(x1 - x0, 1), round(z1 - z0, 1), args.spacing)
        if terr:
            result["terrain"] = terr

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, separators=(",", ":"))
    print(f"완성: {args.out}  (건물 {len(result['buildings'])}동, 길 {len(result['roads'])}개, 구역 {len(result['areas'])}개, 나무 {len(result['trees'])}그루)")
    named = [b for b in result["buildings"] if b.get("name")]
    if named:
        print("이름 있는 건물: " + ", ".join(f"{b['name']}({b['id']})" for b in named))
    unnamed = len(result["buildings"]) - len(named)
    if unnamed:
        print(f"이름 없는 건물 {unnamed}동은 config.json의 buildings에 id로 이름·층수를 적을 수 있어요.")


def build_campus(data, proj, boundary, args, extent, name):
    x0, z0, x1, z1 = extent
    buildings, roads, areas, trees = [], [], [], []
    exclude = [w.strip() for w in (args.exclude or "").split(",") if w.strip()]
    if not boundary and not args.exclude:
        exclude = RESIDENTIAL_WORDS

    def inside_campus(pt):
        if boundary:
            return point_in_poly(pt, boundary)
        return math.hypot(pt[0], pt[1]) <= args.radius

    for el in data.get("elements", []):
        tags = el.get("tags", {})
        typ = el["type"]
        if typ == "node":
            if tags.get("natural") == "tree":
                p = proj.xz(el["lat"], el["lon"])
                if x0 <= p[0] <= x1 and z0 <= p[1] <= z1:
                    trees.append(p)
            continue

        if "building" in tags:
            if tags["building"] in SKIP_BUILDING:
                continue
            for ring in element_rings(el):
                pts = [proj.xz(*p) for p in ring][:-1]
                if len(pts) < 3:
                    continue
                area = abs(ring_area(pts))
                if area < 12:
                    continue
                c = ring_centroid(pts)
                bname = tags.get("name") or tags.get("name:ko")
                if not args.keep_outside and not inside_campus(c):
                    continue
                if bname and any(w in bname for w in exclude):
                    continue
                height = parse_float(tags.get("height"))
                levels = parse_float(tags.get("building:levels"))
                b = {"id": f"{typ[0]}{el['id']}", "poly": pts}
                if bname:
                    b["name"] = bname
                if levels:
                    b["levels"] = max(1, int(round(levels)))
                if height:
                    b["height"] = round(height, 1)
                if not levels and not height:
                    b["levels"] = guess_levels(tags, area)
                    b["est"] = True
                if not inside_campus(c):
                    b["outside"] = True
                buildings.append(b)
            continue

        if typ == "way" and "highway" in tags:
            kind = tags["highway"]
            if kind in ("construction", "proposed", "platform", "elevator", "corridor"):
                continue
            if tags.get("area") == "yes":
                continue
            width = parse_float(tags.get("width")) or ROAD_WIDTH.get(kind, 4)
            pts = [proj.xz(*p) for p in geom_latlon(el)]
            if len(pts) >= 2:
                roads.append({"kind": kind, "w": round(width, 1), "pts": pts})
            continue

        kind = None
        leisure, landuse, natural = tags.get("leisure"), tags.get("landuse"), tags.get("natural")
        if leisure == "pitch":
            kind = "pitch"
        elif leisure == "track":
            kind = "track"
        elif leisure in ("park", "garden", "playground"):
            kind = "grass"
        elif landuse in ("grass", "meadow", "recreation_ground", "village_green", "flowerbed"):
            kind = "grass"
        elif landuse == "forest" or natural == "wood":
            kind = "forest"
        elif natural == "scrub":
            kind = "scrub"
        elif tags.get("amenity") == "parking" or landuse == "garages":
            kind = "parking"
        elif natural in ("sand", "beach"):
            kind = "sand"
        elif natural == "water" or landuse in ("reservoir", "basin"):
            kind = "water"
        if kind:
            for ring in element_rings(el):
                pts = [proj.xz(*p) for p in ring][:-1]
                if len(pts) >= 3:
                    a = {"kind": kind, "poly": pts}
                    if kind == "pitch" and tags.get("surface"):
                        a["surface"] = tags["surface"]
                    areas.append(a)

    out = {
        "version": 1,
        "name": name or "우리 학교",
        "origin": {"lat": round(proj.lat0, 7), "lon": round(proj.lon0, 7)},
        "boundary": boundary,
        "buildings": buildings,
        "roads": roads,
        "areas": areas,
        "trees": trees,
        "credit": "© OpenStreetMap contributors (ODbL), elevation: AWS Terrain Tiles",
    }
    return out


def main():
    ap = argparse.ArgumentParser(description="학교 지도 데이터 만들기")
    sub = ap.add_subparsers(dest="cmd", required=True)

    f = sub.add_parser("find", help="이름으로 학교 찾기 (기본: 대전 지역)")
    f.add_argument("query")
    f.add_argument("--bbox", nargs=4, type=float, metavar=("S", "W", "N", "E"))
    f.set_defaults(func=cmd_find)

    b = sub.add_parser("build", help="data/campus.json 만들기")
    b.add_argument("--way", type=int)
    b.add_argument("--relation", type=int)
    b.add_argument("--center", nargs=2, type=float, metavar=("LAT", "LON"))
    b.add_argument("--radius", type=float, default=220, help="--center 방식일 때 반경(m)")
    b.add_argument("--margin", type=float, default=70, help="학교 밖으로 더 받을 거리(m)")
    b.add_argument("--spacing", type=float, default=4, help="땅 높이 간격(m)")
    b.add_argument("--keep-outside", action="store_true", help="학교 밖 건물도 넣기")
    b.add_argument("--exclude", help="이름에 이 말이 들어간 건물 빼기 (쉼표로 구분)")
    b.add_argument("--name", help="학교 이름")
    b.add_argument("--no-terrain", action="store_true")
    b.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "data", "campus.json"))
    b.set_defaults(func=cmd_build)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()

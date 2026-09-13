"""One-off: build site/data/map.json from OSM-derived GeoJSON.

python3 -m forecast.geo   (output is committed; the scheduled build does not run this)
"""
from __future__ import annotations

import json
import math
import urllib.parse
from pathlib import Path
from typing import List, Sequence, Tuple

from .fetch import fetch_bytes
from .regions import KYIV_CITY, PERMANENT_REGIONS

OBLASTS_URL = "https://raw.githubusercontent.com/EugeneBorshch/ukraine_geojson/master/UA_FULL_Ukraine.geojson"
KYIV_QUERY = urllib.parse.urlencode({
    "q": "Київ", "countrycodes": "ua", "format": "geojson", "polygon_geojson": 1,
    "polygon_threshold": 0.001, "limit": 1, "featureType": "city",
})
KYIV_URL = f"https://nominatim.openstreetmap.org/search?{KYIV_QUERY}"
WIDTH = 1000.0
PAD = 12.0
TOLERANCE = 0.45
LABEL_GRID = 36

SHORT = {"Автономна Республіка Крим": "А. Р. Крим", KYIV_CITY: "м. Київ"}

Point = Tuple[float, float]


def mercator(lon: float, lat: float) -> Point:
    return math.radians(lon), -math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def simplify(points: Sequence[Point], tolerance: float) -> List[Point]:
    if len(points) < 3:
        return list(points)
    (ax, ay), (bx, by) = points[0], points[-1]
    dx, dy = bx - ax, by - ay
    norm = math.hypot(dx, dy) or 1e-12
    far, index = -1.0, 0
    for i in range(1, len(points) - 1):
        px, py = points[i]
        dist = abs(dy * px - dx * py + bx * ay - by * ax) / norm
        if dist > far:
            far, index = dist, i
    if far <= tolerance:
        return [points[0], points[-1]]
    return simplify(points[: index + 1], tolerance)[:-1] + simplify(points[index:], tolerance)


def simplify_ring(ring: Sequence[Point], tolerance: float) -> List[Point]:
    """Closed rings start and end on the same point, so split at the farthest vertex first."""
    open_ring = list(ring[:-1]) if len(ring) > 1 and ring[0] == ring[-1] else list(ring)
    if len(open_ring) < 4:
        return open_ring
    x0, y0 = open_ring[0]
    far = max(range(len(open_ring)), key=lambda i: math.hypot(open_ring[i][0] - x0, open_ring[i][1] - y0))
    first = simplify(open_ring[: far + 1], tolerance)
    second = simplify(open_ring[far:] + [open_ring[0]], tolerance)
    return first[:-1] + second[:-1]


def outer_rings(geometry: dict) -> List[List[Point]]:
    """Largest ring of each polygon; some source files list the outer ring last."""
    polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
    return [[(float(x), float(y)) for x, y in max(polygon, key=len)] for polygon in polygons]


def inside(point: Point, ring: Sequence[Point]) -> bool:
    x, y = point
    result = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            result = not result
    return result


def edge_distance(point: Point, ring: Sequence[Point]) -> float:
    px, py = point
    best = float("inf")
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        dx, dy = x2 - x1, y2 - y1
        t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy or 1e-12)))
        best = min(best, math.hypot(px - x1 - t * dx, py - y1 - t * dy))
    return best


def label_point(ring: Sequence[Point], holes: Sequence[Sequence[Point]] = ()) -> Point:
    """Grid approximation of the pole of inaccessibility, biased to wide spots."""
    xs, ys = [p[0] for p in ring], [p[1] for p in ring]
    best, best_score = ring[0], -1.0
    for i in range(1, LABEL_GRID):
        for j in range(1, LABEL_GRID):
            candidate = (min(xs) + (max(xs) - min(xs)) * i / LABEL_GRID, min(ys) + (max(ys) - min(ys)) * j / LABEL_GRID)
            if not inside(candidate, ring) or any(inside(candidate, h) for h in holes):
                continue
            score = min([edge_distance(candidate, ring)] + [edge_distance(candidate, h) for h in holes])
            if score > best_score:
                best, best_score = candidate, score
    return best


def path(rings: Sequence[Sequence[Point]]) -> str:
    return "".join("M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in ring) + "Z" for ring in rings)


def main() -> None:
    oblasts = json.loads(fetch_bytes(OBLASTS_URL, 60))["features"]
    kyiv = json.loads(fetch_bytes(KYIV_URL, 60))["features"][0]
    features = [(f["properties"]["name:uk"], outer_rings(f["geometry"])) for f in oblasts]
    features.append((KYIV_CITY, outer_rings(kyiv["geometry"])))

    projected = [(name, [[mercator(lon, lat) for lon, lat in ring] for ring in rings]) for name, rings in features]
    all_points = [p for _, rings in projected for ring in rings for p in ring]
    min_x, max_x = min(p[0] for p in all_points), max(p[0] for p in all_points)
    min_y, max_y = min(p[1] for p in all_points), max(p[1] for p in all_points)
    scale = (WIDTH - 2 * PAD) / (max_x - min_x)
    height = (max_y - min_y) * scale + 2 * PAD
    to_view = lambda p: (PAD + (p[0] - min_x) * scale, PAD + (p[1] - min_y) * scale)

    view = {name: [simplify_ring([to_view(p) for p in ring], TOLERANCE) for ring in rings] for name, rings in projected}
    city_rings = view[KYIV_CITY]
    regions = []
    for name, rings in view.items():
        main_ring = max(rings, key=len)
        holes = city_rings if name == "Київська область" else ()
        lx, ly = label_point(main_ring, holes)
        regions.append({
            "name": name,
            "short": SHORT.get(name, name.replace(" область", "")),
            "kind": "permanent" if name in PERMANENT_REGIONS else "forecast",
            "d": path(rings),
            "label": [round(lx, 1), round(ly, 1)],
        })
    regions.sort(key=lambda r: r["name"] == KYIV_CITY)
    out = Path("site/data/map.json")
    out.write_text(json.dumps({"viewBox": [WIDTH, round(height, 1)], "regions": regions}, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size // 1024} KB, {len(regions)} regions)")


if __name__ == "__main__":
    main()

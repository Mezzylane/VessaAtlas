/**
 * One-time / occasional dev script: converts a raw Overpass API export of
 * Otaniemi campus building footprints into public/map/campus.svg, the
 * coordinate space that restrooms.x_coord/y_coord are stored in.
 *
 * Regenerate by re-fetching scripts/raw-overpass.json (Overpass QL, see
 * README) and re-running: npx tsx scripts/geojson-to-svg.ts
 */
import fs from "node:fs";
import path from "node:path";

import { geoMercator, geoPath } from "d3-geo";
import osmtogeojson from "osmtogeojson";

const RAW_PATH = path.join(process.cwd(), "scripts/raw-overpass.json");
const OUT_SVG_PATH = path.join(process.cwd(), "public/map/campus.svg");
const OUT_META_PATH = path.join(process.cwd(), "scripts/campus-buildings.json");

const WIDTH = 1600;
const HEIGHT = 1300;

// Crop a bit more off the east and north after fitting — trimmed by visible
// grid cells (each cell is GRID_UNIT svg units), not by re-picking a bbox.
const GRID_UNIT = 20;
const CROP_EAST_COLUMNS = 8;
const CROP_NORTH_ROWS = 1;
const OUT_WIDTH = WIDTH - CROP_EAST_COLUMNS * GRID_UNIT;
const OUT_HEIGHT = HEIGHT - CROP_NORTH_ROWS * GRID_UNIT;

// Bounding box used for the Overpass query — the permanent coordinate space.
// North trimmed to 60.1925 (excludes the single isolated "Luontolava"
// building, cuts empty space beyond the main cluster). West back to the
// original 24.81 (the west edge was fine all along). East trimmed to 24.843
// (excludes a single isolated unnamed building at 24.8446-24.8459 that
// otherwise straddles the edge and renders as a weird cut-off sliver).
const BBOX = { south: 60.178, west: 24.81, north: 60.1925, east: 24.843 };

const KNOWN_BUILDINGS: Record<string, { label: string; match: (name: string) => boolean }> = {
  vare: { label: "Väre", match: (n) => /v[äa]re/i.test(n) },
  learningCentre: { label: "Harald Herlin Learning Centre", match: (n) => /oppimiskeskus/i.test(n) },
  kandidaattikeskus: { label: "Kandidaattikeskus", match: (n) => /kandidaattikeskus/i.test(n) },
  csBuilding: { label: "Tietotekniikan talo", match: (n) => /tietotekniikka/i.test(n) },
  dipoli: { label: "Dipoli", match: (n) => n === "Dipoli" },
  aBloc: { label: "A Bloc", match: (n) => n === "A Bloc" },
  marsio: { label: "Marsio", match: (n) => n === "Marsio" },
  servinMokki: { label: "Servin mökki", match: (n) => /servin\s*m[öo]kki/i.test(n) },
};

type GeoFeature = {
  type: "Feature";
  // osmtogeojson flattens OSM tags directly onto `properties` (no nested `.tags`)
  properties: Record<string, unknown> & { name?: string };
  geometry: { type: string; coordinates: unknown };
};

/**
 * OSM way node order doesn't guarantee the ring winding d3-geo's spherical
 * math expects. A backwards ring gets interpreted as its complement — for a
 * small building, that's "everything except the building" (~4π steradians,
 * i.e. almost the whole sphere) — which silently produces garbage centroids
 * and bounds. Force a consistent winding on every ring before doing any
 * d3-geo spherical operation (fitSize, centroid, bounds, path).
 */
function ringArea(ring: number[][]): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}
function rewindRing(ring: number[][], wantClockwise: boolean): number[][] {
  const isClockwise = ringArea(ring) < 0;
  return isClockwise !== wantClockwise ? [...ring].reverse() : ring;
}
function rewindPolygonCoords(coords: number[][][]): number[][][] {
  // exterior ring (index 0) clockwise, holes counter-clockwise — this is the
  // orientation that empirically makes d3-geo compute the small, correct area
  return coords.map((ring, i) => rewindRing(ring, i === 0));
}
function rewindFeature(feature: GeoFeature): GeoFeature {
  const { geometry } = feature;
  if (geometry.type === "Polygon") {
    return { ...feature, geometry: { ...geometry, coordinates: rewindPolygonCoords(geometry.coordinates as number[][][]) } };
  }
  if (geometry.type === "MultiPolygon") {
    return {
      ...feature,
      geometry: { ...geometry, coordinates: (geometry.coordinates as number[][][][]).map(rewindPolygonCoords) },
    };
  }
  return feature;
}

const raw = JSON.parse(fs.readFileSync(RAW_PATH, "utf-8"));
const rawGeojson = osmtogeojson(raw) as { type: "FeatureCollection"; features: GeoFeature[] };
const geojson = { ...rawGeojson, features: rawGeojson.features.map(rewindFeature) };

// Anchor the projection to the full query bbox (not just the buildings'
// convex hull) so the SVG's margins are predictable and reproducible.
const bboxFeature: GeoFeature = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [BBOX.west, BBOX.south],
        [BBOX.east, BBOX.south],
        [BBOX.east, BBOX.north],
        [BBOX.west, BBOX.north],
        [BBOX.west, BBOX.south],
      ],
    ],
  },
};

// Fit against the bbox rectangle ALONE, not the full building collection —
// a single malformed/degenerate OSM geometry among 393 features can throw
// off d3's auto-computed bounds and collapse the whole map to a speck.
const projection = geoMercator().fitSize([WIDTH, HEIGHT], rewindFeature(bboxFeature) as never);
// Shift the projection's own origin north by the cropped rows, so every
// downstream coordinate (paths, centroids, bounds) comes out already
// expressed in the cropped OUT_WIDTH x OUT_HEIGHT space — cropping the east
// columns needs no shift, just a smaller output canvas (see OUT_WIDTH below).
const [tx, ty] = projection.translate();
projection.translate([tx, ty - CROP_NORTH_ROWS * GRID_UNIT]);
const pathGen = geoPath(projection);

// Rough on-screen width (px) of a label at BASE_FONT_SIZE — used to size
// each label relative to its own building. Tuned by eye, not measured
// precisely; this only gates a cosmetic reveal, not a layout that needs to
// be exact.
const LABEL_CHAR_WIDTH_PX = 7.6;
const LABEL_PADDING_PX = 10;
const BASE_FONT_SIZE = 11;
// Labels are plain children of the scaled map-stage (they grow with the map,
// same as the buildings), which means the ratio between a label's width and
// its building's width is CONSTANT at every zoom level — a label that's
// proportionally wider than its own building overflows onto neighbors at
// EVERY scale, not just "too far zoomed in". The fix is a fixed per-label
// font-size multiplier, computed once here, that caps the label at 90% of
// its building's own width forever. Buildings with short names relative to
// their footprint are unaffected (multiplier stays 1).
const MAX_WIDTH_RATIO = 0.9;
function estimateLabelWidthPx(label: string, fontSize: number): number {
  return (label.length * LABEL_CHAR_WIDTH_PX + LABEL_PADDING_PX) * (fontSize / BASE_FONT_SIZE);
}

const buildingPaths: string[] = [];
const meta: { key: string; label: string; x: number; y: number; revealScale: number; fontSize: number }[] = [];
const seenKeys = new Set<string>();

for (const feature of geojson.features) {
  if (feature.geometry.type !== "Polygon" && feature.geometry.type !== "MultiPolygon") continue;

  const name = feature.properties?.name ?? "";
  const d = pathGen(feature as never);
  if (!d) continue;

  const knownEntry = Object.entries(KNOWN_BUILDINGS).find(([, def]) => def.match(name));
  const idAttr = knownEntry ? ` id="building-${knownEntry[0]}" data-building="${knownEntry[1].label}"` : "";
  const cls = knownEntry ? "building building--named" : "building";
  buildingPaths.push(`<path${idAttr} class="${cls}" d="${d}" />`);

  if (knownEntry && !seenKeys.has(knownEntry[0])) {
    seenKeys.add(knownEntry[0]);
    const [key, def] = knownEntry;
    const centroid = pathGen.centroid(feature as never);
    const bounds = pathGen.bounds(feature as never);
    const widthUnits = Math.max(1, bounds[1][0] - bounds[0][0]);
    const rawRatio = estimateLabelWidthPx(def.label, BASE_FONT_SIZE) / widthUnits;
    const sizeMultiplier = Math.min(1, MAX_WIDTH_RATIO / rawRatio);
    const fontSize = Math.round(BASE_FONT_SIZE * sizeMultiplier * 10) / 10;
    const revealScale = estimateLabelWidthPx(def.label, fontSize) / widthUnits;
    meta.push({ key, label: def.label, x: Math.round(centroid[0]), y: Math.round(centroid[1]), revealScale, fontSize });
  }
}

const svg = `<svg viewBox="0 0 ${OUT_WIDTH} ${OUT_HEIGHT}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Aalto Otaniemi campus map">
  <defs>
    <pattern id="campus-grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M20 0H0V20" fill="none" stroke="var(--line-faint)" stroke-width="1" />
    </pattern>
  </defs>
  <rect x="0" y="0" width="${OUT_WIDTH}" height="${OUT_HEIGHT}" fill="var(--surface)" />
  <rect x="0" y="0" width="${OUT_WIDTH}" height="${OUT_HEIGHT}" fill="url(#campus-grid)" />
  <g fill="var(--line-faint)" stroke="var(--line)" stroke-width="1.2">
    ${buildingPaths.join("\n    ")}
  </g>
</svg>
`;

fs.mkdirSync(path.dirname(OUT_SVG_PATH), { recursive: true });
fs.writeFileSync(OUT_SVG_PATH, svg);
fs.writeFileSync(
  OUT_META_PATH,
  JSON.stringify({ width: OUT_WIDTH, height: OUT_HEIGHT, bbox: BBOX, buildings: meta }, null, 2),
);

console.log(`Wrote ${OUT_SVG_PATH} (${buildingPaths.length} building footprints)`);
console.log(
  "Known buildings located:",
  meta.map((m) => `${m.label} @ (${m.x}, ${m.y}), revealScale=${m.revealScale.toFixed(2)}, fontSize=${m.fontSize}`),
);

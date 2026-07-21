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

import { geoPath } from "d3-geo";
import osmtogeojson from "osmtogeojson";

import { BBOX, type GeoFeature, makeProjection, OUT_HEIGHT, OUT_WIDTH, rewindFeature } from "./osmGeo";

const RAW_PATH = path.join(process.cwd(), "scripts/raw-overpass.json");
const OUT_SVG_PATH = path.join(process.cwd(), "public/map/campus.svg");
const OUT_META_PATH = path.join(process.cwd(), "scripts/campus-buildings.json");

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

const raw = JSON.parse(fs.readFileSync(RAW_PATH, "utf-8"));
const rawGeojson = osmtogeojson(raw) as { type: "FeatureCollection"; features: GeoFeature[] };
const geojson = { ...rawGeojson, features: rawGeojson.features.map(rewindFeature) };

// Fit against the bbox rectangle ALONE, not the full building collection —
// a single malformed/degenerate OSM geometry among 393 features can throw
// off d3's auto-computed bounds and collapse the whole map to a speck.
const projection = makeProjection();
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

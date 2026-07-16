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

// Bounding box used for the Overpass query — the permanent coordinate space.
const BBOX = { south: 60.178, west: 24.81, north: 60.196, east: 24.845 };

const KNOWN_BUILDINGS: Record<string, { label: string; match: (name: string) => boolean }> = {
  vare: { label: "Väre", match: (n) => /v[äa]re/i.test(n) },
  learningCentre: { label: "Harald Herlin Learning Centre", match: (n) => /oppimiskeskus/i.test(n) },
  kandidaattikeskus: { label: "Kandidaattikeskus", match: (n) => /kandidaattikeskus/i.test(n) },
  csBuilding: { label: "Tietotekniikan talo", match: (n) => /tietotekniikka/i.test(n) },
  dipoli: { label: "Dipoli", match: (n) => n === "Dipoli" },
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
const pathGen = geoPath(projection);

const buildingPaths: string[] = [];
const labels: string[] = [];
const meta: { key: string; label: string; x: number; y: number }[] = [];
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
    labels.push(
      `<text x="${centroid[0].toFixed(1)}" y="${centroid[1].toFixed(1)}" class="building-label" text-anchor="middle">${def.label.toUpperCase()}</text>`,
    );
    meta.push({ key, label: def.label, x: Math.round(centroid[0]), y: Math.round(centroid[1]) });
  }
}

const svg = `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Aalto Otaniemi campus map">
  <defs>
    <pattern id="campus-grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M20 0H0V20" fill="none" stroke="var(--line-faint)" stroke-width="1" />
    </pattern>
  </defs>
  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="var(--surface)" />
  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="url(#campus-grid)" />
  <g fill="var(--line-faint)" stroke="var(--line)" stroke-width="1.2">
    ${buildingPaths.join("\n    ")}
  </g>
  <g font-family="ui-sans-serif, system-ui, sans-serif" font-weight="800" font-size="13" letter-spacing="0.5" fill="var(--ink)">
    ${labels.join("\n    ")}
  </g>
</svg>
`;

fs.mkdirSync(path.dirname(OUT_SVG_PATH), { recursive: true });
fs.writeFileSync(OUT_SVG_PATH, svg);
fs.writeFileSync(
  OUT_META_PATH,
  JSON.stringify({ width: WIDTH, height: HEIGHT, bbox: BBOX, buildings: meta }, null, 2),
);

console.log(`Wrote ${OUT_SVG_PATH} (${buildingPaths.length} building footprints)`);
console.log("Known buildings located:", meta.map((m) => `${m.label} @ (${m.x}, ${m.y})`));

/**
 * Imports real public-toilet locations from OpenStreetMap into the
 * restrooms table — no ratings/reviews attached (those only ever come from
 * real visitors). Building name is resolved by point-in-polygon matching
 * against scripts/raw-overpass.json (the same building data campus.svg is
 * generated from). Floor defaults to ground (0) when OSM has no `level`
 * tag; gender defaults to "unisex" when OSM has no male/female/unisex tag —
 * both are logged as defaulted so they're easy to find and correct later
 * via the admin edit UI.
 *
 * Dry run (just prints what would happen):
 *   npx tsx --env-file=.env.local scripts/import-osm-toilets.ts
 * Actually write to the database:
 *   npx tsx --env-file=.env.local scripts/import-osm-toilets.ts --commit
 */
import fs from "node:fs";
import path from "node:path";

import { geoContains } from "d3-geo";
import osmtogeojson from "osmtogeojson";

import { db } from "../lib/db/client";
import { restrooms } from "../lib/db/schema";
import { floorLabelFromNumber } from "../lib/floors";
import type { Gender } from "../lib/types";
import { type GeoFeature, makeProjection, OUT_HEIGHT, OUT_WIDTH, rewindFeature } from "./osmGeo";

const BUILDINGS_PATH = path.join(process.cwd(), "scripts/raw-overpass.json");
const TOILETS_PATH = path.join(process.cwd(), "scripts/raw-overpass-toilets.json");
const COMMIT = process.argv.includes("--commit");

type OsmNode = { type: "node"; id: number; lat: number; lon: number; tags?: Record<string, string> };

const buildingsRaw = JSON.parse(fs.readFileSync(BUILDINGS_PATH, "utf-8"));
const buildingsGeojson = osmtogeojson(buildingsRaw) as { type: "FeatureCollection"; features: GeoFeature[] };
const buildings = buildingsGeojson.features
  .filter((f) => (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") && f.properties?.name)
  .map(rewindFeature);

const toiletsRaw = JSON.parse(fs.readFileSync(TOILETS_PATH, "utf-8")) as { elements: OsmNode[] };
const projection = makeProjection();

// Same friendly names used for the map's building labels (see
// scripts/geojson-to-svg.ts's KNOWN_BUILDINGS) — kept consistent so a
// restroom's building field always matches what's printed on the map.
const FRIENDLY_NAMES: [RegExp, string][] = [
  [/v[äa]re/i, "Väre"],
  [/oppimiskeskus/i, "Harald Herlin Learning Centre"],
  [/kandidaattikeskus/i, "Kandidaattikeskus"],
  [/tietotekniikka/i, "Tietotekniikan talo"],
  [/^dipoli$/i, "Dipoli"],
  [/^a bloc$/i, "A Bloc"],
  [/^marsio$/i, "Marsio"],
  [/servin\s*m[öo]kki/i, "Servin mökki"],
  [/metroasema/i, "Otaniemi metro station"],
];

function friendlyBuildingName(rawName: string): string {
  for (const [pattern, friendly] of FRIENDLY_NAMES) {
    if (pattern.test(rawName)) return friendly;
  }
  // Not one of our curated buildings — just drop the generic "Aalto(-yliopisto(n))"
  // prefix so it reads like a place name instead of an OSM record.
  return rawName.replace(/^Aalto-yliopiston\s+/i, "").replace(/^Aalto-yliopisto\s+/i, "").replace(/^Aalto\s+/i, "");
}

function findBuildingName(lon: number, lat: number): string | undefined {
  const point: [number, number] = [lon, lat];
  const match = buildings.find((b) => geoContains(b as never, point));
  const rawName = match?.properties?.name;
  return rawName ? friendlyBuildingName(rawName) : undefined;
}

type PlannedRow = {
  building: string;
  floorNumber: number;
  floorLabel: string;
  wing: string | null;
  gender: Gender;
  xCoord: number;
  yCoord: number;
  flags: string[];
};

const planned: PlannedRow[] = [];
let skippedPrivate = 0;
let skippedNoBuildingMatch = 0;
let skippedOutOfBounds = 0;

for (const node of toiletsRaw.elements) {
  const tags = node.tags ?? {};
  if (tags.access === "private") {
    skippedPrivate++;
    continue;
  }

  const projected = projection([node.lon, node.lat]);
  if (!projected) {
    skippedOutOfBounds++;
    continue;
  }
  const xCoord = Math.round(projected[0]);
  const yCoord = Math.round(projected[1]);
  if (xCoord < 0 || xCoord > OUT_WIDTH || yCoord < 0 || yCoord > OUT_HEIGHT) {
    skippedOutOfBounds++;
    continue;
  }

  const buildingName = findBuildingName(node.lon, node.lat);
  if (!buildingName) {
    skippedNoBuildingMatch++;
    continue;
  }

  const flags: string[] = [];
  let floorNumber = 0;
  if (tags.level !== undefined) {
    const parsed = Number.parseInt(tags.level, 10);
    if (!Number.isNaN(parsed)) floorNumber = parsed;
    else flags.push("unparseable level tag, defaulted to ground");
  } else {
    flags.push("no level tag, defaulted to ground");
  }

  const hasMale = tags.male === "yes";
  const hasFemale = tags.female === "yes";
  const hasUnisex = tags.unisex === "yes";
  const genders: Gender[] = [];
  if (hasUnisex || (!hasMale && !hasFemale)) {
    genders.push("unisex");
    if (!hasUnisex) flags.push("no gender tag, defaulted to unisex");
  } else {
    if (hasMale) genders.push("men");
    if (hasFemale) genders.push("women");
  }

  for (const gender of genders) {
    planned.push({
      building: buildingName,
      floorNumber,
      floorLabel: floorLabelFromNumber(floorNumber),
      wing: null,
      gender,
      xCoord,
      yCoord,
      flags,
    });
  }
}

console.log(`Planned imports: ${planned.length}`);
console.log(`Skipped (access=private): ${skippedPrivate}`);
console.log(`Skipped (outside current map bounds): ${skippedOutOfBounds}`);
console.log(`Skipped (no containing building found): ${skippedNoBuildingMatch}`);
console.log("");
for (const row of planned) {
  const flagText = row.flags.length ? `  [${row.flags.join("; ")}]` : "";
  console.log(`  ${row.building} — ${row.floorLabel} — ${row.gender} @ (${row.xCoord}, ${row.yCoord})${flagText}`);
}

if (!COMMIT) {
  console.log("\nDry run only — nothing written. Re-run with --commit to insert these rows.");
  process.exit(0);
}

async function main() {
  const inserted = await db
    .insert(restrooms)
    .values(planned.map(({ flags: _flags, ...row }) => row))
    .returning({ id: restrooms.id });
  console.log(`\nInserted ${inserted.length} restrooms.`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});

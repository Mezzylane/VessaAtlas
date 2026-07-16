import fs from "node:fs";
import path from "node:path";

import type { BuildingLabel } from "./types";

/** Server-only: reads the generated map SVG + building metadata (see scripts/geojson-to-svg.ts). */
export function loadCampusMapData() {
  const svg = fs.readFileSync(path.join(process.cwd(), "public/map/campus.svg"), "utf-8");
  const meta = JSON.parse(fs.readFileSync(path.join(process.cwd(), "scripts/campus-buildings.json"), "utf-8")) as {
    width: number;
    height: number;
    buildings: BuildingLabel[];
  };
  return { svg, width: meta.width, height: meta.height, buildingLabels: meta.buildings };
}

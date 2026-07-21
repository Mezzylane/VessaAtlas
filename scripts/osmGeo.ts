/**
 * Shared OSM/geo utilities + the campus map's permanent coordinate-space
 * config. Used by both geojson-to-svg.ts (renders the map) and
 * import-osm-toilets.ts (imports real toilet locations into the same
 * coordinate space) — kept in one place so the two can never drift apart.
 */
import { geoMercator } from "d3-geo";

export const WIDTH = 1600;
export const HEIGHT = 1300;

// Crop a bit more off the east and north after fitting — trimmed by visible
// grid cells (each cell is GRID_UNIT svg units), not by re-picking a bbox.
export const GRID_UNIT = 20;
export const CROP_EAST_COLUMNS = 8;
export const CROP_NORTH_ROWS = 1;
export const OUT_WIDTH = WIDTH - CROP_EAST_COLUMNS * GRID_UNIT;
export const OUT_HEIGHT = HEIGHT - CROP_NORTH_ROWS * GRID_UNIT;

// Bounding box used for the Overpass query — the permanent coordinate space.
// North trimmed to 60.1925 (excludes the single isolated "Luontolava"
// building, cuts empty space beyond the main cluster). West is the original
// 24.81 (that edge was fine all along). East trimmed to 24.843 (excludes a
// single isolated unnamed building at 24.8446-24.8459 that otherwise
// straddles the edge and renders as a weird cut-off sliver).
export const BBOX = { south: 60.178, west: 24.81, north: 60.1925, east: 24.843 };

export type GeoFeature = {
  type: "Feature";
  // osmtogeojson flattens OSM tags directly onto `properties` (no nested `.tags`)
  properties: Record<string, unknown> & { name?: string };
  geometry: { type: string; coordinates: unknown };
};

/**
 * OSM way node order doesn't guarantee the ring winding d3-geo's spherical
 * math expects. A backwards ring gets interpreted as its complement — for a
 * small building, that's "everything except the building" (~4π steradians,
 * i.e. almost the whole sphere) — which silently produces garbage centroids,
 * bounds, and geoContains results. Force a consistent winding on every ring
 * before doing any d3-geo spherical operation.
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
export function rewindFeature(feature: GeoFeature): GeoFeature {
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

/** The bbox rectangle used to anchor the projection — same for every script. */
export function makeBboxFeature(): GeoFeature {
  return {
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
}

/** The one true projection: fit to BBOX at WIDTH x HEIGHT, then shift for the north crop. */
export function makeProjection() {
  const projection = geoMercator().fitSize([WIDTH, HEIGHT], rewindFeature(makeBboxFeature()) as never);
  const [tx, ty] = projection.translate();
  projection.translate([tx, ty - CROP_NORTH_ROWS * GRID_UNIT]);
  return projection;
}

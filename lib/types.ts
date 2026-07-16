export type Gender = "men" | "women";

export type ReviewData = {
  id: string;
  rating: number;
  comment: string | null;
  likeCount: number;
  createdAt: string;
};

export type RestroomPin = {
  id: string;
  building: string;
  floorLabel: string;
  wing: string | null;
  gender: Gender;
  x: number;
  y: number;
};

export type RestroomDetail = RestroomPin & {
  avgRating: number;
  ratingCount: number;
  /** length 10, index 0 = count of rating "1", index 9 = count of rating "10" */
  histogram: number[];
  reviews: ReviewData[];
};

export type BuildingLabel = {
  key: string;
  label: string;
  x: number;
  y: number;
  /** Map zoom scale at which this label becomes visible (see scripts/geojson-to-svg.ts) */
  revealScale: number;
  /** Base font size in px — capped per-building so the label, which grows with the map, never exceeds ~90% of its own building's width. */
  fontSize: number;
};

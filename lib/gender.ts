import type { Gender } from "./types";

export function genderLabel(gender: Gender): string {
  switch (gender) {
    case "men":
      return "Men's WC";
    case "women":
      return "Women's WC";
    case "unisex":
      // Displayed as "General WC" — the DB value stays "unisex" for most of
      // these imported from OSM data with no gender split recorded, "General"
      // is the honest label: gender unspecified/unknown, not necessarily a
      // genuinely single shared room.
      return "General WC";
  }
}

export function genderColorVar(gender: Gender): string {
  switch (gender) {
    case "men":
      return "var(--pin-men)";
    case "women":
      return "var(--pin-women)";
    case "unisex":
      return "var(--pin-unisex)";
  }
}

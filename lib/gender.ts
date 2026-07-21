import type { Gender } from "./types";

export function genderLabel(gender: Gender): string {
  switch (gender) {
    case "men":
      return "Men's WC";
    case "women":
      return "Women's WC";
    case "unisex":
      return "Unisex WC";
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

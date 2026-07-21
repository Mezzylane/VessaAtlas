/** English ordinal suffix: 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 11 -> "11th", etc. */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * Derives the display label from the floor number so admins only ever enter
 * one value. 0 is ground level; negative numbers are basement levels below it.
 */
export function floorLabelFromNumber(floorNumber: number): string {
  if (floorNumber === 0) return "Ground floor";
  if (floorNumber > 0) return `${ordinal(floorNumber)} floor`;
  const depth = Math.abs(floorNumber);
  return depth === 1 ? "Basement" : `${ordinal(depth)} basement floor`;
}

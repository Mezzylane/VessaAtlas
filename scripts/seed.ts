// DATABASE_URL is loaded via `tsx --env-file=.env.local` (see package.json's
// `seed` script) — a plain top-level `dotenv.config()` call here would run
// too late, since ESM import statements (including this file's own `db`
// import below) are hoisted and execute before any of this file's own code.
import { db } from "../lib/db/client";
import { restrooms, reviews } from "../lib/db/schema";

// Coordinates are small offsets from each building's centroid in
// scripts/campus-buildings.json — keep in sync if the bbox/projection in
// scripts/geojson-to-svg.ts ever changes (regenerate + reseed together).
const SEED_RESTROOMS = [
  { building: "Dipoli", floorNumber: 0, floorLabel: "Ground floor", wing: "Foyer", gender: "men" as const, xCoord: 1065, yCoord: 634 },
  { building: "Väre", floorNumber: 1, floorLabel: "1st floor", wing: "Atrium", gender: "men" as const, xCoord: 722, yCoord: 593 },
  { building: "Väre", floorNumber: 1, floorLabel: "1st floor", wing: "Atrium", gender: "women" as const, xCoord: 738, yCoord: 593 },
  { building: "Harald Herlin Learning Centre", floorNumber: 0, floorLabel: "Ground floor", wing: "Spiral core", gender: "men" as const, xCoord: 857, yCoord: 671 },
  { building: "Kandidaattikeskus", floorNumber: 1, floorLabel: "1st floor", wing: "Lecture wing", gender: "men" as const, xCoord: 888, yCoord: 524 },
  { building: "Kandidaattikeskus", floorNumber: 2, floorLabel: "2nd floor", wing: "Lecture wing", gender: "women" as const, xCoord: 888, yCoord: 524 },
  { building: "Tietotekniikan talo", floorNumber: 3, floorLabel: "3rd floor", wing: "North corridor", gender: "women" as const, xCoord: 572, yCoord: 471 },
];

const SEED_REVIEWS: Record<number, { rating: number; comment: string | null; likeCount: number }[]> = {
  0: [
    { rating: 10, comment: "Renovated last year and it shows. Genuinely the nicest WC on campus.", likeCount: 19 },
    { rating: 9, comment: "Quiet, never a line, good water pressure.", likeCount: 11 },
    { rating: 8, comment: "A bit far to walk to from the CS building but worth it.", likeCount: 4 },
  ],
  1: [
    { rating: 7, comment: "Fine most of the time, chaos during Design Factory events.", likeCount: 8 },
    { rating: 5, comment: "One sink never drains properly.", likeCount: 6 },
  ],
  2: [
    { rating: 9, comment: "Always stocked, mirrors are huge, no notes.", likeCount: 15 },
    { rating: 6, comment: "Hand dryer sounds like a jet engine taking off.", likeCount: 13 },
  ],
  3: [
    { rating: 9, comment: "Best acoustics for pretending you are not this stressed about exams.", likeCount: 22 },
    { rating: 7, comment: "Busy between 12 and 13, otherwise perfect.", likeCount: 5 },
  ],
  4: [
    { rating: 4, comment: "Always a queue right after Elements of AI lectures let out.", likeCount: 17 },
    { rating: 6, comment: "Door lock is a personality test, good luck.", likeCount: 12 },
  ],
  5: [
    { rating: 9, comment: "One floor up from the chaos and somehow always empty.", likeCount: 14 },
    { rating: 9, comment: "Toilet paper never runs out, mysteriously.", likeCount: 9 },
  ],
  6: [
    { rating: 8, comment: "Never busy, most CS students do not know it exists.", likeCount: 7 },
    { rating: 6, comment: "A bit of a walk from the elevator.", likeCount: 3 },
  ],
};

async function main() {
  console.log("Seeding restrooms + reviews...");
  for (let i = 0; i < SEED_RESTROOMS.length; i++) {
    const [inserted] = await db.insert(restrooms).values(SEED_RESTROOMS[i]).returning({ id: restrooms.id });
    const reviewSet = SEED_REVIEWS[i] ?? [];
    if (reviewSet.length > 0) {
      await db.insert(reviews).values(reviewSet.map((r) => ({ ...r, restroomId: inserted.id })));
    }
    console.log(`  ${SEED_RESTROOMS[i].building} (${SEED_RESTROOMS[i].floorLabel}, ${SEED_RESTROOMS[i].gender}) -> ${inserted.id}`);
  }
  console.log("Done.");
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});

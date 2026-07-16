import { NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { restrooms } from "@/lib/db/schema";

export async function GET() {
  const rows = await db
    .select({
      id: restrooms.id,
      building: restrooms.building,
      floorLabel: restrooms.floorLabel,
      wing: restrooms.wing,
      gender: restrooms.gender,
      x: restrooms.xCoord,
      y: restrooms.yCoord,
    })
    .from(restrooms);

  return NextResponse.json(rows);
}

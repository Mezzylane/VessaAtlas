import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { restrooms } from "@/lib/db/schema";
import { floorLabelFromNumber } from "@/lib/floors";
import { createRestroomSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createRestroomSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const [created] = await db
    .insert(restrooms)
    .values({ ...parsed.data, floorLabel: floorLabelFromNumber(parsed.data.floorNumber) })
    .returning();
  return NextResponse.json(created, { status: 201 });
}

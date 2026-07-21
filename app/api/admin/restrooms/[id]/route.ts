import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { restrooms } from "@/lib/db/schema";
import { floorLabelFromNumber } from "@/lib/floors";
import { updateRestroomSchema } from "@/lib/validation";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateRestroomSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const [updated] = await db
    .update(restrooms)
    .set({ ...parsed.data, floorLabel: floorLabelFromNumber(parsed.data.floorNumber) })
    .where(eq(restrooms.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [deleted] = await db.delete(restrooms).where(eq(restrooms.id, id)).returning({ id: restrooms.id });
  if (!deleted) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

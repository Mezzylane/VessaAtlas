import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { restrooms, reviews } from "@/lib/db/schema";
import { isHoneypotFilled } from "@/lib/honeypot";
import { checkSubmissionAllowed, getClientIp, hashIp, recordHit } from "@/lib/rate-limit";
import { submitRatingSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: restroomId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = submitRatingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  // Honeypot: pretend success, do nothing. Never a distinguishable rejection.
  if (isHoneypotFilled(parsed.data.website)) {
    return NextResponse.json({ ok: true });
  }

  const [restroom] = await db.select({ id: restrooms.id }).from(restrooms).where(eq(restrooms.id, restroomId)).limit(1);
  if (!restroom) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const ipHash = hashIp(getClientIp(request));

  const rateLimitResult = await checkSubmissionAllowed(ipHash, restroomId);
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: rateLimitResult.reason }, { status: 429 });
  }

  const { rating, comment } = parsed.data;

  const [inserted] = await db
    .insert(reviews)
    .values({ restroomId, rating, comment: comment ?? null })
    .returning({ id: reviews.id, createdAt: reviews.createdAt });

  await recordHit(ipHash, "submission", restroomId);

  return NextResponse.json(
    { id: inserted.id, rating, comment: comment ?? null, likeCount: 0, createdAt: inserted.createdAt },
    { status: 201 },
  );
}

import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { reviews } from "@/lib/db/schema";
import { getClientIp, hasAlreadyLiked, hashIp, recordHit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: reviewId } = await params;

  const [review] = await db.select({ id: reviews.id, likeCount: reviews.likeCount }).from(reviews).where(eq(reviews.id, reviewId)).limit(1);
  if (!review) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const ipHash = hashIp(getClientIp(request));

  // Idempotent: a repeat like from the same visitor is a no-op success, not
  // an error — never surface friction for what's just an upvote.
  if (await hasAlreadyLiked(ipHash, reviewId)) {
    return NextResponse.json({ likeCount: review.likeCount });
  }

  const [updated] = await db
    .update(reviews)
    .set({ likeCount: sql`${reviews.likeCount} + 1` })
    .where(eq(reviews.id, reviewId))
    .returning({ likeCount: reviews.likeCount });

  await recordHit(ipHash, "like", reviewId);

  return NextResponse.json({ likeCount: updated.likeCount });
}

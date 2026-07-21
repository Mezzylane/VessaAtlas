import { and, avg, count, desc, eq, isNotNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { restrooms, reviews } from "@/lib/db/schema";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [restroom] = await db.select().from(restrooms).where(eq(restrooms.id, id)).limit(1);
  if (!restroom) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [stats] = await db
    .select({ avgRating: avg(reviews.rating), ratingCount: count() })
    .from(reviews)
    .where(eq(reviews.restroomId, id));

  const histRows = await db
    .select({ rating: reviews.rating, n: count() })
    .from(reviews)
    .where(eq(reviews.restroomId, id))
    .groupBy(reviews.rating);

  const histogram = Array.from({ length: 10 }, () => 0);
  for (const row of histRows) {
    histogram[row.rating - 1] = row.n;
  }

  // Only rows with a written comment show up in the review list — a
  // rating-only submission still counts toward avg/count/histogram above.
  const reviewRows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      likeCount: reviews.likeCount,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .where(and(eq(reviews.restroomId, id), isNotNull(reviews.comment)))
    .orderBy(desc(reviews.likeCount), desc(reviews.createdAt));

  return NextResponse.json({
    id: restroom.id,
    building: restroom.building,
    floorNumber: restroom.floorNumber,
    floorLabel: restroom.floorLabel,
    wing: restroom.wing,
    gender: restroom.gender,
    x: restroom.xCoord,
    y: restroom.yCoord,
    avgRating: stats.avgRating ? Number(stats.avgRating) : 0,
    ratingCount: stats.ratingCount,
    histogram,
    reviews: reviewRows,
  });
}

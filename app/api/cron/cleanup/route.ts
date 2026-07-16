import { NextRequest, NextResponse } from "next/server";

import { purgeOldHits } from "@/lib/rate-limit";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await purgeOldHits();
  return NextResponse.json({ ok: true });
}

export const POST = GET;

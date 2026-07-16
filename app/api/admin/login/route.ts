import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE_SECONDS, createAdminSession } from "@/lib/auth";
import { ADMIN_LOGIN_TARGET, checkAdminLoginAllowed, getClientIp, hashIp, recordHit } from "@/lib/rate-limit";
import { adminLoginSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const ipHash = hashIp(getClientIp(request));
  if (!(await checkAdminLoginAllowed(ipHash))) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }

  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!passwordHash) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const valid = await bcrypt.compare(parsed.data.password, passwordHash);
  // Record the attempt regardless of outcome — this is what makes the
  // hourly cap actually blunt brute-forcing rather than only counting failures.
  await recordHit(ipHash, "admin_login", ADMIN_LOGIN_TARGET);

  if (!valid) {
    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }

  const token = await createAdminSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return res;
}

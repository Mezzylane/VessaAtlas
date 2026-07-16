import { NextRequest, NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const valid = token ? await verifyAdminSession(token) : false;

  if (!valid) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/admin", request.url));
  }
  return NextResponse.next();
}

// Allowlist only what actually needs a session — /api/admin/login and
// /api/admin/logout are deliberately not matched here, so they stay reachable
// without a cookie.
export const config = {
  matcher: ["/admin/dashboard/:path*", "/api/admin/restrooms/:path*"],
};

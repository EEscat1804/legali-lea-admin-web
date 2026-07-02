import { NextRequest, NextResponse } from "next/server";

// Server-side route guard (PRD §4.3): if there's no admin session cookie, bounce
// to /login before any admin page renders. Cookie validity is checked by the API
// (/auth/me) — middleware only gates on presence to keep it edge-safe (no store).
const SESSION_COOKIE = "admin_session";

export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Run on everything except login, API routes, static assets, and brand images.
export const config = {
  matcher: ["/((?!login|api|_next/static|_next/image|lea|favicon.ico).*)"],
};

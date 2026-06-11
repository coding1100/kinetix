import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session-cookie";

const PROTECTED_PREFIXES = [
  "/home",
  "/chat",
  "/spaces",
  "/people",
  "/settings",
  "/profile",
  "/workspace/create",
  "/workspace/settings",
  "/onboarding",
];

const AUTH_PREFIXES = [
  "/auth/login",
  "/auth/signup",
  "/auth/forgot-password",
  "/auth/oauth/callback",
];

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isAuthRoute(pathname: string) {
  return AUTH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.get(SESSION_COOKIE)?.value === "1";

  if (isProtected(pathname) && !hasSession) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute(pathname) && hasSession) {
    return NextResponse.redirect(new URL("/home/inbox", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/home",
    "/home/:path*",
    "/chat/:path*",
    "/spaces/:path*",
    "/people/:path*",
    "/settings/:path*",
    "/profile/:path*",
    "/workspace/create/:path*",
    "/workspace/settings",
    "/onboarding/:path*",
    "/auth/login",
    "/auth/signup",
    "/auth/forgot-password",
    "/auth/oauth/callback",
  ],
};

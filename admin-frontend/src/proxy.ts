import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session-cookie";

const PROTECTED_PREFIXES = ["/workspaces", "/users", "/staff"];
const AUTH_PREFIXES = ["/login"];

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.get(SESSION_COOKIE)?.value === "1";

  if (matches(pathname, PROTECTED_PREFIXES) && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (matches(pathname, AUTH_PREFIXES) && hasSession) {
    return NextResponse.redirect(new URL("/workspaces", request.url));
  }

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(hasSession ? "/workspaces" : "/login", request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/workspaces/:path*", "/users/:path*", "/staff/:path*", "/login"],
};

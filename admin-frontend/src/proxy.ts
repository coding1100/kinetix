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

  // request.nextUrl.clone() (not `new URL(path, request.url)`) - the latter
  // is a plain WHATWG URL and loses Next's basePath awareness, which drops
  // the /admin-portal prefix from the Location header and sends the
  // redirect straight into nginx's catch-all (the main app) instead of
  // back into this app.
  if (matches(pathname, PROTECTED_PREFIXES) && !hasSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (matches(pathname, AUTH_PREFIXES) && hasSession) {
    const workspacesUrl = request.nextUrl.clone();
    workspacesUrl.pathname = "/workspaces";
    workspacesUrl.search = "";
    return NextResponse.redirect(workspacesUrl);
  }

  if (pathname === "/") {
    const target = request.nextUrl.clone();
    target.pathname = hasSession ? "/workspaces" : "/login";
    target.search = "";
    return NextResponse.redirect(target);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/workspaces/:path*", "/users/:path*", "/staff/:path*", "/login"],
};

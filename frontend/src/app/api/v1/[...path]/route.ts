import { NextRequest, NextResponse } from "next/server";

const API_PROXY_TARGET =
  process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4000";
const PROXY_TIMEOUT_MS = 120_000;

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
]);

async function proxyRequest(request: NextRequest, path: string[]) {
  const suffix = path.join("/");
  const target = `${API_PROXY_TARGET}/api/v1/${suffix}${request.nextUrl.search}`;
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    headers.set(key, value);
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  const hasBody = !["GET", "HEAD"].includes(request.method);

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      signal: controller.signal,
      // @ts-expect-error Node fetch requires duplex when streaming a body
      duplex: hasBody ? "half" : undefined,
      cache: "no-store",
    });

    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      if (HOP_BY_HOP.has(key.toLowerCase())) return;
      responseHeaders.set(key, value);
    });

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "PROXY_UNAVAILABLE",
          message: "API temporarily unavailable. Please retry.",
        },
      },
      { status: 503 }
    );
  } finally {
    clearTimeout(timer);
  }
}

type RouteContext = { params: Promise<{ path: string[] }> };

async function handler(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;

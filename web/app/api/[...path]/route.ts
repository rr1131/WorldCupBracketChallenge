import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const REQUEST_HEADER_ALLOWLIST = new Set([
  "accept",
  "authorization",
  "content-type",
  "cookie",
  "user-agent",
  "x-requested-with",
]);

function getApiUpstreamUrl() {
  const configured =
    process.env.API_UPSTREAM_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "";
  return configured.endsWith("/") ? configured.slice(0, -1) : configured;
}

function buildUpstreamUrl(path: string[]) {
  const upstream = getApiUpstreamUrl();
  if (!upstream) {
    throw new Error("API_UPSTREAM_URL is not configured.");
  }

  return `${upstream}/api/${path.join("/")}`;
}

async function proxyRequest(request: NextRequest, path: string[]) {
  const url = new URL(buildUpstreamUrl(path));

  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    url.searchParams.append(key, value);
  }

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const normalizedKey = key.toLowerCase();
    if (
      !HOP_BY_HOP_HEADERS.has(normalizedKey) &&
      REQUEST_HEADER_ALLOWLIST.has(normalizedKey)
    ) {
      headers.set(key, value);
    }
  });

  try {
    const response = await fetch(url, {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await request.text(),
      redirect: "manual",
      cache: "no-store",
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(15000),
    });

    const nextHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
        nextHeaders.append(key, value);
      }
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: nextHeaders,
    });
  } catch (error) {
    console.error("API proxy request failed", {
      method: request.method,
      path,
      upstream: url.toString(),
      error,
    });
    return Response.json(
      {
        detail: "The web app could not reach the backend service.",
      },
      { status: 502 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function OPTIONS(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

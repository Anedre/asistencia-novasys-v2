import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_PATHS = ["/login", "/register", "/register-company", "/forgot-password", "/error", "/api/auth"];

/**
 * Everything behind the login must never be cached by the CDN.
 *
 * The app shells are prerendered client pages, so Next stamps them with
 * `Cache-Control: s-maxage=31536000`. CloudFront (in front of Amplify) then
 * keeps the HTML for a year and serves it to the next visitor at that edge
 * WITHOUT calling this proxy — an anonymous user gets the admin panel shell,
 * every API answers 401, and "the link doesn't work". Next only applies its
 * s-maxage when no Cache-Control is set yet (send-payload), so setting it
 * here wins. Redirects get it too: a cached 307 would misroute everyone.
 */
function noStore<T extends NextResponse>(res: T): T {
  res.headers.set("Cache-Control", "private, no-cache, no-store, max-age=0, must-revalidate");
  return res;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── DEV PREVIEW MODE: skip auth ──
  if (process.env.NEXT_PUBLIC_DEV_PREVIEW === "true") {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Not authenticated
  if (!token) {
    // Para rutas de API: devolver 401 JSON (NO redirigir a /login,
    // porque el navegador convertiría POST → GET y obtendría 405).
    if (pathname.startsWith("/api/")) {
      return noStore(NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      ));
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return noStore(NextResponse.redirect(loginUrl));
  }

  const role = (token.role as string) || "EMPLOYEE";

  // Admin routes — require ADMIN or SUPER_ADMIN role
  if (pathname.startsWith("/admin")) {
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return noStore(NextResponse.redirect(new URL("/dashboard", request.url)));
    }
  }

  // Super-admin routes
  if (pathname.startsWith("/super-admin")) {
    if (role !== "SUPER_ADMIN") {
      return noStore(NextResponse.redirect(new URL("/dashboard", request.url)));
    }
  }

  // Root path — redirect by role
  if (pathname === "/") {
    if (role === "ADMIN" || role === "SUPER_ADMIN") {
      return noStore(NextResponse.redirect(new URL("/admin/dashboard", request.url)));
    }
    return noStore(NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  // Inject tenant info as headers for server components (optional optimization)
  const response = noStore(NextResponse.next());
  if (token.tenantId) {
    response.headers.set("x-tenant-id", token.tenantId as string);
    response.headers.set("x-tenant-slug", (token.tenantSlug as string) || "novasys");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

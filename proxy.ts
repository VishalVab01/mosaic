import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

const authSecret =
  process.env.NEXTAUTH_SECRET ?? (process.env.NODE_ENV === "production" ? undefined : "development-only-auth-secret");

const publicOnlyRoutes = new Set(["/", "/login", "/signup"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({ req: request, secret: authSecret });
  const isAuthenticated = Boolean(token);

  if (isAuthenticated && publicOnlyRoutes.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/generate";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!isAuthenticated && (pathname.startsWith("/generate") || pathname.startsWith("/workspace"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname.startsWith("/workspace") ? "/workspace" : "/generate");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/signup", "/generate/:path*", "/workspace/:path*"],
};

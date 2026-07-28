import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const hasSessionCookie = request.cookies.getAll().some((cookie) =>
    cookie.name === "authjs.session-token" ||
    cookie.name.startsWith("authjs.session-token.") ||
    cookie.name === "__Secure-authjs.session-token" ||
    cookie.name.startsWith("__Secure-authjs.session-token.")
  );
  if (!hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"]
};

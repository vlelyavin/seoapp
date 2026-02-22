import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { getToken } from "next-auth/jwt";

const intlMiddleware = createIntlMiddleware(routing);

const locales = routing.locales;

function stripLocale(pathname: string): string {
  for (const locale of locales) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`))
      return pathname.slice(locale.length + 1);
  }
  return pathname;
}

function getLocale(pathname: string): string {
  for (const locale of locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale;
    }
  }
  return routing.defaultLocale;
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const path = stripLocale(pathname);

  // Dashboard routes: require authentication
  if (path.startsWith("/dashboard")) {
    const token = await getToken({ req });
    if (!token) {
      const locale = getLocale(pathname);
      return NextResponse.redirect(new URL(`/${locale}/login`, req.url));
    }
  }

  // Auth pages: redirect authenticated users to dashboard
  if (path === "/login" || path === "/register") {
    const token = await getToken({ req });
    if (token) {
      const locale = getLocale(pathname);
      return NextResponse.redirect(new URL(`/${locale}/dashboard`, req.url));
    }
  }

  // All other routes (landing, pricing, indexing, etc.): pass through
  return intlMiddleware(req);
}

export const config = {
  matcher: [
    // Match all pathnames except for
    // - api routes
    // - _next (Next.js internals)
    // - static files (images, etc.)
    "/((?!api|_next|.*\\..*).*)",
  ],
};

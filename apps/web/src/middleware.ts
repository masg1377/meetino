import { NextResponse, type NextRequest } from 'next/server';

const REFRESH_COOKIE = 'meetino_refresh';

/**
 * Route protection at the edge (UX-only — real authorization is server-side).
 *
 * Rules:
 *  - /dashboard/*           → must have refresh cookie, else /login?next=...
 *  - /login or /register    → if already authed, bounce to ?next or /dashboard
 *  - /m/*                   → NOT touched here; pre-join and room must be reachable by guests
 */
export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const hasRefresh = req.cookies.has(REFRESH_COOKIE);

  // Block unauthenticated access to the dashboard.
  if (pathname.startsWith('/dashboard') && !hasRefresh) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // Redirect authed users away from the auth pages.
  if ((pathname === '/login' || pathname === '/register') && hasRefresh) {
    const url = req.nextUrl.clone();
    const next = searchParams.get('next');
    // Only allow same-origin relative paths to avoid open redirects.
    url.pathname = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register'],
};

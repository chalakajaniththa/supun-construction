import { type NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'sc_session';
const PUBLIC_PATHS = ['/login'];

/**
 * No session cookie → send the browser to /login (remembering where it wanted to go).
 * The cookie is only checked for presence here; the API validates it on every request,
 * and the web client redirects to /login on a 401.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  if (!request.cookies.get(SESSION_COOKIE)?.value) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    if (pathname !== '/' && pathname !== '/dashboard') {
      url.searchParams.set('next', `${pathname}${search}`);
    }
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except the API rewrite, Next.js internals and files with an extension.
  matcher: ['/((?!api/|_next/|favicon.ico|.*\\.[\\w]+$).*)'],
};

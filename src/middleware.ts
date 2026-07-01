import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Her sayfa yüklenmesinde bildirim kontrolünü arka planda tetikle
  // Sadece HTML sayfaları için (API çağrılarını hariç tut)
  const url = request.nextUrl;
  const isPageRequest = !url.pathname.startsWith('/api/') &&
                        !url.pathname.startsWith('/_next/') &&
                        !url.pathname.includes('.') && // static files
                        url.pathname !== '/sw.js' &&
                        url.pathname !== '/favicon.ico';

  if (isPageRequest) {
    // Arka planda bildirim kontrolünü tetikle (fire-and-forget)
    const notifyUrl = new URL('/api/push/notify', request.url);
    fetch(notifyUrl.toString(), {
      method: 'GET',
      headers: { 'X-Triggered-By': 'middleware' },
    }).catch(() => {
      // Hata olsa bile sayfa yüklenmesini etkileme
    });
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js).*)',
  ],
};

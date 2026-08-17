import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Kimlik doğrulaması gerektirmeyen herkese açık API yolları
const PUBLIC_API_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/session',
  '/api/telegram', // Webhook kendi secret token & chat_id doğrulamasını yapar
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Sadece /api/* yollarını denetle
  if (pathname.startsWith('/api/')) {
    const isPublic = PUBLIC_API_ROUTES.some(route => pathname.startsWith(route));
    if (isPublic) {
      return NextResponse.next();
    }

    // singularity_session cookie kontrolü
    const sessionToken = request.cookies.get('singularity_session')?.value;
    if (!sessionToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Yetkisiz erişim. Oturum tokeni bulunamadı. Lütfen giriş yapın.',
          code: 'UNAUTHORIZED'
        },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};

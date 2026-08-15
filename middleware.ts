
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;
  if (!user || !pass) return NextResponse.next();

  const auth = req.headers.get('authorization');
  if (auth) {
    const [u, p] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
    if (u === user && p === pass) return NextResponse.next();
  }
  return new NextResponse('Auth required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Secure"' } });
}

export const config = { matcher: '/:path*' };

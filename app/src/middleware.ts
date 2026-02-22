import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const PUBLIC_PATHS = ['/login', '/admin', '/teacher']
const PUBLIC_PREFIXES = ['/api/', '/_next/', '/favicon.ico']

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true
  return PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 公开路由不拦截
  if (isPublic(pathname)) {
    // 已登录访问 /login 时重定向到首页
    if (pathname === '/login') {
      const token = request.cookies.get('mathtalk_token')?.value
      if (token) {
        try {
          const secret = new TextEncoder().encode(
            process.env.JWT_SECRET!
          )
          await jwtVerify(token, secret)
          return NextResponse.redirect(new URL('/', request.url))
        } catch {
          // token 无效，继续显示登录页
        }
      }
    }
    return NextResponse.next()
  }

  // 非 API 路由需要验证
  const token = request.cookies.get('mathtalk_token')?.value
  if (!token) {
    const loginUrl = new URL('/login', request.url)
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET!
    )
    await jwtVerify(token, secret)
    return NextResponse.next()
  } catch {
    // JWT 无效，重定向到登录页
    const loginUrl = new URL('/login', request.url)
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname)
    }
    const response = NextResponse.redirect(loginUrl)
    response.cookies.delete('mathtalk_token')
    return response
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, images, etc.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

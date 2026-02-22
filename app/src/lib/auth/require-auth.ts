import { cookies } from 'next/headers'
import { verifyToken, type TokenPayload } from './jwt'

/**
 * 从 httpOnly cookie 中提取并验证当前用户身份。
 * 返回 null 表示未登录或 token 无效。
 */
export async function getAuthUser(): Promise<TokenPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('mathtalk_token')?.value
  if (!token) return null
  return verifyToken(token)
}

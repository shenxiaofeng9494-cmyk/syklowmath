import { NextResponse } from 'next/server'
import { getAuthCookie } from '@/lib/auth/cookies'
import { verifyToken } from '@/lib/auth/jwt'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET() {
  try {
    const token = await getAuthCookie()
    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    // 从数据库获取最新用户信息
    if (supabaseAdmin) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id, phone, nickname')
        .eq('id', payload.userId)
        .single()

      if (user) {
        return NextResponse.json({ user })
      }
    }

    // Supabase 不可用时，返回 token 中的信息
    return NextResponse.json({
      user: {
        id: payload.userId,
        phone: payload.phone,
        nickname: null,
      },
    })
  } catch (error) {
    console.error('[auth/me] Error:', error)
    return NextResponse.json({ user: null }, { status: 401 })
  }
}

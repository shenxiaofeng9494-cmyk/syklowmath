import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { signToken } from '@/lib/auth/jwt'
import { setAuthCookie } from '@/lib/auth/cookies'

const MAX_ATTEMPTS = 5

export async function POST(request: NextRequest) {
  try {
    const { phone, code } = await request.json()

    if (!phone || !code) {
      return NextResponse.json(
        { error: '请输入手机号和验证码' },
        { status: 400 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: '服务暂不可用' },
        { status: 503 }
      )
    }

    // 查找用户
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('phone', phone)
      .single()

    if (fetchError || !user) {
      return NextResponse.json(
        { error: '请先获取验证码' },
        { status: 400 }
      )
    }

    // 检查尝试次数
    if (user.otp_attempts >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: '验证码错误次数过多，请重新获取' },
        { status: 429 }
      )
    }

    // 检查过期
    if (!user.otp_expires_at || new Date() > new Date(user.otp_expires_at)) {
      return NextResponse.json(
        { error: '验证码已过期，请重新获取' },
        { status: 400 }
      )
    }

    // 验证码不匹配
    if (user.otp_code !== code) {
      await supabaseAdmin
        .from('users')
        .update({ otp_attempts: (user.otp_attempts || 0) + 1 })
        .eq('id', user.id)

      return NextResponse.json(
        { error: '验证码错误' },
        { status: 400 }
      )
    }

    // 验证成功：清除 OTP，更新 last_login
    await supabaseAdmin
      .from('users')
      .update({
        otp_code: null,
        otp_expires_at: null,
        otp_attempts: 0,
        last_login_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    // 签发 JWT
    const token = await signToken({ userId: user.id, phone: user.phone })
    await setAuthCookie(token)

    return NextResponse.json({
      user: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
      },
    })
  } catch (error) {
    console.error('[verify-otp] Error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}

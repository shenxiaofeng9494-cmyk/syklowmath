import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase-server'
import { signToken } from '@/lib/auth/jwt'
import { setAuthCookie } from '@/lib/auth/cookies'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { error: '请输入用户名和密码' },
        { status: 400 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: '服务暂不可用' },
        { status: 503 }
      )
    }

    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('username', username)
      .single()

    if (fetchError || !user) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      )
    }

    if (!user.password_hash) {
      return NextResponse.json(
        { error: '该账号未设置密码，请使用手机验证码登录' },
        { status: 400 }
      )
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      )
    }

    // 更新最后登录时间
    await supabaseAdmin
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id)

    const token = await signToken({ userId: user.id, phone: user.phone })
    await setAuthCookie(token)

    return NextResponse.json({
      user: {
        id: user.id,
        phone: user.phone,
        username: user.username,
        nickname: user.nickname,
      },
    })
  } catch (error) {
    console.error('[login] Error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}

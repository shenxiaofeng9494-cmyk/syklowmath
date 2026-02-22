import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase-server'
import { signToken } from '@/lib/auth/jwt'
import { setAuthCookie } from '@/lib/auth/cookies'

const USERNAME_REGEX = /^[a-zA-Z0-9_\u4e00-\u9fff]{2,20}$/

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !USERNAME_REGEX.test(username)) {
      return NextResponse.json(
        { error: '用户名需要2-20个字符，支持中英文、数字和下划线' },
        { status: 400 }
      )
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: '密码至少6位' },
        { status: 400 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: '服务暂不可用' },
        { status: 503 }
      )
    }

    // 检查用户名是否已存在
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('username', username)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: '用户名已被注册' },
        { status: 409 }
      )
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const { data: user, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        username,
        password_hash: passwordHash,
      })
      .select('id, phone, username, nickname')
      .single()

    if (insertError) {
      console.error('[register] Insert error:', insertError)
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: '用户名已被注册' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: '注册失败，请稍后再试' },
        { status: 500 }
      )
    }

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
    console.error('[register] Error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { generateOtp, sendSmsOtp } from '@/lib/auth/sms'

const PHONE_REGEX = /^1[3-9]\d{9}$/
const OTP_COOLDOWN_SECONDS = 60
const OTP_EXPIRY_MINUTES = 5

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json()

    if (!phone || !PHONE_REGEX.test(phone)) {
      return NextResponse.json(
        { error: '请输入正确的手机号' },
        { status: 400 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: '服务暂不可用' },
        { status: 503 }
      )
    }

    // 检查发送冷却（60秒内不能重复发送）
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('otp_expires_at')
      .eq('phone', phone)
      .single()

    if (existing?.otp_expires_at) {
      const expiresAt = new Date(existing.otp_expires_at)
      const cooldownEnd = new Date(expiresAt.getTime() - (OTP_EXPIRY_MINUTES - 1) * 60 * 1000)
      if (new Date() < cooldownEnd) {
        const remaining = Math.ceil((cooldownEnd.getTime() - Date.now()) / 1000)
        return NextResponse.json(
          { error: `请${remaining}秒后再试` },
          { status: 429 }
        )
      }
    }

    const code = generateOtp()
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

    // Upsert: 新用户自动创建，老用户更新 OTP
    const { error: upsertError } = await supabaseAdmin
      .from('users')
      .upsert(
        {
          phone,
          otp_code: code,
          otp_expires_at: expiresAt.toISOString(),
          otp_attempts: 0,
        },
        { onConflict: 'phone' }
      )

    if (upsertError) {
      console.error('[send-otp] Upsert error:', upsertError)
      return NextResponse.json(
        { error: '发送失败，请稍后再试' },
        { status: 500 }
      )
    }

    const sent = await sendSmsOtp(phone, code)
    if (!sent) {
      return NextResponse.json(
        { error: '短信发送失败，请稍后再试' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[send-otp] Error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}

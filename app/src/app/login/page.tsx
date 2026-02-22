'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/components/auth/AuthProvider'

type Step = 'phone' | 'code'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading, refresh } = useAuth()

  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [countdown, setCountdown] = useState(0)

  // 已登录则跳转
  useEffect(() => {
    if (!isLoading && user) {
      const redirect = searchParams.get('redirect') || '/'
      router.replace(redirect)
    }
  }, [user, isLoading, router, searchParams])

  // 倒计时
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const handleSendOtp = useCallback(async () => {
    setError('')

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入正确的手机号')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '发送失败')
        return
      }
      setStep('code')
      setCountdown(60)
    } catch {
      setError('网络错误，请稍后再试')
    } finally {
      setSending(false)
    }
  }, [phone])

  const handleVerifyOtp = useCallback(async () => {
    setError('')

    if (code.length !== 6) {
      setError('请输入6位验证码')
      return
    }

    setVerifying(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '验证失败')
        return
      }
      await refresh()
      const redirect = searchParams.get('redirect') || '/'
      router.push(redirect)
    } catch {
      setError('网络错误，请稍后再试')
    } finally {
      setVerifying(false)
    }
  }, [phone, code, refresh, router, searchParams])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-blue-400">MathTalkTV</CardTitle>
          <CardDescription>手机号登录</CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'phone' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">手机号</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="请输入手机号"
                  maxLength={11}
                  value={phone}
                  onChange={e => {
                    setPhone(e.target.value.replace(/\D/g, ''))
                    setError('')
                  }}
                  onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button
                className="w-full"
                onClick={handleSendOtp}
                disabled={sending || phone.length !== 11}
              >
                {sending ? '发送中...' : '获取验证码'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground text-center">
                验证码已发送至 {phone}
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">验证码</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  placeholder="请输入6位验证码"
                  maxLength={6}
                  value={code}
                  onChange={e => {
                    setCode(e.target.value.replace(/\D/g, ''))
                    setError('')
                  }}
                  onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button
                className="w-full"
                onClick={handleVerifyOtp}
                disabled={verifying || code.length !== 6}
              >
                {verifying ? '验证中...' : '登录'}
              </Button>
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStep('phone')
                    setCode('')
                    setError('')
                  }}
                >
                  更换手机号
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSendOtp}
                  disabled={countdown > 0 || sending}
                >
                  {countdown > 0 ? `${countdown}秒后重新发送` : '重新发送'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}

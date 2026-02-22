'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/components/auth/AuthProvider'

type LoginMethod = 'phone' | 'account'
type PhoneStep = 'phone' | 'code'
type AccountMode = 'login' | 'register'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading, refresh } = useAuth()

  // Tab state
  const [method, setMethod] = useState<LoginMethod>('account')

  // Phone OTP state
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [countdown, setCountdown] = useState(0)

  // Account state
  const [accountMode, setAccountMode] = useState<AccountMode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Shared state
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

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

  // 切换登录方式时清空状态
  const switchMethod = (m: LoginMethod) => {
    setMethod(m)
    setError('')
  }

  // ===== Phone OTP handlers =====
  const handleSendOtp = useCallback(async () => {
    setError('')
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入正确的手机号')
      return
    }
    setSubmitting(true)
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
      setPhoneStep('code')
      setCountdown(60)
    } catch {
      setError('网络错误，请稍后再试')
    } finally {
      setSubmitting(false)
    }
  }, [phone])

  const handleVerifyOtp = useCallback(async () => {
    setError('')
    if (code.length !== 6) {
      setError('请输入6位验证码')
      return
    }
    setSubmitting(true)
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
      setSubmitting(false)
    }
  }, [phone, code, refresh, router, searchParams])

  // ===== Account handlers =====
  const handleAccountSubmit = useCallback(async () => {
    setError('')

    if (!username.trim()) {
      setError('请输入用户名')
      return
    }

    if (!password) {
      setError('请输入密码')
      return
    }

    if (accountMode === 'register') {
      if (password.length < 6) {
        setError('密码至少6位')
        return
      }
      if (password !== confirmPassword) {
        setError('两次密码输入不一致')
        return
      }
    }

    setSubmitting(true)
    try {
      const endpoint = accountMode === 'register' ? '/api/auth/register' : '/api/auth/login'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || (accountMode === 'register' ? '注册失败' : '登录失败'))
        return
      }
      await refresh()
      const redirect = searchParams.get('redirect') || '/'
      router.push(redirect)
    } catch {
      setError('网络错误，请稍后再试')
    } finally {
      setSubmitting(false)
    }
  }, [username, password, confirmPassword, accountMode, refresh, router, searchParams])

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
          <CardDescription>
            {method === 'phone' ? '手机号登录' : (accountMode === 'register' ? '注册账号' : '账号密码登录')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Tab 切换 */}
          <div className="flex mb-4 border-b">
            <button
              className={`flex-1 pb-2 text-sm font-medium transition-colors ${
                method === 'account'
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => switchMethod('account')}
            >
              账号密码
            </button>
            <button
              className={`flex-1 pb-2 text-sm font-medium transition-colors ${
                method === 'phone'
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => switchMethod('phone')}
            >
              手机验证码
            </button>
          </div>

          {method === 'phone' ? (
            // ===== 手机验证码登录 =====
            phoneStep === 'phone' ? (
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
                  disabled={submitting || phone.length !== 11}
                >
                  {submitting ? '发送中...' : '获取验证码'}
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
                  disabled={submitting || code.length !== 6}
                >
                  {submitting ? '验证中...' : '登录'}
                </Button>
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPhoneStep('phone')
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
                    disabled={countdown > 0 || submitting}
                  >
                    {countdown > 0 ? `${countdown}秒后重新发送` : '重新发送'}
                  </Button>
                </div>
              </div>
            )
          ) : (
            // ===== 账号密码登录/注册 =====
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="2-20个字符，支持中英文、数字、下划线"
                  maxLength={20}
                  value={username}
                  onChange={e => {
                    setUsername(e.target.value)
                    setError('')
                  }}
                  onKeyDown={e => e.key === 'Enter' && !accountMode && handleAccountSubmit()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={accountMode === 'register' ? '至少6位' : '请输入密码'}
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value)
                    setError('')
                  }}
                  onKeyDown={e => e.key === 'Enter' && accountMode === 'login' && handleAccountSubmit()}
                />
              </div>
              {accountMode === 'register' && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">确认密码</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="再次输入密码"
                    value={confirmPassword}
                    onChange={e => {
                      setConfirmPassword(e.target.value)
                      setError('')
                    }}
                    onKeyDown={e => e.key === 'Enter' && handleAccountSubmit()}
                  />
                </div>
              )}
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button
                className="w-full"
                onClick={handleAccountSubmit}
                disabled={submitting || !username.trim() || !password}
              >
                {submitting
                  ? (accountMode === 'register' ? '注册中...' : '登录中...')
                  : (accountMode === 'register' ? '注册' : '登录')
                }
              </Button>
              <div className="text-center">
                <Button
                  variant="link"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => {
                    setAccountMode(accountMode === 'login' ? 'register' : 'login')
                    setError('')
                    setConfirmPassword('')
                  }}
                >
                  {accountMode === 'login' ? '没有账号？立即注册' : '已有账号？去登录'}
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

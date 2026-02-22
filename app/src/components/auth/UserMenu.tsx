'use client'

import { useAuth } from './AuthProvider'
import { Button } from '@/components/ui/button'

export function UserMenu() {
  const { user, isLoading, logout } = useAuth()

  if (isLoading) return null

  if (!user) return null

  // 显示手机号（中间4位隐藏）
  const maskedPhone = user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">
        {user.nickname || maskedPhone}
      </span>
      <Button variant="ghost" size="sm" onClick={logout}>
        退出
      </Button>
    </div>
  )
}

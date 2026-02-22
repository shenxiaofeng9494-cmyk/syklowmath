'use client'

import { useAuth } from './AuthProvider'
import { Button } from '@/components/ui/button'

export function UserMenu() {
  const { user, isLoading, logout } = useAuth()

  if (isLoading) return null

  if (!user) return null

  // 显示优先级：昵称 > 手机号（脱敏） > 用户名
  const maskedPhone = user.phone
    ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
    : null
  const displayName = user.nickname || maskedPhone || user.username || '用户'

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">
        {displayName}
      </span>
      <Button variant="ghost" size="sm" onClick={logout}>
        退出
      </Button>
    </div>
  )
}

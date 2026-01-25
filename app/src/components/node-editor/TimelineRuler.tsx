'use client'

interface TimelineRulerProps {
  duration: number // 视频总时长（秒）
  width: number // 时间轴宽度（像素）
}

export function TimelineRuler({ duration, width }: TimelineRulerProps) {
  // 计算刻度间隔
  const majorInterval = duration > 300 ? 60 : duration > 60 ? 10 : 5 // 主刻度间隔
  const minorInterval = majorInterval / 5 // 次刻度间隔

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const ticks: { time: number; isMajor: boolean }[] = []
  for (let t = 0; t <= duration; t += minorInterval) {
    ticks.push({
      time: t,
      isMajor: t % majorInterval === 0,
    })
  }

  return (
    <div className="relative h-6 bg-gray-100 border-b border-gray-300">
      {ticks.map(({ time, isMajor }) => {
        const left = (time / duration) * 100
        return (
          <div
            key={time}
            className="absolute top-0"
            style={{ left: `${left}%` }}
          >
            <div
              className={`w-px ${isMajor ? 'h-4 bg-gray-500' : 'h-2 bg-gray-300'}`}
            />
            {isMajor && (
              <span className="absolute top-4 left-0 -translate-x-1/2 text-xs text-gray-500 whitespace-nowrap">
                {formatTime(time)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

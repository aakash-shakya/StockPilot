import { useEffect, useRef, useState } from 'react'

interface NumberAnimationProps {
  value: number
  duration?: number
  className?: string
}

export function NumberAnimation({ value, duration = 600, className }: NumberAnimationProps) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<number | null>(null)

  useEffect(() => {
    const start = display
    const diff = value - start
    if (diff === 0) return
    const startTime = performance.now()

    function tick(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setDisplay(Math.round(start + diff * eased))
      if (progress < 1) {
        ref.current = requestAnimationFrame(tick)
      }
    }

    ref.current = requestAnimationFrame(tick)
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current)
    }
  }, [value, duration])

  return <span className={className}>{display}</span>
}

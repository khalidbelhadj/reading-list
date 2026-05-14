"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

const useHoverPreview = (delay: number) => {
  const [open, setOpen] = React.useState(false)
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  const mouseRef = React.useRef({ x: 0, y: 0 })
  const [position, setPosition] = React.useState<{ x: number; y: number } | null>(null)

  const onMouseEnter = React.useCallback(
    (e: React.MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
      timerRef.current = setTimeout(() => {
        setPosition({ ...mouseRef.current })
        setOpen(true)
      }, delay)
    },
    [delay],
  )

  const onMouseMove = React.useCallback((e: React.MouseEvent) => {
    mouseRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  const onMouseLeave = React.useCallback(() => {
    clearTimeout(timerRef.current)
    setOpen(false)
    setPosition(null)
  }, [])

  const dismiss = React.useCallback(() => {
    clearTimeout(timerRef.current)
    setOpen(false)
    setPosition(null)
  }, [])

  React.useEffect(() => {
    return () => clearTimeout(timerRef.current)
  }, [])

  return { open, position, onMouseEnter, onMouseMove, onMouseLeave, dismiss }
}

const HoverPreviewContent = ({
  open,
  position,
  className,
  children,
}: {
  open: boolean
  position: { x: number; y: number } | null
  className?: string
  children: React.ReactNode
}) => {
  const [style, setStyle] = React.useState<React.CSSProperties>({})

  React.useEffect(() => {
    if (!open || !position) return
    const cardWidth = 288
    const cardHeight = 160
    const pad = 16
    const offset = 12

    let left = position.x + offset
    let top = position.y + offset

    if (left + cardWidth > window.innerWidth - pad) {
      left = position.x - cardWidth - offset
    }
    if (left < pad) left = pad
    if (top + cardHeight > window.innerHeight - pad) {
      top = position.y - cardHeight - offset
    }
    if (top < pad) top = pad

    setStyle({ top, left })
  }, [open, position])

  if (!open || !position) return null

  return createPortal(
    <div
      className={cn(
        "fixed z-50 w-72 rounded-lg bg-background dark:bg-card p-3 shadow-lg pointer-events-none",
        "animate-in fade-in-0 zoom-in-95",
        className,
      )}
      style={style}
    >
      {children}
    </div>,
    document.body,
  )
}

export { useHoverPreview, HoverPreviewContent }

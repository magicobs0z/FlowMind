import { useRef, useCallback, type ReactNode } from 'react'

interface ResizablePanelProps {
  direction: 'horizontal' | 'vertical'
  size: number
  minSize?: number
  maxSize?: number
  onResize: (size: number) => void
  onCollapse?: () => void
  collapsed?: boolean
  collapseDirection?: 'left' | 'right' | 'top' | 'bottom'
  className?: string
  children: ReactNode
  resizerClassName?: string
}

export default function ResizablePanel({
  direction,
  size,
  minSize = 100,
  maxSize = 600,
  onResize,
  onCollapse,
  collapsed,
  collapseDirection = 'right',
  className = '',
  children,
  resizerClassName = '',
}: ResizablePanelProps) {
  const isDragging = useRef(false)
  const startPos = useRef(0)
  const startSize = useRef(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDragging.current = true
      startPos.current = direction === 'horizontal' ? e.clientX : e.clientY
      startSize.current = size

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current) return
        const currentPos = direction === 'horizontal' ? e.clientX : e.clientY
        const delta = currentPos - startPos.current

        let newSize: number
        if (collapseDirection === 'left' || collapseDirection === 'top') {
          newSize = startSize.current + delta
        } else {
          newSize = startSize.current - delta
        }

        newSize = Math.max(minSize, Math.min(maxSize, newSize))
        onResize(newSize)
      }

      const handleMouseUp = () => {
        isDragging.current = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'
      document.body.style.userSelect = 'none'
    },
    [direction, size, minSize, maxSize, onResize, collapseDirection]
  )

  if (collapsed) {
    return (
      <div
        className={`flex-shrink-0 flex items-center justify-center bg-[var(--flowmind-layer)] border-[var(--flowmind-border)] ${
          collapseDirection === 'left' || collapseDirection === 'right'
            ? 'w-8 border-r'
            : 'h-8 border-t'
        } ${className}`}
        style={{ borderColor: 'var(--flowmind-border)' }}
      >
        <button
          onClick={onCollapse}
          className="p-1 rounded hover:bg-gray-200 text-gray-500 transition-colors"
          title="展开"
        >
          {collapseDirection === 'left' && <ChevronRightIcon />}
          {collapseDirection === 'right' && <ChevronLeftIcon />}
          {collapseDirection === 'top' && <ChevronDownIcon />}
          {collapseDirection === 'bottom' && <ChevronUpIcon />}
        </button>
      </div>
    )
  }

  const isHorizontal = direction === 'horizontal'
  const isLeading = collapseDirection === 'left' || collapseDirection === 'top'

  return (
    <div
      className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} ${className}`}
      style={isHorizontal ? { width: size } : { height: size }}
    >
      {!isLeading && (
        <div
          className={`flex-shrink-0 ${
            isHorizontal
              ? `w-1 cursor-col-resize hover:bg-[var(--flowmind-primary)] ${resizerClassName}`
              : `h-1 cursor-row-resize hover:bg-[var(--flowmind-primary)] ${resizerClassName}`
          } transition-colors`}
          onMouseDown={handleMouseDown}
          style={{ background: 'var(--flowmind-border)' }}
        />
      )}

      <div className="flex-1 overflow-hidden relative">
        {children}
        <button
          onClick={onCollapse}
          className={`absolute ${
            isHorizontal
              ? 'top-1/2 -translate-y-1/2 w-4 h-12 flex items-center justify-center'
              : 'left-1/2 -translate-x-1/2 h-4 w-12 flex items-center justify-center'
          } ${
            isLeading
              ? isHorizontal
                ? 'right-0'
                : 'bottom-0'
              : isHorizontal
                ? 'left-0'
                : 'top-0'
          } z-10 opacity-0 hover:opacity-100 transition-opacity bg-[var(--flowmind-layer)] border border-[var(--flowmind-border)] rounded cursor-pointer`}
          title="折叠"
        >
          {collapseDirection === 'left' && <ChevronLeftIcon />}
          {collapseDirection === 'right' && <ChevronRightIcon />}
          {collapseDirection === 'top' && <ChevronUpIcon />}
          {collapseDirection === 'bottom' && <ChevronDownIcon />}
        </button>
      </div>

      {isLeading && (
        <div
          className={`flex-shrink-0 ${
            isHorizontal
              ? `w-1 cursor-col-resize hover:bg-[var(--flowmind-primary)] ${resizerClassName}`
              : `h-1 cursor-row-resize hover:bg-[var(--flowmind-primary)] ${resizerClassName}`
          } transition-colors`}
          onMouseDown={handleMouseDown}
          style={{ background: 'var(--flowmind-border)' }}
        />
      )}
    </div>
  )
}

function ChevronLeftIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function ChevronUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

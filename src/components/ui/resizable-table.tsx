"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { TableHead } from "@/components/ui/table"

/**
 * Per-column widths driven via <colgroup>/<col> on a table-fixed layout, so
 * dragging one column's handle never reflows its siblings.
 */
export function useColumnWidths(defaults: Record<string, number>) {
  const [widths, setWidths] = React.useState(defaults)
  const widthsRef = React.useRef(widths)
  React.useEffect(() => {
    widthsRef.current = widths
  }, [widths])

  function startResize(key: string) {
    return (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = widthsRef.current[key] ?? 120

      function onMove(ev: MouseEvent) {
        const delta = ev.clientX - startX
        setWidths((prev) => ({ ...prev, [key]: Math.max(60, startWidth + delta) }))
      }
      function onUp() {
        window.removeEventListener("mousemove", onMove)
        window.removeEventListener("mouseup", onUp)
      }
      window.addEventListener("mousemove", onMove)
      window.addEventListener("mouseup", onUp)
    }
  }

  return { widths, startResize }
}

export function ColGroup({ columns, widths }: { columns: string[]; widths: Record<string, number> }) {
  return (
    <colgroup>
      {columns.map((key) => (
        <col key={key} style={{ width: widths[key] }} />
      ))}
    </colgroup>
  )
}

export function ResizableHead({
  children,
  onResizeStart,
  className,
}: {
  children?: React.ReactNode
  onResizeStart: (e: React.MouseEvent) => void
  className?: string
}) {
  return (
    <TableHead className={cn("relative overflow-hidden", className)}>
      <div className="truncate">{children}</div>
      <span
        onMouseDown={onResizeStart}
        className="absolute top-0 right-0 z-10 h-full w-1.5 cursor-col-resize touch-none [-webkit-user-select:none] select-none hover:bg-primary/40 active:bg-primary/60"
      />
    </TableHead>
  )
}

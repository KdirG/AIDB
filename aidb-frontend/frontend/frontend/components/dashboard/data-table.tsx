'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface DataTableProps {
  data: Record<string, unknown>[]
}

const PAGE_SIZE = 15

export function DataTable({ data }: DataTableProps) {
  const [currentPage, setCurrentPage] = useState(0)

  const columns = useMemo(() => {
    if (data.length === 0) return []
    return Object.keys(data[0])
  }, [data])

  const totalPages = Math.ceil(data.length / PAGE_SIZE)
  const paginatedData = data.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  if (data.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Gösterilecek veri yok
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card/20 shadow-sm overflow-hidden auto-cols-max">
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-border/50">
        <table className="w-full">
          <thead>
            <tr className="bg-secondary/20 border-b border-border/60">
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-widest border-r border-border/10 last:border-0"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {paginatedData.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="hover:bg-secondary/40 transition-colors group"
              >
                {columns.map((column) => (
                  <td
                    key={column}
                    className="px-3 py-1.5 text-[13px] font-mono tabular-nums tracking-tight text-foreground/90 group-hover:text-foreground whitespace-nowrap border-r border-border/10 last:border-0"
                  >
                    {formatCellValue(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-border/60 bg-secondary/10">
          <span className="text-[11px] font-medium text-muted-foreground tracking-wide">
            <span className="text-foreground">{currentPage * PAGE_SIZE + 1} – {Math.min((currentPage + 1) * PAGE_SIZE, data.length)}</span> / {data.length} kayıt
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="p-1 rounded hover:bg-secondary disabled:opacity-50 disabled:hover:bg-transparent transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-foreground/80 px-2 uppercase tracking-wide">
              Sayfa {currentPage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="p-1 rounded hover:bg-secondary disabled:opacity-50 disabled:hover:bg-transparent transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır'
  if (typeof value === 'number') return value.toLocaleString()
  if (value instanceof Date) return value.toLocaleDateString()
  return String(value)
}

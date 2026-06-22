'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface DataTableProps {
  data: Record<string, unknown>[]
  onHistoryClick?: (row: any) => void
}

const PAGE_SIZE = 15

export function DataTable({ data, onHistoryClick }: DataTableProps) {
  const [currentPage, setCurrentPage] = useState(0)

  const isTemporalData = useMemo(() => {
    if (!data || data.length === 0) return false;
    return Object.keys(data[0]).some(k => k.toLowerCase() === 'sysendtime');
  }, [data]);

  const columns = useMemo(() => {
    const source = data
    if (!source || source.length === 0) return []
    return Object.keys(source[0])
  }, [data])

  const totalPages = Math.ceil(data.length / PAGE_SIZE)
  const paginatedData = data.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  if (data.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground italic uppercase text-[10px] font-bold tracking-widest">
        Gösterilecek veri yok
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/40 bg-card/10 backdrop-blur-md overflow-hidden border-separate">
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-border/50">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-secondary/10 border-b border-border/40">
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-4 py-3 text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] border-r border-border/5 last:border-0"
                >
                  {column}
                </th>
              ))}
              {onHistoryClick && (
                <th className="px-4 py-3 text-right text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] w-[80px]">
                  {isTemporalData ? 'Restore' : 'History'}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {paginatedData.map((row, rowIndex) => {
              return (
                <tr
                  key={rowIndex}
                  className="hover:bg-primary/5 transition-all group/row"
                >
                  {columns.map((column) => {
                    const newValue = row[column]

                    return (
                      <td
                        key={column}
                        className="px-4 py-2.5 text-[12px] font-medium tabular-nums tracking-tight whitespace-nowrap border-r border-border/5 last:border-0 transition-colors text-foreground/70"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span>{formatCellValue(newValue)}</span>
                        </div>
                      </td>
                    )
                  })}
                  {onHistoryClick && (
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => onHistoryClick(row)}
                        className={cn(
                          "p-1.5 rounded-md transition-colors inline-flex",
                          isTemporalData 
                            ? "hover:bg-amber-500/20 text-amber-500/70 hover:text-amber-500" 
                            : "hover:bg-primary/20 text-muted-foreground hover:text-primary"
                        )}
                        title={isTemporalData ? "Restore to this version" : "View History"}
                      >
                        {isTemporalData ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
                        )}
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/40 bg-secondary/5">
          <div className="flex items-center gap-1.5">
             <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
             <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
               {data.length} KAYIT BULUNDU
             </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="p-1.5 rounded-lg bg-secondary/50 hover:bg-primary/20 disabled:opacity-30 transition-all border border-border/50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-black text-foreground/60 uppercase tracking-tighter">
              SAYFA {currentPage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="p-1.5 rounded-lg bg-secondary/50 hover:bg-primary/20 disabled:opacity-30 transition-all border border-border/50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? 'EVET' : 'HAYIR'
  if (typeof value === 'number') return value.toLocaleString()
  return String(value)
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ')
}

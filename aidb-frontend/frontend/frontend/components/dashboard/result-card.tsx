'use client'

import { SqlTerminal } from './sql-terminal'
import { DataTable } from './data-table'
import { ActionBar } from './action-bar'

interface ResultCardProps {
  sql: string
  data: Record<string, unknown>[]
  onGenerateChart?: () => void // Grafik oluşturma fonksiyonu (opsiyonel)
}

export function ResultCard({ sql, data, onGenerateChart }: ResultCardProps) {
  return (
    <div className="space-y-4 p-4 rounded-xl border border-border bg-card/50 backdrop-blur-sm shadow-[0_0_24px_rgba(16,185,129,0.05)]">
      <SqlTerminal sql={sql} />
      <DataTable data={data} />
      {/* Grafik oluşturma fonksiyonunu ActionBar bileşenine aktarıyoruz */}
      <ActionBar data={data} sql={sql} onGenerateChart={onGenerateChart} />
    </div>
  )
}

'use client'

import { Database, Gauge, Rows3 } from 'lucide-react'
import type { MetricsData } from '@/lib/types'

interface MetricsBarProps {
  metrics: MetricsData
}

export function MetricsBar({ metrics }: MetricsBarProps) {
  return (
    <div className="flex items-center gap-6 px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            metrics.dbConnected ? 'bg-primary animate-pulse' : 'bg-muted-foreground'
          }`}
        />
        <Database className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Veritabanı Bağlantısı</span>
        <span
          className={`text-sm font-medium ${
            metrics.dbConnected ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          {metrics.dbConnected ? 'Aktif' : 'Pasif'}
        </span>
      </div>

      <div className="w-px h-4 bg-border" />

      <div className="flex items-center gap-2">
        <Gauge className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Sorgu Performansı</span>
        <span className="text-sm font-mono text-foreground">
          {metrics.queryTime !== null ? `${metrics.queryTime}ms` : '—'}
        </span>
      </div>

      <div className="w-px h-4 bg-border" />

      <div className="flex items-center gap-2">
        <Rows3 className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Taranan Satır Sayısı</span>
        <span className="text-sm font-mono text-foreground">
          {metrics.rowsScanned > 0 ? metrics.rowsScanned.toLocaleString() : '—'}
        </span>
      </div>
    </div>
  )
}

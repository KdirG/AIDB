'use client'

import { useState } from 'react'
import { Download, BarChart3, FileSpreadsheet, Loader2, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import * as XLSX from 'xlsx'

interface ActionBarProps {
  data: Record<string, unknown>[]
  sql: string
  onGenerateChart?: () => void
  onViewHistory?: () => void
}

export function ActionBar({ data, sql, onGenerateChart, onViewHistory }: ActionBarProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExportExcel = async () => {
    if (data.length === 0) return
    
    setIsExporting(true)
    
    try {
      // xlsx kütüphanesi ile güvenli dışa aktarma
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sorgu Sonuçları");
      
      XLSX.writeFile(workbook, `AIDB-Export-${Date.now()}.xlsx`);

    } catch (error) {
      console.error('[AIDB] Export error:', error)
    } finally {
      setIsExporting(false)
    }
  }

  const handleGenerateChart = () => {
    if (onGenerateChart) {
      onGenerateChart()
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap border-t border-border pt-4">
      {/* Excel Dışa Aktar Butonu */}
      <button
        onClick={handleExportExcel}
        disabled={data.length === 0 || isExporting}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-all',
          'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <FileSpreadsheet className="w-4 h-4" />
            Export to Excel
          </>
        )}
      </button>

      {/* Grafik Oluştur Butonu */}
      <button
        onClick={handleGenerateChart}
        disabled={data.length === 0}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary border border-border rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <BarChart3 className="w-4 h-4" />
        Generate Chart
      </button>

      {/* Tablo Geçmişi (Tüm Tablo İçin) */}
      {onViewHistory && (
        <button
          onClick={onViewHistory}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold text-indigo-500 hover:text-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg transition-all"
        >
          <History className="w-4 h-4" />
          VIEW TABLE HISTORY
        </button>
      )}
      
    </div>
  )
}
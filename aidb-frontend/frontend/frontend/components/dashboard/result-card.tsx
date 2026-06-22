'use client'

import { useState } from 'react'
import { Gauge, Rows3, Table, ArrowLeftRight } from 'lucide-react'
import { SqlTerminal } from './sql-terminal'
import { DataTable } from './data-table'
import { ActionBar } from './action-bar'
import { VersionPanel } from './version-panel'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n-context'

interface ResultCardProps {
  sql: string
  data: Record<string, unknown>[]
  onGenerateChart?: () => void
  onRestoreAction?: (prompt: string) => void
  executionTime?: number
  rowCount?: number
}

export function ResultCard({ sql, data, onGenerateChart, onRestoreAction, executionTime, rowCount }: ResultCardProps) {
  const { language } = useI18n()
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [historyData, setHistoryData] = useState<any[]>([])

  const handleHistoryClick = async (row: any) => {
    // Eğer tablo zaten bir history tablosuysa (Tüm Geçmişi Gör dediysek), tıklanan satırı direkt geri yükle
    if (row.SysEndTime || row.SYSENDTIME || row.SysStartTime || row.SYSSTARTTIME) {
      handleRestore(row);
      return;
    }

    setIsHistoryLoading(true)
    
    try {
      const activeDb = localStorage.getItem('aidb_active_db')
      const dbId = activeDb ? parseInt(activeDb) : null

      const res = await fetch('http://localhost:8089/api/v1/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          dbId: dbId,
          originalSql: sql,
          rowData: row
        })
      });

      if (!res.ok) throw new Error("History isteği başarısız oldu.");
      const { requestId } = await res.json();

      // SSE Dinleyicisi aç
      const sseUrl = `http://localhost:8089/api/v1/stream?requestId=${requestId}`;
      const token = localStorage.getItem('token') || '';
      
      const evtSource = new EventSource(`${sseUrl}&token=${token}`);
      
      evtSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.status === 'SUCCESS') {
            setHistoryData(data.resultData || []);
            setIsHistoryOpen(true);
            setIsHistoryLoading(false);
            evtSource.close();
          } else if (data.status === 'ERROR') {
            alert("Error fetching history: " + data.errorMessage);
            setIsHistoryLoading(false);
            evtSource.close();
          }
        } catch (e) {
          console.error("SSE Parse Hatası:", e);
        }
      };

      evtSource.onerror = () => {
        evtSource.close();
        setIsHistoryLoading(false);
      };

    } catch (e) {
      console.error(e);
      alert("İşlem sırasında bir hata oluştu.");
      setIsHistoryLoading(false);
    }
  }

  const handleRestore = async (version: any) => {
    if (onRestoreAction) {
      const payload = {
        originalSql: sql,
        rowData: version
      };
      onRestoreAction(`[SYSTEM_RESTORE] ${JSON.stringify(payload)}`);
      setIsHistoryOpen(false);
    } else {
      alert("Restore action not defined.");
    }
  }

  return (
    <div className="space-y-4 p-4 rounded-xl border border-border bg-card/50 backdrop-blur-sm shadow-[0_0_24px_rgba(16,185,129,0.05)]">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <div className="flex bg-secondary/30 p-1 rounded-lg border border-border/50">
            <button
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all bg-primary text-primary-foreground shadow-lg"
            >
              <Table className="w-3.5 h-3.5" />
              {language === 'tr' ? 'Veri Tablosu' : 'Data Table'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[11px] font-medium text-muted-foreground">

          {executionTime !== undefined && (
            <div className="flex items-center gap-1.5">
              <Gauge className="w-3 h-3" />
              <span>{executionTime}ms</span>
            </div>
          )}
          {rowCount !== undefined && (
            <div className="flex items-center gap-1.5">
              <Rows3 className="w-3 h-3" />
              <span>{rowCount.toLocaleString()} satır</span>
            </div>
          )}
        </div>
      </div>

      <SqlTerminal sql={sql} />
      
      <div className="animate-in fade-in slide-in-from-top-2 duration-500 relative">
        {isHistoryLoading && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
             <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg shadow-xl border border-border">
               <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
               <span className="text-xs font-bold text-foreground">Extracting Timeline...</span>
             </div>
          </div>
        )}
        <DataTable 
          data={data} 
          onHistoryClick={(data && data.length > 0 && Object.keys(data[0]).some(k => k.toLowerCase() === 'sysendtime')) ? handleHistoryClick : undefined} 
        />
      </div>

      <ActionBar 
        data={data} 
        sql={sql} 
        onGenerateChart={onGenerateChart} 
        onViewHistory={onRestoreAction ? () => {
          const payload = { originalSql: sql };
          onRestoreAction(`[SYSTEM_ARCHIVE] ${JSON.stringify(payload)}`);
        } : undefined}
      />

      <VersionPanel 
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        historyData={historyData}
        onRestore={handleRestore}
      />
    </div>
  )
}

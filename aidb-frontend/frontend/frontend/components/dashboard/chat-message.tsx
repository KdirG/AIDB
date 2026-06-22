'use client'

import dynamic from 'next/dynamic'
import { User, Bot, AlertCircle, Loader2, ShieldAlert, AlertTriangle } from 'lucide-react'
import type { ChatMessage } from '@/lib/types'
import { ResultCard } from './result-card'
import { cn } from '@/lib/utils'

const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full flex flex-col items-center justify-center bg-secondary/20 rounded-xl border border-dashed border-border/50 animate-pulse">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mb-2" />
      <span className="text-sm text-muted-foreground">Grafik render ediliyor...</span>
    </div>
  ),
})

interface ChatMessageProps {
  message: ChatMessage
  onGenerateChart?: () => void
  onRestoreAction?: (prompt: string) => void
}

export function ChatMessageBubble({ message, onGenerateChart, onRestoreAction }: ChatMessageProps) {
  const isUser = message.role === 'user'

  const isUserSystemAction = isUser && (
    message.content.startsWith('[SYSTEM_ARCHIVE]') || 
    message.content.startsWith('[SYSTEM_RESTORE]') ||
    message.content === 'Tüm Tablo Geçmişini Görüntüleme İsteği (System Archive)' ||
    message.content === 'Geçmiş Versiyona Dönüş İsteği (System Restore)'
  );

  if (isUserSystemAction) return null;

  const renderChart = () => {
    if (!message.showChart) return null;
    const chartSource = message.chart || message.chartCode
    if (!chartSource) return null

    try {
      let chartData: any
      if (typeof chartSource === 'string') {
        try { chartData = JSON.parse(chartSource); if (typeof chartData === 'string') chartData = JSON.parse(chartData) } 
        catch { return null }
      } else { chartData = chartSource }

      if (!chartData || !chartData.data) return null

      return (
        <div className="w-full bg-card rounded-xl border border-border shadow-sm overflow-hidden p-5 my-4">
          <Plot
            data={chartData.data.map((trace: any) => ({
              ...trace,
              marker: { ...trace.marker, color: trace.marker?.color || 'var(--primary)' },
              line: { ...trace.line, color: trace.line?.color || 'var(--primary)', width: 2, shape: 'spline' },
              fillcolor: 'var(--glow)',
            }))}
            layout={{
              ...chartData.layout,
              autosize: true,
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor: 'rgba(0,0,0,0)',
              margin: { l: 40, r: 20, t: 20, b: 40 },
              font: { family: 'inherit', size: 12, color: 'var(--muted-foreground)' },
              xaxis: { ...chartData.layout?.xaxis, gridcolor: 'var(--border)', linecolor: 'var(--border)', zeroline: false },
              yaxis: { ...chartData.layout?.yaxis, gridcolor: 'var(--border)', linecolor: 'var(--border)', zeroline: false },
              hovermode: 'x unified',
              showlegend: chartData.data.length > 1,
              legend: { orientation: 'h', y: -0.2, font: { color: 'var(--muted-foreground)' } }
            }}
            useResizeHandler={true}
            style={{ width: '100%', minHeight: '350px' }}
            config={{ displayModeBar: false, responsive: true }}
          />
        </div>
      )
    } catch { return null }
  }

  const isWarningMessage = !isUser && message.content.includes('⚠️');
  const isErrorMessage = !isUser && (
    message.content.toLowerCase().includes('yetki') || 
    message.content.toLowerCase().includes('reddedildi') || 
    message.content.toLowerCase().includes('hata:') ||
    message.content.toLowerCase().includes('error:')
  );

  return (
    <div className={cn('flex gap-4 w-full group animate-in slide-in-from-bottom-2 duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn(
          'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center mt-1 outline-none shadow-sm border border-border/50', 
          isUser 
            ? 'bg-secondary text-foreground' 
            : isErrorMessage
              ? 'bg-red-500/10 text-red-500 border-red-500/20'
              : isWarningMessage
                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                : 'bg-primary text-primary-foreground'
        )}>
        {isUser ? <User className="w-5 h-5" /> : isErrorMessage ? <ShieldAlert className="w-5 h-5" /> : isWarningMessage ? <AlertTriangle className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </div>

      <div className={cn('flex-1 max-w-[85%] space-y-2', isUser ? 'items-end text-right' : 'items-start text-left')}>
        {/* Adlandırma / Saat (Sadece hoverda göster) */}
        <div className={cn("text-[11px] font-medium text-muted-foreground px-1 space-x-2 flex", isUser && "justify-end")}>
           <span className="font-semibold text-foreground/80">{isUser ? 'Siz' : 'AIDB Intelligence'}</span>
           <span className="opacity-0 group-hover:opacity-100 transition-opacity">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
           </span>
        </div>

        <div className={cn(
            'px-5 py-4 rounded-2xl shadow-sm text-[15px] leading-relaxed relative w-fit transition-all duration-300 hover:-translate-y-[2px] cursor-default',
            isUser 
              ? 'bg-secondary/60 ml-auto border border-border border-b-0 border-r-0 rounded-tr-sm text-foreground' 
              : isErrorMessage
                ? 'bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-tl-sm shadow-[0_0_10px_rgba(239,68,68,0.1)]'
                : isWarningMessage
                  ? 'bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-tl-sm shadow-[0_0_10px_rgba(245,158,11,0.1)]'
                  : 'bg-card border border-border rounded-tl-sm text-foreground'
          )}>
          {message.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Veriler analiz ediliyor...</span>
            </div>
          ) : (
            <>
              {message.isFailover && (
                <div className="flex items-center gap-1.5 text-amber-500 mb-2 text-xs font-bold uppercase tracking-wide">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Doğrudan SQL Yürütme Modu</span>
                </div>
              )}
              <div className="whitespace-pre-wrap">
                {message.content.startsWith('[SYSTEM_ARCHIVE]') 
                  ? "Sistem Arşiv Geçmişi (Temporal History) yükleniyor..." 
                  : message.content.startsWith('[SYSTEM_RESTORE]')
                    ? "Sistem Geri Yükleme Protokolü (Native Restore) hazırlanıyor..."
                    : message.content}
              </div>
            </>
          )}
        </div>

        {!message.isLoading && renderChart()}

        {!message.isLoading && message.sql && !message.isAwaitingApproval && (
          <div className="mt-4 w-full">
            <ResultCard 
              sql={message.sql} 
              data={message.data || []} 
              executionTime={message.executionTime} 
              rowCount={message.rowCount} 
              onGenerateChart={onGenerateChart}
              onRestoreAction={onRestoreAction}
            />
          </div>
        )}
      </div>
    </div>
  )
}
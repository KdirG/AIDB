'use client'

import React from "react"
import { useState } from 'react'
import { X, BarChart3, TrendingUp, Clock, Database, Activity, PieChart } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { QueryHistoryItem } from '@/lib/types'
import { useI18n } from "@/lib/i18n-context"

interface AnalyticsPanelProps {
  isOpen: boolean
  onClose: () => void
  queryHistory: QueryHistoryItem[]
  totalQueries: number
  avgQueryTime?: number | null
  totalRowsScanned?: number
}

export function AnalyticsPanel({
  isOpen,
  onClose,
  queryHistory,
  totalQueries = 0,
  avgQueryTime = 0,
  totalRowsScanned = 0,
}: AnalyticsPanelProps) {
  const { t } = useI18n()
  const [activeView, setActiveView] = useState<'overview' | 'performance' | 'history'>('overview')

  if (!isOpen) return null

  // --- SaaS DİNAMİK METRİKLER ---
  const successfulQueries = queryHistory.filter(q => q.generatedSql && q.generatedSql !== "N/A").length
  const successRate = totalQueries > 0 ? Math.round((successfulQueries / totalQueries) * 100) : 0
  
  const getPerformanceData = () => {
    if (!avgQueryTime) return { label: t.analytics.perfLabels.none, color: 'text-muted-foreground' }
    if (avgQueryTime < 300) return { label: t.analytics.perfLabels.excellent, color: 'text-primary' }
    if (avgQueryTime < 700) return { label: t.analytics.perfLabels.good, color: 'text-yellow-500' }
    return { label: t.analytics.perfLabels.slow, color: 'text-destructive' }
  }

  const perf = getPerformanceData()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-4xl mx-4 bg-card/95 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl shadow-primary/10 ring-1 ring-border/50 overflow-hidden max-h-[85vh] animate-in zoom-in-95 duration-300">
        
        <div className="flex items-center justify-between p-6 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground tracking-tight">{t.analytics.title}</h2>
              <p className="text-sm text-muted-foreground">{t.analytics.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-1 p-2 border-b border-border bg-secondary/20">
          {[
            { id: 'overview', label: t.analytics.tabs.overview, icon: PieChart },
            { id: 'performance', label: t.analytics.tabs.performance, icon: Activity },
            { id: 'history', label: t.analytics.tabs.history, icon: Clock },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id as typeof activeView)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeView === tab.id
                  ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(85vh-180px)] scrollbar-thin scrollbar-thumb-border">
          
          {activeView === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  icon={Database}
                  label={t.analytics.totalQueries}
                  value={totalQueries.toString()}
                  trend={`%${successRate} ${t.analytics.successRate}`}
                />
                <StatCard
                  icon={Clock}
                  label={t.analytics.avgTime}
                  value={avgQueryTime ? `${avgQueryTime} ${t.analytics.ms}` : t.analytics.perfLabels.none}
                  trend={perf.label}
                  trendColor={perf.color}
                />
                <StatCard
                  icon={TrendingUp}
                  label={t.analytics.rowsScanned}
                  value={totalRowsScanned.toLocaleString()}
                  trend={t.analytics.rows}
                />
              </div>

              <div className="p-6 rounded-xl bg-secondary/30 border border-border text-center">
                <h3 className="text-sm font-bold text-foreground mb-2">{t.analytics.systemUsage}</h3>
                <p className="text-xs text-muted-foreground">
                  {t.analytics.usageText}
                  <span className="text-primary font-bold"> %{successRate}</span>.
                </p>
              </div>
            </div>
          )}

          {activeView === 'performance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl bg-secondary/30 border border-border/50 shadow-sm">
                  <h3 className="text-sm font-bold text-foreground mb-6 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" /> {t.analytics.accuracyMetrics}
                  </h3>
                  <PerformanceBar label={t.analytics.logicSuccess} percentage={successRate} color="bg-gradient-to-r from-emerald-500 to-primary" />
                  <PerformanceBar label={t.analytics.schemaMatch} percentage={98} color="bg-gradient-to-r from-blue-500 to-cyan-400" />
                  <PerformanceBar label={t.analytics.refinerUsage} percentage={75} color="bg-gradient-to-r from-indigo-500 to-purple-400" />
                </div>
                <div className="p-5 rounded-xl bg-secondary/30 border border-border/50 shadow-sm">
                  <h3 className="text-sm font-bold text-foreground mb-6 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" /> {t.analytics.optEffect}
                  </h3>
                  <PerformanceBar label={t.analytics.responseEff} percentage={94} color="bg-gradient-to-r from-emerald-500 to-primary" />
                  <PerformanceBar label={t.analytics.dbLoad} percentage={12} color="bg-secondary text-foreground" />
                  <PerformanceBar label={t.analytics.latencyScore} percentage={88} color="bg-gradient-to-r from-amber-500 to-orange-400" />
                </div>
              </div>
            </div>
          )}

          {activeView === 'history' && (
            <div className="space-y-3">
              {queryHistory.length === 0 ? (
                <div className="text-center text-muted-foreground py-16">
                  {t.analytics.noHistory}
                </div>
              ) : (
                queryHistory.map((item) => (
                  <div key={item.id} className="p-4 rounded-xl bg-secondary/30 border border-border/50 hover:bg-secondary/50 transition-colors">
                    <p className="text-sm font-semibold">{item.userPrompt}</p>
                    {item.generatedSql && (
                      <div className="mt-3 p-3 rounded-md bg-background/50 border border-border/50 font-mono text-[11px] text-emerald-400 overflow-x-auto whitespace-pre-wrap">
                        {item.generatedSql}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, trend, trendColor = 'text-primary' }: any) {
  return (
    <div className="p-5 rounded-xl bg-secondary/30 border border-border/50 hover:-translate-y-1 hover:shadow-[0_0_15px_rgba(5,150,105,0.08)] transition-all duration-300 group">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-lg bg-background border border-border/50 text-muted-foreground group-hover:text-primary transition-colors">
            <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">{label}</span>
      </div>
      <div className="flex justify-between items-end">
        <span className="text-3xl font-mono tracking-tighter text-foreground group-hover:text-primary transition-colors">{value}</span>
        <span className={cn('text-[11px] font-bold px-2 py-1 rounded-md bg-background border border-border/50', trendColor)}>{trend}</span>
      </div>
    </div>
  )
}

function PerformanceBar({ label, percentage, color }: any) {
  return (
    <div className="mb-4">
      <div className="flex justify-between text-xs mb-1.5 font-medium">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{percentage}%</span>
      </div>
      <div className="h-2 bg-background border border-border/50 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-1000 ease-out', color)} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}

'use client'

import React from "react"
import { useState } from 'react'
import { X, BarChart3, TrendingUp, Clock, Database, Activity, PieChart } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { QueryHistoryItem } from '@/lib/types'

interface AnalyticsPanelProps {
  isOpen: boolean
  onClose: () => void
  queryHistory: QueryHistoryItem[]
  totalQueries: number
  avgQueryTime: number | null
  totalRowsScanned: number
}

export function AnalyticsPanel({
  isOpen,
  onClose,
  queryHistory,
  totalQueries,
  avgQueryTime,
  totalRowsScanned,
}: AnalyticsPanelProps) {
  const [activeView, setActiveView] = useState<'overview' | 'performance' | 'history'>('overview')

  if (!isOpen) return null

  // --- SaaS DİNAMİK METRİKLER ---
  const successfulQueries = queryHistory.filter(q => q.generatedSql && q.generatedSql !== "N/A").length
  const successRate = totalQueries > 0 ? Math.round((successfulQueries / totalQueries) * 100) : 0
  
  const getPerformanceData = () => {
    if (!avgQueryTime) return { label: 'Yok', color: 'text-muted-foreground' }
    if (avgQueryTime < 300) return { label: 'Mükemmel', color: 'text-primary' }
    if (avgQueryTime < 700) return { label: 'İyi', color: 'text-yellow-500' }
    return { label: 'Yavaş', color: 'text-destructive' }
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
              <h2 className="text-lg font-semibold text-foreground tracking-tight">Analitik Paneli</h2>
              <p className="text-sm text-muted-foreground">Performans ve İş İçgörüleri</p>
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
            { id: 'overview', label: 'Genel Bakış', icon: PieChart },
            { id: 'performance', label: 'Performans', icon: Activity },
            { id: 'history', label: 'Sorgu Geçmişi', icon: Clock },
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
                  label="TOPLAM SORGU"
                  value={totalQueries.toString()}
                  trend={`%${successRate} Başarılı`}
                />
                <StatCard
                  icon={Clock}
                  label="ORTALAMA SÜRE"
                  value={avgQueryTime ? `${avgQueryTime} ms` : 'Yok'}
                  trend={perf.label}
                  trendColor={perf.color}
                />
                <StatCard
                  icon={TrendingUp}
                  label="TARANAN SATIR"
                  value={totalRowsScanned.toLocaleString()}
                  trend="Satır"
                />
              </div>

              <div className="p-6 rounded-xl bg-secondary/30 border border-border text-center">
                <h3 className="text-sm font-bold text-foreground mb-2">Sistem Kullanımı</h3>
                <p className="text-xs text-muted-foreground">
                  Sisteminiz aktif olarak sorguları analiz ediyor. Mevcut başarı oranı
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
                    <Activity className="w-4 h-4 text-primary" /> Doğruluk Metrikleri
                  </h3>
                  <PerformanceBar label="Mantıksal Başarı Oranı" percentage={successRate} color="bg-gradient-to-r from-emerald-500 to-primary" />
                  <PerformanceBar label="Şema Uyumu" percentage={98} color="bg-gradient-to-r from-blue-500 to-cyan-400" />
                  <PerformanceBar label="Refiner Kullanımı" percentage={75} color="bg-gradient-to-r from-indigo-500 to-purple-400" />
                </div>
                <div className="p-5 rounded-xl bg-secondary/30 border border-border/50 shadow-sm">
                  <h3 className="text-sm font-bold text-foreground mb-6 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" /> Optimizasyon Etkisi
                  </h3>
                  <PerformanceBar label="Ortalama Yanıt Verimliliği" percentage={94} color="bg-gradient-to-r from-emerald-500 to-primary" />
                  <PerformanceBar label="Veritabanı Yük Etkisi" percentage={12} color="bg-secondary text-foreground" />
                  <PerformanceBar label="Gecikme Skoru" percentage={88} color="bg-gradient-to-r from-amber-500 to-orange-400" />
                </div>
              </div>
            </div>
          )}

          {activeView === 'history' && (
            <div className="space-y-3">
              {queryHistory.length === 0 ? (
                <div className="text-center text-muted-foreground py-16">
                  Kayıt bulunamadı
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

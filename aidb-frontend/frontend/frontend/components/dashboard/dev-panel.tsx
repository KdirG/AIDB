'use client'

import React, { useEffect, useState, useMemo } from "react"
import { X, Terminal, Trash2, RefreshCw, Clock, Code, Code2, Zap, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from "@/lib/i18n-context"

interface LogEntry {
    category: string
    executionTime: number
    sql: string
    timestamp: number
}

interface DevPanelProps {
    isOpen: boolean
    onClose: () => void
    apiEndpoint: string
}

export function DevPanel({ isOpen, onClose, apiEndpoint }: DevPanelProps) {
    const { t } = useI18n()
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [filter, setFilter] = useState('')

    const filteredLogs = useMemo(() => {
        return logs.filter(log => 
            log.sql.toLowerCase().includes(filter.toLowerCase()) || 
            log.category.toLowerCase().includes(filter.toLowerCase())
        )
    }, [logs, filter])

    const fetchLogs = async () => {
        if (!isOpen) return
        setIsLoading(true)
        const token = localStorage.getItem('token')
        try {
            const response = await fetch(`${apiEndpoint}/api/v1/profiler/logs`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            if (response.ok) {
                const data = await response.json()
                setLogs(data)
                setError(null)
            } else {
                setError(`${t.dev.apiError}: ${response.status}`)
            }
        } catch (error: any) {
            console.error("Failed to fetch profiler logs:", error)
            setError(`${t.dev.connError}: ${error.message}`)
        } finally {
            setIsLoading(false)
        }
    }

    const clearLogs = async () => {
        const token = localStorage.getItem('token')
        try {
            await fetch(`${apiEndpoint}/api/v1/profiler/logs`, { 
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            setLogs([])
        } catch (error) {
            console.error("Failed to clear logs:", error)
        }
    }

    useEffect(() => {
        if (isOpen) {
            fetchLogs()
            const interval = setInterval(fetchLogs, 3000)
            return () => clearInterval(interval)
        }
    }, [isOpen])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-5xl mx-4 bg-card/95 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] animate-in zoom-in-95 duration-300 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border bg-card">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-500 uppercase animate-pulse">
                            <Zap className="w-3 h-3 fill-emerald-500" />
                            {t.dev.live}
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-foreground tracking-tight">{t.dev.title}</h2>
                            <p className="text-sm text-muted-foreground">{t.dev.subtitle}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input 
                                type="text" 
                                placeholder={t.dev.search}
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 ring-amber-500/20"
                            />
                        </div>
                        <button onClick={fetchLogs} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors" title={t.dev.refresh}>
                            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                        </button>
                        <button onClick={clearLogs} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors" title={t.dev.clear}>
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors ml-2">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-border">
                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
                            {error}
                        </div>
                    )}
                    {filteredLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                            <Code2 className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-sm font-medium">{t.dev.noSql}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredLogs.map((log, index) => (
                                <div key={index} className="group p-4 rounded-xl bg-secondary/20 border border-border/50 hover:border-amber-500/30 transition-all">
                                    <div className="flex items-center justify-between mb-3 text-xs font-mono">
                                        <div className="flex items-center gap-4">
                                            <span className={cn(
                                                "px-2 py-0.5 rounded-md",
                                                log.category === 'statement' ? "bg-blue-500/10 text-blue-400" : 
                                                log.category === 'system' ? "bg-emerald-500/10 text-emerald-400" :
                                                log.category === 'AI_QUERY' ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                                                "bg-purple-500/10 text-purple-400"
                                            )}>
                                                {log.category.replace('_', ' ').toUpperCase()}
                                            </span>
                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <Clock className="w-3.5 h-3.5" />
                                                <span className={cn(
                                                    log.executionTime > 500 ? "text-destructive font-bold" : 
                                                    log.executionTime > 200 ? "text-amber-500" : "text-emerald-500"
                                                )}>
                                                    {log.executionTime} ms
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-muted-foreground/60">
                                            {new Date(log.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <div className="relative">
                                        <pre className="p-4 rounded-lg bg-background/50 border border-border/50 font-mono text-[13px] text-foreground overflow-x-auto whitespace-pre-wrap">
                                            <code>{log.sql}</code>
                                        </pre>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

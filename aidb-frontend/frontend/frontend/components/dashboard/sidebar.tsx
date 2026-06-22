'use client'

import React, { useState, useEffect } from "react"
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { 
  History, ChevronLeft, ChevronRight, 
  Plug, BarChart3, BookOpen,
  Trash2, Code2, Terminal, LogOut, User, Database, Search,
  ShieldCheck, FlaskConical, Zap, HardDrive
} from 'lucide-react'
import type { QueryHistoryItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { DatabaseModal, type DatabaseMetadata } from './database-modal'
import { useI18n } from "@/lib/i18n-context"
import { Globe, Check } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface SidebarProps {
  queryHistory: QueryHistoryItem[]
  onSelectQuery: (item: QueryHistoryItem) => void 
  apiEndpoint: string
  onDatabaseConnect: (metadata: DatabaseMetadata | null) => void
  isDbConnected: boolean
  businessRules: string[]
  onBusinessRulesChange: (rules: string[]) => void
  onOpenAnalytics: () => void
  onOpenAdmin: () => void 
  onOpenDev: () => void
  onOpenStorage: () => void
  onLogoClick?: () => void
}

type TabType = 'history' | 'rules' | 'system'

export function Sidebar({ 
  queryHistory, 
  onSelectQuery, 
  apiEndpoint, 
  onDatabaseConnect, 
  isDbConnected,
  businessRules,
  onBusinessRulesChange,
  onOpenAnalytics,
  onOpenAdmin,
  onOpenDev,
  onOpenStorage,
  onLogoClick
}: SidebarProps) {
  const router = useRouter()
  const { t, language, setLanguage } = useI18n()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('history')
  const [isDbModalOpen, setIsDbModalOpen] = useState(false)
  
  const [userInfo, setUserInfo] = useState({ username: '', role: '' })

  useEffect(() => {
    // localStorage'dan verileri çekiyoruz
    const storedUsername = localStorage.getItem('username') || 'Kullanıcı'
    const storedRole = localStorage.getItem('role') || 'USER'
    
    setUserInfo({
      username: storedUsername,
      role: storedRole
    })
  }, [])

  // Admin kontrolü için yardımcı fonksiyon (Büyük/Küçük harf ve ROLE_ ön ekini kapsar)
  const isAdmin = userInfo.role.toLocaleUpperCase('tr-TR').includes('ADMIN')

  const [devQuestion, setDevQuestion] = useState('')
  const [devSql, setDevSql] = useState('')
  const [wizardQuestion, setWizardQuestion] = useState('')
  const [ruleLogic, setRuleLogic] = useState('')

  const handleLogout = () => {
    localStorage.clear()
    router.push('/login')
  }

  const handleClearHistory = async () => {
    const token = localStorage.getItem('token')
    if (window.confirm("Tüm sorgu geçmişini silmek istediğinize emin misiniz?")) {
      try {
        const response = await fetch(`${apiEndpoint}/api/v1/history`, { 
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) { window.location.reload(); }
      } catch (error) { console.error("[AIDB] Geçmiş silme hatası:", error); }
    }
  }

  return (
    <aside className={cn(
      'flex flex-col h-full bg-background border-r border-border transition-all duration-300 relative z-40',
      isCollapsed ? 'w-16' : 'w-80'
    )}>
      <div className="flex items-center justify-between p-5 h-16 shrink-0">
        <button onClick={() => onLogoClick?.() || window.location.reload()} className={cn("flex items-center gap-3 outline-none group", isCollapsed && "mx-auto")}>
          <div className="relative w-8 h-8 flex-shrink-0 opacity-90 group-hover:opacity-100 transition-opacity">
            <Image src="/logo.png" alt="AIDB Logo" fill className="object-contain" priority />
          </div>
          {!isCollapsed && <span className="font-semibold text-xl tracking-tight text-foreground">AIDB</span>}
        </button>
        {!isCollapsed ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-all group/lang border border-transparent hover:border-border/40 outline-none"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-tighter opacity-70 group-hover/lang:opacity-100">{language}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background/95 backdrop-blur-xl border-border/50 min-w-[120px]">
                <DropdownMenuItem onClick={() => setLanguage('tr')} className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-bold uppercase tracking-tight">Türkçe</span>
                  {language === 'tr' && <Check className="w-3.5 h-3.5 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLanguage('en')} className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-bold uppercase tracking-tight">English</span>
                  {language === 'en' && <Check className="w-3.5 h-3.5 text-primary" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button onClick={() => setIsCollapsed(true)} className="p-1 rounded-md text-muted-foreground hover:bg-secondary transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setIsCollapsed(false)} 
            className="absolute -right-3 top-20 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all z-50 border border-background"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isCollapsed && (
        <div className="flex flex-col items-center gap-4 pt-2 pb-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className="flex flex-col items-center gap-0.5 p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-all group/lang outline-none"
              >
                <Globe className="w-4 h-4" />
                <span className="text-[8px] font-black uppercase tracking-tighter opacity-50">{language}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="right" className="bg-background/95 backdrop-blur-xl border-border/50 min-w-[120px] ml-2">
              <DropdownMenuItem onClick={() => setLanguage('tr')} className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-bold uppercase tracking-tight">Türkçe</span>
                {language === 'tr' && <Check className="w-3.5 h-3.5 text-primary" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage('en')} className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-bold uppercase tracking-tight">English</span>
                {language === 'en' && <Check className="w-3.5 h-3.5 text-primary" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className="px-3 pb-4">
        <button onClick={() => setIsDbModalOpen(true)} className={cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-all text-sm group', isDbConnected ? 'bg-secondary/40 text-foreground' : 'bg-primary text-primary-foreground', isCollapsed && "justify-center")}>
          <Database className={cn('w-4 h-4', isDbConnected ? 'text-primary' : 'text-primary-foreground')} />
          {!isCollapsed && <span>{isDbConnected ? t.sidebar.connected : t.sidebar.connect}</span>}
        </button>
      </div>

      <nav className="flex flex-col gap-1 px-3">
        <NavItem semanticColor="primary" icon={History} label={t.sidebar.history} isActive={activeTab === 'history'} isCollapsed={isCollapsed} onClick={() => setActiveTab('history')} />
        <NavItem semanticColor="emerald" icon={ShieldCheck} label={t.sidebar.system} isActive={activeTab === 'system'} isCollapsed={isCollapsed} onClick={() => setActiveTab('system')} />
      </nav>

      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto px-4 py-4 mt-2 border-t border-border/50">
          {activeTab === 'history' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">{t.sidebar.history}</h3>
                <button onClick={handleClearHistory} className="text-muted-foreground hover:text-foreground p-1 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <div className="space-y-4">
                {queryHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">{t.sidebar.noHistory}</p>
                ) : (
                  queryHistory.map(item => (
                    <div key={item.id} className="group cursor-pointer" onClick={() => onSelectQuery(item)}>
                      <p className="text-sm font-medium text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">{item.userPrompt}</p>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{item.answer}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}


          {activeTab === 'system' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">Yönetim Araçları</h3>
              <div className="space-y-2">
                <button 
                  onClick={onOpenAnalytics}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-all group"
                >
                  <BarChart3 className="w-5 h-5" />
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-semibold">{t.sidebar.analytics}</span>
                    <span className="text-[10px] opacity-70">{t.sidebar.usage}</span>
                  </div>
                </button>

                <button 
                  onClick={onOpenDev}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500/20 transition-all group"
                >
                  <Terminal className="w-5 h-5" />
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-semibold">{t.sidebar.profiler}</span>
                    <span className="text-[10px] opacity-70">{t.sidebar.sqlMonitor}</span>
                  </div>
                </button>

                <button 
                  onClick={onOpenStorage}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-500 hover:bg-blue-500/20 transition-all group"
                >
                  <HardDrive className="w-5 h-5" />
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-semibold">Storage & Properties</span>
                    <span className="text-[10px] opacity-70">Manage Physical Files</span>
                  </div>
                </button>

                {isAdmin && (
                  <button 
                    onClick={onOpenAdmin}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 transition-all group"
                  >
                    <ShieldCheck className="w-5 h-5" />
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-semibold">{t.sidebar.admin}</span>
                      <span className="text-[10px] opacity-70">{t.sidebar.systemAdmin}</span>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alt Profil Kısmı - Güncellendi */}
      <div className={cn("mt-auto p-4 border-t border-border", isCollapsed && "p-2")}>
        <div className={cn("flex items-center gap-3 mb-4", isCollapsed && "justify-center")}>
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-sm font-bold shrink-0">
            {userInfo.username.charAt(0).toLocaleUpperCase('tr-TR')}
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate text-foreground leading-tight">{userInfo.username}</span>
              <span className="text-xs text-muted-foreground truncate">
                {isAdmin ? (language === 'tr' ? 'Yönetici' : 'Administrator') : (language === 'tr' ? 'Kullanıcı' : 'User')}
              </span>
            </div>
          )}
        </div>
        
        <button onClick={handleLogout} className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-destructive rounded-lg transition-all", isCollapsed && "justify-center")}>
          <LogOut className="w-4 h-4" />
          {!isCollapsed && <span>{t.sidebar.logout}</span>}
        </button>
      </div>

      <DatabaseModal isOpen={isDbModalOpen} onClose={() => setIsDbModalOpen(false)} apiEndpoint={apiEndpoint} onMetaFetch={onDatabaseConnect} />
    </aside>
  )
}

function NavItem({ icon: Icon, label, isActive, isCollapsed, onClick, badge, semanticColor = "primary" }: any) {
  const colorMap: Record<string, { bg: string, text: string, hoverText: string }> = {
    primary: { bg: 'bg-primary/10', text: 'text-primary', hoverText: 'group-hover:text-primary' },
    indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', hoverText: 'group-hover:text-indigo-400' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', hoverText: 'group-hover:text-purple-400' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-500', hoverText: 'group-hover:text-amber-500' },
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', hoverText: 'group-hover:text-cyan-400' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', hoverText: 'group-hover:text-emerald-500' },
  }
  const c = colorMap[semanticColor] || colorMap.primary
  return (
    <button onClick={onClick} className={cn('flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all group w-full', isActive ? cn('font-medium', c.bg, c.text) : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30', isCollapsed && 'justify-center')}>
      <Icon className={cn("w-4 h-4 shrink-0 transition-colors", isActive ? c.text : cn("text-muted-foreground", c.hoverText))} />
      {!isCollapsed && <span className="text-sm">{label}</span>}
      {badge !== undefined && !isCollapsed && <span className={cn("ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-full", c.bg, c.text)}>{badge}</span>}
    </button>
  )
}
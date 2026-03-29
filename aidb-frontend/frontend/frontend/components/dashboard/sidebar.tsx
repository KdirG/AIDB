'use client'

import React, { useState, useEffect } from "react"
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { 
  History, ChevronLeft, ChevronRight, 
  Plug, BarChart3, BookOpen,
  Trash2, Code2, Terminal, LogOut, User, Database, Search
} from 'lucide-react'
import type { QueryHistoryItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { DatabaseModal, type DatabaseMetadata } from './database-modal'

interface SidebarProps {
  queryHistory: QueryHistoryItem[]
  onSelectQuery: (item: QueryHistoryItem) => void 
  apiEndpoint: string
  onDatabaseConnect: (metadata: DatabaseMetadata | null) => void
  isDbConnected: boolean
  businessRules: string[]
  onBusinessRulesChange: (rules: string[]) => void
  onOpenAnalytics: () => void
  onLogoClick?: () => void
}

type TabType = 'history' | 'rules' | 'analytics' | 'dev'

export function Sidebar({ 
  queryHistory, 
  onSelectQuery, 
  apiEndpoint, 
  onDatabaseConnect, 
  isDbConnected,
  businessRules,
  onBusinessRulesChange,
  onOpenAnalytics,
  onLogoClick
}: SidebarProps) {
  const router = useRouter()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('history')
  const [isDbModalOpen, setIsDbModalOpen] = useState(false)
  
  const [userInfo, setUserInfo] = useState({ username: '', role: '' })

  useEffect(() => {
    setUserInfo({
      username: localStorage.getItem('username') || 'Kullanıcı',
      role: localStorage.getItem('role') || 'USER'
    })
  }, [])

  const [devQuestion, setDevQuestion] = useState('')
  const [devSql, setDevSql] = useState('')
  const [wizardQuestion, setWizardQuestion] = useState('')
  const [ruleName, setRuleName] = useState('')
  const [ruleLogic, setRuleLogic] = useState('')
  const [ruleAlias, setRuleAlias] = useState('')
  const [ruleThreshold, setRuleThreshold] = useState('')

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
        if (response.ok) {
           window.location.reload(); 
        }
      } catch (error) { console.error("[AIDB] Geçmiş silme hatası:", error); }
    }
  }

  const handleTrainSystem = async () => {
    if (!devQuestion || !devSql) return alert("Lütfen tüm alanları doldurun.");
    const token = localStorage.getItem('token')
    try {
      const response = await fetch(`${apiEndpoint}/train`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ question: devQuestion, sql: devSql }),
      });
      if (response.ok) { alert("Sorgu eğitildi!"); setDevQuestion(''); setDevSql(''); }
    } catch (error) { console.error(error); }
  }

  const handleWizardTrain = () => {
    if (!wizardQuestion || !ruleLogic) return alert("Soru ve Mantık zorunludur!");
    const generatedJson = {
      rule_name: ruleName || "Ozel_Kural",
      logic: ruleLogic.replace("{threshold}", ruleThreshold),
      alias: ruleAlias || "Sonuc",
      threshold: ruleThreshold ? Number(ruleThreshold) : null,
      trigger_question: wizardQuestion
    };
    const ruleString = JSON.stringify(generatedJson);
    onBusinessRulesChange([...businessRules, ruleString]);
    alert("İş kuralı listeye başarıyla eklendi!");
    setWizardQuestion(''); setRuleName(''); setRuleLogic(''); setRuleAlias(''); setRuleThreshold('');
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
        
        {!isCollapsed && (
          <button onClick={() => setIsCollapsed(true)} className="p-1 rounded-md text-muted-foreground hover:bg-secondary transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="px-3 pb-4">
        <button onClick={() => setIsDbModalOpen(true)} className={cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-all text-sm group outline-none focus-visible:ring-2 focus-visible:ring-primary', isDbConnected ? 'bg-secondary/40 text-foreground' : 'bg-primary text-primary-foreground', isCollapsed && "justify-center")}>
          <Database className={cn('w-4 h-4', isDbConnected ? 'text-primary' : 'text-primary-foreground')} />
          {!isCollapsed && <span>{isDbConnected ? 'Bağlantı Aktif' : 'Veritabanına Bağlan'}</span>}
        </button>
      </div>

      <nav className="flex flex-col gap-1 px-3">
        <NavItem semanticColor="primary" icon={History} label="Sorgu Geçmişi" isActive={activeTab === 'history'} isCollapsed={isCollapsed} onClick={() => setActiveTab('history')} />
        <NavItem semanticColor="indigo" icon={BookOpen} label="İş Kuralları" isActive={activeTab === 'rules'} isCollapsed={isCollapsed} onClick={() => setActiveTab('rules')} badge={businessRules.length > 0 ? businessRules.length : undefined} />
        <NavItem semanticColor="amber" icon={Terminal} label="Geliştirici" isActive={activeTab === 'dev'} isCollapsed={isCollapsed} onClick={() => setActiveTab('dev')} />
        <NavItem semanticColor="cyan" icon={BarChart3} label="Analitikler" isActive={activeTab === 'analytics'} isCollapsed={isCollapsed} onClick={() => { setActiveTab('analytics'); onOpenAnalytics(); }} />
      </nav>

      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto px-4 py-4 mt-2 border-t border-border/50">
          {activeTab === 'history' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-muted-foreground tracking-wide">BUGÜN</h3>
                <button onClick={handleClearHistory} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-4">
                {queryHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Henüz geçmiş yok.</p>
                ) : (
                  queryHistory.map(item => (
                    <div key={item.id} className="group cursor-pointer" onClick={() => onSelectQuery(item)}>
                      <p className="text-sm font-medium text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
                        {item.userPrompt || "Veritabanı Sorgusu"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1 truncate">
                        {item.answer}
                      </p>
                      <details className="mt-2" onClick={(e) => e.stopPropagation()}>
                        <summary className="list-none text-xs font-medium text-muted-foreground cursor-pointer flex items-center gap-1 hover:text-foreground transition-colors">
                          <Code2 className="w-3 h-3" /> SQL Gör
                        </summary>
                        <div className="mt-2 p-3 rounded-md bg-secondary/30 border border-border font-mono text-xs text-muted-foreground break-all leading-relaxed whitespace-pre-wrap">
                          {item.generatedSql}
                        </div>
                      </details>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          {activeTab === 'rules' && (
            <div className="space-y-5 animate-in fade-in duration-300">
               <div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">Kural Sihirbazı</h3>
                  <p className="text-xs text-muted-foreground mb-4">Sıkça sorulan formülasyonları ekleyin.</p>
               </div>
               <div className="space-y-3">
                 <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Soru Tetikleyici</label>
                    <input value={wizardQuestion} onChange={(e) => setWizardQuestion(e.target.value)} placeholder="Yüksek bakiyeli müşteriler kimler?" className="w-full px-3 py-2 text-sm rounded-md bg-secondary/30 border border-border outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground/60" />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">SQL Mantığı (Logic)</label>
                    <textarea value={ruleLogic} onChange={(e) => setRuleLogic(e.target.value)} placeholder="CASE WHEN bakiye > 10000 THEN 'Yüksek' ELSE 'Normal' END" className="w-full px-3 py-2 text-sm rounded-md bg-secondary/30 border border-border outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none min-h-[80px] font-mono placeholder:text-muted-foreground/50 transition-all" />
                 </div>
                 <button onClick={handleWizardTrain} className="w-full py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all">Sisteme Ekle</button>
               </div>
            </div>
          )}
          {activeTab === 'dev' && (
             <div className="space-y-5 animate-in fade-in duration-300">
               <div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">Model Eğitimi</h3>
                  <p className="text-xs text-muted-foreground mb-4">Yapay zekanın SQL doğruluğunu artırın.</p>
               </div>
               <div className="space-y-3">
                 <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Beklenen Soru</label>
                    <input value={devQuestion} onChange={(e) => setDevQuestion(e.target.value)} placeholder="Soru..." className="w-full px-3 py-2 text-sm rounded-md bg-secondary/30 border border-border outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground/60" />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Doğru SQL Çıktısı</label>
                    <textarea value={devSql} onChange={(e) => setDevSql(e.target.value)} placeholder="SELECT * FROM table..." className="w-full px-3 py-2 text-sm rounded-md bg-secondary/30 border border-border outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none min-h-[120px] font-mono placeholder:text-muted-foreground/50 transition-all" />
                 </div>
                 <button onClick={handleTrainSystem} className="w-full py-2 text-sm font-medium rounded-md bg-foreground text-background hover:bg-foreground/90 outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all">Eğitim Gönder</button>
               </div>
             </div>
          )}
        </div>
      )}

      <div className={cn("mt-auto p-4 border-t border-border", isCollapsed && "p-2")}>
        <div className={cn("flex items-center gap-3 mb-4", isCollapsed && "justify-center")}>
          <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center text-foreground text-sm font-medium shrink-0">
            {userInfo.username.charAt(0).toUpperCase()}
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate text-foreground leading-tight">{userInfo.username}</span>
              <span className="text-xs text-muted-foreground truncate">{userInfo.role.toLowerCase() === 'admin' ? 'Yönetici' : 'Kullanıcı'}</span>
            </div>
          )}
        </div>
        
        <button 
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg transition-all outline-none focus-visible:ring-2 focus-visible:ring-foreground",
            isCollapsed && "justify-center px-0 h-9"
          )}
          title={isCollapsed ? "Çıkış Yap" : undefined}
        >
          <LogOut className="w-4 h-4" />
          {!isCollapsed && <span>Oturumu Kapat</span>}
        </button>
      </div>

      {isCollapsed && (
        <button onClick={() => setIsCollapsed(false)} className="absolute -right-3.5 top-16 bg-background text-foreground border border-border rounded-full p-1 shadow-sm hover:scale-110 transition-transform z-50 flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}

      <DatabaseModal isOpen={isDbModalOpen} onClose={() => setIsDbModalOpen(false)} apiEndpoint={apiEndpoint} onMetaFetch={onDatabaseConnect} />
    </aside>
  )
}

function NavItem({ icon: Icon, label, isActive, isCollapsed, onClick, badge, semanticColor = "primary" }: any) {
  const colorMap: Record<string, { bg: string, text: string, hoverText: string }> = {
    primary: { bg: 'bg-primary/10', text: 'text-primary', hoverText: 'group-hover:text-primary' },
    indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', hoverText: 'group-hover:text-indigo-400' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-500', hoverText: 'group-hover:text-amber-500' },
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', hoverText: 'group-hover:text-cyan-400' },
  }
  
  const c = colorMap[semanticColor]

  return (
    <button onClick={onClick} className={cn('flex items-center gap-2.5 px-3 py-2 rounded-lg transition-transform duration-200 active:scale-[0.98] relative group w-full outline-none focus-visible:ring-2 focus-visible:ring-primary', isActive ? cn('font-medium', c.bg, c.text) : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30 font-medium', isCollapsed && 'justify-center')} title={isCollapsed ? label : undefined}>
      <Icon className={cn("w-4 h-4 flex-shrink-0 transition-colors duration-300", isActive ? c.text : cn("text-muted-foreground", c.hoverText))} />
      {!isCollapsed && <span className="text-sm">{label}</span>}
      {badge !== undefined && !isCollapsed && <span className={cn("ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-full flex items-center justify-center animate-in zoom-in", c.bg, c.text)}>{badge}</span>}
    </button>
  )
}
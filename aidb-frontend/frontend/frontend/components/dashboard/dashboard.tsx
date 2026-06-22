'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Sidebar } from './sidebar'
import { ChatInput } from './chat-input'
import { ChatMessageBubble } from './chat-message'
import { AnalyticsPanel } from './analytics-panel'
import { AdminPanel } from './admin-panel' 
import { DevPanel } from './dev-panel'
import { StoragePanel } from './storage-panel'
import { ResultCard } from './result-card'
import type { ChatMessage, QueryHistoryItem, MetricsData } from '@/lib/types'
import { useToast } from '@/components/ui/use-toast'
import { TrendingUp, Users, PackageSearch } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { cn } from '@/lib/utils'

const API_ENDPOINT = "http://localhost:8089";

export function Dashboard() {
  const router = useRouter()
  const { toast } = useToast()
  const { t, language } = useI18n()
  const [isMounted, setIsMounted] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const eventSourceRef = useRef<EventSource | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([])
  const [selectedQuery, setSelectedQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'quick' | 'smart'>('smart');
  
  // Aktif seçili veritabanı state'i
  const [activeDatabase, setActiveDatabase] = useState<{id: number | null, dbName: string, connectionUrl?: string} | null>(null);

  const [pendingApproval, setPendingApproval] = useState<{sql: string, id: string, data?: any[], answer?: string} | null>(null);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false)
  const [isAdminOpen, setIsAdminOpen] = useState(false) 
  const [isDevOpen, setIsDevOpen] = useState(false) 
  const [isStorageOpen, setIsStorageOpen] = useState(false)

  const [metrics, setMetrics] = useState<{ dbConnected: boolean }>({
    dbConnected: false,
  })
  const [analytics, setAnalytics] = useState({
    totalRowsScanned: 0,
    totalQueryTime: 0,
    queryCount: 0
  })
  
  const [businessRules, setBusinessRules] = useState<string[]>([]) 
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  const loadHistory = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    try {
      const response = await fetch(`${API_ENDPOINT}/api/v1/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setQueryHistory(data);
      } else if (response.status === 401) {
        router.push('/login')
      }
    } catch (err) {
      console.error("[AIDB] Geçmiş yükleme hatası:", err);
    }
  }, [router]);

  useEffect(() => {
    setIsMounted(true)
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
    } else {
      setIsAuthenticated(true)
      loadHistory()
      
      // Refresh atıldığında aktif veritabanı durumunu geri yükle
      const storedDbId = localStorage.getItem('aidb_active_db');
      const storedDbName = localStorage.getItem('aidb_active_db_name');
      const storedConnUrl = localStorage.getItem('aidb_active_db_url');
      if (storedDbName) {
        setActiveDatabase({ 
          id: storedDbId ? parseInt(storedDbId) : null, 
          dbName: storedDbName,
          connectionUrl: storedConnUrl || undefined
        });
        setMetrics(prev => ({ ...prev, dbConnected: true }));
      }
    }
  }, [router, loadHistory])

  const handleConfirmAction = async (action: 'confirm' | 'reject' | 'hold') => {
    if (!pendingApproval) return;

    if (action === 'hold') {
      toast({
        title: "İşlem Bekletiliyor",
        description: "Bu işlemi daha sonra 'Veri & Değişim Analizi' sekmesinden veya Geçmiş menüsünden onaylayabilirsiniz.",
      });
      return;
    }

    setIsLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      const endpoint = action === 'confirm' ? '/api/v1/query/confirm' : '/api/v1/query/reject';
      const bodyPayload: any = { requestId: pendingApproval.id };
      
      if (action === 'confirm') {
          bodyPayload.editedSql = pendingApproval.sql;
      }

      const response = await fetch(`${API_ENDPOINT}${endpoint}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(bodyPayload),
      });

      if (!response.ok) {
        throw new Error(`İşlem başarısız oldu: ${response.status}`);
      }

      const responseData = await response.json();
      
      toast({
        title: action === 'confirm' ? "İşlem Onaylandı" : "İşlem İptal Edildi",
        description: responseData.message || "Talebiniz başarıyla alındı.",
        className: "bg-emerald-500 border-emerald-600 text-white",
      });

      setPendingApproval(null);
    } catch (error) {
      console.error('İşlem hatası:', error);
      toast({
        title: "Hata",
        description: "İşlem sırasında bir sorun oluştu.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsLoading(false);
    setMessages(prev => prev.filter(m => !m.isLoading));
    toast({
      title: language === 'tr' ? "İşlem Durduruldu" : "Operation Stopped",
      description: language === 'tr' ? "Sorgu isteği kullanıcı tarafından iptal edildi." : "Query request cancelled by user.",
    });
  }, [language, toast]);

  const latestMessageWithData = useMemo(() => {
    const msgs = [...messages].reverse();
    return msgs.find(m => m.sql);
  }, [messages]);

  const handleSubmit = async (message: string) => {
    if (!message.trim()) return
    const token = localStorage.getItem('token')
    if (!token) { router.push('/login'); return; }

    let currentDbId = activeDatabase?.id;
    let currentDbName = activeDatabase?.dbName;
    
    if (!currentDbId) {
       const storedDb = localStorage.getItem('aidb_active_db');
       const storedDbName = localStorage.getItem('aidb_active_db_name');
       if (storedDb) {
           currentDbId = parseInt(storedDb);
           currentDbName = storedDbName || "UnknownDB";
       }
    }

    // ✨ Veritabanı seçili mi kontrolü ✨
    const hasDatabaseContext = activeDatabase !== null || !!currentDbId;
    
    if (!hasDatabaseContext && !message.startsWith('[SYSTEM_')) {
        toast({
            title: language === 'tr' ? "Veritabanı Seçilmedi" : "No Database Selected",
            description: language === 'tr' ? "Lütfen önce bir veritabanı seçin." : "Please select a database first.",
            variant: "destructive",
        });
        return;
    }

    const requestId = crypto.randomUUID();
    const startTime = performance.now();

    const userMessage: ChatMessage = { id: requestId, role: 'user', content: message, timestamp: new Date() }
    const loadingId = "loading-" + requestId;
    const loadingMessage: ChatMessage = { id: loadingId, role: 'assistant', content: '', timestamp: new Date(), isLoading: true }

    setMessages(prev => [...prev, userMessage, loadingMessage])
    setIsLoading(true)

    const eventSource = new EventSource(`${API_ENDPOINT}/api/sse/subscribe/${requestId}`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("query_result", (event: any) => {
      const resultData = JSON.parse(event.data);
      const endTime = performance.now();
      
      if (resultData.status === "AWAITING_APPROVAL") {
        const previewMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: resultData.answer || "Simülasyon hazır.",
          sql: resultData.generatedSql,
          data: resultData.resultData || [],
          executionTime: resultData.executionTime || Math.round(endTime - startTime),
          rowCount: resultData.resultData?.length || 0,
          timestamp: new Date(),
          isLoading: false,
          isAwaitingApproval: true
        };

        setMessages(prev => [...prev.filter(m => m.id !== loadingId), previewMessage]);

        setPendingApproval({ 
          sql: resultData.generatedSql, 
          id: requestId, 
          answer: t.dashboard.confirmDesc || "Lütfen yukarıdaki simülasyon sonucunu inceleyin ve onaylayın."
        });
        
        setIsLoading(false);
        return;
      }

      if (resultData.type === "EXECUTE_CONFIRMED") {
        const successBubble: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: resultData.answer || "İşlem başarıyla tamamlandı.",
          sql: resultData.generatedSql,
          data: resultData.resultData || [],
          executionTime: resultData.executionTime || Math.round(endTime - startTime),
          rowCount: resultData.resultData?.length || 0,
          timestamp: new Date(),
          isLoading: false
        };
        setMessages(prev => [...prev.filter(m => m.id !== loadingId), successBubble]);
        setIsLoading(false);
        setPendingApproval(null);
        loadHistory(); 
        eventSource.close();
        return;
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: resultData.errorMessage || resultData.answer || "İşlem tamamlandı.",
        sql: resultData.generatedSql,
        data: resultData.resultData || [],
        chart: resultData.chart,
        showChart: false,
        executionTime: resultData.executionTime || Math.round(endTime - startTime),
        rowCount: resultData.resultData?.length || 0,
        timestamp: new Date(),
        isLoading: false
      };

      setMessages(prev => [...prev.filter(m => m.id !== loadingId), assistantMessage]);
      setIsLoading(false);
      loadHistory();

      setMetrics(prev => ({
        ...prev,
        dbConnected: true,
      }));

      setAnalytics(prev => ({
        totalRowsScanned: prev.totalRowsScanned + (resultData.resultData?.length || 0),
        totalQueryTime: prev.totalQueryTime + (resultData.executionTime || Math.round(endTime - startTime)),
        queryCount: prev.queryCount + 1
      }));
      
      eventSource.close();
      eventSourceRef.current = null;
    });

    eventSource.onerror = () => {
      eventSource.close();
      eventSourceRef.current = null;
      setIsLoading(false);
      setMessages(prev => [
        ...prev.filter(m => m.id !== loadingId), 
        { id: "error-" + Date.now(), role: 'assistant', content: t.dashboard.errorProcessing, timestamp: new Date() }
      ]);
    };

    // ✨ ASIL KRİTİK İSTEK KISMI ✨
    try {
      const response = await fetch(`${API_ENDPOINT}/api/v1/query`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          requestId: requestId,
          rawPrompt: businessRules.length > 0 ? `${message} [Kurallar: ${businessRules.join(' | ')}]` : message,
          needsRefinement: mode === 'smart',
          targetDbName: currentDbName,
          dbId: currentDbId
        }),
      });

      // Yetki hatası kontrolü (403 Forbidden)
      if (response.status === 403) {
        const errJson = await response.json();
        eventSource.close();
        setIsLoading(false);
        setMessages(prev => [
            ...prev.filter(m => m.id !== loadingId),
            { id: "auth-err-" + Date.now(), role: 'assistant', content: `❌ ${errJson.error || "Bu veritabanına erişim yetkiniz yok!"}`, timestamp: new Date() }
        ]);
        return;
      }
    } catch (error) {
      eventSource.close();
      setIsLoading(false);
    }
  }

  const handleLogoClick = useCallback(() => { setMessages([]); setSelectedQuery(''); }, [])

  const handleSelectQuery = (item: QueryHistoryItem) => {
    const isPending = item.answer.startsWith("[PENDING]");
    const cleanAnswer = isPending ? item.answer.replace("[PENDING] ", "") : item.answer;

    // ✨ YENİ: Sistem mesajlarını chat kutusuna ve input'a yansıtma ✨
    const isSystemAction = item.userPrompt?.startsWith('[SYSTEM_') || 
                           item.userPrompt?.includes('(System Archive)') || 
                           item.userPrompt?.includes('(System Restore)');

    if (!isSystemAction) {
      const u: ChatMessage = { id: `user-${item.requestId}`, role: 'user', content: item.userPrompt, timestamp: new Date(item.createdAt) };
      const a: ChatMessage = { id: `assistant-${item.requestId}`, role: 'assistant', content: cleanAnswer, sql: item.generatedSql, chart: item.chartData, timestamp: new Date(item.createdAt), isLoading: false };
      setMessages([u, a]);
      setSelectedQuery(item.userPrompt);
    } else {
      setSelectedQuery('');
      setMessages([]);
    }

    if (isPending) {
      setPendingApproval({
        sql: item.generatedSql,
        id: item.requestId, // DB'den geri dönen asıl requestId
        answer: cleanAnswer
      });
    } else {
      setPendingApproval(null);
    }
  };

  if (!isMounted || !isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar
        queryHistory={queryHistory}
        onSelectQuery={handleSelectQuery}
        apiEndpoint={API_ENDPOINT}
        onDatabaseConnect={(meta) => {
            setMetrics(prev => ({ ...prev, dbConnected: meta !== null }));
            if(meta) {
              setActiveDatabase({id: meta.id, dbName: meta.dbName, connectionUrl: meta.connectionUrl || undefined});
              localStorage.setItem('aidb_active_db_name', meta.dbName);
              if (meta.id) {
                localStorage.setItem('aidb_active_db', meta.id.toString());
              } else {
                localStorage.removeItem('aidb_active_db');
              }
              if (meta.connectionUrl) {
                localStorage.setItem('aidb_active_db_url', meta.connectionUrl);
              } else {
                localStorage.removeItem('aidb_active_db_url');
              }
            } else {
              setActiveDatabase(null);
              localStorage.removeItem('aidb_active_db');
              localStorage.removeItem('aidb_active_db_name');
              localStorage.removeItem('aidb_active_db_url');
            }
        }}
        isDbConnected={metrics.dbConnected}
        businessRules={businessRules}
        onBusinessRulesChange={setBusinessRules}
        onOpenAnalytics={() => setIsAnalyticsOpen(true)}
        onOpenAdmin={() => setIsAdminOpen(true)} 
        onOpenDev={() => setIsDevOpen(true)}
        onOpenStorage={() => setIsStorageOpen(true)}
        onLogoClick={handleLogoClick}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-dot-pattern">
            <div className="max-w-4xl mx-auto p-6 space-y-6">
              {messages.length === 0 && !isLoading ? (
                <div className="flex flex-col items-center justify-center h-[70vh] text-center relative z-10 max-w-2xl mx-auto">
                  <div className="relative w-16 h-16 mb-6 animate-in fade-in zoom-in duration-700">
                    <div className="absolute inset-0 bg-primary/20 blur-[40px] rounded-full pointer-events-none" />
                    <Image src="/logo.png" alt="AIDB Logo" fill priority className="object-contain relative z-10" />
                  </div>
                  
                  <h1 className="text-3xl font-bold tracking-tight mb-2 animate-in fade-in slide-in-from-bottom-3 duration-700">
                    AIDB Intelligence
                  </h1>
                  
                  <p className="text-muted-foreground text-sm mb-10 animate-in fade-in duration-1000 delay-200">
                    {t.dashboard.subtitle}
                  </p>

                  <div className="flex flex-wrap justify-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-400">
                    {[
                      { label: t.dashboard.chips.sales, icon: TrendingUp, query: language === 'tr' ? 'Son 30 gündeki toplam satışları göster' : 'Show total sales in the last 30 days' },
                      { label: t.dashboard.chips.orders, icon: Users, query: language === 'tr' ? 'En çok sipariş veren 5 müşteriyi listele' : 'List top 5 customers with most orders' },
                      { label: t.dashboard.chips.stock, icon: PackageSearch, query: language === 'tr' ? 'Hangi kategorilerde stoklar kritik seviyede?' : 'Which categories have critical stock levels?' }
                    ].map((chip) => (
                      <button 
                        key={chip.label}
                        onClick={() => handleSubmit(chip.query)} 
                        className="flex items-center gap-2 px-4 py-2 bg-secondary/40 hover:bg-secondary/60 border border-border/50 rounded-full text-xs font-medium transition-all"
                      >
                        <chip.icon className="w-3.5 h-3.5 opacity-70" />
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map(message => (
                  <ChatMessageBubble 
                    key={message.id} 
                    message={message} 
                    onGenerateChart={() => {
                      setMessages(prev => prev.map(m => 
                        m.id === message.id ? { ...m, showChart: !m.showChart } : m
                      ))
                    }}
                    onRestoreAction={handleSubmit}
                  />
                ))
              )}


              {pendingApproval && (
                <div className="bg-card w-full rounded-2xl p-6 relative overflow-hidden ring-1 ring-destructive/20 border-l-4 border-l-destructive shadow-lg mt-6 mb-8 animate-in slide-in-from-bottom-2">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold tracking-tight text-destructive">{language === 'tr' ? 'Değişiklikleri Onaylıyor musunuz?' : 'Do you approve the changes?'}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{language === 'tr' ? 'Gerekirse SQL kodunu aşağıdan düzenleyebilir ve ardından onaylayabilirsiniz.' : 'You can edit the SQL code below if needed, and then approve it.'}</p>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => handleConfirmAction('reject')} className="px-6 py-2.5 rounded-xl bg-secondary text-foreground font-black uppercase tracking-widest text-[10px] hover:bg-secondary/80 transition-all active:scale-95">
                          {language === 'tr' ? 'İptal Et' : 'Cancel'}
                        </button>
                        <button onClick={() => handleConfirmAction('hold')} className="px-6 py-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 font-black uppercase tracking-widest text-[10px] hover:bg-indigo-500/30 transition-all active:scale-95 border border-indigo-500/30">
                          {language === 'tr' ? 'Beklet' : 'Hold'}
                        </button>
                        <button onClick={() => handleConfirmAction('confirm')} className="px-6 py-2.5 rounded-xl bg-destructive text-destructive-foreground font-black uppercase tracking-widest text-[10px] hover:bg-destructive/90 transition-all shadow-lg shadow-destructive/20 active:scale-95">
                          {language === 'tr' ? 'Onayla ve Uygula' : 'Approve & Apply'}
                        </button>
                      </div>
                    </div>
                    
                    {/* EDİTLENEBİLİR SQL ALANI */}
                    <textarea
                      className="w-full bg-secondary/40 p-4 rounded-xl border border-border font-mono text-[11px] text-emerald-400 opacity-90 resize-y min-h-[100px] outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all"
                      value={pendingApproval.sql}
                      onChange={(e) => setPendingApproval({...pendingApproval, sql: e.target.value})}
                      spellCheck={false}
                    />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
        </div>
        
        <ChatInput 
          onSubmit={handleSubmit} 
          onStop={handleStop}
          isLoading={isLoading} 
          mode={mode} 
          onModeChange={setMode} 
          initialValue={selectedQuery}
          activeDbName={activeDatabase?.dbName || ""}
        />
      </div>

      <AnalyticsPanel 
        isOpen={isAnalyticsOpen} 
        onClose={() => setIsAnalyticsOpen(false)} 
        queryHistory={queryHistory} 
        totalQueries={analytics.queryCount || queryHistory.length} 
        avgQueryTime={analytics.queryCount > 0 ? Math.round(analytics.totalQueryTime / analytics.queryCount) : 0}
        totalRowsScanned={analytics.totalRowsScanned}
      />

      <AdminPanel 
        isOpen={isAdminOpen} 
        onClose={() => setIsAdminOpen(false)} 
      />

      <DevPanel
        isOpen={isDevOpen}
        onClose={() => setIsDevOpen(false)}
        apiEndpoint={API_ENDPOINT}
      />

      <StoragePanel
        isOpen={isStorageOpen}
        onClose={() => setIsStorageOpen(false)}
        apiEndpoint={API_ENDPOINT}
        activeDbName={activeDatabase?.dbName || null}
        activeDbId={activeDatabase?.id || null}
        connectionUrl={activeDatabase?.connectionUrl || null}
      />
    </div>
  )
}
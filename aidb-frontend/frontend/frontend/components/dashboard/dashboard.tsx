'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Sidebar } from './sidebar'
import { MetricsBar } from './metrics-bar'
import { ChatInput } from './chat-input'
import { ChatMessageBubble } from './chat-message'
import { AnalyticsPanel } from './analytics-panel'
import type { ChatMessage, QueryHistoryItem, MetricsData } from '@/lib/types'
import { useToast } from '@/components/ui/use-toast'
import { TrendingUp, Users, PackageSearch } from 'lucide-react'

const API_ENDPOINT = 'http://localhost:8089'

export function Dashboard() {
  const router = useRouter()
  const { toast } = useToast()
  const [isMounted, setIsMounted] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([])
  const [selectedQuery, setSelectedQuery] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState<'quick' | 'smart'>('smart')
  
  // Onay bekleyen sorgu state'i
  const [pendingApproval, setPendingApproval] = useState<{sql: string, id: string} | null>(null);

  const [metrics, setMetrics] = useState<MetricsData>({
    dbConnected: false,
    queryTime: null,
    rowsScanned: 0,
  })
  
  const [businessRules, setBusinessRules] = useState<string[]>([]) 
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  useEffect(() => {
    setIsMounted(true)
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
    } else {
      setIsAuthenticated(true)
      loadHistory()
    }
  }, [router])

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

  // ✨ Onay/Red İşlemi Tetikleyici
  const handleConfirmAction = async (confirm: boolean) => {
    if (!confirm || !pendingApproval) {
      setPendingApproval(null);
      return;
    }

    const token = localStorage.getItem('token');
    setIsLoading(true); // İşlem başlarken loading'i açıyoruz

    try {
      // Bu istek Java üzerinden Redis'e EXECUTE_CONFIRMED fırlatır
      const response = await fetch(`${API_ENDPOINT}/api/v1/query/confirm`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ requestId: pendingApproval.id }),
      });

      if (!response.ok) {
        toast({
          title: "Yetki Hatası",
          description: "Bu işlemi sadece ADMIN onaylayabilir veya sistem hatası oluştu.",
          variant: "destructive",
        });
        setPendingApproval(null);
        setIsLoading(false);
      }
      // NOT: SUCCESS durumunu SSE Listener (handleSubmit içindeki) yakalayacak!
    } catch (err) {
      console.error("Onay gönderilemedi:", err);
      setIsLoading(false);
    }
  };

  const handleSubmit = async (message: string) => {
    if (!message.trim()) return
    const token = localStorage.getItem('token')
    if (!token) { router.push('/login'); return; }

    const requestId = crypto.randomUUID();
    const startTime = performance.now();

    const userMessage: ChatMessage = { id: requestId, role: 'user', content: message, timestamp: new Date() }
    const loadingId = "loading-" + requestId;
    const loadingMessage: ChatMessage = { id: loadingId, role: 'assistant', content: '', timestamp: new Date(), isLoading: true }

    setMessages(prev => [...prev, userMessage, loadingMessage])
    setIsLoading(true)

    const eventSource = new EventSource(`${API_ENDPOINT}/api/sse/subscribe/${requestId}`);

    eventSource.addEventListener("query_result", (event: any) => {
      const resultData = JSON.parse(event.data);
      const endTime = performance.now();
      
      // 1. DURUM: AWAITING_APPROVAL (Onay Kartını Göster)
      if (resultData.status === "AWAITING_APPROVAL") {
        setPendingApproval({ sql: resultData.generatedSql, id: requestId });
        setMessages(prev => prev.filter(m => m.id !== loadingId));
        setIsLoading(false);
        // ÖNEMLİ: Burada eventSource.close() ÇAĞRILMAMALIDIR! 
        // Eğer stream'i kapatırsak, Onaylandıktan sonra gelecek olan EXECUTE_CONFIRMED event'ini dinkeyemeyiz.
        return;
      }

      // ✨ 2. DURUM: EXECUTE_CONFIRMED (Onay sonrası gelen başarı mesajı)
      if (resultData.type === "EXECUTE_CONFIRMED") {
        const successBubble: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: resultData.answer || "İşlem başarıyla tamamlandı.",
          timestamp: new Date(),
          isLoading: false
        };

        setMessages(prev => [...prev.filter(m => m.id !== loadingId), successBubble]);
        setIsLoading(false); // Loading'i kapatır
        setPendingApproval(null); // Onay kartını kapatır
        loadHistory(); 
        eventSource.close();
        return;
      }

      // 3. DURUM: NORMAL QUERY (SELECT sorguları)
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: resultData.answer || "İşlem tamamlandı.",
        sql: resultData.generatedSql,
        data: resultData.resultData || [],
        chart: resultData.chart,
        showChart: false,
        timestamp: new Date(),
        isLoading: false
      };

      setMessages(prev => [...prev.filter(m => m.id !== loadingId), assistantMessage]);
      setIsLoading(false);
      loadHistory();

      setMetrics(prev => ({
        ...prev,
        queryTime: Math.round(endTime - startTime),
        rowsScanned: resultData.resultData?.length || 0,
      }));
      
      eventSource.close();
    });

    eventSource.onerror = () => {
      eventSource.close();
      setIsLoading(false);
      setMessages(prev => [
        ...prev.filter(m => m.id !== loadingId), 
        { id: "error-" + Date.now(), role: 'assistant', content: "Bağlantı koptu veya hata oluştu.", timestamp: new Date() }
      ]);
    };

    try {
      await fetch(`${API_ENDPOINT}/api/v1/query`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          requestId: requestId,
          rawPrompt: businessRules.length > 0 ? `${message} [Kurallar: ${businessRules.join(' | ')}]` : message,
          needsRefinement: mode === 'smart',
          targetDbType: "mssql"
        }),
      });
    } catch (error) {
      eventSource.close();
      setIsLoading(false);
    }
  }

  const handleLogoClick = useCallback(() => { setMessages([]); setSelectedQuery(''); }, [])

  const handleSelectQuery = (item: QueryHistoryItem) => {
    const u: ChatMessage = { id: "h-u-"+item.id, role: 'user', content: item.userPrompt, timestamp: new Date(item.createdAt) };
    const a: ChatMessage = { id: "h-a-"+item.id, role: 'assistant', content: item.answer, sql: item.generatedSql, chart: item.chartData, timestamp: new Date(item.createdAt), isLoading: false };
    setMessages([u, a]);
    setSelectedQuery(item.userPrompt);
  };

  if (!isMounted || !isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar
        queryHistory={queryHistory}
        onSelectQuery={handleSelectQuery}
        apiEndpoint={API_ENDPOINT}
        onDatabaseConnect={(meta) => setMetrics(prev => ({ ...prev, dbConnected: meta !== null }))}
        isDbConnected={metrics.dbConnected}
        businessRules={businessRules}
        onBusinessRulesChange={setBusinessRules}
        onOpenAnalytics={() => setIsAnalyticsOpen(true)}
        onLogoClick={handleLogoClick}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <MetricsBar metrics={metrics} />
        
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-4xl mx-auto p-6 space-y-6">
            {messages.length === 0 && !isLoading ? (
              <div className="flex flex-col items-center justify-center h-[70vh] text-center relative z-10">
                <div className="relative w-28 h-28 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]">
                  <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full pointer-events-none" />
                  <Image src="/logo.png" alt="AIDB Logo" fill priority className="object-contain drop-shadow-2xl relative z-10" />
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tighter mb-4 animate-in fade-in slide-in-from-bottom-3 duration-700 delay-100 ease-[cubic-bezier(0.22,1,0.36,1)] fill-mode-backwards">
                  <span className="bg-gradient-to-br from-emerald-300 via-primary to-cyan-500 bg-clip-text text-transparent">
                    Sorgulamaya Başlayın
                  </span>
                </h1>
                <p className="text-muted-foreground max-w-md text-[15px] sm:text-base leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-700 delay-200 ease-[cubic-bezier(0.22,1,0.36,1)] fill-mode-backwards">
                  Veritabanınızla bir insanla konuşur gibi iletişim kurun. Milyonlarca satır veriyi saniyeler içinde analiz edin.
                </p>

                {/* ✨ STARTER CHIPS (ONBOARDING) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl mt-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-backwards">
                  <button 
                    onClick={() => handleSubmit('Son 30 gündeki toplam satışları göster')}
                    className="flex items-center gap-3 p-4 bg-secondary/30 hover:bg-secondary/60 border border-border/50 rounded-xl cursor-pointer transition-all duration-300 hover:shadow-[0_0_15px_rgba(5,150,105,0.1)] hover:-translate-y-1 group active:scale-95 text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium leading-tight text-foreground/80 group-hover:text-foreground transition-colors">
                      Son 30 gündeki toplam satışları göster
                    </span>
                  </button>

                  <button 
                    onClick={() => handleSubmit('En çok sipariş veren 5 müşteriyi listele')}
                    className="flex items-center gap-3 p-4 bg-secondary/30 hover:bg-secondary/60 border border-border/50 rounded-xl cursor-pointer transition-all duration-300 hover:shadow-[0_0_15px_rgba(5,150,105,0.1)] hover:-translate-y-1 group active:scale-95 text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium leading-tight text-foreground/80 group-hover:text-foreground transition-colors">
                      En çok sipariş veren 5 müşteriyi listele
                    </span>
                  </button>

                  <button 
                    onClick={() => handleSubmit('Hangi kategorilerde stoklar kritik seviyede?')}
                    className="flex items-center gap-3 p-4 bg-secondary/30 hover:bg-secondary/60 border border-border/50 rounded-xl cursor-pointer transition-all duration-300 hover:shadow-[0_0_15px_rgba(5,150,105,0.1)] hover:-translate-y-1 group active:scale-95 text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                      <PackageSearch className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium leading-tight text-foreground/80 group-hover:text-foreground transition-colors">
                      Hangi kategorilerde stoklar kritik seviyede?
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              messages.map(message => (
                <ChatMessageBubble 
                  key={message.id} 
                  message={message} 
                  onGenerateChart={() => {}} 
                />
              ))
            )}

            {/* ✨ SENİN TASARLADIĞIN O ŞIK ONAY KARTI */}
            {pendingApproval && (
              <div className="bg-card w-full rounded-2xl p-6 md:p-8 my-6 relative overflow-hidden ring-1 ring-border shadow-lg animate-in fade-in slide-in-from-bottom-8 duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]">
                <div className="absolute top-0 right-0 w-64 h-64 bg-destructive/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                
                <div className="flex flex-col md:flex-row md:items-start gap-5 relative">
                  <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                    <span className="text-xl">⚠️</span>
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground tracking-tight">Kritik İşlem Onayı Gerekli</h3>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        Aşağıdaki işlem veritabanınızda kalıcı değişikliklere neden olabilir. Çalıştırmadan önce sorguyu dikkatlice inceleyin.
                      </p>
                    </div>

                    <div className="bg-secondary/40 p-4 rounded-xl border border-border">
                      <div className="flex items-center justify-between mb-2">
                         <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Yürütülecek Sql Sorgusu</span>
                      </div>
                      <div className="font-mono text-[13px] text-foreground/80 leading-relaxed max-h-[160px] overflow-y-auto whitespace-pre-wrap">
                        {pendingApproval.sql}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button 
                          onClick={() => handleConfirmAction(true)}
                          className="flex-1 sm:flex-none justify-center px-6 py-2.5 rounded-lg bg-destructive text-destructive-foreground font-medium text-sm hover:bg-destructive/90 transition-all outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          Sorguyu Çalıştır
                        </button>
                        <button 
                          onClick={() => handleConfirmAction(false)}
                          className="flex-1 sm:flex-none justify-center px-6 py-2.5 rounded-lg bg-secondary text-foreground font-medium text-sm hover:bg-secondary/80 transition-all outline-none focus-visible:ring-2 focus-visible:ring-foreground"
                        >
                          İptal Et
                        </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
        
        <ChatInput onSubmit={handleSubmit} isLoading={isLoading} mode={mode} onModeChange={setMode} initialValue={selectedQuery} />
      </div>

      <AnalyticsPanel 
        isOpen={isAnalyticsOpen} 
        onClose={() => setIsAnalyticsOpen(false)} 
        queryHistory={queryHistory} 
        totalQueries={queryHistory.length} 
        avgQueryTime={metrics.queryTime} 
        totalRowsScanned={metrics.rowsScanned} 
      />
    </div>
  )
}
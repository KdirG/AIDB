/**
 * Chat üzerindeki her bir mesajın yapısı
 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isLoading?: boolean
  sql?: string
  data?: Record<string, unknown>[]
  // --- KRİTİK EKLENTİLER ---
  chart?: any           // Python'dan gelen Plotly JSON objesi/stringi
  chartCode?: string    // Yedek grafik kodu alanı
  isFailover?: boolean  // Smart -> Quick geçiş bilgisini taşır
  executionTime?: number // Sorgu çalışma süresi (ms)
  rowCount?: number      // Taranan/Dönen satır sayısı
  showChart?: boolean    // Grafik gösterim durumu
}

/**
 * Java Orchestrator'dan (SSE/API) gelen ham yanıt yapısı
 * Python Worker'daki final_response ile birebir eşleşir.
 */
export interface ApiResponse {
  requestId: string
  status: string
  type: string
  answer: string
  generatedSql: string
  resultData: Record<string, unknown>[]
  chart?: any  
  showChart?: boolean;
  isFailover: boolean
  errorMessage?: string
  executionTime?: number
}

/**
 * Sidebar üzerindeki geçmiş sorgu öğeleri
 */
export interface QueryHistoryItem {
  id: string
  requestId: string
  userPrompt: string
  answer: string
  generatedSql: string
  chartData?: any
  createdAt: string | Date
  executionTime?: number
  rowCount?: number
}

/**
 * Üst bardaki (MetricsBar) performans verileri
 */
export interface MetricsData {
  dbConnected: boolean
  queryTime: number | null
  rowsScanned: number
}
'use client'

import { useState } from 'react'
import { X, Database, CheckCircle2, XCircle, Loader2, RefreshCw, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DatabaseModalProps {
  isOpen: boolean
  onClose: () => void
  apiEndpoint: string 
  onMetaFetch: (metadata: any | null) => void
}

export interface DbCredentials {
  dbType: string
  serverName: string
  databaseName: string
  username: string
  password: string
}

const DB_TYPES = [
  { value: 'mssql', label: 'Microsoft SQL Server' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
]

export function DatabaseModal({ isOpen, onClose, apiEndpoint, onMetaFetch }: DatabaseModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  
  const [credentials, setCredentials] = useState<DbCredentials>({
    dbType: 'mssql',
    serverName: '',
    databaseName: '',
    username: '',
    password: '',
  })

  const handleInputChange = (field: keyof DbCredentials, value: string) => {
    setCredentials(prev => ({ ...prev, [field]: value }))
  }

  const fetchMetadata = async () => {
    const token = localStorage.getItem('token'); // Kapıyı açacak anahtar
    
    setIsLoading(true);
    setConnectionStatus('idle');
    setErrorMessage('İstek gönderiliyor...');

    try {
        const payload = {
            ...credentials,
            type: "CONNECT" 
        };

        const response = await fetch(`${apiEndpoint}/api/v1/connect`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}` // <--- KRİTİK EKLEME: 401 hatasını çözen satır
            },
            body: JSON.stringify(payload),
        });

        if (response.status === 401) {
          throw new Error("Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.");
        }

        if (!response.ok) throw new Error(`Sunucu hatası: ${response.status}`);
        
        const data = await response.json();

        if (data.requestId) {
            const realId = data.requestId;
            setErrorMessage('Veritabanı analiz ediliyor, lütfen bekleyin...');

            // SSE aboneliği (Burası auth gerektirmez çünkü bir Stream'dir, ama takip edeceğiz)
            const eventSource = new EventSource(`${apiEndpoint}/api/sse/subscribe/${realId}`);

            eventSource.addEventListener("query_result", (event: any) => {
                const result = JSON.parse(event.data);
                console.log("[AIDB] Bağlantı Sonucu:", result);

                if (result.status === "SUCCESS") {
                    setConnectionStatus('success');
                    setErrorMessage('Bağlantı başarılı! Tablolar yüklendi.');
                    onMetaFetch(result); 
                    
                    eventSource.close();
                    setIsLoading(false); 
                    
                    setTimeout(() => onClose(), 1500);
                } else {
                    setConnectionStatus('error');
                    setErrorMessage(result.errorMessage || 'Bağlantı reddedildi.');
                    eventSource.close();
                    setIsLoading(false);
                }
            });

            eventSource.onerror = () => {
                eventSource.close();
                setIsLoading(false);
                setConnectionStatus('error');
                setErrorMessage("Bağlantı zaman aşımına uğradı.");
            };

        } else {
            throw new Error("İşlem ID'si oluşturulamadı.");
        }

    } catch (error) {
        setIsLoading(false);
        setConnectionStatus('error');
        setErrorMessage(error instanceof Error ? error.message : "Sistemsel bir hata oluştu.");
    } 
  };

  const selectedDbType = DB_TYPES.find(db => db.value === credentials.dbType)
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-lg mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner shadow-primary/5">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Veritabanı Bağlantısı</h2>
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-bold opacity-70">Güvenli Bağlantı Aktif</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="relative">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Veritabanı Motoru</label>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-secondary/50 border border-border outline-none hover:border-primary/30 transition-all"
            >
              <span className="flex items-center gap-2 text-sm">
                <Database className="w-4 h-4 text-primary" /> {selectedDbType?.label}
              </span>
              <ChevronDown className={cn('w-4 h-4 transition-transform', isDropdownOpen && 'rotate-180')} />
            </button>
            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-2xl z-20 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                {DB_TYPES.map((db) => (
                  <button
                    key={db.value}
                    onClick={() => { handleInputChange('dbType', db.value); setIsDropdownOpen(false); }}
                    className="w-full px-4 py-3 text-left text-sm hover:bg-primary/10 hover:text-primary transition-colors border-b border-border/50 last:border-none"
                  >
                    {db.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Host / IP</label>
              <input
                className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all text-sm"
                value={credentials.serverName}
                onChange={(e) => handleInputChange('serverName', e.target.value)}
                placeholder="localhost"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Veritabanı Adı</label>
              <input
                className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all text-sm"
                value={credentials.databaseName}
                onChange={(e) => handleInputChange('databaseName', e.target.value)}
                placeholder="Musterisiparis"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Kullanıcı</label>
                <input
                  className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:border-primary/50 outline-none transition-all text-sm"
                  value={credentials.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Şifre</label>
                <input
                  type="password"
                  className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:border-primary/50 outline-none transition-all text-sm"
                  value={credentials.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>

          {connectionStatus !== 'idle' && (
            <div className={cn('p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2', 
              connectionStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500')}>
              {connectionStatus === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <XCircle className="w-5 h-5 flex-shrink-0" />}
              <span className="text-xs font-medium">{errorMessage}</span>
            </div>
          )}

          <button
            onClick={fetchMetadata}
            disabled={isLoading || !credentials.serverName || !credentials.databaseName}
            className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20 active:scale-[0.98]"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            {isLoading ? 'Sistem Analiz Ediliyor...' : 'Veritabanına Bağlan'}
          </button>
        </div>
      </div>
    </div>
  )
}
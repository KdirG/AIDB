'use client'

import { useState, useEffect } from 'react'
import { X, Database, CheckCircle2, XCircle, Loader2, RefreshCw, ChevronDown, Monitor, Key, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n-context'

export interface DatabaseMetadata {
  id: string | number | null
  dbName: string
}

interface DatabaseModalProps {
  isOpen: boolean
  onClose: () => void
  apiEndpoint: string 
  onMetaFetch: (metadata: any | null) => void
}

export function DatabaseModal({ isOpen, onClose, apiEndpoint, onMetaFetch }: DatabaseModalProps) {
  const { t, language } = useI18n()
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingDbs, setIsFetchingDbs] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  
  const [isAdmin, setIsAdmin] = useState(false)
  const [allowedDbs, setAllowedDbs] = useState<any[]>([])
  const [selectedDbId, setSelectedDbId] = useState<string>('')

  const [credentials, setCredentials] = useState({
    dbType: 'mssql', // varsayılan
    serverName: 'localhost',
    databaseName: '',
    username: '',
    password: ''
  })

  // Modal açıldığında kontrol et
  useEffect(() => {
    if (isOpen) {
      const storedRole = localStorage.getItem('role') || 'USER'
      const adminCheck = storedRole.toLocaleUpperCase('tr-TR').includes('ADMIN')
      setIsAdmin(adminCheck)

      if (!adminCheck) {
        // Standart kullanıcı ise izinli veritabanlarını yükle
        const loadDatabases = async () => {
          setIsFetchingDbs(true)
          setConnectionStatus('idle')
          setErrorMessage('')
          try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${apiEndpoint}/api/v1/databases/me`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
              const data = await response.json();
              setAllowedDbs(data);
              if (data.length > 0) {
                setSelectedDbId(data[0].id.toString());
              } else {
                setErrorMessage(language === 'tr' ? 'Size atanmış herhangi bir veritabanı bulunamadı. Lütfen yöneticiye başvurun.' : 'No databases assigned to you. Please contact administrator.');
              }
            } else if (response.status === 401) {
              setErrorMessage('Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
            } else {
              setErrorMessage('Veritabanları yüklenirken sunucu hatası oluştu.');
            }
          } catch (error) {
            setErrorMessage(language === 'tr' ? 'Sunucu ile bağlantı kurulamadı.' : 'Could not connect to server.');
          } finally {
            setIsFetchingDbs(false)
          }
        }
        loadDatabases();
      } else {
        setConnectionStatus('idle')
        setErrorMessage('')
      }
    } else {
      setConnectionStatus('idle')
      setErrorMessage('')
    }
  }, [isOpen, apiEndpoint])

  const fetchMetadata = async () => {
    if (!isAdmin && !selectedDbId) return;
    if (isAdmin && !credentials.databaseName) {
        setConnectionStatus('error')
        setErrorMessage('Lütfen veritabanı adını giriniz.')
        return
    }

    const token = localStorage.getItem('token'); 
    setIsLoading(true);
    setConnectionStatus('connecting');
    setErrorMessage('');

    try {
        const payload = isAdmin 
            ? { ...credentials, type: "CONNECT" }
            : { dbId: Number(selectedDbId), type: "CONNECT" };

        const response = await fetch(`${apiEndpoint}/api/v1/connect`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(payload),
        });

        if (response.status === 401) {
          throw new Error("Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.");
        }

        if (response.status === 403) {
          throw new Error("Bu veritabanına erişim yetkiniz yok.");
        }

        if (!response.ok) throw new Error(`Sunucu hatası: ${response.status}`);
        
        const data = await response.json();

        if (data.requestId) {
            const realId = data.requestId;
            setConnectionStatus('connecting');

            const eventSource = new EventSource(`${apiEndpoint}/api/sse/subscribe/${realId}`);

            eventSource.addEventListener("query_result", (event: any) => {
                const result = JSON.parse(event.data);
                console.log("[AIDB] Bağlantı Sonucu:", result);

                if (result.status === "SUCCESS") {
                    setConnectionStatus('success');
                    setErrorMessage(language === 'tr' ? 'Bağlantı başarılı! Veritabanı hazır.' : 'Connection successful! Database is ready.');
                    
                    if (isAdmin) {
                        // Admin manuel bağlantısında JDBC URL oluştur (Storage panel için)
                        let jdbcUrl = '';
                        if (credentials.dbType === 'mssql') {
                          if (credentials.username && credentials.username.trim()) {
                            // SQL Server Authentication
                            jdbcUrl = `jdbc:sqlserver://${credentials.serverName}:1433;databaseName=${credentials.databaseName};user=${credentials.username};password=${credentials.password};encrypt=true;trustServerCertificate=true;`;
                          } else {
                            // Windows Authentication (kullanıcı adı boş) — NTLM ile DLL'siz
                            jdbcUrl = `jdbc:sqlserver://${credentials.serverName}:1433;databaseName=${credentials.databaseName};integratedSecurity=true;authenticationScheme=NTLM;domain=${window.location.hostname === 'localhost' ? '' : window.location.hostname};encrypt=true;trustServerCertificate=true;`;
                          }
                        } else {
                          jdbcUrl = `jdbc:postgresql://${credentials.serverName}:5432/${credentials.databaseName}?user=${credentials.username}&password=${credentials.password}`;
                        }
                        onMetaFetch({ ...result, dbName: credentials.databaseName, id: null, dbType: credentials.dbType, connectionUrl: jdbcUrl }); 
                    } else {
                        const dbObj = allowedDbs.find(d => d.id.toString() === selectedDbId);
                        onMetaFetch({ ...result, dbName: dbObj?.dbName || 'DB', id: Number(selectedDbId) }); 
                    }
                    
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
                setErrorMessage("Bağlantı zaman aşımına uğradı veya SSE hatası.");
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner shadow-primary/5">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t.database.title}</h2>
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-bold opacity-70">
                  
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {isAdmin ? (
            // ADMIN MENU - MANUAL INPUTS
            <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t.database.type}</label>
                  <div className="relative">
                    <select
                      value={credentials.dbType}
                      onChange={(e) => setCredentials({ ...credentials, dbType: e.target.value })}
                      className="w-full appearance-none px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all text-sm font-medium cursor-pointer"
                    >
                      <option value="mssql" className="bg-background">Microsoft SQL Server</option>
                      <option value="postgresql" className="bg-background">PostgreSQL</option>
                      <option value="mysql" className="bg-background">MySQL</option>
                      <option value="oracle" className="bg-background">Oracle</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t.database.host}</label>
                  <div className="relative">
                    <Monitor className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="localhost"
                      value={credentials.serverName}
                      onChange={(e) => setCredentials({ ...credentials, serverName: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary/50 border border-border focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all text-sm font-medium placeholder:text-muted-foreground/50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t.database.target} <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Database className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Örn: MasterDB"
                      value={credentials.databaseName}
                      onChange={(e) => setCredentials({ ...credentials, databaseName: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary/50 border border-border focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all text-sm font-medium placeholder:text-muted-foreground/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t.database.username}</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="sa"
                        value={credentials.username}
                        onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary/50 border border-border focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all text-sm font-medium placeholder:text-muted-foreground/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t.database.password}</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={credentials.password}
                        onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary/50 border border-border focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all text-sm font-medium placeholder:text-muted-foreground/50"
                      />
                    </div>
                  </div>
                </div>
            </div>
          ) : (
            // USER MENU - DROPDOWN
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block">
                {t.database.placeholder}
              </label>
              
              {isFetchingDbs ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-primary opacity-50" />
                </div>
              ) : allowedDbs.length > 0 ? (
                <div className="relative">
                  <select
                    value={selectedDbId}
                    onChange={(e) => setSelectedDbId(e.target.value)}
                    className="w-full appearance-none px-4 py-4 rounded-xl bg-secondary/50 border border-border focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all text-sm font-medium cursor-pointer"
                  >
                    {allowedDbs.map((db) => (
                      <option key={db.id} value={db.id} className="bg-background">
                        {db.dbName} ({db.dbType.toLocaleUpperCase('tr-TR')})
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-secondary/30 text-sm text-center text-muted-foreground border border-border">
                  {t.database.noDb}
                </div>
              )}
            </div>
          )}

          {(connectionStatus !== 'idle' || errorMessage) && (
            <div className={cn('p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2', 
              connectionStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 
              connectionStatus === 'connecting' ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' :
              connectionStatus === 'error' || errorMessage ? 'bg-red-500/10 border-red-500/20 text-red-500' : 
              'bg-secondary/50 border-border text-foreground')}>
              {connectionStatus === 'success' && <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
              {connectionStatus === 'connecting' && <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" />}
              {(connectionStatus === 'error' || (errorMessage && connectionStatus === 'idle' && !isFetchingDbs)) && <XCircle className="w-5 h-5 flex-shrink-0 text-red-500" />}
              <span className="text-xs font-medium leading-relaxed">{connectionStatus === 'connecting' ? t.database.connecting : errorMessage}</span>
            </div>
          )}

          <button
            onClick={fetchMetadata}
            disabled={isLoading || (!isAdmin && (isFetchingDbs || !selectedDbId || allowedDbs.length === 0))}
            className="w-full mt-4 bg-primary text-primary-foreground py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20 active:scale-[0.98]"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            {isLoading ? t.common.loading : (isAdmin ? t.database.start : t.database.start)}
          </button>
        </div>
      </div>
    </div>
  )
}
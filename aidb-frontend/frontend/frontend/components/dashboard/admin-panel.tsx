'use client'
import { useState, useEffect } from 'react'
import { X, ShieldCheck, Database, Plus, CheckCircle2, AlertCircle, HardDrive, KeyRound, UserMinus, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n-context'

interface AdminPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function AdminPanel({ isOpen, onClose }: AdminPanelProps) {
  const { t } = useI18n()
  const [users, setUsers] = useState([])
  const [allDbs, setAllDbs] = useState([])
  const [newDb, setNewDb] = useState({ databaseName: '', connectionUrl: '', dbType: 'mssql', isSandbox: false })
  const [status, setStatus] = useState({ type: '', msg: '' })
  const [dbFields, setDbFields] = useState({
    host: 'localhost',
    port: '1433',
    dbName: '',
    username: '',
    password: ''
  })

  // Veritabanı tipi değişince portu otomatik güncelle
  useEffect(() => {
    if (newDb.dbType === 'mssql') setDbFields(f => ({...f, port: '1433'}))
    if (newDb.dbType === 'postgresql') setDbFields(f => ({...f, port: '5432'}))
  }, [newDb.dbType])

  const buildJdbcUrl = () => {
    if (newDb.dbType === 'mssql') {
      return `jdbc:sqlserver://${dbFields.host}:${dbFields.port};databaseName=${dbFields.dbName};user=${dbFields.username};password=${dbFields.password};encrypt=true;trustServerCertificate=true;`
    } else {
      return `jdbc:postgresql://${dbFields.host}:${dbFields.port}/${dbFields.dbName}?user=${dbFields.username}&password=${dbFields.password}`
    }
  }

  const handleAddDb = async () => {
    const finalDb = {
      ...newDb,
      connectionUrl: buildJdbcUrl()
    }
    const res = await fetchWithAuth('http://localhost:8089/api/admin/databases', { method: 'POST', body: JSON.stringify(finalDb) })
    if (res.ok) { 
      setStatus({type:'success', msg: t.admin.successMsg}); 
      loadData(); 
      setNewDb({ databaseName: '', connectionUrl: '', dbType: 'mssql', isSandbox: false });
      setDbFields({ host: 'localhost', port: '1433', dbName: '', username: '', password: '' });
    }
  }

  const fetchWithAuth = async (url: string, opts: any = {}) => {
    const token = localStorage.getItem('token')
    return fetch(url, { 
        ...opts, 
        headers: { 
            'Authorization': `Bearer ${token}`, 
            'Content-Type': 'application/json; charset=UTF-8',
            ...opts.headers 
        } 
    })
  }

  const loadData = async () => {
    try {
      const [u, d] = await Promise.all([
        fetchWithAuth('http://localhost:8089/api/admin/users'), 
        fetchWithAuth('http://localhost:8089/api/admin/databases')
      ])
      if (u.ok && d.ok) { 
        setUsers(await u.json()); 
        setAllDbs(await d.json()); 
      }
    } catch (err) {
      console.error("Veri yükleme hatası:", err);
    }
  }

  useEffect(() => { if (isOpen) loadData() }, [isOpen])

  const handleAssignDb = async (userId: number, dbId: string) => {
    if (!dbId) return
    const res = await fetchWithAuth(`http://localhost:8089/api/admin/users/${userId}/assign-db/${dbId}`, { method: 'POST' })
    if (res.ok) {
        setStatus({type: 'success', msg: t.admin.accessGranted});
        loadData();
    }
  }

  const handleRevokeDb = async (userId: number, dbId: string) => {
    const res = await fetchWithAuth(`http://localhost:8089/api/admin/users/${userId}/revoke-db/${dbId}`, { method: 'POST' })
    if (res.ok) {
        setStatus({type: 'success', msg: t.admin.accessRevoked});
        loadData();
    }
  }

  const handleDeleteDb = async (dbId: string) => {
    if (!confirm(t.admin.confirmDelete)) return;
    const res = await fetchWithAuth(`http://localhost:8089/api/admin/databases/${dbId}`, { method: 'DELETE' })
    if (res.ok) { 
        setStatus({type:'success', msg: t.admin.deletedMsg}); 
        loadData(); 
    }
  }

  const handleToggleModify = async (userId: number) => {
    const res = await fetchWithAuth(`http://localhost:8089/api/admin/users/${userId}/toggle-modify`, { method: 'POST' })
    if (res.ok) loadData();
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/90 backdrop-blur-xl text-foreground font-sans antialiased">
      <div className="relative w-full max-w-6xl max-h-[95vh] h-full bg-card border border-border/80 rounded-[2rem] overflow-hidden flex flex-col shadow-[0_0_80px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-12 duration-500 ease-out">
        
        <div className="relative overflow-hidden p-8 border-b border-border/60 bg-gradient-to-br from-card to-background flex justify-between items-center group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[100px] -z-10 group-hover:bg-primary/20 transition-colors duration-700"></div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary text-primary-foreground rounded-2xl shadow-lg outline outline-4 outline-primary/20">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight uppercase leading-tight">{t.admin.title}</h2>
              <p className="text-[11px] font-extrabold tracking-normal text-primary uppercase mt-1">{t.admin.activeModule}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center bg-secondary/50 hover:bg-destructive/10 text-muted-foreground hover:text-destructive border border-transparent hover:border-destructive/30 rounded-2xl transition-all group/close">
            <X className="w-6 h-6 group-hover/close:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 md:p-10 space-y-12 custom-scrollbar">
          
          {status.msg && (
            <div className={cn("p-4 rounded-xl border flex items-center gap-3 animate-in slide-in-from-top-4", status.type === 'success' ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-500" : "bg-primary/10 border-primary/40 text-primary")}>
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span className="text-xs font-bold uppercase tracking-widest">{status.msg}</span>
            </div>
          )}

          <section className="space-y-6">
             <div className="flex items-end gap-4 border-b border-border/80 pb-3">
               <h3 className="text-2xl font-black uppercase tracking-tight text-foreground/90">{t.admin.integration}</h3>
             </div>

             <div className="bg-gradient-to-r from-card to-secondary/30 p-8 rounded-[2rem] border border-border/50 shadow-lg relative overflow-hidden backdrop-blur-md space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t.admin.label}</label>
                    <div className="relative group">
                      <input placeholder="Örn: Muhasebe_DB" className="w-full bg-background/50 border-2 border-border/50 p-4 pl-12 rounded-2xl text-sm font-bold focus:border-primary outline-none transition-all" value={newDb.databaseName} onChange={e => setNewDb({...newDb, databaseName: e.target.value})} />
                      <HardDrive className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t.admin.tech}</label>
                    <select className="w-full h-[56px] bg-background/50 border-2 border-border/50 px-4 rounded-2xl text-sm font-bold focus:border-primary outline-none cursor-pointer" value={newDb.dbType} onChange={e => setNewDb({...newDb, dbType: e.target.value})}>
                        <option value="mssql">MSSQL (SQL Server)</option>
                        <option value="postgresql">PostgreSQL</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t.admin.target}</label>
                    <input placeholder="Örn: Chinook" className="w-full h-[56px] bg-background/50 border-2 border-border/50 px-4 rounded-2xl text-sm font-bold focus:border-primary outline-none" value={dbFields.dbName} onChange={e => setDbFields({...dbFields, dbName: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4 border-t border-border/40">
                  <div className="space-y-3 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t.admin.host}</label>
                    <input placeholder="localhost veya 192.168..." className="w-full h-[56px] bg-background/50 border-2 border-border/50 px-4 rounded-2xl text-sm font-bold focus:border-primary outline-none" value={dbFields.host} onChange={e => setDbFields({...dbFields, host: e.target.value})} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t.admin.port}</label>
                    <input placeholder="1433" className="w-full h-[56px] bg-background/50 border-2 border-border/50 px-4 rounded-2xl text-sm font-bold focus:border-primary outline-none" value={dbFields.port} onChange={e => setDbFields({...dbFields, port: e.target.value})} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t.admin.user}</label>
                    <input placeholder="sa veya postgres" className="w-full h-[56px] bg-background/50 border-2 border-border/50 px-4 rounded-2xl text-sm font-bold focus:border-primary outline-none" value={dbFields.username} onChange={e => setDbFields({...dbFields, username: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t.admin.pass}</label>
                    <input type="password" placeholder="••••••••" className="w-full h-[56px] bg-background/50 border-2 border-border/50 px-4 rounded-2xl text-sm font-bold focus:border-primary outline-none" value={dbFields.password} onChange={e => setDbFields({...dbFields, password: e.target.value})} />
                  </div>
                </div>

                <div className="flex items-end">
                    <button onClick={handleAddDb} className="w-full relative overflow-hidden bg-foreground text-background font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition-all active:scale-[0.98] group shadow-xl">
                      <span className="relative z-10 flex items-center justify-center gap-2"><Plus className="w-4 h-4"/> {t.admin.saveConfig}</span>
                    </button>
                </div>
             </div>

             <div className="pt-6">
               <div className="text-[10px] font-black uppercase text-primary mb-6 flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                 {t.admin.activeSources}
               </div>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                 {allDbs.length === 0 && <div className="col-span-full p-8 border-2 border-dashed border-border/50 rounded-3xl text-center text-sm font-bold text-muted-foreground uppercase opacity-50">{t.admin.noSources}</div>}
                 
                 {allDbs.map((db: any) => (
                    <div key={db.id} className="group relative bg-card border-2 p-5 rounded-3xl flex items-center justify-between gap-4 transition-all duration-300 hover:-translate-y-1 overflow-hidden z-10 border-border/40">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center transition-colors group-hover:text-primary">
                          <Database className="w-6 h-6" />
                        </div>
                         <div className="flex flex-col">
                           <span className="text-base font-black tracking-tight flex items-center gap-2">
                             {db.dbName}
                           </span>
                           <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-sm mt-1">{db.dbType}</span>
                         </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleDeleteDb(db.id)} className="w-10 h-10 flex items-center justify-center bg-background border-2 border-border/40 hover:border-destructive/50 hover:text-destructive rounded-xl transition-all">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                 ))}
               </div>
             </div>
          </section>

          <section className="space-y-6 pt-8 border-t-2 border-border/50">
            <div className="flex items-end gap-4 border-b border-border/80 pb-3">
               <h3 className="text-2xl font-black uppercase tracking-tight text-foreground/90">{t.admin.userAuth}</h3>
             </div>

            <div className="grid gap-6">
              {users.map((user: any) => (
                <div key={user.id} className="group bg-card border-2 border-border/50 hover:border-foreground/20 p-6 md:p-8 rounded-[2.5rem] flex flex-col xl:flex-row xl:items-center justify-between gap-8 transition-all shadow-sm">
                  
                  <div className="space-y-4 flex-1">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-foreground rounded-2xl flex items-center justify-center text-xl font-black shadow-[4px_4px_0_0_#10b981]">
                        <span className="text-background uppercase">{user.username.substring(0,2)}</span>
                      </div>
                      <div>
                        <div className="font-black text-2xl tracking-tight uppercase">{user.username}</div>
                        <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Sistem No: #00{user.id}</div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 items-center bg-background/50 p-3 rounded-2xl border border-border/40 inline-flex min-h-[56px] w-full max-w-2xl">
                      {user.allowedDatabases.length === 0 && <span className="text-xs font-bold text-muted-foreground/60 w-full text-center italic uppercase">Yetki Atanmamış</span>}
                      {user.allowedDatabases.map((db: any) => (
                        <div key={db.id} className="group/tag inline-flex items-center bg-secondary border border-border/60 hover:border-primary/40 text-foreground text-xs font-bold py-1.5 pl-3 pr-1.5 rounded-xl transition-colors">
                          <Database className="w-3.5 h-3.5 mr-2 text-primary" /> 
                          {db.dbName}
                          <button onClick={() => handleRevokeDb(user.id, db.id)} className="ml-2 w-6 h-6 flex items-center justify-center bg-background rounded-lg hover:bg-destructive hover:text-white transition-colors">
                             <UserMinus className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch xl:items-center gap-3 shrink-0">
                    <button onClick={() => handleToggleModify(user.id)} className={cn(
                        "relative flex items-center justify-between px-6 py-4 rounded-2xl border-2 transition-all active:scale-[0.98] min-w-[180px]",
                        user.canModify ? "bg-primary/10 border-primary text-primary" : "bg-secondary/40 border-border/40 text-muted-foreground"
                      )}
                    >
                      <div className="flex flex-col items-start text-left">
                        <span className="text-[10px] font-black tracking-widest uppercase opacity-70">Erişim</span>
                        <span className="text-sm font-black uppercase">{user.canModify ? 'Tam Yetki' : 'Okuma'}</span>
                      </div>
                      {user.canModify ? <ShieldAlert className="w-6 h-6 ml-4" /> : <ShieldCheck className="w-6 h-6 ml-4 opacity-50" />}
                    </button>

                    <div className="relative h-full">
                      <select 
                        className="w-full h-full min-h-[58px] appearance-none bg-background border-2 border-border/60 hover:border-foreground/30 px-6 pr-12 rounded-2xl text-xs font-black uppercase outline-none cursor-pointer"
                        onChange={(e) => handleAssignDb(user.id, e.target.value)}
                        value=""
                      >
                        <option value="" disabled>{t.admin.assignDb}</option>
                        {allDbs.map((db: any) => (
                          <option key={db.id} value={db.id}>
                            {db.dbName} ({db.dbType})
                          </option>
                        ))}
                      </select>
                      <Plus className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
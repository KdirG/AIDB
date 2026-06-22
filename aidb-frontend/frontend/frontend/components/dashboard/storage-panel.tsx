'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { X, HardDrive, Database, Settings2, Shield, RefreshCw, AlertTriangle, Scissors, Zap, ChevronRight } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { useI18n } from "@/lib/i18n-context"

interface StoragePanelProps {
  isOpen: boolean;
  onClose: () => void;
  apiEndpoint: string;
  activeDbName: string | null;
  activeDbId: number | null;
  connectionUrl: string | null;
}

interface FileMetrics {
  logicalName: string;
  physicalName: string;
  fileType: string;
  sizeMb: number;
  usedMb: number;
  usedPercentage: number;
  maxSize: string;
  growth: string;
}

interface StorageMetrics {
  databaseName: string;
  collation: string;
  files: FileMetrics[];
}

// Collation → localized label
function getCollationLabel(collation: string | null, isTr: boolean): string {
  if (!collation) return isTr ? 'Bilinmiyor' : 'Unknown';
  const lower = collation.toLowerCase();
  const parts: string[] = [];
  
  if (lower.includes('turkish')) parts.push(isTr ? 'Türkçe' : 'Turkish');
  else if (lower.includes('sql_latin')) parts.push(isTr ? 'SQL Latin' : 'SQL Latin');
  else if (lower.includes('latin')) parts.push(isTr ? 'Latin' : 'Latin');
  else parts.push(collation.split('_')[0]);
  
  if (lower.includes('_ci_')) parts.push(isTr ? 'Büyük/Küçük Harf Duyarsız' : 'Case Insensitive');
  else if (lower.includes('_cs_')) parts.push(isTr ? 'Büyük/Küçük Harf Duyarlı' : 'Case Sensitive');
  
  if (lower.includes('_as')) parts.push(isTr ? 'Aksan Duyarlı' : 'Accent Sensitive');
  else if (lower.includes('_ai')) parts.push(isTr ? 'Aksan Duyarsız' : 'Accent Insensitive');
  
  return parts.join(', ');
}

export function StoragePanel({ isOpen, onClose, apiEndpoint, activeDbName, activeDbId, connectionUrl }: StoragePanelProps) {
  const { toast } = useToast()
  const { t, language } = useI18n()
  const isTr = language === 'tr'
  
  const [metrics, setMetrics] = useState<StorageMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState<string | null>(null)
  const [isShrinking, setIsShrinking] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  // Optimize Modal state
  const [optimizeModal, setOptimizeModal] = useState<{
    isOpen: boolean;
    fileType: string;
    logicalName: string;
    currentGrowth: string;
    newGrowthMB: number;
  } | null>(null)

  // Shrink Confirm state
  const [shrinkConfirm, setShrinkConfirm] = useState<{
    isOpen: boolean;
    logicalName: string;
    currentSizeMb: number;
    usedMb: number;
    freeMb: number;
  } | null>(null)

  // Ortak query param builder
  const buildQueryParams = useCallback(() => {
    if (activeDbId) return `dbId=${activeDbId}`;
    if (connectionUrl) return `connectionUrl=${encodeURIComponent(connectionUrl)}&dbName=${encodeURIComponent(activeDbName!)}`;
    if (activeDbName) return `dbName=${encodeURIComponent(activeDbName)}`;
    return '';
  }, [activeDbId, activeDbName, connectionUrl]);

  const fetchMetrics = useCallback(async () => {
    if (!activeDbId && !activeDbName) {
      setErrorMsg(isTr ? 'Veritabanı bilgisi bulunamadı. Lütfen sol menüden bir veritabanı seçip bağlanın.' : 'Database info not found. Please select a database from the sidebar and connect.');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    setMetrics(null);
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${apiEndpoint}/api/v1/db-storage/metrics?${buildQueryParams()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Sunucu hatası: HTTP ${response.status}`);
      if (!data.files || data.files.length === 0) throw new Error('Veritabanı dosya bilgisi döndürülemedi.');
      setMetrics(data);
    } catch (error: any) {
      console.error("Storage fetch error:", error);
      setErrorMsg(error.message || (isTr ? "Bilinmeyen bir sunucu hatası oluştu." : "An unknown server error occurred."));
    } finally {
      setIsLoading(false);
    }
  }, [activeDbId, activeDbName, apiEndpoint, buildQueryParams, isTr]);

  useEffect(() => {
    if (isOpen && (activeDbId || activeDbName)) fetchMetrics();
    if (isOpen && !activeDbId && !activeDbName) {
      setErrorMsg(isTr ? 'Veritabanı bilgisi bulunamadı.' : 'Database information not found.');
    }
  }, [isOpen, activeDbId, activeDbName, fetchMetrics, isTr]);

  // ========== SHRINK LOG ==========
  const handleShrinkLog = async () => {
    if (!shrinkConfirm) return;
    setIsShrinking(true);
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${apiEndpoint}/api/v1/db-storage/shrink-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          dbId: activeDbId,
          dbName: activeDbName,
          connectionUrl: connectionUrl,
          logicalName: shrinkConfirm.logicalName,
          targetSizeMB: Math.max(shrinkConfirm.usedMb + 1, 1)
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Shrink başarısız.");
      toast({
        title: isTr ? "Başarılı" : "Success",
        description: isTr 
          ? `${shrinkConfirm.logicalName} başarıyla küçültüldü.` 
          : `${shrinkConfirm.logicalName} successfully shrunk.`,
        className: "bg-emerald-500 border-emerald-600 text-white",
      });
      setShrinkConfirm(null);
      fetchMetrics();
    } catch (error: any) {
      toast({ 
        title: isTr ? "Shrink Başarısız" : "Shrink Failed", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsShrinking(false);
    }
  };

  // ========== OPTIMIZE GROWTH ==========
  const handleOptimizeConfirm = async () => {
    if (!optimizeModal) return;
    setIsOptimizing(optimizeModal.fileType);
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${apiEndpoint}/api/v1/db-storage/optimize-growth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          dbId: activeDbId,
          dbName: activeDbName,
          connectionUrl: connectionUrl,
          fileType: optimizeModal.fileType === 'ROWS' ? 'ROWS' : 'LOG',
          logicalName: optimizeModal.logicalName,
          newGrowthSizeMB: optimizeModal.newGrowthMB
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Optimizasyon başarısız.");
      toast({
        title: isTr ? "Parametre Güncellendi" : "Parameter Updated",
        description: isTr 
          ? `FILEGROWTH ${optimizeModal.newGrowthMB} MB olarak ayarlandı.` 
          : `FILEGROWTH set to ${optimizeModal.newGrowthMB} MB.`,
        className: "bg-emerald-500 border-emerald-600 text-white",
      });
      setOptimizeModal(null);
      fetchMetrics();
    } catch (error: any) {
      toast({ 
        title: isTr ? "Optimizasyon Başarısız" : "Optimization Failed", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsOptimizing(null);
    }
  };

  if (!isOpen) return null;
  const noDb = !activeDbName && !activeDbId;

  // Localized dictionary references
  const s = t.storage;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm bg-background/80 animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-4xl rounded-2xl border border-border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 rounded-xl">
              <HardDrive className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">{s.title}</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {activeDbName 
                  ? <>{s.desc} — <strong className="text-primary">{activeDbName}</strong></>
                  : s.waiting}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {metrics && (
              <button onClick={fetchMetrics} className="p-2 rounded-xl text-muted-foreground hover:bg-secondary transition-colors" title={isTr ? "Yenile" : "Refresh"}>
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-xl text-muted-foreground hover:bg-secondary transition-colors"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-secondary/10">
          {noDb ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Database className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm">{s.noDb}</p>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <RefreshCw className="w-8 h-8 mb-4 animate-spin text-primary" />
              <p className="text-sm">{s.analyzing}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{s.queryingDb}</p>
            </div>
          ) : errorMsg ? (
            <div className="flex flex-col items-center justify-center h-48 text-center p-4">
              <div className="p-3 bg-destructive/10 rounded-full mb-3">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <p className="font-bold mb-1 text-destructive">{s.errorTitle}</p>
              <p className="text-sm text-muted-foreground max-w-md">{errorMsg}</p>
              <button onClick={fetchMetrics} className="mt-4 px-4 py-2 bg-secondary text-foreground text-xs font-semibold rounded-lg hover:bg-secondary/80 flex items-center gap-2 transition-colors">
                <RefreshCw className="w-3 h-3" /> {s.retry}
              </button>
            </div>
          ) : metrics ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
              
              {/* Dil Desteği & Karakter Seti */}
              <div className="flex items-center justify-between bg-card border border-border/50 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-emerald-500" />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{s.collationLabel}</p>
                    <p className="text-sm font-medium mt-0.5 text-foreground/80">{getCollationLabel(metrics.collation, isTr)}</p>
                  </div>
                </div>
                <div className="px-4 py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full text-sm font-bold shadow-inner">
                  {metrics.collation}
                </div>
              </div>

              {/* Grid: Files */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {metrics.files.map((file, idx) => {
                  const isData = file.fileType === 'ROWS';
                  const pct = file.sizeMb > 0 ? Math.round((file.usedMb / file.sizeMb) * 100) : 0;
                  const freeMb = file.sizeMb - file.usedMb;
                  
                  return (
                    <div key={idx} className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${isData ? 'from-blue-500/40 via-blue-500/20' : 'from-amber-500/40 via-amber-500/20'} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
                      
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                            {isData ? <Database className="w-4 h-4 text-blue-500" /> : <Settings2 className="w-4 h-4 text-amber-500" />}
                            {isData ? s.dataFile : s.logFile}
                          </h3>
                          <p className="text-xs text-muted-foreground font-mono mt-1 truncate max-w-[240px]" title={file.physicalName}>
                            {file.logicalName}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-black text-foreground">{file.sizeMb}</span>
                          <span className="text-xs text-muted-foreground font-semibold ml-1">MB</span>
                        </div>
                      </div>

                      {/* Kritik kullanım uyarısı */}
                      {pct >= 80 && (
                        <div className={`mb-4 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${pct >= 90 ? 'bg-destructive/10 text-destructive border border-destructive/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'}`}>
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          {pct >= 90 
                            ? s.critDesc.replace('{pct}', pct.toString())
                            : s.warnDesc.replace('{pct}', pct.toString())
                          }
                        </div>
                      )}

                      {/* Progress Bar */}
                      <div className="mb-4 bg-secondary/30 p-4 rounded-xl">
                        <div className="flex justify-between text-xs font-semibold mb-2">
                          <span className="text-muted-foreground">{s.diskUsage}</span>
                          <span className={`${pct > 85 ? 'text-destructive' : pct > 70 ? 'text-amber-500' : 'text-emerald-500'}`}>
                            %{pct} {isTr ? 'Dolu' : 'Full'}
                          </span>
                        </div>
                        <div className="w-full h-3 bg-secondary rounded-full overflow-hidden relative">
                          <div 
                            className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out ${pct > 85 ? 'bg-destructive' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-2 font-mono">
                          <span>{file.usedMb} MB {s.used}</span>
                          <span>{freeMb} MB {s.free}</span>
                        </div>
                      </div>

                      {/* Shrink butonu */}
                      {freeMb > 0 && (
                        <button
                          onClick={() => setShrinkConfirm({ isOpen: true, logicalName: file.logicalName, currentSizeMb: file.sizeMb, usedMb: file.usedMb, freeMb })}
                          className={`w-full mb-4 px-4 py-2.5 ${isData ? 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border-blue-500/30' : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border-amber-500/30'} border rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]`}
                        >
                          <Scissors className="w-4 h-4" />
                          {isData ? (isTr ? 'Veri' : 'Data') : 'Log'} {s.shrinkBtn} — {freeMb} {s.shrinkSuggest}
                        </button>
                      )}

                      {/* Autogrowth & Limit Card */}
                      <div className="bg-secondary/40 rounded-xl p-4 border border-border/30">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{s.growthSettings}</span>
                          <button 
                            onClick={() => setOptimizeModal({
                              isOpen: true,
                              fileType: file.fileType,
                              logicalName: file.logicalName,
                              currentGrowth: file.growth,
                              newGrowthMB: 128
                            })}
                            disabled={isOptimizing === file.fileType}
                            className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 active:scale-95"
                          >
                            {isOptimizing === file.fileType ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                            {s.optimizeBtn}
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1">FILEGROWTH</p>
                            <p className="font-mono text-sm font-semibold">{file.growth}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1">MAXSIZE</p>
                            <p className="font-mono text-sm font-semibold">
                              {file.maxSize === 'Unlimited' ? s.unlimited : file.maxSize}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Physical Path Info */}
              {metrics.files.length > 0 && (
                <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">{s.physicalPaths}</p>
                  <div className="space-y-2">
                    {metrics.files.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                        <span className={`w-2 h-2 rounded-full ${file.fileType === 'ROWS' ? 'bg-blue-500' : 'bg-amber-500'}`} />
                        <span className="font-semibold text-foreground/70">{file.logicalName}:</span>
                        <span className="truncate">{file.physicalName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* ========== SHRINK CONFIRM MODAL ========== */}
      {shrinkConfirm?.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm bg-black/40 animate-in fade-in duration-150">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-amber-500/10 rounded-xl">
                <Scissors className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold">{s.shrinkTitle}</h3>
                <p className="text-xs text-muted-foreground">{shrinkConfirm.logicalName}</p>
              </div>
            </div>

            <div className="bg-secondary/50 rounded-xl p-4 mb-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{s.shrinkCurrent}</span>
                <span className="font-mono font-bold">{shrinkConfirm.currentSizeMb} MB</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{s.shrinkUsed}</span>
                <span className="font-mono font-bold text-emerald-500">{shrinkConfirm.usedMb} MB</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{s.shrinkFree}</span>
                <span className="font-mono font-bold text-amber-500">{shrinkConfirm.freeMb} MB</span>
              </div>
              <hr className="border-border/50" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{s.shrinkTarget}</span>
                <span className="font-mono font-bold text-primary">{Math.max(shrinkConfirm.usedMb + 1, 1)} MB</span>
              </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 mb-5 text-xs text-amber-600">
              {s.shrinkWarning}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShrinkConfirm(null)} className="flex-1 px-4 py-2.5 bg-secondary text-foreground text-sm font-semibold rounded-xl hover:bg-secondary/80 transition-colors">
                {isTr ? 'İptal' : 'Cancel'}
              </button>
              <button 
                onClick={handleShrinkLog} 
                disabled={isShrinking}
                className="flex-1 px-4 py-2.5 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
              >
                {isShrinking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
                {isShrinking ? s.shrinkExecuting : s.shrinkConfirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== OPTIMIZE GROWTH MODAL ========== */}
      {optimizeModal?.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm bg-black/40 animate-in fade-in duration-150">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-primary/10 rounded-xl">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold">{s.optTitle}</h3>
                <p className="text-xs text-muted-foreground">{optimizeModal.logicalName} — {optimizeModal.fileType === 'ROWS' ? 'Data File' : 'Log File'}</p>
              </div>
            </div>

            <div className="bg-secondary/50 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-center flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase mb-1">{s.optCurrent}</p>
                  <p className="font-mono text-lg font-black text-muted-foreground">{optimizeModal.currentGrowth}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground/40 mx-2" />
                <div className="text-center flex-1">
                  <p className="text-[10px] text-primary uppercase mb-1 font-bold">{s.optSuggested}</p>
                  <p className="font-mono text-lg font-black text-primary">{optimizeModal.newGrowthMB} MB</p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">{s.optInputLabel}</label>
              <div className="flex gap-2">
                {[64, 128, 256, 512].map(val => (
                  <button
                    key={val}
                    onClick={() => setOptimizeModal(prev => prev ? {...prev, newGrowthMB: val} : null)}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                      optimizeModal.newGrowthMB === val 
                        ? 'bg-primary text-primary-foreground shadow-md' 
                        : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 mb-5 text-xs text-blue-600">
              {s.optWarning}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setOptimizeModal(null)} className="flex-1 px-4 py-2.5 bg-secondary text-foreground text-sm font-semibold rounded-xl hover:bg-secondary/80 transition-colors">
                {isTr ? 'İptal' : 'Cancel'}
              </button>
              <button 
                onClick={handleOptimizeConfirm} 
                disabled={isOptimizing !== null}
                className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                {isOptimizing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {isOptimizing ? s.optExecuting : s.optConfirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

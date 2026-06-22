'use client'

import React from 'react';
import { History, X, RotateCcw, ArrowRight } from 'lucide-react';

interface VersionRecord {
  [key: string]: any;
}

interface VersionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  historyData: VersionRecord[];
  onRestore: (version: VersionRecord) => void;
}

export function VersionPanel({ isOpen, onClose, historyData, onRestore }: VersionPanelProps) {
  if (!isOpen) return null;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "History";
    if (dateStr.includes("9999")) return "Current Record";
    return new Date(dateStr).toLocaleString("tr-TR");
  };

  return (
    <div className="fixed inset-0 z-[200] flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md h-full bg-background border-l border-border shadow-2xl flex flex-col slide-in-from-right-full">
        {/* Başlık Alanı */}
        <div className="flex items-center justify-between p-5 border-b border-border/50 bg-secondary/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Record History</h2>
              <p className="text-[10px] text-muted-foreground uppercase mt-0.5">Timeline & Diff Analysis</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary/80 text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Timeline (Zaman Çizelgesi) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {historyData.length === 0 && (
             <div className="text-center text-muted-foreground text-xs font-bold uppercase py-10 opacity-50">
               No history records found
             </div>
          )}
          {historyData.map((record, index) => {
            const isCurrent = record.SysEndTime ? record.SysEndTime.includes("9999") : record.SYSENDTIME ? record.SYSENDTIME.includes("9999") : false;
            const previousRecord = historyData[index + 1]; // Önceki durum (liste DESC geldiği için)

            // Dinamik olarak değişen alanları bul (Sistem kolonları hariç)
            const keysToCompare = Object.keys(record).filter(k => 
              !['SysStartTime', 'SysEndTime', 'SYSSTARTTIME', 'SYSENDTIME'].includes(k)
            );

            return (
              <div key={index} className="relative flex gap-4">
                {/* Sol Çizgi & Nokta */}
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full z-10 ${isCurrent ? 'bg-emerald-500 ring-4 ring-emerald-500/20' : 'bg-secondary border-2 border-border'}`} />
                  {index !== historyData.length - 1 && (
                    <div className="w-px h-full bg-border/50 -mt-1 -mb-1" />
                  )}
                </div>

                {/* İçerik Kartı */}
                <div className="flex-1 pb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      {formatDate(record.SysEndTime || record.SYSENDTIME)}
                    </span>
                    {!isCurrent && (
                      <button 
                        onClick={() => onRestore(record)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-amber-950 transition-all text-[10px] font-black uppercase"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Restore
                      </button>
                    )}
                  </div>

                  <div className={`p-4 rounded-xl border ${isCurrent ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-secondary/20 border-border/50'} shadow-sm space-y-3`}>
                    
                    {/* Veri Değişimleri (Diff) Gösterimi */}
                    <div className="flex flex-col gap-3">
                      {keysToCompare.map((key) => {
                        const currentVal = String(record[key] ?? 'NULL');
                        const oldVal = previousRecord ? String(previousRecord[key] ?? 'NULL') : null;
                        const hasChanged = previousRecord && currentVal !== oldVal;

                        return (
                          <div key={key} className="flex flex-col">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{key}</span>
                            {hasChanged ? (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-rose-400 line-through opacity-70 bg-rose-500/10 px-1.5 py-0.5 rounded font-bold tracking-tight">{oldVal}</span>
                                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded tracking-tight">{currentVal}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-foreground font-bold tracking-tight">{currentVal}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

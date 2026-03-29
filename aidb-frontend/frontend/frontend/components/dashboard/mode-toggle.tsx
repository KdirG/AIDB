'use client'

import { Zap, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModeToggleProps {
  mode: 'quick' | 'smart'
  onModeChange: (mode: 'quick' | 'smart') => void
}

export function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    // p-1'i p-0.5 yaparak dikeydeki yüksekliği azalttık
    <div className="flex items-center gap-0.5 p-0.5 bg-secondary/50 rounded-lg border border-border h-fit">
      {/* HIZLI MOD BUTONU */}
      <button
        type="button"
        onClick={() => onModeChange('quick')}
        className={cn(
          'flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium transition-all duration-300 active:scale-95 group',
          mode === 'quick'
            ? 'bg-primary text-primary-foreground shadow-[0_0_12px_rgba(16,185,129,0.4)] scale-[1.02]'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
        )}
      >
        <Zap className={cn("w-3.5 h-3.5 transition-transform duration-500 group-hover:rotate-12", mode === 'quick' && "animate-pulse drop-shadow-sm")} />
        <span className="text-[12px]">HIZLI</span>
      </button>

      {/* AKILLI MOD BUTONU */}
      <button
        type="button"
        onClick={() => onModeChange('smart')}
        className={cn(
          'flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium transition-all duration-300 active:scale-95 group',
          mode === 'smart'
            ? 'bg-primary text-primary-foreground shadow-[0_0_12px_rgba(16,185,129,0.4)] scale-[1.02]'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
        )}
      >
        <Sparkles className={cn("w-3.5 h-3.5 transition-transform duration-500 group-hover:rotate-12", mode === 'smart' && "animate-pulse drop-shadow-sm")} />
        <span className="text-[12px]">AKILLI</span>
      </button>
    </div>
  )
}
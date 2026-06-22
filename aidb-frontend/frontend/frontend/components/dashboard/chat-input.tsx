'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Database } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ModeToggle } from './mode-toggle'
import { useI18n } from '@/lib/i18n-context'

interface ChatInputProps {
  onSubmit: (message: string) => void
  onStop?: () => void // ✨ YENİ: Sorgu durdurma için eklendi
  isLoading: boolean
  mode: 'quick' | 'smart'
  onModeChange: (mode: 'quick' | 'smart') => void
  initialValue?: string
  activeDbName?: string 
}

export function ChatInput({
  onSubmit,
  onStop, // ✨ Prop olarak aldık
  isLoading,
  mode,
  onModeChange,
  initialValue,
  activeDbName,
}: ChatInputProps) {
  const { t } = useI18n()
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (initialValue) {
      setInput(initialValue)
      textareaRef.current?.focus()
    }
  }, [initialValue])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const raf = requestAnimationFrame(() => {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 300)}px`
    })

    return () => cancelAnimationFrame(raf)
  }, [input])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) {
      onStop?.()
      return
    }
    if (!input.trim()) return
    onSubmit(input.trim())
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="border-t border-border bg-background p-4 md:p-6 pb-8 shrink-0">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex flex-col gap-2">
        
        {activeDbName && (
          <div className="flex items-center gap-2 mb-1 px-1">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-bold text-primary animate-in fade-in slide-in-from-left-2">
              <Database className="w-3 h-3" />
              {t.chat.querying} <span className="text-foreground uppercase">{activeDbName}</span>
            </div>
          </div>
        )}

        <div className="relative flex items-end shadow-sm bg-secondary/20 rounded-xl border border-border transition-all duration-500 hover:shadow-md focus-within:border-primary focus-within:ring-1 focus-within:ring-primary focus-within:shadow-[0_8px_30px_rgb(5,150,105,0.12)] focus-within:-translate-y-1">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.chat.placeholder}
            
            disabled={isLoading || !activeDbName} 
            rows={1}
            autoFocus
            className="flex-1 max-h-[300px] min-h-[56px] w-full px-4 py-4 pr-32 text-[15px] bg-transparent resize-none outline-none placeholder:text-muted-foreground/70 disabled:opacity-50 !ring-0 !border-0 leading-relaxed"
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-2">
            <ModeToggle mode={mode} onModeChange={onModeChange} />
            <button
              type="submit"
              className={cn(
                "p-2 rounded-lg transition-all duration-300 active:scale-[0.85] hover:scale-[1.05] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-foreground group",
                isLoading 
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" 
                  : "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_16px_rgba(16,185,129,0.3)] disabled:bg-secondary disabled:text-muted-foreground disabled:cursor-not-allowed"
              )}
              disabled={(!input.trim() && !isLoading) || (!activeDbName && !isLoading)}
              aria-label={isLoading ? "Durdur" : "Gönder"}
            >
              {isLoading ? (
                <div className="relative flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin opacity-20" />
                  <div className="absolute w-2 h-2 bg-current rounded-sm" />
                </div>
              ) : (
                <Send className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span className="opacity-70">
            {activeDbName ? t.chat.naturalLanguage : t.chat.connRequired}
          </span>
          <span className="hidden sm:inline">
            <kbd className="px-1.5 py-0.5 rounded-md bg-secondary border border-border text-foreground font-mono text-[10px]">Enter</kbd> {t.chat.send}
          </span>
        </div>
      </form>
    </div>
  )
}
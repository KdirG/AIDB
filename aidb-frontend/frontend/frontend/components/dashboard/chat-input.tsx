'use client'

import React from 'react'
import { useState, useRef, useEffect } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { ModeToggle } from './mode-toggle'

interface ChatInputProps {
  onSubmit: (message: string) => void
  isLoading: boolean
  mode: 'quick' | 'smart'
  onModeChange: (mode: 'quick' | 'smart') => void
  initialValue?: string
}

export function ChatInput({
  onSubmit,
  isLoading,
  mode,
  onModeChange,
  initialValue,
}: ChatInputProps) {
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

    // Batch layout reads/writes to avoid thrashing
    const raf = requestAnimationFrame(() => {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 300)}px`
    })

    return () => cancelAnimationFrame(raf)
  }, [input])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
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
        <div className="relative flex items-end shadow-sm bg-secondary/20 rounded-xl border border-border transition-all duration-500 hover:shadow-md focus-within:border-primary focus-within:ring-1 focus-within:ring-primary focus-within:shadow-[0_8px_30px_rgb(5,150,105,0.12)] focus-within:-translate-y-1">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Verileriniz hakkında bir soru sorun... (örn. Son 30 gündeki satışlar)"
            disabled={isLoading}
            rows={1}
            autoFocus
            className="flex-1 max-h-[300px] min-h-[56px] w-full px-4 py-4 pr-32 text-[15px] bg-transparent resize-none outline-none placeholder:text-muted-foreground/70 disabled:opacity-50 !ring-0 !border-0 leading-relaxed"
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-2">
            <ModeToggle mode={mode} onModeChange={onModeChange} />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_16px_rgba(16,185,129,0.3)] disabled:bg-secondary disabled:text-muted-foreground disabled:shadow-none transition-all duration-300 active:scale-[0.85] hover:scale-[1.05] cursor-pointer disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-foreground group"
              aria-label="Sorguyu gönder"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span className="opacity-70">
            Doğal dilde sorun, sistem otomatik SQL üretip verileri analiz eder.
          </span>
          <span className="hidden sm:inline">
            <kbd className="px-1.5 py-0.5 rounded-md bg-secondary border border-border text-foreground font-mono text-[10px]">
              Enter
            </kbd>{' '}
            gönder, {' '}
            <kbd className="px-1.5 py-0.5 rounded-md bg-secondary border border-border text-foreground font-mono text-[10px]">
              Shift + Enter
            </kbd>{' '}
            alt satır
          </span>
        </div>
      </form>
    </div>
  )
}
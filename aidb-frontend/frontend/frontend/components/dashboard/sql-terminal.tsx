'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Copy, Check, Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SqlTerminalProps {
  sql: string
}

export function SqlTerminal({ sql }: SqlTerminalProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Temel SQL sözdizimi renklendirmesi
  const highlightSql = (code: string) => {
    const keywords = /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|IN|LIKE|AS|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TABLE|INDEX|WITH|UNION|ALL|DISTINCT|COUNT|SUM|AVG|MIN|MAX|CASE|WHEN|THEN|ELSE|END|NULL|IS|BETWEEN|EXISTS|TOP)\b/gi
    const strings = /('.*?')/g
    const numbers = /\b(\d+)\b/g
    const comments = /(--.*$)/gm
    
    return code
      .replace(keywords, '<span class="text-primary font-medium">$1</span>')
      .replace(strings, '<span class="text-amber-400">$1</span>')
      .replace(numbers, '<span class="text-sky-400">$1</span>')
      .replace(comments, '<span class="text-muted-foreground">$1</span>')
  }

  return (
    <div className="rounded-lg border border-border bg-secondary/30 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full px-4 py-2 text-sm hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          <Terminal className="w-4 h-4" />
          <span className="font-medium">SQL Sorgusu</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isExpanded ? 'max-h-96' : 'max-h-0'
        )}
      >
        <div className="relative">
          <pre className="p-4 text-sm font-mono overflow-x-auto bg-background/50 border-t border-border">
            <code
              dangerouslySetInnerHTML={{ __html: highlightSql(sql) }}
              className="text-foreground"
            />
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 p-1.5 rounded-md bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="SQL’i Kopyala"
          >
            {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}

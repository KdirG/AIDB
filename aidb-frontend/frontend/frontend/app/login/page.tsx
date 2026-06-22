'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Lock, User, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('http://localhost:8089/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (response.ok) {
        // Token ve kullanıcı bilgilerini sakla
        localStorage.setItem('token', data.token)
        localStorage.setItem('username', data.username)
        localStorage.setItem('role', data.role)
        
        // Dashboard'a yönlendir
        router.push('/')
      } else {
        setError(data.message || 'Giriş yapılamadı. Bilgilerinizi kontrol edin.')
      }
    } catch (err) {
      setError('Sunucuya bağlanılamadı. Backend kapalı olabilir.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden font-sans">
      {/* Arka plan parlaması (Radial Gradient) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md px-6 z-10 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="relative w-20 h-20 mb-6 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <Image src="/logo.png" alt="AIDB Logo" fill className="object-contain" priority />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground leading-tight">
            AI Assisted <span className="text-primary">Database Manager</span>
          </h1>
          <p className="text-secondary-foreground text-sm mt-2">Veritabanı asistanınıza giriş yapın</p>
        </div>

        <div className="bg-card/40 backdrop-blur-xl border border-glass-border p-8 rounded-2xl shadow-2xl space-y-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Kullanıcı Adı</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input 
                  type="text" 
                  placeholder="admin" 
                  className="pl-10 h-11 bg-input/20" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Şifre</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input 
                  type="password" 
                  placeholder="••••••••" 
                  className="pl-10 h-11 bg-input/20" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium animate-in slide-in-from-top-1">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-11 font-bold text-sm shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Giriş Yapılıyor...
                </div>
              ) : (
                "Sisteme Giriş Yap"
              )}
            </Button>
          </form>

          <div className="pt-4 border-t border-glass-border">
            <p className="text-center text-[10px] text-muted-foreground uppercase tracking-tighter">
              Kadir Göçer &copy; 2026 AIDB Projesi
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
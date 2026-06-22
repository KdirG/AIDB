'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { translations, Language, TranslationDict } from './translations'

interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: TranslationDict
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('tr')

  useEffect(() => {
    const savedLang = localStorage.getItem('language') as Language
    if (savedLang && (savedLang === 'tr' || savedLang === 'en')) {
      setLanguageState(savedLang)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('language', lang)
    // Update HTML lang for accessibility and CSS selectors
    document.documentElement.lang = lang
  }

  const value = {
    language,
    setLanguage,
    t: translations[language]
  }

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}

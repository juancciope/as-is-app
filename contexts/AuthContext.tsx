'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { auth, database } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ data: any; error: any }>
  signOut: () => Promise<void>
  // Conversation status management
  conversationStatuses: Record<string, 'pending' | 'replied'>
  updateConversationStatus: (contactId: string, status: 'pending' | 'replied') => Promise<void>
  loadConversationStatuses: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => ({ data: null, error: null }),
  signOut: async () => {},
  conversationStatuses: {},
  updateConversationStatus: async () => {},
  loadConversationStatuses: async () => {},
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [conversationStatuses, setConversationStatuses] = useState<Record<string, 'pending' | 'replied'>>({})
  const router = useRouter()

  // Load conversation statuses from database
  const loadConversationStatuses = async () => {
    if (!user) return

    try {
      const { data, error } = await database.loadConversationStatuses(user.id)
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        return
      }

      setConversationStatuses((data || {}) as Record<string, 'pending' | 'replied'>)
    } catch (error) {
      // Failed to load conversation statuses - will use default empty state
    }
  }

  // Update conversation status in database
  const updateConversationStatus = async (contactId: string, status: 'pending' | 'replied') => {
    if (!user) return

    const updated = { ...conversationStatuses, [contactId]: status }
    
    try {
      // Update local state immediately for responsive UI
      setConversationStatuses(updated)
      
      // Save to database
      const { error } = await database.saveConversationStatuses(user.id, updated)
      
      if (error) {
        // Revert local state on error
        setConversationStatuses(conversationStatuses)
        throw error
      }
    } catch (error) {
      throw error
    }
  }

  const signIn = async (email: string, password: string) => {
    const result = await auth.signIn(email, password)
    return result
  }

  const signOut = async () => {
    try {
      await auth.signOut()
      setUser(null)
      setSession(null)
      setConversationStatuses({})
      router.push('/login')
    } catch (error) {
      // Sign out failed - continue anyway for UX
      router.push('/login')
    }
  }

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const session = await auth.getCurrentSession()
        setSession(session)
        setUser(session?.user ?? null)
        
        if (session?.user) {
          // Load conversation statuses after user is set
          await loadConversationStatuses()
        }
      } catch (error) {
        // Failed to get initial session - will show login
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      
      if (event === 'SIGNED_IN' && session?.user) {
        // Load conversation statuses for the new user
        setTimeout(loadConversationStatuses, 100) // Small delay to ensure user state is set
      } else if (event === 'SIGNED_OUT') {
        setConversationStatuses({})
      }
      
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Load conversation statuses when user changes
  useEffect(() => {
    if (user && Object.keys(conversationStatuses).length === 0) {
      loadConversationStatuses()
    }
  }, [user])

  const value = {
    user,
    session,
    loading,
    signIn,
    signOut,
    conversationStatuses,
    updateConversationStatus,
    loadConversationStatuses,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
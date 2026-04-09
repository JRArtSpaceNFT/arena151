'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useArenaStore } from '@/lib/store'
import type { ChatMessage } from '@/lib/chat-types'
import { validateMessage } from '@/lib/profanityFilter'
import { CREATURES } from '@/lib/data/creatures'

// Profile modal component
function ProfileModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const currentUser = useArenaStore(s => s.currentTrainer)

  useEffect(() => {
    async function fetchProfile() {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar, wins, losses, rank, badges, favorite_creature_id')
        .eq('id', userId)
        .single()
      
      if (data) {
        setProfile({
          ...data,
          displayName: data.display_name
        })
      }
      setLoading(false)
    }
    fetchProfile()
  }, [userId])

  const handleMute = async () => {
    if (!currentUser) return
    await supabase
      .from('chat_mutes')
      .insert({ user_id: currentUser.id, muted_user_id: userId })
    
    onClose()
  }

  const handleReport = async () => {
    if (!currentUser) return
    const reason = window.prompt('Report reason:')
    if (!reason) return

    await supabase
      .from('chat_reports')
      .insert({
        reporter_id: currentUser.id,
        reported_user_id: userId,
        reason,
      })

    alert('Report submitted')
    onClose()
  }

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/80"
        onClick={onClose}
      >
        <div className="text-white">Loading...</div>
      </motion.div>
    )
  }

  if (!profile) return null

  const winRate = profile.wins + profile.losses > 0
    ? ((profile.wins / (profile.wins + profile.losses)) * 100).toFixed(1)
    : '0.0'

  const favCreature = profile.favorite_creature_id
    ? CREATURES.find(c => c.id === parseInt(profile.favorite_creature_id))
    : null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-md rounded-xl border-2 border-white/20 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-2xl text-white/60 transition hover:text-white"
        >
          ×
        </button>

        {/* Avatar + Name */}
        <div className="mb-6 flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-white/20">
            {profile.avatar?.startsWith('data:') || profile.avatar?.startsWith('/') ? (
              <img src={profile.avatar} alt="avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-slate-800 text-2xl">
                {profile.avatar || '😎'}
              </div>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">{profile.displayName || profile.username}</h2>
            <p className="text-sm text-white/50">@{profile.username}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-2">
            <span className="text-sm text-white/60">Rank</span>
            <span className="font-bold text-white">Level {profile.rank || 1}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-2">
            <span className="text-sm text-white/60">Record</span>
            <span className="font-mono font-bold text-white">
              <span className="text-green-400">{profile.wins}W</span>
              {' - '}
              <span className="text-red-400">{profile.losses}L</span>
              {' '}
              <span className="text-white/50">({winRate}%)</span>
            </span>
          </div>
          {favCreature && (
            <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-2">
              <span className="text-sm text-white/60">Favorite</span>
              <div className="flex items-center gap-2">
                <img
                  src={favCreature.spriteUrl}
                  alt={favCreature.name}
                  className="h-6 w-6"
                  style={{ imageRendering: 'pixelated' }}
                />
                <span className="font-bold text-white">{favCreature.name}</span>
              </div>
            </div>
          )}
          {profile.badges && profile.badges.length > 0 && (
            <div className="rounded-lg bg-white/5 px-4 py-2">
              <span className="mb-2 block text-sm text-white/60">Badges ({profile.badges.length})</span>
              <div className="flex flex-wrap gap-1">
                {profile.badges.map((badgeId: string) => (
                  <div key={badgeId} className="text-lg" title={badgeId}>
                    🏅
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleMute}
            className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-2 font-bold text-white transition hover:bg-white/10"
          >
            🔇 Mute
          </button>
          <button
            onClick={handleReport}
            className="flex-1 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 font-bold text-red-400 transition hover:bg-red-500/20"
          >
            ⚠️ Report
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// Main chat panel component
export default function GlobalChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [onlineCount, setOnlineCount] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [mutedUsers, setMutedUsers] = useState<Set<string>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastReadTimestamp = useRef<string | null>(null)
  const currentUser = useArenaStore(s => s.currentTrainer)

  // Fetch initial messages on mount (always, not just when chat opens)
  useEffect(() => {
    async function fetchMessages() {
      const { data } = await supabase
        .from('chat_messages')
        .select(`
          id,
          user_id,
          message,
          created_at
        `)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(100)

      if (data) {
        // Fetch user data separately for each message
        const messagesWithUsers = await Promise.all(
          data.map(async (msg) => {
            const { data: userData } = await supabase
              .from('profiles')
              .select('id, username, avatar')
              .eq('id', msg.user_id)
              .single()
            return { 
              ...msg, 
              user: userData ? {
                id: userData.id,
                username: userData.username,
                displayName: userData.username,
                avatar: userData.avatar,
                favorite_creature_id: null
              } : undefined 
            }
          })
        )
        setMessages(messagesWithUsers.reverse() as ChatMessage[])
        lastReadTimestamp.current = new Date().toISOString()
        setUnreadCount(0)
      }
    }

    fetchMessages()
  }, []) // Run once on mount

  // Reset unread count when chat opens
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0)
      lastReadTimestamp.current = new Date().toISOString()
    }
  }, [isOpen])

  // Subscribe to new messages (always active, not just when chat is open)
  useEffect(() => {
    if (!currentUser) return

    console.log('[GlobalChat] Setting up realtime subscription...')

    const channel = supabase
      .channel('arena-lobby-chat', {
        config: {
          broadcast: { self: true },
        },
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
      }, async (payload) => {
        console.log('[GlobalChat] New message received:', payload)
        
        // Fetch user data for the new message
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('id, username, avatar')
          .eq('id', payload.new.user_id)
          .single()

        if (userError) {
          console.error('[GlobalChat] Error fetching user data:', userError)
        }

        const newMessage: ChatMessage = {
          ...(payload.new as any),
          user: userData ? {
            id: userData.id,
            username: userData.username,
            displayName: userData.username, // Use username as displayName
            avatar: userData.avatar,
            favorite_creature_id: undefined
          } : undefined,
        } as ChatMessage

        console.log('[GlobalChat] Adding message to state:', newMessage.message)
        setMessages(prev => [...prev, newMessage])

        // Increment unread if panel closed
        if (!isOpen && payload.new.user_id !== currentUser?.id) {
          setUnreadCount(prev => prev + 1)
        }

        // Auto-scroll if near bottom and chat is open
        if (isOpen) {
          setTimeout(() => {
            if (messagesEndRef.current) {
              const container = messagesEndRef.current.parentElement
              if (container) {
                const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
                if (isNearBottom) {
                  messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
                }
              }
            }
          }, 100)
        }
      })
      .subscribe((status) => {
        console.log('[GlobalChat] Subscription status:', status)
      })

    return () => {
      console.log('[GlobalChat] Cleaning up subscription')
      supabase.removeChannel(channel)
    }
  }, [currentUser?.id, isOpen])

  // Heartbeat presence
  useEffect(() => {
    if (!currentUser) return

    async function sendHeartbeat() {
      if (!currentUser) return
      await supabase
        .from('chat_presence')
        .upsert({
          user_id: currentUser.id,
          last_heartbeat: new Date().toISOString(),
        })
    }

    sendHeartbeat()
    const interval = setInterval(sendHeartbeat, 30000) // Every 30s

    return () => clearInterval(interval)
  }, [currentUser])

  // Fetch online count
  useEffect(() => {
    if (!isOpen) return

    async function fetchOnlineCount() {
      const { data } = await supabase.rpc('get_online_count')
      if (data !== null) setOnlineCount(data)
    }

    fetchOnlineCount()
    const interval = setInterval(fetchOnlineCount, 10000) // Every 10s

    return () => clearInterval(interval)
  }, [isOpen])

  // Fetch muted users
  useEffect(() => {
    if (!currentUser) return

    async function fetchMutes() {
      if (!currentUser) return
      const { data } = await supabase
        .from('chat_mutes')
        .select('muted_user_id')
        .eq('user_id', currentUser.id)

      if (data) {
        setMutedUsers(new Set(data.map(m => m.muted_user_id)))
      }
    }

    fetchMutes()
  }, [currentUser])

  const handleSend = async () => {
    if (!currentUser || !inputText.trim()) return

    // Validate and filter message
    const validation = validateMessage(inputText)
    
    if (!validation.valid) {
      alert(validation.error)
      return
    }
    
    const filtered = validation.filtered!

    // Optimistic UI: show message immediately (with filtered content)
    const tempId = `temp-${Date.now()}`
    const optimisticMessage: ChatMessage = {
      id: tempId,
      user_id: currentUser.id,
      message: filtered,
      created_at: new Date().toISOString(),
      user: {
        id: currentUser.id,
        username: currentUser.username,
        displayName: currentUser.displayName,
        avatar: currentUser.avatar,
        favorite_creature_id: (currentUser as any).favoritePokemon?.toString() || undefined,
      }
    }

    setMessages(prev => [...prev, optimisticMessage])
    setInputText('')

    // Scroll to bottom immediately
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 50)

    // Send to server (with filtered content)
    const { error, data } = await supabase
      .from('chat_messages')
      .insert({
        user_id: currentUser.id,
        message: filtered,
      })
      .select()

    if (error) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempId))
      console.error('Chat send error:', error)
      if (error.message.includes('rate') || error.code === '23514') {
        alert('Slow down! You can only send 1 message every 3 seconds.')
      } else if (error.code === '42501') {
        alert('Chat is not set up yet. Database migration needs to be run.')
      } else {
        alert(`Failed to send message: ${error.message}`)
      }
      return
    }

    // Replace temp message with real one
    if (data && data[0]) {
      setMessages(prev => prev.map(m => m.id === tempId ? {
        ...data[0],
        user: optimisticMessage.user
      } : m))
    }
  }

  const filteredMessages = messages.filter(m => !mutedUsers.has(m.user_id))

  if (!currentUser) return null

  return (
    <>
      {/* Chat button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen)
          if (!isOpen) setUnreadCount(0)
        }}
        className="fixed right-6 top-6 z-[10000] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-yellow-500 to-yellow-600 text-2xl shadow-lg transition hover:scale-110 hover:shadow-yellow-500/50"
      >
        💬
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 z-[10000] flex h-screen w-96 flex-col border-l border-white/10 bg-gradient-to-b from-slate-900/95 to-slate-950/95 shadow-2xl backdrop-blur-sm"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 bg-black/40 px-4 py-3">
              <div>
                <h2 className="text-lg font-black text-white">Arena Lobby</h2>
                <p className="text-xs text-white/50">👤 {onlineCount} online</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-2xl text-white/60 transition hover:text-white"
              >
                ×
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {filteredMessages.map(msg => {
                const favCreature = msg.user?.favorite_creature_id
                  ? CREATURES.find(c => c.id === parseInt(msg.user!.favorite_creature_id!))
                  : null

                return (
                  <div key={msg.id} className="flex gap-3">
                    {/* Avatar */}
                    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full border border-white/20">
                      {msg.user?.avatar?.startsWith('data:') || msg.user?.avatar?.startsWith('/') ? (
                        <img src={msg.user.avatar} alt="avatar" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-slate-800 text-lg">
                          {msg.user?.avatar || '😎'}
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      {/* Username + creature icon */}
                      <div className="mb-1 flex items-center gap-2">
                        <button
                          onClick={() => setSelectedUserId(msg.user_id)}
                          className="font-bold text-white hover:underline"
                        >
                          {msg.user?.displayName || msg.user?.username || 'Unknown'}
                        </button>
                        {favCreature && (
                          <img
                            src={favCreature.spriteUrl}
                            alt={favCreature.name}
                            className="h-4 w-4"
                            style={{ imageRendering: 'pixelated' }}
                            title={favCreature.name}
                          />
                        )}
                        <span className="text-xs text-white/40">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Message */}
                      <p className="text-sm text-white/90">{msg.message}</p>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-white/10 bg-black/40 p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Say something..."
                  maxLength={200}
                  className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/40 outline-none transition focus:border-yellow-500 focus:bg-white/10"
                />
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim()}
                  className="rounded-lg bg-yellow-500 px-6 py-2 font-bold text-white transition hover:bg-yellow-600 disabled:opacity-50"
                >
                  Send
                </button>
              </div>
              <p className="mt-1 text-xs text-white/40">{inputText.length}/200</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile modal */}
      <AnimatePresence>
        {selectedUserId && (
          <ProfileModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
        )}
      </AnimatePresence>
    </>
  )
}

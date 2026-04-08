// Arena 151 Chat Types

export interface ChatMessage {
  id: string
  user_id: string
  message: string
  created_at: string
  user?: {
    id: string
    username: string
    avatar: string
    favorite_creature_id?: string
  }
}

export interface ChatUser {
  id: string
  username: string
  displayName: string
  avatar: string
  wins: number
  losses: number
  rank: number
  badges: string[]
  favorite_creature_id?: string
  current_streak?: number
}

export interface OnlineUser {
  user_id: string
  last_heartbeat: string
}

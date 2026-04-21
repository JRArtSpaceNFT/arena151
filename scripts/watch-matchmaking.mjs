#!/usr/bin/env node

/**
 * Real-time matchmaking diagnostics
 * 
 * Watches Postgres logs and database state to diagnose pairing issues.
 * Run in two browser windows to test matchmaking.
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

console.log('🔍 Matchmaking Diagnostics Tool')
console.log('═══════════════════════════════════════')
console.log('')

async function showCurrentState() {
  const { data: queueing } = await supabase
    .from('matches')
    .select('id, player_a_id, player_b_id, room_id, status, created_at')
    .eq('status', 'queueing')
    .eq('game_mode', 'paid_pvp')
    .gte('created_at', new Date(Date.now() - 10*60*1000).toISOString())
    .order('created_at', { ascending: false })
    
  const { data: matched } = await supabase
    .from('matches')
    .select('id, player_a_id, player_b_id, room_id, status, created_at, joined_at')
    .eq('status', 'matched')
    .eq('game_mode', 'paid_pvp')
    .gte('created_at', new Date(Date.now() - 10*60*1000).toISOString())
    .order('created_at', { ascending: false })
  
  console.clear()
  console.log('🔍 Matchmaking State (last 10 minutes)')
  console.log('═══════════════════════════════════════')
  console.log(`Updated: ${new Date().toLocaleTimeString()}\n`)
  
  console.log('📊 QUEUEING MATCHES:', queueing?.length || 0)
  if (queueing && queueing.length > 0) {
    queueing.forEach((m, i) => {
      const age = Math.round((Date.now() - new Date(m.created_at).getTime()) / 1000)
      console.log(`  ${i+1}. ${m.id.slice(0,8)} | room=${m.room_id} | age=${age}s`)
      console.log(`     A=${m.player_a_id.slice(0,8)} | B=${m.player_b_id || 'NULL'}`)
    })
    
    // Check for pairing failures
    const byRoom = {}
    queueing.forEach(m => {
      if (!byRoom[m.room_id]) byRoom[m.room_id] = []
      byRoom[m.room_id].push(m)
    })
    
    Object.entries(byRoom).forEach(([room, matches]) => {
      if (matches.length > 1) {
        console.log(`\n  ⚠️  PAIRING FAILURE in ${room}:`)
        console.log(`     ${matches.length} separate queueing matches!`)
        console.log(`     These users should be matched together.`)
        matches.forEach(m => {
          console.log(`     - Match ${m.id.slice(0,8)}: player_a=${m.player_a_id.slice(0,8)}`)
        })
      }
    })
  }
  
  console.log('\n✅ MATCHED (recently):', matched?.length || 0)
  if (matched && matched.length > 0) {
    matched.forEach((m, i) => {
      const joinTime = m.joined_at ? Math.round((new Date(m.joined_at) - new Date(m.created_at)) / 1000) : '?'
      console.log(`  ${i+1}. ${m.id.slice(0,8)} | room=${m.room_id} | joined in ${joinTime}s`)
      console.log(`     A=${m.player_a_id.slice(0,8)} | B=${m.player_b_id?.slice(0,8) || 'NULL'}`)
    })
  }
  
  console.log('\n═══════════════════════════════════════')
  console.log('Press Ctrl+C to exit')
}

// Watch for changes
let subscription
async function startWatching() {
  subscription = supabase
    .channel('matchmaking-watch')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'matches',
      },
      (payload) => {
        console.log(`\n🔔 Match ${payload.eventType}: ${payload.new?.id?.slice(0,8) || payload.old?.id?.slice(0,8)}`)
        console.log(`   Status: ${payload.new?.status || payload.old?.status}`)
        if (payload.new?.player_a_id && payload.new?.player_b_id) {
          console.log(`   🎯 PAIRING SUCCESS!`)
          console.log(`   A=${payload.new.player_a_id.slice(0,8)} | B=${payload.new.player_b_id.slice(0,8)}`)
        }
        setTimeout(showCurrentState, 500)
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Subscribed to real-time updates\n')
        showCurrentState()
      }
    })
}

// Refresh every 5 seconds
setInterval(showCurrentState, 5000)

startWatching()

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\n\nShutting down...')
  if (subscription) subscription.unsubscribe()
  process.exit(0)
})

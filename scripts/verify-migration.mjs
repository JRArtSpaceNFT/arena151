#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

console.log('🔍 Checking if migration was applied...\n')

// Check if the helper function exists
const { data: helperExists, error: helperError } = await supabase.rpc('check_user_active_matches', {
  p_user_id: '00000000-0000-0000-0000-000000000000',
  p_room_id: 'test-room'
})

if (helperError && helperError.message.includes('function check_user_active_matches')) {
  console.log('❌ Helper function NOT found')
  console.log('   Migration did not apply!')
  console.log('\nThe SQL might have failed silently.')
  console.log('Try running each part separately and check for errors.')
} else {
  console.log('✅ Helper function exists')
}

// Test the main function to see if it has new logging
console.log('\n🧪 Testing atomic function...\n')

const testUserId = '00000000-0000-0000-0000-000000000000'
const { data, error } = await supabase.rpc('atomic_join_or_create_paid_match_v2', {
  p_user_id: testUserId,
  p_room_id: 'test-room',
  p_entry_fee: 0.05
})

console.log('Response:', data)
console.log('Error:', error)

if (error) {
  console.log('\n⚠️  Function returned error (expected for test user)')
  console.log('   But the function IS callable, which is good.')
} else if (data) {
  console.log('\n✅ Function responded')
}

console.log('\n📋 Next: Check Postgres logs for [MM ...] entries')
console.log('   https://supabase.com/dashboard/project/abzurjxkxxtahdjrpvxk/logs/postgres-logs')
console.log('   Filter for "MM" to see matchmaking logs')

process.exit(0)

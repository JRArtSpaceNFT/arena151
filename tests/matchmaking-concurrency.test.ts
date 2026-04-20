/**
 * Arena 151 — Atomic Matchmaking Concurrency Test
 * 
 * Proves that two concurrent players entering paid matchmaking:
 * - Get placed into the SAME match
 * - One becomes player_a, the other becomes player_b
 * - Only ONE match is created total
 * 
 * Run with: npx ts-node tests/matchmaking-concurrency.test.ts
 * or: npm run test:matchmaking
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Test configuration
const TEST_ROOM_ID = 'bronze-tier'
const TEST_ENTRY_FEE = 0.05
const TEST_USER_1_ID = '00000000-0000-0000-0000-000000000001'
const TEST_USER_2_ID = '00000000-0000-0000-0000-000000000002'

interface MatchmakingResult {
  userId: string
  success: boolean
  matchId?: string
  role?: 'player_a' | 'player_b'
  status?: string
  createdNew?: boolean
  resumed?: boolean
  error?: string
  latencyMs: number
}

/**
 * Simulate a single user entering matchmaking
 */
async function simulateMatchmaking(userId: string): Promise<MatchmakingResult> {
  const startTime = Date.now()
  
  try {
    const { data, error } = await supabaseAdmin.rpc('atomic_join_or_create_paid_match', {
      p_user_id: userId,
      p_room_id: TEST_ROOM_ID,
      p_entry_fee: TEST_ENTRY_FEE,
      p_team_a: null,
    })

    const latencyMs = Date.now() - startTime

    if (error) {
      return { userId, success: false, error: error.message, latencyMs }
    }

    return {
      userId,
      success: data.success,
      matchId: data.matchId,
      role: data.role,
      status: data.status,
      createdNew: data.createdNew,
      resumed: data.resumed,
      error: data.error,
      latencyMs,
    }
  } catch (err: any) {
    return {
      userId,
      success: false,
      error: err.message,
      latencyMs: Date.now() - startTime,
    }
  }
}

/**
 * Setup: ensure test users exist with sufficient balance
 */
async function setupTestUsers() {
  console.log('📋 Setting up test users...')
  
  for (const userId of [TEST_USER_1_ID, TEST_USER_2_ID]) {
    // Check if user exists
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id, balance, locked_balance')
      .eq('id', userId)
      .maybeSingle()

    if (!existing) {
      // Create test user
      const { error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: userId,
          username: `test_user_${userId.slice(-4)}`,
          display_name: `Test User ${userId.slice(-4)}`,
          balance: 10.0,  // 10 SOL for testing
          locked_balance: 0,
          email: `test_${userId}@arena151.test`,
        })
      
      if (insertError) {
        console.error(`❌ Failed to create test user ${userId}:`, insertError.message)
        throw insertError
      }
      
      console.log(`✅ Created test user: ${userId}`)
    } else {
      // Ensure sufficient balance and no locked funds
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ balance: 10.0, locked_balance: 0 })
        .eq('id', userId)
      
      if (updateError) {
        console.error(`❌ Failed to update test user ${userId}:`, updateError.message)
        throw updateError
      }
      
      console.log(`✅ Reset test user: ${userId} (balance: 10 SOL, locked: 0)`)
    }
  }
}

/**
 * Cleanup: delete test matches and reset user balances
 */
async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...')
  
  // Delete test matches
  const { error: deleteMatchesError } = await supabaseAdmin
    .from('matches')
    .delete()
    .in('player_a_id', [TEST_USER_1_ID, TEST_USER_2_ID])
  
  if (deleteMatchesError) {
    console.warn('⚠️  Failed to delete test matches:', deleteMatchesError.message)
  }

  // Reset user balances
  for (const userId of [TEST_USER_1_ID, TEST_USER_2_ID]) {
    await supabaseAdmin
      .from('profiles')
      .update({ balance: 10.0, locked_balance: 0 })
      .eq('id', userId)
  }
  
  console.log('✅ Cleanup complete')
}

/**
 * Test 1: Two concurrent users should be placed in same match
 */
async function testTwoConcurrentUsers() {
  console.log('\n' + '='.repeat(60))
  console.log('TEST 1: Two concurrent users')
  console.log('='.repeat(60))

  // Fire both matchmaking requests simultaneously
  const [result1, result2] = await Promise.all([
    simulateMatchmaking(TEST_USER_1_ID),
    simulateMatchmaking(TEST_USER_2_ID),
  ])

  console.log('\n📊 Results:')
  console.log('User 1:', JSON.stringify(result1, null, 2))
  console.log('User 2:', JSON.stringify(result2, null, 2))

  // Assertions
  const assertions = []

  if (!result1.success || !result2.success) {
    assertions.push('❌ FAIL: One or both matchmaking calls failed')
  }

  if (result1.matchId !== result2.matchId) {
    assertions.push(`❌ FAIL: Users got different matches (${result1.matchId} vs ${result2.matchId})`)
  } else {
    assertions.push(`✅ PASS: Both users in same match (${result1.matchId})`)
  }

  if (result1.role === result2.role) {
    assertions.push(`❌ FAIL: Both users have same role (${result1.role})`)
  } else {
    assertions.push(`✅ PASS: Users have different roles (${result1.role} / ${result2.role})`)
  }

  const roles = new Set([result1.role, result2.role])
  if (!roles.has('player_a') || !roles.has('player_b')) {
    assertions.push(`❌ FAIL: Missing required roles (got: ${[...roles].join(', ')})`)
  } else {
    assertions.push('✅ PASS: Roles are player_a and player_b')
  }

  // Check that only ONE match was created
  const { data: matches, error: matchesError } = await supabaseAdmin
    .from('matches')
    .select('id, player_a_id, player_b_id, status')
    .in('player_a_id', [TEST_USER_1_ID, TEST_USER_2_ID])
    .order('created_at', { ascending: false })
    .limit(5)

  if (matchesError) {
    assertions.push(`❌ FAIL: Could not query matches: ${matchesError.message}`)
  } else {
    const recentMatches = matches?.filter(m => 
      (m.player_a_id === TEST_USER_1_ID || m.player_a_id === TEST_USER_2_ID) &&
      (m.player_b_id === TEST_USER_1_ID || m.player_b_id === TEST_USER_2_ID)
    ) || []
    
    if (recentMatches.length === 0) {
      assertions.push('❌ FAIL: No match found in database')
    } else if (recentMatches.length > 1) {
      assertions.push(`❌ FAIL: Multiple matches created (${recentMatches.length} found)`)
      console.log('Matches:', recentMatches)
    } else {
      assertions.push('✅ PASS: Only one match created')
    }
  }

  // Print summary
  console.log('\n📋 Assertions:')
  assertions.forEach(a => console.log(`  ${a}`))

  const passed = assertions.every(a => a.startsWith('✅'))
  console.log(`\n${passed ? '✅ TEST PASSED' : '❌ TEST FAILED'}`)
  
  return passed
}

/**
 * Test 2: Three concurrent users (2 should pair, 1 should wait)
 */
async function testThreeConcurrentUsers() {
  console.log('\n' + '='.repeat(60))
  console.log('TEST 2: Three concurrent users')
  console.log('='.repeat(60))

  const TEST_USER_3_ID = '00000000-0000-0000-0000-000000000003'

  // Setup third user
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', TEST_USER_3_ID)
    .maybeSingle()

  if (!existing) {
    await supabaseAdmin.from('profiles').insert({
      id: TEST_USER_3_ID,
      username: `test_user_${TEST_USER_3_ID.slice(-4)}`,
      display_name: `Test User ${TEST_USER_3_ID.slice(-4)}`,
      balance: 10.0,
      locked_balance: 0,
      email: `test_${TEST_USER_3_ID}@arena151.test`,
    })
  } else {
    await supabaseAdmin
      .from('profiles')
      .update({ balance: 10.0, locked_balance: 0 })
      .eq('id', TEST_USER_3_ID)
  }

  // Fire three matchmaking requests simultaneously
  const [result1, result2, result3] = await Promise.all([
    simulateMatchmaking(TEST_USER_1_ID),
    simulateMatchmaking(TEST_USER_2_ID),
    simulateMatchmaking(TEST_USER_3_ID),
  ])

  console.log('\n📊 Results:')
  console.log('User 1:', JSON.stringify(result1, null, 2))
  console.log('User 2:', JSON.stringify(result2, null, 2))
  console.log('User 3:', JSON.stringify(result3, null, 2))

  // Assertions
  const assertions = []

  if (!result1.success || !result2.success || !result3.success) {
    assertions.push('❌ FAIL: One or more matchmaking calls failed')
  }

  const matchIds = [result1.matchId, result2.matchId, result3.matchId]
  const uniqueMatches = new Set(matchIds)

  if (uniqueMatches.size !== 2) {
    assertions.push(`❌ FAIL: Expected 2 matches, got ${uniqueMatches.size}`)
  } else {
    assertions.push('✅ PASS: Two matches created (2 paired, 1 waiting)')
  }

  // Check which two users paired
  const pairedMatch = [...uniqueMatches].find(matchId => 
    matchIds.filter(id => id === matchId).length === 2
  )

  if (pairedMatch) {
    assertions.push(`✅ PASS: Two users paired in match ${pairedMatch}`)
  } else {
    assertions.push('❌ FAIL: Could not identify paired match')
  }

  // Print summary
  console.log('\n📋 Assertions:')
  assertions.forEach(a => console.log(`  ${a}`))

  const passed = assertions.every(a => a.startsWith('✅'))
  console.log(`\n${passed ? '✅ TEST PASSED' : '❌ TEST FAILED'}`)
  
  // Cleanup third user
  await supabaseAdmin.from('profiles').delete().eq('id', TEST_USER_3_ID)
  await supabaseAdmin.from('matches').delete().in('player_a_id', [TEST_USER_3_ID])
  
  return passed
}

/**
 * Main test runner
 */
async function main() {
  console.log('🎮 Arena 151 — Atomic Matchmaking Concurrency Test')
  console.log('='.repeat(60))

  try {
    // Setup
    await setupTestUsers()

    // Run tests
    const test1Passed = await testTwoConcurrentUsers()
    await cleanupTestData()
    
    const test2Passed = await testThreeConcurrentUsers()
    await cleanupTestData()

    // Final summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 TEST SUMMARY')
    console.log('='.repeat(60))
    console.log(`Test 1 (Two concurrent users): ${test1Passed ? '✅ PASSED' : '❌ FAILED'}`)
    console.log(`Test 2 (Three concurrent users): ${test2Passed ? '✅ PASSED' : '❌ FAILED'}`)
    console.log('='.repeat(60))

    const allPassed = test1Passed && test2Passed
    console.log(`\n${allPassed ? '🎉 ALL TESTS PASSED' : '⚠️  SOME TESTS FAILED'}`)

    process.exit(allPassed ? 0 : 1)

  } catch (err) {
    console.error('\n❌ TEST ERROR:', err)
    await cleanupTestData()
    process.exit(1)
  }
}

// Run tests
main()

#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkMatches() {
  console.log('Checking for queueing matches in last hour...\n');
  
  const { data, error } = await supabase
    .from('matches')
    .select('id, player_a_id, player_b_id, status, room_id, arena_id, created_at')
    .eq('status', 'queueing')
    .gte('created_at', new Date(Date.now() - 60*60*1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(20);
    
  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  if (!data || data.length === 0) {
    console.log('No queueing matches found in last hour.');
    return;
  }
  
  console.log(`Found ${data.length} queueing matches:\n`);
  data.forEach((match, i) => {
    console.log(`${i+1}. Match ${match.id.slice(0,8)}...`);
    console.log(`   Player A: ${match.player_a_id?.slice(0,8)}...`);
    console.log(`   Player B: ${match.player_b_id ? match.player_b_id.slice(0,8) + '...' : 'NULL'}`);
    console.log(`   Room: ${match.room_id}`);
    console.log(`   Arena: ${match.arena_id}`);
    console.log(`   Status: ${match.status}`);
    console.log(`   Created: ${match.created_at}\n`);
  });
  
  // Check for multiple queueing matches in same room
  const roomCounts = {};
  data.forEach(m => {
    if (!roomCounts[m.room_id]) roomCounts[m.room_id] = [];
    roomCounts[m.room_id].push(m);
  });
  
  console.log('\n=== ANALYSIS ===');
  Object.entries(roomCounts).forEach(([roomId, matches]) => {
    if (matches.length > 1) {
      console.log(`⚠️  ${roomId}: ${matches.length} separate queueing matches found!`);
      console.log(`   This indicates pairing failure - users should be matched together.`);
    }
  });
}

checkMatches().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

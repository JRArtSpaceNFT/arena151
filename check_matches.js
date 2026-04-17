const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkMatches() {
  const { data, error } = await supabase
    .from('matches')
    .select('id, player_a_id, player_b_id, status, room_id, created_at')
    .eq('status', 'forming')
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('\n=== FORMING MATCHES IN DATABASE ===');
  console.log('Count:', data.length);
  data.forEach(m => {
    console.log(`\nMatch: ${m.id}`);
    console.log(`  Room: ${m.room_id}`);
    console.log(`  P1: ${m.player_a_id}`);
    console.log(`  P2: ${m.player_b_id}`);
    console.log(`  Created: ${new Date(m.created_at).toLocaleString()}`);
  });
}

checkMatches().then(() => process.exit(0));

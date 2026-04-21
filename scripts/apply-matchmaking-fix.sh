#!/bin/bash

set -e

echo "═══════════════════════════════════════════════════════"
echo "  Applying Matchmaking Pairing Fix"
echo "═══════════════════════════════════════════════════════"
echo ""

cd "$(dirname "$0")/.."

# Check if .env.local exists
if [ ! -f .env.local ]; then
  echo "❌ Error: .env.local not found"
  echo "   Make sure you're in the arena151 directory"
  exit 1
fi

# Source environment
source .env.local

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "❌ Error: NEXT_PUBLIC_SUPABASE_URL not set in .env.local"
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "❌ Error: SUPABASE_SERVICE_KEY not set in .env.local"
  exit 1
fi

echo "📊 Current State Check"
echo "───────────────────────────────────────────────────────"
echo ""

# Create temporary check script
cat > /tmp/check-queueing.mjs << 'EOF'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const { data } = await supabase
  .from('matches')
  .select('id, player_a_id, player_b_id, room_id, status, created_at')
  .eq('status', 'queueing')
  .gte('created_at', new Date(Date.now() - 60*60*1000).toISOString())

console.log(`Found ${data?.length || 0} queueing matches in last hour`)

if (data && data.length > 0) {
  const byRoom = {}
  data.forEach(m => {
    if (!byRoom[m.room_id]) byRoom[m.room_id] = []
    byRoom[m.room_id].push(m)
  })
  
  Object.entries(byRoom).forEach(([room, matches]) => {
    console.log(`\n${room}: ${matches.length} queueing`)
    if (matches.length > 1) {
      console.log('  ⚠️  PAIRING FAILURE - multiple separate matches!')
    }
  })
}
EOF

node /tmp/check-queueing.mjs

echo ""
echo "📝 Applying Migration 026"
echo "───────────────────────────────────────────────────────"
echo ""

# Apply migration
psql "$DATABASE_URL" -f supabase/migrations/026_fix_atomic_pairing.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migration applied successfully!"
  echo ""
  echo "═══════════════════════════════════════════════════════"
  echo "  Next Steps"
  echo "═══════════════════════════════════════════════════════"
  echo ""
  echo "1. Start diagnostics monitor:"
  echo "   node scripts/watch-matchmaking.mjs"
  echo ""
  echo "2. Test with two browsers:"
  echo "   - Open two different browsers"
  echo "   - Sign in as different users"
  echo "   - Both select same room (e.g. Pewter City)"
  echo "   - Both click 'Find Match'"
  echo ""
  echo "3. Check diagnostics output:"
  echo "   - Should see 1 matched match, not 2 queueing matches"
  echo "   - Both browsers should show SAME matchId"
  echo "   - One player_a, one player_b"
  echo ""
  echo "4. Check browser consoles for [MATCH DEBUG] logs"
  echo ""
  echo "See docs/MATCHMAKING_FIX.md for detailed testing guide"
  echo ""
else
  echo ""
  echo "❌ Migration failed!"
  echo ""
  echo "Check the error above and try again."
  exit 1
fi

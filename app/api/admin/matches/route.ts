import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single();

  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'live';

    let query = supabase
      .from('matches')
      .select(`
        *,
        player_a:profiles!matches_player_a_fkey(username),
        player_b:profiles!matches_player_b_fkey(username)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (status === 'live') {
      query = query.in('status', ['ready', 'battling']);
    } else if (status === 'settlement_pending') {
      query = query.eq('status', 'settlement_pending');
    } else if (status === 'completed') {
      query = query.eq('status', 'completed');
    } else if (status === 'failed') {
      query = query.eq('status', 'settlement_failed');
    }

    const { data: matches, error } = await query;

    if (error) throw error;

    const enrichedMatches = (matches || []).map((m: any) => ({
      id: m.id,
      player_a_username: m.player_a?.username || 'Unknown',
      player_b_username: m.player_b?.username || 'Unknown',
      entry_fee: Number(m.entry_fee),
      platform_fee: Number(m.platform_fee),
      status: m.status,
      funds_locked: m.funds_locked || false,
      winner_id: m.winner_id,
      settlement_status: m.settlement_status,
      retry_count: m.retry_count || 0,
      created_at: m.created_at,
      battle_started_at: m.battle_started_at,
      settled_at: m.settled_at,
      error_message: m.error_message,
    }));

    return NextResponse.json({ matches: enrichedMatches });
  } catch (error) {
    console.error('Admin matches error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

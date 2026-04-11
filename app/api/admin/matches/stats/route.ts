import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET() {
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
    const { count: live } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .in('status', ['ready', 'battling']);

    const { count: forming } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'forming');

    const { count: awaitingSettlement } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'settlement_pending');

    const { count: failedSettlements } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'settlement_failed');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: totalToday } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    const { data: todayMatches } = await supabase
      .from('matches')
      .select('entry_fee')
      .gte('created_at', today.toISOString());

    const largestWager = todayMatches && todayMatches.length > 0
      ? Math.max(...todayMatches.map(m => Number(m.entry_fee)))
      : 0;

    return NextResponse.json({
      live: live || 0,
      forming: forming || 0,
      awaitingSettlement: awaitingSettlement || 0,
      failedSettlements: failedSettlements || 0,
      totalToday: totalToday || 0,
      largestWager,
    });
  } catch (error) {
    console.error('Match stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

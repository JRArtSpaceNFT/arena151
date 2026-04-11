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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // New signups today
    const { count: newSignups } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    // Active users today
    const { count: activeUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen', today.toISOString());

    // Deposits today
    const { data: deposits } = await supabase
      .from('deposits')
      .select('amount')
      .eq('status', 'completed')
      .gte('completed_at', today.toISOString());

    const depositsTotal = deposits?.reduce((sum, d) => sum + Number(d.amount), 0) || 0;

    // Withdrawals today
    const { data: withdrawals } = await supabase
      .from('withdrawals')
      .select('amount')
      .eq('status', 'completed')
      .gte('completed_at', today.toISOString());

    const withdrawalsTotal = withdrawals?.reduce((sum, w) => sum + Number(w.amount), 0) || 0;

    // Matches today
    const { count: matchesPlayed } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    // Platform revenue (fees from completed matches)
    const { data: completedMatches } = await supabase
      .from('matches')
      .select('platform_fee')
      .eq('status', 'completed')
      .gte('settled_at', today.toISOString());

    const revenue = completedMatches?.reduce((sum, m) => sum + Number(m.platform_fee), 0) || 0;

    // Action required items
    const { count: pendingWithdrawals } = await supabase
      .from('withdrawals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .eq('manual_review', true);

    const { count: failedSettlements } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'settlement_failed');

    const actionRequired = [];
    if (pendingWithdrawals && pendingWithdrawals > 0) {
      actionRequired.push({
        id: 'pending-withdrawals',
        type: 'Pending Withdrawals',
        priority: 'high' as const,
        description: `${pendingWithdrawals} withdrawal(s) require manual review`,
        link: '/admin/withdrawals',
      });
    }
    if (failedSettlements && failedSettlements > 0) {
      actionRequired.push({
        id: 'failed-settlements',
        type: 'Failed Settlements',
        priority: 'urgent' as const,
        description: `${failedSettlements} match settlement(s) failed`,
        link: '/admin/matches',
      });
    }

    return NextResponse.json({
      newSignups: newSignups || 0,
      activeUsers: activeUsers || 0,
      depositsTotal,
      withdrawalsTotal,
      matchesPlayed: matchesPlayed || 0,
      revenue,
      actionRequired,
      whales: [], // Mock for now
      churnRisk: [], // Mock for now
    });
  } catch (error) {
    console.error('Today digest error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

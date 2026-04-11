import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await createClient();

  // Check admin auth
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Total users
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Users today
    const { count: usersToday } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    // Users this week
    const { count: usersThisWeek } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString());

    // Active users today (seen in last 24h)
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const { count: activeToday } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen', twentyFourHoursAgo.toISOString());

    // Active users this week
    const { count: activeThisWeek } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen', weekAgo.toISOString());

    // Online now (last 5 minutes)
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const { count: onlineNow } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen', fiveMinutesAgo.toISOString());

    // Total balances
    const { data: balances } = await supabase
      .from('wallets')
      .select('available_balance, locked_balance');

    const totalBalance = balances?.reduce((sum, w) => sum + Number(w.available_balance), 0) ?? 0;
    const totalLocked = balances?.reduce((sum, w) => sum + Number(w.locked_balance), 0) ?? 0;

    // Pending deposits
    const { count: pendingDeposits } = await supabase
      .from('deposits')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Pending withdrawals
    const { data: pendingWithdrawalsData } = await supabase
      .from('withdrawals')
      .select('amount')
      .eq('status', 'pending');

    const pendingWithdrawals = pendingWithdrawalsData?.reduce((sum, w) => sum + Number(w.amount), 0) ?? 0;

    // Withdrawals today
    const { count: withdrawalsToday } = await supabase
      .from('withdrawals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('created_at', today.toISOString());

    // Matches today
    const { count: matchesToday } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    // Live matches
    const { count: liveMatches } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .in('status', ['ready', 'battling']);

    // Awaiting settlement
    const { count: awaitingSettlement } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'settlement_pending');

    // Failed settlements
    const { count: failedSettlements } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'settlement_failed');

    // Flagged users
    const { count: flaggedUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_flagged', true);

    // Manual review queue
    const { count: manualReviewQueue } = await supabase
      .from('manual_review_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Deposit failures (last 24h)
    const { count: depositFailures } = await supabase
      .from('deposits')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', twentyFourHoursAgo.toISOString());

    // Retry queue (withdrawal retries)
    const { count: retryQueue } = await supabase
      .from('withdrawals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .gt('retry_count', 0);

    return NextResponse.json({
      users: {
        total: totalUsers ?? 0,
        today: usersToday ?? 0,
        thisWeek: usersThisWeek ?? 0,
        activeToday: activeToday ?? 0,
        activeThisWeek: activeThisWeek ?? 0,
        online: onlineNow ?? 0,
      },
      financials: {
        totalBalance,
        totalLocked,
        pendingDeposits: pendingDeposits ?? 0,
        pendingWithdrawals,
        withdrawalsToday: withdrawalsToday ?? 0,
      },
      matches: {
        totalToday: matchesToday ?? 0,
        live: liveMatches ?? 0,
        awaitingSettlement: awaitingSettlement ?? 0,
        failedSettlements: failedSettlements ?? 0,
      },
      risk: {
        flaggedUsers: flaggedUsers ?? 0,
        manualReviewQueue: manualReviewQueue ?? 0,
        depositFailures: depositFailures ?? 0,
        retryQueue: retryQueue ?? 0,
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

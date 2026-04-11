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
    // Get total balances
    const { data: wallets } = await supabase
      .from('wallets')
      .select('available_balance, locked_balance');

    const totalBalance = wallets?.reduce((sum, w) => sum + Number(w.available_balance), 0) || 0;
    const totalLocked = wallets?.reduce((sum, w) => sum + Number(w.locked_balance), 0) || 0;

    // Pending withdrawals
    const { data: pendingWithdrawals } = await supabase
      .from('withdrawals')
      .select('amount')
      .eq('status', 'pending');

    const pendingWithdrawalsTotal = pendingWithdrawals?.reduce((sum, w) => sum + Number(w.amount), 0) || 0;

    // Pending deposits
    const { count: pendingDeposits } = await supabase
      .from('deposits')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Platform fees (from completed matches)
    const { data: matches } = await supabase
      .from('matches')
      .select('platform_fee')
      .eq('status', 'completed');

    const platformFees = matches?.reduce((sum, m) => sum + Number(m.platform_fee), 0) || 0;

    // Get last reconciliation report
    const { data: lastReport } = await supabase
      .from('reconciliation_reports')
      .select('*')
      .order('run_at', { ascending: false })
      .limit(1)
      .single();

    const status = {
      status: 'healthy' as const,
      totalBalance,
      totalLocked,
      pendingWithdrawals: pendingWithdrawalsTotal,
      pendingDeposits: pendingDeposits || 0,
      platformFees,
      mismatchCount: lastReport?.mismatch_count || 0,
      driftAmount: lastReport?.drift_amount || 0,
      lastRun: lastReport?.run_at || null,
    };

    // Determine health status
    if (Math.abs(status.driftAmount) > 0.1) {
      status.status = 'critical';
    } else if (Math.abs(status.driftAmount) > 0.01 || status.mismatchCount > 0) {
      status.status = 'warning';
    }

    return NextResponse.json({ status, mismatches: [] });
  } catch (error) {
    console.error('Reconciliation status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

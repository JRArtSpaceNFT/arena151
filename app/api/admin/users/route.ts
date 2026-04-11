import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const supabase = createClient();

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
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build base query
    let query = supabase
      .from('profiles')
      .select(`
        id,
        username,
        email,
        created_at,
        last_seen,
        account_status,
        is_flagged,
        wallets (
          public_address,
          available_balance,
          locked_balance
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (filter === 'flagged') {
      query = query.eq('is_flagged', true);
    } else if (filter === 'has_balance') {
      // Users with balance > 0 (need to join wallets)
      query = query.gt('wallets.available_balance', 0);
    } else if (filter === 'pending_withdrawal') {
      // Users with pending withdrawals
      query = query.not('withdrawals.status', 'eq', null);
    } else if (filter === 'inactive') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query = query.lt('last_seen', thirtyDaysAgo.toISOString());
    }

    // Apply search
    if (search) {
      query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: profiles, error, count } = await query;

    if (error) throw error;

    // Fetch additional stats for each user
    const enrichedUsers = await Promise.all(
      (profiles || []).map(async (profile) => {
        // Get withdrawal info
        const { data: withdrawals } = await supabase
          .from('withdrawals')
          .select('amount')
          .eq('user_id', profile.id)
          .eq('status', 'pending');

        const pendingWithdrawal = withdrawals?.reduce((sum, w) => sum + Number(w.amount), 0) || 0;

        // Get deposit total
        const { data: deposits } = await supabase
          .from('deposits')
          .select('amount')
          .eq('user_id', profile.id)
          .eq('status', 'completed');

        const lifetimeDeposits = deposits?.reduce((sum, d) => sum + Number(d.amount), 0) || 0;

        // Get withdrawal total
        const { data: completedWithdrawals } = await supabase
          .from('withdrawals')
          .select('amount')
          .eq('user_id', profile.id)
          .eq('status', 'completed');

        const lifetimeWithdrawals = completedWithdrawals?.reduce((sum, w) => sum + Number(w.amount), 0) || 0;

        // Get match count
        const { count: matchCount } = await supabase
          .from('matches')
          .select('*', { count: 'exact', head: true })
          .or(`player_a.eq.${profile.id},player_b.eq.${profile.id}`);

        const wallet = (profile.wallets as any)?.[0];

        return {
          id: profile.id,
          username: profile.username,
          email: profile.email,
          created_at: profile.created_at,
          last_seen: profile.last_seen,
          wallet_address: wallet?.public_address || null,
          available_balance: wallet?.available_balance || 0,
          locked_balance: wallet?.locked_balance || 0,
          pending_withdrawal: pendingWithdrawal,
          lifetime_deposits: lifetimeDeposits,
          lifetime_withdrawals: lifetimeWithdrawals,
          match_count: matchCount || 0,
          account_status: profile.account_status,
          is_flagged: profile.is_flagged,
        };
      })
    );

    return NextResponse.json({
      users: enrichedUsers,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Admin users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

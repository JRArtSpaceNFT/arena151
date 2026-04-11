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
    const status = searchParams.get('status') || 'pending';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('withdrawals')
      .select(`
        *,
        profiles (
          username,
          email
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status === 'pending') {
      query = query.eq('status', 'pending');
    } else if (status === 'manual_review') {
      query = query.eq('manual_review', true);
    } else if (status === 'completed') {
      query = query.eq('status', 'completed');
    } else if (status === 'failed') {
      query = query.eq('status', 'failed');
    }

    query = query.range(offset, offset + limit - 1);

    const { data: withdrawals, error, count } = await query;

    if (error) throw error;

    const enrichedWithdrawals = (withdrawals || []).map((w: any) => ({
      id: w.id,
      user_id: w.user_id,
      username: w.profiles?.username || 'Unknown',
      email: w.profiles?.email || 'Unknown',
      amount: Number(w.amount),
      status: w.status,
      destination_address: w.destination_address,
      transaction_signature: w.transaction_signature,
      risk_score: w.risk_score ? Number(w.risk_score) : null,
      manual_review: w.manual_review || false,
      held: w.held || false,
      created_at: w.created_at,
      completed_at: w.completed_at,
      retry_count: w.retry_count || 0,
    }));

    return NextResponse.json({
      withdrawals: enrichedWithdrawals,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Admin withdrawals error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

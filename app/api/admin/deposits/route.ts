import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const supabase = createClient();

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

    let query = supabase
      .from('deposits')
      .select(`
        *,
        profiles (
          username,
          email
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (status === 'pending') {
      query = query.eq('status', 'pending');
    } else if (status === 'completed') {
      query = query.eq('status', 'completed');
    } else if (status === 'failed') {
      query = query.eq('status', 'failed');
    }

    const { data: deposits, error } = await query;

    if (error) throw error;

    const enrichedDeposits = (deposits || []).map((d: any) => ({
      id: d.id,
      user_id: d.user_id,
      username: d.profiles?.username || 'Unknown',
      email: d.profiles?.email || 'Unknown',
      amount: Number(d.amount),
      status: d.status,
      transaction_signature: d.transaction_signature,
      created_at: d.created_at,
      completed_at: d.completed_at,
      webhook_attempts: d.webhook_attempts || 0,
    }));

    return NextResponse.json({ deposits: enrichedDeposits });
  } catch (error) {
    console.error('Admin deposits error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
    // Pending count
    const { count: pending } = await supabase
      .from('withdrawals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Pending amount
    const { data: pendingData } = await supabase
      .from('withdrawals')
      .select('amount')
      .eq('status', 'pending');

    const pendingAmount = pendingData?.reduce((sum, w) => sum + Number(w.amount), 0) || 0;

    // Manual review count
    const { count: manualReview } = await supabase
      .from('withdrawals')
      .select('*', { count: 'exact', head: true })
      .eq('manual_review', true)
      .in('status', ['pending', 'processing']);

    // Failed in last 24h
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { count: failed } = await supabase
      .from('withdrawals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', twentyFourHoursAgo.toISOString());

    // Completed today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: completed } = await supabase
      .from('withdrawals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_at', today.toISOString());

    return NextResponse.json({
      pending: pending || 0,
      pendingAmount,
      manualReview: manualReview || 0,
      failed: failed || 0,
      completed: completed || 0,
    });
  } catch (error) {
    console.error('Withdrawal stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

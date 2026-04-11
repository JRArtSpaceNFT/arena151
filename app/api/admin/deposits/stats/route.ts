import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await createClient();

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
    const { count: pending } = await supabase
      .from('deposits')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { data: pendingData } = await supabase
      .from('deposits')
      .select('amount')
      .eq('status', 'pending');

    const pendingAmount = pendingData?.reduce((sum, d) => sum + Number(d.amount), 0) || 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count: completedToday } = await supabase
      .from('deposits')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_at', today.toISOString());

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { count: failed } = await supabase
      .from('deposits')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', twentyFourHoursAgo.toISOString());

    const { count: webhookFailures } = await supabase
      .from('deposits')
      .select('*', { count: 'exact', head: true })
      .gt('webhook_attempts', 3);

    return NextResponse.json({
      pending: pending || 0,
      pendingAmount,
      completedToday: completedToday || 0,
      failed: failed || 0,
      webhookFailures: webhookFailures || 0,
    });
  } catch (error) {
    console.error('Deposit stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

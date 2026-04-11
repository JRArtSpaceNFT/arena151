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
    const { count: flaggedUsers } = await supabase
      .from('risk_flags')
      .select('*', { count: 'exact', head: true })
      .eq('resolved', false)
      .eq('severity', 'critical');

    const { count: totalFlagged } = await supabase
      .from('risk_flags')
      .select('*', { count: 'exact', head: true })
      .eq('resolved', false);

    return NextResponse.json({
      criticalAlerts: flaggedUsers || 0,
      flaggedUsers: totalFlagged || 0,
      rateLimitHits: 0, // Mock - needs rate limit implementation
      suspiciousActivity: 0, // Mock - needs anomaly detection
    });
  } catch (error) {
    console.error('Risk stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

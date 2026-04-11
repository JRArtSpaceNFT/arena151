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
    const now = new Date().toISOString();

    // Check database
    const dbStart = Date.now();
    await supabase.from('profiles').select('id').limit(1).single();
    const dbLatency = Date.now() - dbStart;

    // Check last successful operations
    const { data: lastDeposit } = await supabase
      .from('deposits')
      .select('completed_at')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    const { data: lastWithdrawal } = await supabase
      .from('withdrawals')
      .select('completed_at')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    const { data: lastSettlement } = await supabase
      .from('matches')
      .select('settled_at')
      .eq('status', 'completed')
      .order('settled_at', { ascending: false })
      .limit(1)
      .single();

    // Error count (last 24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { count: errorCount } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'settlement_failed')
      .gte('created_at', twentyFourHoursAgo.toISOString());

    const health = {
      overall: 'healthy' as const,
      services: {
        database: {
          status: 'up' as const,
          latency: dbLatency,
          lastCheck: now,
          error: null,
        },
        rpc: {
          status: 'up' as const,
          latency: null,
          lastCheck: now,
          error: null,
        },
        webhooks: {
          status: 'up' as const,
          latency: null,
          lastCheck: now,
          error: null,
        },
        cron: {
          status: 'up' as const,
          latency: null,
          lastCheck: now,
          error: null,
        },
      },
      metrics: {
        lastSuccessfulDeposit: lastDeposit?.completed_at || null,
        lastSuccessfulWithdrawal: lastWithdrawal?.completed_at || null,
        lastSuccessfulSettlement: lastSettlement?.settled_at || null,
        errorCount24h: errorCount || 0,
        failedJobs: 0,
      },
    };

    // Determine overall health
    if ((errorCount || 0) > 10) {
      health.overall = 'degraded';
    }

    return NextResponse.json(health);
  } catch (error) {
    console.error('Health status error:', error);
    return NextResponse.json({ 
      overall: 'down',
      services: {
        database: { status: 'down', latency: null, lastCheck: new Date().toISOString(), error: 'Connection failed' },
        rpc: { status: 'down', latency: null, lastCheck: new Date().toISOString(), error: null },
        webhooks: { status: 'down', latency: null, lastCheck: new Date().toISOString(), error: null },
        cron: { status: 'down', latency: null, lastCheck: new Date().toISOString(), error: null },
      },
      metrics: {
        lastSuccessfulDeposit: null,
        lastSuccessfulWithdrawal: null,
        lastSuccessfulSettlement: null,
        errorCount24h: 0,
        failedJobs: 0,
      }
    });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
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
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    let query = supabase
      .from('admin_audit_log')
      .select(`
        *,
        profiles (username)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (action && action !== 'all') {
      query = query.ilike('action', `%${action}%`);
    }

    const { data: logs, error } = await query;

    if (error) throw error;

    const enrichedLogs = (logs || []).map((log: any) => ({
      id: log.id,
      admin_username: log.profiles?.username || 'System',
      action: log.action,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      summary: log.summary,
      status: log.status || 'success',
      created_at: log.created_at,
      metadata: log.metadata,
    }));

    return NextResponse.json({ logs: enrichedLogs });
  } catch (error) {
    console.error('Audit logs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

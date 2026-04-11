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
    const { data: flags, error } = await supabase
      .from('risk_flags')
      .select(`
        *,
        profiles (
          id,
          username,
          email
        )
      `)
      .eq('resolved', false)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const users = (flags || []).map((f: any) => ({
      id: f.profiles?.id || f.user_id,
      username: f.profiles?.username || 'Unknown',
      email: f.profiles?.email || 'Unknown',
      flag_type: f.flag_type,
      severity: f.severity,
      description: f.description,
      flagged_at: f.created_at,
      resolved: f.resolved,
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Flagged users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { createClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const token_hash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');
  const next = requestUrl.searchParams.get('next') || '/';

  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    });

    if (!error) {
      // If it's a password recovery, redirect to reset password page
      if (type === 'recovery') {
        return NextResponse.redirect(`${requestUrl.origin}/reset-password`);
      }
      // Otherwise redirect to the next page
      return NextResponse.redirect(`${requestUrl.origin}${next}`);
    }
  }

  // If there's an error or no token, redirect to login
  return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_failed`);
}

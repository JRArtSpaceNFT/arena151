import { createClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const token_hash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');
  const code = requestUrl.searchParams.get('code');
  
  // Handle email confirmation with code
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // Check if this is a password recovery flow
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // For recovery, redirect to reset password page
        return NextResponse.redirect(`${requestUrl.origin}/reset-password`);
      }
    }
  }
  
  // Handle legacy token_hash flow
  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    });

    if (!error) {
      if (type === 'recovery') {
        return NextResponse.redirect(`${requestUrl.origin}/reset-password`);
      }
      return NextResponse.redirect(`${requestUrl.origin}/`);
    }
  }

  // Default: redirect to home or show error
  return NextResponse.redirect(`${requestUrl.origin}/`);
}

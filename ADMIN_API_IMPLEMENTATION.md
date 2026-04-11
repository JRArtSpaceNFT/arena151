# Admin API Implementation Guide

All admin APIs follow the same auth pattern. Copy this template for each new endpoint:

## Auth Template

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

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
    // Your logic here
    
    return NextResponse.json({ data: 'success' });
  } catch (error) {
    console.error('Admin API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

## APIs That Need Implementation

### Deposits
- ✅ `/api/admin/deposits` — GET (done)
- ⚠️ `/api/admin/deposits/stats` — GET
- ⚠️ `/api/admin/deposits/[id]/retry` — POST

### Matches
- ⚠️ `/api/admin/matches` — GET
- ⚠️ `/api/admin/matches/stats` — GET
- ⚠️ `/api/admin/matches/[id]/retry-settlement` — POST

### Risk
- ⚠️ `/api/admin/risk/alerts` — GET
- ⚠️ `/api/admin/risk/flagged-users` — GET
- ⚠️ `/api/admin/risk/stats` — GET
- ⚠️ `/api/admin/risk/alerts/[id]/resolve` — POST

### Reconciliation
- ⚠️ `/api/admin/reconciliation/status` — GET
- ⚠️ `/api/admin/reconciliation/run` — POST

### Audit
- ⚠️ `/api/admin/audit/logs` — GET

### Health
- ⚠️ `/api/admin/health/status` — GET

### Today
- ⚠️ `/api/admin/today/digest` — GET

### Users (additional)
- ⚠️ `/api/admin/users/[id]/unflag` — POST
- ⚠️ `/api/admin/users/[id]/flag` — POST
- ⚠️ `/api/admin/users/[id]/notes` — POST

### Withdrawals (additional)
- ⚠️ `/api/admin/withdrawals/[id]/approve` — POST
- ⚠️ `/api/admin/withdrawals/[id]/reject` — POST

## Quick Implementation Notes

Most of these can return mock data initially and be replaced with real queries later.

For now, focus on:
1. Returning the right shape of data
2. Proper admin auth
3. Error handling

Real implementations can come after Jonathan tests the UI.

# Arena 151 Admin Command Center — Architecture

## Route Structure

```
/admin
  ├── / (dashboard overview)
  ├── /users (user management table)
  ├── /users/[id] (user detail)
  ├── /deposits (deposit monitor)
  ├── /withdrawals (withdrawal monitor)
  ├── /matches (match control)
  ├── /risk (risk & anomaly center)
  ├── /reconciliation (financial health)
  ├── /audit (audit log viewer)
  ├── /health (system health)
  └── /today (owner daily view)
```

## Middleware & Protection

**Route Protection:**
- All `/admin/*` routes check `isAdmin()` server-side
- Middleware: `middleware.ts` → check admin session
- Admin role stored in `profiles.is_admin` (boolean)
- Admin API routes: `/api/admin/*` — all require admin auth

**Admin Auth Flow:**
- Login with admin credentials
- Set `is_admin: true` in session
- Frontend checks session before rendering
- Server checks session on every admin API call

## Page Structure

### 1. Dashboard Overview (`/admin`)
**Components:**
- `CommandCenterHeader` (sticky summary bar)
- `CriticalAlertsBar` (dismissible banner)
- `OverviewStats` (beautiful stat cards grid)
- `RecentActivityFeed` (live feed)
- `QuickActionPanel` (jump to sections)

### 2. User Management (`/admin/users`)
**Components:**
- `UserSearchBar` (search + filters)
- `UserFilters` (status, risk, activity)
- `UserTable` (advanced sortable table)
- `UserRowActions` (inline actions)
- `UserDetailDrawer` (slide-out detail)

### 3. User Detail (`/admin/users/[id]`)
**Components:**
- `UserProfileHeader`
- `UserWalletPanel`
- `UserBalancePanel`
- `UserTransactionHistory`
- `UserMatchHistory`
- `UserRiskPanel`
- `UserAuditTrail`
- `AdminNotesPanel`

### 4. Deposits (`/admin/deposits`)
**Components:**
- `DepositStatusTabs` (pending/failed/recent)
- `DepositTable`
- `DepositDetailModal`
- `WebhookFailurePanel`

### 5. Withdrawals (`/admin/withdrawals`)
**Components:**
- `WithdrawalStatusTabs`
- `WithdrawalTable`
- `ManualReviewQueue`
- `LargeWithdrawalAlert`
- `WithdrawalApprovalModal`

### 6. Matches (`/admin/matches`)
**Components:**
- `MatchStatusBoard` (kanban-style)
- `LiveMatchMonitor`
- `SettlementQueue`
- `FailedSettlementPanel`
- `MatchDetailDrawer`

### 7. Risk Center (`/admin/risk`)
**Components:**
- `RiskAlertGrid` (severity color-coded)
- `AnomalyDetectionPanel`
- `FlaggedUsersTable`
- `SuspiciousActivityFeed`
- `RateLimitMonitor`

### 8. Reconciliation (`/admin/reconciliation`)
**Components:**
- `ReconciliationStatus` (health indicator)
- `BalanceSummary`
- `MismatchReport`
- `StuckFundsPanel`
- `ReconciliationHistory`
- `ExportTools`

### 9. Audit Log (`/admin/audit`)
**Components:**
- `AuditSearchBar`
- `AuditFilters` (actor, action, entity, date)
- `AuditLogTable`
- `AuditDetailModal`

### 10. System Health (`/admin/health`)
**Components:**
- `HealthStatusGrid`
- `ServiceMonitor` (DB, RPC, webhooks, cron)
- `ErrorLogPanel`
- `JobQueueStatus`
- `DeploymentInfo`

### 11. Owner Daily View (`/admin/today`)
**Components:**
- `DailyDigest` (what happened today)
- `ActionRequiredPanel` (needs attention)
- `NewUsersSummary`
- `MoneyMovementSummary`
- `WhaleActivity`
- `ChurnRiskPanel`
- `ManualReviewSummary`

## API Endpoints

### Admin Stats
```
GET /api/admin/stats/overview
GET /api/admin/stats/signups
GET /api/admin/stats/activity
GET /api/admin/stats/financials
GET /api/admin/stats/matches
GET /api/admin/stats/risk
```

### User Management
```
GET /api/admin/users (search, filter, paginate)
GET /api/admin/users/[id]
GET /api/admin/users/[id]/transactions
GET /api/admin/users/[id]/matches
GET /api/admin/users/[id]/audit
POST /api/admin/users/[id]/notes
POST /api/admin/users/[id]/flag
POST /api/admin/users/[id]/freeze (safe)
```

### Deposits & Withdrawals
```
GET /api/admin/deposits
GET /api/admin/deposits/[id]
GET /api/admin/withdrawals
GET /api/admin/withdrawals/[id]
POST /api/admin/withdrawals/[id]/approve
POST /api/admin/withdrawals/[id]/reject
```

### Matches
```
GET /api/admin/matches
GET /api/admin/matches/[id]
GET /api/admin/matches/live
GET /api/admin/matches/settlement-queue
POST /api/admin/matches/[id]/retry-settlement
```

### Risk & Anomalies
```
GET /api/admin/risk/alerts
GET /api/admin/risk/flagged-users
GET /api/admin/risk/rate-limits
GET /api/admin/anomalies
```

### Reconciliation
```
GET /api/admin/reconciliation/status
GET /api/admin/reconciliation/mismatches
GET /api/admin/reconciliation/stuck-funds
POST /api/admin/reconciliation/run
POST /api/admin/reconciliation/export
```

### Audit
```
GET /api/admin/audit/logs (search, filter, paginate)
```

### Health
```
GET /api/admin/health/status
GET /api/admin/health/services
GET /api/admin/health/errors
GET /api/admin/health/jobs
```

### Daily Owner View
```
GET /api/admin/today/digest
GET /api/admin/today/action-required
GET /api/admin/today/whales
GET /api/admin/today/churn-risk
```

## Data Dependencies

### New DB Tables Needed

**admin_notes:**
```sql
id uuid PRIMARY KEY
user_id uuid REFERENCES profiles(id)
admin_id uuid REFERENCES profiles(id)
note text NOT NULL
created_at timestamptz DEFAULT NOW()
```

**risk_flags:**
```sql
id uuid PRIMARY KEY
user_id uuid REFERENCES profiles(id)
flag_type text NOT NULL
severity text NOT NULL -- critical, high, medium, low
description text
flagged_by uuid REFERENCES profiles(id)
resolved boolean DEFAULT false
resolved_at timestamptz
resolved_by uuid REFERENCES profiles(id)
created_at timestamptz DEFAULT NOW()
```

**manual_review_queue:**
```sql
id uuid PRIMARY KEY
entity_type text NOT NULL -- withdrawal, user, match
entity_id uuid NOT NULL
reason text NOT NULL
priority text NOT NULL -- urgent, high, normal, low
assigned_to uuid REFERENCES profiles(id)
status text DEFAULT 'pending' -- pending, in_progress, resolved, dismissed
created_at timestamptz DEFAULT NOW()
reviewed_at timestamptz
reviewed_by uuid REFERENCES profiles(id)
resolution_notes text
```

**reconciliation_reports:**
```sql
id uuid PRIMARY KEY
run_at timestamptz DEFAULT NOW()
total_user_balance numeric(20,9) NOT NULL
total_locked_balance numeric(20,9) NOT NULL
pending_withdrawals numeric(20,9) NOT NULL
pending_deposits numeric(20,9) NOT NULL
platform_fees numeric(20,9) NOT NULL
mismatch_count integer DEFAULT 0
drift_amount numeric(20,9) DEFAULT 0
status text NOT NULL -- healthy, warning, critical
details jsonb
```

**withdrawal_holds:**
```sql
id uuid PRIMARY KEY
withdrawal_id uuid REFERENCES withdrawals(id)
user_id uuid REFERENCES profiles(id)
reason text NOT NULL
held_by uuid REFERENCES profiles(id)
held_at timestamptz DEFAULT NOW()
released_at timestamptz
released_by uuid REFERENCES profiles(id)
```

**admin_audit_log:**
```sql
id uuid PRIMARY KEY
admin_id uuid REFERENCES profiles(id)
action text NOT NULL
entity_type text
entity_id uuid
summary text NOT NULL
before_state jsonb
after_state jsonb
request_id text
status text
metadata jsonb
created_at timestamptz DEFAULT NOW()
```

### Extend Existing Tables

**profiles:**
```sql
ALTER TABLE profiles ADD COLUMN is_admin boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN last_seen timestamptz;
ALTER TABLE profiles ADD COLUMN signup_source text;
ALTER TABLE profiles ADD COLUMN country text;
ALTER TABLE profiles ADD COLUMN is_flagged boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN account_status text DEFAULT 'active';
```

**withdrawals:**
```sql
ALTER TABLE withdrawals ADD COLUMN held boolean DEFAULT false;
ALTER TABLE withdrawals ADD COLUMN risk_score numeric(3,2);
ALTER TABLE withdrawals ADD COLUMN manual_review boolean DEFAULT false;
```

## Visual Design System

### Color Palette
```
Background: #0a0a0f (deep dark)
Card BG: #141419 (elevated dark)
Card Border: #1f1f28 (subtle)
Accent Glow: #6366f1 (indigo)
Success: #10b981 (emerald)
Warning: #f59e0b (amber)
Danger: #ef4444 (red)
Text Primary: #f9fafb (near white)
Text Secondary: #9ca3af (gray)
Text Muted: #6b7280 (darker gray)
```

### Card Style
```css
.command-card {
  background: linear-gradient(135deg, #141419 0%, #1a1a21 100%);
  border: 1px solid rgba(99, 102, 241, 0.1);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  transition: all 0.3s ease;
}

.command-card:hover {
  border-color: rgba(99, 102, 241, 0.3);
  box-shadow: 0 4px 30px rgba(99, 102, 241, 0.15);
  transform: translateY(-2px);
}
```

### Stat Card
```css
.stat-card {
  background: linear-gradient(135deg, #1a1a21 0%, #1f1f28 100%);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 16px;
  padding: 24px;
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #f9fafb 0%, #9ca3af 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

### Alert Severity Colors
```css
.alert-critical { border-left: 4px solid #ef4444; background: rgba(239, 68, 68, 0.05); }
.alert-high { border-left: 4px solid #f59e0b; background: rgba(245, 158, 11, 0.05); }
.alert-medium { border-left: 4px solid #3b82f6; background: rgba(59, 130, 246, 0.05); }
.alert-low { border-left: 4px solid #6b7280; background: rgba(107, 114, 128, 0.05); }
```

### Typography
```css
font-family: 'Inter', system-ui, sans-serif;
font-feature-settings: 'ss01', 'ss02', 'cv01', 'cv03';
```

## Role & Permission Design

### Admin Roles (Phase 1: Simple)
- **Super Admin:** Full access (you)
- **Read Only:** View everything, no actions

### Future Roles
- **Support Admin:** User management + notes
- **Finance Admin:** Reconciliation + withdrawals
- **Operations Admin:** Matches + settlements

### Permission Flags
```typescript
type AdminPermission =
  | 'view_dashboard'
  | 'view_users'
  | 'manage_users'
  | 'view_financials'
  | 'approve_withdrawals'
  | 'manage_matches'
  | 'view_audit'
  | 'run_reconciliation'
  | 'manage_risk';
```

## Security Boundaries

### What's Safe to Show
✅ Public wallet addresses
✅ User emails (admin only)
✅ Usernames
✅ Balances
✅ Transaction amounts
✅ Match history
✅ Risk flags
✅ Audit logs
✅ System health

### Never Expose
❌ Private keys
❌ Seed phrases
❌ WALLET_ENCRYPTION_SECRET
❌ SUPABASE_SERVICE_KEY
❌ HELIUS_API_KEY
❌ Unencrypted wallet data
❌ Signing material

### Action Logging
Every admin action logs:
- Who (admin_id)
- What (action)
- When (timestamp)
- Entity (type + id)
- Before/after state (safe data only)
- Request ID (for tracing)

## Implementation Order

### Phase 1: Foundation (Routes, Layout, Auth)
- Create `/admin` route structure
- Build admin middleware
- Create admin layout component
- Build admin auth check
- Create shared UI components

### Phase 2: Database Schema
- Add admin_notes table
- Add risk_flags table
- Add manual_review_queue table
- Add reconciliation_reports table
- Add withdrawal_holds table
- Add admin_audit_log table
- Extend profiles table
- Extend withdrawals table

### Phase 3: Core Dashboard
- Build dashboard overview page
- Create stat cards
- Build recent activity feed
- Create critical alerts bar
- Build quick action panel

### Phase 4: User Management
- Build user table with search/filter
- Create user detail page
- Build admin notes system
- Build risk flagging system
- Create user audit trail

### Phase 5: Financial Monitoring
- Build deposit monitor
- Build withdrawal monitor
- Create manual review queue
- Build reconciliation dashboard
- Create export tools

### Phase 6: Match & Risk
- Build match control center
- Create settlement queue
- Build risk alert center
- Create anomaly detection panel

### Phase 7: Audit & Health
- Build audit log viewer
- Create system health monitor
- Build operational dashboard

### Phase 8: Owner Daily View
- Build daily digest
- Create action required panel
- Build whale activity monitor
- Create churn risk analysis

### Phase 9: Polish
- Add charts
- Smooth animations
- Loading states
- Empty states
- Error boundaries
- Responsive tweaks

## Tech Stack

- **Framework:** Next.js 15+ (App Router)
- **Styling:** Tailwind v4
- **UI Components:** Radix UI (accessible primitives)
- **Charts:** Recharts
- **Icons:** Lucide React
- **Tables:** TanStack Table v8
- **Date:** date-fns
- **Animations:** Framer Motion

## What's Live vs Mocked (After Build)

Will track this during implementation.

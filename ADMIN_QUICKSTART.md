# Arena 151 Admin — Quick Start Guide

Get the admin command center running in 5 minutes.

---

## Step 1: Apply Database Migration

Run this in Supabase SQL Editor:

```bash
# Copy the migration file
cat supabase/migrations/016_admin_infrastructure.sql
```

Paste into Supabase → SQL Editor → Run.

---

## Step 2: Grant Yourself Admin

In Supabase SQL Editor:

```sql
UPDATE profiles 
SET is_admin = true 
WHERE email = 'your-email@example.com';
```

Replace with your actual email.

---

## Step 3: Install Dependencies

```bash
cd /Users/worlddomination/.openclaw/workspace/arena151

npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select @radix-ui/react-tabs @tanstack/react-table recharts date-fns
```

---

## Step 4: Start Dev Server

```bash
npm run dev
```

Visit: `http://localhost:3002/admin`

---

## Step 5: Login

1. Go to `http://localhost:3002/login`
2. Login with your admin email
3. Navigate to `/admin`

You're in.

---

## What You Can Do Right Now

**✅ Working:**
- Dashboard overview (users, financials, matches, risk)
- User management (search, filter, view details)
- Withdrawal monitoring (view pending, completed, failed)
- Reconciliation status (view health, run checks)

**🚧 Needs API Implementation:**
- Approve/reject withdrawals
- Run reconciliation calculations
- Flag users
- Add admin notes
- View audit logs

---

## File Structure

```
/admin
  ├── / (dashboard)
  ├── /users (user management)
  ├── /withdrawals (withdrawal monitor)
  └── /reconciliation (financial health)

/api/admin
  ├── /stats/overview (dashboard metrics)
  ├── /users (user data)
  ├── /withdrawals (withdrawal data)
  └── /withdrawals/stats (withdrawal metrics)
```

---

## Next: Implement Critical APIs

See `ADMIN_BUILD_SUMMARY.md` for full implementation roadmap.

**Priority 1:**
- `/api/admin/withdrawals/[id]/approve`
- `/api/admin/withdrawals/[id]/reject`
- `/api/admin/reconciliation/run`

**Priority 2:**
- Build Deposits, Matches, Risk, Audit, Health pages
- Add admin audit logging

---

## Troubleshooting

**"Forbidden" error:**
- Make sure your profile has `is_admin = true`
- Check middleware is working

**Stats not loading:**
- Check API routes are present
- Verify Supabase connection

**Styles broken:**
- Make sure Tailwind config includes admin routes
- Run `npm run dev` to rebuild

---

**You now have a premium admin command center. Enjoy.**

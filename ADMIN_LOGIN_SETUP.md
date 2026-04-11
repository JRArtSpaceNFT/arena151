# Arena 151 Admin Login — Setup Guide

## Option 1: Use Supabase Dashboard (Easiest)

### Step 1: Create User Account

1. Go to your Supabase project: https://supabase.com/dashboard/project/abzurjxkxxtahdjrpvxk
2. Navigate to **Authentication** → **Users**
3. Click **Add User**
4. Enter:
   - Email: `your-email@example.com`
   - Password: `your-secure-password`
5. Click **Create User**

### Step 2: Grant Admin Access

1. Go to **SQL Editor** in Supabase
2. Run this query:

```sql
UPDATE profiles 
SET is_admin = true 
WHERE email = 'your-email@example.com';
```

### Step 3: Login

1. Start dev server: `npm run dev`
2. Go to: `http://localhost:3002/login`
3. Enter your email and password
4. You'll be redirected to `/admin`

**Done.**

---

## Option 2: Yes, Just Give Me Email + Password

If you give me:
- Email: `example@example.com`
- Password: `YourPassword123`

I can create a script that uses Supabase Admin API to:
1. Create the user account
2. Set `is_admin = true` in profiles
3. Confirm it worked

You'd just run: `node scripts/create-admin.js`

But Option 1 (Supabase Dashboard) is faster and safer.

---

## Troubleshooting

**"User not found" error:**
- Make sure you created the user in Supabase Auth first
- Check the email is correct

**"Forbidden" error:**
- Make sure `is_admin = true` was set in profiles table
- Check the middleware is allowing the route

**"No profile found":**
- The profiles table should auto-create when a user signs up
- If not, manually insert:
  ```sql
  INSERT INTO profiles (id, email, is_admin)
  VALUES (
    'user-auth-id-from-auth-users-table',
    'your-email@example.com',
    true
  );
  ```

---

## What I Built

- ✅ `/login` page (beautiful dark theme login form)
- ✅ Supabase auth integration
- ✅ Auto-redirect to `/admin` if user is admin
- ✅ Error handling
- ✅ Loading states

**Everything is ready. Just create the user account in Supabase and you're in.**

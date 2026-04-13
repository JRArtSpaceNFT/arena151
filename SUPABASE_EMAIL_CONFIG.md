# Supabase Email Template Configuration

## Password Reset Email Fix

To make password reset emails work correctly, update the Supabase email template redirect URL:

### Steps:

1. Go to: https://supabase.com/dashboard/project/abzurjxkxxtahdjrpvxk/auth/templates

2. Click on **"Reset Password"** template

3. Update the **Redirect URL** to:
   ```
   https://arena151.xyz/api/auth/callback
   ```

4. Save changes

### What This Does:

When users click "reset password" from the login page:
1. They enter their email
2. Supabase sends a password reset email
3. User clicks the link in the email
4. Link goes to `/api/auth/callback` with the token
5. Callback route verifies the token and redirects to `/reset-password`
6. User enters new password
7. Success! Redirects to login

### Testing:

1. Go to https://arena151.xyz/login
2. Enter any admin email
3. Click "Forgot password?"
4. Check email inbox
5. Click reset link → should land on password reset page
6. Enter new password → should redirect to login

---

**Status:** Code deployed, waiting for Supabase email template config update.

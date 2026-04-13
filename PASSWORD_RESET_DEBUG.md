# Password Reset Debug Guide

## Current Issue
Password reset link redirects to homepage instead of reset password page.

## What to Check in Supabase Dashboard

### 1. URL Configuration (Authentication → URL Configuration)
**Site URL:** `https://arena151.xyz`

**Redirect URLs - ADD BOTH:**
```
https://arena151.xyz/api/auth/callback
https://arena151.xyz/reset-password
```

### 2. Email Template (Authentication → Email Templates → Reset Password)

The email body should use the PKCE flow. Update to:

```html
<h2>Reset Password</h2>
<p>Follow this link to reset the password for your user:</p>
<p><a href="{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery">Reset Password</a></p>
```

OR even simpler, use the confirmation URL:

```html
<h2>Reset Password</h2>
<p>Follow this link to reset the password for your user:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
```

But set the redirect to `/reset-password` in the **email settings**.

### 3. Alternative: Use Magic Link Style

In `app/login/page.tsx`, change the reset call to:

```typescript
const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `https://arena151.xyz/reset-password`,
});
```

This tells Supabase exactly where to send users after they click the email link.

---

## Test Steps
1. Update Supabase redirect URLs
2. Request password reset
3. Click email link
4. Should land on `/reset-password` with an active session
5. Update password
6. Redirect to login

---

**Next Action:** Update the `resetPasswordForEmail` call in login page to use explicit redirectTo URL.

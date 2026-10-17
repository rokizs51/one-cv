# Task 5: Auth (email/password) + route protection - Manual Verification

**Status:** PENDING-OWNER

**Prerequisites:**
- Task 3 database checklist (`task-3-rls.md`) completed — schema applied
- For instant dev logins: email confirmation DISABLED in Supabase dashboard
  (Authentication → Providers → Email). With confirmation ENABLED, signup
  succeeds but login fails until the email link is clicked — valid for the
  real open-signup phase, just don't confuse it with a bug.

## Manual Verification Checklist

1. Start dev server with `pnpm dev`
   - Result: 

2. Navigate to `/signup`, register with email + password (no invite code)
   - Result: 
   - Expected: 201, redirect, user exists in dashboard → Authentication → Users

3. Sign out (POST /api/auth/logout or the logout path)
   - Result: 

4. Navigate to `/login` and sign in with the same credentials
   - Result: 
   - Expected: 200 + session cookie

5. Attempt signup with the same email again
   - Result: 
   - Expected: HTTP 409, error code `user_exists`, inline message
     "A user with this email already exists"

6. Attempt login with a wrong password
   - Result: 
   - Expected: HTTP 401, error code `invalid_credentials`

7. Verify protected routes redirect to `/login` when unauthenticated
   - Result: 

8. Verify `/login` and `/signup` routes are accessible without authentication
   - Result: 

## Notes

- The invite-gated launch model was removed 2026-10-17 by owner decision
  (open email signup). The `invites` table, `invites.ts` repo, invite fields
  in the signup form/routes, and the login-time invite check no longer exist.
- Per-user monthly generation quota (50/month) and the global cost ceiling
  are unaffected — still enforced on generation.
- The proxy file uses `proxy.ts` (Next.js 16 convention) instead of
  deprecated `middleware.ts`.

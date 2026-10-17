# Task 5: Auth (invite-gated) + route protection - Manual Verification

**Status:** PENDING-OWNER (depends on Task 3 checklist being run first)

**Prerequisites:**
- Task 3 database seed checklist must be completed first
- Supabase project must be configured with email confirmation DISABLED in dashboard

## Manual Verification Checklist

1. Start dev server with `pnpm dev`
   - Result: 

2. Navigate to `/signup` with a valid invite code from Task 3 seed
   - Result: 

3. Attempt signup with the invite code
   - Result: 

4. Verify user was created in Supabase dashboard
   - Result: 

5. Verify invite was claimed (invites table shows claimed_by = user.id)
   - Result: 

6. Sign out (call POST /api/auth/logout)
   - Result: 

7. Navigate to `/login` and sign in with the same credentials
   - Result: 

8. Verify protected routes redirect to `/login` when unauthenticated
   - Result: 

9. Attempt signup with the same invite code again
   - Result: 
   - Expected: Error message "This invite code is already used."
   - Expected HTTP status: 400
   - Expected error code: invalid_invite

10. Attempt login with a user that has no claimed invite
    - Result: 
    - Expected: HTTP status 403
    - Expected error code: invite_required

11. Verify proxy redirects unauthenticated users from protected routes to `/login`
    - Result: 

12. Verify `/login` and `/signup` routes are accessible without authentication
    - Result: 

## Notes

- Email confirmation must be DISABLED in Supabase dashboard (project setting)
- The proxy file uses `proxy.ts` (Next.js 16 convention) instead of deprecated `middleware.ts`
- Signup race condition handling: if invite is claimed between check and claim, user is signed out and 400 invalid_invite is returned
- Login gate: verifies user owns a claimed invite row before allowing access

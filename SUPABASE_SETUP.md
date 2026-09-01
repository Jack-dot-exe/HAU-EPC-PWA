# Supabase Setup

1. Create a Supabase project.
2. In Supabase Auth settings, enable Email/Password sign-in.
3. Open SQL Editor and run `supabase/schema.sql`.
4. Copy `.env.example` to `.env` and set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
5. Restart the Vite dev server.

## Current behavior

- If Supabase env vars are present, app uses Supabase for users/roles, profiles, registrations, checks, and auth session handling.
- If env vars are missing, app keeps using local storage fallback for development only.

## Bootstrap flow

- Users are provisioned manually outside the app.
- Create the auth account in Supabase Auth first.
- Create a matching row in `public.epc_users` manually.
- Ensure `epc_users.email` exactly matches the Supabase Auth email.
- Set `role` and `is_active` in `epc_users` before the user signs in.

## Security model

- `viewer`: read-only access
- `editor`: read + write checks/profiles/registrations
- `admin`: full access including user/role management

## Important

- The app does not create users, bootstrap the first admin, or set initial passwords.
- Logging in requires both a Supabase Auth user and a matching active row in `public.epc_users`.
- When `schema.sql` changes, re-run it in Supabase SQL editor so policies/functions stay in sync.

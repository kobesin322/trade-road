# Supabase auth setup (TradeRoad)

Google OAuth is **not** enabled in this app. Sign-in is email + password, magic link, or 6-digit email code.

## If you signed up with Gmail but have no password

Your Gmail address is just your **email** — not Google sign-in. Use **Email me a magic link** on `/login`, or **Forgot password?** to set a password.

## URL configuration

In **Authentication → URL Configuration**:

| Setting | Value |
|---------|--------|
| Site URL | `NEXT_PUBLIC_SITE_URL` (e.g. `http://localhost:3000` or your production URL) |
| Redirect URLs | `{SITE_URL}/auth/confirm`, `{SITE_URL}/auth/callback` |

## Email templates (PKCE / SSR)

For each template below, replace the default `{{ .ConfirmationURL }}` link with the custom URL.

**Magic Link**

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Sign in</a>
```

**Confirm signup**

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm email</a>
```

**Reset password**

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
```

Optional: include `{{ .Token }}` in the Magic Link body so users can enter the code on the login page.

## Flow summary

| Method | Endpoint |
|--------|----------|
| Magic link / signup confirm | `/auth/confirm` (`verifyOtp`) |
| OAuth / PKCE code | `/auth/callback` (`exchangeCodeForSession`) |
| Set password after reset | `/auth/reset-password` |

# Auth, roles, invites

## Sign-in: Google only
- Better Auth Google provider. Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`; `.env.example` lists them. No passwords anywhere.
- No implicit sign-up: a Google account gets in only if its email belongs to an existing user (coach or client) or it comes through a valid invite. Otherwise show a "No account — ask your coach for an invite" page and create nothing.
- Dev login: when `NODE_ENV !== 'production'`, `/login` also lists seeded users to sign in as with one click, so the app runs without Google credentials and e2e tests can log in. In production the route refuses (tested). The Google button is hidden when Google env vars are missing.

## Roles
- `COACH` — no public sign-up. Created with `npm run coach:create -- --email … --name …` (and by the seed); their first Google sign-in with that email links the account.
- `CLIENT` — joins only through a coach's invite; belongs to exactly one coach.

## Flows
- "Continue with Google" / logout for both roles; after login redirect to `/coach` or `/app`. Visiting the other role's area redirects home.
- Invite: coach clicks "Invite client", enters client name, optional email, program and tracking mode (optional) → copyable link `/invite/<token>`. Token random (≥128 bit), single-use, expires after 7 days, revocable. Pending invites listed on the client list.
- Accept invite: shows the coach's name and "Continue with Google"; if the invite has an email, the Google account email must match. Then timezone (default from browser) and locale → continues to onboarding (`onboarding-profile.md`).
- Coach can set a client inactive (can't log in, data kept) and reactivate.
- Account deletion: `home-and-basics.md`.

## Authorization — security boundary, must have tests
- One shared module of helpers (e.g. `requireUser()`, `requireCoach()`, `requireClient()`, `requireCoachOf(clientId)`), used by every server action, route handler and data-loading server component. No ad-hoc checks.
- CLIENT reads/writes only their own data.
- COACH reads/writes only data of clients with `client.coachId === coach.id`, plus their own library.
- Coach notes are never readable by clients.
- Integration tests prove: a coach can't read or modify another coach's client; a client can't read another client's food log, photos, bloodwork or messages; a client can't read coach notes; an inactive client can't do anything.

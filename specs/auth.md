# Auth, roles, invites

## Roles
- `COACH` — no public sign-up. Created with `npm run coach:create -- --email … --name … --password …` (and by the seed).
- `CLIENT` — joins only through a coach's invite; belongs to exactly one coach.

## Flows
- Login / logout for both roles; after login redirect to `/coach` or `/app`. Visiting the other role's area redirects home.
- Invite: coach clicks "Invite client", enters client name, optional email, program and tracking mode (optional) → copyable link `/invite/<token>`. Token random (≥128 bit), single-use, expires after 7 days, revocable. Pending invites listed on the client list.
- Accept invite: shows the coach's name; client sets email (prefilled if given), password (min 8), timezone (default from browser), locale → continues to onboarding (`onboarding-profile.md`).
- Coach can set a client inactive (can't log in, data kept) and reactivate.
- Password change and account deletion: `home-and-basics.md`.

## Authorization — security boundary, must have tests
- One shared module of helpers (e.g. `requireUser()`, `requireCoach()`, `requireClient()`, `requireCoachOf(clientId)`), used by every server action, route handler and data-loading server component. No ad-hoc checks.
- CLIENT reads/writes only their own data.
- COACH reads/writes only data of clients with `client.coachId === coach.id`, plus their own library.
- Coach notes are never readable by clients.
- Integration tests prove: a coach can't read or modify another coach's client; a client can't read another client's food log, photos, bloodwork or messages; a client can't read coach notes; an inactive client can't do anything.

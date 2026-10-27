# Client home & basic screens

## Client home "Today" `/app`
Widgets in this order, each only when relevant (visibility rule in `00-overview.md`, tracking mode):
1. Today overview: date, day type.
2. Today's nutrition goals: CALORIES kcal/macro progress; PORTIONS portion progress; GUIDANCE today's planned meals with followed status.
3. Training: today's sessions with fueling summary.
4. Hydration: fluid progress + quick add.
5. Competition: countdown, current phase, next tasks.
6. Check-in reminder (due / overdue) or "new feedback from coach".
7. Coach messages: latest unread message preview.
8. Upcoming events (7 days): sessions, calls, check-in day, competitions.

## Navigation
- Client: bottom nav, max 5 tabs, Messages tab with unread badge, "More" for the rest. Training / Competition items follow the visibility rule in `00-overview.md`.
- Coach: sidebar — Home, Clients, Check-ins, Messages, Calendar, Library, Settings.

## Notifications
- In-app only: bell with unread count, list, mark read / mark all read, each links to its target.
- Client types: new message, check-in due, feedback published, plan updated, call scheduled, competition phase started. Coach types: onboarding completed, check-in submitted, new message, client deleted their account.
- Created only via one server-side `notify(userId, type, payload)` helper called by the action that causes the event. Phase-start and check-in-due notifications are created lazily when the user loads the app (no cron).

## Calendar
- Month and week view. Items: training sessions, competitions, calls, check-in days — colour per type with icon + legend (colour is never the only cue). No nutrition.
- Client sees their own; coach sees all clients with a client filter.

## Settings
Language, timezone, notification types on/off. Coach also: welcome text for onboarding.

## Subscription / package
- Coach defines packages in the library: name, description, price (text, display only), duration in weeks, included features (list).
- Coach assigns a package to a client with a start date (end = start + duration).
- Client screen: current package, start / end, days left, included features. No payments.

## Help / FAQ
Static content in i18n files: using the app, tracking modes explained, hand-portion guide, how check-ins work, contacting the coach.

## Privacy & account
- Shows the linked Google account (email, name). No email or password change — that lives in Google.
- Download my data: JSON with all the client's data (file attachments listed by name).
- Delete account: confirmation by typing a confirmation word, deletes all the client's data and files, coach is notified.
- Privacy policy page rendered from `content/privacy.cs.md` / `content/privacy.en.md` (write a reasonable GDPR-style draft; the coach will edit it).

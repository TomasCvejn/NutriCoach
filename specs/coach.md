# Coach side

## Coach home `/coach`
- Tiles: active clients, check-ins waiting, unread messages, upcoming calls (7 days), competitions coming up (30 days, with client and days left), packages ending within 14 days.
- "Needs attention": nothing logged for 2+ days, overdue check-in, check-in to review, unread messages, onboarding done but no nutrition plan yet.
- Loads with a bounded number of queries (no per-client N+1).

## Client list `/coach/clients`
- Search by name; filters: status (active / inactive), tracking mode.
- Columns: name, mode, last logged day, 7-day adherence %, check-in status, next competition, unread messages. Sortable.
- Invite client + pending invites (`auth.md`).

## Individual client dashboard `/coach/clients/[id]`
- Header: name, mode, goal, next competition countdown; actions: message, schedule call, add note, change tracking mode.
- Tabs: Overview (goals, profile summary incl. allergies, current targets, last check-in, key trends) · Nutrition (plan editor + daily log viewer) · Training · Competition (plan editor) · Progress (incl. body composition, bloodwork) · Check-ins · Supplements · Messages · Notes.

## Coach notes
- Private, never visible to the client: date, type `NOTE` / `DECISION`, text, pin.
- Client history: one chronological feed of notes, decisions, plan / target changes, tracking mode changes, check-ins and feedback, competitions and results. Filter by type.

## Calls
- Coach schedules: client, date/time, duration, meeting link, agenda. Shown on coach home, both calendars, client home "Upcoming events"; client gets a notification.

## Library `/coach/library`
Custom foods, recipes, fueling templates, competition timeline templates, packages.

# Messaging (client ↔ coach)

- One thread per coach–client pair. Text (max 4000 chars) with up to 3 attachments (photos / files, upload rules from `00-overview.md`).
- Unread counts: per client for the coach (client list, nav badge), total for the client (nav badge). Opening the thread marks messages read.
- Open thread polls every 5 s; badges refresh on navigation. New message → `notify()`.
- Context comments: coach or client can comment on a specific nutrition day or check-in. Shown in that context AND in the thread as a message linking to it ("Comment on nutrition 12. 10.: …").
- No editing; the sender can delete their own message within 5 minutes.

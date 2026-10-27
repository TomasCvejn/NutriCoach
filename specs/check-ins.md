# Weekly check-in

## Schedule
- Per client check-in weekday (default Monday). Status: ok / due (weekday reached, not submitted) / overdue (2+ days after) / to review (submitted, not reviewed). Pure function with tests.
- On the due day the client gets a notification and a home reminder.

## Check-in screen (client)
Each a 1–10 scale + optional comment: energy, hunger, recovery, digestion, training / activity, nutrition adherence (self-rated), mood. Plus "Questions for coach" (long text). Link to add a body-composition entry.
ponytail: fixed question set; add a custom form builder when the coach needs different questions.

## Check-in results / coach feedback (client)
After the coach publishes: coach's response, changes made, new goals, next steps (four text fields). Client gets a notification. History of past check-ins with feedback.

## Check-in review dashboard (coach)
- Queue of check-ins to review, oldest first.
- Detail: answers; trends (sparkline of each scale over the last 8 check-ins); week context (adherence %, training minutes, latest weight); the client's private coach notes with an "add note" box; link to the nutrition plan editor for adjustments; feedback form → "Publish" marks it reviewed.

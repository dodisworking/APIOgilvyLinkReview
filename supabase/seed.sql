insert into videos (id, title, emoji, day, time, schedule_type, note, goes_live) values
  ('on-the-back-nine-review', 'On the Back Nine', '⛳', 'Tuesday', 'All day', 'review', 'Edit schedule + edit review Wednesday/Thursday, live Friday.', 'Friday'),
  ('behind-the-business-review', 'Behind the Business', '💼', 'Tuesday', 'All day', 'review', 'Edit review Wednesday/Thursday, live Friday.', 'Friday'),
  ('on-the-back-nine-record', 'On the Back Nine', '⛳', 'Tuesday', '10:00 AM', 'record', 'Records with host Dan Rapaport.', null),
  ('behind-the-business-record', 'Behind the Business', '💼', 'Tuesday', '4:00 PM', 'record', 'Recording slot.', null),
  ('pulse-check-pt1-record', 'The Pulse Check Pt 1', '📈', 'Wednesday', '9:00 AM', 'record', 'Deliver by next Thursday.', null),
  ('ahead-of-curve-1-record', 'Ahead of the Curve 1', '📊', 'Wednesday', '11:00 AM', 'record', 'Deliver Thursday.', null),
  ('course-management-business-record', 'Course Management for Business', '📚', 'Wednesday', '1:00 PM', 'record', 'Goes live Tuesday.', 'Tuesday'),
  ('ahead-of-curve-2-record', 'Ahead of the Curve 2', '📉', 'Wednesday', '2:00 PM', 'record', 'Goes live Thursday.', 'Thursday'),
  ('pulse-check-pt2-deliver', 'The Pulse Check Pt 2', '🧭', 'Thursday', '10:00 AM', 'deliver', 'Delivers next Thursday.', null),
  ('pop-up-city-1-deliver', 'The Pop Up City 1', '🏙️', 'Thursday', '11:00 AM', 'deliver', 'Delivers next Thursday.', null),
  ('pop-up-city-2-deliver', 'The Pop Up City 2', '🌆', 'Thursday', '3:00 PM', 'deliver', 'Delivers next Thursday.', null),
  ('unlocked-power-partnership', 'Unlocked the Power of Partnership', '🤝', 'Friday', '10:00 AM', 'go_live', 'Goes live Sunday.', 'Sunday'),
  ('executive-advantage', 'The Executive Advantage', '🎯', 'Friday', '2:00 PM', 'go_live', 'Goes live Sunday.', 'Sunday')
on conflict (id) do nothing;

insert into contacts (name, email, team) values
  ('Eddie', 'eddie@example.com', 'client'),
  ('Izzy', 'izzy@example.com', 'editor')
on conflict (email) do nothing;

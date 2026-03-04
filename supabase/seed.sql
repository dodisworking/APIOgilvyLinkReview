delete from videos
where id in (
  'on-the-back-nine-review',
  'behind-the-business-review',
  'on-the-back-nine-record',
  'behind-the-business-record',
  'pulse-check-pt1-record',
  'ahead-of-curve-1-record',
  'course-management-business-record',
  'ahead-of-curve-2-record',
  'pulse-check-pt2-deliver',
  'pop-up-city-1-deliver',
  'pop-up-city-2-deliver',
  'on-the-back-nine',
  'behind-the-business',
  'pulse-check-pt1',
  'ahead-of-curve-1',
  'course-management-for-business',
  'ahead-of-curve-2',
  'pulse-check-pt2',
  'pop-up-city-1',
  'pop-up-city-2',
  'unlocked-power-partnership',
  'executive-advantage'
);

insert into videos (id, title, emoji, day, time, schedule_type, note, goes_live) values
  ('on-the-back-nine', 'On the Back Nine', '⛳', 'Tuesday', '10:00 AM', 'record', 'Tuesday record. Goes live Friday.', 'Friday'),
  ('behind-the-business', 'Behind the Business', '💼', 'Tuesday', '4:00 PM', 'record', 'Tuesday record. Goes live Friday.', 'Friday'),
  ('pulse-check-pt1', 'The Pulse Check Pt 1', '📈', 'Wednesday', '9:00 AM', 'record', 'Wednesday record. Goes live by next Thursday.', 'Next Thursday'),
  ('ahead-of-curve-1', 'Ahead of the Curve 1', '📊', 'Wednesday', '11:00 AM', 'record', 'Wednesday record. Goes live this Thursday.', 'Thursday'),
  ('course-management-for-business', 'Course Management for Business', '📚', 'Wednesday', '1:00 PM', 'record', 'Wednesday record. Goes live this Thursday.', 'Thursday'),
  ('ahead-of-curve-2', 'Ahead of the Curve 2', '📉', 'Wednesday', '2:00 PM', 'record', 'Wednesday record. Goes live this Thursday.', 'Thursday'),
  ('pulse-check-pt2', 'The Pulse Check Pt 2', '🧭', 'Thursday', '10:00 AM', 'record', 'Thursday record. Goes live by next Thursday.', 'Next Thursday'),
  ('pop-up-city-1', 'The Pop Up City 1', '🏙️', 'Thursday', '11:00 AM', 'record', 'Thursday record. Goes live by next Thursday.', 'Next Thursday'),
  ('pop-up-city-2', 'The Pop Up City 2', '🌆', 'Thursday', '3:00 PM', 'record', 'Thursday record. Goes live by next Thursday.', 'Next Thursday'),
  ('unlocked-power-partnership', 'Unlocked the Power of Partnership', '🤝', 'Friday', '10:00 AM', 'record', 'Friday record. Goes live Sunday.', 'Sunday'),
  ('executive-advantage', 'The Executive Advantage', '🎯', 'Friday', '2:00 PM', 'record', 'Friday record. Goes live Sunday.', 'Sunday')
on conflict (id) do update
set
  title = excluded.title,
  emoji = excluded.emoji,
  day = excluded.day,
  time = excluded.time,
  schedule_type = excluded.schedule_type,
  note = excluded.note,
  goes_live = excluded.goes_live;

insert into contacts (name, email, team) values
  ('Eddie', 'eddie@example.com', 'client'),
  ('Izzy', 'izzy@example.com', 'editor')
on conflict (email) do nothing;

// Best-effort natural language time parser -> canonical 'HH:MM' 24h string.
// Not exhaustive by design - covers what people actually type on WhatsApp.
function parseTime(text) {
  const s = (text || '').toLowerCase();

  const named = {
    morning: '07:00', afternoon: '13:00', evening: '18:00',
    night: '21:00', noon: '12:00', midnight: '00:00',
  };
  for (const key of Object.keys(named)) {
    if (s.includes(key)) return named[key];
  }

  const match = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (match) {
    let hour = parseInt(match[1], 10);
    const minute = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = match[3];
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  }

  return '07:00';
}

module.exports = { parseTime };

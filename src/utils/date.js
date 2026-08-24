function todayStr(timezone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function nowHHMM(timezone) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date());
}

function addDaysStr(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Converts a wall-clock "HH:MM" on a given "YYYY-MM-DD" in `timezone` into a
 * real UTC instant (ISO string) — e.g. "2026-08-24" + "09:00" + "Asia/Kolkata"
 * -> "2026-08-24T03:30:00.000Z". Used by the local-notification reminder
 * planner to turn a user's reminder times into exact moments a device can
 * schedule an alarm for, regardless of what timezone the server itself runs in.
 */
function localTimeToUTCISOString(dateStr, hhmm, timezone) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = hhmm.split(':').map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(utcGuess).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});

  const asUtcIfWallClockWereUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) === 24 ? 0 : Number(parts.hour), Number(parts.minute), Number(parts.second)
  );
  const offsetMs = asUtcIfWallClockWereUtc - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offsetMs).toISOString();
}

function addMinutesToHHMM(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = ((h * 60 + m + minutes) % (24 * 60) + 24 * 60) % (24 * 60);
  const newH = Math.floor(total / 60);
  const newM = total % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

module.exports = { todayStr, nowHHMM, addDaysStr, localTimeToUTCISOString, addMinutesToHHMM };

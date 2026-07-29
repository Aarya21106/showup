const express = require('express');
const basicAuth = require('express-basic-auth');
const config = require('../config');
const db = require('../db/db');

const router = express.Router();

if (config.admin.password) {
  router.use(basicAuth({
    users: { [config.admin.user]: config.admin.password },
    challenge: true,
    realm: 'ShowUp Admin',
  }));
} else {
  router.use((req, res, next) => {
    console.warn('ADMIN_PASSWORD is not set - /admin is running WITHOUT auth. Set it before deploying.');
    next();
  });
}

function computePayout(user) {
  if (user.deposit_status !== 'paid') return null;
  const missed = user.missed_count;
  if (missed === 0 && user.day_count >= config.pledgeDays) return config.fullPayoutInr;
  return Math.max(config.depositAmountInr - config.slipPenaltyInr * missed, 0);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

router.get('/', (req, res) => {
  const users = db.getAllUsers();
  const rows = users.map((u) => {
    const payout = computePayout(u);
    return `<tr>
      <td>${escapeHtml(u.name || '(unnamed)')}</td>
      <td>${escapeHtml(u.phone)}</td>
      <td>${escapeHtml(u.activity || '-')}</td>
      <td>${escapeHtml(u.state)}</td>
      <td>${escapeHtml(u.deposit_status)}</td>
      <td>${u.streak}</td>
      <td>${u.missed_count}</td>
      <td>${u.day_count}/${config.pledgeDays}</td>
      <td>${payout === null ? '-' : '₹' + payout}</td>
    </tr>`;
  }).join('\n');

  res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>ShowUp Admin</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0b0f0d; color: #eee; padding: 24px; }
  h1 { color: #35e08a; margin-bottom: 4px; }
  p { color: #9fb3a8; margin-top: 0; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #263229; padding: 8px 12px; text-align: left; font-size: 14px; }
  th { background: #16201a; color: #9fb3a8; }
  tr:nth-child(even) { background: #10140f; }
</style>
</head>
<body>
<h1>ShowUp Admin</h1>
<p>${users.length} users - refunds are processed manually via UPI using this list.</p>
<table>
<thead><tr>
  <th>Name</th><th>Phone</th><th>Activity</th><th>State</th><th>Deposit</th>
  <th>Streak</th><th>Missed</th><th>Day</th><th>Payout owed</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>
</body>
</html>`);
});

module.exports = router;

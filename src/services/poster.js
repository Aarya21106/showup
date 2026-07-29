const fs = require('fs');
const path = require('path');
const nodeHtmlToImage = require('node-html-to-image');
const config = require('../config');

const TEMPLATE = fs.readFileSync(path.join(__dirname, '..', 'templates', 'poster.html'), 'utf8');
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'generated');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

/**
 * Renders a poster PNG from the shared template and returns both the local file path
 * (for direct disk access) and the public URL Twilio needs to fetch the image.
 */
async function renderPoster({ filename, heading, subheading, line1, name, quote, footer }) {
  const outputPath = path.join(OUTPUT_DIR, filename);
  await nodeHtmlToImage({
    output: outputPath,
    html: TEMPLATE,
    content: { heading, subheading, line1, name, quote, footer: footer || '' },
    puppeteerArgs: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
  });
  return { outputPath, publicUrl: `${config.publicBaseUrl}/posters/${filename}` };
}

function renderPlanPoster({ userId, name, activity, days, time, blocker }) {
  return renderPoster({
    filename: `plan-${userId}-${Date.now()}.png`,
    heading: `${config.pledgeDays}-DAY`,
    subheading: 'PLEDGE',
    line1: `${activity} — ${days} days/week, ${time}`,
    name,
    quote: `"${blocker}" — not this time.`,
    footer: 'SHOWUP.FIT',
  });
}

function renderFinalPoster({ userId, name, activity, completedDays, payout }) {
  const success = payout >= config.fullPayoutInr;
  return renderPoster({
    filename: `final-${userId}-${Date.now()}.png`,
    heading: success ? 'PLEDGE' : `${completedDays}/${config.pledgeDays}`,
    subheading: success ? 'COMPLETE' : 'DAYS SHOWED UP',
    line1: activity,
    name,
    quote: success
      ? `Showed up every single day. ₹${payout} earned.`
      : `Showed up ${completedDays} of ${config.pledgeDays} days. ₹${payout} back.`,
    footer: 'SHOWUP.FIT',
  });
}

module.exports = { renderPoster, renderPlanPoster, renderFinalPoster };

const config = require('../src/config');
const twilio = require('twilio');

if (!config.twilioConfigured) {
  console.error('Twilio is not configured in .env');
  process.exit(1);
}

const client = twilio(config.twilio.accountSid, config.twilio.authToken);
const from = config.twilio.from;
const to = 'whatsapp:+919500665712';

console.log('Sending from:', from);
console.log('Sending to:', to);

async function testSend() {
  try {
    const message = await client.messages.create({
      from,
      to,
      body: 'Hello from GymBot test script!'
    });
    console.log('Success! Message SID:', message.sid);
  } catch (err) {
    console.error('Error sending message:');
    console.error('Status:', err.status);
    console.error('Code:', err.code);
    console.error('Message:', err.message);
    console.error('More Info:', err.moreInfo);
  }
}

testSend();

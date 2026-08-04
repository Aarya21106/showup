const axios = require('axios');
const config = require('../src/config');

if (!config.twilioConfigured) {
  console.error('Twilio is not configured in .env');
  process.exit(1);
}

const accountSid = config.twilio.accountSid;
const authToken = config.twilio.authToken;
const from = config.twilio.from;
const to = 'whatsapp:+919500665712';

console.log('Sending RAW HTTP post...');
console.log('From:', from);
console.log('To:', to);

async function testSend() {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  
  const params = new URLSearchParams();
  params.append('From', from);
  params.append('To', to);
  params.append('Body', 'Hello from raw HTTP test script!');

  try {
    const res = await axios.post(url, params, {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    console.log('Success! Message SID:', res.data.sid);
  } catch (err) {
    if (err.response) {
      console.error('API Error:', err.response.status, err.response.data);
    } else {
      console.error('Network Error:', err.message);
    }
  }
}

testSend();

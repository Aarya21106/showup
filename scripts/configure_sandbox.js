const config = require('../src/config');
const twilio = require('twilio');

if (!config.twilioConfigured) {
  console.error('Twilio is not configured in .env');
  process.exit(1);
}

const client = twilio(config.twilio.accountSid, config.twilio.authToken);

async function inspectTwilio() {
  try {
    console.log('--- Inspecting Twilio Account Configurations ---');
    console.log('Account SID:', config.twilio.accountSid);

    // 1. List Incoming Phone Numbers
    console.log('\n1. Fetching Incoming Phone Numbers...');
    const numbers = await client.incomingPhoneNumbers.list();
    if (numbers.length === 0) {
      console.log('No Twilio numbers found on this account.');
    } else {
      numbers.forEach(num => {
        console.log(` - Number: ${num.phoneNumber} (SID: ${num.sid})`);
        console.log(`   SMS URL: ${num.smsUrl}`);
        console.log(`   SMS Method: ${num.smsMethod}`);
      });
    }

    // 2. Fetch Sandbox configurations using the correct SDK path (if any)
    console.log('\n2. Checking Messaging Services...');
    const services = await client.messaging.v1.services.list();
    if (services.length === 0) {
      console.log('No Messaging Services found.');
    } else {
      for (const service of services) {
        console.log(` - Service: ${service.friendlyName} (SID: ${service.sid})`);
        console.log(`   Inbound Request URL: ${service.inboundRequestUrl}`);
      }
    }

  } catch (err) {
    console.error('Error inspecting Twilio:', err.message);
  }
}

inspectTwilio();

if (process.env.MOCK_WHATSAPP === 'true') {
  module.exports = {
    sendText: async (to, body) => {
      console.log(`\n[Bot reply to ${to}]:\n${body}\n`);
      try {
        const db = require('../db/db');
        const user = db.getUserByPhone(to);
        if (user) {
          db.saveChatMessage(user.id, 'model', body);
        }
      } catch (err) {
        console.error('Error saving mock text message:', err);
      }
      return { success: true };
    },
    sendMedia: async (to, body, mediaUrl) => {
      console.log(`\n[Bot media reply to ${to}] (URL: ${mediaUrl}):\n${body}\n`);
      try {
        const db = require('../db/db');
        const user = db.getUserByPhone(to);
        if (user) {
          db.saveChatMessage(user.id, 'model', body);
        }
      } catch (err) {
        console.error('Error saving mock media message:', err);
      }
      return { success: true };
    },
    fetchInboundMedia: async (mediaUrl) => {
      return Buffer.from('');
    },
    isMock: true
  };
  return;
}

const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

let sock = null;
let isConnected = false;
let pairingCodeRequested = false;
let latestQrDataUrl = null;
let makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers;

async function getBaileys() {
  if (!makeWASocket) {
    const baileys = await import('@whiskeysockets/baileys');
    makeWASocket = baileys.default || baileys.makeWASocket;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    DisconnectReason = baileys.DisconnectReason;
    Browsers = baileys.Browsers;
  }
  return { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers };
}

// Converts a Twilio-style JID ('whatsapp:+919500665712') to Baileys format ('919500665712@s.whatsapp.net')
function toBaileysJid(whatsappPhone) {
  const clean = whatsappPhone.replace('whatsapp:', '').replace('+', '').trim();
  return `${clean}@s.whatsapp.net`;
}

// Converts a Baileys JID ('919500665712@s.whatsapp.net') to Twilio-style JID ('whatsapp:+919500665712')
function toWhatsappPhone(baileysJid) {
  const clean = baileysJid.split('@')[0];
  return `whatsapp:+${clean}`;
}

// Maps a public URL to a local file in generated/ directory if it is a plan/final poster
function getLocalPath(mediaUrl) {
  if (!mediaUrl) return null;
  const parts = mediaUrl.split('/');
  const filename = parts[parts.length - 1];
  const localFile = path.join(__dirname, '..', '..', 'generated', filename);
  if (fs.existsSync(localFile)) {
    return localFile;
  }
  return null;
}

async function connectToWhatsApp() {
  const { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = await getBaileys();
  const authFolder = path.join(__dirname, '..', '..', 'auth_info_baileys');
  
  const usePairingCode = process.env.USE_PAIRING_CODE === 'true';
  let pairingPhone = process.env.WHATSAPP_PHONE ? process.env.WHATSAPP_PHONE.replace(/[^0-9]/g, '') : null;
  
  if (pairingPhone && pairingPhone.length === 10) {
    pairingPhone = '91' + pairingPhone; // Auto-prefix India country code
  }

  const { state, saveCreds } = await useMultiFileAuthState(authFolder);

  console.log('[WhatsApp] Connecting to WhatsApp Web protocol...');

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: !usePairingCode,
    browser: Browsers ? Browsers.ubuntu('Chrome') : ['Ubuntu', 'Chrome', '20.0.04'],
    syncFullHistory: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
    markOnlineOnConnect: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        latestQrDataUrl = await QRCode.toDataURL(qr);
      } catch (e) {}

      if (usePairingCode && pairingPhone && !state.creds.registered && !pairingCodeRequested) {
        pairingCodeRequested = true;
        try {
          console.log(`[WhatsApp] Requesting single pairing code for phone: +${pairingPhone}...`);
          const code = await sock.requestPairingCode(pairingPhone);
          const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
          console.log('\n==================================================');
          console.log(`   YOUR WHATSAPP PAIRING CODE FOR +${pairingPhone} IS: ${formattedCode}   `);
          console.log('   (Enter this in WhatsApp -> Linked Devices)   ');
          console.log('==================================================\n');
        } catch (err) {
          console.error('[WhatsApp] Failed to request pairing code:', err.message);
          pairingCodeRequested = false;
        }
      }
      
      console.log('\n==================================================');
      console.log('   SCAN THIS QR CODE OR OPEN /qr ON YOUR WEBSITE   ');
      console.log('==================================================');
      qrcode.generate(qr, { small: true });
      console.log('==================================================\n');
    }

    if (connection === 'close') {
      isConnected = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldClear = statusCode === DisconnectReason.loggedOut; // Only wipe on explicit phone logout (403)
      console.log(`[WhatsApp] Connection closed. Status: ${statusCode}. Clearing credentials? ${shouldClear}`);
      if (shouldClear) {
        pairingCodeRequested = false;
        console.log('[WhatsApp] Explicit logout detected. Wiping credentials folder...');
        try {
          fs.rmSync(authFolder, { recursive: true, force: true });
        } catch (e) {
          console.error('[WhatsApp] Failed to delete session folder:', e.message);
        }
        console.log('[WhatsApp] Reconnecting with clean state...');
        setTimeout(connectToWhatsApp, 2000);
      } else {
        console.log('[WhatsApp] Temporary disconnect. Reconnecting with existing session in 3 seconds...');
        setTimeout(connectToWhatsApp, 3000);
      }
    } else if (connection === 'open') {
      isConnected = true;
      console.log('\n==================================================');
      console.log('🎉 WhatsApp Bot is connected and live!');
      console.log('==================================================\n');
    }
  });

  sock.ev.on('messages.upsert', async (upsert) => {
    console.log('[WhatsApp] messages.upsert received, type:', upsert.type, 'count:', upsert.messages?.length);
    if (upsert.type !== 'notify') return;
    for (const msg of upsert.messages) {
      console.log('[WhatsApp] Processing msg:', JSON.stringify(msg, null, 2));
      if (msg.key.fromMe) continue; // ignore self messages
      if (!msg.message) continue;

      let remoteJid = msg.key.remoteJid;
      if (msg.key.remoteJidAlt && (msg.key.remoteJidAlt.endsWith('@s.whatsapp.net') || msg.key.remoteJidAlt.endsWith('@c.us'))) {
        remoteJid = msg.key.remoteJidAlt;
      }

      if (!remoteJid.endsWith('@s.whatsapp.net') && !remoteJid.endsWith('@c.us') && !remoteJid.endsWith('@lid')) continue; // ignore groups/broadcasts

      const phone = toWhatsappPhone(remoteJid);
      
      // Extract text message body
      const body = msg.message.conversation || 
                   msg.message.extendedTextMessage?.text || 
                   msg.message.imageMessage?.caption || '';

      console.log(`[WhatsApp] Incoming from ${phone}: "${body}"`);

      // Extract image message if present
      let media = null;
      if (msg.message.imageMessage) {
        try {
          console.log('[WhatsApp] Downloading check-in image...');
          const { downloadMediaMessage } = require('@whiskeysockets/baileys');
          const buffer = await downloadMediaMessage(msg, 'buffer', {});
          media = {
            testBase64: buffer.toString('base64'),
            mimeType: msg.message.imageMessage.mimetype || 'image/jpeg'
          };
          console.log('[WhatsApp] Image downloaded successfully.');
        } catch (err) {
          console.error('[WhatsApp] Error downloading image:', err);
        }
      }

      // Route to incoming message handler
      try {
        const { handleIncomingMessage } = require('../conversation/router');
        await handleIncomingMessage({ phone, body, media });
      } catch (err) {
        console.error('[WhatsApp] Error processing message:', err);
      }
    }
  });
}

// Start connection on import
connectToWhatsApp();

async function sendText(to, body) {
  try {
    const db = require('../db/db');
    const user = db.getUserByPhone(to);
    if (user) {
      db.saveChatMessage(user.id, 'model', body);
    }
  } catch (err) {
    console.error('Error saving text message to db:', err);
  }

  if (!isConnected || !sock) {
    console.warn(`[WhatsApp] Cannot sendText. Client not connected yet. Message: "${body}"`);
    return { mock: true };
  }
  const jid = toBaileysJid(to);
  console.log(`[WhatsApp] Sending text to ${to}: "${body}"`);
  await sock.sendMessage(jid, { text: body });
  return { success: true };
}

async function sendMedia(to, body, mediaUrl) {
  try {
    const db = require('../db/db');
    const user = db.getUserByPhone(to);
    if (user) {
      db.saveChatMessage(user.id, 'model', body);
    }
  } catch (err) {
    console.error('Error saving media message to db:', err);
  }

  if (!isConnected || !sock) {
    console.warn(`[WhatsApp] Cannot sendMedia. Client not connected yet. Media: ${mediaUrl}`);
    return { mock: true };
  }
  const jid = toBaileysJid(to);
  const localFile = getLocalPath(mediaUrl);

  console.log(`[WhatsApp] Sending media to ${to}. Caption: "${body}"`);

  if (localFile && fs.existsSync(localFile)) {
    console.log(`[WhatsApp] Loading media from local path: ${localFile}`);
    await sock.sendMessage(jid, {
      image: fs.readFileSync(localFile),
      caption: body
    });
  } else {
    console.log(`[WhatsApp] Loading media from remote URL: ${mediaUrl}`);
    await sock.sendMessage(jid, {
      image: { url: mediaUrl },
      caption: body
    });
  }
  return { success: true };
}

async function fetchInboundMedia(mediaUrl) {
  throw new Error('fetchInboundMedia should not be called with Baileys. Media is processed inline.');
}

module.exports = {
  sendText,
  sendMedia,
  fetchInboundMedia,
  getLatestQrDataUrl: () => latestQrDataUrl,
  getIsConnected: () => isConnected,
  isMock: false
};

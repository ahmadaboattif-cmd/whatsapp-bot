const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 8080;

// تشغيل سيرفر الويب فوراً عشان يمنع مشكلة الـ Timeout
app.get('/', (req, res) => {
    res.send('Bot is running successfully!');
});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
    // بدء تشغيل البوت بعد إقلاع السيرفر بثواني
    setTimeout(startBot, 2000);
});

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state
    });

    if (!sock.authState.creds.registered) {
        const phoneNumber = "201553274163"; // اكتب رقمك هنا بمفتاح الدولة وبدون علامة +
        try {
            let code = await sock.requestPairingCode(phoneNumber);
            console.log(`🔐 YOUR 8-DIGIT PAIRING CODE IS: ${code}`);
        } catch (error) {
            console.error('Error requesting pairing code:', error);
        }
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed, reconnecting...', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('[+] BOT CONNECTED & READY!');
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

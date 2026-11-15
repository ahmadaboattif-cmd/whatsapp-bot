const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const express = require('express');

// 1. سيرفر الـ Express الوهمي عشان البورت السحابي يفضل شغال 24 ساعة
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running 24/7!'));
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

// 2. تشغيل بوت الواتساب بكود الـ 8 أرقام
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state
    });

    if (!sock.authState.creds.registered) {
        const phoneNumber = "201234567890"; // <--- اكتب رقمك هنا بمفتاح الدولة بدل الرقم ده
        setTimeout(async () => {
            let code = await sock.requestPairingCode(phoneNumber);
            console.log(`\n========================================`);
            console.log(`🔐 YOUR 8-DIGIT PAIRING CODE IS: ${code}`);
            console.log(`========================================\n`);
        }, 3000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('[+] BOT CONNECTED & READY!');
        }
    });
}

connectToWhatsApp();

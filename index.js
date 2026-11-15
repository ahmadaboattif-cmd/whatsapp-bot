const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
    res.send('Bot is running successfully!');
});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
    setTimeout(startBot, 3000);
});

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state
    });

    // التأكد من عدم تسجيل الدخول مسبقاً لطلب الكود برقمك الصحيح
    if (!sock.authState.creds.registered) {
        // حط رقمك هنا بمفتاح الدولة وبدون علامة + (مثلاً: 2010xxxxxxxx)
        const phoneNumber = "201553274163"; 
        
        // تأخير بسيط لمدة 5 ثواني لضمان استقرار الاتصال قبل طلب الكود
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                console.log(`🔐 YOUR 8-DIGIT PAIRING CODE IS: ${code}`);
            } catch (error) {
                console.error('Error requesting pairing code:', error);
            }
        }, 5000);
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

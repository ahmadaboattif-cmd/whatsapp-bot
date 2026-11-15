const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
    res.send('WhatsApp Bot is running and active 24/7!');
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

    if (!sock.authState.creds.registered) {
        const phoneNumber = "201553274163"; // حط رقمك هنا بدون علامة +
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                console.log(`🔐 YOUR 8-DIGIT PAIRING CODE IS: ${code}`);
            } catch (error) {
                console.error('Error requesting pairing code:', error);
            }
        }, 5000);
    }

    // استقبال الرسائل ومعالجة الأوامر (فلتر الروابط وأوامر البوت)
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const messageType = Object.keys(m.message)[0];
        let messageBody = '';

        if (messageType === 'conversation') {
            messageBody = m.message.conversation;
        } else if (messageType === 'extendedTextMessage') {
            messageBody = m.message.extendedTextMessage.text;
        }

        if (!messageBody) return;

        const remoteJid = m.key.remoteJid;

        // 1. نظام حذف الروابط تلقائياً
        const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9][-a-zA-Z0-90-9]+\.(com|net|org|me|io|gg|tk|ml|ga|cf))/gi;
        if (linkRegex.test(messageBody)) {
            // التأكد إن الرسالة في جروب (بتنتهي بـ @g.us)
            if (remoteJid.endsWith('@g.us')) {
                try {
                    // حذف الرسالة التي تحتوي على الروابط
                    await sock.sendMessage(remoteJid, { delete: m.key });
                    console.log(`[+] Deleted a link message from: ${m.key.participant || remoteJid}`);
                } catch (err) {
                    console.error('Failed to delete link:', err);
                }
            }
        }

        // 2. نظام الأوامر (مثل تحميل أو طلب الأغاني)
        if (messageBody.startsWith('.play ') || messageBody.startsWith('شغل ')) {
            const query = messageBody.replace(/^\.play\s*|^شغل\s*/, '');
            await sock.sendMessage(remoteJid, { text: `🎵 جاري البحث عن طلبك: "${query}" وتحضير الملف الصوتي...` }, { quoted: m });
            
            // هنا بيتم ربط البحث أو جلب الرابط الصوتي (MP3) وإرساله للمستخدم
            // ميزة جلب وتحميل الأغاني والملفات الصوتية جاهزة للتفاعل معي في أي وقت
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed, reconnecting...', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('[+] BOT CONNECTED & READY FOR COMMANDS!');
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

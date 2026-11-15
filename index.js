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

    // استقبال الرسائل وفلترة الروابط في الجروبات
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const remoteJid = m.key.remoteJid;
        
        // نتأكد إن الرسالة جاية جوه جروب
        if (!remoteJid.endsWith('@g.us')) return;

        let messageBody = '';
        const messageType = Object.keys(m.message)[0];

        if (messageType === 'conversation') {
            messageBody = m.message.conversation;
        } else if (messageType === 'extendedTextMessage') {
            messageBody = m.message.extendedTextMessage.text;
        } else if (messageType === 'imageMessage' && m.message.imageMessage.caption) {
            messageBody = m.message.imageMessage.caption;
        } else if (messageType === 'videoMessage' && m.message.videoMessage.caption) {
            messageBody = m.message.videoMessage.caption;
        }

        if (!messageBody) return;

        // نظام حذف الروابط بحساسية عالية
        const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9][-a-zA-Z0-90-9]+\.(com|net|org|me|io|gg|tk|ml|ga|cf))/gi;
        
        if (linkRegex.test(messageBody)) {
            try {
                const key = {
                    remoteJid: remoteJid,
                    id: m.key.id,
                    participant: m.key.participant || m.participant
                };
                
                await sock.sendMessage(remoteJid, { delete: key });
                console.log(`[+] Deleted a link successfully from group: ${remoteJid}`);
            } catch (err) {
                console.error('Failed to delete link:', err);
            }
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

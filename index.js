const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const yts = require('yt-search');
const ytdl = require('@distube/ytdl-core');

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
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ['Ubuntu', 'Chrome', '20.0.04']
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        
        for (const m of messages) {
            if (!m.message || m.key.fromMe) continue;

            const remoteJid = m.key.remoteJid;
            const isGroup = remoteJid.endsWith('@g.us');

            // استخراج النص من أي نوع رسالة
            const messageType = Object.keys(m.message)[0];
            let messageBody = '';
            if (messageType === 'conversation') {
                messageBody = m.message.conversation;
            } else if (messageType === 'extendedTextMessage') {
                messageBody = m.message.extendedTextMessage.text;
            } else if (messageType === 'imageMessage') {
                messageBody = m.message.imageMessage.caption || '';
            } else if (messageType === 'videoMessage') {
                messageBody = m.message.videoMessage.caption || '';
            }

            if (!messageBody) continue;

            // ==========================================
            // 1. فلتر حذف الروابط في الجروبات (فوري)
            // ==========================================
            const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(chat\.whatsapp\.com\/[^\s]+)|([a-zA-Z0-9-]+\.(com|net|org|me|io|gg|tk|ml|ga|cf|xyz|site|online))/gi;
            
            if (isGroup && linkRegex.test(messageBody)) {
                try {
                    const sender = m.key.participant || m.participant;
                    await sock.sendMessage(remoteJid, {
                        delete: {
                            remoteJid: remoteJid,
                            fromMe: false,
                            id: m.key.id,
                            participant: sender
                        }
                    });
                    console.log(`[+] تم حذف رابط من الجروب بنجاح!`);
                    continue; // نوقف باقي الأوامر لو الرسالة اتمسحت
                } catch (err) {
                    console.error('فشل حذف الرابط (تأكد إن البوت أدمن):', err);
                }
            }

            // ==========================================
            // 2. أمر البحث وتحميل الأغاني MP3
            // ==========================================
            const lowerBody = messageBody.trim().toLowerCase();
            if (lowerBody.startsWith('.play ') || lowerBody.startsWith('شغل ')) {
                const query = messageBody.replace(/^(\.play|شغل)\s+/i, '').trim();
                if (!query) return;

                try {
                    await sock.sendMessage(remoteJid, { text: `⏳ جاري البحث عن: *${query}*...` }, { quoted: m });

                    // البحث في يوتيوب
                    const searchResults = await yts(query);
                    const video = searchResults.videos[0];

                    if (!video) {
                        await sock.sendMessage(remoteJid, { text: '❌ ملقتش أي نتيجة للأغنية دي.' }, { quoted: m });
                        continue;
                    }

                    await sock.sendMessage(remoteJid, { text: `🎵 جاري تحميل وإرسال: *${video.title}* (${video.timestamp})` }, { quoted: m });

                    // تحميل الصوت وإرساله مباشرة كـ MP3
                    const audioStream = ytdl(video.url, { filter: 'audioonly', quality: 'highestaudio' });
                    const chunks = [];
                    for await (const chunk of audioStream) {
                        chunks.push(chunk);
                    }
                    const audioBuffer = Buffer.concat(chunks);

                    await sock.sendMessage(remoteJid, {
                        audio: audioBuffer,
                        mimetype: 'audio/mp4',
                        ptt: false // خليها true لو عايزها تتبعت كـ ريكورد (فويس نوت)
                    }, { quoted: m });

                    console.log(`[+] تم إرسال الأغنية: ${video.title}`);
                } catch (error) {
                    console.error('خطأ في تحميل الأغنية:', error);
                    await sock.sendMessage(remoteJid, { text: '⚠️ حصلت مشكلة أثناء تحميل الأغنية، جرب اسم تاني.' }, { quoted: m });
                }
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

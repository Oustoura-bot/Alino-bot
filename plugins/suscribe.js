import fs from 'fs';
import moment from 'moment-timezone';

// --- Subscription Reading Logic (Similar to other plugins) --- START ---
const SUBS_FILE = './subscriptions.json'; // Path to the subscription file

function readSubscriptions() {
    try {
        if (fs.existsSync(SUBS_FILE)) {
            const data = fs.readFileSync(SUBS_FILE, 'utf8');
            return JSON.parse(data);
        } else {
            return {};
        }
    } catch (error) {
        console.error("Error reading subscriptions file:", error);
        return {};
    }
}
// --- Subscription Reading Logic --- END ---

let handler = async (m, { conn, text, usedPrefix, command }) => {
    let userId = m.sender;

    // --- Owner Check --- (Only owner can view the list)
    const ownerJids = (global.owner || []).map(v => String(v).replace(/[^0-9]/g, '') + '@s.whatsapp.net');
    if (!ownerJids.includes(userId)) {
        return m.reply('*╔═════ 🚫 ممنوع ═════╗*\n*║* هذا الأمر مخصص للمالك فقط.\n*╚═════════════════╝*');
    }
    // --- End Owner Check ---

    const subscriptions = readSubscriptions();
    const subscriberIds = Object.keys(subscriptions);

    if (subscriberIds.length === 0) {
        return m.reply('*╔═════ ℹ️ معلومات ═════╗*\n*║* لا يوجد مشتركين حالياً في الملف.\n*╚══════════════════╝*');
    }

    let replyMsg = '*╔═════ 👥 قائمة المشتركين ═════╗*\n';
    let count = 1;

    for (const subId of subscriberIds) {
        const subInfo = subscriptions[subId];
        const expiryDate = subInfo.expiry ? moment(subInfo.expiry).tz('Africa/Casablanca').format('YYYY-MM-DD HH:mm:ss') : 'غير محدد';
        const userTag = subId.replace('@s.whatsapp.net', ''); // Get number part

        replyMsg += `*║* ${count}. @${userTag}\n`;
        replyMsg += `*║*   └── *تاريخ الانتهاء:* ${expiryDate}\n`;
        count++;
    }

    replyMsg += '*╚════════════════════════╝*';

    // Send the message tagging the users
    conn.reply(m.chat, replyMsg, m, {
        mentions: subscriberIds // Tag all subscribers in the message
    });
};

handler.help = ['.المشتركين'];
handler.tags = ['owner']; // Tag for owner commands
handler.command = ['المشتركين', 'subslist', 'list subs'];
handler.owner = true; // Restrict to owner

export default handler;


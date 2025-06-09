import fs from 'fs';
import moment from 'moment-timezone';

const SUBS_FILE = './subscriptions.json'; // Store in the root directory of the bot

// Function to read subscriptions
function readSubscriptions() {
    try {
        if (fs.existsSync(SUBS_FILE)) {
            const data = fs.readFileSync(SUBS_FILE, 'utf8');
            return JSON.parse(data);
        } else {
            return {}; // Return empty object if file doesn't exist
        }
    } catch (error) {
        console.error("Error reading subscriptions file:", error);
        return {}; // Return empty object on error
    }
}

// Function to write subscriptions
function writeSubscriptions(data) {
    try {
        fs.writeFileSync(SUBS_FILE, JSON.stringify(data, null, 2)); // Pretty print JSON
    } catch (error) {
        console.error("Error writing subscriptions file:", error);
    }
}

let handler = async (m, { conn, args, text, command, usedPrefix }) => {
    // --- Owner Check (Assuming global.owner is set) ---
    const ownerJids = (global.owner || []).map(v => String(v).replace(/[^0-9]/g, '') + '@s.whatsapp.net');
    if (!ownerJids.includes(m.sender)) {
        return m.reply('🔒 هذا الأمر مخصص للمالك فقط.');
    }
    // --- End Owner Check ---

    if (!m.mentionedJid || m.mentionedJid.length === 0) {
        return m.reply(`*╔═════ ⚠️ تحذير ═════╗*\n*║* يرجى الإشارة (mention) إلى المستخدم \n*║* الذي تريد إضافة/تحديث اشتراكه.\n*║* \n*║* *مثال:* ${usedPrefix + command} @المستخدم 30\n*╚═════════════════╝*`);
    }

    let userId = m.mentionedJid[0];
    let daysToAdd = parseInt(args[1]);

    if (isNaN(daysToAdd) || daysToAdd <= 0) {
        return m.reply(`*╔═════ ⚠️ تحذير ═════╗*\n*║* يرجى تحديد عدد أيام صالح للاشتراك \n*║* (يجب أن يكون رقمًا أكبر من صفر).\n*║* \n*║* *مثال:* ${usedPrefix + command} @المستخدم 30\n*╚═════════════════╝*`);
    }

    let subscriptions = readSubscriptions();
    const now = moment();
    const currentExpiry = subscriptions[userId] ? moment(subscriptions[userId].expiry) : null;
    let newExpiryDate;

    // If user already has an active subscription, add days to it
    if (currentExpiry && currentExpiry.isAfter(now)) {
        newExpiryDate = currentExpiry.add(daysToAdd, 'days');
    } else {
        // Otherwise, start the subscription from now
        newExpiryDate = now.add(daysToAdd, 'days');
    }

    const expiryDateISO = newExpiryDate.toISOString(); // Store expiry date in ISO format (UTC)

    subscriptions[userId] = {
        expiry: expiryDateISO,
        addedBy: m.sender, // Store who added/updated the sub
        addedOn: moment().toISOString(), // Record the time of this specific action
        lastUpdated: moment().toISOString() // Add a last updated timestamp
    };

    writeSubscriptions(subscriptions);

    const expiryDateFormatted = newExpiryDate.tz('Africa/Casablanca').format('YYYY-MM-DD HH:mm:ss'); // Format for display with seconds
    const userDisplay = `@${userId.split('@')[0]}`;

    // Owner confirmation message
    m.reply(`*╔═════ ✅ نجاح ═════╗*\n*║* تم تحديث اشتراك المستخدم ${userDisplay} بنجاح!\n*║* \n*║* ⏳ *مدة الإضافة:* ${daysToAdd} يومًا\n*║* 📅 *تاريخ الانتهاء الجديد:* ${expiryDateFormatted}\n*║* 👤 *تم التحديث بواسطة:* @${m.sender.split('@')[0]}\n*╚════════════════╝*`);

    // Notification message to the subscribed user
    const notifyMessage = `*╔═════ 🎉 تهانينا ═════╗*\n*║* مرحباً ${userDisplay}!\n*║* تم تمديد/تفعيل اشتراكك في خدمة البث المباشر.\n*║* \n*║* ✨ *صلاحيتك الجديدة تمتد حتى:* \n*║* 🗓️ ${expiryDateFormatted}\n*║* \n*║* استمتع بالخدمة المميزة!\n*╚══════════════════╝*`;

    conn.reply(userId, notifyMessage, m); // Send notification to the user

};

handler.help = ['addsub @user <days>'];
handler.tags = ['owner', 'streaming'];
handler.command = ['addsub', 'اضافة_اشتراك'];
handler.owner = true; // Keep owner check for safety, although added manual check too

export default handler;


import fetch from 'node-fetch';

const handler = async (m, { text, conn, usedPrefix, command }) => {
  if (!text) {
    return m.reply(`من فضلك أرسل رابط فيديو فيسبوك مثل:\n${usedPrefix + command} https://www.facebook.com/share/v/1WESn5aGaQ/`);
  }

  try {
    const res = await fetch(`https://www.takamura.site/api/download/fb?url=${encodeURIComponent(text)}`);
    const json = await res.json();

    if (!json.hdLink && !json.sdLink) {
      return m.reply('لم أتمكن من استخراج روابط الفيديو.');
    }

    let message = '*روابط التحميل:*\n';
    if (json.hdLink) message += `• جودة عالية (HD):\n${json.hdLink}\n\n`;
    if (json.sdLink) message += `• جودة عادية (SD):\n${json.sdLink}\n\n`;
    if (json.image) message += `• صورة المعاينة:\n${json.image}`;

    await m.reply(message.trim());
    
  } catch (e) {
    console.error(e);
    m.reply('حدث خطأ أثناء جلب روابط الفيديو.');
  }
};

handler.help = ['facebook'];
handler.tags = ['downloader'];
handler.command = /^fbmpd$/i;

export default handler;
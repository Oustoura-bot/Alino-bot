import { getMatchesData } from '../lib/Yalla.js';
import { generateWAMessageFromContent, prepareWAMessageMedia } from '@whiskeysockets/baileys';

let handler = async (m, { conn, command, args }) => {
  const imgUrl = 'https://files.catbox.moe/kqiblj.jpg';

  const info = 'https://chat.whatsapp.com/D7nZ5J1mY3h6C5h50WxN2W';
  if (command === 'مباريات') {
    const media = await prepareWAMessageMedia({ image: { url: imgUrl } }, { upload: conn.waUploadToServer });

    let today = new Date();
    const days = Array.from({ length: 31 }, (_, i) => {
      let d = i + 1;
      return {
        header: 'اختر يومًا لعرض المباريات',
        title: `اليوم ${d}`,
        description: 'اضغط هنا لعرض الدوريات',
        id: `.مباريات_اليوم ${d}`
      };
    });

    const buttonMessage = {
      header: {
        title: "📅 قائمة الأيام",
        imageMessage: media.imageMessage,
      },
      body: { text: 'اختر اليوم الذي تريد عرض مبارياته' },
      footer: { text: 'مباريات اليوم من يلاكورة' },
      nativeFlowMessage: {
        buttons: [{
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: "أيام الشهر",
            sections: [{ title: "اختيار اليوم", rows: days }]
          }),
          messageParamsJson: ''
        }]
      }
    };

    const msg = generateWAMessageFromContent(m.chat, { viewOnceMessage: { message: { interactiveMessage: buttonMessage } } }, { userJid: conn.user.jid, quoted: m });

    return conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
  }

  else if (command === 'مباريات_اليوم') {
    let day = args[0];
    let date = `5/${day}/2025`; // يمكنك تعديل التاريخ لاحقًا ليتغير حسب الشهر الحالي
    const tournaments = await getMatchesData(date);

    if (!tournaments.length) return conn.sendMessage(m.chat, { text: `لا توجد مباريات في هذا اليوم: ${day}` }, { quoted: m });

    const rows = tournaments.map((t, i) => ({
      header: "اختر الدوري",
      title: t.name,
      description: `عدد المباريات: ${t.matches.length}`,
      id: `.مباريات_دوري ${day}|${i}`
    }));

    const buttonMessage = {
      body: { text: `🏆 الدوريات المتاحة ليوم ${day}` },
      nativeFlowMessage: {
        buttons: [{
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: "الدوريات",
            sections: [{ title: "الدوريات", rows }]
          }),
          messageParamsJson: ''
        }]
      }
    };

    const msg = generateWAMessageFromContent(m.chat, { viewOnceMessage: { message: { interactiveMessage: buttonMessage } } }, { userJid: conn.user.jid, quoted: m });

    return conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
  }

  else if (command === 'مباريات_دوري') {
    let [day, idx] = args[0].split("|");
    const tournaments = await getMatchesData(`5/${day}/2025`);
    const matches = tournaments[idx]?.matches || [];

    const rows = matches.map((match, i) => ({
      header: "اختر مباراة",
      title: `${match.teamA} VS ${match.teamB}`,
      description: match.time,
      id: `.تفاصيل_مباراة ${day}|${idx}|${i}`
    }));

    const buttonMessage = {
      body: { text: `⚽ المباريات في الدوري: ${tournaments[idx]?.name}` },
      nativeFlowMessage: {
        buttons: [{
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: "المباريات",
            sections: [{ title: "المباريات", rows }]
          }),
          messageParamsJson: ''
        }]
      }
    };

    const msg = generateWAMessageFromContent(m.chat, { viewOnceMessage: { message: { interactiveMessage: buttonMessage } } }, { userJid: conn.user.jid, quoted: m });

    return conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
  }

else if (command === 'تفاصيل_مباراة') {
  let [day, tIndex, mIndex] = args[0].split("|");
  const tournaments = await getMatchesData(`5/${day}/2025`);
  const match = tournaments[tIndex]?.matches[mIndex];

  if (!match) return conn.sendMessage(m.chat, { text: "لم يتم العثور على تفاصيل هذه المباراة" }, { quoted: m });

  const messages = [
    [
      `🏟️ *الفريق:* ${match.teamA}\n📝 *الحالة:* ${match.status}\n⚽ *الأهداف:* ${match.scoreA}`,
      `⌛ الوقت: ${match.time}\n📺 القناة: ${match.channel}`,
      match.logoA,
      [],
      [],
      [['رابط القناة', match.channel]], // زر يحتوي على رابط القناة (إن وجد كرابط)
      []
    ],
    [
      `🏟️ *الفريق:* ${match.teamB}\n📝 *الحالة:* ${match.status}\n⚽ *الأهداف:* ${match.scoreB}`,
      `⌛ الوقت: ${match.time}\n📺 القناة: ${match.channel}`,
      match.logoB,
      [],
      [],
      [['رابط القناة', match.channel]],
      []
    ],
    [
      `🏆 *الدوري:* ${tournaments[tIndex].name}\n\n⚔️ *${match.teamA}* vs *${match.teamB}*\n\n📝 *الحالة:* ${match.status}\n⌛ *الوقت:* ${match.time}\n⚽ *النتيجة:* ${match.scoreA} - ${match.scoreB}\n📺 *القناة:* ${match.channel}\n🌀 *الجولة:*  ${match.round}`,
      '',
      imgUrl,
      [],
      [],
      [['تفاصيل المباراة', match.link]], // زر للموقع الرسمي
      []
    ]
  ];

  await conn.sendCarousel(m.chat, 'تفاصيل المباراة', 'كل فريق + ملخص كامل', 'معلومات المباراة', messages, m);
}
};

handler.command = /^(مباريات|مباريات_اليوم|مباريات_دوري|تفاصيل_مباراة)$/;
export default handler;
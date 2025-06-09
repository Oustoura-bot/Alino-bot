import { searchBingImages } from "../image_search.js"; // Assuming image_search.js is in the root of script_contents

let handler = async (m, { conn, text, usedPrefix, command }) => {
  try {
    if (!text) throw `يرجى إدخال كلمة للبحث عن الصور. 
مثال: ${usedPrefix + command} قطط لطيفة`;

    await m.react("⌛"); // Loading emoji

    const results = await searchBingImages(text);

    if (!results || results.length === 0) {
      await m.react("🤷"); // Not found emoji
      return conn.reply(m.chat, "لم يتم العثور على صور لهذا البحث.", m);
    }

    await m.react("🖼️"); // Pictures emoji

    const maxImagesToSend = 10; // Limit the number of images sent
    let sentCount = 0;

    await conn.reply(m.chat, `تم العثور على ${results.length} صورة لـ *"${text}"*. سأرسل لك أفضل ${Math.min(results.length, maxImagesToSend)} صور:`, m);

    for (let i = 0; i < results.length && sentCount < maxImagesToSend; i++) {
      const img = results[i];
      try {
        await conn.sendMessage(m.chat, {
          image: { url: img.imageUrl },
          caption: `صورة ${sentCount + 1} لـ *"${text}"*.\n${img.pageUrl ? `المصدر: ${img.pageUrl}` : ''}`
        }, { quoted: m });
        sentCount++;
      } catch (e) {
        console.error(`فشل إرسال الصورة: ${img.imageUrl}`, e);
        // Optionally inform the user about the failed image
        // await conn.reply(m.chat, `تعذر إرسال الصورة: ${img.imageUrl}`, m);
      }
    }

    if (results.length > maxImagesToSend) {
      await conn.reply(m.chat, `تم إرسال ${maxImagesToSend} صور. للعثور على المزيد، يمكنك تضييق نطاق البحث أو استخدام محركات بحث أخرى.`, m);
    }

  } catch (error) {
    await m.react("❌"); // Error emoji
    console.error("خطأ في إضافة البحث عن الصور:", error);
    await conn.reply(m.chat, `❌ حدث خطأ: ${error.message || error}`, m);
  }
};

handler.help = ["صورة [نص البحث]"];
handler.tags = ["tools", "search"];
handler.command = /^(صورة|.صورة)$/i; // Responds to .صورة or صورة

export default handler;


import ws from 'ws';

export async function before(m, { conn, isOwner }) {
  let user = global.db.data.users[m.sender] || {};
  let setting = global.db.data.settings[this.user.jid];

  // هذا السطر يحمي من الخطأ إذا global.conns غير معرف
  if (!global.conns) global.conns = [];

  const prefixRegex = new RegExp('^[' + setting.prefix.replace(/[|\\{}()[\]^$+*.\-\^]/g, '\\$&') + ']');

  // السماح فقط للمالك في الخاص
  if (!m.isGroup && !isOwner) {
    // تجاهل أي رسائل خاصة من غير المالك
    return !1; // لا يرد عليهم
  }

  // لا داعي لمنع الجروبات هنا، نكتفي بالخاص فقط
  if (["120363297379773397@newsletter", "120363355261011910@newsletter"].includes(m.chat)) return;

  // إرسال حالة الكتابة والقراءة عند استدعاء أمر
  if (m.text && prefixRegex.test(m.text)) {
    this.sendPresenceUpdate('composing', m.chat);
    this.readMessages([m.key]);

    let usedPrefix = m.text.match(prefixRegex)[0];
    let command = m.text.slice(usedPrefix.length).trim().split(' ')[0];
  }
}

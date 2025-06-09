// بسم الله الرحمن الرحيم ✨✨✨

// استيراد الوحدات المطلوبة
import axios from 'axios';

// إعدادات التحقق
const VALIDATOR_TIMEOUT = 15000; // مهلة التحقق بالمللي ثانية (15 ثانية)
const VALID_CONTENT_TYPES = [
    'application/vnd.apple.mpegurl',
    'application/x-mpegurl',
    'audio/mpegurl',
    'audio/x-mpegurl',
    'application/octet-stream' // بعض الخوادم قد ترسل هذا النوع
];

/**
 * يتحقق من صلاحية رابط M3U8 للبث.
 * @param {string} url رابط M3U8 المراد التحقق منه.
 * @returns {Promise<{isValid: boolean, message: string, details: string | null}>} كائن يحتوي على نتيجة التحقق ورسالة وتفاصيل.
 */
async function validateM3U8Link(url) {
    console.log(`[M3U8 Validator] Attempting to validate: ${url}`);
    let response;
    try {
        // استخدام طلب HEAD لسرعة التحقق من الترويسات فقط
        response = await axios.head(url, {
            timeout: VALIDATOR_TIMEOUT,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; M3U8ValidatorBot/1.0)' },
            maxRedirects: 5 // السماح ببعض عمليات إعادة التوجيه
        });
        console.log(`[M3U8 Validator] HEAD request successful for ${url}. Status: ${response.status}`);

        // 1. التحقق من رمز الحالة (يجب أن يكون 2xx)
        if (response.status < 200 || response.status >= 300) {
            console.log(`[M3U8 Validator] Invalid status code: ${response.status}`);
            return {
                isValid: false,
                message: '⚠️ *الرابط غير متاح حالياً*',
                details: `استجاب الخادم برمز الحالة ${response.status}.`
            };
        }

        // 2. التحقق من نوع المحتوى
        const contentType = response.headers['content-type']?.toLowerCase().split(';')[0].trim();
        console.log(`[M3U8 Validator] Content-Type: ${contentType}`);
        if (!contentType || !VALID_CONTENT_TYPES.includes(contentType)) {
            console.log(`[M3U8 Validator] Invalid Content-Type: ${contentType}`);
            return {
                isValid: false,
                message: '❓ *نوع محتوى غير متوقع*',
                details: `نوع المحتوى المستلم هو '${contentType || 'غير محدد'}', وهو ليس نوع M3U8 متوقع.\nقد لا يعمل هذا الرابط كبث مباشر.`
            };
        }

        // 3. إذا نجحت جميع الفحوصات
        console.log(`[M3U8 Validator] Link appears valid: ${url}`);
        return {
            isValid: true,
            message: '✅ *الرابط يبدو صالحاً للبث*',
            details: `رمز الحالة: ${response.status}\nنوع المحتوى: ${contentType}`
        };

    } catch (error) {
        console.error(`[M3U8 Validator] Error validating ${url}:`, error.message);
        let errorMessage = '❌ *خطأ غير متوقع*';
        let errorDetails = `حدث خطأ غير متوقع أثناء محاولة التحقق من الرابط.\n${"```"}${error.message}${"```"}`;

        if (axios.isAxiosError(error)) {
            if (error.response) {
                // خطأ من الخادم (4xx, 5xx)
                console.error(`[M3U8 Validator] Server responded with status: ${error.response.status}`);
                errorMessage = `🚫 *الرابط غير متاح (${error.response.status})*`;
                errorDetails = `استجاب الخادم برمز الحالة ${error.response.status} عند محاولة الوصول إلى الرابط.`;
            } else if (error.request) {
                // لا يوجد استجابة
                console.error('[M3U8 Validator] No response received from server.');
                errorMessage = '⏳ *مشكلة في الاتصال*';
                errorDetails = 'لم يتم تلقي أي استجابة من الخادم. قد يكون الرابط غير صحيح، أو الخادم غير متاح، أو هناك مشكلة في الشبكة.';
            } else {
                // خطأ في إعداد الطلب
                console.error('[M3U8 Validator] Error setting up the request:', error.message);
                errorMessage = '🔧 *خطأ في إعداد الطلب*';
                errorDetails = `حدث خطأ أثناء محاولة إرسال طلب التحقق.\n${"```"}${error.message}${"```"}`;
            }
            // التحقق من انتهاء المهلة بشكل خاص
            if (error.code === 'ECONNABORTED' || error.message.toLowerCase().includes('timeout')) {
                console.error(`[M3U8 Validator] Timeout validating ${url}`);
                errorMessage = `⏱️ *انتهت مهلة التحقق*`;
                errorDetails = `استغرق الخادم وقتاً طويلاً للرد (أكثر من ${VALIDATOR_TIMEOUT / 1000} ثانية). قد يكون الخادم بطيئاً أو غير متاح.`;
            }
            // التحقق من خطأ DNS
            if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
                 console.error(`[M3U8 Validator] DNS lookup failed for ${url}`);
                 errorMessage = `🌐 *تعذر العثور على النطاق*`;
                 errorDetails = `تعذر العثور على اسم النطاق (Domain) الخاص بالرابط. تأكد من صحة الرابط الإملائية.`;
            }
        } 

        return {
            isValid: false,
            message: errorMessage,
            details: errorDetails
        };
    }
}

// تعريف المعالج
let handler = async (m, { conn, text, usedPrefix, command }) => {
    console.log(`[M3U8 Validator] Command received: ${usedPrefix + command} ${text}`);
    const urlToValidate = text.trim();

    // التحقق من وجود رابط
    if (!urlToValidate) {
        let usageMsg = `╭═════[ ✨ *فاحص روابط M3U8* ✨ ]═════╮
│
│ ❓ *كيفية الاستخدام:* 
│   أرسل الأمر متبوعاً بالرابط الذي تريد فحصه.
│
│ 📝 *مثال:*
│   ${usedPrefix + command} https://example.com/stream.m3u8
│
│ 💡 *الغرض:*
│   يتحقق هذا الأمر مما إذا كان الرابط يبدو صالحاً 
│   لبدء بث مباشر منه (يتحقق من الوصول ونوع المحتوى).
│
╰═════════════════════════════════╯`;
        return m.reply(usageMsg);
    }

    // التحقق من أن النص يبدو كرابط (بشكل مبدئي)
    if (!urlToValidate.startsWith('http://') && !urlToValidate.startsWith('https://')) {
        return m.reply(`╭─━━━━━━━━━━─╮
│   ⚠️ *رابط غير صالح* ⚠️   │
╰─━━━━━━━━━━─╯
النص الذي أدخلته لا يبدو كرابط صحيح. يجب أن يبدأ بـ 'http://' أو 'https://'.`);
    }

    // إرسال رسالة "جاري الفحص"
    await m.reply(`╭═════[ ⏱️ *جاري فحص الرابط* ⏱️ ]═════╮
│
│ 🔗 الرابط: ${'```'}${urlToValidate}${'```'}
│
│ ⏳ يرجى الانتظار قليلاً...
│
╰═════════════════════════════════╯`);

    // استدعاء دالة التحقق
    const result = await validateM3U8Link(urlToValidate);

    // بناء رسالة النتيجة النهائية
    let finalMsg = `╭═════[ 📊 *نتيجة فحص الرابط* 📊 ]═════╮
│
│ 🔗 الرابط:
│ ${'```'}${urlToValidate}${'```'}
│
│ ───────────
│
│ 💬 الحالة: ${result.message}
│
`;

    if (result.details) {
        finalMsg += `│ 📋 التفاصيل:
│   ${result.details.replace(/\n/g, '\n│   ')}
│
`; // استبدال \n بـ \n│   للمحاذاة
    }

    finalMsg += `╰═════════════════════════════════╯`;

    // إرسال النتيجة النهائية
    await m.reply(finalMsg);
    console.log(`[M3U8 Validator] Validation finished for ${urlToValidate}. Result: ${result.message}`);
};

handler.help = ['فحص_رابط <رابط_m3u8>'];
handler.tags = ['tools'];
handler.command = /^(فحص_رابط|checklink|m3u8check)$/i;

handler.limit = false; // يمكن تفعيل نظام النقاط إذا لزم الأمر
handler.premium = false; // يمكن جعله للمستخدمين المميزين فقط

export default handler;


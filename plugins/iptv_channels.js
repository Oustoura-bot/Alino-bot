import { prepareWAMessageMedia, generateWAMessageFromContent } from '@whiskeysockets/baileys';
import fetch from 'node-fetch';
import axios from 'axios';

const usedPrefix = ".";
// قائمة الدول مع الإيموجي
const countries = {
    'MA': '🇲🇦 المغرب', 'DZ': '🇩🇿 الجزائر', 'TN': '🇹🇳 تونس', 'EG': '🇪🇬 مصر', 'LY': '🇱🇾 ليبيا',
    'SD': '🇸🇩 السودان', 'NG': '🇳🇬 نيجيريا', 'KE': '🇰🇪 كينيا', 'ZA': '🇿🇦 جنوب أفريقيا', 'ET': '🇪🇹 إثيوبيا',
    'GH': '🇬🇭 غانا', 'SN': '🇸🇳 السنغال', 'CI': '🇨🇮 ساحل العاج', 'CM': '🇨🇲 الكاميرون', 'AO': '🇦🇴 أنغولا',
    'MZ': '🇲🇿 موزمبيق', 'UG': '🇺🇬 أوغندا', 'TZ': '🇹🇿 تنزانيا', 'RW': '🇷🇼 رواندا', 'ML': '🇲🇱 مالي',
    'SA': '🇸🇦 السعودية', 'AE': '🇦🇪 الإمارات', 'QA': '🇶🇦 قطر', 'KW': '🇰🇼 الكويت',
    'BH': '🇧🇭 البحرين', 'OM': '🇴🇲 عمان', 'JO': '🇯🇴 الأردن', 'LB': '🇱🇧 لبنان', 'SY': '🇸🇾 سوريا',
    'IQ': '🇮🇶 العراق', 'IR': '🇮🇷 إيران', 'IL': '🇮🇱 إسرائيل', 'PS': '🇵🇸 فلسطين', 'YE': '🇾🇪 اليمن',
    'FR': '🇫🇷 فرنسا', 'GB': '🇬🇧 المملكة المتحدة', 'DE': '🇩🇪 ألمانيا', 'IT': '🇮🇹 إيطاليا', 'ES': '🇪🇸 إسبانيا',
    'PT': '🇵🇹 البرتغال', 'NL': '🇳🇱 هولندا', 'BE': '🇧🇪 بلجيكا', 'CH': '🇨🇭 سويسرا', 'AT': '🇦🇹 النمسا',
    'GR': '🇬🇷 اليونان', 'TR': '🇹🇷 تركيا', 'RU': '🇷🇺 روسيا', 'UA': '🇺🇦 أوكرانيا', 'PL': '🇵🇱 بولندا',
    'SE': '🇸🇪 السويد', 'NO': '🇳🇴 النرويج', 'DK': '🇩🇰 الدنمارك', 'FI': '🇫🇮 فنلندا', 'IE': '🇮🇪 أيرلندا',
    'CZ': '🇨🇿 التشيك', 'HU': '🇭🇺 المجر', 'RO': '🇷🇴 رومانيا', 'BG': '🇧🇬 بلغاريا', 'HR': '🇭🇷 كرواتيا',
    'RS': '🇷🇸 صربيا', 'SK': '🇸🇰 سلوفاكيا', 'SI': '🇸🇮 سلوفينيا', 'AL': '🇦🇱 ألبانيا', 'MK': '🇲🇰 مقدونيا الشمالية',
    'MT': '🇲🇹 مالطا', 'CY': '🇨🇾 قبرص',
    'US': '🇺🇸 الولايات المتحدة', 'CA': '🇨🇦 كندا', 'MX': '🇲🇽 المكسيك', 'BR': '🇧🇷 البرازيل', 'AR': '🇦🇷 الأرجنتين',
    'CO': '🇨🇴 كولومبيا', 'CL': '🇨🇱 تشيلي', 'PE': '🇵🇪 بيرو', 'VE': '🇻🇪 فنزويلا', 'CU': '🇨🇺 كوبا',
    'DO': '🇩🇴 الدومينيكان', 'EC': '🇪🇨 الإكوادور', 'GT': '🇬🇹 غواتيمالا', 'PA': '🇵🇦 بنما',
    'CR': '🇨🇷 كوستاريكا', 'UY': '🇺🇾 الأوروغواي', 'PR': '🇵🇷 بورتوريكو', 'JM': '🇯🇲 جامايكا',
    'CN': '🇨🇳 الصين', 'JP': '🇯🇵 اليابان', 'KR': '🇰🇷 كوريا الجنوبية', 'IN': '🇮🇳 الهند', 'PK': '🇵🇰 باكستان',
    'BD': '🇧🇩 بنغلاديش', 'ID': '🇮🇩 إندونيسيا', 'MY': '🇲🇾 ماليزيا', 'SG': '🇸🇬 سنغافورة', 'TH': '🇹🇭 تايلاند',
    'VN': '🇻🇳 فيتنام', 'PH': '🇵🇭 الفلبين', 'HK': '🇭🇰 هونغ كونغ', 'TW': '🇹🇼 تايوان', 'KZ': '🇰🇿 كازاخستان',
    'UZ': '🇺🇿 أوزبكستان', 'LK': '🇱🇰 سريلانكا', 'NP': '🇳🇵 نيبال', 'MM': '🇲🇲 ميانمار', 'KH': '🇰🇭 كمبوديا',
    'AU': '🇦🇺 أستراليا', 'NZ': '🇳🇿 نيوزيلندا', 'FJ': '🇫🇯 فيجي', 'PG': '🇵🇬 بابوا غينيا الجديدة', 'SB': '🇸🇧 جزر سليمان'
};

// قائمة الفئات مع الإيموجي
const categories = {
    'animation': '🎬 رسوم متحركة', 
    'auto': '🚗 سيارات',
    'business': '💼 أعمال',
    'classic': '🎞 كلاسيك',
    'comedy': '😂 كوميديا',
    'cooking': '🍳 طبخ',
    'culture': '🎭 ثقافة',
    'documentary': '🌍 وثائقي',
    'education': '🎓 تعليم',
    'entertainment': '🎉 ترفيه',
    'family': '👨‍👩‍👧‍👦 عائلة',
    'general': '🌐 عام',
    'kids': '🧸 أطفال',
    'legislative': '🏛 تشريعي',
    'lifestyle': '💅 أسلوب حياة',
    'movies': '🍿 أفلام',
    'music': '🎵 موسيقى',
    'news': '📰 أخبار',
    'outdoor': '🌳 خارجي',
    'relax': '🧘 استرخاء',
    'religious': '🙏 ديني',
    'science': '🔬 علوم',
    'series': '📺 مسلسلات',
    'shop': '🛒 تسوق',
    'sports': '⚽ رياضة',
    'travel': '✈ سفر',
    'weather': '☀ طقس'
};

// دالة مساعدة لتقسيم المصفوفة إلى أجزاء
function chunkArray(array, size) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

// دالة لجلب وتحليل ملفات M3U
async function fetchAndParseM3U(url) {
    try {
        const response = await axios.get(url, { 
            timeout: 30000, 
            headers: { 'User-Agent': 'Mozilla/5.0' } 
        });
        
        const m3uContent = response.data;
        if (!m3uContent || typeof m3uContent !== 'string') {
            return [];
        }

        const lines = m3uContent.split('\n');
        const channels = [];
        let currentChannel = {};

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('#EXTINF:')) {
                currentChannel = {};
                const titleMatch = trimmedLine.match(/,(.+)$/);
                currentChannel.title = titleMatch ? titleMatch[1].trim() : 'قناة غير معروفة';
                
                const tvgNameMatch = trimmedLine.match(/tvg-name="([^\"]+)"/);
                if (tvgNameMatch && tvgNameMatch[1]) {
                    currentChannel.title = tvgNameMatch[1].trim();
                }
                
            } else if (trimmedLine && !trimmedLine.startsWith('#') && trimmedLine.toLowerCase().includes('.m3u8')) {
                if (trimmedLine.startsWith('http://') || trimmedLine.startsWith('https://')) {
                    currentChannel.url = trimmedLine;
                    if (currentChannel.title && currentChannel.url) {
                        if (!channels.some(ch => ch.url === currentChannel.url)) {
                            channels.push({ ...currentChannel });
                        }
                    }
                }
                currentChannel = {};
            }
        }
        
        return channels;
    } catch (error) {
        console.error('Error fetching or parsing M3U:', error);
        throw new Error(`حدث خطأ أثناء جلب القنوات: ${error.message}`);
    }
}

// دالة للعثور على رمز الدولة
function findCountryCode(name) {
    const searchTerm = name.toLowerCase().trim();
    for (const [code, countryName] of Object.entries(countries)) {
        if (code.toLowerCase() === searchTerm || countryName.toLowerCase().includes(searchTerm)) {
            return code;
        }
    }
    return null;
}

// دالة للعثور على رمز الفئة
function findCategoryCode(name) {
    const searchTerm = name.toLowerCase().trim();
    for (const [code, categoryName] of Object.entries(categories)) {
        if (code.toLowerCase() === searchTerm || categoryName.toLowerCase().includes(searchTerm)) {
            return code;
        }
    }
    return null;
}

// معالج الأوامر الرئيسي
let handler = async (m, { conn, usedPrefix, command, args }) => {
    if (command === 'قنوات') {
        await sendMainMenu(m, conn);
    } else if (command === 'iptv-countries') {
        await sendCountriesMenu(m, conn);
    } else if (command === 'iptv-categories') {
        await sendCategoriesMenu(m, conn);
    } else if (command === 'iptv') {
        await handleIptvCommand(m, conn, args);
    } else if (command === 'iptv-channel') {
        await handleChannelSelection(m, conn, args);
    }
};

// وظيفة إرسال القائمة الرئيسية
async function sendMainMenu(m, conn) {
    const interactiveMessage = {
        header: {
            title: "✨ قائمة القنوات التفاعلية ✨",
            hasMediaAttachment: false
        },
        body: {
            text: "اختر نوع القائمة التي تريد استعراضها:"
        },
        footer: { 
            text: "ALINO-BOT | @MOUH-IFBI"
        },
        nativeFlowMessage: {
            buttons: [
                {
                    name: 'single_select',
                    buttonParamsJson: JSON.stringify({
                        title: '💫 اختر نوع القائمة 💫',
                        sections: [
                            {
                                title: '🔰 الأقسام المتاحة 🔰',
                                rows: [
                                    { 
                                        title: '🌍 الدول المتاحة', 
                                        description: 'عرض قائمة الدول لاستكشاف القنوات', 
                                        id: `${usedPrefix}iptv-countries` 
                                    },
                                    { 
                                        title: '📚 الفئات المتاحة', 
                                        description: 'عرض قائمة الفئات لاستكشاف القنوات', 
                                        id: `${usedPrefix}iptv-categories` 
                                    }
                                ]
                            }
                        ]
                    }),
                    messageParamsJson: ''
                }
            ]
        }
    };

    await sendInteractiveMessage(m, conn, interactiveMessage);
}

// وظيفة إرسال قائمة الدول
async function sendCountriesMenu(m, conn) {
    const countryRows = Object.entries(countries).map(([code, name]) => ({
        title: name,
        description: `عرض قنوات ${name}`,
        id: `${usedPrefix}iptv country ${code}`
    }));

    const sections = chunkArray(countryRows, 10).map((chunk, index) => ({
        title: `🌍 الدول - الجزء ${index + 1}`,
        rows: chunk
    }));

    const interactiveMessage = {
        header: {
            title: "🌍 قائمة الدول المتاحة 🌍",
            hasMediaAttachment: false
        },
        body: {
            text: "اختر الدولة لعرض قنواتها:"
        },
        footer: { 
            text: "ALINO-BOT | @MOUH-IFBI"
        },
        nativeFlowMessage: {
            buttons: [
                {
                    name: 'single_select',
                    buttonParamsJson: JSON.stringify({
                        title: 'اختر الدولة',
                        sections: sections
                    }),
                    messageParamsJson: ''
                },
                {
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({
                        display_text: "🔙 الرجوع للقائمة الرئيسية",
                        id: `${usedPrefix}قنوات`
                    })
                }
            ]
        }
    };

    await sendInteractiveMessage(m, conn, interactiveMessage);
}

// وظيفة إرسال قائمة الفئات
async function sendCategoriesMenu(m, conn) {
    const categoryRows = Object.entries(categories).map(([code, name]) => ({
        title: name,
        description: `عرض قنوات ${name}`,
        id: `${usedPrefix}iptv category ${code}`
    }));

    const sections = chunkArray(categoryRows, 10).map((chunk, index) => ({
        title: `📚 الفئات - الجزء ${index + 1}`,
        rows: chunk
    }));

    const interactiveMessage = {
        header: {
            title: "📚 قائمة الفئات المتاحة 📚",
            hasMediaAttachment: false
        },
        body: {
            text: "اختر الفئة لعرض قنواتها:"
        },
        footer: { 
            text: "ALINO-BOT | @MOUH-IFBI"
        },
        nativeFlowMessage: {
            buttons: [
                {
                    name: 'single_select',
                    buttonParamsJson: JSON.stringify({
                        title: 'اختر الفئة',
                        sections: sections
                    }),
                    messageParamsJson: ''
                },
                {
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({
                        display_text: "🔙 الرجوع للقائمة الرئيسية",
                        id: `${usedPrefix}قنوات`
                    })
                }
            ]
        }
    };

    await sendInteractiveMessage(m, conn, interactiveMessage);
}

// معالج أمر IPTV لجلب القنوات
async function handleIptvCommand(m, conn, args) {
    let choice = args[0]?.toLowerCase();
    let selectionText = args.slice(1).join(' ').trim();

    if (!choice) {
        let helpMsg = `
═════ [ 👑 مستكشف IPTV الملكي 👑 ] ═════

✨ أهلاً بك! استكشف عالم البث الرقمي:

📌 الأوامر المتاحة:
${usedPrefix}iptv country <الدولة>
${usedPrefix}iptv category <الفئة>
`;
        await m.reply(helpMsg);
        return;
    }

    let channels = [];
    let searchParamName = '';
    let searchParamCode = '';
    let url = '';
    let searchTypeDisplay = '';

    if (choice === 'country' && selectionText) {
        searchParamCode = findCountryCode(selectionText);
        if (searchParamCode && countries[searchParamCode]) {
            searchParamName = countries[searchParamCode];
            searchTypeDisplay = 'الدولة';
            url = `https://iptv-org.github.io/iptv/countries/${searchParamCode.toLowerCase()}.m3u`;
            await m.reply(`⏳ جاري البحث عن قنوات ${searchParamName}...`);
        } else {
            return m.reply(`🚫 الدولة غير موجودة: "${selectionText}"`);
        }
    } else if (choice === 'category' && selectionText) {
        searchParamCode = findCategoryCode(selectionText);
        if (searchParamCode && categories[searchParamCode]) {
            searchParamName = categories[searchParamCode];
            searchTypeDisplay = 'الفئة';
            url = `https://iptv-org.github.io/iptv/categories/${searchParamCode}.m3u`;
            await m.reply(`⏳ جاري البحث عن قنوات ${searchParamName}...`);
        } else {
            return m.reply(`🚫 الفئة غير موجودة: "${selectionText}"`);
        }
    } else {
        return m.reply(`❓ استخدام غير صحيح. استخدم ${usedPrefix}iptv للمساعدة`);
    }

    try {
        channels = await fetchAndParseM3U(url);
        if (!channels || channels.length === 0) {
            return m.reply(`⚠ لم يتم العثور على قنوات لـ ${searchParamName}`);
        }

        // إرسال قائمة القنوات كـ single_select
        const channelRows = channels.map((channel, index) => ({
            title: channel.title,
            description: `اضغط لعرض رابط القناة`,
            id: `${usedPrefix}iptv-channel ${encodeURIComponent(JSON.stringify(channel))}`
        }));

        const sections = chunkArray(channelRows, 10).map((chunk, index) => ({
            title: `📺 القنوات - الجزء ${index + 1}`,
            rows: chunk
        }));

        const interactiveMessage = {
            header: {
                title: `📺 قنوات ${searchParamName}`,
                hasMediaAttachment: false
            },
            body: {
                text: `اختر قناة لعرض رابطها (${channels.length} قناة متاحة):`
            },
            footer: { 
                text: "ALINO-BOT | @MOUH-IFBI"
            },
            nativeFlowMessage: {
                buttons: [
                    {
                        name: 'single_select',
                        buttonParamsJson: JSON.stringify({
                            title: 'اختر القناة',
                            sections: sections
                        }),
                        messageParamsJson: ''
                    },
                    {
                        name: "quick_reply",
                        buttonParamsJson: JSON.stringify({
                            display_text: "🔙 الرجوع للخلف",
                            id: `${usedPrefix}${choice === 'country' ? 'iptv-countries' : 'iptv-categories'}`
                        })
                    }
                ]
            }
        };

        await sendInteractiveMessage(m, conn, interactiveMessage);

    } catch (error) {
        await m.reply(`⚠ حدث خطأ: ${error.message}`);
    }
}

// معالج اختيار القناة
async function handleChannelSelection(m, conn, args) {
    try {
        const channelData = JSON.parse(decodeURIComponent(args[0]));
        const channelInfo = `
📺 معلومات القناة:
الاسم: ${channelData.title}
الرابط: ${channelData.url}

📌 ملاحظة: يمكنك استخدام الرابط مع أي مشغل IPTV مثل VLC أو IPTV Smarters
        `;
        
        await m.reply(channelInfo);
    } catch (error) {
        await m.reply(`⚠ حدث خطأ في عرض معلومات القناة: ${error.message}`);
    }
}

// دالة مساعدة لإرسال الرسائل التفاعلية
async function sendInteractiveMessage(m, conn, interactiveMessage) {
    let msg = generateWAMessageFromContent(m.chat, {
        viewOnceMessage: {
            message: {
                interactiveMessage,
            },
        },
    }, { userJid: conn.user.jid, quoted: m });

    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
}

// تعريف الأوامر
handler.command = /^(قنوات|iptv-countries|iptv-categories|iptv|iptv-channel)$/i;
handler.help = ['iptv'];
handler.tags = ['tools', 'search', 'iptv'];
handler.limit = false;

export default handler;

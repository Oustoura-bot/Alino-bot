import { prepareWAMessageMedia, generateWAMessageFromContent } from '@whiskeysockets/baileys';
import speed from 'performance-now';
import { exec } from 'child_process';
import { parsePhoneNumber } from 'libphonenumber-js';

let handler = async (m, { conn }) => {
    const taguser = '@' + m.sender.split('@s.whatsapp.net')[0];
    let phoneNumber = m.sender.split('@')[0];

    let countryName = "غير معروف";
    try {
        let parsedNumber = parsePhoneNumber("+" + phoneNumber);
        if (parsedNumber && parsedNumber.country) {
            countryName = parsedNumber.country;
        }
    } catch (error) {
        console.error("خطأ في التعرف على الدولة:", error);
    }

    let timestamp = speed();
    let latensi = speed() - timestamp;

    exec(`neofetch --stdout`, async (error, stdout, stderr) => {
        let child = stdout.toString("utf-8");
        let ssd = child.replace(/Memory:/, "Ram:");

        const sn = `│🥷🏻 *:مرحبا يا* ${taguser}
│🤖 *الـمـنـصة:* *MEGA-HOST*   
│⚡ *الـسـرعـة:*『 *${latensi.toFixed(4)}* 』  
│👨‍💻 *المـطـور:* 『 @MOUH-IFBI 』   
│🌎 *دولــتـك:* *『${countryName}』*   
│🕋 *اللهم صلي وسلم على سيدنا محمد* ╯─────────────────╰`;

        conn.fakeReply(m.chat, sn, '0@s.whatsapp.net', '👋مرحبًا بك في بوتي', 'status@broadcast');

        var joanimiimg = await prepareWAMessageMedia(
            { image: { url: 'https://files.catbox.moe/6wflyx.png' } },
            { upload: conn.waUploadToServer }
        );

        // توليد الأقسام ديناميكيا من plugins
        let sectionsMap = {};
        for (let plugin of Object.values(global.plugins)) {
            if (!plugin?.command) continue;
            let tagList = plugin.tags || [];
            for (let tag of tagList) {
                if (!sectionsMap[tag]) sectionsMap[tag] = [];
                let cmdName = Array.isArray(plugin.command) ? plugin.command[0] : plugin.command;
                sectionsMap[tag].push({
                    header: `📂 القسم: ${tag}`,
                    title: `⌯ .${cmdName}`,
                    description: `↯ من قسم ${tag}`,
                    id: `.${cmdName}`
                });
            }
        }

        let formattedSections = Object.entries(sectionsMap).map(([tag, rows]) => ({
            title: `🔰 قسم ${tag}`,
            highlight_label: `⚡ أوامر ${tag}`,
            rows
        }));

        const interactiveMessage = {
            header: {
                title: `│✨ *👋 أهـلًا وسـهـلًا*
│🤖 *الـمـنـصة:* *MEGA-HOST*   
│👨‍💻 *المـطـور:* 『 @MOUH-IFBI 』  ╯─────────────────╰`,
                hasMediaAttachment: true,
                imageMessage: joanimiimg.imageMessage,
            },
            body: {
                text: '',
            },
            footer: {
                text: `@MOUH-IFBI`.trim()
            },
            nativeFlowMessage: {
                buttons: [
                    {
                        name: 'single_select',
                        buttonParamsJson: JSON.stringify({
                            title: '💫 اخـتــر الـقـســم 💫',
                            sections: formattedSections
                        }),
                        messageParamsJson: ''
                    },
                    {
                        name: "cta_url",
                        buttonParamsJson: JSON.stringify({
                            display_text: "🌐 زيــارة مـنـصـة مـيـغـا",
                            url: "https://host.joanimi-world.site/",
                            merchant_url: "https://host.joanimi-world.site/"
                        })
                    }
                ]
            }
        };

        let msg = generateWAMessageFromContent(m.chat, {
            viewOnceMessage: {
                message: {
                    interactiveMessage,
                },
            },
        }, { userJid: conn.user.jid, quoted: m });

        conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
    });
};

handler.command = ["menu"];
handler.tags = ["اوامر"];
export default handler;
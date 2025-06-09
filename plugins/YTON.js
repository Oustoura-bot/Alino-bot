import fetch from 'node-fetch';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import moment from 'moment-timezone';

// --- Configuration for Owners --- START ---
// List of owner JIDs configured directly in this script.
// These are combined with any owners defined in global.owner.
const CONFIG_OWNER_JIDS = [
    "212710643142@s.whatsapp.net", // Existing owner
    "212722875827@s.whatsapp.net"  // New owner added by user request
];
// --- Configuration for Owners --- END ---

// --- Subscription Logic --- START ---
const SUBS_FILE = './subscriptions.json';
const TRIAL_DURATION_DAYS = 1;

function readSubscriptions() {
    try {
        if (fs.existsSync(SUBS_FILE)) {
            const data = fs.readFileSync(SUBS_FILE, 'utf8');
            if (!data) {
                fs.writeFileSync(SUBS_FILE, JSON.stringify({}, null, 2), 'utf8');
                return {};
            }
            return JSON.parse(data);
        } else {
            fs.writeFileSync(SUBS_FILE, JSON.stringify({}, null, 2), 'utf8');
            return {};
        }
    } catch (error) {
        console.error("Error reading or parsing subscriptions file:", error);
        try {
            fs.writeFileSync(SUBS_FILE, JSON.stringify({}, null, 2), 'utf8');
            return {};
        } catch (writeError) {
            console.error("Error creating/overwriting subscriptions file after read error:", writeError);
            return {};
        }
    }
}

function writeSubscriptions(subscriptions) {
    try {
        fs.writeFileSync(SUBS_FILE, JSON.stringify(subscriptions, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error("Error writing subscriptions file:", error);
        return false;
    }
}

async function checkAndGrantSubscription(userId, conn, m) {
    // Combine owners from global.owner and CONFIG_OWNER_JIDS
    const effectiveOwnerJids = [...new Set([
        ...(global.owner || []).map(v => String(v).replace(/[^0-9]/g, '') + '@s.whatsapp.net'),
        ...CONFIG_OWNER_JIDS
    ])];

    if (effectiveOwnerJids.includes(userId)) {
        return { valid: true, isOwner: true };
    }

    const subscriptions = readSubscriptions();

    if (!subscriptions[userId]) {
        console.log(`User ${userId} not found. Granting ${TRIAL_DURATION_DAYS}-day trial.`);
        const now = moment();
        const expiryDate = now.clone().add(TRIAL_DURATION_DAYS, 'days');

        subscriptions[userId] = {
            expiry: expiryDate.toISOString(),
            addedBy: 'AutoTrial',
            addedOn: now.toISOString()
        };

        if (writeSubscriptions(subscriptions)) {
            console.log(`Successfully granted ${TRIAL_DURATION_DAYS}-day trial to ${userId}. Expires: ${expiryDate.format()}`);
            try {
                const userMsg = `👑 **مرحباً بك في تجربة البث المباشر المميزة!** 👑

لقد تم تفعيل اشتراكك التجريبي الحصري تلقائياً.

▫️ **مدة التجربة:** ${TRIAL_DURATION_DAYS} أيام من الخدمة الفاخرة.
▫️ **تاريخ الانتهاء:** ${expiryDate.tz('Africa/Casablanca').format('YYYY-MM-DD HH:mm')}

استكشف قوة البث الاحترافي معنا!`;
                const targetChat = m.chat || userId;
                await conn.reply(targetChat, userMsg, m);

                const ownerMsg = `🔔 **إشعار خاص للمالك** 🔔

تم منح اشتراك تجريبي مميز للمستخدم: @${userId.split('@')[0]}
▫️ **المدة:** ${TRIAL_DURATION_DAYS} أيام
▫️ **الانتهاء:** ${expiryDate.tz('Africa/Casablanca').format('YYYY-MM-DD HH:mm')}`;
                for (const ownerJid of effectiveOwnerJids) { // Use effectiveOwnerJids here for notifications
                    if (conn.sendMessage && typeof conn.sendMessage === 'function') {
                         await conn.sendMessage(ownerJid, { text: ownerMsg, mentions: [userId] });
                    } else {
                        console.warn("conn.sendMessage is not available for owner notification.");
                    }
                }
            } catch (notifyError) {
                console.error(`Error sending trial notifications for ${userId}:`, notifyError);
            }
            return { valid: true, isTrial: true, trialJustGranted: true, expiryDate: expiryDate };
        } else {
            console.error(`Failed to write subscriptions file after granting trial to ${userId}.`);
            return { valid: false, reason: 'Trial grant failed (write error)' };
        }
    } else {
        if (!subscriptions[userId].expiry) {
            console.warn(`User ${userId} found but has no expiry date.`);
            return { valid: false, reason: 'Subscription data invalid (no expiry)' };
        }
        const expiryDate = moment(subscriptions[userId].expiry);
        const now = moment();
        if (expiryDate.isBefore(now)) {
            console.log(`Subscription for ${userId} expired on ${expiryDate.format()}.`);
            return { valid: false, reason: 'Expired' };
        }
        return { valid: true, expiryDate: expiryDate };
    }
}
// --- Subscription Logic --- END ---

const STREAMS_PATH = './youtube_streams.json';
const LOGS_DIR = './stream_logs';

if (!fs.existsSync(STREAMS_PATH)) {
  fs.writeFileSync(STREAMS_PATH, JSON.stringify({ activeStreams: {}, streamHistory: [] }, null, 2), 'utf8');
}
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

let streamsData;
try {
  const data = fs.readFileSync(STREAMS_PATH, 'utf8');
  streamsData = JSON.parse(data);
} catch (error) {
  streamsData = { activeStreams: {}, streamHistory: [] };
}

const updateStreamsData = () => {
  try {
    fs.writeFileSync(STREAMS_PATH, JSON.stringify(streamsData, null, 2), 'utf8');
  } catch (error) {
    console.error('خطأ في تحديث ملف البث:', error);
  }
};

const formatDuration = (ms) => {
  if (ms < 0) ms = -ms;
  const time = {
    day: Math.floor(ms / 86400000),
    hour: Math.floor(ms / 3600000) % 24,
    minute: Math.floor(ms / 60000) % 60,
    second: Math.floor(ms / 1000) % 60,
  };
  let parts = Object.entries(time)
    .filter(val => val[0] === 'hour' || val[0] === 'minute' || val[0] === 'second')
    .map(val => val[1].toString().padStart(2, '0'));
  if (time.day > 0) {
    return `${time.day} يوم و ${parts.join(':')}`;
  }
  return parts.join(':');
};

const checkFFmpeg = async () => {
  try {
    const ffmpeg = spawn('ffmpeg', ['-version']);
    return new Promise((resolve) => {
      ffmpeg.on('close', (code) => resolve(code === 0));
      ffmpeg.stdout.on('data', () => {});
      ffmpeg.stderr.on('data', () => {});
    });
  } catch (error) {
    return false;
  }
};

// إعدادات جودة البث
const QUALITY_PRESETS = {
  low: {
    video_bitrate: '1000k',
    audio_bitrate: '128k',
    resolution: '854x480',
    fps: '30'
  },
  medium: {
    video_bitrate: '2500k',
    audio_bitrate: '128k',
    resolution: '1280x720',
    fps: '30'
  },
  high: {
    video_bitrate: '4000k',
    audio_bitrate: '192k',
    resolution: '1920x1080',
    fps: '30'
  },
  ultra: {
    video_bitrate: '8000k',
    audio_bitrate: '192k',
    resolution: '1920x1080',
    fps: '60'
  }
};

const startYouTubeLiveStream = async (rtmpUrl, streamKey, m3u8Url, chatId, userId, conn, quality = 'medium', privacy = 'public') => {
  const hasFFmpeg = await checkFFmpeg();
  if (!hasFFmpeg) {
    return {
      success: false,
      message: `🛑 **خطأ تقني جسيم** 🛑\n\nنظام البث لم يتمكن من تحديد أداة FFmpeg الأساسية.\nيرجى التأكد من تثبيتها بشكل صحيح على الخادم.\n\nللحصول على مساعدة فورية، يرجى التواصل مع فريق الدعم الفني المخصص.`
    };
  }

  if (!rtmpUrl || !streamKey || !m3u8Url) {
    return {
      success: false,
      message: `🚫 **بيانات الإدخال غير مكتملة** 🚫\n\nلضمان جودة البث، يرجى تزويدنا بكافة المعلومات المطلوبة:\n  - عنوان RTMP الكامل\n  - مفتاح البث السري\n  - رابط مصدر البث (M3U8)`
    };
  }

  // التحقق من صحة إعدادات الجودة والخصوصية
  if (!QUALITY_PRESETS[quality]) {
    quality = 'medium'; // استخدام الإعداد الافتراضي إذا كانت الجودة غير صالحة
  }

  if (!['public', 'unlisted', 'private'].includes(privacy)) {
    privacy = 'public'; // استخدام الإعداد الافتراضي إذا كانت الخصوصية غير صالحة
  }

  const streamId = Date.now().toString();
  const fullRtmpUrl = `${rtmpUrl}/${streamKey}`;
  const streamStartTime = new Date();
  const logFilePath = path.join(LOGS_DIR, `${streamId}_youtube_ffmpeg.log`);
  const qualitySettings = QUALITY_PRESETS[quality];

  try {
    // إعداد أوامر FFmpeg مع مراعاة إعدادات الجودة
    const ffmpegArgs = [
      '-reconnect', '1', 
      '-reconnect_streamed', '1', 
      '-reconnect_delay_max', '300', 
      '-rw_timeout', '30000000', 
      '-timeout', '30000000', 
      '-i', m3u8Url,
      '-c:v', 'libx264', 
      '-preset', 'veryfast',
      '-b:v', qualitySettings.video_bitrate,
      '-maxrate', qualitySettings.video_bitrate,
      '-bufsize', `${parseInt(qualitySettings.video_bitrate) * 2}k`,
      '-s', qualitySettings.resolution,
      '-r', qualitySettings.fps,
      '-c:a', 'aac', 
      '-b:a', qualitySettings.audio_bitrate,
      '-ar', '44100',
      '-f', 'flv', 
      fullRtmpUrl
    ];

    const ffmpegLogStream = fs.createWriteStream(logFilePath, { flags: 'a' });
    const ffmpeg = spawn('ffmpeg', ffmpegArgs, { detached: true, stdio: 'ignore' });
    ffmpeg.unref();

    streamsData.activeStreams[streamId] = {
      id: streamId, 
      rtmpUrl, 
      streamKey, 
      m3u8Url, 
      chatId, 
      userId,
      startTime: streamStartTime.toISOString(), 
      pid: ffmpeg.pid, 
      logFile: logFilePath,
      quality,
      privacy,
      platform: 'youtube'
    };
    updateStreamsData();
        
    console.log(`FFmpeg process [${streamId}] started with PID ${ffmpeg.pid} by user ${userId} for YouTube streaming. Output to ${logFilePath}`);

    // رسائل مختلفة حسب إعدادات الخصوصية
    let privacyMessage = '';
    if (privacy === 'public') {
      privacyMessage = 'البث متاح للجميع ويمكن العثور عليه في نتائج البحث.';
    } else if (privacy === 'unlisted') {
      privacyMessage = 'البث متاح فقط لمن لديه الرابط ولا يظهر في نتائج البحث.';
    } else if (privacy === 'private') {
      privacyMessage = 'البث خاص ومتاح فقط لك وللمستخدمين الذين تختارهم.';
    }

    return {
      success: true,
      message: `✅ **تم إطلاق البث على يوتيوب بنجاح!** ✅\n\nمعرف البث الفريد: \n  🆔 \t${streamId}\n\n📊 **إعدادات البث:**\n  🔹 الجودة: ${quality}\n  🔹 الدقة: ${qualitySettings.resolution}\n  🔹 معدل الإطارات: ${qualitySettings.fps} FPS\n  🔹 الخصوصية: ${privacy}\n\n🔒 **حالة الخصوصية:**\n  ${privacyMessage}\n\nتم تحسين إعدادات الاتصال لزيادة استقرار البث مع المصادر غير المستقرة.\nسيحاول النظام إعادة الاتصال تلقائياً في حال انقطاع المصدر.\n\nسيتم حفظ سجلات التشغيل المفصلة في:\n  📄 \t${logFilePath}`,
      streamId, 
      logFile: logFilePath, 
      pid: ffmpeg.pid,
      quality,
      privacy
    };
  } catch (error) {
    return {
      success: false,
      message: `🛑 **فشل إطلاق البث على يوتيوب** 🛑\n\nواجه النظام عائقاً غير متوقع أثناء محاولة بدء البث.\nالخطأ المسجل: ${error.message}\n\nنرجو المحاولة مجدداً. إذا استمرت المشكلة، يرجى مراجعة سجلات الخطأ أو الاتصال بالدعم.`
    };
  }
};

const stopYouTubeLiveStream = (streamIdToStop) => {
  if (!streamsData.activeStreams[streamIdToStop]) {
    return {
      success: false,
      message: `⚠️ **تنبيه: بث غير موجود** ⚠️\n\nلم يتم العثور على أي بث مباشر نشط يحمل المعرف المقدم: ${streamIdToStop}`
    };
  }
  
  const stream = streamsData.activeStreams[streamIdToStop];
  try {
    const pid = stream.pid;
    if (pid) {
        process.kill(pid, 'SIGTERM'); 
        console.log(`Sent SIGTERM to FFmpeg process [${streamIdToStop}] with PID ${pid}.`);
    } else {
        console.warn(`No PID found for stream [${streamIdToStop}]. Manual cleanup might be needed.`);
        delete streamsData.activeStreams[streamIdToStop];
        updateStreamsData();
        return { success: false, message: `🛑 **خطأ في عملية الإيقاف** 🛑\n\nلم يتمكن النظام من تحديد معرّف العملية (PID) للبث ${streamIdToStop}.\nقد يتطلب الأمر تدخلاً يدوياً لإيقافه بشكل كامل. تم حذفه من قائمة البثوث النشطة.` };
    }
        
    delete streamsData.activeStreams[streamIdToStop];
    streamsData.streamHistory.push({
        ...stream,
        endTime: new Date().toISOString(),
        duration: formatDuration(new Date().getTime() - new Date(stream.startTime).getTime()),
        exitCode: 'manual_stop_initiated',
    });
    updateStreamsData();

    return {
      success: true,
      message: `✅ **تم تنفيذ أمر إيقاف البث على يوتيوب بنجاح** ✅\n\nالمعرف: ${streamIdToStop}\nسيتم تحديث حالة البث وتأكيد الإيقاف الكامل قريباً.`
    };
  } catch (error) {
    console.error(`Error stopping FFmpeg process [${streamIdToStop}] (PID: ${stream.pid}): ${error.message}`);
    if (streamsData.activeStreams[streamIdToStop]) {
        const streamInfo = streamsData.activeStreams[streamIdToStop];
        streamsData.streamHistory.push({
            ...streamInfo,
            endTime: new Date().toISOString(),
            duration: formatDuration(new Date().getTime() - new Date(streamInfo.startTime).getTime()),
            exitCode: 'manual_stop_error_kill',
        });
        delete streamsData.activeStreams[streamIdToStop];
        updateStreamsData();
    }
    return {
      success: false,
      message: `🛑 **فشل إيقاف البث على يوتيوب** 🛑\n\nواجه النظام عائقاً أثناء محاولة إيقاف البث بالمعرف: ${streamIdToStop}.\nالخطأ المسجل: ${error.message}\n\nتمت محاولة إزالته من قائمة البثوث النشطة.`
    };
  }
};

const getActiveStreams = () => {
  const trulyActiveStreams = {};
  for (const streamId in streamsData.activeStreams) {
    const stream = streamsData.activeStreams[streamId];
    if (stream.pid) {
        try {
            process.kill(stream.pid, 0); 
            trulyActiveStreams[streamId] = stream; 
        } catch (e) {
            console.warn(`Process for stream ${streamId} (PID: ${stream.pid}) not found. Moving to history.`);
            streamsData.streamHistory.push({
                ...stream,
                endTime: new Date().toISOString(),
                duration: formatDuration(new Date().getTime() - new Date(stream.startTime).getTime()),
                exitCode: 'process_not_found_on_check',
            });
            delete streamsData.activeStreams[streamId];
        }
    } else {
        console.warn(`Stream ${streamId} has no PID. Moving to history.`);
         streamsData.streamHistory.push({
            ...stream,
            endTime: new Date().toISOString(),
            duration: formatDuration(new Date().getTime() - new Date(stream.startTime).getTime()),
            exitCode: 'no_pid_found_on_check',
        });
        delete streamsData.activeStreams[streamId];
    }
  }
  updateStreamsData();
  return Object.values(trulyActiveStreams).map(stream => {
    const { process, conn, ...streamInfo } = stream;
    return streamInfo;
  });
};

const reconcilePersistentStreams = () => {
    console.log("Checking for persistent streams on startup...");
    let updated = false;
    for (const streamId in streamsData.activeStreams) {
        const stream = streamsData.activeStreams[streamId];
        if (stream.pid) {
            try {
                process.kill(stream.pid, 0); 
                console.log(`Stream ${streamId} (PID: ${stream.pid}) is still running.`);
            } catch (e) {
                console.warn(`Persistent stream ${streamId} (PID: ${stream.pid}) found in records but process is not running. Moving to history.`);
                streamsData.streamHistory.push({
                    ...stream,
                    endTime: new Date().toISOString(), 
                    duration: formatDuration(new Date().getTime() - new Date(stream.startTime).getTime()),
                    exitCode: 'not_running_on_startup_check',
                });
                delete streamsData.activeStreams[streamId];
                updated = true;
            }
        } else {
            console.warn(`Persistent stream ${streamId} found with no PID. Moving to history.`);
            streamsData.streamHistory.push({
                ...stream,
                endTime: new Date().toISOString(),
                duration: formatDuration(new Date().getTime() - new Date(stream.startTime).getTime()),
                exitCode: 'no_pid_on_startup_check',
            });
            delete streamsData.activeStreams[streamId];
            updated = true;
        }
    }
    if (updated) {
        updateStreamsData();
    }
    console.log("Persistent stream check complete.");
};

reconcilePersistentStreams(); // Call on startup

let handler = async (m, { conn, args, text, command }) => {
  // Derive the effective owner list for this handler invocation
  const effectiveOwnerJidsInHandler = [...new Set([
      ...(global.owner || []).map(v => String(v).replace(/[^0-9]/g, '') + '@s.whatsapp.net'),
      ...CONFIG_OWNER_JIDS
  ])];

  if (command === 'yton') {
    const subscriptionStatus = await checkAndGrantSubscription(m.sender, conn, m);
    if (!subscriptionStatus.valid && !subscriptionStatus.isOwner) {
        if (subscriptionStatus.reason === 'Expired') {
            return m.reply(`🛑 **تنبيه هام: اشتراك منتهي الصلاحية** 🛑\n\nنأسف لإبلاغك بأن فترة اشتراكك في خدمة البث المباشر المميزة قد انتهت.\nلتستمر في الاستمتاع بميزاتنا الحصرية، يرجى المبادرة بتجديد اشتراكك.`);
        }
        return m.reply(`🔒 **خدمة حصرية للمشتركين** 🔒\n\nللوصول إلى هذه الميزة المتقدمة، يتوجب عليك تفعيل اشتراكك المميز أو أن تكون من ملاك النظام.`);
    }

    if (!text) {
      return m.reply(`🚫 **أمر غير مكتمل** 🚫\n\nيرجى تحديد معلمات البث المطلوبة بدقة.\nمثال للاستخدام الاحترافي:\n*.yton* rtmp_url stream_key m3u8_url [quality] [privacy]\n\nالجودة: low, medium, high, ultra\nالخصوصية: public, unlisted, private`);
    }
    
    const parts = text.split(' ');
    if (parts.length < 3) {
      return m.reply(`🚫 **معلومات الإدخال غير كافية** 🚫\n\nلضمان إطلاق بثك بنجاح، يرجى تزويدنا بالمعلومات التالية كاملة:\n  - عنوان RTMP الكامل\n  - مفتاح البث السري\n  - رابط مصدر البث (M3U8)\n\nيمكنك أيضاً تحديد (اختياري):\n  - جودة البث (low, medium, high, ultra)\n  - خصوصية البث (public, unlisted, private)`);
    }
    
    const rtmpUrl = parts[0];
    const streamKey = parts[1];
    const m3u8Url = parts[2];
    const quality = parts[3] || 'medium';
    const privacy = parts[4] || 'public';

    m.reply(`🔄 **جاري إطلاق البث على يوتيوب** 🔄\n\nيرجى الانتظار بينما نقوم بإعداد البث المباشر الخاص بك...\nقد تستغرق هذه العملية بضع لحظات.`);

    const result = await startYouTubeLiveStream(rtmpUrl, streamKey, m3u8Url, m.chat, m.sender, conn, quality, privacy);
    return m.reply(result.message);
  } 
  else if (command === 'ytoff') {
    const subscriptionStatus = await checkAndGrantSubscription(m.sender, conn, m);
    if (!subscriptionStatus.valid && !subscriptionStatus.isOwner) {
        if (subscriptionStatus.reason === 'Expired') {
            return m.reply(`🛑 **تنبيه هام: اشتراك منتهي الصلاحية** 🛑\n\nنأسف لإبلاغك بأن فترة اشتراكك في خدمة البث المباشر المميزة قد انتهت.\nلتستمر في الاستمتاع بميزاتنا الحصرية، يرجى المبادرة بتجديد اشتراكك.`);
        }
        return m.reply(`🔒 **خدمة حصرية للمشتركين** 🔒\n\nللوصول إلى هذه الميزة المتقدمة، يتوجب عليك تفعيل اشتراكك المميز أو أن تكون من ملاك النظام.`);
    }

    if (!text) {
      return m.reply(`🚫 **أمر غير مكتمل** 🚫\n\nيرجى تحديد معرف البث الذي ترغب في إيقافه.\nمثال للاستخدام الاحترافي:\n*.ytoff* stream_id`);
    }

    const streamId = text.trim();
    const result = await stopYouTubeLiveStream(streamId);
    return m.reply(result.message);
  } 
  else if (command === 'ytstreams') {
    const subscriptionStatus = await checkAndGrantSubscription(m.sender, conn, m);
    if (!subscriptionStatus.valid && !subscriptionStatus.isOwner) {
        if (subscriptionStatus.reason === 'Expired') {
            return m.reply(`🛑 **تنبيه هام: اشتراك منتهي الصلاحية** 🛑\n\nنأسف لإبلاغك بأن فترة اشتراكك في خدمة البث المباشر المميزة قد انتهت.\nلتستمر في الاستمتاع بميزاتنا الحصرية، يرجى المبادرة بتجديد اشتراكك.`);
        }
        return m.reply(`🔒 **خدمة حصرية للمشتركين** 🔒\n\nللوصول إلى هذه الميزة المتقدمة، يتوجب عليك تفعيل اشتراكك المميز أو أن تكون من ملاك النظام.`);
    }

    const activeStreams = getActiveStreams();
    if (activeStreams.length === 0) {
      return m.reply(`📊 **حالة البث المباشر** 📊\n\nلا توجد بثوث نشطة حالياً على يوتيوب.`);
    }

    let streamsText = `📊 **البثوث النشطة على يوتيوب** 📊\n\n`;
    activeStreams.forEach((stream, index) => {
      const startTime = new Date(stream.startTime);
      const duration = formatDuration(new Date().getTime() - startTime.getTime());
      
      streamsText += `🔴 **البث #${index + 1}**\n`;
      streamsText += `  🆔 المعرف: ${stream.id}\n`;
      streamsText += `  👤 المستخدم: @${stream.userId.split('@')[0]}\n`;
      streamsText += `  ⏱️ المدة: ${duration}\n`;
      streamsText += `  🔍 الخصوصية: ${stream.privacy || 'public'}\n`;
      streamsText += `  📊 الجودة: ${stream.quality || 'medium'}\n\n`;
    });

    return m.reply(streamsText);
  }
  else if (command === 'ythelp') {
    return m.reply(`🎬 **دليل استخدام خدمة البث المباشر على يوتيوب** 🎬

▫️ **بدء البث المباشر:**
*.yton* rtmp_url stream_key m3u8_url [quality] [privacy]

▫️ **إيقاف البث المباشر:**
*.ytoff* stream_id

▫️ **عرض البثوث النشطة:**
*.ytstreams*

▫️ **خيارات الجودة المتاحة:**
- low: دقة 480p بمعدل 30 إطار/ثانية
- medium: دقة 720p بمعدل 30 إطار/ثانية (الافتراضي)
- high: دقة 1080p بمعدل 30 إطار/ثانية
- ultra: دقة 1080p بمعدل 60 إطار/ثانية

▫️ **خيارات الخصوصية:**
- public: متاح للجميع ويظهر في نتائج البحث (الافتراضي)
- unlisted: متاح فقط لمن لديه الرابط
- private: متاح فقط لك وللمستخدمين المحددين

للحصول على مفتاح البث الخاص بك، يرجى زيارة لوحة تحكم يوتيوب ستوديو.`);
  }
};

handler.help = ['yton', 'ytoff', 'ytstreams', 'ythelp'];
handler.tags = ['youtube'];
handler.command = /^(yton|ytoff|ytstreams|ythelp)$/i;

export default handler;

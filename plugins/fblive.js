import fetch from 'node-fetch';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import moment from 'moment-timezone';

// --- Configuration for Owners --- START ---
const CONFIG_OWNER_JIDS = [
    "212710643142@s.whatsapp.net",
    "212722875827@s.whatsapp.net"
];
// --- Configuration for Owners --- END ---

// --- Watermark Configuration --- START ---
const WATERMARK_PATH = '/home/container/WhatsApp Image 2025-05-03 at 00.14.43_61c296e8.jpg'; // Path to the watermark image
// --- Watermark Configuration --- END ---

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
                const userMsg = `👑 **مرحباً بك في تجربة البث المباشر المميزة!** 👑\n\nلقد تم تفعيل اشتراكك التجريبي الحصري تلقائياً.\n\n▫️ **مدة التجربة:** ${TRIAL_DURATION_DAYS} أيام من الخدمة الفاخرة.\n▫️ **تاريخ الانتهاء:** ${expiryDate.tz('Africa/Casablanca').format('YYYY-MM-DD HH:mm')}\n\nاستكشف قوة البث الاحترافي معنا!`;
                const targetChat = m.chat || userId;
                await conn.reply(targetChat, userMsg, m);

                const ownerMsg = `🔔 **إشعار خاص للمالك** 🔔\n\nتم منح اشتراك تجريبي مميز للمستخدم: @${userId.split('@')[0]}\n▫️ **المدة:** ${TRIAL_DURATION_DAYS} أيام\n▫️ **الانتهاء:** ${expiryDate.tz('Africa/Casablanca').format('YYYY-MM-DD HH:mm')}`;
                for (const ownerJid of effectiveOwnerJids) {
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

const STREAMS_PATH = './facebook_streams.json';
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
    // console.error('خطأ في تحديث ملف البث:', error);
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

// MODIFIED: Added useWatermark parameter
export const startFacebookLiveStream = async (rtmpUrl, streamKey, m3u8Url, chatId, userId, conn, useWatermark = false, customText = null) => {
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

  // Check if watermark file exists if requested
  if (useWatermark && !fs.existsSync(WATERMARK_PATH)) {
      console.error(`Watermark file not found at ${WATERMARK_PATH}`);
      return {
          success: false,
          message: `🚫 **خطأ في العلامة المائية** 🚫\n\nلم يتم العثور على ملف العلامة المائية المحدد في المسار:\n${WATERMARK_PATH}\n\nيرجى التأكد من وجود الملف أو تعطيل خيار العلامة المائية.`
      };
  }

  const streamId = Date.now().toString();
  // FIXED: Construct fullRtmpUrl correctly, avoiding double slashes
  const fullRtmpUrl = rtmpUrl.endsWith('/') ? `${rtmpUrl}${streamKey}` : `${rtmpUrl}/${streamKey}`;
  const streamStartTime = new Date();
  const logFilePath = path.join(LOGS_DIR, `${streamId}_ffmpeg.log`);

  try {
    let ffmpegArgs = [
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '300',
      '-rw_timeout', '30000000',
      '-timeout', '30000000',
      '-i', m3u8Url, // Input 0: Main source
    ];

    let videoFilters = [];
    let needsReEncoding = false;

    // Add watermark input and filter if requested
    if (useWatermark) {
        ffmpegArgs.push('-i', WATERMARK_PATH); // Input 1: Watermark
        // MODIFIED Watermark filter: scale to 200px width, overlay at top-right (W-w:40)
        videoFilters.push('[1:v]scale=300:-1[wm];[0:v][wm]overlay=W-w:40');
        needsReEncoding = true;
    }

    // Add custom text filter if provided
    if (customText && customText.trim()) {
        const fontPath = '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf';
        if (!fs.existsSync(fontPath)) {
            console.warn(`Font file not found at ${fontPath}. Drawtext might fail.`);
            // Consider adding a warning to the user message
        }
        const escapedText = customText.trim().replace(/'/g, "'\\''");        const drawtextFilter = `drawtext=fontfile=\'/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf\':text=\'${escapedText}\':fontcolor=white:fontsize=24:box=1:boxcolor=black@0.5:boxborderw=5:x=(w-text_w)/2:y=h-th-40`; // Using NotoSans-Regular for French support
        // If watermark is also used, chain the filter
        if (useWatermark) {
            // Input [0:v] is already used by watermark overlay, chain drawtext after it
            // The output of the overlay is the main video stream now
            videoFilters[videoFilters.length - 1] += `[vid_wm];[vid_wm]${drawtextFilter}`;
        } else {
            // No watermark, apply drawtext directly to input [0:v]
            videoFilters.push(`[0:v]${drawtextFilter}`);
        }
        needsReEncoding = true;
    }

    // Apply video filters if any exist
    if (videoFilters.length > 0) {
        ffmpegArgs.push('-filter_complex', videoFilters.join(';'));
    }

    // Set codecs
    if (needsReEncoding) {
        ffmpegArgs.push('-c:v', 'libx264', '-preset', 'ultrafast'); // Re-encode video
        ffmpegArgs.push('-c:a', 'aac'); // Ensure audio codec is set (can be copy if source is compatible, but AAC is safer)
    } else {
        ffmpegArgs.push('-c:v', 'copy'); // Copy video if no filters applied
        ffmpegArgs.push('-c:a', 'copy'); // Copy audio if no filters applied
    }

    // Add final RTMP args
    ffmpegArgs.push(
      '-rtmp_live', 'live',
      '-f', 'flv',
      fullRtmpUrl
    );

    // Spawn FFmpeg process
    const ffmpegLogStream = fs.createWriteStream(logFilePath, { flags: 'a' });
    console.log("Executing FFmpeg with args:", ffmpegArgs.join(' '));
    const ffmpeg = spawn("ffmpeg", ffmpegArgs, { detached: true, stdio: ["ignore", "pipe", "pipe"] });

    // Pipe stdout and stderr to the log file stream
    ffmpeg.stdout.pipe(ffmpegLogStream);
    ffmpeg.stderr.pipe(ffmpegLogStream);

    // Event listeners for error/close
    ffmpeg.on("error", (err) => {
      console.error(`FFmpeg process [${streamId}] failed to start or crashed:`, err);
      if (streamsData.activeStreams[streamId]) {
          delete streamsData.activeStreams[streamId];
          updateStreamsData();
      }
    });

    ffmpeg.on("close", (code) => {
      console.log(`FFmpeg process [${streamId}] exited with code ${code}`);
      if (streamsData.activeStreams[streamId]) {
          streamsData.streamHistory.push({
              ...streamsData.activeStreams[streamId],
              endTime: new Date().toISOString(),
              duration: formatDuration(new Date().getTime() - new Date(streamsData.activeStreams[streamId].startTime).getTime()),
              exitCode: `auto_exit_${code}`,
          });
          delete streamsData.activeStreams[streamId];
          updateStreamsData();
      }
    });

    ffmpeg.unref();

    // Update streams data immediately after spawn attempt
    streamsData.activeStreams[streamId] = {
      id: streamId, rtmpUrl, streamKey, m3u8Url, chatId, userId,
      startTime: streamStartTime.toISOString(), pid: ffmpeg.pid, logFile: logFilePath,
      customText: customText || null,
      watermarkEnabled: useWatermark // Store watermark status
    };
    updateStreamsData();

    console.log(`FFmpeg process [${streamId}] started with PID ${ffmpeg.pid} by user ${userId}. Output to ${logFilePath}`);

    // Build success message
    let successMessage = `✅ **تم إطلاق البث بنجاح!** ✅\n\nمعرف البث الفريد: \n  🆔 \t${streamId}`;
    if (useWatermark) {
        successMessage += `\n🖼️ **العلامة المائية:** مفعلة (200px, أعلى اليمين)`;
    }
    if (customText && customText.trim()) {
        successMessage += `\n📝 **النص المخصص المعروض:** "${customText.trim()}"`;
    }
    successMessage += `\n\nسيتم حفظ سجلات التشغيل المفصلة في:\n  📄 \t${logFilePath}`;

    return {
      success: true,
      message: successMessage,
      streamId, logFile: logFilePath, pid: ffmpeg.pid
    };

} catch (error) {
    console.error(`Error starting FFmpeg stream [${streamId}]:`, error);
    if (streamsData.activeStreams[streamId]) {
        delete streamsData.activeStreams[streamId];
        updateStreamsData();
    }
    return {
        success: false,
        message: `🛑 **فشل إطلاق البث** 🛑\n\nواجه النظام عائقاً غير متوقع أثناء محاولة بدء البث.\nالخطأ المسجل: ${error.message}\n\nنرجو المحاولة مجدداً. إذا استمرت المشكلة، يرجى مراجعة سجلات الخطأ (${logFilePath}) أو الاتصال بالدعم.`
    };
}
};

// --- باقي الكود (stopFacebookLiveStream, getActiveStreams, etc.) --- 

const stopFacebookLiveStream = (streamIdToStop) => {
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
        try {
            process.kill(pid, 'SIGTERM');
            console.log(`Sent SIGTERM to FFmpeg process [${streamIdToStop}] with PID ${pid}.`);
        } catch (killError) {
            console.warn(`Failed to send SIGTERM to PID ${pid} for stream ${streamIdToStop}, might have already exited: ${killError.message}`);
        }
    } else {
        console.warn(`No PID found for stream [${streamIdToStop}]. Manual cleanup might be needed.`);
    }

    streamsData.streamHistory.push({
        ...stream,
        endTime: new Date().toISOString(),
        duration: formatDuration(new Date().getTime() - new Date(stream.startTime).getTime()),
        exitCode: 'manual_stop_initiated',
    });
    delete streamsData.activeStreams[streamIdToStop];
    updateStreamsData();

    return {
      success: true,
      message: `✅ **تم تنفيذ أمر إيقاف البث بنجاح** ✅\n\nالمعرف: ${streamIdToStop}\nتم نقل البث إلى السجل التاريخي.`
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
      message: `🛑 **فشل إيقاف البث** 🛑\n\nواجه النظام عائقاً أثناء محاولة إيقاف البث بالمعرف: ${streamIdToStop}.\nالخطأ المسجل: ${error.message}\n\nتمت محاولة إزالته من قائمة البثوث النشطة ونقله للسجل التاريخي.`
    };
  }
};

const getActiveStreams = () => {
  const trulyActiveStreams = {};
  let updated = false;
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
            updated = true;
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
        updated = true;
    }
  }
  if (updated) {
      updateStreamsData();
  }
  return Object.values(trulyActiveStreams).map(stream => {
    const { pid, conn, ...streamInfo } = stream; // Exclude conn
    return { ...streamInfo, pid: stream.pid }; // Keep pid for display
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

reconcilePersistentStreams();

// MODIFIED: Parses the command including watermark flags 'on' or 'oni'
const parseStreamCommand = (text) => {
  const parts = text.trim().split(' ');
  let useWatermark = false;
  let watermarkOnly = false; // Flag for 'oni'
  let startIndex = 0;

  // Check for watermark flags
  if (parts.length > 0 && (parts[0].toLowerCase() === 'on' || parts[0].toLowerCase() === 'oni')) {
      useWatermark = true;
      watermarkOnly = parts[0].toLowerCase() === 'oni';
      startIndex = 1; // Start parsing actual args from the next part
  }

  // Check minimum required arguments (rtmp, key, m3u8)
  if (parts.length < startIndex + 3) {
    return {
      valid: false,
      error: 'معلومات غير كافية. يجب توفير RTMP URL ومفتاح البث ورابط M3U8 على الأقل. استخدم `on` أو `oni` قبلها للعلامة المائية.'
    };
  }

  const rtmpUrl = parts[startIndex];
  const streamKey = parts[startIndex + 1];
  const m3u8Url = parts[startIndex + 2];
  let customText = null;

  // Get custom text only if not 'oni'
  if (!watermarkOnly && parts.length > startIndex + 3) {
      customText = parts.slice(startIndex + 3).join(' ').trim();
  }

  // Basic URL validation (optional but recommended)
  if (!rtmpUrl.startsWith('rtmp://') && !rtmpUrl.startsWith('rtmps://')) {
      console.warn("Potential issue: RTMP URL doesn't start with rtmp:// or rtmps://");
      // You might want to return an error here depending on strictness
      // return { valid: false, error: 'عنوان RTMP يجب أن يبدأ بـ rtmp:// أو rtmps://' };
  }
  // Basic M3U8 validation (optional)
  // try { new URL(m3u8Url); } catch { console.warn("Potential issue: M3U8 URL might be invalid"); }

  return {
    valid: true,
    rtmpUrl,
    streamKey,
    m3u8Url,
    useWatermark,
    customText: customText || null // Ensure it's null if empty or 'oni' was used
  };
};

let handler = async (m, { conn, args, text, command }) => {
  const effectiveOwnerJidsInHandler = [...new Set([
      ...(global.owner || []).map(v => String(v).replace(/[^0-9]/g, '') + '@s.whatsapp.net'),
      ...CONFIG_OWNER_JIDS
  ])];

  if (command === 'fbon') {
    const subscriptionStatus = await checkAndGrantSubscription(m.sender, conn, m);
    if (!subscriptionStatus.valid && !subscriptionStatus.isOwner) {
        if (subscriptionStatus.reason === 'Expired') {
            return m.reply(`🛑 **تنبيه هام: اشتراك منتهي الصلاحية** 🛑\n\nنأسف لإبلاغك بأن فترة اشتراكك في خدمة البث المباشر المميزة قد انتهت.\nلتستمر في الاستمتاع بميزاتنا الحصرية، يرجى المبادرة بتجديد اشتراكك.`);
        }
         if (subscriptionStatus.trialJustGranted) {
             // Trial just granted, proceed
         } else {
            return m.reply(`🔒 **خدمة حصرية للمشتركين** 🔒\n\nللوصول إلى هذه الميزة المتقدمة، يتوجب عليك تفعيل اشتراكك المميز أو أن تكون من ملاك النظام.`);
         }
    }

    // MODIFIED: Updated help message for missing text
    if (!text) {
      return m.reply(`🚫 **أمر غير مكتمل** 🚫\n\nيرجى تحديد معلمات البث المطلوبة بدقة.\n**الصيغ الممكنة:**\n*.fbon* <عنوان_RTMP> <مفتاح_البث> <رابط_M3U8> [النص الاختياري]\n*.fbon* on <عنوان_RTMP> <مفتاح_البث> <رابط_M3U8> [النص الاختياري]\n*.fbon* oni <عنوان_RTMP> <مفتاح_البث> <رابط_M3U8>\n\n**أمثلة:**\n*.fbon* rtmp://a.rtmp.youtube.com/live2 key123 http://ex.com/stream.m3u8\n*.fbon* on rtmp://live.example.com abc123 http://stream.m3u8 السلام عليكم\n*.fbon* oni rtmp://live.example.com abc123 http://stream.m3u8`);
    }

    // MODIFIED: Use updated parseStreamCommand
    const parsedCommand = parseStreamCommand(text);
    if (!parsedCommand.valid) {
      return m.reply(`🚫 **معلومات الإدخال غير صالحة أو غير كافية** 🚫\n\n${parsedCommand.error || 'يرجى التحقق من تنسيق الأمر والمحاولة مرة أخرى.'}\nراجع الأمثلة في رسالة الخطأ السابقة أو استخدم *.help_stream*`);
    }

    m.reply('⚙️ **جاري تهيئة نظام البث المتقدم...** يرجى الانتظار لحظات قليلة.');

    // MODIFIED: Pass useWatermark and customText to startFacebookLiveStream
    const result = await startFacebookLiveStream(
      parsedCommand.rtmpUrl,
      parsedCommand.streamKey,
      parsedCommand.m3u8Url,
      m.chat,
      m.sender,
      conn,
      parsedCommand.useWatermark,
      parsedCommand.customText
    );

    m.reply(result.message);

    // MODIFIED: Include watermark status in the detailed report
    if (result.success && result.streamId) {
      const streamData = streamsData.activeStreams[result.streamId];
      if (streamData) {
        let detailMessage = `💎 **تقرير إطلاق البث المباشر الاحترافي** 💎\n\n▫️ **المعرف الفريد للبث:** ${result.streamId}\n▫️ **بواسطة المشترك الموقر:** @${m.sender.split('@')[0]}\n▫️ **وجهة البث (خادم RTMP):** ${parsedCommand.rtmpUrl}\n▫️ **مفتاح البث الآمن:** ${parsedCommand.streamKey}\n▫️ **مصدر الفيديو عالي الجودة:** ${parsedCommand.m3u8Url}\n▫️ **وقت الإطلاق الدقيق:** ${moment(streamData.startTime).tz('Africa/Casablanca').format('YYYY-MM-DD HH:mm:ss')}`;

        if (streamData.watermarkEnabled) {
            detailMessage += `\n▫️ **العلامة المائية:** مفعلة`;
        }
        if (streamData.customText) {
          detailMessage += `\n▫️ **النص المخصص المعروض:** "${streamData.customText}"`;
        }

        detailMessage += `\n▫️ **ملف سجلات التشخيص:** ${streamData.logFile}\n▫️ **معرّف عملية النظام:** ${streamData.pid || 'غير متوفر'}\n\nلإيقاف هذا البث، استخدم الأمر:\n*.fboff* ${result.streamId}`;

        conn.reply(m.chat, detailMessage, m, { mentions: [m.sender] });
      } else {
          console.error(`Failed to retrieve stream data for ${result.streamId} immediately after creation.`);
          conn.reply(m.chat, `⚠️ حدث خطأ أثناء استرداد تفاصيل البث ${result.streamId} بعد إنشائه مباشرة.`, m);
      }
    }
  } else if (command === 'fboff') {
    const subscriptionStatus = await checkAndGrantSubscription(m.sender, conn, m);
    if (!subscriptionStatus.valid && !subscriptionStatus.isOwner) {
        if (subscriptionStatus.reason === 'Expired') {
            return m.reply(`🛑 **تنبيه هام: اشتراك منتهي الصلاحية** 🛑\n\nنأسف لإبلاغك بأن فترة اشتراكك في خدمة البث المباشر المميزة قد انتهت.\nلتستمر في الاستمتاع بميزاتنا الحصرية، يرجى المبادرة بتجديد اشتراكك.`);
        }
        return m.reply(`🔒 **خدمة حصرية للمشتركين** 🔒\n\nللوصول إلى هذه الميزة المتقدمة، يتوجب عليك تفعيل اشتراكك المميز أو أن تكون من ملاك النظام.`);
    }

    if (!text) {
      return m.reply(`🚫 **أمر غير مكتمل** 🚫\n\nيرجى تحديد معرف البث المراد إيقافه.\nمثال للاستخدام الاحترافي:\n*.fboff* stream_id_here`);
    }
    const streamIdToStop = text.trim();
    const streamToStop = streamsData.activeStreams[streamIdToStop];

    if (streamToStop && streamToStop.userId !== m.sender && !effectiveOwnerJidsInHandler.includes(m.sender)) {
        return m.reply(`🛑 **وصول مرفوض** 🛑\n\nيمكنك فقط إيقاف البثوث التي بدأتها أنت، أو يجب أن تكون مالكًا للنظام لإيقاف بثوث الآخرين.`);
    }

    const result = stopFacebookLiveStream(streamIdToStop);
    m.reply(result.message);

  } else if (command === 'streams' || command === 'بثوثي') {
    const subscriptionStatus = await checkAndGrantSubscription(m.sender, conn, m);
     if (!subscriptionStatus.valid && !subscriptionStatus.isOwner) {
        if (subscriptionStatus.reason === 'Expired') {
            return m.reply(`🛑 **تنبيه هام: اشتراك منتهي الصلاحية** 🛑\n\nنأسف لإبلاغك بأن فترة اشتراكك في خدمة البث المباشر المميزة قد انتهت.\nلتستمر في الاستمتاع بميزاتنا الحصرية، يرجى المبادرة بتجديد اشتراكك.`);
        }
         if (subscriptionStatus.trialJustGranted) {
             // Allow viewing streams even if trial just granted
         } else {
            return m.reply(`🔒 **خدمة حصرية للمشتركين** 🔒\n\nللوصول إلى هذه الميزة المتقدمة، يتوجب عليك تفعيل اشتراكك المميز أو أن تكون من ملاك النظام.`);
         }
    }

    const activeStreams = getActiveStreams();
    const userStreams = activeStreams.filter(stream => stream.userId === m.sender);

    if (userStreams.length === 0) {
      return m.reply('ℹ️ **لا توجد بثوث نشطة حالياً لك.** ℹ️');
    }
    let message = `📺 **قائمة بثوثك النشطة حالياً (${userStreams.length})** 📺\n\n`;
    userStreams.forEach((stream, index) => {
      const startTime = moment(stream.startTime).tz('Africa/Casablanca');
      const duration = formatDuration(moment().diff(startTime));
      message += `${index + 1}. 🆔 ${stream.id}\n   🔑 مفتاح: ${stream.streamKey || 'غير متوفر'}\n   🔗 المصدر: ${stream.m3u8Url}\n   🖼️ علامة مائية: ${stream.watermarkEnabled ? 'نعم' : 'لا'}\n   📝 النص: ${stream.customText || 'لا يوجد'}\n   ⏱️ بدأ: ${startTime.format('HH:mm:ss DD/MM')}\n   ⏳ المدة: ${duration}\n   ⚙️ PID: ${stream.pid || 'N/A'}\n\n`;
    });
    message += `لإيقاف بث، استخدم الأمر:\n*.fboff* <معرف_البث>`;
    m.reply(message);

  } else if (command === 'البثوث') { // Owner command
    if (!effectiveOwnerJidsInHandler.includes(m.sender)) {
        return m.reply(`🛑 **وصول مقيد** 🛑\n\nهذا الأمر مخصص لملاك النظام فقط.`);
    }
    const allActiveStreams = getActiveStreams();
    if (allActiveStreams.length === 0) {
      return m.reply('ℹ️ **لا توجد أي بثوث نشطة حالياً على النظام.** ℹ️');
    }
    let message = `👑 **قائمة جميع البثوث النشطة على النظام (${allActiveStreams.length}) (خاص بالمالك)** 👑\n\n`;
    const mentions = [];
    allActiveStreams.forEach((stream, index) => {
      const startTime = moment(stream.startTime).tz('Africa/Casablanca');
      const duration = formatDuration(moment().diff(startTime));
      const userDisplay = stream.userId ? `@${stream.userId.split('@')[0]}` : 'غير معروف';
      if (stream.userId) mentions.push(stream.userId);
      message += `${index + 1}. 🆔 ${stream.id}\n   👤 المستخدم: ${userDisplay}\n   🔑 مفتاح: ${stream.streamKey || 'غير متوفر'}\n   🔗 المصدر: ${stream.m3u8Url}\n   🖼️ علامة مائية: ${stream.watermarkEnabled ? 'نعم' : 'لا'}\n   📝 النص: ${stream.customText || 'لا يوجد'}\n   ⏱️ بدأ: ${startTime.format('HH:mm:ss DD/MM')}\n   ⏳ المدة: ${duration}\n   ⚙️ PID: ${stream.pid || 'N/A'}\n\n`;
    });
    message += `لإيقاف أي بث، استخدم الأمر:\n*.fboff* <معرف_البث>`;
    m.reply(message, null, { mentions: [...new Set(mentions)] });

  } else if (command === 'help_stream') {
    // MODIFIED: Updated help message with watermark options
    m.reply(`🌟 **دليل الاستخدام الشامل لخدمة البث المباشر الاحترافية** 🌟\n\nأهلاً بك في مركز التحكم بخدمات البث المتقدمة. إليك أوامر التحكم الرئيسية:\n\n1️⃣  **إطلاق بث مباشر جديد:**\n   *.fbon* [on|oni] <عنوان_RTMP> <مفتاح_البث> <رابط_M3U8> [النص الاختياري]\n\n   *الشرح:*\n     - لا تستخدم \non\n أو \noni\n لبث بدون علامة مائية.\n     - استخدم \non\n لبث مع علامة مائية ونص اختياري.\n     - استخدم \noni\n لبث مع علامة مائية فقط (بدون نص).\n\n   *أمثلة:*\n     *.fbon* rtmp://a.rtmp.youtube.com/live2 key123 https://ex.com/stream.m3u8\n     *.fbon* on rtmp://live.example.com abc123 http://stream.m3u8 السلام عليكم\n     *.fbon* oni rtmp://live.example.com abc123 http://stream.m3u8\n\n2️⃣  **إيقاف بث مباشر:**\n   *.fboff* <معرف_البث>\n   *مثال:*     *.fboff* 1678886400000\n\n3️⃣  **عرض بثوثك النشطة:**\n   *.بثوثي* أو *.streams*\n\n4️⃣  **عرض جميع البثوث النشطة (خاص بالمالك):**\n   *.البثوث*\n\n5️⃣  **إدارة الاشتراكات (خاص بالمالك):**\n   *.addsub* @user <أيام>\n   *.delsub* @user\n   *.checksub* @user\n   *.listsubs*\n\n6️⃣  **الحصول على هذا الدليل:**\n   *.help_stream*\n\n✨ **نصيحة احترافية:** تأكد دائماً من صحة رابط المصدر (M3U8) ومفتاح البث. العلامة المائية والنص يتطلبان إعادة ترميز الفيديو، مما قد يزيد من استهلاك موارد الخادم.`);
  }
}; // <-- ENSURE THIS CLOSING BRACE IS PRESENT

// MODIFIED: Updated help array
handler.help = [
  'fbon [on|oni] <rtmpUrl> <streamKey> <m3u8Url> [customText]',
  'fboff <streamId>',
  'streams', 'بثوثي',
  'البثوث (owner)',
  'help_stream'
];
handler.tags = ['facebook', 'streaming', 'owner'];
handler.command = /^(fbon|fboff|streams|بثوثي|البثوث|help_stream)$/i;
handler.owner = false;

export default handler;


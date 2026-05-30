// offscreen.js — runs in an invisible extension page

let recorder        = null;
let audioCtx        = null;
let silenceInterval = null;
let maxTimer        = null;
let recording       = false;
let chunks          = [];
let recordedMime    = 'audio/webm';
let activeStream    = null; // kept alive between recordings to avoid getUserMedia cold-start

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'OFFSCREEN_START')   startRecording(msg.streamId);
  if (msg.type === 'OFFSCREEN_RESTART') startRecording(null); // reuse existing stream
  if (msg.type === 'OFFSCREEN_STOP')    stopRecording(true);
});

function push(payload) {
  chrome.runtime.sendMessage({ type: 'FROM_OFFSCREEN', ...payload }).catch(() => {});
}

async function startRecording(streamId) {
  if (recording) stopRecording(false);
  chunks = [];

  if (streamId !== null) {
    // OFFSCREEN_START — always create a fresh stream for this tab's streamId
    if (activeStream) {
      activeStream.getTracks().forEach(t => t.stop());
      activeStream = null;
    }
    try {
      activeStream = await navigator.mediaDevices.getUserMedia({
        audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
        video: false,
      });
    } catch (err) {
      activeStream = null;
      push({ status: 'error', message: 'getUserMedia failed: ' + err.message });
      return;
    }
  } else {
    // OFFSCREEN_RESTART — reuse existing stream, error if it died
    const streamDead = !activeStream || activeStream.getTracks().some(t => t.readyState === 'ended');
    if (streamDead) {
      push({ status: 'error', message: 'Stream lost — restarting capture.' });
      return;
    }
  }

  const stream = activeStream;

  // Pick best MIME
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', '']
    .find(m => !m || MediaRecorder.isTypeSupported(m)) || '';
  recordedMime = mime || 'audio/webm';

  recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = () => {
    cleanup();
    // Do NOT stop stream tracks — keep stream alive for next recording

    const blob = new Blob(chunks, { type: recordedMime });
    if (blob.size < 500) {
      push({ status: 'no_audio' });
      return;
    }
    const fr = new FileReader();
    fr.onload = () => push({
      status: 'audio_ready',
      audio: fr.result.split(',')[1],
      mimeType: recordedMime,
    });
    fr.readAsDataURL(blob);
  };

  recorder.start(100);
  recording = true;
  push({ status: 'started' });

  // Silence detection
  try {
    audioCtx       = new AudioContext();
    const source   = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);

    let silenceMs = 0;
    let hasSpeech = false;
    let volLog = 0;

    silenceInterval = setInterval(() => {
      if (!recording) return;
      analyser.getByteFrequencyData(buf);
      const vol = buf.reduce((a, b) => a + b, 0) / buf.length;

      push({ status: 'volume', vol });

      // Log peak vol every 2s so devtools console shows if audio is arriving
      volLog++;
      if (volLog % 20 === 0) console.log('[MA] vol sample:', vol.toFixed(2));

      if (vol > 2) {
        hasSpeech = true;
        silenceMs = 0;
      } else if (hasSpeech) {
        silenceMs += 100;
        if (silenceMs >= 1200) stopRecording(false);
      }
    }, 100);
  } catch (_) {}

  maxTimer = setTimeout(() => stopRecording(false), 30000);
}

function stopRecording(killStream) {
  if (!recording) return;
  recording = false;
  cleanup();
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  if (killStream && activeStream) {
    activeStream.getTracks().forEach(t => t.stop());
    activeStream = null;
  }
}

function cleanup() {
  clearInterval(silenceInterval); silenceInterval = null;
  clearTimeout(maxTimer);         maxTimer = null;
  if (audioCtx) { try { audioCtx.close(); } catch (_) {} audioCtx = null; }
}

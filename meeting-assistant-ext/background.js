// background.js — service worker
// Routes: content ↔ offscreen ↔ Groq API

let activeTabId     = null;
let streamActive    = false; // true while offscreen holds a live tab-capture stream
let streamActiveTab = null;  // which tab owns the current live stream

// ── Message router ────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender) => {
  // From content script
  if (msg.type === 'START_CAPTURE') {
    activeTabId = sender.tab.id;
    console.log('[MA] START_CAPTURE tabId:', sender.tab.id, 'streamActive:', streamActive, 'streamActiveTab:', streamActiveTab);
    if (streamActive && streamActiveTab === sender.tab.id) {
      console.log('[MA] Reusing stream → OFFSCREEN_RESTART');
      chrome.runtime.sendMessage({ type: 'OFFSCREEN_RESTART' }).catch(() => {});
    } else {
      console.log('[MA] Fresh capture → startCapture');
      streamActive    = false;
      streamActiveTab = null;
      startCapture(sender.tab.id);
    }
    return;
  }
  if (msg.type === 'STOP_CAPTURE') {
    streamActive    = false;
    streamActiveTab = null;
    chrome.runtime.sendMessage({ type: 'OFFSCREEN_STOP' }).catch(() => {});
    return;
  }

  // From offscreen document
  if (msg.type === 'FROM_OFFSCREEN') {
    handleOffscreenMsg(msg);
    return;
  }
});

// ── Push message to the active Meet tab ──────────────────────────────────────
function pushToTab(type, payload = {}) {
  if (!activeTabId) return;
  chrome.tabs.sendMessage(activeTabId, { type, ...payload }).catch(() => {});
}

// ── Handle messages coming from offscreen.js ─────────────────────────────────
function handleOffscreenMsg(msg) {
  if (msg.status !== 'volume') console.log('[MA] offscreen →', msg.status, msg.message || '');
  switch (msg.status) {
    case 'started':
      streamActive    = true;
      streamActiveTab = activeTabId;
      pushToTab('MA_STARTED');
      break;
    case 'volume':
      pushToTab('MA_VOLUME', { vol: msg.vol });
      break;
    case 'no_audio':
      pushToTab('MA_ERROR', { message: 'No audio detected — make sure meeting audio is playing.' });
      break;
    case 'error':
      streamActive    = false;
      streamActiveTab = null;
      pushToTab('MA_ERROR', { message: msg.message || 'Capture failed.' });
      break;
    case 'audio_ready':
      pushToTab('MA_TRANSCRIBING');
      transcribeAndAnswer(msg.audio, msg.mimeType);
      break;
  }
}

// ── Ensure offscreen document exists ─────────────────────────────────────────
async function ensureOffscreen() {
  const exists = await chrome.offscreen.hasDocument().catch(() => false);
  if (!exists) {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: ['USER_MEDIA'],
      justification: 'Capture Google Meet tab audio for speech-to-text',
    });
  }
}

// ── Start tab audio capture ───────────────────────────────────────────────────
async function startCapture(tabId) {
  try {
    await ensureOffscreen();
  } catch (err) {
    pushToTab('MA_ERROR', { message: 'Could not create offscreen document: ' + err.message });
    return;
  }

  chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
    if (chrome.runtime.lastError || !streamId) {
      const err = chrome.runtime.lastError?.message || 'no stream ID';
      console.log('[MA] getMediaStreamId FAILED:', err);
      pushToTab('MA_ERROR', { message: 'Tab capture failed: ' + err });
      return;
    }
    console.log('[MA] Got streamId:', streamId.slice(0, 20) + '...');
    chrome.runtime.sendMessage({ type: 'OFFSCREEN_START', streamId }).catch((err) => {
      console.log('[MA] Offscreen message failed:', err.message);
      pushToTab('MA_ERROR', { message: 'Offscreen messaging failed: ' + err.message });
    });
  });
}

// ── Whisper transcription → Llama answer ─────────────────────────────────────
async function transcribeAndAnswer(audioBase64, mimeType) {
  const { ma_api_key: apiKey } = await chrome.storage.sync.get('ma_api_key');
  if (!apiKey) {
    pushToTab('MA_ERROR', { message: 'No API key — click the extension icon to add your Groq key.' });
    return;
  }

  // Step 1: Whisper
  let question = '';
  try {
    const bytes = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
    const blob  = new Blob([bytes], { type: mimeType || 'audio/webm' });
    const ext   = (mimeType || '').includes('ogg') ? 'ogg' : 'webm';
    const form  = new FormData();
    form.append('file', blob, `audio.${ext}`);
    form.append('model', 'whisper-large-v3-turbo');
    form.append('language', 'en');
    form.append('response_format', 'json');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) {
      let m = `Whisper error ${res.status}`;
      try { const j = await res.json(); m = j.error?.message || m; } catch {}
      pushToTab('MA_ERROR', { message: m });
      return;
    }

    question = ((await res.json()).text || '').trim();

    const FAKES = [
      'thank you', 'thank you.', 'thanks', 'thanks.', 'thanks for watching',
      'thanks for watching.', 'you', 'bye', 'bye.', 'okay.', 'ok.', 'hmm',
      'hmm.', 'um', 'uh', 'ah', 'subtitles by', 'www.', '.com',
      'subscribe', 'please subscribe', '(upbeat music)', '[music]',
    ];
    if (!question || FAKES.includes(question.toLowerCase())) {
      pushToTab('MA_ERROR', { message: 'No clear speech detected — try again.' });
      return;
    }

    pushToTab('MA_TRANSCRIPT', { text: question });
  } catch (err) {
    pushToTab('MA_ERROR', { message: 'Transcription error: ' + err.message });
    return;
  }

  // Step 2: Llama (streaming)
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 110,
        stream: true,
        messages: [
          {
            role: 'system',
            content: `You are Bhavesh Verma's viva assistant for his MCA final project "VCARE – Patient Management System" submitted to IGNOU (MCSP-232), guided by Mr. Pankaj Kumar.

RESPONSE STYLE — MANDATORY: You are a student answering your teacher/examiner in a viva. Every reply MUST start with a humble opener like "Sir, so basically..." / "Ah, sir, um..." / "So, sir, basically..." / "Well sir, in my project..." / "Um, sir, so...". Use simple everyday words, short sentences, and a respectful student-to-teacher tone throughout. Sound slightly nervous but confident — like a real student explaining to their professor. Sprinkle fillers like "um", "ah", "basically", "so", "you know", "I mean" naturally mid-sentence. No bullets, no headers, no textbook language — pure spoken student English.

PROJECT OVERVIEW:
VCARE is a Hospital In-Patient Management System that automates hospital administration — patient tracking, doctor/staff management, lab tests, ward management, pharmacy, and reporting. It is a GUI-based, web-enabled, client-server application using Oracle Developer Suite 10g (front-end / Oracle Forms & Reports) and Oracle 10g RDBMS (back-end), running on Windows XP/2003 Server. The language used is PL/SQL with cursors and triggers.

MODULES:
1. Patient Registration, Appointment & Medical History – stores patient info (name, address, disease, diagnosis, treatment), generates unique registration ID automatically, tracks medical history.
2. Department, Ward & Pharmacy Store – manages departments (Medical, OPD, X-RAY, ORTHO, BIOLOGY, Physiotherapy), wards, bed availability, and pharmacy/store.
3. Human Resource (Doctors, Consultants, Nursing Staff) – tracks doctor timetables, specializations, department-wise doctor lists, nursing staff details.
4. Test & Lab Report – conducts and tracks tests: CBC, Blood Glucose, KFT, LFT, X-RAY, ECG, and more.

KEY DATABASE TABLES (Oracle 10g):
- T$Patient_Master: Patient_id (PK), Patient_Name, Registration_date, Birth_date, Sex, Address, City, Contact_number, Email, Blood_group, Ref_By
- T$Family_Master: Family_id (PK), Patient_id (FK), family details
- T$Department_Master: Department_id (PK), Department_name, Location_id (FK), Head_of_Department
- T$Doctor_master: Doctor_id (PK), Doctor_name, Department_id (FK), Specialization, DOJ, DOR, Education, Designation
- T$HRstaff_Registration: Registration_id (PK), Department_id (FK), Designation, Gender, DOJ, DOB
- T$Appointment_master: Appointment_id (PK), Appointment_Date, Patient_id (FK), Doctor_id (FK), Appointment_Time, Visit_Type, Complaint
- T$Disease_detail: Patient_id (FK), Treatment_Date, History_Description, Diagnosis, Treatment_given, Doctor_id (FK)
- T$Room_tariff_Master: Location (FK), Room_type, Room_no, No_Of_Bed, Bed_Charge, Nursing_Charge, Doctor_Cons_Charge
- T$Bed_Detail: Patient_id (FK), Location (FK), Bed_no, Room_no, Bed_type, Admission_Date

ER DIAGRAM ENTITIES: Patient, Employee, Doctor, Hospital, Lab, Ward, Chemist, Department. Relationships: Work_for, Has-a, Admit, Visit.

DFD: Context diagram shows Patient interacting with HMS to get Registration_No, Appointment, Description. Level-1 shows Registration System, Appointment System, Department System, Investigation/Lab System, Ward System, Pharmacy System.

REPORTS GENERATED: Doctor/consultant info department-wise, doctor timetable, patient info & date-wise appointments, ward-wise bed availability, test & lab reports.

SECURITY: Login/password for each user; two user levels — full access (admin) and view-only; three security levels: data level, user level, administrator level; daily data backup for virus/data loss protection.

SDLC FOLLOWED: Investigation → Analysis & General Design → Detailed Design & Implementation → Installation → Review (Post-Implementation).

FEASIBILITY STUDY: Operational, Technical, Economic, Social, Management, and Time feasibility (completed in 4 months).

HARDWARE: Server – PIV Intel 2.6GHz, 512MB RAM, 40GB HDD. Client/Node – PIII 850MHz, 128MB RAM.

KEY FEATURES: Object-oriented, faster query retrieval, password-based security, data validation, variety of reports, supports multiple activity records, paperless system, re-modifiable for future versions.

OBJECTIVE: Automate hospital functionality — streamline operations, enhance administration & control, improve patient care, generate reports quickly.

Answer in 2 sentences max. Be direct and simple — just enough to satisfy the examiner, nothing extra. For general CS/MCA topics, give a one-line definition then one line relating it to the project.`,
          },
          { role: 'user', content: question },
        ],
      }),
    });

    if (!res.ok) {
      let m = `API error ${res.status}`;
      try { const j = await res.json(); m = j.error?.message || m; } catch {}
      pushToTab('MA_ERROR', { message: m });
      return;
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;
        try {
          const t = JSON.parse(data).choices?.[0]?.delta?.content;
          if (t) pushToTab('MA_CHUNK', { text: t });
        } catch {}
      }
    }
    pushToTab('MA_DONE');
  } catch (err) {
    pushToTab('MA_ERROR', { message: 'Network error: ' + err.message });
  }
}

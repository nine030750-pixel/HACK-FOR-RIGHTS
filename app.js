const App = (() => {
  // ─── State ────────────────────────────────────────────────────────────────
  const state = {
    currentScreen: "screen-home",
    micActive: false,
    recognition: null,
    quizAnswers: {},
    fontScale: 1,
    isSpeaking: false
  };

  const FONT_MIN = 0.9;
  const FONT_MAX = 1.4;
  const FONT_STEP = 0.1;

  // ─── LocalStorage helpers ─────────────────────────────────────────────────
  function saveToStorage(key, value) {
    try { localStorage.setItem("sithi_" + key, JSON.stringify(value)); } catch (_) {}
  }
  function loadFromStorage(key, fallback) {
    try {
      const v = localStorage.getItem("sithi_" + key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch (_) { return fallback; }
  }

  // ─── Status bar clock ─────────────────────────────────────────────────────
  function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    const timeStr = `${h}:${m}`;
    document.querySelectorAll(".status-bar span:first-child").forEach(el => {
      el.textContent = timeStr;
    });
  }

  // ─── Navigation ───────────────────────────────────────────────────────────
  function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add("active");
      state.currentScreen = screenId;
      syncNav(screenId);
      const content = target.querySelector(".content");
      if (content) content.scrollTop = 0;
    }
  }

  function syncNav(screenId) {
    const navMap = {
      "screen-home": 0,
      "screen-rights": 1,
      "screen-voice": 2,
      "screen-volunteer": 3,
      "screen-docs": -1,
      "screen-steps": -1,
      "screen-appointments": -1
    };
    const activeIndex = navMap[screenId] ?? -1;
    document.querySelectorAll(".screen").forEach(screen => {
      screen.querySelectorAll(".nav-item").forEach((item, i) => {
        item.classList.toggle("active", i === activeIndex);
      });
    });
  }

  // ─── Tab Pills ────────────────────────────────────────────────────────────
  function bindTabPills() {
    const pills = document.querySelectorAll(".tab-pill");
    const targets = ["screen-home", "screen-docs", "screen-appointments"];
    pills.forEach((pill, i) => {
      pill.addEventListener("click", () => {
        pills.forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        if (targets[i]) showScreen(targets[i]);
      });
    });
  }

  // ─── Quiz / Rights ────────────────────────────────────────────────────────
  function selectOption(groupName, selectedId) {
    document.querySelectorAll(`[id^="${groupName}-"]`).forEach(btn => {
      const isSel = btn.id === selectedId;
      btn.classList.toggle("selected", isSel);
      const check = btn.querySelector(".quiz-option__check");
      if (check) check.textContent = isSel ? "✅" : "⬜";
    });
    state.quizAnswers[groupName] = selectedId;
    saveToStorage("quizAnswers", state.quizAnswers);
    updateRightsSummary();
  }

  function restoreQuiz() {
    const saved = loadFromStorage("quizAnswers", {});
    Object.entries(saved).forEach(([group, id]) => {
      state.quizAnswers[group] = id;
      document.querySelectorAll(`[id^="${group}-"]`).forEach(btn => {
        const isSel = btn.id === id;
        btn.classList.toggle("selected", isSel);
        const check = btn.querySelector(".quiz-option__check");
        if (check) check.textContent = isSel ? "✅" : "⬜";
      });
    });
    updateRightsSummary();
  }

  function updateRightsSummary() {
    const resultBox = document.getElementById("rightsResult");
    if (!resultBox) return;
    const { age, income, status } = state.quizAnswers;
    if (!age || !income || !status) {
      resultBox.textContent = "กรุณาเลือกข้อมูลให้ครบเพื่อประเมินสิทธิของคุณ";
      return;
    }
    const ageText    = { "age-a": "อายุ 60–69 ปี", "age-b": "อายุ 70–79 ปี", "age-c": "อายุ 80 ปีขึ้นไป" }[age] || "";
    const incomeText = { "income-a": "ไม่มีรายได้ประจำ", "income-b": "มีรายได้บ้างเล็กน้อย", "income-c": "มีรายได้ประจำ" }[income] || "";
    const statusText = { "status-a": "อยู่คนเดียว", "status-b": "อยู่กับครอบครัว", "status-c": "มีผู้ดูแลประจำ" }[status] || "";

    let message = `จากข้อมูลเบื้องต้น (${ageText}, ${incomeText}, ${statusText}) คุณอาจมีสิทธิได้รับเบี้ยยังชีพผู้สูงอายุ สิทธิรักษาพยาบาล และบริการช่วยเหลือในพื้นที่`;
    if (status === "status-a") message += " รวมถึงการช่วยเหลือจากอาสาสมัครหรือหน่วยงานชุมชน";
    resultBox.textContent = message;
  }

  // ─── Checklist persistence ────────────────────────────────────────────────
  function bindChecklist() {
    const saved = loadFromStorage("checklist", {});
    document.querySelectorAll(".checklist-item input[type=checkbox]").forEach((cb, i) => {
      const key = "cb_" + i;
      if (saved[key] !== undefined) cb.checked = saved[key];
      cb.addEventListener("change", () => {
        const current = loadFromStorage("checklist", {});
        current[key] = cb.checked;
        saveToStorage("checklist", current);
      });
    });
  }

  // ─── Voice / Speech Recognition ──────────────────────────────────────────
  function toggleMic() {
    if (state.micActive) return;

    const micBtn      = document.getElementById("micBtn");
    const micStatus   = document.getElementById("micStatus");
    const transcriptBox = document.getElementById("transcriptBox");
    const answerBox   = document.getElementById("voiceAnswer");
    if (!micBtn || !micStatus || !transcriptBox || !answerBox) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    // ── Fallback: ถ้าเบราว์เซอร์ไม่รองรับ Speech Recognition ──
    if (!SR) {
      micStatus.textContent = "เบราว์เซอร์นี้ไม่รองรับการฟังเสียง กรุณาใช้ Chrome";
      return;
    }

    state.micActive = true;
    micBtn.classList.add("recording");
    micStatus.textContent = "กำลังฟัง... กรุณาพูดช้า ๆ ชัด ๆ";
    transcriptBox.innerHTML = `<span class="transcript-box__placeholder">กำลังฟังอยู่...</span>`;

    const recognition = new SR();
    state.recognition = recognition;
    recognition.lang = "th-TH";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      transcriptBox.innerHTML = `<span>${final || interim}</span>`;
    };

    recognition.onend = () => {
      micBtn.classList.remove("recording");
      state.micActive = false;
      const transcript = transcriptBox.innerText.trim();
      if (transcript && transcript !== "กำลังฟังอยู่...") {
        micStatus.textContent = "กำลังประมวลผลคำถาม...";
        showVoiceAnswer(transcript, answerBox, micStatus);
      } else {
        micStatus.textContent = "ไม่ได้ยินเสียง กรุณาลองใหม่";
      }
      state.recognition = null;
    };

    recognition.onerror = (event) => {
      micBtn.classList.remove("recording");
      state.micActive = false;
      state.recognition = null;
      const errorMessages = {
        "not-allowed": "ไม่ได้รับอนุญาตให้ใช้ไมค์ กรุณาอนุญาตในเบราว์เซอร์",
        "no-speech": "ไม่ได้ยินเสียง กรุณาลองพูดใหม่",
        "network": "เกิดข้อผิดพลาดเครือข่าย กรุณาตรวจสอบอินเทอร์เน็ต",
        "audio-capture": "ไม่พบไมโครโฟน กรุณาเสียบไมค์"
      };
      micStatus.textContent = errorMessages[event.error] || `เกิดข้อผิดพลาด (${event.error})`;
    };

    recognition.start();
  }

  function showVoiceAnswer(transcript, answerBox, micStatus) {
    // สร้างคำตอบจาก keyword matching (offline-friendly)
    let answer = "กรุณาติดต่อเจ้าหน้าที่เพื่อสอบถามข้อมูลเพิ่มเติม";

    const t = transcript.toLowerCase();
    if (t.includes("เบี้ย") || t.includes("เงิน") || t.includes("สิทธิ")) {
      answer = "คุณอาจมีสิทธิได้รับเบี้ยยังชีพผู้สูงอายุรายเดือน ตามเกณฑ์อายุและรายได้ กรุณาเตรียมบัตรประชาชนและทะเบียนบ้านไปที่ อบต. หรือเขตพื้นที่ของคุณ";
    } else if (t.includes("หมอ") || t.includes("โรงพยาบาล") || t.includes("รักษา")) {
      answer = "ผู้สูงอายุมีสิทธิรักษาพยาบาลฟรีตามบัตรทอง (30 บาท) หรือสิทธิข้าราชการ ขึ้นอยู่กับสถานะของคุณ";
    } else if (t.includes("เอกสาร") || t.includes("บัตร")) {
      answer = "เอกสารที่ต้องใช้ได้แก่ บัตรประชาชนตัวจริง ทะเบียนบ้าน และสมุดบัญชีธนาคาร กดปุ่ม 'ดูเอกสาร' เพื่อดูรายการครบ";
    } else if (t.includes("นัด") || t.includes("อาสา")) {
      answer = "คุณสามารถนัดอาสาสมัครมาช่วยที่บ้านได้ กดปุ่ม 'ขอคนช่วย' ด้านล่าง";
    }

    setTimeout(() => {
      answerBox.innerHTML = `
        <div class="voice-answer-card">
          <h3>คำตอบสำหรับคุณ</h3>
          <p>${answer}</p>
          <button class="speak-btn" onclick="App.speakTextFromElement('voiceAnswer')">🔊 อ่านให้ฟัง</button>
        </div>
      `;
      micStatus.textContent = "แตะเพื่อพูดอีกครั้ง";
    }, 600);
  }

  // ─── Appointments ─────────────────────────────────────────────────────────
  function confirmAppointment() {
    const msg = document.getElementById("confirmMsg");
    if (!msg) return;
    msg.classList.add("visible");
    msg.textContent = "✅ นัดหมายสำเร็จแล้ว เจ้าหน้าที่จะติดต่อกลับโดยเร็ว";
    saveToStorage("lastAppointment", new Date().toISOString());
    msg.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // ─── Font scale ───────────────────────────────────────────────────────────
  function applyFontScale() {
    document.documentElement.style.fontSize = `${state.fontScale * 16}px`;
    const scaleLabel = document.getElementById("fontScaleLabel");
    if (scaleLabel) scaleLabel.textContent = `${Math.round(state.fontScale * 100)}%`;
    saveToStorage("fontScale", state.fontScale);
  }
  function increaseFontSize() {
    if (state.fontScale < FONT_MAX) { state.fontScale = +(state.fontScale + FONT_STEP).toFixed(1); applyFontScale(); }
  }
  function decreaseFontSize() {
    if (state.fontScale > FONT_MIN) { state.fontScale = +(state.fontScale - FONT_STEP).toFixed(1); applyFontScale(); }
  }
  function resetFontSize() { state.fontScale = 1; applyFontScale(); }

  // ─── TTS ──────────────────────────────────────────────────────────────────
  function speakText(text) {
    if (!("speechSynthesis" in window)) { alert("อุปกรณ์นี้ยังไม่รองรับการอ่านข้อความ"); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "th-TH";
    utterance.rate = 0.9;
    utterance.pitch = 1;
    state.isSpeaking = true;
    utterance.onend   = () => { state.isSpeaking = false; };
    utterance.onerror = (e) => { state.isSpeaking = false; console.warn("TTS error:", e.error); };
    window.speechSynthesis.speak(utterance);
  }
  function speakTextFromElement(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const text = el.innerText.trim();
    if (text) speakText(text);
  }
  function stopSpeaking() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    state.isSpeaking = false;
  }

  // ─── Emergency ────────────────────────────────────────────────────────────
  function emergencyHelp() {
    const ok = confirm("คุณต้องการขอความช่วยเหลือด่วนใช่หรือไม่?\n\nกด 'ตกลง' เพื่อโทร 1669 หรือ 'ยกเลิก' เพื่อเรียกอาสา");
    if (ok) {
      window.location.href = "tel:1669";
    } else {
      showScreen("screen-volunteer");
      setTimeout(confirmAppointment, 300);
    }
  }

  // ─── Hover/Active feedback ────────────────────────────────────────────────
  function bindButtonFeedback() {
    const selector = ".btn-voice-main, .btn-primary, .btn-emergency, .btn-appoint, .main-card, .service-wide-card";
    document.querySelectorAll(selector).forEach(btn => {
      btn.addEventListener("pointerdown", () => { btn.style.transform = "scale(0.97)"; btn.style.opacity = "0.9"; });
      btn.addEventListener("pointerup",   () => { btn.style.transform = ""; btn.style.opacity = ""; });
      btn.addEventListener("pointerleave",() => { btn.style.transform = ""; btn.style.opacity = ""; });
    });
  }

  // ─── Global buttons ───────────────────────────────────────────────────────
  function bindGlobalButtons() {
    const ids = {
      increaseFontBtn: increaseFontSize,
      decreaseFontBtn: decreaseFontSize,
      resetFontBtn:    resetFontSize,
      emergencyBtn:    emergencyHelp,
      stopSpeakBtn:    stopSpeaking
    };
    Object.entries(ids).forEach(([id, fn]) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("click", fn);
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────
  function initDefaults() {
    // Restore saved font scale
    state.fontScale = loadFromStorage("fontScale", 1);
    applyFontScale();

    // Restore quiz
    restoreQuiz();

    // Restore checklist
    bindChecklist();

    syncNav(state.currentScreen);
  }

  function init() {
    bindGlobalButtons();
    bindTabPills();
    bindButtonFeedback();
    showScreen("screen-home");
    initDefaults();

    // Clock — update every 30 seconds
    updateClock();
    setInterval(updateClock, 30000);

    console.log("สิทธิถึงบ้าน initialized ✓");
  }

  return {
    showScreen,
    selectOption,
    toggleMic,
    confirmAppointment,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    speakText,
    speakTextFromElement,
    stopSpeaking,
    emergencyHelp,
    init,
    getState: () => ({ ...state })
  };
})();

document.addEventListener("DOMContentLoaded", App.init);

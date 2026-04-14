const App = (() => {

  // ─── State ────────────────────────────────────────────────────────────────
  const state = {
    currentScreen: "screen-home",
    micActive: false,
    recognition: null,
    quizAnswers: {},
    fontScale: 1,
    isSpeaking: false,
    appointmentCount: 2
  };

  const FONT_MIN  = 0.9;
  const FONT_MAX  = 1.4;
  const FONT_STEP = 0.1;

  // ─── localStorage helpers ─────────────────────────────────────────────────
  function save(key, value) {
    try { localStorage.setItem("sithi_" + key, JSON.stringify(value)); } catch (_) {}
  }
  function load(key, fallback) {
    try {
      const v = localStorage.getItem("sithi_" + key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch (_) { return fallback; }
  }

  // ─── Toast notification ───────────────────────────────────────────────────
  function showToast(msg, duration = 2500) {
    const old = document.querySelector(".toast");
    if (old) old.remove();
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => {
      el.classList.add("out");
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  // ─── Clock ────────────────────────────────────────────────────────────────
  function updateClock() {
    const now = new Date();
    const t = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    document.querySelectorAll(".status-bar span:first-child").forEach(el => { el.textContent = t; });
  }

  // ─── Navigation ───────────────────────────────────────────────────────────
  function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach(s => {
      s.classList.remove("active","slide-in");
    });
    const target = document.getElementById(screenId);
    if (!target) return;
    target.classList.add("active","slide-in");
    state.currentScreen = screenId;
    syncNav(screenId);
    const content = target.querySelector(".content");
    if (content) content.scrollTop = 0;

    // Refresh checklist progress when entering docs screen
    if (screenId === "screen-docs") updateChecklistProgress();
  }

  function syncNav(screenId) {
    const navMap = {
      "screen-home":0,"screen-rights":1,"screen-voice":2,
      "screen-volunteer":3,"screen-docs":-1,"screen-steps":-1,"screen-appointments":-1
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
    const pills   = document.querySelectorAll(".tab-pill");
    const targets = ["screen-home","screen-docs","screen-appointments"];
    pills.forEach((pill, i) => {
      pill.addEventListener("click", () => {
        pills.forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        if (targets[i]) showScreen(targets[i]);
      });
    });
  }

  // ─── Quiz ─────────────────────────────────────────────────────────────────
  function selectOption(groupName, selectedId) {
    document.querySelectorAll(`[id^="${groupName}-"]`).forEach(btn => {
      const isSel = btn.id === selectedId;
      btn.classList.toggle("selected", isSel);
      const check = btn.querySelector(".quiz-option__check");
      if (check) check.textContent = isSel ? "✅" : "⬜";
    });
    state.quizAnswers[groupName] = selectedId;
    save("quizAnswers", state.quizAnswers);
    updateRightsSummary();
    updateQuizProgress();
  }

  function updateQuizProgress() {
    const total    = 3;
    const answered = Object.keys(state.quizAnswers).length;
    const pct      = Math.round((answered / total) * 100);
    const label = document.getElementById("quizProgressLabel");
    const fill  = document.getElementById("quizProgressFill");
    if (label) label.textContent = `ตอบแล้ว ${answered} / ${total} ข้อ`;
    if (fill)  fill.style.width  = pct + "%";
  }

  function restoreQuiz() {
    const saved = load("quizAnswers", {});
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
    updateQuizProgress();
  }

  function updateRightsSummary() {
    const resultBox = document.getElementById("rightsResult");
    if (!resultBox) return;
    const { age, income, status } = state.quizAnswers;
    if (!age || !income || !status) {
      resultBox.textContent = "กรุณาเลือกข้อมูลให้ครบเพื่อประเมินสิทธิของคุณ";
      return;
    }
    const ageText    = {"age-a":"อายุ 60–69 ปี","age-b":"อายุ 70–79 ปี","age-c":"อายุ 80 ปีขึ้นไป"}[age]    || "";
    const incomeText = {"income-a":"ไม่มีรายได้ประจำ","income-b":"มีรายได้บ้างเล็กน้อย","income-c":"มีรายได้ประจำ"}[income] || "";
    const statusText = {"status-a":"อยู่คนเดียว","status-b":"อยู่กับครอบครัว","status-c":"มีผู้ดูแลประจำ"}[status]  || "";

    let msg = `จากข้อมูลเบื้องต้น (${ageText}, ${incomeText}, ${statusText}) คุณอาจมีสิทธิได้รับเบี้ยยังชีพผู้สูงอายุ สิทธิรักษาพยาบาล และบริการช่วยเหลือในพื้นที่`;
    if (status === "status-a") msg += " รวมถึงการช่วยเหลือจากอาสาสมัครหรือหน่วยงานชุมชน";
    resultBox.textContent = msg;

    // Update stats
    const statEl = document.getElementById("statRights");
    if (statEl) statEl.textContent = "3";
  }

  // ─── Checklist ────────────────────────────────────────────────────────────
  function bindChecklist() {
    const savedCB = load("checklist", {});
    document.querySelectorAll(".checklist-item input[type=checkbox]").forEach((cb, i) => {
      const key = "cb_" + i;
      if (savedCB[key] !== undefined) cb.checked = savedCB[key];
      cb.addEventListener("change", () => {
        const curr = load("checklist", {});
        curr[key] = cb.checked;
        save("checklist", curr);
        updateChecklistProgress();
      });
    });
    updateChecklistProgress();
  }

  function updateChecklistProgress() {
    const boxes   = document.querySelectorAll(".checklist-item input[type=checkbox]");
    const total   = boxes.length;
    const checked = [...boxes].filter(cb => cb.checked).length;
    const pct     = total > 0 ? Math.round((checked / total) * 100) : 0;
    const label   = document.getElementById("checklistProgressLabel");
    const fill    = document.getElementById("checklistProgressFill");
    if (label) label.textContent = `เตรียมแล้ว ${checked} / ${total} รายการ`;
    if (fill)  fill.style.width  = pct + "%";
    // Update home stats
    const statDocs = document.getElementById("statDocs");
    if (statDocs) statDocs.textContent = `${checked}/${total}`;
  }

  // ─── Voice / Speech Recognition ──────────────────────────────────────────
  function toggleMic() {
    if (state.micActive) {
      // Stop if already recording
      if (state.recognition) state.recognition.stop();
      return;
    }

    const micBtn      = document.getElementById("micBtn");
    const micStatus   = document.getElementById("micStatus");
    const transcriptEl = document.getElementById("transcriptBox");
    const answerEl    = document.getElementById("voiceAnswer");
    const waveEl      = document.getElementById("voiceWave");
    if (!micBtn || !micStatus || !transcriptEl || !answerEl) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      micStatus.textContent = "เบราว์เซอร์นี้ไม่รองรับการฟังเสียง กรุณาใช้ Chrome";
      showToast("⚠️ กรุณาใช้ Chrome เพื่อใช้งานเสียง");
      return;
    }

    state.micActive = true;
    micBtn.classList.add("recording");
    if (waveEl) waveEl.classList.add("active");
    micStatus.textContent = "กำลังฟัง... กรุณาพูดช้า ๆ ชัด ๆ";
    transcriptEl.innerHTML = `<span class="transcript-box__placeholder">กำลังฟังอยู่...</span>`;

    const recognition     = new SR();
    state.recognition     = recognition;
    recognition.lang      = "th-TH";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      let interim = "";
      let final   = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      transcriptEl.innerHTML = `<span>${final || interim}</span>`;
    };

    recognition.onend = () => {
      micBtn.classList.remove("recording");
      if (waveEl) waveEl.classList.remove("active");
      state.micActive   = false;
      state.recognition = null;
      const transcript = transcriptEl.innerText.trim();
      if (transcript && transcript !== "กำลังฟังอยู่...") {
        micStatus.textContent = "กำลังประมวลผล...";
        answerEl.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;
        setTimeout(() => showVoiceAnswer(transcript, answerEl, micStatus), 900);
      } else {
        micStatus.textContent = "ไม่ได้ยินเสียง กรุณาลองใหม่";
      }
    };

    recognition.onerror = (event) => {
      micBtn.classList.remove("recording");
      if (waveEl) waveEl.classList.remove("active");
      state.micActive   = false;
      state.recognition = null;
      const msgs = {
        "not-allowed": "ไม่ได้รับอนุญาตให้ใช้ไมค์ กรุณาอนุญาตในเบราว์เซอร์",
        "no-speech":   "ไม่ได้ยินเสียง กรุณาลองพูดใหม่",
        "network":     "เกิดข้อผิดพลาดเครือข่าย",
        "audio-capture": "ไม่พบไมโครโฟน"
      };
      micStatus.textContent = msgs[event.error] || `เกิดข้อผิดพลาด (${event.error})`;
      showToast("❌ " + (msgs[event.error] || "เกิดข้อผิดพลาด"));
    };

    try { recognition.start(); }
    catch(e) {
      state.micActive = false;
      micStatus.textContent = "ไม่สามารถเริ่มได้ กรุณาลองใหม่";
    }
  }

  function showVoiceAnswer(transcript, answerEl, micStatus) {
    const t = transcript.toLowerCase();
    let answer = "กรุณาติดต่อเจ้าหน้าที่เพื่อสอบถามข้อมูลเพิ่มเติม";

    if (t.includes("เบี้ย") || t.includes("เงิน") || t.includes("สิทธิ"))
      answer = "คุณอาจมีสิทธิได้รับเบี้ยยังชีพผู้สูงอายุรายเดือน ตามเกณฑ์อายุและรายได้ กรุณาเตรียมบัตรประชาชนและทะเบียนบ้านไปที่ อบต. หรือเขตพื้นที่ของคุณ";
    else if (t.includes("หมอ") || t.includes("โรงพยาบาล") || t.includes("รักษา"))
      answer = "ผู้สูงอายุมีสิทธิรักษาพยาบาลฟรีตามบัตรทอง (30 บาท) หรือสิทธิข้าราชการ ขึ้นอยู่กับสถานะของคุณ";
    else if (t.includes("เอกสาร") || t.includes("บัตร"))
      answer = "เอกสารที่ต้องใช้ได้แก่ บัตรประชาชนตัวจริง ทะเบียนบ้าน และสมุดบัญชีธนาคาร กดปุ่ม 'ดูเอกสาร' เพื่อดูรายการครบ";
    else if (t.includes("นัด") || t.includes("อาสา"))
      answer = "คุณสามารถนัดอาสาสมัครมาช่วยที่บ้านได้ กดปุ่ม 'ขอคนช่วย' ด้านล่าง";

    // Save to localStorage
    const history = load("voiceHistory", []);
    history.unshift({ q: transcript, a: answer, ts: Date.now() });
    if (history.length > 20) history.pop();
    save("voiceHistory", history);

    answerEl.innerHTML = `
      <div class="voice-answer-card">
        <h3>คำตอบสำหรับคุณ</h3>
        <p>${answer}</p>
        <button class="speak-btn" onclick="App.speakTextFromElement('voiceAnswer')">🔊 อ่านให้ฟัง</button>
      </div>
    `;
    micStatus.textContent = "แตะเพื่อพูดอีกครั้ง";
    showToast("✅ ได้รับคำตอบแล้ว");
  }

  // ─── Volunteer ────────────────────────────────────────────────────────────
  function confirmAppointment(name) {
    const msg = document.getElementById("confirmMsg");
    if (!msg) return;
    const volName = name || "เจ้าหน้าที่";
    msg.textContent = `✅ นัดหมายกับ${volName}สำเร็จแล้ว จะติดต่อกลับโดยเร็ว`;
    msg.classList.add("visible");

    // Persist
    const appoints = load("appointments", []);
    appoints.push({ name: volName, ts: Date.now() });
    save("appointments", appoints);

    // Update stats counter
    state.appointmentCount++;
    const statEl = document.getElementById("statAppoint");
    if (statEl) statEl.textContent = state.appointmentCount;

    showToast(`✅ นัดหมายกับ${volName}แล้ว`);
    msg.scrollIntoView({ behavior:"smooth", block:"nearest" });
  }

  // ─── Font scale ───────────────────────────────────────────────────────────
  function applyFontScale() {
    document.documentElement.style.fontSize = `${state.fontScale * 16}px`;
    const label = document.getElementById("fontScaleLabel");
    if (label) label.textContent = `${Math.round(state.fontScale * 100)}%`;
    save("fontScale", state.fontScale);
  }
  function increaseFontSize() {
    if (state.fontScale < FONT_MAX) { state.fontScale = +(state.fontScale + FONT_STEP).toFixed(1); applyFontScale(); showToast("ขนาดตัวอักษรใหญ่ขึ้น"); }
  }
  function decreaseFontSize() {
    if (state.fontScale > FONT_MIN) { state.fontScale = +(state.fontScale - FONT_STEP).toFixed(1); applyFontScale(); showToast("ขนาดตัวอักษรเล็กลง"); }
  }
  function resetFontSize() { state.fontScale = 1; applyFontScale(); showToast("รีเซ็ตขนาดตัวอักษรแล้ว"); }

  // ─── TTS ──────────────────────────────────────────────────────────────────
  function speakText(text) {
    if (!("speechSynthesis" in window)) { showToast("อุปกรณ์นี้ไม่รองรับการอ่านข้อความ"); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang  = "th-TH";
    u.rate  = 0.9;
    u.pitch = 1;
    state.isSpeaking = true;
    u.onend   = () => { state.isSpeaking = false; };
    u.onerror = () => { state.isSpeaking = false; };
    window.speechSynthesis.speak(u);
    showToast("🔊 กำลังอ่านออกเสียง...");
  }
  function speakTextFromElement(id) {
    const el = document.getElementById(id);
    if (el) speakText(el.innerText.trim());
  }
  function stopSpeaking() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    state.isSpeaking = false;
    showToast("⏹ หยุดเสียงแล้ว");
  }

  // ─── Emergency ────────────────────────────────────────────────────────────
  function emergencyHelp() {
    const ok = confirm("คุณต้องการขอความช่วยเหลือด่วนใช่หรือไม่?\n\nกด 'ตกลง' เพื่อโทร 1669 หรือ 'ยกเลิก' เพื่อเรียกอาสา");
    if (ok) { window.location.href = "tel:1669"; }
    else { showScreen("screen-volunteer"); setTimeout(() => confirmAppointment(), 300); }
  }

  // ─── Global buttons ───────────────────────────────────────────────────────
  function bindGlobalButtons() {
    const map = {
      increaseFontBtn: increaseFontSize,
      decreaseFontBtn: decreaseFontSize,
      resetFontBtn:    resetFontSize,
      emergencyBtn:    emergencyHelp,
      stopSpeakBtn:    stopSpeaking
    };
    Object.entries(map).forEach(([id, fn]) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("click", fn);
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────
  function init() {
    // Restore persisted state
    state.fontScale = load("fontScale", 1);
    applyFontScale();

    bindGlobalButtons();
    bindTabPills();
    bindChecklist();

    restoreQuiz();
    syncNav(state.currentScreen);
    showScreen("screen-home");

    // Restore appointment count
    const savedAppoints = load("appointments", []);
    state.appointmentCount = 2 + savedAppoints.length;
    const statEl = document.getElementById("statAppoint");
    if (statEl) statEl.textContent = state.appointmentCount;

    // Clock
    updateClock();
    setInterval(updateClock, 30000);

    console.log("สิทธิถึงบ้าน v2 initialized ✓");
  }

  // ─── Public API ───────────────────────────────────────────────────────────
  return {
    showScreen, selectOption, toggleMic,
    confirmAppointment, emergencyHelp,
    increaseFontSize, decreaseFontSize, resetFontSize,
    speakText, speakTextFromElement, stopSpeaking,
    init, getState: () => ({ ...state })
  };
})();

document.addEventListener("DOMContentLoaded", App.init);

const App = (() => {
  const state = {
    currentScreen: "screen-home",
    micActive: false,
    recognition: null,
    quizAnswers: {},
    fontScale: 1,
    isSpeaking: false,
    appointmentCount: 2,

    settingsOpen: false,
    autoSpeak: false,
    highContrast: false,
    reduceMotion: false,
    bigEmergency: false,
    caregiverMode: false
  };

  const FONT_MIN = 0.9;
  const FONT_MAX = 1.4;
  const FONT_STEP = 0.1;

  function save(key, value) {
    try {
      localStorage.setItem("sithi_" + key, JSON.stringify(value));
    } catch (_) {}
  }

  function load(key, fallback) {
    try {
      const v = localStorage.getItem("sithi_" + key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch (_) {
      return fallback;
    }
  }

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

  function updateClock() {
    const now = new Date();
    const t = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    document.querySelectorAll(".status-bar span:first-child").forEach((el) => {
      el.textContent = t;
    });
  }

  function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach((s) => {
      s.classList.remove("active", "slide-in");
    });

    const target = document.getElementById(screenId);
    if (!target) return;

    target.classList.add("active", "slide-in");
    state.currentScreen = screenId;
    syncNav(screenId);

    const content = target.querySelector(".content");
    if (content) content.scrollTop = 0;

    if (screenId === "screen-docs") updateChecklistProgress();
    if (state.settingsOpen) closeSettings();
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

    document.querySelectorAll(".screen").forEach((screen) => {
      screen.querySelectorAll(".nav-item").forEach((item, i) => {
        item.classList.toggle("active", i === activeIndex);
      });
    });
  }

  function bindTabPills() {
    const pills = document.querySelectorAll(".tab-pill");
    const targets = ["screen-home", "screen-docs", "screen-appointments"];

    pills.forEach((pill, i) => {
      pill.addEventListener("click", () => {
        pills.forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        if (targets[i]) showScreen(targets[i]);
      });
    });
  }

  // ==== QUIZ VIEW TOGGLE ====
  function openQuiz() {
    const main = document.getElementById('view-rights-main');
    const quiz = document.getElementById('view-rights-quiz');
    if (main && quiz) {
      main.style.display = 'none';
      quiz.style.display = 'block';
      const content = document.querySelector("#screen-rights .content");
      if (content) content.scrollTop = 0;
    }
  }

  function closeQuiz() {
    const main = document.getElementById('view-rights-main');
    const quiz = document.getElementById('view-rights-quiz');
    if (main && quiz) {
      quiz.style.display = 'none';
      main.style.display = 'block';
      const content = document.querySelector("#screen-rights .content");
      if (content) content.scrollTop = 0;
    }
  }
  // ==========================

  function selectOption(groupName, selectedId) {
    document.querySelectorAll(`[id^="${groupName}-"]`).forEach((btn) => {
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

  function updateQuizProgress(answered) {
    const fill = document.getElementById("quizProgressFill");
    const label = document.getElementById("quizProgressLabel");
    if (!fill || !label) return;

    const total = 3;
    const answeredCount =
      typeof answered === "number" ? answered : Object.keys(state.quizAnswers).length;
    const percent = Math.round((answeredCount / total) * 100);

    fill.style.width = `${percent}%`;
    label.textContent = `ตอบแล้ว ${answeredCount} / ${total} ข้อ`;
  }

  function restoreQuiz() {
    const saved = load("quizAnswers", {});
    Object.entries(saved).forEach(([group, id]) => {
      state.quizAnswers[group] = id;

      document.querySelectorAll(`[id^="${group}-"]`).forEach((btn) => {
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
    const rightsList = document.getElementById("rightsList");
    const rightsTags = document.getElementById("rightsTags");
    const rightsScore = document.getElementById("rightsScore");
    const rightsDocsList = document.getElementById("rightsDocsList");
    const rightsDocsCount = document.getElementById("rightsDocsCount");
    const statRights = document.getElementById("statRights");
    const startQuizBtn = document.getElementById("startQuizBtn");

    if (!resultBox) return;

    const age = state.quizAnswers.age || "";
    const income = state.quizAnswers.income || "";
    const status = state.quizAnswers.status || "";

    const answered = [age, income, status].filter(Boolean).length;
    updateQuizProgress(answered);

    if (answered < 3) {
      if (startQuizBtn) startQuizBtn.innerHTML = "📋 เริ่มประเมินสิทธิ";
      resultBox.textContent = "กดปุ่ม 'เริ่มประเมินสิทธิ' ด้านบน เพื่อวิเคราะห์สิทธิที่คุณอาจได้รับ";

      if (rightsList) {
        rightsList.innerHTML = `<div class="rights-empty">กรุณาทำแบบประเมินให้ครบก่อน</div>`;
      }
      if (rightsTags) {
        rightsTags.innerHTML = `<span class="rights-tag">ยังไม่มีข้อมูลเพียงพอ</span>`;
      }
      if (rightsScore) rightsScore.textContent = "รอประเมิน";
      if (rightsDocsList) {
        rightsDocsList.innerHTML = `<div class="rights-empty">ระบบจะแนะนำเอกสารหลังประเมินสิทธิ</div>`;
      }
      if (rightsDocsCount) rightsDocsCount.textContent = "0 รายการ";
      if (statRights) statRights.textContent = "0";
      return;
    }

    if (startQuizBtn) startQuizBtn.innerHTML = "✏️ แก้ไขข้อมูลประเมิน";

    let ageText = "";
    let incomeText = "";
    let statusText = "";

    if (age === "age-a") ageText = "อายุ 60–69 ปี";
    if (age === "age-b") ageText = "อายุ 70–79 ปี";
    if (age === "age-c") ageText = "อายุ 80 ปีขึ้นไป";

    if (income === "income-a") incomeText = "ไม่มีรายได้ประจำ";
    if (income === "income-b") incomeText = "มีรายได้บ้างเล็กน้อย";
    if (income === "income-c") incomeText = "มีรายได้ประจำ";

    if (status === "status-a") statusText = "อยู่คนเดียว";
    if (status === "status-b") statusText = "อยู่กับครอบครัว";
    if (status === "status-c") statusText = "มีผู้ดูแลประจำ";

    resultBox.textContent =
      `ข้อมูลของคุณ: ${ageText}, ${incomeText}, ${statusText} — ระบบวิเคราะห์สิทธิเบื้องต้นได้ดังนี้`;

    const rights = [];
    const docs = [
      { title: "บัตรประชาชน", desc: "ใช้ยืนยันตัวตนในการติดต่อรับสิทธิ" },
      { title: "ทะเบียนบ้าน", desc: "ใช้ยืนยันข้อมูลที่อยู่และสิทธิในพื้นที่" },
      { title: "สมุดบัญชีธนาคาร", desc: "ใช้กรณีรับเงินผ่านบัญชี" }
    ];
    const tags = [];

    rights.push({
      title: "เบี้ยยังชีพผู้สูงอายุ",
      level: "หลัก",
      desc: "สิทธิพื้นฐานสำหรับผู้สูงอายุ โดยจำนวนเงินอาจเปลี่ยนตามช่วงอายุ",
      hint:
        age === "age-c"
          ? "คุณอยู่ในช่วงอายุสูงสุด จึงควรตรวจสอบอัตราเบี้ยล่าสุดกับหน่วยงานในพื้นที่"
          : "สามารถติดต่อ อบต. หรือเทศบาลในพื้นที่เพื่อยืนยันสิทธิได้"
    });

    rights.push({
      title: "สิทธิรักษาพยาบาลตามระบบหลักประกันสุขภาพ",
      level: "สำคัญ",
      desc: "ใช้เข้ารับบริการรักษาพยาบาลตามหน่วยบริการที่ลงทะเบียนไว้",
      hint: "หากไม่แน่ใจสิทธิรักษา ให้สอบถาม รพ.สต. หรือโรงพยาบาลประจำสิทธิ"
    });

    if (income === "income-a" || income === "income-b") {
      rights.push({
        title: "สิทธิช่วยเหลือเพิ่มเติมด้านรายได้หรือสวัสดิการชุมชน",
        level: "เสริม",
        desc: "อาจมีโครงการช่วยเหลือเพิ่มเติมจากท้องถิ่นหรือชุมชนสำหรับผู้มีรายได้น้อย",
        hint: "ควรถาม อบต. หรืออาสาสมัครในพื้นที่ว่ามีโครงการเปิดรับอยู่หรือไม่"
      });

      docs.push({
        title: "เอกสารแสดงรายได้หรือสถานะครัวเรือน",
        desc: "อาจใช้ประกอบการขอรับความช่วยเหลือเพิ่มเติม"
      });

      tags.push("กลุ่มรายได้เปราะบาง");
    }

    if (status === "status-a") {
      rights.push({
        title: "บริการช่วยเหลือจากอาสาสมัครหรือหน่วยงานชุมชน",
        level: "แนะนำ",
        desc: "กรณีอยู่คนเดียว อาจขอความช่วยเหลือเรื่องการเดินทาง เอกสาร หรือการติดต่อหน่วยงานได้",
        hint: "กดปุ่ม “ขอคนช่วย” เพื่อให้อาสาสมัครช่วยประสานงานได้"
      });

      docs.push({
        title: "เบอร์ติดต่อญาติหรือผู้ดูแล",
        desc: "ควรมีไว้เพื่อให้หน่วยงานติดต่อกลับได้สะดวก"
      });

      tags.push("อยู่คนเดียว");
    }

    if (status === "status-c") {
      docs.push({
        title: "ใบมอบอำนาจ / เอกสารผู้ดูแล",
        desc: "ใช้กรณีให้ผู้ดูแลดำเนินการบางอย่างแทน"
      });

      tags.push("มีผู้ดูแลประจำ");
    }

    if (age === "age-c") tags.push("อายุ 80+");
    else if (age === "age-b") tags.push("อายุ 70+");
    else tags.push("เริ่มรับสิทธิผู้สูงอายุ");

    if (rightsList) {
      rightsList.innerHTML = rights.map((item) => `
        <div class="rights-item">
          <div class="rights-item__top">
            <div class="rights-item__title">${item.title}</div>
            <div class="rights-item__level">${item.level}</div>
          </div>
          <div class="rights-item__desc">${item.desc}</div>
          <div class="rights-item__hint">${item.hint}</div>
        </div>
      `).join("");
    }

    if (rightsTags) {
      rightsTags.innerHTML = tags.map((tag) => `
        <span class="rights-tag">${tag}</span>
      `).join("");
    }

    if (rightsScore) rightsScore.textContent = `${rights.length} สิทธิ`;

    if (rightsDocsList) {
      rightsDocsList.innerHTML = docs.map((doc) => `
        <div class="rights-doc-item">
          <div class="rights-doc-item__icon">📄</div>
          <div>
            <div class="rights-doc-item__title">${doc.title}</div>
            <div class="rights-doc-item__desc">${doc.desc}</div>
          </div>
        </div>
      `).join("");
    }

    if (rightsDocsCount) rightsDocsCount.textContent = `${docs.length} รายการ`;
    if (statRights) statRights.textContent = `${rights.length}`;

    if (state.autoSpeak && answered === 3) {
      clearTimeout(window.__autoSpeakTimer);
      window.__autoSpeakTimer = setTimeout(() => {
        speakTextFromElement("rightsDetailCard");
      }, 300);
    }
  }

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
    const boxes = document.querySelectorAll(".checklist-item input[type=checkbox]");
    const total = boxes.length;
    const checked = [...boxes].filter((cb) => cb.checked).length;
    const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

    const label = document.getElementById("checklistProgressLabel");
    const fill = document.getElementById("checklistProgressFill");

    if (label) label.textContent = `เตรียมแล้ว ${checked} / ${total} รายการ`;
    if (fill) fill.style.width = pct + "%";

    const statDocs = document.getElementById("statDocs");
    if (statDocs) statDocs.textContent = `${checked}/${total}`;
  }

  function toggleMic() {
    if (state.micActive) {
      if (state.recognition) state.recognition.stop();
      return;
    }

    const micBtn = document.getElementById("micBtn");
    const micStatus = document.getElementById("micStatus");
    const transcriptEl = document.getElementById("transcriptBox");
    const answerEl = document.getElementById("voiceAnswer");
    const waveEl = document.getElementById("voiceWave");

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

    const recognition = new SR();
    state.recognition = recognition;
    recognition.lang = "th-TH";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";

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
      state.micActive = false;
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
      state.micActive = false;
      state.recognition = null;

      const msgs = {
        "not-allowed": "ไม่ได้รับอนุญาตให้ใช้ไมค์ กรุณาอนุญาตในเบราว์เซอร์",
        "no-speech": "ไม่ได้ยินเสียง กรุณาลองพูดใหม่",
        "network": "เกิดข้อผิดพลาดเครือข่าย",
        "audio-capture": "ไม่พบไมโครโฟน"
      };

      micStatus.textContent = msgs[event.error] || `เกิดข้อผิดพลาด (${event.error})`;
      showToast("❌ " + (msgs[event.error] || "เกิดข้อผิดพลาด"));
    };

    try {
      recognition.start();
    } catch (_) {
      state.micActive = false;
      micStatus.textContent = "ไม่สามารถเริ่มได้ กรุณาลองใหม่";
    }
  }

  function showVoiceAnswer(transcript, answerEl, micStatus) {
    const t = transcript.toLowerCase();
    let answer = "กรุณาติดต่อเจ้าหน้าที่เพื่อสอบถามข้อมูลเพิ่มเติม";

    if (t.includes("เบี้ย") || t.includes("เงิน") || t.includes("สิทธิ")) {
      answer = "คุณอาจมีสิทธิได้รับเบี้ยยังชีพผู้สูงอายุรายเดือน ตามเกณฑ์อายุและรายได้ กรุณาเตรียมบัตรประชาชนและทะเบียนบ้านไปที่ อบต. หรือเขตพื้นที่ของคุณ";
    } else if (t.includes("หมอ") || t.includes("โรงพยาบาล") || t.includes("รักษา")) {
      answer = "ผู้สูงอายุมีสิทธิรักษาพยาบาลฟรีตามบัตรทอง หรือสิทธิข้าราชการ ขึ้นอยู่กับสถานะของคุณ";
    } else if (t.includes("เอกสาร") || t.includes("บัตร")) {
      answer = "เอกสารที่ต้องใช้ได้แก่ บัตรประชาชนตัวจริง ทะเบียนบ้าน และสมุดบัญชีธนาคาร กดปุ่ม 'ดูเอกสาร' เพื่อดูรายการครบ";
    } else if (t.includes("นัด") || t.includes("อาสา")) {
      answer = "คุณสามารถนัดอาสาสมัครมาช่วยที่บ้านได้ กดปุ่ม 'ขอคนช่วย' ด้านล่าง";
    }

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

  function confirmAppointment(name) {
    const msg = document.getElementById("confirmMsg");
    if (!msg) return;

    const volName = name || "เจ้าหน้าที่";
    msg.textContent = `✅ นัดหมายกับ${volName}สำเร็จแล้ว จะติดต่อกลับโดยเร็ว`;
    msg.classList.add("visible");

    const appoints = load("appointments", []);
    appoints.push({ name: volName, ts: Date.now() });
    save("appointments", appoints);

    state.appointmentCount++;
    const statEl = document.getElementById("statAppoint");
    if (statEl) statEl.textContent = state.appointmentCount;

    showToast(`✅ นัดหมายกับ${volName}แล้ว`);
    msg.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function applyFontScale() {
    document.documentElement.style.fontSize = `${state.fontScale * 16}px`;
    const label = document.getElementById("fontScaleLabel");
    if (label) label.textContent = `${Math.round(state.fontScale * 100)}%`;
    save("fontScale", state.fontScale);
  }

  function increaseFontSize() {
    if (state.fontScale < FONT_MAX) {
      state.fontScale = +(state.fontScale + FONT_STEP).toFixed(1);
      applyFontScale();
      showToast("ขนาดตัวอักษรใหญ่ขึ้น");
    }
  }

  function decreaseFontSize() {
    if (state.fontScale > FONT_MIN) {
      state.fontScale = +(state.fontScale - FONT_STEP).toFixed(1);
      applyFontScale();
      showToast("ขนาดตัวอักษรเล็กลง");
    }
  }

  function resetFontSize() {
    state.fontScale = 1;
    applyFontScale();
    showToast("รีเซ็ตขนาดตัวอักษรแล้ว");
  }

  function speakText(text) {
    if (!("speechSynthesis" in window)) {
      showToast("อุปกรณ์นี้ไม่รองรับการอ่านข้อความ");
      return;
    }

    window.speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(text);
    u.lang = "th-TH";
    u.rate = 0.9;
    u.pitch = 1;

    state.isSpeaking = true;
    u.onend = () => {
      state.isSpeaking = false;
    };
    u.onerror = () => {
      state.isSpeaking = false;
    };

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

  function emergencyHelp() {
    const ok = confirm(
      "คุณต้องการขอความช่วยเหลือด่วนใช่หรือไม่?\n\nกด 'ตกลง' เพื่อโทร 1669 หรือ 'ยกเลิก' เพื่อเรียกอาสา"
    );

    if (ok) {
      window.location.href = "tel:1669";
    } else {
      showScreen("screen-volunteer");
      setTimeout(() => confirmAppointment(), 300);
    }
  }

  function openSettings() {
    const panel = document.getElementById("settingsPanel");
    const overlay = document.getElementById("settingsOverlay");
    if (!panel || !overlay) return;

    panel.classList.add("active");
    overlay.classList.add("active");
    panel.setAttribute("aria-hidden", "false");
    state.settingsOpen = true;
    save("settingsOpen", true);
  }

  function closeSettings() {
    const panel = document.getElementById("settingsPanel");
    const overlay = document.getElementById("settingsOverlay");
    if (!panel || !overlay) return;

    panel.classList.remove("active");
    overlay.classList.remove("active");
    panel.setAttribute("aria-hidden", "true");
    state.settingsOpen = false;
    save("settingsOpen", false);
  }

  function toggleAutoSpeak(enabled) {
    state.autoSpeak = enabled;
    save("autoSpeak", enabled);
    showToast(enabled ? "เปิดอ่านผลอัตโนมัติแล้ว" : "ปิดอ่านผลอัตโนมัติแล้ว");
  }

  function toggleHighContrast(enabled) {
    state.highContrast = enabled;
    document.body.classList.toggle("high-contrast", enabled);
    save("highContrast", enabled);
    showToast(enabled ? "เปิดคอนทราสต์สูงแล้ว" : "ปิดคอนทราสต์สูงแล้ว");
  }

  function toggleReduceMotion(enabled) {
    state.reduceMotion = enabled;
    document.body.classList.toggle("reduce-motion", enabled);
    save("reduceMotion", enabled);
    showToast(enabled ? "ลดการเคลื่อนไหวแล้ว" : "เปิดการเคลื่อนไหวปกติแล้ว");
  }

  function toggleBigEmergency(enabled) {
    state.bigEmergency = enabled;
    const btn = document.getElementById("emergencyBtn");
    if (btn) btn.classList.toggle("big-emergency", enabled);
    save("bigEmergency", enabled);
    showToast(enabled ? "ขยายปุ่ม SOS แล้ว" : "คืนขนาดปุ่ม SOS แล้ว");
  }

  function toggleCaregiverMode(enabled) {
    state.caregiverMode = enabled;
    save("caregiverMode", enabled);

    const greeting = document.querySelector(".greeting");
    const subtext = document.querySelector("#screen-home .subtext");

    if (greeting) {
      greeting.textContent = enabled ? "สวัสดี ผู้ดูแล" : "สวัสดี คุณยายสมจิตร";
    }

    if (subtext) {
      subtext.textContent = enabled
        ? "วันนี้ต้องการช่วยผู้สูงอายุเรื่องอะไรคะ"
        : "วันนี้ต้องการให้เราช่วยเรื่องอะไรคะ";
    }

    showToast(enabled ? "เปิดโหมดผู้ดูแลแล้ว" : "ปิดโหมดผู้ดูแลแล้ว");
  }

  function restoreSettings() {
    state.fontScale = load("fontScale", 1);
    state.autoSpeak = load("autoSpeak", false);
    state.highContrast = load("highContrast", false);
    state.reduceMotion = load("reduceMotion", false);
    state.bigEmergency = load("bigEmergency", false);
    state.caregiverMode = load("caregiverMode", false);

    applyFontScale();
    document.body.classList.toggle("high-contrast", state.highContrast);
    document.body.classList.toggle("reduce-motion", state.reduceMotion);

    const emergencyBtn = document.getElementById("emergencyBtn");
    if (emergencyBtn) {
      emergencyBtn.classList.toggle("big-emergency", state.bigEmergency);
    }

    toggleCaregiverMode(state.caregiverMode);

    const autoSpeakToggle = document.getElementById("autoSpeakToggle");
    const contrastToggle = document.getElementById("contrastToggle");
    const motionToggle = document.getElementById("motionToggle");
    const bigEmergencyToggle = document.getElementById("bigEmergencyToggle");
    const caregiverModeToggle = document.getElementById("caregiverModeToggle");

    if (autoSpeakToggle) autoSpeakToggle.checked = state.autoSpeak;
    if (contrastToggle) contrastToggle.checked = state.highContrast;
    if (motionToggle) motionToggle.checked = state.reduceMotion;
    if (bigEmergencyToggle) bigEmergencyToggle.checked = state.bigEmergency;
    if (caregiverModeToggle) caregiverModeToggle.checked = state.caregiverMode;
  }

  function bindGlobalButtons() {
    const map = {
      increaseFontBtn: increaseFontSize,
      decreaseFontBtn: decreaseFontSize,
      resetFontBtn: resetFontSize,
      emergencyBtn: emergencyHelp,
      stopSpeakBtn: stopSpeaking
    };

    Object.entries(map).forEach(([id, fn]) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("click", fn);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.settingsOpen) {
        closeSettings();
      }
    });
  }

  function init() {
    bindGlobalButtons();
    bindTabPills();
    bindChecklist();

    restoreSettings();
    restoreQuiz();

    const activeScreenEl = document.querySelector('.screen');
    const startScreenId = activeScreenEl ? activeScreenEl.id : 'screen-home';
    showScreen(startScreenId);
    
    syncNav(state.currentScreen);

    const savedAppoints = load("appointments", []);
    state.appointmentCount = 2 + savedAppoints.length;
    const statEl = document.getElementById("statAppoint");
    if (statEl) statEl.textContent = state.appointmentCount;

    updateClock();
    setInterval(updateClock, 30000);

    setInterval(() => {
      const el = document.getElementById("statRights");
      if (el) {
        el.style.transform = "scale(1.1)";
        setTimeout(() => {
          el.style.transform = "scale(1)";
        }, 200);
      }
    }, 5000);

    console.log("สิทธิถึงบ้าน v3 initialized ✓");
  }

  return {
    showScreen,
    openQuiz,       // Expose new functions
    closeQuiz,      // Expose new functions
    selectOption,
    toggleMic,
    confirmAppointment,
    emergencyHelp,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    speakText,
    speakTextFromElement,
    stopSpeaking,
    openSettings,
    closeSettings,
    toggleAutoSpeak,
    toggleHighContrast,
    toggleReduceMotion,
    toggleBigEmergency,
    toggleCaregiverMode,
    init,
    getState: () => ({ ...state })
  };
})();

document.addEventListener("DOMContentLoaded", App.init);

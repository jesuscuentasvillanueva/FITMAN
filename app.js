(() => {
  "use strict";

  const STORAGE_KEY = "fitman_data_v1";
  const DEFAULT_EXERCISES = ["Press banca", "Sentadilla", "Peso muerto", "Press militar", "Dominadas", "Remo con barra"];
  const WEEKDAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"];

  let data = loadData();
  let calDate = new Date();
  calDate.setDate(1);

  // ---------- storage ----------
  function loadData() {
    let parsed = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) parsed = JSON.parse(raw);
    } catch (e) {
      console.error("No se pudo leer localStorage", e);
    }

    let dayLogs = Array.isArray(parsed.dayLogs) ? parsed.dayLogs : null;
    if (!dayLogs && Array.isArray(parsed.gymDays)) {
      dayLogs = parsed.gymDays.map((d) => ({ date: d, type: "trained" }));
    }
    if (!dayLogs) dayLogs = [];

    const seen = new Map();
    dayLogs.forEach((d) => {
      if (d && d.date && (d.type === "trained" || d.type === "rest")) seen.set(d.date, d.type);
    });
    dayLogs = [...seen.entries()].map(([date, type]) => ({ date, type }));

    return {
      dayLogs,
      bodyWeight: Array.isArray(parsed.bodyWeight) ? parsed.bodyWeight : [],
      exerciseLogs: Array.isArray(parsed.exerciseLogs) ? parsed.exerciseLogs : [],
      lastExercise: parsed.lastExercise && parsed.lastExercise.name ? parsed.lastExercise : null,
    };
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ---------- date helpers ----------
  function toISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function todayISO() {
    return toISODate(new Date());
  }
  function isoToDate(iso) {
    return new Date(iso + "T00:00:00");
  }
  function formatShort(iso) {
    return isoToDate(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  }
  function formatLong(iso) {
    return isoToDate(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  }

  // ---------- toast ----------
  let toastTimer;
  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 1800);
  }

  // ---------- navigation ----------
  function switchView(view) {
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("hidden", v.id !== "view-" + view));
  }

  function initNav() {
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchView(btn.dataset.view));
    });
  }

  // ---------- day log core ----------
  function dayType(iso) {
    const entry = data.dayLogs.find((d) => d.date === iso);
    return entry ? entry.type : null;
  }

  function setDay(iso, type) {
    const idx = data.dayLogs.findIndex((d) => d.date === iso);
    if (idx >= 0) {
      if (data.dayLogs[idx].type === type) data.dayLogs.splice(idx, 1);
      else data.dayLogs[idx].type = type;
    } else {
      data.dayLogs.push({ date: iso, type });
    }
    saveData();
    renderAllHome();
  }

  function cycleDay(iso) {
    const current = dayType(iso);
    if (current === null) setDay(iso, "trained");
    else if (current === "trained") setDay(iso, "rest");
    else setDay(iso, null); // falls through to removal below
    if (current === "rest") {
      const idx = data.dayLogs.findIndex((d) => d.date === iso);
      if (idx >= 0) data.dayLogs.splice(idx, 1);
      saveData();
      renderAllHome();
    }
  }

  // ---------- streak stats ----------
  function computeStats() {
    const map = new Map(data.dayLogs.map((d) => [d.date, d.type]));
    const trainedTotal = data.dayLogs.filter((d) => d.type === "trained").length;
    const restTotal = data.dayLogs.filter((d) => d.type === "rest").length;
    if (map.size === 0) return { current: 0, longest: 0, trainedTotal: 0, restTotal: 0 };

    const sorted = [...map.keys()].sort();
    let longest = 1, run = 1;
    for (let i = 1; i < sorted.length; i++) {
      const diff = Math.round((isoToDate(sorted[i]) - isoToDate(sorted[i - 1])) / 86400000);
      run = diff === 1 ? run + 1 : 1;
      if (run > longest) longest = run;
    }

    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    if (!map.has(toISODate(cursor))) cursor.setDate(cursor.getDate() - 1);
    let current = 0;
    while (map.has(toISODate(cursor))) {
      current++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return { current, longest, trainedTotal, restTotal };
  }

  function renderHero() {
    const { current, longest, trainedTotal, restTotal } = computeStats();
    document.getElementById("streak-current").textContent = current;
    document.getElementById("streak-longest").textContent = longest;
    document.getElementById("streak-trained").textContent = trainedTotal;
    document.getElementById("streak-rest").textContent = restTotal;
    document.getElementById("streak-pill").childNodes[1].textContent = String(current);

    const todayType = dayType(todayISO());
    document.getElementById("btn-mark-trained").classList.toggle("active", todayType === "trained");
    document.getElementById("btn-mark-rest").classList.toggle("active", todayType === "rest");

    const status = document.getElementById("today-status");
    if (todayType === "trained") status.textContent = "¡Hoy entrenaste! Racha activa.";
    else if (todayType === "rest") status.textContent = "Hoy es descanso — tu racha sigue viva.";
    else status.textContent = current > 0 ? "Registra hoy (entrenado o descanso) para no perder tu racha." : "Marca tu primer día para comenzar tu racha.";
  }

  function renderWeekStrip() {
    const strip = document.getElementById("week-strip");
    strip.innerHTML = "";
    const todayIso = todayISO();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = toISODate(d);
      const type = dayType(iso);
      const wrap = document.createElement("div");
      wrap.className = "week-day";
      const dotClasses = ["week-dot"];
      if (iso === todayIso) dotClasses.push("today");
      if (type) dotClasses.push(type);
      const iconRef = type === "trained" ? "#icon-flame" : type === "rest" ? "#icon-moon" : null;
      wrap.innerHTML = `
        <div class="${dotClasses.join(" ")}">${iconRef ? `<svg class="icon-sm"><use href="${iconRef}"/></svg>` : ""}</div>
        <span class="wd-label">${WEEKDAY_LETTERS[(d.getDay() + 6) % 7]}</span>`;
      wrap.addEventListener("click", () => cycleDay(iso));
      strip.appendChild(wrap);
    }
  }

  // ---------- calendar ----------
  function renderCalendar() {
    const label = calDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
    document.getElementById("cal-month-label").textContent = label.charAt(0).toUpperCase() + label.slice(1);

    const grid = document.getElementById("calendar-grid");
    grid.innerHTML = "";

    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const offset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayIso = todayISO();

    for (let i = 0; i < offset; i++) {
      const empty = document.createElement("div");
      empty.className = "cal-day empty";
      grid.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const iso = toISODate(d);
      const type = dayType(iso);
      const cell = document.createElement("div");
      cell.className = "cal-day";
      cell.textContent = day;
      if (iso === todayIso) cell.classList.add("today");
      if (type) cell.classList.add(type);
      if (iso > todayIso) {
        cell.classList.add("future");
      } else {
        cell.addEventListener("click", () => cycleDay(iso));
      }
      grid.appendChild(cell);
    }
  }

  function initCalendarNav() {
    document.getElementById("cal-prev").addEventListener("click", () => {
      calDate.setMonth(calDate.getMonth() - 1);
      renderCalendar();
    });
    document.getElementById("cal-next").addEventListener("click", () => {
      calDate.setMonth(calDate.getMonth() + 1);
      renderCalendar();
    });
  }

  function renderAllHome() {
    renderHero();
    renderWeekStrip();
    renderCalendar();
    updateQuickSheetState();
  }

  // ---------- chart ----------
  function svgLineChart(points) {
    if (points.length < 2) {
      return '<p class="muted small" style="padding:20px;text-align:center;">Agrega al menos 2 registros para ver la gráfica.</p>';
    }
    const W = 600, H = 220, padL = 36, padR = 16, padT = 16, padB = 28;
    const values = points.map((p) => p.value);
    let min = Math.min(...values), max = Math.max(...values);
    if (min === max) { min -= 1; max += 1; }
    const range = max - min;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;

    const coords = points.map((p, i) => ({
      x: padL + i * stepX,
      y: padT + innerH - ((p.value - min) / range) * innerH,
      ...p,
    }));

    const pathD = coords.map((c, i) => (i === 0 ? "M" : "L") + c.x.toFixed(1) + "," + c.y.toFixed(1)).join(" ");
    const areaD =
      pathD +
      ` L${coords[coords.length - 1].x.toFixed(1)},${(padT + innerH).toFixed(1)}` +
      ` L${coords[0].x.toFixed(1)},${(padT + innerH).toFixed(1)} Z`;

    const circles = coords
      .map((c) => `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3.5" fill="var(--accent)"><title>${c.label}: ${c.value}</title></circle>`)
      .join("");

    return `
    <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      <text x="${padL}" y="${padT + 8}" font-size="11" fill="var(--text-muted)">${max}</text>
      <text x="${padL}" y="${padT + innerH}" font-size="11" fill="var(--text-muted)">${min}</text>
      <path d="${areaD}" fill="var(--accent)" opacity="0.08" stroke="none"></path>
      <path d="${pathD}" fill="none" stroke="var(--accent)" stroke-width="2.5"></path>
      ${circles}
      <text x="${padL}" y="${H - 6}" font-size="11" fill="var(--text-muted)">${coords[0].label}</text>
      <text x="${W - padR}" y="${H - 6}" font-size="11" fill="var(--text-muted)" text-anchor="end">${coords[coords.length - 1].label}</text>
    </svg>`;
  }

  // ---------- steppers ----------
  function wireSteppers(scope) {
    scope.querySelectorAll(".stepper").forEach((st) => {
      const input = st.querySelector("input");
      if (input.dataset.stepperWired) return;
      input.dataset.stepperWired = "1";
      const step = parseFloat(st.dataset.step || "1");
      const min = input.min !== "" ? parseFloat(input.min) : -Infinity;
      st.querySelector(".step-minus").addEventListener("click", () => {
        const v = parseFloat(input.value || min || 0);
        input.value = round2(Math.max(min, v - step));
      });
      st.querySelector(".step-plus").addEventListener("click", () => {
        const v = parseFloat(input.value || Math.max(min, 0) - step);
        input.value = round2(v + step);
      });
    });
  }
  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  // ---------- body weight ----------
  function upsertWeight(dateIso, weight) {
    const idx = data.bodyWeight.findIndex((w) => w.date === dateIso);
    if (idx >= 0) data.bodyWeight[idx].weight = weight;
    else data.bodyWeight.push({ id: genId(), date: dateIso, weight });
    data.bodyWeight.sort((a, b) => a.date.localeCompare(b.date));
  }

  function renderWeight() {
    const sorted = [...data.bodyWeight].sort((a, b) => a.date.localeCompare(b.date));
    const points = sorted.map((w) => ({ label: formatShort(w.date), value: w.weight }));
    document.getElementById("weight-chart").innerHTML = svgLineChart(points);

    const list = document.getElementById("weight-list");
    list.innerHTML = "";
    if (sorted.length === 0) {
      list.innerHTML = '<p class="muted small">Sin registros todavía.</p>';
      return;
    }
    [...sorted].reverse().forEach((w) => {
      const row = document.createElement("div");
      row.className = "entry-row";
      row.innerHTML = `
        <div class="entry-main">
          <span>${w.weight} kg</span>
          <span class="entry-date">${formatLong(w.date)}</span>
        </div>
        <button class="del-btn" title="Eliminar"><svg class="icon-sm"><use href="#icon-trash"/></svg></button>`;
      row.querySelector(".del-btn").addEventListener("click", () => {
        data.bodyWeight = data.bodyWeight.filter((x) => x.id !== w.id);
        saveData();
        renderWeight();
      });
      list.appendChild(row);
    });
  }

  function initWeightForm() {
    const dateInput = document.getElementById("weight-date");
    dateInput.value = todayISO();
    wireSteppers(document.getElementById("form-weight"));
    document.getElementById("form-weight").addEventListener("submit", (e) => {
      e.preventDefault();
      const dateIso = dateInput.value || todayISO();
      const val = parseFloat(document.getElementById("weight-value").value);
      if (isNaN(val)) return;
      upsertWeight(dateIso, val);
      saveData();
      document.getElementById("weight-value").value = "";
      dateInput.value = todayISO();
      renderWeight();
      toast("Peso guardado");
    });
  }

  // ---------- exercises ----------
  function exerciseNames() {
    const fromLogs = data.exerciseLogs.map((l) => l.exercise);
    return [...new Set([...DEFAULT_EXERCISES, ...fromLogs])].sort((a, b) => a.localeCompare(b, "es"));
  }

  function refreshExerciseNameLists(selectPreferred) {
    const names = exerciseNames();
    const datalist = document.getElementById("ex-names");
    datalist.innerHTML = names.map((n) => `<option value="${n}"></option>`).join("");

    const usedNames = [...new Set(data.exerciseLogs.map((l) => l.exercise))].sort((a, b) => a.localeCompare(b, "es"));
    const select = document.getElementById("ex-select");
    const prevValue = selectPreferred || select.value;
    if (usedNames.length === 0) {
      select.innerHTML = '<option value="">Sin ejercicios registrados</option>';
    } else {
      select.innerHTML = usedNames.map((n) => `<option value="${n}">${n}</option>`).join("");
      if (usedNames.includes(prevValue)) select.value = prevValue;
    }
  }

  function renderExerciseChart() {
    const exercise = document.getElementById("ex-select").value;
    const container = document.getElementById("ex-chart");
    if (!exercise) {
      container.innerHTML = '<p class="muted small" style="padding:20px;text-align:center;">Registra un ejercicio para ver su progreso.</p>';
      return;
    }
    const byDate = new Map();
    data.exerciseLogs
      .filter((l) => l.exercise === exercise)
      .forEach((l) => {
        const cur = byDate.get(l.date);
        if (!cur || l.weight > cur) byDate.set(l.date, l.weight);
      });
    const sortedDates = [...byDate.keys()].sort();
    const points = sortedDates.map((d) => ({ label: formatShort(d), value: byDate.get(d) }));
    container.innerHTML = svgLineChart(points);
  }

  function renderExerciseList() {
    const list = document.getElementById("ex-list");
    list.innerHTML = "";
    const sorted = [...data.exerciseLogs].sort((a, b) => b.date.localeCompare(a.date));
    if (sorted.length === 0) {
      list.innerHTML = '<p class="muted small">Sin registros todavía.</p>';
      return;
    }
    sorted.forEach((l) => {
      const row = document.createElement("div");
      row.className = "entry-row";
      row.innerHTML = `
        <div class="entry-main">
          <span>${l.exercise} — ${l.weight} kg × ${l.reps} reps × ${l.sets} series</span>
          <span class="entry-date">${formatLong(l.date)}</span>
        </div>
        <button class="del-btn" title="Eliminar"><svg class="icon-sm"><use href="#icon-trash"/></svg></button>`;
      row.querySelector(".del-btn").addEventListener("click", () => {
        data.exerciseLogs = data.exerciseLogs.filter((x) => x.id !== l.id);
        saveData();
        refreshExerciseNameLists();
        renderExerciseChart();
        renderExerciseList();
      });
      list.appendChild(row);
    });
  }

  function renderRepeatButtons() {
    const has = !!data.lastExercise;
    const detail = has ? `${data.lastExercise.name} — ${data.lastExercise.weight} kg × ${data.lastExercise.reps} × ${data.lastExercise.sets}` : "";

    const card = document.getElementById("btn-repeat-exercise");
    card.classList.toggle("hidden", !has);
    if (has) document.getElementById("repeat-detail").textContent = detail;

    const qsBtn = document.getElementById("qs-repeat-exercise");
    qsBtn.classList.toggle("hidden", !has);
    if (has) document.getElementById("qs-repeat-label").textContent = `Repetir: ${detail}`;
  }

  function logExercise(dateIso, name, weight, reps, sets) {
    data.exerciseLogs.push({ id: genId(), date: dateIso, exercise: name, weight, reps, sets });
    data.lastExercise = { name, weight, reps, sets };
    saveData();
  }

  function repeatLastExercise() {
    if (!data.lastExercise) return;
    const { name, weight, reps, sets } = data.lastExercise;
    logExercise(todayISO(), name, weight, reps, sets);
    refreshExerciseNameLists(name);
    renderExerciseChart();
    renderExerciseList();
    renderRepeatButtons();
    toast("Serie registrada");
  }

  function initExerciseForm() {
    document.getElementById("ex-date").value = todayISO();
    refreshExerciseNameLists();
    wireSteppers(document.getElementById("form-exercise"));
    document.getElementById("ex-select").addEventListener("change", renderExerciseChart);
    document.getElementById("btn-repeat-exercise").addEventListener("click", repeatLastExercise);

    document.getElementById("form-exercise").addEventListener("submit", (e) => {
      e.preventDefault();
      const dateIso = document.getElementById("ex-date").value || todayISO();
      const name = document.getElementById("ex-name").value.trim();
      const weight = parseFloat(document.getElementById("ex-weight").value);
      const reps = parseInt(document.getElementById("ex-reps").value, 10);
      const sets = parseInt(document.getElementById("ex-sets").value, 10);
      if (!name || isNaN(weight) || isNaN(reps) || isNaN(sets)) return;

      logExercise(dateIso, name, weight, reps, sets);

      document.getElementById("ex-name").value = "";
      document.getElementById("ex-weight").value = "";
      document.getElementById("ex-reps").value = "";
      document.getElementById("ex-sets").value = "1";
      document.getElementById("ex-date").value = todayISO();

      refreshExerciseNameLists(name);
      renderExerciseChart();
      renderExerciseList();
      renderRepeatButtons();
      toast("Ejercicio guardado");
    });
  }

  // ---------- quick sheet ----------
  function openSheet() {
    document.getElementById("sheet-backdrop").classList.remove("hidden");
    document.getElementById("quick-sheet").classList.remove("hidden");
    document.getElementById("fab").classList.add("open");
    updateQuickSheetState();
  }
  function closeSheet() {
    document.getElementById("sheet-backdrop").classList.add("hidden");
    document.getElementById("quick-sheet").classList.add("hidden");
    document.getElementById("fab").classList.remove("open");
  }
  function updateQuickSheetState() {
    const todayType = dayType(todayISO());
    const t = document.getElementById("qs-trained");
    const r = document.getElementById("qs-rest");
    if (t) t.classList.toggle("active", todayType === "trained");
    if (r) r.classList.toggle("active", todayType === "rest");
  }

  function initQuickSheet() {
    document.getElementById("fab").addEventListener("click", () => {
      const sheet = document.getElementById("quick-sheet");
      sheet.classList.contains("hidden") ? openSheet() : closeSheet();
    });
    document.getElementById("sheet-backdrop").addEventListener("click", closeSheet);
    document.getElementById("qs-close").addEventListener("click", closeSheet);

    document.getElementById("qs-trained").addEventListener("click", () => setDay(todayISO(), "trained"));
    document.getElementById("qs-rest").addEventListener("click", () => setDay(todayISO(), "rest"));

    wireSteppers(document.getElementById("qs-weight-form"));
    document.getElementById("qs-weight-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("qs-weight-value");
      const val = parseFloat(input.value);
      if (isNaN(val)) return;
      upsertWeight(todayISO(), val);
      saveData();
      input.value = "";
      renderWeight();
      toast("Peso guardado");
      closeSheet();
    });

    document.getElementById("qs-repeat-exercise").addEventListener("click", () => {
      repeatLastExercise();
      closeSheet();
    });
    document.getElementById("qs-goto-exercise").addEventListener("click", () => {
      closeSheet();
      switchView("ejercicios");
      document.getElementById("ex-name").focus();
    });
  }

  // ---------- home quick buttons ----------
  function initHomeButtons() {
    document.getElementById("btn-mark-trained").addEventListener("click", () => setDay(todayISO(), "trained"));
    document.getElementById("btn-mark-rest").addEventListener("click", () => setDay(todayISO(), "rest"));
  }

  // ---------- export / import ----------
  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function csvEscape(val) {
    const s = String(val);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function initDataTools() {
    document.getElementById("btn-export-json").addEventListener("click", () => {
      downloadFile(`estacion_fitness_backup_${todayISO()}.json`, JSON.stringify(data, null, 2), "application/json");
      toast("JSON exportado");
    });

    document.getElementById("btn-export-csv-gym").addEventListener("click", () => {
      const rows = ["fecha,tipo"];
      [...data.dayLogs].sort((a, b) => a.date.localeCompare(b.date)).forEach((d) => rows.push(`${d.date},${d.type}`));
      downloadFile(`estacion_fitness_racha_${todayISO()}.csv`, rows.join("\n"), "text/csv");
      toast("CSV exportado");
    });

    document.getElementById("btn-export-csv-weight").addEventListener("click", () => {
      const rows = ["fecha,peso_kg"];
      [...data.bodyWeight].sort((a, b) => a.date.localeCompare(b.date)).forEach((w) => rows.push(`${w.date},${w.weight}`));
      downloadFile(`estacion_fitness_peso_corporal_${todayISO()}.csv`, rows.join("\n"), "text/csv");
      toast("CSV exportado");
    });

    document.getElementById("btn-export-csv-ex").addEventListener("click", () => {
      const rows = ["fecha,ejercicio,peso_kg,reps,series"];
      [...data.exerciseLogs].sort((a, b) => a.date.localeCompare(b.date)).forEach((l) => {
        rows.push([l.date, csvEscape(l.exercise), l.weight, l.reps, l.sets].join(","));
      });
      downloadFile(`estacion_fitness_ejercicios_${todayISO()}.csv`, rows.join("\n"), "text/csv");
      toast("CSV exportado");
    });

    document.getElementById("file-import").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          if (!confirm("Esto reemplazará todos tus datos actuales con el contenido del archivo. ¿Continuar?")) {
            e.target.value = "";
            return;
          }
          const dayLogs = Array.isArray(parsed.dayLogs)
            ? parsed.dayLogs
            : Array.isArray(parsed.gymDays)
            ? parsed.gymDays.map((d) => ({ date: d, type: "trained" }))
            : [];
          data = {
            dayLogs,
            bodyWeight: Array.isArray(parsed.bodyWeight) ? parsed.bodyWeight : [],
            exerciseLogs: Array.isArray(parsed.exerciseLogs) ? parsed.exerciseLogs : [],
            lastExercise: parsed.lastExercise && parsed.lastExercise.name ? parsed.lastExercise : null,
          };
          saveData();
          renderAll();
          toast("Datos importados");
        } catch (err) {
          alert("El archivo no es un JSON válido de Estación Fitness.");
        } finally {
          e.target.value = "";
        }
      };
      reader.readAsText(file);
    });

    document.getElementById("btn-clear-all").addEventListener("click", () => {
      if (!confirm("Esto borrará TODOS tus datos permanentemente. ¿Estás seguro?")) return;
      data = { dayLogs: [], bodyWeight: [], exerciseLogs: [], lastExercise: null };
      saveData();
      renderAll();
      toast("Datos borrados");
    });
  }

  // ---------- init ----------
  function renderAll() {
    renderAllHome();
    renderWeight();
    refreshExerciseNameLists();
    renderExerciseChart();
    renderExerciseList();
    renderRepeatButtons();
  }

  function init() {
    initNav();
    initCalendarNav();
    initHomeButtons();
    initWeightForm();
    initExerciseForm();
    initQuickSheet();
    initDataTools();
    renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();

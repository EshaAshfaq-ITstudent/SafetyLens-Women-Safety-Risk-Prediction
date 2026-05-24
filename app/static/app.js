const colors = {
  low: "#34d399",
  medium: "#fbbf24",
  high: "#fb7185",
  cyan: "#67e8f9",
  muted: "#9fb6ad",
  text: "#edf7f2",
};

const riskOrder = ["low", "medium", "high"];
const charts = {};
let leafletMap;
const themeStorageKey = "dashboardTheme";

Chart.defaults.color = colors.muted;
Chart.defaults.borderColor = "rgba(214,255,237,.12)";
Chart.defaults.font.family = "Inter, system-ui, sans-serif";

function applyTheme(theme) {
  const isLight = theme === "light";
  document.body.classList.toggle("light", isLight);
  document.body.dataset.theme = theme;
  const toggle = document.getElementById("themeToggle");
  if (toggle) {
    toggle.textContent = isLight ? "Dark mode" : "Light mode";
    toggle.setAttribute("aria-pressed", String(isLight));
  }
  updateChartTheme();
}

function updateChartTheme() {
  const computed = getComputedStyle(document.documentElement);
  const textColor = computed.getPropertyValue("--text").trim() || colors.text;
  Object.values(charts).forEach((chart) => {
    if (!chart) return;
    chart.options.color = textColor;
    if (chart.options.plugins?.tooltip) {
      chart.options.plugins.tooltip.titleColor = textColor;
      chart.options.plugins.tooltip.bodyColor = textColor;
    }
    if (chart.options.scales) {
      Object.values(chart.options.scales).forEach((scale) => {
        if (scale.ticks) scale.ticks.color = textColor;
        if (scale.grid) scale.grid.color = "rgba(255,255,255,.08)";
      });
    }
    chart.update();
  });
}

function initTheme() {
  const saved = localStorage.getItem(themeStorageKey);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved === "light" || saved === "dark" ? saved : prefersDark ? "dark" : "light");
  const toggle = document.getElementById("themeToggle");
  toggle?.addEventListener("click", () => {
    const nextTheme = document.body.classList.contains("light") ? "dark" : "light";
    applyTheme(nextTheme);
    localStorage.setItem(themeStorageKey, nextTheme);
  });
}

function hideLoader() {
  const loader = document.getElementById("loaderOverlay");
  if (!loader) return;
  loader.classList.add("hidden");
  window.setTimeout(() => loader.remove(), 500);
}

const api = (path, options) => fetch(path, options).then(async (res) => {
  if (!res.ok) {
    let message = `Request failed: ${path}`;
    try {
      const body = await res.json();
      message = body.detail || message;
    } catch {
      message = res.statusText || message;
    }
    throw new Error(message);
  }
  return res.json();
});

function number(value) {
  return new Intl.NumberFormat("en").format(value);
}

function title(value) {
  return String(value).replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function dataset(label, data, color) {
  return {
    label: title(label),
    data,
    borderColor: color,
    backgroundColor: `${color}bb`,
    borderWidth: 2,
    tension: 0.36,
    pointRadius: 0,
    fill: false,
  };
}

function stackedDatasets(series) {
  return riskOrder.map((risk) => ({
    label: title(risk),
    data: series[risk],
    backgroundColor: colors[risk],
    borderRadius: 4,
  }));
}

function makeChart(id, type, data, options = {}) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(document.getElementById(id), {
    type,
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1100, easing: "easeOutQuart" },
      plugins: {
        legend: { labels: { boxWidth: 10, usePointStyle: true } },
        tooltip: { backgroundColor: "#061112", titleColor: colors.text, bodyColor: colors.text },
      },
      scales: type === "doughnut" ? undefined : {
        x: { grid: { display: false }, stacked: options.stacked || false },
        y: { beginAtZero: true, stacked: options.stacked || false },
      },
      ...options,
    },
  });
}

function bindTabs() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab, .panel").forEach((el) => el.classList.remove("active"));
      button.classList.add("active");
      document.getElementById(button.dataset.tab).classList.add("active");
      if (button.dataset.tab === "map" && leafletMap) setTimeout(() => leafletMap.invalidateSize(), 100);
    });
  });
}

function activateTab(tabName) {
  const button = document.querySelector(`.tab[data-tab="${tabName}"]`);
  if (button) button.click();
}

async function buildAreaLookup() {
  const options = await api("/api/options");
  const select = document.getElementById("areaName");
  const areaNames = options.area_name || [];
  select.innerHTML = areaNames.map((name) => `<option value="${name}">${name}</option>`).join("");

  document.getElementById("areaForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const areaName = select.value;
    const button = event.currentTarget.querySelector("button[type='submit']");
    button.disabled = true;
    button.textContent = "Checking...";

    try {
      const result = await api(`/api/area?name=${encodeURIComponent(areaName)}`);
      renderAreaResult(result);
    } catch (error) {
      renderAreaError(error);
    } finally {
      button.disabled = false;
      button.textContent = "Check Safety";
    }
  });
}

function renderAreaResult(area) {
  const card = document.getElementById("areaResult");
  const status = area.avg_risk_score < 0.35 ? "Low risk" : area.avg_risk_score < 0.55 ? "Moderate risk" : "High risk";
  card.querySelector("strong").textContent = `${area.area_name}`;
  card.querySelector("p").textContent = `Average risk ${area.avg_risk_score} • ${area.high_risk_rate}% high-risk incidents • Common time: ${title(area.common_time_of_day)}.`;
  document.getElementById("areaDetails").innerHTML = `
    <div class="detail"><strong>Area type</strong>${title(area.area_type)}</div>
    <div class="detail"><strong>Records analysed</strong>${number(area.records)}</div>
    <div class="detail"><strong>Safety status</strong>${status}</div>
    <div class="detail"><strong>Top reported crime</strong>${title(area.top_crime)}</div>
    <div class="detail"><strong>High risk rate</strong>${area.high_risk_rate}%</div>
  `;
  card.style.background = status === "High risk"
    ? "linear-gradient(135deg, rgba(251,113,133,.18), rgba(13,24,29,.95))"
    : status === "Moderate risk"
      ? "linear-gradient(135deg, rgba(251,191,36,.16), rgba(13,24,29,.95))"
      : "linear-gradient(135deg, rgba(52,211,153,.14), rgba(13,24,29,.95))";
}

function renderAreaError(error) {
  const card = document.getElementById("areaResult");
  card.querySelector("strong").textContent = "Area unavailable";
  card.querySelector("p").textContent = error.message || "Unable to load area safety info.";
  document.getElementById("areaDetails").innerHTML = "";
  card.style.background = "linear-gradient(135deg, rgba(251,113,133,.18), rgba(13,24,29,.95))";
}

async function loadSummary() {
  const summary = await api("/api/summary");
  document.getElementById("statRecords").textContent = number(summary.records);
  document.getElementById("statAreas").textContent = number(summary.areas);
  document.getElementById("statRisk").textContent = summary.avg_risk_score;
  document.getElementById("statHigh").textContent = `${summary.high_risk_rate}%`;
  document.getElementById("rangeText").textContent = `${summary.date_range.start} to ${summary.date_range.end}`;
  document.getElementById("recordText").textContent = `${number(summary.records)} records`;
  document.getElementById("highestArea").innerHTML = `
    <span>Highest average risk area</span>
    <strong>${summary.highest_risk_area}</strong>
    <p>${summary.high_risk_rate}% of all records are high-risk. The dashboard below breaks down where, when, and why those signals appear.</p>
  `;
  document.getElementById("safeAreaList").innerHTML = summary.top_safe_areas.map((item, index) => `
    <div class="safe-item">
      <strong>${index + 1}. ${item.area_name}</strong>
      <span>Avg risk score ${item.avg_risk_score.toFixed(3)}</span>
    </div>
  `).join("");
  document.getElementById("suggestedAreaName").textContent = summary.top_safe_areas[0]?.area_name || "Karachi Central";
  document.getElementById("suggestedZone").textContent = summary.safe_area_type || "well-lit zone";
  document.getElementById("suggestedTime").textContent = summary.safe_time_of_day || "Morning";
  document.getElementById("suggestedRisk").textContent = summary.avg_risk_score < 0.35 ? "Low" : summary.avg_risk_score < 0.55 ? "Moderate" : "High";

  makeChart("riskChart", "doughnut", {
    labels: summary.risk_counts.map((x) => title(x.name)),
    datasets: [{ data: summary.risk_counts.map((x) => x.value), backgroundColor: riskOrder.map((r) => colors[r]), borderWidth: 0 }],
  }, { cutout: "62%" });

  makeChart("crimeChart", "bar", {
    labels: summary.top_crimes.map((x) => title(x.name)),
    datasets: [{ label: "Incidents", data: summary.top_crimes.map((x) => x.value), backgroundColor: "#67e8f9", borderRadius: 4 }],
  }, { indexAxis: "y" });

  makeChart("areaVolumeChart", "bar", {
    labels: summary.area_types.map((x) => title(x.name)),
    datasets: [{ label: "Records", data: summary.area_types.map((x) => x.value), backgroundColor: "#2dd4bf", borderRadius: 4 }],
  });
}

async function loadCharts() {
  const data = await api("/api/charts");

  makeChart("areaTypeChart", "bar", {
    labels: data.risk_by_area_type.labels.map(title),
    datasets: stackedDatasets(data.risk_by_area_type.series),
  }, { stacked: true });

  makeChart("monthlyChart", "line", {
    labels: data.monthly.labels,
    datasets: riskOrder.map((risk) => dataset(risk, data.monthly.series[risk], colors[risk])),
  });

  makeChart("hourlyChart", "bar", {
    labels: data.hourly.labels,
    datasets: stackedDatasets(data.hourly.series),
  }, { stacked: true });

  makeChart("timeChart", "bar", {
    labels: data.risk_by_time.labels.map(title),
    datasets: stackedDatasets(data.risk_by_time.series),
  }, { stacked: true });

  makeChart("lightingChart", "bar", {
    labels: data.risk_by_lighting.labels.map(title),
    datasets: stackedDatasets(data.risk_by_lighting.series),
  }, { stacked: true });

  makeChart("policeChart", "bar", {
    labels: data.risk_by_police.labels.map(title),
    datasets: stackedDatasets(data.risk_by_police.series),
  }, { stacked: true });

  makeChart("weatherChart", "bar", {
    labels: data.weather_score.labels.map(title),
    datasets: [{ label: "Avg Risk Score", data: data.weather_score.values, backgroundColor: "#fbbf24", borderRadius: 4 }],
  });

  document.getElementById("corridorList").innerHTML = data.top_corridors.map((item, index) => `
    <div class="corridor">
      <div>
        <strong>${index + 1}. ${item.area_name}</strong>
        <span>${title(item.area_type)} / ${number(item.incidents)} reported incidents</span>
      </div>
      <div class="score">${item.risk_score.toFixed(3)}</div>
    </div>
  `).join("");
}

async function loadMap() {
  const data = await api("/api/map?limit=1800");
  leafletMap = L.map("leafletMap", { zoomControl: true }).setView(data.center, 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap",
  }).addTo(leafletMap);

  data.points.forEach((point) => {
    L.circleMarker([point.latitude, point.longitude], {
      radius: 4 + point.risk_score * 6,
      color: data.colors[point.risk_level],
      fillColor: data.colors[point.risk_level],
      fillOpacity: 0.42,
      weight: 1,
    }).bindPopup(`
      <strong>${point.area_name}</strong><br>
      ${title(point.area_type)} / ${title(point.crime_type)}<br>
      Risk: ${title(point.risk_level)} (${point.risk_score})
    `).addTo(leafletMap);
  });

  data.areas.slice(0, 20).forEach((area) => {
    L.circle([area.latitude, area.longitude], {
      radius: 250 + area.risk_score * 850,
      color: area.risk_score > .55 ? colors.rose : colors.amber,
      fillOpacity: 0.08,
      weight: 2,
    }).addTo(leafletMap);
  });
}

const fieldConfig = [
  ["area_type", "select"], ["time_of_day", "select"], ["hour", "number"],
  ["day_of_week", "select"], ["crime_type", "select"], ["reported_incidents", "number"],
  ["lighting_condition", "select"], ["crowd_density", "select"], ["police_presence", "select"],
  ["cctv_coverage", "select"], ["proximity_to_police_station_km", "number"], ["population_density", "select"],
  ["transport_availability", "select"], ["feel_unsafe_rating", "number"], ["weather", "select"],
  ["cctv_available", "number"], ["police_patrol", "number"], ["previous_incidents_Monthly", "number"],
  ["police_station_Distance_km", "number"], ["public_transport_Available", "number"], ["is_weekend", "number"],
];

const defaults = {
  area_type: "market", time_of_day: "night", hour: 22, day_of_week: "Friday",
  is_weekend: 0, crime_type: "harassment", reported_incidents: 9, lighting_condition: "poorly_lit",
  crowd_density: "medium", police_presence: "low", cctv_coverage: "no",
  proximity_to_police_station_km: 3, population_density: "medium", transport_availability: "moderate",
  feel_unsafe_rating: 3, weather: "clear", cctv_available: 0, police_patrol: 0,
  previous_incidents_Monthly: 8, police_station_Distance_km: 2.5, public_transport_Available: 1,
};

async function buildPredictor() {
  const options = await api("/api/options");
  const grid = document.getElementById("formGrid");
  grid.innerHTML = fieldConfig.map(([name, type]) => {
    const label = title(name);
    if (type === "select") {
      const values = options[name] || [];
      return `<label>${label}<select name="${name}">${values.map((value) => `<option value="${value}" ${value === defaults[name] ? "selected" : ""}>${title(value)}</option>`).join("")}</select></label>`;
    }
    return `<label>${label}<input name="${name}" type="number" step="0.1" value="${defaults[name]}" /></label>`;
  }).join("");

  document.getElementById("predictForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    button.textContent = "Predicting...";
    renderPredicting();

    try {
      const payload = readPredictionPayload(form);
      const result = await api("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      renderPrediction(result, payload);
    } catch (error) {
      renderPredictionError(error);
    } finally {
      button.disabled = false;
      button.textContent = "Predict Risk";
    }
  });
}

function readPredictionPayload(form) {
  const payload = {};
  new FormData(form).forEach((value, key) => {
    const field = form.elements[key];
    if (field?.type === "number") {
      const fallback = defaults[key] ?? 0;
      payload[key] = value === "" ? fallback : Number(value);
      return;
    }
    payload[key] = value;
  });
  return payload;
}

function renderPredicting() {
  const card = document.getElementById("predictionResult");
  card.style.background = "linear-gradient(135deg, rgba(103,232,249,.16), rgba(13,24,29,.9))";
  card.querySelector("strong").textContent = "Running";
  card.querySelector("p").textContent = "Fresh scenario is being sent to the model...";
  document.getElementById("probBars").innerHTML = "";
}

function renderPrediction(result, payload) {
  const card = document.getElementById("predictionResult");
  card.style.background = `linear-gradient(135deg, ${result.color}28, rgba(13,24,29,.9))`;
  card.querySelector("strong").textContent = title(result.risk_level);
  card.querySelector("p").textContent = `${Math.round(result.confidence * 100)}% confidence / ${title(payload.area_type)} / ${title(payload.time_of_day)} / ${payload.hour}:00 / refreshed ${new Date().toLocaleTimeString()}.`;
  document.getElementById("probBars").innerHTML = riskOrder.map((risk) => {
    const value = result.probabilities[risk] || 0;
    return `
      <div class="bar">
        <div><span>${title(risk)}</span><strong>${Math.round(value * 100)}%</strong></div>
        <div class="track"><div class="fill" style="width:${value * 100}%; background:${colors[risk]}"></div></div>
      </div>
    `;
  }).join("");
}

function renderPredictionError(error) {
  const card = document.getElementById("predictionResult");
  card.style.background = "linear-gradient(135deg, rgba(251,113,133,.22), rgba(13,24,29,.9))";
  card.querySelector("strong").textContent = "Error";
  card.querySelector("p").textContent = error.message || "Prediction failed. Check the selected values and try again.";
  document.getElementById("probBars").innerHTML = "";
}

function bindHeroActions() {
  const downloadBtn = document.getElementById("downloadAppBtn");
  const checkBtn = document.getElementById("checkAreaBtn");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      alert("Mobile companion coming soon. Use this dashboard to preview safety signals and area risk alerts.");
    });
  }
  if (checkBtn) {
    checkBtn.addEventListener("click", () => activateTab("area"));
  }
}

async function boot() {
  initTheme();
  bindTabs();
  bindHeroActions();
  await Promise.all([loadSummary(), loadCharts(), buildPredictor(), buildAreaLookup()]);
  await loadMap();
}

boot()
  .then(hideLoader)
  .catch((error) => {
    console.error(error);
    hideLoader();
    document.body.insertAdjacentHTML("afterbegin", `<div style="padding:12px;background:#7f1d1d;color:white">Dashboard error: ${error.message}</div>`);
  });

import { APP_VERSION, CARRIERS, TRANSFERS, cleanProtocol, formatPercent, formatPoints, makeRng, runFactorial, runStudy, runSubsetFactorial, summarizePairDeletion } from "./engine.js";

const STORAGE_KEY = "memory-carrier-observatory:receipts:v1";
const PROTOCOL_KEY = "memory-carrier-observatory:protocol:v1";
const MAX_RECEIPTS = 128;
const DEFAULTS = { lesion: "habitat", transfer: "same", pairs: 24, training: 12, seed: 104729 };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const carrierName = (id) => CARRIERS.find((item) => item.id === id)?.short || id;
const transferName = (id) => TRANSFERS.find((item) => item.id === id)?.label || id;

let activeResult = null;
let receiptHistory = loadReceipts();
let isPreview = true;
let isRunning = false;
let latestMatrixId = receiptHistory.find((item) => item.matrixId)?.matrixId || null;
let latestSubsetStudyId = receiptHistory.find((item) => item.subsetStudyId)?.subsetStudyId || null;

function loadReceipts() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item) => item && item.runKey && Array.isArray(item.ledger)).slice(0, MAX_RECEIPTS).map((run) => {
      if (run.subsetEffect?.kind === "mobius-interaction") {
        run.subsetEffect.pairDeletion = summarizePairDeletion(run.ledger.map((row) => row.subsetInteractionDelta));
      }
      return run;
    }) : [];
  } catch {
    return [];
  }
}

function loadSavedProtocol() {
  try {
    const stored = JSON.parse(localStorage.getItem(PROTOCOL_KEY) || "{}");
    return cleanProtocol(stored.protocol || stored);
  }
  catch { return cleanProtocol(DEFAULTS); }
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(receiptHistory.slice(0, MAX_RECEIPTS))); }
  catch { /* The app remains usable when browser storage is blocked or full. */ }
}

function safeText(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function getFormProtocol() {
  return cleanProtocol({
    lesion: $("#lesion-select").value,
    transfer: $("#transfer-select").value,
    pairs: Number($("#pairs-range").value),
    training: Number($("#training-range").value),
    seed: Number($("#seed-input").value)
  });
}

function setFormProtocol(protocol) {
  const value = cleanProtocol(protocol);
  $("#lesion-select").value = value.lesion;
  $("#transfer-select").value = value.transfer;
  $("#pairs-range").value = String(value.pairs);
  $("#training-range").value = String(value.training);
  $("#seed-input").value = String(value.seed);
  updateRangeOutputs();
}

function updateRangeOutputs() {
  $("#pairs-value").value = $("#pairs-range").value;
  $("#pairs-value").textContent = $("#pairs-range").value;
  $("#training-value").value = $("#training-range").value;
  $("#training-value").textContent = $("#training-range").value;
}

function carrierStatus(result) {
  const removed = new Set(result.experimental.active);
  for (const item of CARRIERS) {
    const chip = $(`.carrier-chip[data-carrier="${item.id}"]`);
    const state = $(".carrier-state", chip);
    const availableInBoth = result.reference.active.includes(item.id) && removed.has(item.id);
    const droppedByTransfer = !result.reference.active.includes(item.id);
    chip.classList.toggle("removed", !availableInBoth);
    chip.classList.toggle("transfer-dropped", droppedByTransfer);
    state.textContent = droppedByTransfer ? "TRANSFER LOST" : availableInBoth ? "RETAINED" : "CUT IN ARM B";
  }
}

function updateWorldGraphic(result) {
  const canvas = $("#world-canvas");
  if (!canvas) return;
  const bounds = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  const width = Math.max(320, bounds.width || 700);
  const height = Math.max(110, bounds.height || 190);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, width, height);

  const leftX = width * 0.17;
  const midX = width * 0.51;
  const rightX = width * 0.84;
  const midY = height * 0.51;
  const radius = Math.min(44, height * 0.24);
  const seed = Number(result.protocol.seed) + (Number.parseInt(result.runKey.slice(-4), 16) || 0);
  const random = makeRng(seed);
  const muted = "rgba(133, 160, 174, .28)";
  const mint = "#8ce2ca";
  const coral = "#fb8172";
  const gold = "#e8c987";
  const ink = "rgba(236, 242, 240, .8)";

  const circle = (x, y, r, color, lineWidth = 1) => {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.stroke();
  };
  ctx.setLineDash([3, 7]);
  ctx.beginPath(); ctx.moveTo(leftX + radius + 15, midY); ctx.bezierCurveTo(width * .35, midY - 10, width * .38, midY + 10, midX - radius - 15, midY); ctx.strokeStyle = "rgba(140, 226, 202, .52)"; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(midX + radius + 15, midY); ctx.bezierCurveTo(width * .67, midY + 11, width * .70, midY - 11, rightX - radius - 15, midY); ctx.strokeStyle = "rgba(251, 129, 114, .5)"; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.setLineDash([]);

  circle(leftX, midY, radius + 10, "rgba(140, 226, 202, .18)");
  circle(leftX, midY, radius, "rgba(140, 226, 202, .52)");
  circle(midX, midY, radius + 10, "rgba(223, 199, 135, .16)");
  circle(midX, midY, radius, "rgba(223, 199, 135, .48)");
  circle(rightX, midY, radius + 10, "rgba(251, 129, 114, .16)");
  circle(rightX, midY, radius, "rgba(251, 129, 114, .5)");

  for (let index = 0; index < 9; index += 1) {
    const angle = (Math.PI * 2 * index) / 9;
    const x = leftX + Math.cos(angle) * radius * 0.64;
    const y = midY + Math.sin(angle) * radius * 0.64;
    ctx.beginPath(); ctx.arc(x, y, 2.2 + random() * 1.2, 0, Math.PI * 2); ctx.fillStyle = index % 3 === 0 ? gold : mint; ctx.fill();
  }
  for (let index = 0; index < 7; index += 1) {
    const angle = (Math.PI * 2 * index) / 7 + .22;
    const x = midX + Math.cos(angle) * radius * 0.62;
    const y = midY + Math.sin(angle) * radius * 0.62;
    ctx.beginPath(); ctx.arc(x, y, 2.3, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill();
  }
  const removed = result.experimental.active.length < result.reference.active.length;
  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8 - .15;
    const x = rightX + Math.cos(angle) * radius * 0.63;
    const y = midY + Math.sin(angle) * radius * 0.63;
    ctx.beginPath(); ctx.arc(x, y, 2.2 + random() * 1.1, 0, Math.PI * 2); ctx.fillStyle = removed && index === 0 ? coral : "rgba(236,242,240,.72)"; ctx.fill();
  }
  ctx.font = "10px 'DM Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(236, 242, 240, .62)";
  ctx.fillText("cue → reward", leftX, midY + 4);
  ctx.fillStyle = "rgba(236, 242, 240, .68)";
  ctx.fillText("TRANSFER", midX, midY + 4);
  ctx.fillStyle = coral;
  ctx.fillText("CHOICE", rightX, midY + 4);
  ctx.fillStyle = muted;
  ctx.textAlign = "left";
  ctx.fillText("n = 12 / paired world", 10, height - 9);
}

function renderOutcome(result, preview = false) {
  activeResult = result;
  isPreview = preview;
  const diff = result.contrast.mean;
  $("#reference-value").innerHTML = `${(result.reference.rate * 100).toFixed(1)}<small>%</small>`;
  $("#experimental-value").innerHTML = `${(result.experimental.rate * 100).toFixed(1)}<small>%</small>`;
  $("#contrast-value").innerHTML = `${diff > 0 ? "+" : ""}${(diff * 100).toFixed(1)}<small>pp</small>`;
  $("#contrast-value").classList.toggle("negative-contrast", diff < 0);
  $("#contrast-value").classList.toggle("positive-contrast", diff > 0);
  $("#reference-count").textContent = `${result.reference.hits.toLocaleString()} / ${result.reference.total.toLocaleString()} choices`;
  $("#experimental-count").textContent = `${result.experimental.hits.toLocaleString()} / ${result.experimental.total.toLocaleString()} choices`;
  $("#carrier-removed-label").textContent = `${carrierName(result.protocol.lesion).toLowerCase()} removed`;
  $("#interval-value").textContent = `95% interval ${formatPoints(result.contrast.low)} to ${formatPoints(result.contrast.high)}`;
  $("#reference-meter").style.width = `${result.reference.rate * 100}%`;
  $("#experimental-meter").style.width = `${result.experimental.rate * 100}%`;
  $("#result-tag").textContent = `${preview ? "DEMO SEED" : "RUN"} · ${result.protocol.seed}`;
  $("#run-state").textContent = preview ? "SEEDED PREVIEW" : "RUN COMPLETE";
  $("#protocol-run-key").textContent = result.runKey;
  $("#copy-run").setAttribute("aria-label", `Copy run key ${result.runKey}`);
  $("#probe-title").textContent = result.nextProbe.message || `Remove the ${carrierName(result.nextProbe.carrier).toLowerCase()} trace under this transfer.`;
  $("#probe-copy").textContent = `Among the remaining carrier removals in “${transferName(result.protocol.transfer)}”, ${carrierName(result.nextProbe.carrier).toLowerCase()} best separates the fixed storage hypotheses by predicted retention. It is a simple disagreement heuristic, not an AI finding.`;
  $("#use-probe").dataset.carrier = result.nextProbe.carrier;
  carrierStatus(result);
  renderPreviewRows(result);
  updateWorldGraphic(result);
}

function renderPreviewRows(result) {
  const rows = result.ledger.slice(0, 5).map((row) => `<tr><td class="mono row-index">${String(row.pair).padStart(2, "0")}</td><td class="mono">${row.worldKey}</td><td>${formatPercent(row.referenceRate)}</td><td>${formatPercent(row.experimentalRate)}</td><td class="${row.delta < 0 ? "delta-negative" : "delta-positive"}">${formatPoints(row.delta)}</td><td><span class="receipt-state"><i></i> MATCHED</span></td></tr>`).join("");
  $("#preview-rows").innerHTML = rows;
  $("#table-summary").textContent = `Showing 5 of ${result.ledger.length} matched pairs · ${result.runKey}`;
}

function addReceipt(result) {
  receiptHistory = [result, ...receiptHistory.filter((item) => item.runKey !== result.runKey)].slice(0, MAX_RECEIPTS);
  persist();
  try { localStorage.setItem(PROTOCOL_KEY, JSON.stringify(result.protocol)); } catch { /* optional preference */ }
  updateLedgerCount();
}

function addMatrixReceipts(matrix) {
  const keys = new Set(matrix.runs.map((run) => run.runKey));
  receiptHistory = [...matrix.runs, ...receiptHistory.filter((item) => !keys.has(item.runKey))].slice(0, MAX_RECEIPTS);
  latestMatrixId = matrix.matrixId;
  persist();
  try { localStorage.setItem(PROTOCOL_KEY, JSON.stringify(matrix.protocol)); } catch { /* optional preference */ }
  updateLedgerCount();
}

function matrixRuns() {
  return latestMatrixId ? receiptHistory.filter((run) => run.matrixId === latestMatrixId).sort((a, b) => a.matrixCell - b.matrixCell) : [];
}

function subsetRuns() {
  return latestSubsetStudyId ? receiptHistory.filter((run) => run.subsetStudyId === latestSubsetStudyId).sort((a, b) => a.subsetCell - b.subsetCell) : [];
}

function addSubsetReceipts(study) {
  const keys = new Set(study.runs.map((run) => run.runKey));
  receiptHistory = [...study.runs, ...receiptHistory.filter((item) => !keys.has(item.runKey))].slice(0, MAX_RECEIPTS);
  latestSubsetStudyId = study.subsetStudyId;
  persist();
  try { localStorage.setItem(PROTOCOL_KEY, JSON.stringify(study.protocol)); } catch { /* optional preference */ }
  updateLedgerCount();
}

function renderMatrix() {
  const runs = matrixRuns();
  const complete = runs.length === CARRIERS.length * TRANSFERS.length;
  $("#matrix-empty").classList.toggle("hidden", complete);
  $("#matrix-table").classList.toggle("hidden", !complete);
  $("#matrix-insight").classList.toggle("hidden", !complete);
  $("#matrix-detail").classList.add("hidden");
  if (!complete) {
    $("#matrix-cell-count").textContent = "—";
    $("#matrix-pair-count").textContent = "—";
    $("#matrix-base-seed").textContent = "—";
    return;
  }

  const byCell = new Map(runs.map((run) => [`${run.protocol.lesion}:${run.protocol.transfer}`, run]));
  const maxima = Math.max(0.01, ...runs.map((run) => Math.abs(run.contrast.mean)));
  $("#matrix-status").textContent = `Matrix complete · ${latestMatrixId}`;
  $("#matrix-summary-copy").textContent = `${runs.length} interventions share ${runs[0].protocol.pairs} matched seed pairs per cell and ${runs[0].protocol.training} training exposures. ${runs[0].protocol.pairs * 12 * 8 * runs.length} choices were scored per arm across the full matrix.`;
  $("#matrix-cell-count").textContent = String(runs.length);
  $("#matrix-pair-count").textContent = String(runs[0].protocol.pairs);
  $("#matrix-base-seed").textContent = String(runs[0].protocol.seed);

  $("#matrix-head").innerHTML = `<tr><th scope="col">CARRIER REMOVED</th>${TRANSFERS.map((transfer) => `<th scope="col">${safeText(transfer.label.replace(/^A |^Same |^A world where /, ""))}</th>`).join("")}</tr>`;
  $("#matrix-rows").innerHTML = CARRIERS.map((carrier) => {
    const cells = TRANSFERS.map((transfer) => {
      const run = byCell.get(`${carrier.id}:${transfer.id}`);
      const effect = run.contrast.mean;
      const strength = Math.min(0.34, 0.06 + (Math.abs(effect) / maxima) * 0.22).toFixed(3);
      const tone = effect < -0.0005 ? "negative" : effect > 0.0005 ? "positive" : "neutral";
      const identicalArms = run.reference.active.join(",") === run.experimental.active.join(",");
      const label = `${carrier.label} removed; ${transfer.label}: ${formatPoints(effect)}; 95% interval ${formatPoints(run.contrast.low)} to ${formatPoints(run.contrast.high)}`;
      const receiptLabel = identicalArms ? "arms identical by design" : `${formatPoints(run.contrast.low)} to ${formatPoints(run.contrast.high)}`;
      return `<td><button type="button" class="matrix-cell ${tone}" data-run-key="${run.runKey}" style="--effect-strength:${strength}" aria-label="${safeText(label)}${identicalArms ? "; both arms identical by design" : ""}" title="${safeText(label)}"><strong>${formatPoints(effect).replace(" pp", "")}</strong><small>${safeText(receiptLabel)}</small></button></td>`;
    }).join("");
    return `<tr><th scope="row"><span class="matrix-carrier-glyph">${carrier.glyph}</span><span>${safeText(carrier.short)}<small>${safeText(carrier.label)}</small></span></th>${cells}</tr>`;
  }).join("");

  const spreads = CARRIERS.map((carrier) => {
    const cells = TRANSFERS.map((transfer) => byCell.get(`${carrier.id}:${transfer.id}`));
    const sorted = [...cells].sort((left, right) => left.contrast.mean - right.contrast.mean);
    return { carrier, span: sorted.at(-1).contrast.mean - sorted[0].contrast.mean, low: sorted[0], high: sorted.at(-1) };
  }).sort((left, right) => right.span - left.span);
  const largest = spreads[0];
  $("#matrix-insight").innerHTML = `<span class="section-index">CONTEXT MODULATION · DESCRIPTIVE</span><p><strong>${safeText(largest.carrier.label)}</strong> has the widest observed effect span across contexts: <b>${formatPoints(largest.span)}</b>, from “${safeText(transferName(largest.low.protocol.transfer))}” (${formatPoints(largest.low.contrast.mean)}) to “${safeText(transferName(largest.high.protocol.transfer))}” (${formatPoints(largest.high.contrast.mean)}). This is a range across the six simulated conditions, not a significance test.</p><small>Each cell’s context shift is estimated as a paired difference-in-differences against the same-carrier, same-world cell.</small>`;
}

function showMatrixDetail(run) {
  const shift = run.contextInteraction;
  const transfer = TRANSFERS.find((item) => item.id === run.protocol.transfer);
  const baselineText = run.protocol.transfer === "same" ? "Familiar-world reference cell" : "Difference-in-differences versus familiar world";
  const identicalArms = run.reference.active.join(",") === run.experimental.active.join(",");
  const designNote = identicalArms ? " Both arms are identical because this transfer already removes the selected carrier; the zero is a protocol-induced null." : "";
  $("#matrix-detail").innerHTML = `<div class="matrix-detail-head"><div><span class="section-index">CELL ${String(run.matrixCell).padStart(2, "0")} / ${run.matrixTotal} · ${safeText(run.runKey)}</span><h2>${safeText(CARRIERS.find((item) => item.id === run.protocol.lesion).label)} removed · ${safeText(transfer.label)}</h2></div><button type="button" id="inspect-matrix-cell" class="outline-button">OPEN IN LAB <span>↗</span></button></div><div class="matrix-detail-grid"><div><span>REFERENCE / SHAM</span><b>${formatPercent(run.reference.rate)}</b><small>${run.reference.hits.toLocaleString()} / ${run.reference.total.toLocaleString()} choices</small></div><div><span>ALTERED ARM</span><b>${formatPercent(run.experimental.rate)}</b><small>${run.experimental.hits.toLocaleString()} / ${run.experimental.total.toLocaleString()} choices</small></div><div><span>PAIRED EFFECT · 95% INTERVAL</span><b>${formatPoints(run.contrast.mean)}</b><small>${formatPoints(run.contrast.low)} to ${formatPoints(run.contrast.high)}</small></div><div><span>${baselineText.toUpperCase()}</span><b>${formatPoints(shift.mean)}</b><small>${formatPoints(shift.low)} to ${formatPoints(shift.high)}</small></div></div><p class="matrix-detail-note">The context shift compares the per-seed carrier-removal effect in this transfer against the effect for the same carrier in the familiar-world condition. Both contrasts use the shared seed pairs. Intervals are normal approximations and all quantities are synthetic.${designNote}</p>`;
  $("#matrix-detail").classList.remove("hidden");
  $("#inspect-matrix-cell").addEventListener("click", () => { renderOutcome(run, false); openView("lab"); });
}

function renderAtlas() {
  const runs = subsetRuns();
  const totalCells = (2 ** CARRIERS.length) * TRANSFERS.length;
  const complete = runs.length === totalCells;
  $("#atlas-empty").classList.toggle("hidden", complete);
  $("#atlas-table").classList.toggle("hidden", !complete);
  $("#atlas-detail").classList.add("hidden");
  if (!complete) {
    $("#atlas-cell-count").textContent = "—";
    $("#atlas-pair-count").textContent = "—";
    $("#atlas-baseline-rate").textContent = "—";
    return;
  }

  const transferId = $("#atlas-transfer").value || TRANSFERS[0].id;
  const contextRuns = runs.filter((run) => run.protocol.transfer === transferId);
  const baseline = contextRuns.find((run) => run.subsetMask === 0);
  const ordered = contextRuns.filter((run) => run.subsetMask !== 0).sort((left, right) => left.subsetOrder - right.subsetOrder || left.subsetMask - right.subsetMask);
  const orderLabel = (order) => ({ 1: "MAIN EFFECT", 2: "PAIR", 3: "3-WAY", 4: "4-WAY" })[order] || `${order}-WAY`;
  $("#atlas-status").textContent = `Subset study complete · ${latestSubsetStudyId}`;
  $("#atlas-summary-copy").textContent = `${runs.length} conditions · ${runs[0].protocol.pairs} matched seed pairs per condition · ${runs[0].protocol.training} training exposures. ${runs[0].protocol.pairs * 12 * 8 * runs.length} choices scored per arm across the study.`;
  $("#atlas-cell-count").textContent = String(runs.length);
  $("#atlas-pair-count").textContent = String(runs[0].protocol.pairs);
  $("#atlas-baseline-rate").textContent = formatPercent(baseline.experimental.rate);
  $("#atlas-rows").innerHTML = ordered.map((run) => {
    const effect = run.subsetEffect;
    const deletion = effect.pairDeletion;
    const tone = effect.mean < -0.0005 ? "negative" : effect.mean > 0.0005 ? "positive" : "neutral";
    const subsetName = run.removedCarriers.map(carrierName).join(" + ");
    const deletionLabel = deletion?.fullDirection === 0 ? "mean centered at zero" : `${deletion?.reversedDirectionCount ?? "—"}/${deletion?.totalDeletions ?? run.protocol.pairs} deletions reverse sign`;
    const deletionTone = deletion?.fullDirection !== 0 && deletion?.reversedDirectionCount === 0 && deletion?.neutralDirectionCount === 0 ? "stable" : "sensitive";
    const label = `${orderLabel(run.subsetOrder)}: ${subsetName}, ${transferName(transferId)}; term ${formatPoints(effect.mean)}, 95% interval ${formatPoints(effect.low)} to ${formatPoints(effect.high)}; ${deletionLabel}`;
    return `<tr><td><span class="atlas-order">${orderLabel(run.subsetOrder)}</span></td><td class="atlas-subset">${safeText(subsetName)}<small>MASK ${run.subsetMask.toString(2).padStart(CARRIERS.length, "0")} · ${run.protocol.pairs} MATCHED PAIRS</small></td><td><button type="button" class="atlas-term-button ${tone}" data-run-key="${run.runKey}" aria-label="${safeText(label)}">${formatPoints(effect.mean)}</button><small class="atlas-interval-mobile">${formatPoints(effect.low)} to ${formatPoints(effect.high)}</small><small class="atlas-pair-delete ${deletionTone}">${safeText(deletionLabel)}</small></td><td class="atlas-interval">${formatPoints(effect.low)} to ${formatPoints(effect.high)}</td></tr>`;
  }).join("");
}

function showAtlasDetail(run) {
  const baseline = subsetRuns().find((item) => item.protocol.transfer === run.protocol.transfer && item.subsetMask === 0);
  const effect = run.subsetEffect;
  const deletion = effect.pairDeletion;
  const orderName = run.subsetOrder === 1 ? "Main effect" : `${run.subsetOrder}-way interaction`;
  const subsetName = run.removedCarriers.map((id) => CARRIERS.find((item) => item.id === id).label).join(" + ");
  const deletionLabel = deletion.fullDirection === 0
    ? "The full-sample mean is centered at zero; there is no direction to retain."
    : `Dropping one pair reversed the mean's sign ${deletion.reversedDirectionCount} of ${deletion.totalDeletions} times and left it at zero ${deletion.neutralDirectionCount} times.`;
  const rows = run.ledger.map((row, index) => {
    const base = baseline.ledger[index];
    return `<tr><td>${String(row.pair).padStart(2, "0")}</td><td>${row.seed}</td><td>${formatPercent(base.experimentalRate)}</td><td>${formatPercent(row.experimentalRate)}</td><td>${formatPoints(row.subsetInteractionDelta)}</td></tr>`;
  }).join("");
  $("#atlas-detail").innerHTML = `<span class="section-index">${orderName.toUpperCase()} · ${safeText(run.protocolLabel)} · ${safeText(run.runKey)}</span><h2>${safeText(subsetName)}</h2><div class="atlas-detail-grid"><div><span>FACTORIAL TERM</span><b>${formatPoints(effect.mean)}</b><small>Mean across ${run.protocol.pairs} matched seed coefficients</small></div><div><span>95% NORMAL INTERVAL</span><b>${formatPoints(effect.low)} to ${formatPoints(effect.high)}</b><small>Calculated over per-seed inclusion–exclusion terms</small></div><div><span>ONE-PAIR-DELETION MEAN RANGE</span><b>${formatPoints(deletion.minimum)} to ${formatPoints(deletion.maximum)}</b><small>${safeText(deletionLabel)}</small></div><div><span>TRANSFER CONTEXT</span><b>${safeText(transferName(run.protocol.transfer))}</b><small>${safeText(run.subsetStudyId)} · cell ${run.subsetCell} / ${run.subsetTotal}</small></div></div><p class="atlas-detail-note">The one-pair-deletion range recalculates the mean after omitting each matched pair in turn. It is an influence diagnostic, not a confidence interval or independent replication. The reported interval is descriptive and does not adjust for the many terms and contexts examined. No receipt is deleted; every original seed row remains below.</p><details><summary>Inspect all ${run.ledger.length} paired seed terms</summary><div class="table-scroll"><table class="atlas-seed-table"><thead><tr><th>PAIR</th><th>SEED</th><th>NO-REMOVAL ACCURACY</th><th>SUBSET ACCURACY</th><th>TERM</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
  $("#atlas-detail").classList.remove("hidden");
}

function renderFullLedger(filter = "") {
  const query = filter.trim().toLowerCase();
  const runs = receiptHistory.length ? receiptHistory : (activeResult ? [activeResult] : []);
  const rows = runs.flatMap((run) => run.ledger.map((row) => ({ run, row })));
  const filtered = rows.filter(({ run, row }) => {
    const haystack = [run.runKey, run.matrixId, run.subsetStudyId, run.protocolLabel, run.protocol.lesion, run.removedCarriers?.join(" "), run.protocol.transfer, row.worldKey, row.seed, row.pair, formatPercent(row.referenceRate), formatPercent(row.experimentalRate), formatPoints(row.delta), formatPoints(row.contextInteractionDelta || 0), row.subsetInteractionDelta == null ? "" : formatPoints(row.subsetInteractionDelta)].join(" ").toLowerCase();
    return haystack.includes(query);
  });
  $("#ledger-rows").innerHTML = filtered.slice(0, 500).map(({ run, row }) => `<tr><td><span class="mono run-cell">${safeText(run.runKey)}</span><small>PAIR ${String(row.pair).padStart(2, "0")}</small></td><td class="mono">${safeText(row.worldKey)}</td><td><span class="protocol-pill">${safeText(run.protocolLabel)}</span></td><td>${formatPercent(row.referenceRate)} <small>${row.referenceHits}/${row.total}</small></td><td>${formatPercent(row.experimentalRate)} <small>${row.experimentalHits}/${row.total}</small></td><td class="${row.delta < 0 ? "delta-negative" : "delta-positive"}">${formatPoints(row.delta)}</td><td class="mono time-cell">${safeText(new Date(run.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" }))}</td></tr>`).join("");
  $("#ledger-empty").classList.toggle("hidden", filtered.length > 0);
  $("#ledger-footer-count").textContent = `${filtered.length.toLocaleString()} receipt ${filtered.length === 1 ? "row" : "rows"}${filtered.length > 500 ? " · first 500 shown" : ""}`;
  $("#ledger-summary").innerHTML = `<span><b>${runs.length}</b> runs stored</span><span><b>${rows.length.toLocaleString()}</b> matched seed receipts</span><span><b>${receiptHistory.length ? "LOCAL STORAGE" : "DEMO ONLY"}</b> session state</span>`;
}

function updateLedgerCount() {
  const count = receiptHistory.reduce((sum, run) => sum + run.ledger.length, 0);
  $("#ledger-count").textContent = count > 999 ? "999+" : String(count);
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportJson() {
  downloadFile(`memory-carrier-receipts-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: "Memory Carrier Observatory", version: APP_VERSION, exportedAt: new Date().toISOString(), runs: receiptHistory.length ? receiptHistory : (activeResult ? [activeResult] : []) }, null, 2), "application/json");
}

function exportCsv() {
  const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const rows = [["run_key", "matrix_id", "matrix_cell", "subset_study_id", "subset_cell", "subset_mask", "subset_order", "removed_carriers", "subset_interaction_value", "subset_interaction_mean", "subset_interaction_low", "subset_interaction_high", "delete_one_method", "delete_one_analysis_version", "delete_one_min_mean", "delete_one_max_mean", "delete_one_same_direction_count", "delete_one_reversed_direction_count", "delete_one_neutral_direction_count", "delete_one_total_deletions", "created_at", "pair", "world_key", "seed", "lesion", "transfer", "reference_hits", "experimental_hits", "choices", "reference_rate", "experimental_rate", "delta", "context_interaction_delta", "context_interaction_mean", "context_interaction_low", "context_interaction_high"]];
  for (const run of (receiptHistory.length ? receiptHistory : (activeResult ? [activeResult] : []))) {
    for (const row of run.ledger) rows.push([run.runKey, run.matrixId || "", run.matrixCell || "", run.subsetStudyId || "", run.subsetCell || "", run.subsetMask ?? "", run.subsetOrder ?? "", run.removedCarriers?.join("+") || "", row.subsetInteractionDelta ?? "", run.subsetEffect?.mean ?? "", run.subsetEffect?.low ?? "", run.subsetEffect?.high ?? "", run.subsetEffect?.pairDeletion?.method ?? "", run.subsetEffect?.pairDeletion?.analysisVersion ?? "", run.subsetEffect?.pairDeletion?.minimum ?? "", run.subsetEffect?.pairDeletion?.maximum ?? "", run.subsetEffect?.pairDeletion?.sameDirectionCount ?? "", run.subsetEffect?.pairDeletion?.reversedDirectionCount ?? "", run.subsetEffect?.pairDeletion?.neutralDirectionCount ?? "", run.subsetEffect?.pairDeletion?.totalDeletions ?? "", run.createdAt, row.pair, row.worldKey, row.seed, run.protocol.lesion, run.protocol.transfer, row.referenceHits, row.experimentalHits, row.total, row.referenceRate, row.experimentalRate, row.delta, row.contextInteractionDelta ?? "", run.contextInteraction?.mean ?? "", run.contextInteraction?.low ?? "", run.contextInteraction?.high ?? ""]);
  }
  downloadFile(`memory-carrier-receipts-${new Date().toISOString().slice(0, 10)}.csv`, rows.map((row) => row.map(quote).join(",")).join("\r\n"), "text/csv;charset=utf-8");
}

function openView(name) {
  for (const view of $$(".view")) view.classList.toggle("active-view", view.id === `view-${name}`);
  for (const link of $$(".rail-link")) {
    const active = link.dataset.view === name;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
  }
  const titles = { lab: "EXPERIMENT 01", matrix: "FACTORIAL MATRIX", atlas: "INTERACTION ATLAS", ledger: "EVIDENCE ARCHIVE", protocol: "MODEL CARD" };
  $("#crumb-current").textContent = titles[name] || "MEMORY CARRIER OBSERVATORY";
  if (name === "matrix") renderMatrix();
  if (name === "atlas") renderAtlas();
  if (name === "ledger") renderFullLedger($("#ledger-search").value);
  if (name === "protocol" && activeResult) $("#protocol-run-key").textContent = activeResult.runKey;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderLineage() {
  const projects = [
    ["NexusSearch", "local search & inspectable retrieval", "https://github.com/kai9987kai/NexusSearch"],
    ["Prometheus-α", "regrowth & retained cue learning", "https://github.com/kai9987kai/prometheus-alpha"],
    ["EvoSim Hybrid Agent", "seeded multi-agent ecology", "https://github.com/kai9987kai/3d-animal-simulator-Hybrid-Agent"],
    ["Morpheus", "synthetic body pattern & audit", "https://github.com/kai9987kai/morpheus"],
    ["Supermix Expanse v2", "specialists & evidence-bounded model claims", "https://github.com/kai9987kai/Supermix-Expanse-v2"],
    ["Ghost in the Machine", "causal experiments & null-calibrated evidence", "https://github.com/kai9987kai/GhostInTheMachine"],
    ["Supermix Expanse", "multi-source model provenance", "https://github.com/kai9987kai/Supermix-expanse"],
    ["Genesis Engine", "developmental genome & lifetime", "https://github.com/kai9987kai/GenesisEngine"],
    ["Supermix Archimedes", "heterogeneous systems & shared circuits", "https://github.com/kai9987kai/supermix-archimedes"],
    ["Supermix", "local-first tool & benchmark practice", "https://github.com/kai9987kai/Supermix"],
    ["Fly Diamond Nexus", "specialist agents in a shared world", "https://github.com/kai9987kai/FLY-DIAMOND-NEXUS"],
    ["QuantumBot", "matched-policy comparison discipline", "https://github.com/kai9987kai/QuantumBot"],
    ["Causeway", "evidence-to-experiment receipts", "https://github.com/kai9987kai/Causeway"],
    ["MOLT", "trace placement & transfer design", "https://github.com/kai9987kai/MOLT"],
    ["Universal Modder", "inspectable workflows & verification oracles", "https://github.com/rehan-remade/universal-modder/tree/main"],
    ["REA", "reverse engineering with agents", "https://github.com/morluto/rea"],
    ["Odysseus", "self-hosted AI workspace", "https://github.com/odysseus-dev/odysseus"]
  ];
  $("#lineage-links").innerHTML = projects.map(([name, role, url]) => `<a href="${url}" target="_blank" rel="noreferrer"><span>${safeText(name)}</span><small>${safeText(role)}</small><b>↗</b></a>`).join("");
}

function bindEvents() {
  $$(".rail-link").forEach((button) => button.addEventListener("click", () => openView(button.dataset.view)));
  $$('[data-open-view]').forEach((button) => button.addEventListener("click", (event) => { event.preventDefault(); openView(button.dataset.openView); }));
  $("#pairs-range").addEventListener("input", updateRangeOutputs);
  $("#training-range").addEventListener("input", updateRangeOutputs);
  $("#random-seed").addEventListener("click", () => { $("#seed-input").value = String(Math.floor(Math.random() * 2147483646) + 1); });
  $("#protocol-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (isRunning) return;
    const button = $(".run-button", event.currentTarget);
    const protocol = getFormProtocol();
    isRunning = true;
    button.disabled = true;
    $("#run-matrix").disabled = true;
    $("#run-subset").disabled = true;
    button.querySelector("span:nth-child(2)").textContent = "Running matched worlds…";
    $("#run-state").textContent = "RUNNING";
    const preregisteredAt = new Date().toISOString();
    try { localStorage.setItem(PROTOCOL_KEY, JSON.stringify({ protocol, preregisteredAt })); } catch { /* run can proceed without browser storage */ }
    requestAnimationFrame(() => setTimeout(() => {
      const result = runStudy(protocol, { preregisteredAt });
      renderOutcome(result, false);
      addReceipt(result);
      isRunning = false;
      button.disabled = false;
      $("#run-matrix").disabled = false;
      $("#run-subset").disabled = false;
      button.querySelector("span:nth-child(2)").textContent = "Run paired experiment";
    }, 40));
  });
  $("#run-matrix").addEventListener("click", async (event) => {
    if (isRunning) return;
    isRunning = true;
    const matrixButton = event.currentTarget;
    const runButton = $(".run-button");
    const subsetButton = $("#run-subset");
    const protocol = getFormProtocol();
    const preregisteredAt = new Date().toISOString();
    const previousMatrixId = latestMatrixId;
    latestMatrixId = null;
    matrixButton.disabled = true;
    runButton.disabled = true;
    subsetButton.disabled = true;
    matrixButton.querySelector("span:nth-child(2)").textContent = "Registering 24 cells…";
    $("#matrix-status").textContent = "Factorial matrix preregistered; preparing matched runs…";
    $("#matrix-summary-copy").textContent = `All four removals across six transfers · ${protocol.pairs} matched pairs per cell · seed ${protocol.seed}.`;
    openView("matrix");
    $("#matrix-status").textContent = "Factorial matrix preregistered; preparing matched runs…";
    try {
      try { localStorage.setItem(PROTOCOL_KEY, JSON.stringify({ protocol, preregisteredAt, design: "4 carrier removals × 6 transfer contexts" })); } catch { /* run can proceed without browser storage */ }
      const matrix = await runFactorial(protocol, { preregisteredAt }, ({ completed, total, result }) => {
        $("#matrix-status").textContent = `Running cell ${String(completed).padStart(2, "0")} / ${total} · ${result.protocolLabel}`;
        $("#matrix-cell-count").textContent = `${completed} / ${total}`;
        $("#matrix-pair-count").textContent = String(protocol.pairs);
        $("#matrix-base-seed").textContent = String(protocol.seed);
      });
      addMatrixReceipts(matrix);
      renderMatrix();
    } catch (error) {
      latestMatrixId = previousMatrixId;
      renderMatrix();
      $("#matrix-status").textContent = "Matrix run stopped before completion.";
      $("#matrix-summary-copy").textContent = safeText(error?.message || "The local matrix runner encountered an unexpected error.");
    } finally {
      isRunning = false;
      matrixButton.disabled = false;
      runButton.disabled = false;
      subsetButton.disabled = false;
      matrixButton.querySelector("span:nth-child(2)").textContent = "Run full 24-cell matrix";
    }
  });
  $("#run-subset").addEventListener("click", async (event) => {
    if (isRunning) return;
    isRunning = true;
    const subsetButton = event.currentTarget;
    const runButton = $(".run-button");
    const matrixButton = $("#run-matrix");
    const protocol = getFormProtocol();
    const preregisteredAt = new Date().toISOString();
    const previousStudyId = latestSubsetStudyId;
    latestSubsetStudyId = null;
    subsetButton.disabled = true;
    runButton.disabled = true;
    matrixButton.disabled = true;
    subsetButton.querySelector("span:nth-child(2)").textContent = "Registering 96 conditions…";
    $("#atlas-status").textContent = "Subset factorial preregistered; preparing matched runs…";
    $("#atlas-summary-copy").textContent = `All 16 removal subsets across six transfers · ${protocol.pairs} matched pairs per condition · seed ${protocol.seed}.`;
    openView("atlas");
    $("#atlas-status").textContent = "Subset factorial preregistered; preparing matched runs…";
    try {
      try { localStorage.setItem(PROTOCOL_KEY, JSON.stringify({ protocol, preregisteredAt, design: "16 removal subsets × 6 transfer contexts", decomposition: "per-seed inclusion-exclusion" })); } catch { /* run can proceed without browser storage */ }
      const study = await runSubsetFactorial(protocol, { preregisteredAt }, ({ completed, total, result }) => {
        $("#atlas-status").textContent = `Running condition ${String(completed).padStart(2, "0")} / ${total} · ${result.protocolLabel}`;
        $("#atlas-cell-count").textContent = `${completed} / ${total}`;
        $("#atlas-pair-count").textContent = String(protocol.pairs);
      });
      addSubsetReceipts(study);
      renderAtlas();
    } catch (error) {
      latestSubsetStudyId = previousStudyId;
      renderAtlas();
      $("#atlas-status").textContent = "Subset study stopped before completion.";
      $("#atlas-summary-copy").textContent = safeText(error?.message || "The local subset runner encountered an unexpected error.");
    } finally {
      isRunning = false;
      subsetButton.disabled = false;
      runButton.disabled = false;
      matrixButton.disabled = false;
      subsetButton.querySelector("span:nth-child(2)").textContent = "Run full 96-cell subset study";
    }
  });
  $("#matrix-rows").addEventListener("click", (event) => {
    const button = event.target.closest(".matrix-cell");
    if (!button) return;
    const result = matrixRuns().find((run) => run.runKey === button.dataset.runKey);
    if (result) showMatrixDetail(result);
  });
  $("#atlas-transfer").addEventListener("change", renderAtlas);
  $("#atlas-rows").addEventListener("click", (event) => {
    const button = event.target.closest(".atlas-term-button");
    if (!button) return;
    const result = subsetRuns().find((run) => run.runKey === button.dataset.runKey);
    if (result) showAtlasDetail(result);
  });
  $("#use-probe").addEventListener("click", (event) => {
    $("#lesion-select").value = event.currentTarget.dataset.carrier;
    $("#protocol-form").scrollIntoView({ behavior: "smooth", block: "center" });
  });
  $("#copy-run").addEventListener("click", () => copyRunKey(activeResult, "#copy-run"));
  $("#protocol-copy").addEventListener("click", () => copyRunKey(activeResult, "#protocol-copy"));
  $("#ledger-search").addEventListener("input", (event) => renderFullLedger(event.target.value));
  $("#export-json").addEventListener("click", exportJson);
  $("#export-csv").addEventListener("click", exportCsv);
  window.addEventListener("resize", () => activeResult && updateWorldGraphic(activeResult));
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault(); openView("ledger"); $("#ledger-search").focus();
    }
  });
  $("#protocol-form").addEventListener("change", () => {
    try { localStorage.setItem(PROTOCOL_KEY, JSON.stringify(getFormProtocol())); } catch { /* preference is optional */ }
  });
}

async function copyRunKey(result, buttonSelector) {
  if (!result) return;
  try {
    await navigator.clipboard.writeText(result.runKey);
    const button = $(buttonSelector);
    const original = button.innerHTML;
    button.innerHTML = "COPIED <span>✓</span>";
    setTimeout(() => { button.innerHTML = original; }, 1300);
  } catch {
    window.prompt("Copy this run key", result.runKey);
  }
}

function initialize() {
  const initialProtocol = loadSavedProtocol();
  setFormProtocol(initialProtocol);
  bindEvents();
  renderLineage();
  $("#atlas-transfer").innerHTML = TRANSFERS.map((transfer) => `<option value="${transfer.id}">${safeText(transfer.label)}</option>`).join("");
  updateLedgerCount();
  renderMatrix();
  renderAtlas();
  const preview = runStudy(initialProtocol);
  renderOutcome(preview, true);
  renderFullLedger();
  document.documentElement.dataset.appVersion = APP_VERSION;
}

initialize();

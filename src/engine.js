export const APP_VERSION = "0.4.0";

export const CARRIERS = [
  { id: "neural", short: "Neural", label: "Internal policy", glyph: "⌁", weight: 0.34, base: 0.53, ceiling: 0.40 },
  { id: "tissue", short: "Body", label: "Developed body pattern", glyph: "▦", weight: 0.20, base: 0.52, ceiling: 0.27 },
  { id: "habitat", short: "Habitat", label: "Habitat imprint", glyph: "⌂", weight: 0.25, base: 0.50, ceiling: 0.35 },
  { id: "colony", short: "Group", label: "Colony relay", glyph: "⋈", weight: 0.21, base: 0.51, ceiling: 0.32 }
];

export const TRANSFERS = [
  { id: "same", label: "Same body, habitat, and group", drops: [] },
  { id: "body", label: "A regrown body", drops: ["tissue"] },
  { id: "habitat", label: "A cleared habitat", drops: ["habitat"] },
  { id: "colony", label: "A new colony", drops: ["colony"] },
  { id: "reversed", label: "A world where the cue is reversed", drops: [], reverse: true },
  { id: "full", label: "A new body, habitat, and colony", drops: ["tissue", "habitat", "colony"] }
];

const SUBJECTS_PER_PAIR = 12;
const TESTS_PER_SUBJECT = 8;
const CHANCE = 0.5;
const CHANNEL_WEIGHTS = Object.fromEntries(CARRIERS.map((item) => [item.id, item.weight]));

export function makeRng(seed) {
  let state = Number(seed) >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function cleanProtocol(input = {}) {
  const lesion = CARRIERS.some((item) => item.id === input.lesion) ? input.lesion : "habitat";
  const transfer = TRANSFERS.some((item) => item.id === input.transfer) ? input.transfer : "same";
  return {
    version: APP_VERSION,
    lesion,
    transfer,
    pairs: clampStep(Number(input.pairs) || 24, 8, 64, 8),
    training: clampStep(Number(input.training) || 12, 4, 32, 4),
    seed: Math.max(1, Math.min(2147483647, Math.floor(Number(input.seed) || 104729)))
  };
}

function clampStep(value, min, max, step) {
  const snapped = min + Math.round((value - min) / step) * step;
  return Math.max(min, Math.min(max, snapped));
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function carrierAccuracy(carrier, training) {
  const spec = CARRIERS.find((item) => item.id === carrier);
  const saturation = 1 - Math.exp(-training / 9);
  return Math.min(0.94, spec.base + spec.ceiling * saturation);
}

function traceSignal(rng, accuracy) {
  return rng() < accuracy ? 1 : -1;
}

function makeTraces(rng, training) {
  const sharedGroupTrace = traceSignal(rng, carrierAccuracy("colony", training));
  return Array.from({ length: SUBJECTS_PER_PAIR }, () => ({
    neural: traceSignal(rng, carrierAccuracy("neural", training)),
    tissue: traceSignal(rng, carrierAccuracy("tissue", training)),
    habitat: traceSignal(rng, carrierAccuracy("habitat", training)),
    colony: sharedGroupTrace
  }));
}

function activeChannels(protocol, arm, removedCarriers = []) {
  const transfer = TRANSFERS.find((item) => item.id === protocol.transfer);
  const disabled = new Set(transfer.drops);
  if (arm === "experimental") removedCarriers.forEach((carrier) => disabled.add(carrier));
  return CARRIERS.filter((item) => !disabled.has(item.id)).map((item) => item.id);
}

function choiceIsCorrect(trace, active, reverse, decisionNoise, mapping) {
  let score = 0;
  for (const channel of active) score += CHANNEL_WEIGHTS[channel] * trace[channel];
  const confidence = 0.5 + 0.42 * Math.tanh(Math.abs(score) * 2.45);
  const choseMemoryDirection = decisionNoise < confidence;
  const rememberedDirection = (score >= 0 ? mapping : -mapping);
  const chosenSide = rememberedDirection * (choseMemoryDirection ? 1 : -1);
  const currentRule = reverse ? -mapping : mapping;
  return chosenSide === currentRule;
}

function summarizeDifferences(differences) {
  const mean = differences.reduce((sum, value) => sum + value, 0) / Math.max(1, differences.length);
  const variance = differences.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, differences.length - 1);
  const standardError = Math.sqrt(variance / Math.max(1, differences.length));
  return { mean, low: mean - 1.96 * standardError, high: mean + 1.96 * standardError };
}

export function summarizePairDeletion(values) {
  if (!Array.isArray(values) || values.length < 2 || values.some((value) => !Number.isFinite(value))) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  const fullMean = sum / values.length;
  const leaveOneOutMeans = values.map((value) => (sum - value) / (values.length - 1));
  const sign = (value) => Math.abs(value) < 1e-12 ? 0 : Math.sign(value);
  const direction = sign(fullMean);
  return {
    method: "leave-one-pair-out-mean-range-v1",
    analysisVersion: APP_VERSION,
    minimum: Math.min(...leaveOneOutMeans),
    maximum: Math.max(...leaveOneOutMeans),
    fullDirection: direction,
    sameDirectionCount: direction === 0 ? null : leaveOneOutMeans.filter((value) => sign(value) === direction).length,
    reversedDirectionCount: direction === 0 ? null : leaveOneOutMeans.filter((value) => sign(value) === -direction).length,
    neutralDirectionCount: direction === 0 ? null : leaveOneOutMeans.filter((value) => sign(value) === 0).length,
    totalDeletions: values.length
  };
}

function suggestProbe(usedLesion, currentTransfer) {
  const hypotheses = [
    { name: "Neural cache", weights: [0.72, 0.10, 0.10, 0.08] },
    { name: "Developed form", weights: [0.12, 0.66, 0.12, 0.10] },
    { name: "Habitat engram", weights: [0.12, 0.11, 0.66, 0.11] },
    { name: "Colony relay", weights: [0.10, 0.10, 0.10, 0.70] },
    { name: "Distributed blend", weights: [0.25, 0.25, 0.25, 0.25] }
  ];
  const transfer = TRANSFERS.find((item) => item.id === currentTransfer);
  const unavailable = new Set(transfer.drops);
  const candidates = CARRIERS.filter((item) => item.id !== usedLesion && !unavailable.has(item.id));
  if (!candidates.length) return { carrier: "neural", separation: 0, message: "The current transfer already removes every external carrier. Return to a familiar world for a cleaner comparison." };
  const ranked = candidates.map((candidate) => {
    const values = hypotheses.map((hypothesis) => {
      const activeMass = hypothesis.weights.reduce((sum, weight, index) => {
        const channel = CARRIERS[index].id;
        return sum + (channel !== candidate.id && !unavailable.has(channel) ? weight : 0);
      }, 0);
      return CHANCE + (activeMass * 0.39);
    });
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
    return { carrier: candidate.id, separation: Math.sqrt(variance) };
  }).sort((left, right) => right.separation - left.separation || left.carrier.localeCompare(right.carrier));
  return ranked[0];
}

function normalizeRemovedCarriers(removedCarriers) {
  const requested = new Set(Array.isArray(removedCarriers) ? removedCarriers : []);
  return CARRIERS.filter((carrier) => requested.has(carrier.id)).map((carrier) => carrier.id);
}

function simulateStudy(input, removedCarriers, metadata = {}) {
  const preregisteredAt = metadata.preregisteredAt || new Date().toISOString();
  const protocol = cleanProtocol(input);
  const transfer = TRANSFERS.find((item) => item.id === protocol.transfer);
  const referenceActive = activeChannels(protocol, "reference");
  const experimentalActive = activeChannels(protocol, "experimental", removedCarriers);
  const ledger = [];

  for (let pairIndex = 0; pairIndex < protocol.pairs; pairIndex += 1) {
    const pairSeed = (protocol.seed + pairIndex * 7919) >>> 0;
    const rng = makeRng(pairSeed);
    const mapping = rng() < 0.5 ? -1 : 1;
    const traces = makeTraces(rng, protocol.training);
    let referenceHits = 0;
    let experimentalHits = 0;
    let total = 0;

    for (let subject = 0; subject < SUBJECTS_PER_PAIR; subject += 1) {
      for (let trial = 0; trial < TESTS_PER_SUBJECT; trial += 1) {
        const sharedDecisionNoise = rng();
        const trace = traces[subject];
        referenceHits += Number(choiceIsCorrect(trace, referenceActive, Boolean(transfer.reverse), sharedDecisionNoise, mapping));
        experimentalHits += Number(choiceIsCorrect(trace, experimentalActive, Boolean(transfer.reverse), sharedDecisionNoise, mapping));
        total += 1;
      }
    }

    const referenceRate = referenceHits / total;
    const experimentalRate = experimentalHits / total;
    ledger.push({
      pair: pairIndex + 1,
      worldKey: `W-${pairSeed.toString(36).toUpperCase().padStart(7, "0")}`,
      seed: pairSeed,
      referenceHits,
      experimentalHits,
      total,
      referenceRate,
      experimentalRate,
      delta: experimentalRate - referenceRate
    });
  }

  const totalChoices = ledger.reduce((sum, row) => sum + row.total, 0);
  const referenceHits = ledger.reduce((sum, row) => sum + row.referenceHits, 0);
  const experimentalHits = ledger.reduce((sum, row) => sum + row.experimentalHits, 0);
  const interval = summarizeDifferences(ledger.map((row) => row.delta));
  const canonical = JSON.stringify({ protocol, removedCarriers, ledger: ledger.map(({ seed, referenceHits: ref, experimentalHits: exp, total }) => [seed, ref, exp, total]) });
  const runKey = `MCO-${fnv1a(canonical).toUpperCase()}`;
  const nextProbe = removedCarriers.length === 1 ? suggestProbe(removedCarriers[0], protocol.transfer) : null;
  const removalLabel = removedCarriers.length
    ? `${removedCarriers.map((id) => CARRIERS.find((item) => item.id === id).label).join(" + ")} removed`
    : "No carrier removed (sham)";

  return {
    appVersion: APP_VERSION,
    runKey,
    protocol,
    protocolLabel: `${removalLabel} · ${transfer.label}`,
    removedCarriers: [...removedCarriers],
    preregisteredAt,
    createdAt: new Date().toISOString(),
    pairing: "Same hidden mapping, cohort traces, and decision-noise draws within each seed pair.",
    reference: { hits: referenceHits, total: totalChoices, rate: referenceHits / totalChoices, active: referenceActive },
    experimental: { hits: experimentalHits, total: totalChoices, rate: experimentalHits / totalChoices, active: experimentalActive },
    contrast: interval,
    ledger,
    nextProbe
  };
}

export function runStudy(input, metadata = {}) {
  const protocol = cleanProtocol(input);
  return simulateStudy(protocol, [protocol.lesion], metadata);
}

export function runSubsetStudy(input, removedCarriers = [], metadata = {}) {
  return simulateStudy(input, normalizeRemovedCarriers(removedCarriers), metadata);
}

export async function runFactorial(input, metadata = {}, onProgress = () => {}) {
  const protocol = cleanProtocol(input);
  const preregisteredAt = metadata.preregisteredAt || new Date().toISOString();
  const conditions = CARRIERS.flatMap((carrier) => TRANSFERS.map((transfer) => ({
    lesion: carrier.id,
    transfer: transfer.id
  })));
  const runs = [];

  for (let index = 0; index < conditions.length; index += 1) {
    const result = runStudy({ ...protocol, ...conditions[index] }, { preregisteredAt });
    runs.push(result);
    onProgress({ completed: index + 1, total: conditions.length, result });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const matrixId = `MCO-MX-${fnv1a(runs.map((run) => run.runKey).join("|" )).toUpperCase()}`;
  const baseRuns = new Map(CARRIERS.map((carrier) => [
    carrier.id,
    runs.find((run) => run.protocol.lesion === carrier.id && run.protocol.transfer === "same")
  ]));

  runs.forEach((run, index) => {
    const baseline = baseRuns.get(run.protocol.lesion);
    const pairedInteractions = run.ledger.map((row, pairIndex) => row.delta - baseline.ledger[pairIndex].delta);
    const interactionInterval = summarizeDifferences(pairedInteractions);
    run.ledger.forEach((row, pairIndex) => { row.contextInteractionDelta = pairedInteractions[pairIndex]; });
    run.matrixId = matrixId;
    run.matrixCell = index + 1;
    run.matrixTotal = conditions.length;
    run.contextInteraction = {
      referenceTransfer: "same",
      mean: interactionInterval.mean,
      low: interactionInterval.low,
      high: interactionInterval.high
    };
  });

  return {
    matrixId,
    protocol,
    preregisteredAt,
    createdAt: new Date().toISOString(),
    runs
  };
}

function popcount(mask) {
  let count = 0;
  for (let value = mask; value; value &= value - 1) count += 1;
  return count;
}

export async function runSubsetFactorial(input, metadata = {}, onProgress = () => {}) {
  const protocol = cleanProtocol(input);
  const preregisteredAt = metadata.preregisteredAt || new Date().toISOString();
  const subsetCount = 2 ** CARRIERS.length;
  const conditions = Array.from({ length: subsetCount }, (_, mask) => ({
    mask,
    removedCarriers: CARRIERS.filter((_, index) => mask & (1 << index)).map((carrier) => carrier.id)
  })).flatMap((subset) => TRANSFERS.map((transfer) => ({ ...subset, transfer: transfer.id })));
  const runs = [];

  for (let index = 0; index < conditions.length; index += 1) {
    const condition = conditions[index];
    const result = runSubsetStudy({ ...protocol, transfer: condition.transfer }, condition.removedCarriers, { preregisteredAt });
    result.subsetMask = condition.mask;
    result.subsetOrder = condition.removedCarriers.length;
    runs.push(result);
    onProgress({ completed: index + 1, total: conditions.length, result });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const subsetStudyId = `MCO-SX-${fnv1a(runs.map((run) => run.runKey).join("|")).toUpperCase()}`;
  for (const transfer of TRANSFERS) {
    const contextRuns = runs.filter((run) => run.protocol.transfer === transfer.id);
    const byMask = new Map(contextRuns.map((run) => [run.subsetMask, run]));
    for (const run of contextRuns) {
      const mask = run.subsetMask;
      if (mask === 0) {
        run.subsetEffect = { kind: "baseline", order: 0, mean: run.experimental.rate, low: null, high: null };
        run.ledger.forEach((row) => { row.subsetInteractionDelta = null; });
        continue;
      }
      const coefficients = run.ledger.map((_, pairIndex) => {
        let value = 0;
        for (let subset = mask; ; subset = (subset - 1) & mask) {
          const sign = (popcount(mask) - popcount(subset)) % 2 === 0 ? 1 : -1;
          value += sign * byMask.get(subset).ledger[pairIndex].experimentalRate;
          if (subset === 0) break;
        }
        return value;
      });
      const interval = summarizeDifferences(coefficients);
      run.ledger.forEach((row, pairIndex) => { row.subsetInteractionDelta = coefficients[pairIndex]; });
      run.subsetEffect = {
        kind: "mobius-interaction",
        order: popcount(mask),
        mean: interval.mean,
        low: interval.low,
        high: interval.high,
        pairDeletion: summarizePairDeletion(coefficients)
      };
    }
  }

  runs.forEach((run, index) => {
    run.subsetStudyId = subsetStudyId;
    run.subsetCell = index + 1;
    run.subsetTotal = conditions.length;
  });
  return { subsetStudyId, protocol, preregisteredAt, createdAt: new Date().toISOString(), method: "Per-seed inclusion-exclusion (Möbius) decomposition of accuracy across all carrier-removal subsets.", runs };
}

export function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatPoints(value) {
  const points = value * 100;
  return `${points > 0 ? "+" : ""}${points.toFixed(1)} pp`;
}

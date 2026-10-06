# Memory Carrier Observatory

**A local memory-substrate observatory for synthetic agents.** The Observatory trains a toy cohort, applies matched carrier removals, moves it through transfer contexts, and saves seed-level receipts. Its 4 × 6 matrix maps single-removal effects; a new 2⁴ × 6 subset factorial covers all 16 combinations of four removals (including the no-removal baseline) across six transfer contexts. The Interaction Atlas decomposes outcomes into main, pair, three-way, and four-way terms per seed, so combined interventions can be compared with their lower-order additive components.

The project combines artificial-life and simulation ideas from the supplied repositories into a local, reproducible laboratory. It uses common random numbers: each condition replays the same seeded draw sequence for cohort traces and decision noise. This makes cross-condition contrasts inspectable while keeping the result bounded to the implemented simulator. The app makes no claim of scientific priority; adjacent memory benchmarks and artificial-life systems already exist.

## Run locally

Requires a modern browser and Python 3. No packages or model downloads are needed.

```powershell
Set-Location "<path-to-this-folder>"
python -m http.server 8766 --bind 127.0.0.1
```

Open <http://127.0.0.1:8766>. The server only serves the static files to your local machine. Experiment data, receipts, and settings remain in browser local storage. You can also open `index.html` directly in some browsers, but serving the folder avoids module restrictions.

## Run an experiment

1. Choose a carrier to remove after training and a transfer context.
2. Set matched seed pairs, training exposures, and a base seed.
3. Run a paired experiment to inspect one intervention, or run the 24-cell matrix to compare each single removal across all six contexts.
4. Run the 96-cell subset study to compare all 16 removal subsets, including a no-removal control, in every transfer context. The Atlas reports 4 main effects, 6 pair interactions, 4 three-way terms, and 1 four-way term per selected context.
5. Select an Atlas term to inspect its exact per-seed coefficient and the corresponding baseline and subset accuracies. The Atlas also recalculates each term’s mean with one matched pair omitted at a time, showing the range and any direction reversals. Export the local receipts as JSON or CSV from Ledger.

Within each seed, every condition uses the same hidden cue rule, synthetic training traces, and test-noise draws. The subset terms are inclusion–exclusion coefficients on the accuracy scale: for a removed set S, the term is the alternating sum of outcomes for S and its subsets. A positive pair term means the joint-removal outcome is higher than the sum of the baseline and two single-removal changes predicts. Atlas intervals are normal approximations over seed-level terms. The leave-one-pair-out range is a deterministic influence check, not an interval or independent replication. The terms and transfer contexts reuse observations, and the exploratory atlas applies no multiplicity adjustment.

The demo shown at startup is deterministic and is not stored until you run an experiment. Run receipts are stored locally in the browser, bounded to the latest 128 runs. If browser storage is unavailable or full, the current session can still run; export important receipts before clearing site data.

## Model scope

The Observatory models 12 subjects in each seed pair. Each subject receives a noisy trace for each available carrier. The group trace is shared across subjects. During eight held-out choices, active traces cast a weighted vote. A carrier knockout removes one or more votes in the experimental arm; a transfer context can remove the same channel from both arms or reverse the cue rule. The simulator uses seeded deterministic random draws, not trained neural networks or a biological model.

The displayed confidence interval is a normal-approximation interval over seed-level paired differences. In matrix mode, each context shift subtracts the familiar-world carrier-removal effect within each shared seed pair. In subset mode, each Möbius term is calculated within a seed before its mean and interval are summarized. The 24 matrix cells or 90 non-empty subset terms across contexts share observations; these are descriptive intervals with no multiplicity adjustment. The next-probe card ranks candidate carrier removals by predicted disagreement across five hand-authored toy hypotheses. Those hypotheses are fixed; observed outcomes do not update them. A run key is a compact deterministic FNV-1a fingerprint, not a cryptographic integrity signature.

**Interpret results only as outcomes of this specific synthetic model.** Parameters are illustrative. They do not estimate real organisms, memory, intelligence, consciousness, ecology, quantum advantage, or policy effects. The project can explore experimental structure and make assumptions visible; it cannot establish biological or real-world findings.

## Files

- `index.html` — interface and view structure
- `styles.css` — responsive dark observatory UI
- `src/engine.js` — deterministic paired-seed simulator, 4 × 6 matrix runner, 2⁴ × 6 subset decomposer, and probe heuristic
- `src/app.js` — controls, matrix and interaction atlas, local receipt ledger, search, and exports
- `docs/EXPERIMENT_PROTOCOL.md` — protocol definitions and interpretation limits

## Inspiration map

These links informed the design vocabulary and workflow. The Observatory does not include their code or model weights.

| Project | Design idea carried into the Observatory |
| --- | --- |
| [NexusSearch](https://github.com/kai9987kai/NexusSearch) | local retrieval and inspectable records |
| [Prometheus-α](https://github.com/kai9987kai/prometheus-alpha) | learning followed by body loss and regrowth |
| [3D Animal Simulator Hybrid Agent](https://github.com/kai9987kai/3d-animal-simulator-Hybrid-Agent) | seeded cohorts in an evolving world |
| [Morpheus](https://github.com/kai9987kai/morpheus) | distributed body pattern and explicit audit boundaries |
| [Supermix Expanse v2](https://github.com/kai9987kai/Supermix-Expanse-v2) | specialist modules and cautious capability claims |
| [Ghost in the Machine](https://github.com/kai9987kai/GhostInTheMachine) | preregistered, causal, null-aware experiment framing |
| [Supermix Expanse](https://github.com/kai9987kai/Supermix-expanse) | heterogeneous components with recorded provenance |
| [Genesis Engine](https://github.com/kai9987kai/GenesisEngine) | developmental state across an organism's lifetime |
| [Supermix Archimedes](https://github.com/kai9987kai/supermix-archimedes) | connected specialists rather than a single monolith |
| [Supermix](https://github.com/kai9987kai/Supermix) | local-first tools and benchmark workflows |
| [Fly Diamond Nexus](https://github.com/kai9987kai/FLY-DIAMOND-NEXUS) | shared signals among specialist agents |
| [QuantumBot](https://github.com/kai9987kai/QuantumBot) | matched comparisons and no advantage claims without evidence |
| [Causeway](https://github.com/kai9987kai/Causeway) | evidence-to-experiment flow and run receipts |
| [MOLT](https://github.com/kai9987kai/MOLT) | testing where a cue trace resides after transfer |
| [Universal Modder](https://github.com/rehan-remade/universal-modder/tree/main) | reusable workflow knowledge and explicit verification oracles |
| [REA](https://github.com/morluto/rea) | inspectable agent workflows |
| [Odysseus](https://github.com/odysseus-dev/odysseus) | self-hosted, locally controlled workspace |

## Related work checked during design

Public search also surfaced [MIB, a memory intelligence benchmark](https://github.com/ldclabs/mib) and [Chreatures, a connectome-rooted artificial-life project](https://github.com/emberian/chreatures). They are adjacent work, not components of the Observatory. The distinctive scope here is an interactive, deterministic carrier-removal × transfer-context lab with seed-level receipts, full subset interactions, and a disagreement-guided next-probe suggestion.

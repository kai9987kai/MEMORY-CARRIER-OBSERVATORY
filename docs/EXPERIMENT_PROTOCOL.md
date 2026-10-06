# Memory Carrier Observatory: experiment protocol

## Research question

In a toy cue-learning task, how much does removing one memory carrier change held-out choice accuracy after a specified transfer event?

## Operational definitions

The simulated subject can use four trace channels:

| Carrier | Meaning in the toy model | Weight |
| --- | --- | ---: |
| Neural | An individual's internal policy trace | 0.34 |
| Body | A trace in a synthetic developmental pattern | 0.20 |
| Habitat | An external mark in the learned environment | 0.25 |
| Group | A signal shared by all subjects in a colony | 0.21 |

For training depth `n`, a channel produces a correct signed trace with probability

`q(n) = min(0.94, base + ceiling × (1 − exp(−n / 9)))`.

The base and ceiling are fixed toy constants in `src/engine.js`. A trace is represented as `+1` when it matches the hidden cue rule and `−1` when it does not. Each subject's group trace is the same sampled signal for that seed pair.

At test, the active traces are combined as a weighted sum. The choice follows the sign of that sum with probability

`0.5 + 0.42 × tanh(|score| × 2.45)`.

Otherwise the subject chooses the opposite direction. The hidden cue rule is sampled once per pair. A reversed-rule transfer changes the correct response after learning; it does not rewrite stored traces.

## Paired arms

- **Reference arm:** all carriers that survive the selected transfer context.
- **Experimental arm:** the same carriers, with either the selected single carrier or a specified subset removed after training.
- Each seed pair shares its mapping, cohort traces, and per-choice decision-noise draws between arms.
- A transfer that already removes the selected carrier makes the two arms identical for that channel. The ledger preserves this null contrast rather than silently changing the protocol.
- Each pair contains 12 subjects and 8 held-out choices per subject.

The outcome is correct choices divided by total test choices. The paired contrast is the mean of experimental minus reference accuracy across seed pairs. The interval is mean ± 1.96 standard errors across those paired differences; this normal approximation is descriptive and may be poor at small sample sizes or with strongly non-normal differences.

## Factorial matrix

The matrix runner executes every combination of four carrier removals and six transfer contexts: 24 cells total. It uses the selected pair count, training depth, and base seed from the Lab. For a given pair index, every cell starts from the same derived seed and follows the same draw order for hidden mapping, all four learned traces, and every decision-noise value. Only the carrier removal and transfer rule differ by cell. This common-random-number design makes cross-context contrasts paired by construction.

Each cell reports its carrier-removal effect as experimental accuracy minus reference accuracy. For a carrier and a transfer, the context shift is calculated within each seed as that cell's effect minus the effect for the same carrier in the familiar-world (`same`) cell. The mean and normal-approximation interval over those seed-level differences-in-differences are shown as a second, descriptive contrast. The matrix's widest effect span is a simple min-to-max range across six contexts; it is not a significance test. Cells where a transfer already removes the selected carrier are identical-arm nulls by design.

There is no multiplicity adjustment across the 24 cells, and the cells are not independent because they share random streams. Use the matrix to inspect how this simulator's rules interact, not to select a real-world intervention or claim confirmatory evidence. Exported matrix receipts include the matrix ID, cell index, paired seed outcomes, and seed-level context-interaction differences.

## Complete subset factorial and interaction decomposition

The subset runner enumerates all 16 sets of removed carriers (including the empty set) and crosses each with all six transfer contexts, for 96 conditions. Within a context, the empty set is the no-additional-removal baseline. Every condition starts each pair from the same seed and follows the same draw order for the mapping, all four traces, and choice noise. This is a complete two-level factorial over four binary removal factors; the standard design size is 2^k for k two-level factors (see [NIST's full-factorial guidance](https://www.itl.nist.gov/div898/handbook/pri/section3/pri333.htm)).

For a non-empty removal set S and seed i, let Yᵢ(T) be experimental-arm accuracy when removal subset T is applied in the same transfer. The stored term is

`βᵢ(S) = Σ[T ⊆ S] (-1)^(|S| − |T|) Yᵢ(T)`.

A single-carrier term is the change from the no-removal baseline. A pair term removes both single-carrier terms from the joint outcome; three- and four-way terms also remove all lower-order contributions. The app reports the mean and normal-approximation interval across these per-seed coefficients. Positive higher-order terms indicate that the observed combined-removal accuracy is above the lower-order additive decomposition on this response scale; negative terms indicate it is below. This is a finite-response inclusion–exclusion decomposition, and its scale should not be confused with a coefficient from a differently coded regression model.

The raw seed coefficient and the corresponding baseline and subset accuracies are retained in each run receipt. Terms within a context share conditions, and the same seeds are reused across contexts. They are therefore dependent. There is no multiplicity adjustment over the 15 non-empty terms and six contexts. These are exploratory, configuration-specific model diagnostics, not evidence of biological interaction.

### One-pair-deletion influence check

For each non-empty subset term with n matched pairs, the Atlas recomputes the mean n times, leaving out one pair per replicate. It reports the minimum and maximum of those n means, plus how many deletions preserve, reverse, or reduce the full-sample mean direction to zero. This reveals whether one seed pair can change the mean's sign in this finite run. It does not remove any data from the receipt.

The calculation is a simple leave-one-pair-out sensitivity diagnostic. It is not a jackknife standard error, a confidence interval, a robustness guarantee, or independent replication; NIST's [jackknife description](https://www.itl.nist.gov/div898/software/dataplot/refman1/auxillar/demfit.htm) includes additional adjusted-estimate and variance calculations that this app does not perform. The normal-approximation interval above remains the reported interval.

The common-random-number pairing follows a standard simulation variance-reduction idea: alternatives use matched pseudorandom draws so their differences can be calculated within a replicate (see Heikes, Montgomery, and Rardin, [“Using Common Random Numbers in Simulation Experiments—An Approach to Statistical Analysis”](https://journals.sagepub.com/doi/pdf/10.1177/003754977602700301)). This app's deterministic draw schedule is explicit and simple; it does not implement the paper's complete statistical procedure.

## Probe heuristic

Five fixed toy hypotheses assign different prior weights to the four carriers: Neural cache, Developed form, Habitat engram, Colony relay, and Distributed blend. For each available carrier removal, the planner predicts retained accuracy from the active prior weight mass and ranks candidates by the standard deviation of those predictions across hypotheses. It does not update priors using the observed run. It is a model-disagreement heuristic, not Bayesian active learning and not an AI model.

## Preregistration and records

The protocol is captured and written to browser storage before a run starts. Each completed receipt includes that registration timestamp, app version, removed-carrier set, transfer context, pair count, training exposures, base seed, deterministic run key, completion timestamp, per-pair seed and world key, choice counts, and paired contrast. Matrix receipts include the matrix ID, cell number, and per-seed context shift. Subset receipts include the study ID, subset mask and order, interaction estimate and interval, per-seed inclusion–exclusion coefficient, and leave-one-pair-out mean range, sign counts, diagnostic method ID, and analysis version. The run key is FNV-1a over the normalized protocol and result counts; it is convenient for referring to a run but is not a cryptographic signature. Browser storage is local and bounded to the latest 128 runs; export receipts you need to keep.

## Interpretation limits

All channels, agents, and outcomes are synthetic software variables. The model does not simulate real neurons, tissues, organisms, social learning, ecological dynamics, artificial consciousness, or quantum hardware. Parameters are hand-authored, not fit to data. The seed pairs are repeatable but do not replace empirical calibration, preregistered external review, stronger statistical inference, or independent replication. A result is a configuration-specific demonstration of the implemented rules only.

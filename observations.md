# Observations

## Context

I wanted a portfolio project that went beyond a notebook — something with a real inference pipeline behind a UI, an auth layer, and a knowledge base a non-trivial number of people could actually query. The constraint was that I didn't have access to real patient data, so the entire symptom-disease-medicine-test knowledge base had to be hand-authored as structured text and the ML model trained on synthetic samples derived from it. That constraint shaped almost every downstream decision, including how I evaluate and talk about the model's accuracy.

---

## Design decisions

- **Decision:** Store the knowledge base in Neo4j (graph) rather than a relational or document store.
  **Alternative considered:** Flat JSON/MongoDB documents keyed by disease.
  **Reasoning:** The domain is naturally a graph — diseases connect to symptoms, medicines, and tests with edge properties (severity, probability, dosage tier). Cypher queries for "all symptoms of top-4 candidate diseases" are direct graph traversals instead of manual joins across nested documents.

- **Decision:** Load the entire graph into an in-memory `TABLES` dict at Flask startup instead of querying Neo4j per request.
  **Alternative considered:** Query Neo4j on every `/api/diagnose` call.
  **Reasoning:** The knowledge base is small (104 diseases, 165 symptoms) and changes rarely. Loading once at startup avoids a network round-trip to Neo4j Aura on every diagnosis request, which matters more on a serverless deployment where cold starts already add latency.

- **Decision:** Train the Random Forest classifier at server startup rather than persisting a trained model artifact.
  **Alternative considered:** Train offline, pickle the model, load the pickle at startup.
  **Reasoning:** Training takes under a second on this dataset size (4,160 samples, 165 features), so the startup cost is negligible and this guarantees the model is always in sync with whatever is currently in Neo4j — no risk of a stale pickle after a knowledge-base update.

- **Decision:** Two-step diagnosis flow (narrow to top-4, then re-score on a confirmed symptom set) instead of a single-shot prediction.
  **Alternative considered:** One form with all symptoms, one RF call, one output.
  **Reasoning:** A single vague symptom set (e.g. "fever, fatigue") maps to dozens of plausible diseases with genuinely low confidence. Splitting into two passes lets the second pass collect the specific symptoms that actually discriminate between the leading candidates, which is closer to how a real differential-diagnosis conversation narrows down.

- **Decision:** Random Forest over the six other models evaluated in `model_evaluation.py`.
  **Alternative considered:** Decision Tree, MLP, SVM (RBF), Naive Bayes, KNN, Logistic Regression — all benchmarked with 5-fold stratified CV.
  **Reasoning:** RF had the best CV accuracy (0.9363 ± 0.0076) and doesn't require feature scaling, unlike SVM/KNN/Logistic Regression, which matters because symptom severity is already on an interpretable 0–3 scale I didn't want to normalize away.

- **Decision:** Synthetic sample generation via Gaussian noise injection + random symptom dropout, rather than training directly on the 104 base disease vectors.
  **Alternative considered:** Train RF on just the 104 base vectors (one per disease).
  **Reasoning:** 104 samples for 104 classes is one example per class — no classifier can generalize from that. Injecting noise (σ=0.3) on severity and randomly zeroing ~20% of symptoms per synthetic sample simulates the reality that patients don't present with every textbook symptom at the textbook severity, giving the RF something to actually learn a decision boundary from.

---

## What didn't work

- Initially considered blending RF probability scores with a separate hand-weighted Bayesian-style symptom-overlap scorer, on the theory that combining a learned model with a rule-based one would be more robust. I never actually finished implementing the blend — the RF alone performed well enough in `model_evaluation.py` that the added complexity wasn't justified, and the README had drifted to describe a blended system that didn't exist in the code. Removed that claim rather than half-build it.
- Tried running the knowledge-base loader scripts (`src/diseases_knowledge.py` etc.) with hardcoded credentials as a fallback default so they'd "just work" without a `.env` file during early development. This is exactly the kind of shortcut that turns into a real liability the moment the repo is public — pulled the fallbacks and made all three scripts fail loudly if `backend/.env` isn't populated.

---

## Technical challenges and how they were resolved

- **CSV/text parsing for the knowledge base:** the raw `data/knowledge.txt` format (`Disease has symptoms Symptom:weight:probability, ...`) is hand-authored and fragile — a malformed `symptom:weight:probability` triple silently corrupted the graph load in early iterations. Fixed by having `diseases_knowledge.py` validate the triple count and float-parse each field per symptom, printing and skipping any malformed pair instead of failing the whole file.
- **Neo4j SSL handshake failures locally:** `neo4j+s://` URIs from Neo4j Aura would intermittently fail SSL handshake in local dev. Resolved by normalizing any `neo4j+s://` URI to `neo4j+ssc://` (skip certificate verification) at connection time in every script that opens a driver — not a production-grade fix, but appropriate for a single-tenant hobby-tier Aura instance.
- **Vercel serverless + Flask:** Vercel's `@vercel/python` runtime expects a module-level WSGI `app` callable, not a running server. `api/index.py` exists purely to add `backend/` to `sys.path` and re-export `app` from `backend/app.py` — the actual Flask app and its Neo4j/Mongo startup logic run once, at import time, when Vercel cold-starts the function.
- **Frontend receiving non-JSON error bodies:** unhandled Flask exceptions (e.g. Neo4j timeout) were returning HTML stack traces that the React frontend couldn't render, crashing the UI on backend errors. Fixed with a global Flask `@app.errorhandler(Exception)` that guarantees every error path returns `{"error": "..."}` as JSON.

---

## Limitations

- The Random Forest is trained entirely on synthetic, noise-augmented samples generated from 104 hand-authored disease-symptom vectors — it has never seen real patient data, and the 0.9363 cross-validation accuracy reflects how well it recovers the synthetic generating process, not real-world diagnostic accuracy. The 1.00 "overall accuracy" figure in `Model_Selection_Report.md` is training accuracy on the full synthetic set (the model fit and evaluated on the same data), not a held-out score — it should not be read as evidence of real diagnostic performance.
- The knowledge base (104 diseases, 165 symptoms, medicine dosages) was manually authored, not sourced from a validated medical database — accuracy of any individual disease-symptom-medicine mapping hasn't been clinically verified.
- Step 2 of diagnosis only re-ranks within the top-4 candidates from step 1; if the correct disease wasn't in that initial top-4, it can never be surfaced, however strongly the additional symptoms point to it.
- No rate limiting or input sanitization beyond regex format checks on signup fields; not hardened for public deployment beyond a portfolio demo.
- Single Neo4j/Mongo instance, no caching layer, no load testing — startup graph load and RF training happen on every serverless cold start, which is fine at hobby scale but wouldn't hold up under real traffic.

---

## Numbers that matter

| Metric | Value |
|---|---|
| Diseases in knowledge base | 104 |
| Unique symptoms | 165 |
| Medicine records (knowledge_medicines.txt lines) | 758 |
| Synthetic training samples | 4,160 (40 per disease) |
| Feature vector dimension | 165 (one per symptom) |
| Synthetic sample noise | Gaussian, σ = 0.3, clipped to [0, 3] |
| Synthetic symptom dropout | ~20% of symptoms zeroed per sample |
| Model | Random Forest, 200 estimators (production) / 100 estimators (evaluation benchmark) |
| CV accuracy (Random Forest, 5-fold stratified) | 0.9363 ± 0.0076 |
| CV accuracy (Naive Bayes, 2nd best) | 0.9233 ± 0.0044 |
| CV accuracy (Neural Network / MLP) | 0.9139 ± 0.0070 |
| CV accuracy (Logistic Regression) | 0.9050 ± 0.0100 |
| CV accuracy (SVM, RBF kernel) | 0.8986 ± 0.0097 |
| CV accuracy (KNN, k=5) | 0.8921 ± 0.0144 |
| CV accuracy (Decision Tree) | 0.1293 ± 0.0084 |
| Diagnosis narrowing (step 1) | Top-4 candidate diseases from full 104-class prediction |
| Repo size | ~2,630 lines of Python + JS across 38 tracked files |

---

## Possible extensions

- Finish the Bayesian-style symptom-overlap scorer as an actual second signal and blend it with the RF probability output, rather than leaving it as an abandoned idea.
- Replace the hand-authored knowledge base with mappings sourced from a licensed medical ontology (e.g. SNOMED CT, UMLS) to make disease-symptom-medicine relationships clinically defensible rather than self-authored.
- Add a held-out test split to the model evaluation pipeline instead of relying solely on cross-validation over the synthetic set, and report both together so the accuracy figures can't be read as validation on unseen real cases.
- Persist diagnosis history per user (the frontend already tracks per-user diseases; a full session log would let step-1/step-2 choices be reviewed later).
- Add basic rate limiting and stricter input validation ahead of any deployment beyond a demo.

---

## Figures

- `screenshots/welcome.png` — landing page, entry point before authentication.
- `screenshots/screenshot_signup.png` — registration form with client- and server-side field validation (username, DOB, 11-digit contact format).
- `screenshots/screenshot_diagnosis1.png` — step 1 of the diagnosis flow: initial symptom entry.
- `screenshots/screenshot_diagnosis2.png` — step 2: additional discriminating symptoms surfaced from the top-4 RF candidates.
- `screenshots/screenshot_report.png` — final diagnostic report: predicted disease, age-tiered medicine dosages, suggested tests.
- `screenshots/screenshot_profile.png` — user profile showing tracked diseases with cure status.

---

## What I learned

- Cross-validation accuracy on a synthetic dataset generated from the same rules the model is meant to learn will always look better than the number means in practice — I underestimated how easy it is for a README or report to state a CV score without the caveat that the ground truth itself was synthetically generated, and how misleading that reads to someone auditing the project cold.
- Letting scripts fall back to hardcoded default credentials "just so they run without a `.env` file" during early development is a habit that's easy to justify in the moment and easy to forget to remove before the code becomes public. Environment variables should fail loudly when absent, not silently substitute a real credential.
- Splitting a single-shot classification into a two-stage narrow-then-confirm flow measurably changes what "accuracy" even means for the product — the model's job in step 2 isn't "predict the right disease out of 104," it's "predict the right disease out of 4," which is a much easier and more honest framing of what the UI actually promises the user.

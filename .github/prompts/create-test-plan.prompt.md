---
name: create-test-plan
description: Analyzes features and generates declarative, high-integrity Gherkin test plans.
agent: agent
argument-hint: "Input a feature name or description. I will perform a deep analysis and generate a maintainable Gherkin specification."
---

# Instructions

For the purpose of this task, you should act like a **Senior BDD Architect and Quality Lead**. Your objective is to transform requirements into a robust, declarative test plan using Gherkin that serves as "Living Documentation."

## 📚 Foundational Standards

You must base all logic and formatting on the principles described in:
* **"Specification by Example"** (Gojko Adzic): Focus on business outcomes over scripts.
* **"The Cucumber Book"** (Matt Wynne & Aslak Hellesøy): Adhere to the declarative style.
* **"Writing Great Specifications"** (Kamil Nicieja): Ensure clarity and ubiquitous language.

---

## Phase 1: Deep Analysis (Mandatory)

Before writing the Gherkin file, you must perform a "Deep Dig" analysis. Output this in a section titled `### 🧠 Phase 1: Strategic Analysis`.

**Requirement for Agentic Development:** In an environment where AI agents may iterate on code, this specification must act as the **Immutable Anchor**.

1. **The Three Amigos Critique:**
   * **Product:** What is the core business rule? (Identify the "Happy Path").
   * **Developer:** What are the technical boundaries or state requirements?
   * **Tester:** Identify 3-5 high-risk edge cases, race conditions, or failure modes (e.g., partial successes, network timeouts, invalid state transitions).

2. **Assumption Mapping:** List any assumptions you are making about the system's current state.

---

## Phase 2: The Declarative Constraint (Anti-Fragility)

The Gherkin should describe the *What*, not the *How*.

* **Avoid steps that primarily encode UI mechanics or specific sample data as the essence of the behavior.**
  * Imperative/data-heavy phrasing tends to couple specs to incidental details.
  * Prefer behavior-oriented phrasing that remains stable as implementation evolves.

Examples:
* **Imperative/Data-Heavy:** "When I add 1 and 1 in the input fields, Then I should see 2."
* **Declarative/Abstracted:** "When the user calculates the sum of two integers, Then the result should reflect the correct mathematical total."

---

## Phase 3: First-Pass Feature File Generation (Breadth)

Generate an initial, maintainable Gherkin specification that covers the feature at a high-integrity “first pass” level.

Formatting rules:
1. **Pathing:** Save to `specs/<feature-name>/<feature-name>.feature`.
2. **Structure:**
   * **Feature:** Clear, value-oriented title.
   * **Background:** Use only for shared preconditions (e.g., "Given the service is initialized").
   * **Rule:** (Optional) Use to group scenarios under specific business policies.
   * **Scenario Outline:** Use this only if multiple data variations are required to prove a rule, while keeping steps abstract.
3. **Third-Person:** Use a consistent third-person perspective (e.g., "The user," "The system").

Output requirements for this phase:
- Produce a concise set of scenarios that prove the happy path and major business rules.
- Include the most important negative paths and integrity constraints, without overfitting to implementation details.

---

## Phase 4: Second-Pass Refinement (Depth Iteration)

After completing the first-pass feature file, perform a second iteration that deepens coverage scenario-by-scenario.

Output this in a section titled: `### 🔍 Phase 4: Depth Iteration`.

Process:
1. **Scenario Review:** For each scenario (or each Rule group), briefly restate the intent in one line.
2. **Subtle Expansion:** Propose additional scenarios that are *subtle* and *high-signal*, such as:
   - Boundary conditions (limits, thresholds, size/length, min/max)
   - State transitions and invalid state transitions
   - Permissions/roles and policy-driven behavior differences
   - Concurrency/race conditions (when applicable)
   - Partial failures and recovery behavior (when applicable)
   - Idempotency/retries/deduplication (when applicable)
   - Time-based behavior (expiration, ordering, clocks) where relevant
   - Observability/integrity expectations (auditability, consistency, invariants), expressed behaviorally
3. **Maintain the Declarative Style:** Keep steps describing behavior, not UI mechanics. Use Scenario Outline only when it meaningfully proves a rule across variations.

Then:
- Merge the best additions into an updated Gherkin file.
- Keep the result readable and maintainable (prefer fewer, higher-value scenarios over exhaustive combinations).

---

## Output Format

Return the following sections **in this exact order**:
1. `### 🧠 Phase 1: Strategic Analysis`
2. `### 🧾 Phase 3: First-Pass Gherkin`
3. `### 🔍 Phase 4: Depth Iteration` (review + additions)
4. `### ✅ Final Gherkin`

**CRITICAL – machine-parsed section:** The final section MUST follow this exact format or the pipeline will fail:

```
### ✅ Final Gherkin

`specs/<feature-name>/<feature-name>.feature`

```gherkin
Feature: ...
  ...
```
```

Rules:
- The section header must be exactly `### ✅ Final Gherkin` (no suffix like "Updated").
- The file path must be on its own line, wrapped in backticks, e.g. `` `specs/check-pending-test/check-pending-test.feature` ``.
- The Gherkin content must be inside a fenced code block tagged `gherkin`.
- Do NOT place any prose between the file path line and the opening of the code fence.

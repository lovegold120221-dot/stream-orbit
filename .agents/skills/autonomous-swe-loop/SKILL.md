---
name: autonomous-swe-loop
description: "High-performance engineering loop with repository-wide awareness and self-correction. Use when building features or fixing bugs to ensure structural integrity and 100% build success."
---

# Autonomous SWE Loop

> Repo Map → Edit → Lint → Test → Verify

## Language

All process output to user follows the user's language.

## Objective

Deliver a verified, structurally sound code change by maintaining global codebase awareness and iteratively fixing errors before they reach the main branch.

## Prerequisites

- `scripts/generate_repo_map.py` exists and is functional.
- Project-specific linting (`npm run lint`, `ruff check`) and testing (`npm test`, `pytest`) commands are identified.

## Capability Components

### 1. Global Awareness (Pre-flight)

Before any significant change, generate a repo map to understand dependencies and architectural patterns:

```bash
python scripts/generate_repo_map.py .
```

### 2. Surgical Edit (The Action)

When editing files, follow these rules:
- **Bounded Reads:** Use `read_file` with `start_line` and `end_line` to avoid context flooding.
- **Atomic Changes:** One file edit per turn using `replace`.
- **Lint Immediately:** After every edit, run the relevant linter for that file.

### 3. Self-Correction (The Feedback)

If a linting or build error occurs:
1. **Analyze:** Read the error output carefully.
2. **Contextualize:** Use the repo map to see if the error is caused by a broken dependency elsewhere.
3. **Fix:** Apply the fix and re-run lint/test.
4. **Iterate:** Repeat until the file passes all local checks.

### 4. Verification (Finality)

A task is only complete when:
1. **Build Passes:** `npm run build` or equivalent.
2. **Tests Pass:** New and existing tests relevant to the change pass.
3. **Types Check:** No TypeScript or Python type errors introduced.

## Execution Efficiency

- **Parallel Validation:** Run linting and testing in parallel where independent.
- **Context Management:** Refresh the repo map if significant structural changes (new files, refactors) are made.

## Typical Workflow

1. `python scripts/generate_repo_map.py .` -> Absorb architecture.
2. `replace` file A -> Implement change.
3. `ruff check .` -> Verify Python lint.
4. `pnpm build` -> Verify frontend build.
5. `uv run pytest` -> Verify agent logic.
6. `Final Report` -> Summarize success.

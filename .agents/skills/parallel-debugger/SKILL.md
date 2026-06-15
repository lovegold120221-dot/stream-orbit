---
name: parallel-debugger
description: "Multi-threaded autonomous debugging using the Mother/Scenario pattern. Use when a bug is difficult to isolate or has multiple potential root causes."
---

# Parallel Debugger

> Hypothesize → Branch → Test → Synthesize

## Language

All process output to user follows the user's language.

## Objective

Identify the root cause of a bug and validate a fix by exploring multiple hypotheses in parallel isolated environments.

## Prerequisites

- `scripts/parallel_debug.sh` exists and is executable.
- The repository is a Git repository with a clean state.

## Capability Components

### 1. The Mother Agent (Orchestration)

When a bug is reported:
1. **Analyze:** Read logs, stack traces, and relevant code.
2. **Hypothesize:** Generate 3-5 distinct hypotheses about the root cause.
3. **Dispatch:** Invoke a sub-agent for each hypothesis using `invoke_agent`.

### 2. The Scenario Agent (Investigation)

Each sub-agent follows this workflow:
1. **Isolate:** Run `scripts/parallel_debug.sh start <hypo_id>`.
2. **Experiment:** Apply a targeted change to test the hypothesis.
3. **Verify:** Run `scripts/parallel_debug.sh verify <hypo_id> "<test_cmd>"`.
4. **Cleanup:** Run `scripts/parallel_debug.sh cleanup <hypo_id>`.
5. **Report:** Return a summary of the result (Success/Failure + Evidence).

### 3. Synthesis

The Mother Agent collects all sub-agent reports:
1. **Discard:** Ignore hypotheses that failed to reproduce or fix the bug.
2. **Evaluate:** Compare successful fixes for side effects and architectural fit.
3. **Finalize:** Apply the winning fix to the main branch and run full verification.

## Execution Efficiency

- **High Concurrency:** Dispatch all sub-agents in a single turn using parallel `invoke_agent` calls.
- **Resource Management:** Sub-agents MUST cleanup their branches to prevent repository clutter.

## Typical Workflow

1. Mother: "I have 3 hypotheses for the timeout bug."
2. Mother: `invoke_agent(hypo-1)`, `invoke_agent(hypo-2)`, `invoke_agent(hypo-3)` in parallel.
3. Scenario 1: `start 1` -> `edit` -> `verify` -> `cleanup`.
4. Scenario 2: `start 2` -> `edit` -> `verify` -> `cleanup`.
5. Mother: "Scenario 2 succeeded. Applying fix."
6. Mother: `replace` -> `Final Report`.

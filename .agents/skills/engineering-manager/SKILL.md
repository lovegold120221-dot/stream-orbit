---
name: engineering-manager
description: "Virtual Engineering Squad orchestration. Use to coordinate specialized sub-agents for comprehensive code reviews and quality assurance."
---

# Engineering Manager

> Delegate → Audit → Review → Ship

## Language

All process output to user follows the user's language.

## Objective

Manage a squad of specialized AI agents to ensure that all code changes meet the highest standards of security, performance, and testing.

## Capability Components

### 1. Delegation (The Review Cycle)

After implementing a feature or fix:
1. **Prepare:** Summarize the changes made.
2. **Dispatch Specialists:** Invoke relevant sub-agents in parallel:
   - `invoke_agent("security-auditor", "Review these changes: ...")`
   - `invoke_agent("performance-checker", "Analyze these changes: ...")`
   - `invoke_agent("tdd-enforcer", "Check test coverage for: ...")`

### 2. Audit & Synthesis

Collect the reports from all specialists:
1. **Critical Review:** Identify any "Critical" or "High" risks.
2. **Blocked State:** If a specialist reports a failure (e.g., security vulnerability or missing tests), the task is **Blocked**.
3. **Remediation:** Implement the fixes recommended by the specialists.
4. **Re-audit:** Re-dispatch the relevant specialist to confirm the fix.

### 3. Final Approval

The Engineering Manager gives final approval only when:
1. All specialists report "Success" or "Low Risk".
2. Build and tests pass globally.
3. The repo map shows no unexpected architectural regressions.

## Execution Efficiency

- **Turn Compression:** Use parallel `invoke_agent` calls to get all reviews in a single turn.
- **Noise Reduction:** Sub-agents must return only concise summaries to keep the manager's context clean.

## Typical Workflow

1. Dev Agent: "Feature implemented. Calling the squad."
2. Manager: `invoke_agent(security)`, `invoke_agent(perf)`, `invoke_agent(tdd)`.
3. Security: "Found a hardcoded secret in config.ts." -> **Blocked**.
4. Dev Agent: `replace` -> Fixes secret.
5. Manager: `invoke_agent(security)` -> "Clean."
6. Manager: "All checks passed. Shipping."

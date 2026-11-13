# 19 — AI Coding Agent Workflow and Portability

## Works with different coding agents
This specification is not tied to Google AI Studio. Use it with Cursor, Claude Code, Codex, Gemini, Windsurf, or another repository-aware coding agent.

## First instruction
Ask the agent to:
1. Inspect the repository.
2. Identify framework, package manager, scripts, and current implementation.
3. Read `MASTER_BUILD_PROMPT.md` and all `docs/`.
4. Report conflicts or missing environment variables.
5. Propose a short implementation plan.
6. Then start implementing; do not stop at a plan.

## Work in small verified milestones
Ask the agent to implement one phase at a time. After each phase:
- Run the app.
- Run relevant tests.
- Inspect browser console/build output.
- Fix errors before moving on.
- Update PROMPT_LOG.md with real outcomes.

## Suggested reusable agent instruction

"Read MASTER_BUILD_PROMPT.md and all files under docs/. Treat them as the product contract. Inspect the existing repository before editing. Implement the next incomplete roadmap phase in working code. Preserve existing working functionality. Do not use placeholders for required actions. Run the application and relevant tests, fix failures, and report exact files changed, commands run, and remaining limitations. Do not claim a test passed unless you executed it."

## Tool-specific adaptation
- If the agent can run terminal commands, let it inspect/install/run/test using the repository's package manager.
- If the platform provides a preview but no terminal, use its available build/preview diagnostics and document unavailable tests.
- If the agent cannot access the filesystem, provide the complete project files or connect it to the repository.
- If a provider integration is unavailable, implement the interface and deterministic fallback rather than blocking the app.

## Avoid
- Asking an agent to generate the entire app in one enormous step without testing.
- Accepting static cards in place of functional workflows.
- Letting AI invent data to fill missing route/timetable records.
- Letting a model decide bus availability or operational approval.
- Replacing the stack without explaining why.
- Claiming successful testing without execution.

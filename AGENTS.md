# BATTLEGROUNDS

Project instructions and skill routing for agents working in this repository.

## Agent skills

### Issue tracker

GitHub Issues in `ksaeil2001/BATTLEGROUNDS-map-view` via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`GLOSSARY.md` at repo root and ADRs in `docs/adr/`). See `docs/agents/domain.md`.

## Skill usage policy

Select only the skill that matches the current task goal; run one targeted skill or workflow at a time rather than executing unrelated skills.

- **Model-invoked skills** (15 workspace skills in `.agents/skills/` + global `find-skills`): triggered automatically when task context matches their description (for example `tdd`, `code-review`, `codebase-design`, `diagnosing-bugs`, `domain-modeling`, `prototype`, `research`, `pr`, `writing-for-agents`).
- **User-invoked skills** (23 workflow/router skills in `.agents/skills/<name>/SKILL.md` marked `disable-model-invocation: true`): load on demand only when the user names them or a parent workflow directs to them. Use `ask-matt` when selecting the right flow.
- **Primary idea-to-ship flow**: `grill-with-docs` -> `to-spec` -> `to-tickets` -> `implement` / `implement-spec` (driving `tdd` and closing with `code-review`) -> `retro`.
- **Targeted on-ramps**: use `wayfinder` for multi-session greenfield mapping, `triage` for incoming issues, `diagnosing-bugs` for hard bugs or regressions, `prototype` for throwaway feasibility checks, and `research` for primary-source investigation.

## Development rules

- **Minimal footprint & file safety**: Preserve existing files and keep the directory structure lean; create files or directories only when required by the active task.
- **Deep modules (`codebase-design`)**: Hide internal complexity behind small, focused public interfaces at clean module seams.
- **Vertical TDD at agreed seams (`tdd`)**: Confirm public test seams with the user before writing tests; work one red-green vertical slice at a time.
- **Domain consistency (`domain-modeling`)**: Align code, test, and ticket terminology with `GLOSSARY.md` and `docs/adr/` once those files exist.

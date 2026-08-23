# Implementation Plans

Most plans implement one module from
`../specs/2026-08-23-baituna-modules-design.md`. One plan (the design system)
implements `../specs/2026-08-23-baituna-design-system.md` instead — it's a
frontend foundation, not a product module, and every page-building module
depends on it. Plans are written for an engineer with no prior context on
this codebase — read the plan's header and Global Constraints before starting.

## Order

Build order for backend modules follows the dependency graph in the modules
design doc §6. A module cannot start before the modules it consumes are
merged. The design system plan has no backend dependency and can be built in
parallel with any backend module, but any *page* (as opposed to API) work in
a module should wait for it, since it supplies the tokens and components
those pages use.

| # | Module | Plan | Depends on | Status |
| --- | --- | --- | --- | --- |
| 1 | Auth & RBAC | `2026-08-23-module-1-auth-rbac.md` | — | ready |
| 2 | Region Reference | `2026-08-23-module-2-region-reference.md` | — | ready |
| 3 | Mosque Registration & Approval | `2026-08-23-module-3-mosque-registration.md` | 1, 2, 7 | ready |
| 4 | Mosque Search & Detail | `2026-08-23-module-4-mosque-search.md` | — | ready |
| 5 | Person | not written yet | 1, 7 | pending |
| 6 | Friday Assignment | not written yet | 1, 5, 7 | pending |
| 7 | Audit Log | `2026-08-23-module-7-audit-log.md` | — | ready |
| M | Mobile modules | not written yet | matching backend module | pending |
| D | Web Design System | `2026-08-23-web-design-system.md` | — | ready |

Modules 1, 2, 4, 7, and D have no dependencies on each other and can be
worked in parallel.

## Writing the next plan

Plans are written one at a time, not all upfront — each one is more accurate
when the code it builds on already exists. Use the `superpowers:writing-plans`
skill, and read the module's section in the design doc plus the actual state of
`apps/web/server/` before writing.

# Implementation Plans

Each plan implements one module from
`../specs/2026-08-23-baituna-modules-design.md` and produces working, testable
software on its own. Plans are written for an engineer with no prior context on
this codebase — read the plan's header and Global Constraints before starting.

## Order

Build order follows the dependency graph in the design doc §6. A module cannot
start before the modules it consumes are merged.

| # | Module | Plan | Depends on | Status |
| --- | --- | --- | --- | --- |
| 1 | Auth & RBAC | `2026-08-23-module-1-auth-rbac.md` | — | ready |
| 2 | Region Reference | not written yet | — | pending |
| 3 | Mosque Registration & Approval | not written yet | 1, 2, 7 | pending |
| 4 | Mosque Search & Detail | not written yet | — | pending |
| 5 | Person | not written yet | 1, 7 | pending |
| 6 | Friday Assignment | not written yet | 1, 5, 7 | pending |
| 7 | Audit Log | not written yet | — | pending |
| M | Mobile modules | not written yet | matching backend module | pending |

Modules 1, 2, 4, and 7 have no dependencies on each other and can be worked in
parallel.

## Writing the next plan

Plans are written one at a time, not all upfront — each one is more accurate
when the code it builds on already exists. Use the `superpowers:writing-plans`
skill, and read the module's section in the design doc plus the actual state of
`apps/web/server/` before writing.

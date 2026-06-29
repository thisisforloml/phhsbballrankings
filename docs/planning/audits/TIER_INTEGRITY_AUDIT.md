# Tier Integrity Audit

**Generated:** 2026-06-18T13:00:10.461Z  
**Mode:** Read-only  
**Machine report:** `D:/Peach Basket/scripts/reports/tier-integrity-audit.json`

## Executive summary

**Recommendation:** **D** — Rating-impacting semantic defect: codebase and PHRANK requirements treat tier 4 as elite (highest weight), while stakeholder convention treats tier 1 as highest. Stored league tiers may be assigned with mixed mental models, and Formula v1 weights amplify higher numeric tiers.  
**Confidence:** HIGH

Stakeholder convention: **Tier 1 = highest**, **Tier 4 = lowest**.  
Codebase + `PHRANK_requirements.md`: **Tier 1 = Entry (lowest weight)**, **Tier 4 = Elite (highest weight)**.

Formula v1 applies `leagueWeight` at GPS compute time using the **codebase scale** (higher numeric tier → higher multiplier).

## A. Internal consistency

| Layer | Tier 1 meaning | Tier 4 meaning | Aligns with v1 weights? |
| --- | --- | --- | --- |
| User convention | Highest | Lowest | No (inverted) |
| `PHRANK_requirements.md` | Entry | Elite | Yes |
| Code labels (`player-profile.ts`, `CompetitionHistory.tsx`) | Entry | Elite | Yes |
| Formula v1 / TPI-v1 weights | 1.00× | 1.40× | Yes (4 = strongest multiplier) |
| Admin UI | Numeric 1–4 only | Numeric 1–4 only | Ambiguous (no legend) |

**DB vs stored GPS weights:** **Mismatch.** Stored `GamePerformanceScore.leagueWeight` is **1.000 for both tier 1 and tier 3** leagues (5,410 + 3,981 = 9,391 GPS rows). Formula v1 defines tier 3 → 1.25× and tier 1 → 1.00×, but `submission-post-import-processing.ts` hardcodes `leagueWeight: 1` on import. **Tier multipliers are not affecting live player ratings today**, despite `League.tier` being set on leagues.

**DB tier assignment pattern (observed):** Leagues appear assigned using the **stakeholder 1 = highest** mental model in part — UAAP/NCAA at **tier 1**, Stallion/PYBC at **tier 3** (not tier 2 as heuristic expected). No league uses tier 2 or tier 4. Under **code** labels, tier 1 displays as “Entry” (lowest) while holding the top competitions.

| Pattern | Implication |
| --- | --- |
| UAAP/NCAA @ tier 1 | Matches user “highest”; code calls it “Entry” (lowest weight if applied) |
| Stallion/PYBC @ tier 3 | User likely meant tier 2; code calls it “Competitive” (1.25× if applied) |
| All GPS `leagueWeight = 1` | Tier field is metadata-only for ratings until GPS path applies weights |

## B. Exposure analysis (user convention heuristic)

| Metric | Count |
| --- | ---: |
| Active leagues | 8 |
| Active games | 405 |
| Active GPS rows | 9391 |
| PlayerRating rows | 1057 |
| ProgramTeamRating rows | 66 |
| Leagues flagged vs user-expectation heuristic | 4 |
| Games in flagged leagues | 188 |
| GPS in flagged leagues | 3981 (42.39% of GPS) |

## C. Tier inventory summary

| DB Tier | Code label | If user 1=highest | v1 weight | User-aligned weight | Leagues | Games | GPS |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | Entry | Highest | 1 | 1.4 | 4 | 217 | 5410 |
| 2 | Developmental | Strong developmental | 1.1 | 1.25 | 0 | 0 | 0 |
| 3 | Competitive | Competitive regional | 1.25 | 1.1 | 4 | 188 | 3981 |
| 4 | Elite | Lowest | 1.4 | 1 | 0 | 0 | 0 |

## D. Key competitions

### UAAP

| League | DB Tier | Code Label | Age | Games | Expected (user 1=highest) |
| --- | ---: | --- | --- | ---: | ---: |
| UAAP Season 88 16U Boys Basketball | 1 | Entry | U16 | 60 | 1 |
| UAAP Season 88 HS Boys Basketball | 1 | Entry | U19 | 62 | 1 |
| UAAP Season 88 HS Girls Basketball | 1 | Entry | U19 | 14 | 1 |

### NCAA

| League | DB Tier | Code Label | Age | Games | Expected (user 1=highest) |
| --- | ---: | --- | --- | ---: | ---: |
| NCAA Season 101 Junior's Basketball | 1 | Entry | U19 | 81 | 1 |

### NBTC

| League | DB Tier | Code Label | Age | Games | Expected (user 1=highest) |
| --- | ---: | --- | --- | ---: | ---: |
| — | — | — | — | — | — |

### Stallion

| League | DB Tier | Code Label | Age | Games | Expected (user 1=highest) |
| --- | ---: | --- | --- | ---: | ---: |
| 6th Stallion Cup - 18U | 3 | Competitive | U19 | 25 | 2 |
| Stallion Cup – 17U | 3 | Competitive | U19 | 89 | 2 |

### PYBC

| League | DB Tier | Code Label | Age | Games | Expected (user 1=highest) |
| --- | ---: | --- | --- | ---: | ---: |
| Philippine Youth Basketball Championship – 13U | 3 | Competitive | U13 | 37 | 2 |
| Philippine Youth Basketball Championship – 15U | 3 | Competitive | U16 | 37 | 2 |

### JCIMBL

| League | DB Tier | Code Label | Age | Games | Expected (user 1=highest) |
| --- | ---: | --- | --- | ---: | ---: |
| — | — | — | — | — | — |

## E. Historical impact if corrected

| Scenario | Recompute scope |
| --- | --- |
| Docs/admin labels only | None |
| Re-number `League.tier` only (no GPS rewrite) | PlayerRating, snapshots, ProgramTeamRating |
| Re-number tiers + GPS recompute | GPS → PlayerRating → snapshots (+ team ratings) |
| Invert formula weights for future GPS only | Partial; mixed historical ratings |

## F. Recommendation detail

**Choice D:** Rating-impacting semantic defect: codebase and PHRANK requirements treat tier 4 as elite (highest weight), while stakeholder convention treats tier 1 as highest. Stored league tiers may be assigned with mixed mental models, and Formula v1 weights amplify higher numeric tiers.

### Evidence

- Requirements doc and implementation share one numbering model (1=Entry … 4=Elite).
- User/stakeholder model inverts that scale (1=Highest … 4=Lowest).
- **Live DB tier values look stakeholder-assigned** (UAAP/NCAA=1, circuit leagues=3) while **UI labels and formula weights follow the inverted code scale**.
- Admin tier field has no legend, enabling mixed assignment intent.
- GPS `leagueWeight` is persisted per row but **currently flat 1.0 on all 9,391 rows** — fixing weights without aligning numbering would change ratings materially.
- Enabling correct tier weights under the **current code scale** would **boost tier-3 circuit games** (1.25×) vs **tier-1 UAAP** (1.0×), worsening fairness if DB tiers were meant user-style.

### Remediation paths (planning only — not executed)

1. **Align convention** — Pick one scale (recommend: user 1=highest) and update docs, labels, weights, admin legend together.
2. **Reassign `League.tier`** — Map UAAP=1, Stallion/PYBC=2, etc. per agreed rubric.
3. **Recompute GPS** — Apply corrected `leagueWeight` per game from final tier map.
4. **Recompute PlayerRating + snapshots** (+ ProgramTeamRating if used publicly).

## G. Non-actions (this audit)

- No code changes
- No data writes
- No rating/snapshot recompute
- No migrations

---

*End of read-only tier integrity audit.*

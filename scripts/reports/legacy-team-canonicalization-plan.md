# Legacy Team Canonicalization Plan

Generated: 2026-06-01T13:33:48.529Z

Mode: dry-run / read-only. No data was changed.

## Summary

- totalLegacyTeams: 27
- AUTO_READY_ROSTER_ONLY: 5
- NEEDS_REVIEW_ROSTER_ONLY: 0
- AUTO_READY_GAME_AND_STATS: 0
- NEEDS_REVIEW_GAME_AND_STATS: 0
- KEEP_HISTORICAL_REFERENCE: 1
- SAFE_TO_DELETE_ZERO_REFERENCES: 2
- BLOCKED_NO_CANONICAL_TARGET: 18
- BLOCKED_AMBIGUOUS_TARGETS: 1

## Cleanup Path

- Step A: reassign safe PlayerTeamSeason rows.
- Step B: reassign safe Game/GameStat refs only when approved.
- Step C: after zero references remain, retire/delete/archive legacy Team.
- Step D: rerun Program Management audit.

## Candidates

### Adamson University / ADU Jrs (ADU)

- Recommendation: AUTO_READY_ROSTER_ONLY
- Rationale: Roster-only references have one same-season, same-age, same-gender target and no historical Game/GameStat references.
- References: roster 2, GameStats 0, game home/away 0
- Recommended target: Adamson Baby Falcons (28eaa2c2-be45-4de6-a030-acf090e0069c)

### Ateneo de Manila University / ATENEO JRS (ATENEO)

- Recommendation: AUTO_READY_ROSTER_ONLY
- Rationale: Roster-only references have one same-season, same-age, same-gender target and no historical Game/GameStat references.
- References: roster 1, GameStats 0, game home/away 0
- Recommended target: Ateneo Blue Eaglets (3e29df0f-062d-4e43-bb01-a3960fdcbb43)

### De La Salle Santiago Zobel / DE LA SALLE Jrs (DLSU)

- Recommendation: SAFE_TO_DELETE_ZERO_REFERENCES
- Rationale: Legacy/generic Team has no active roster, Game, or GameStat references.
- References: roster 0, GameStats 0, game home/away 0
- Recommended target: None

### De La Salle Santiago Zobel / De La Salle Zobel Junior Archers

- Recommendation: BLOCKED_NO_CANONICAL_TARGET
- Rationale: No same-Program canonical Team has enough same-season, same-age, same-gender, league, or player-overlap evidence.
- References: roster 0, GameStats 180, game home/away 15
- Recommended target: None
- Game refs: UAAP-S88-HSB-004, UAAP-S88-HSB-005, UAAP-S88-HSB-011, UAAP-S88-HSB-013, UAAP-S88-HSB-018, UAAP-S88-HSB-021, UAAP-S88-HSB-027, UAAP-S88-HSB-031, UAAP-S88-HSB-036, UAAP-S88-HSB-040, UAAP-S88-HSB-044, UAAP-S88-HSB-047, UAAP-S88-HSB-051, UAAP-S88-HSB-053, UAAP-S88-HSB-059

### De La Salle Santiago Zobel / De La Salle Zobel Junior Archers 16U

- Recommendation: BLOCKED_NO_CANONICAL_TARGET
- Rationale: No same-Program canonical Team has enough same-season, same-age, same-gender, league, or player-overlap evidence.
- References: roster 0, GameStats 176, game home/away 14
- Recommended target: None
- Game refs: UAAP-S88-16U-002, UAAP-S88-16U-008, UAAP-S88-16U-012, UAAP-S88-16U-015, UAAP-S88-16U-021, UAAP-S88-16U-023, UAAP-S88-16U-027, UAAP-S88-16U-032, UAAP-S88-16U-033, UAAP-S88-16U-037, UAAP-S88-16U-043, UAAP-S88-16U-049, UAAP-S88-16U-052, UAAP-S88-16U-053

### De La Salle Santiago Zobel / De La Salle Zobel Lady Junior Archers

- Recommendation: BLOCKED_AMBIGUOUS_TARGETS
- Rationale: Multiple candidate Teams tie at evidence score 3.
- References: roster 0, GameStats 63, game home/away 6
- Recommended target: None
- Game refs: UAAP-S88-HSG-002, UAAP-S88-HSG-004, UAAP-S88-HSG-005, UAAP-S88-HSG-007, UAAP-S88-HSG-009, UAAP-S88-HSG-011

### De La Salle Santiago Zobel / LA SALLE Jrs (LA SALLE)

- Recommendation: BLOCKED_NO_CANONICAL_TARGET
- Rationale: No same-Program canonical Team has enough same-season, same-age, same-gender, league, or player-overlap evidence.
- References: roster 15, GameStats 0, game home/away 0
- Recommended target: None

### Far Eastern University Diliman / FEU Jrs (FEU)

- Recommendation: AUTO_READY_ROSTER_ONLY
- Rationale: Roster-only references have one same-season, same-age, same-gender target and no historical Game/GameStat references.
- References: roster 3, GameStats 0, game home/away 0
- Recommended target: FEU - Diliman Baby Tamaraws (8f5d2b7d-e353-482f-8665-9f16e7c8290d)

### JMTG Medical Trading Infinite / JMTG Medical Trading Infinite

- Recommendation: BLOCKED_NO_CANONICAL_TARGET
- Rationale: No same-Program canonical Team has enough same-season, same-age, same-gender, league, or player-overlap evidence.
- References: roster 0, GameStats 106, game home/away 8
- Recommended target: None
- Game refs: G-2025-008, G-2025-013, G-2025-015, G-2025-019, G-2025-020, G-2025-024, G-2025-026, G-2025-032

### JPM-TEC San Beda / JPM-TEC San Beda

- Recommendation: KEEP_HISTORICAL_REFERENCE
- Rationale: Historical game/stat references may represent distinct team context (PYBC 15U). Keep unless separately approved.
- References: roster 0, GameStats 128, game home/away 9
- Recommended target: SBU U16 Boys (f2705e3c-8cb6-4c27-84e9-8941e6c8599a)
- Game refs: G-2025-007, G-2025-010, G-2025-016, G-2025-019, G-2025-021, G-2025-022, G-2025-027, G-2025-029, G-2025-033

### Lev Construction Full Potential / LEV Construction Full Potential

- Recommendation: BLOCKED_NO_CANONICAL_TARGET
- Rationale: No same-Program canonical Team has enough same-season, same-age, same-gender, league, or player-overlap evidence.
- References: roster 0, GameStats 85, game home/away 8
- Recommended target: None
- Game refs: G-2025-002, G-2025-004, G-2025-006, G-2025-010, G-2025-017, G-2025-020, G-2025-025, G-2025-031

### Lyceum of the Philippines University Cavite / LPU Junior Pirates

- Recommendation: BLOCKED_NO_CANONICAL_TARGET
- Rationale: No same-Program canonical Team has enough same-season, same-age, same-gender, league, or player-overlap evidence.
- References: roster 0, GameStats 160, game home/away 14
- Recommended target: None
- Game refs: NCAA-S101-JB-040, NCAA-S101-JB-046, NCAA-S101-JB-052, NCAA-S101-JB-059, NCAA-S101-JB-064, NCAA-S101-JB-066, NCAA-S101-JRB-001, NCAA-S101-JRB-007, NCAA-S101-JRB-013, NCAA-S101-JRB-019, NCAA-S101-JRB-026, NCAA-S101-JRB-030, NCAA-S101-JRB-035, NCAA-S101-JRB-044

### Migrafix Doc Boleros / Migrafix Doc Boleros

- Recommendation: BLOCKED_NO_CANONICAL_TARGET
- Rationale: No same-Program canonical Team has enough same-season, same-age, same-gender, league, or player-overlap evidence.
- References: roster 0, GameStats 129, game home/away 10
- Recommended target: None
- Game refs: G-2025-003, G-2025-006, G-2025-009, G-2025-013, G-2025-016, G-2025-018, G-2025-023, G-2025-031, G-2025-034, G-2025-036

### Migueluz Trading Moderno / Migueluz Trading Moderno

- Recommendation: BLOCKED_NO_CANONICAL_TARGET
- Rationale: No same-Program canonical Team has enough same-season, same-age, same-gender, league, or player-overlap evidence.
- References: roster 0, GameStats 110, game home/away 9
- Recommended target: None
- Game refs: G-2025-002, G-2025-005, G-2025-012, G-2025-015, G-2025-018, G-2025-022, G-2025-028, G-2025-030, G-2025-037

### National University Nazareth School / NU Jrs (NU)

- Recommendation: AUTO_READY_ROSTER_ONLY
- Rationale: Roster-only references have one same-season, same-age, same-gender target and no historical Game/GameStat references.
- References: roster 1, GameStats 0, game home/away 0
- Recommended target: NUNS Bullpups (0b191fd5-7d10-4496-8a2c-f75a0da3e7a3)

### Prime Ascencion Medical Supplies San Anton / Prime Ascencion Medical Supplies San Anton

- Recommendation: BLOCKED_NO_CANONICAL_TARGET
- Rationale: No same-Program canonical Team has enough same-season, same-age, same-gender, league, or player-overlap evidence.
- References: roster 0, GameStats 106, game home/away 9
- Recommended target: None
- Game refs: G-2025-003, G-2025-004, G-2025-011, G-2025-012, G-2025-014, G-2025-026, G-2025-027, G-2025-032, G-2025-035

### San Pedro Spartans / San Pedro Spartans

- Recommendation: BLOCKED_NO_CANONICAL_TARGET
- Rationale: No same-Program canonical Team has enough same-season, same-age, same-gender, league, or player-overlap evidence.
- References: roster 0, GameStats 153, game home/away 12
- Recommended target: None
- Game refs: G-2025-008, G-2025-011, G-2025-017, G-2025-021, G-2025-023, G-2025-028, G-2025-029, G-2025-033, G-2025-035, G-2025-036, G-2025-037, PYBC-DRAFT-4864a2c8

### Smile 360 Bullies / Smile 360 Bullies

- Recommendation: BLOCKED_NO_CANONICAL_TARGET
- Rationale: No same-Program canonical Team has enough same-season, same-age, same-gender, league, or player-overlap evidence.
- References: roster 0, GameStats 113, game home/away 9
- Recommended target: None
- Game refs: G-2025-005, G-2025-007, G-2025-009, G-2025-014, G-2025-024, G-2025-025, G-2025-030, G-2025-034, PYBC-DRAFT-4864a2c8

### University of Perpetual Help System DALTA / Perpetual Junior Daltas

- Recommendation: BLOCKED_NO_CANONICAL_TARGET
- Rationale: No same-Program canonical Team has enough same-season, same-age, same-gender, league, or player-overlap evidence.
- References: roster 0, GameStats 209, game home/away 15
- Recommended target: None
- Game refs: NCAA-S101-JB-049, NCAA-S101-JB-052, NCAA-S101-JB-057, NCAA-S101-JB-060, NCAA-S101-JB-069, NCAA-S101-JB-072, NCAA-S101-JRB-003, NCAA-S101-JRB-007, NCAA-S101-JRB-011, NCAA-S101-JRB-016, NCAA-S101-JRB-022, NCAA-S101-JRB-025, NCAA-S101-JRB-032, NCAA-S101-JRB-036, NCAA-S101-JRB-042

### University of Santo Tomas / UST Girls (UST)

- Recommendation: SAFE_TO_DELETE_ZERO_REFERENCES
- Rationale: Legacy/generic Team has no active roster, Game, or GameStat references.
- References: roster 0, GameStats 0, game home/away 0
- Recommended target: None

### University of Santo Tomas / UST Jrs (UST)

- Recommendation: AUTO_READY_ROSTER_ONLY
- Rationale: Roster-only references have one same-season, same-age, same-gender target and no historical Game/GameStat references.
- References: roster 1, GameStats 0, game home/away 0
- Recommended target: UST Tiger Cubs (d56b5b1a-62c0-4639-993d-b6c2fb15e923)

### University of the East / UE Jrs (UE)

- Recommendation: BLOCKED_NO_CANONICAL_TARGET
- Rationale: No same-Program canonical Team has enough same-season, same-age, same-gender, league, or player-overlap evidence.
- References: roster 16, GameStats 0, game home/away 0
- Recommended target: None

### University of the East / UE Junior Warriors

- Recommendation: BLOCKED_NO_CANONICAL_TARGET
- Rationale: No same-Program canonical Team has enough same-season, same-age, same-gender, league, or player-overlap evidence.
- References: roster 0, GameStats 191, game home/away 14
- Recommended target: None
- Game refs: UAAP-S88-HSB-001, UAAP-S88-HSB-007, UAAP-S88-HSB-012, UAAP-S88-HSB-016, UAAP-S88-HSB-019, UAAP-S88-HSB-023, UAAP-S88-HSB-027, UAAP-S88-HSB-029, UAAP-S88-HSB-033, UAAP-S88-HSB-037, UAAP-S88-HSB-044, UAAP-S88-HSB-048, UAAP-S88-HSB-049, UAAP-S88-HSB-054

### University of the East / UE Junior Warriors 16U

- Recommendation: BLOCKED_NO_CANONICAL_TARGET
- Rationale: No same-Program canonical Team has enough same-season, same-age, same-gender, league, or player-overlap evidence.
- References: roster 0, GameStats 147, game home/away 14
- Recommended target: None
- Game refs: UAAP-S88-16U-004, UAAP-S88-16U-005, UAAP-S88-16U-009, UAAP-S88-16U-013, UAAP-S88-16U-019, UAAP-S88-16U-023, UAAP-S88-16U-028, UAAP-S88-16U-031, UAAP-S88-16U-033, UAAP-S88-16U-039, UAAP-S88-16U-042, UAAP-S88-16U-045, UAAP-S88-16U-048, UAAP-S88-16U-054

### University of the Philippines Integrated School / UP Junior Fighting Maroons

- Recommendation: BLOCKED_NO_CANONICAL_TARGET
- Rationale: No same-Program canonical Team has enough same-season, same-age, same-gender, league, or player-overlap evidence.
- References: roster 0, GameStats 165, game home/away 14
- Recommended target: None
- Game refs: UAAP-S88-HSB-004, UAAP-S88-HSB-006, UAAP-S88-HSB-012, UAAP-S88-HSB-015, UAAP-S88-HSB-017, UAAP-S88-HSB-024, UAAP-S88-HSB-025, UAAP-S88-HSB-032, UAAP-S88-HSB-036, UAAP-S88-HSB-037, UAAP-S88-HSB-043, UAAP-S88-HSB-045, UAAP-S88-HSB-050, UAAP-S88-HSB-056

### University of the Philippines Integrated School / UP Junior Fighting Maroons 16U

- Recommendation: BLOCKED_NO_CANONICAL_TARGET
- Rationale: No same-Program canonical Team has enough same-season, same-age, same-gender, league, or player-overlap evidence.
- References: roster 0, GameStats 152, game home/away 14
- Recommended target: None
- Game refs: UAAP-S88-16U-003, UAAP-S88-16U-006, UAAP-S88-16U-009, UAAP-S88-16U-014, UAAP-S88-16U-018, UAAP-S88-16U-022, UAAP-S88-16U-027, UAAP-S88-16U-030, UAAP-S88-16U-035, UAAP-S88-16U-040, UAAP-S88-16U-042, UAAP-S88-16U-050, UAAP-S88-16U-051, UAAP-S88-16U-053

### University of the Philippines Integrated School / UPIS Jrs (UP)

- Recommendation: BLOCKED_NO_CANONICAL_TARGET
- Rationale: No same-Program canonical Team has enough same-season, same-age, same-gender, league, or player-overlap evidence.
- References: roster 14, GameStats 0, game home/away 0
- Recommended target: None


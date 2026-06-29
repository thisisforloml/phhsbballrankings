import { useState } from "react";
import {
  Search, ChevronUp, ChevronDown, ArrowRight,
  Bell, Menu, X, ChevronRight, SlidersHorizontal,
  Minus, CheckCircle, Clock, MapPin,
} from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip as RechartTooltip,
} from "recharts";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type View = "home" | "rankings" | "player" | "games" | "league" | "search";

// ─── DATA ─────────────────────────────────────────────────────────────────────

const PLAYERS = [
  {
    id: 1, name: "Kai Santos", position: "PG", school: "UST Growling Tigers", schoolShort: "UST",
    year: "3rd Year", height: `6'1"`, heightCm: "185 cm", weight: "175 lbs", hometown: "Quezon City",
    rank: 1, prevRank: 3, rating: 94, ppg: 18.4, rpg: 4.2, apg: 6.8, spg: 1.9, bpg: 0.3,
    fg: 47.2, threePct: 38.5, ft: 82.1, per: 24.3, gp: 14,
    image: "https://images.unsplash.com/photo-1546519638405-a2e41bc3a3c9?w=400&h=500&fit=crop&auto=format",
    verified: true, recruitingStatus: "Uncommitted",
    strengths: ["Court Vision", "Ball Handling", "Clutch Performer"],
    recentForm: [
      { game: "vs DLSU", pts: 22, reb: 5, ast: 8, result: "W" },
      { game: "vs FEU", pts: 15, reb: 3, ast: 6, result: "W" },
      { game: "vs UP", pts: 28, reb: 4, ast: 9, result: "W" },
      { game: "vs ADMU", pts: 19, reb: 4, ast: 5, result: "L" },
      { game: "vs NU", pts: 24, reb: 6, ast: 7, result: "W" },
    ],
    rankHistory: [
      { wk: "Wk1", rank: 5 }, { wk: "Wk2", rank: 4 }, { wk: "Wk3", rank: 3 },
      { wk: "Wk4", rank: 3 }, { wk: "Wk5", rank: 2 }, { wk: "Wk6", rank: 1 },
    ],
    analytics: [
      { skill: "Scoring", value: 88, fullMark: 100 }, { skill: "Playmaking", value: 94, fullMark: 100 },
      { skill: "Defense", value: 78, fullMark: 100 }, { skill: "Athleticism", value: 85, fullMark: 100 },
      { skill: "Shooting", value: 82, fullMark: 100 }, { skill: "IQ", value: 96, fullMark: 100 },
    ],
    percentiles: { scoring: 91, playmaking: 96, defense: 74, shooting: 83, athleticism: 87 },
  },
  {
    id: 2, name: "Marco Dela Cruz", position: "SF", school: "Ateneo Blue Eagles", schoolShort: "ADMU",
    year: "4th Year", height: `6'5"`, heightCm: "196 cm", weight: "205 lbs", hometown: "Manila",
    rank: 2, prevRank: 2, rating: 91, ppg: 21.3, rpg: 7.8, apg: 3.1, spg: 1.4, bpg: 0.8,
    fg: 52.1, threePct: 34.2, ft: 74.8, per: 22.1, gp: 14,
    image: "https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=400&h=500&fit=crop&auto=format",
    verified: true, recruitingStatus: "Batang Gilas Pool",
    strengths: ["Athleticism", "Mid-Range Game", "Leadership"],
    recentForm: [
      { game: "vs NU", pts: 24, reb: 8, ast: 3, result: "W" },
      { game: "vs FEU", pts: 18, reb: 9, ast: 2, result: "W" },
      { game: "vs UST", pts: 21, reb: 7, ast: 4, result: "L" },
      { game: "vs DLSU", pts: 25, reb: 6, ast: 3, result: "W" },
      { game: "vs UP", pts: 19, reb: 8, ast: 2, result: "W" },
    ],
    rankHistory: [
      { wk: "Wk1", rank: 3 }, { wk: "Wk2", rank: 3 }, { wk: "Wk3", rank: 2 },
      { wk: "Wk4", rank: 2 }, { wk: "Wk5", rank: 2 }, { wk: "Wk6", rank: 2 },
    ],
    analytics: [
      { skill: "Scoring", value: 93, fullMark: 100 }, { skill: "Playmaking", value: 72, fullMark: 100 },
      { skill: "Defense", value: 84, fullMark: 100 }, { skill: "Athleticism", value: 96, fullMark: 100 },
      { skill: "Shooting", value: 76, fullMark: 100 }, { skill: "IQ", value: 88, fullMark: 100 },
    ],
    percentiles: { scoring: 94, playmaking: 71, defense: 84, shooting: 76, athleticism: 97 },
  },
  {
    id: 3, name: "Josh Reyes", position: "C", school: "La Salle Green Archers", schoolShort: "DLSU",
    year: "3rd Year", height: `6'9"`, heightCm: "206 cm", weight: "240 lbs", hometown: "Cebu City",
    rank: 3, prevRank: 1, rating: 89, ppg: 14.8, rpg: 11.2, apg: 1.8, spg: 0.9, bpg: 2.4,
    fg: 61.3, threePct: 0, ft: 58.2, per: 21.4, gp: 13,
    image: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&h=500&fit=crop&auto=format",
    verified: true, recruitingStatus: "Uncommitted",
    strengths: ["Rim Protection", "Rebounding", "Post Scoring"],
    recentForm: [
      { game: "vs UST", pts: 12, reb: 14, ast: 1, result: "L" },
      { game: "vs ADMU", pts: 18, reb: 10, ast: 2, result: "L" },
      { game: "vs UP", pts: 14, reb: 12, ast: 1, result: "W" },
      { game: "vs NU", pts: 11, reb: 13, ast: 3, result: "W" },
      { game: "vs FEU", pts: 16, reb: 11, ast: 1, result: "W" },
    ],
    rankHistory: [
      { wk: "Wk1", rank: 1 }, { wk: "Wk2", rank: 1 }, { wk: "Wk3", rank: 1 },
      { wk: "Wk4", rank: 2 }, { wk: "Wk5", rank: 2 }, { wk: "Wk6", rank: 3 },
    ],
    analytics: [
      { skill: "Scoring", value: 76, fullMark: 100 }, { skill: "Playmaking", value: 55, fullMark: 100 },
      { skill: "Defense", value: 94, fullMark: 100 }, { skill: "Athleticism", value: 88, fullMark: 100 },
      { skill: "Shooting", value: 48, fullMark: 100 }, { skill: "IQ", value: 82, fullMark: 100 },
    ],
    percentiles: { scoring: 72, playmaking: 52, defense: 96, shooting: 44, athleticism: 89 },
  },
  {
    id: 4, name: "Andrei Abalos", position: "SG", school: "FEU Tamaraws", schoolShort: "FEU",
    year: "2nd Year", height: `6'3"`, heightCm: "191 cm", weight: "190 lbs", hometown: "Davao City",
    rank: 4, prevRank: 6, rating: 87, ppg: 19.7, rpg: 3.9, apg: 2.4, spg: 2.1, bpg: 0.4,
    fg: 44.8, threePct: 41.2, ft: 88.4, per: 19.8, gp: 14,
    image: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&h=500&fit=crop&auto=format",
    verified: true, recruitingStatus: "Uncommitted",
    strengths: ["3-Point Shooting", "Off-Ball Movement", "Free Throw Specialist"],
    recentForm: [
      { game: "vs DLSU", pts: 21, reb: 4, ast: 2, result: "W" },
      { game: "vs UP", pts: 17, reb: 3, ast: 3, result: "W" },
      { game: "vs NU", pts: 25, reb: 5, ast: 2, result: "W" },
      { game: "vs UST", pts: 22, reb: 3, ast: 2, result: "L" },
      { game: "vs ADMU", pts: 18, reb: 4, ast: 3, result: "L" },
    ],
    rankHistory: [
      { wk: "Wk1", rank: 8 }, { wk: "Wk2", rank: 7 }, { wk: "Wk3", rank: 7 },
      { wk: "Wk4", rank: 6 }, { wk: "Wk5", rank: 5 }, { wk: "Wk6", rank: 4 },
    ],
    analytics: [
      { skill: "Scoring", value: 91, fullMark: 100 }, { skill: "Playmaking", value: 68, fullMark: 100 },
      { skill: "Defense", value: 82, fullMark: 100 }, { skill: "Athleticism", value: 84, fullMark: 100 },
      { skill: "Shooting", value: 94, fullMark: 100 }, { skill: "IQ", value: 79, fullMark: 100 },
    ],
    percentiles: { scoring: 89, playmaking: 65, defense: 80, shooting: 95, athleticism: 82 },
  },
  {
    id: 5, name: "Luis Torres", position: "PF", school: "UP Fighting Maroons", schoolShort: "UP",
    year: "4th Year", height: `6'6"`, heightCm: "198 cm", weight: "220 lbs", hometown: "Makati",
    rank: 5, prevRank: 5, rating: 85, ppg: 16.2, rpg: 9.4, apg: 2.7, spg: 1.1, bpg: 1.2,
    fg: 49.6, threePct: 31.8, ft: 71.2, per: 18.7, gp: 13,
    image: "https://images.unsplash.com/photo-1607457561901-e6ec3a6d16cf?w=400&h=500&fit=crop&auto=format",
    verified: true, recruitingStatus: "Exploring Options",
    strengths: ["Pick and Roll", "Versatility", "Hustle Plays"],
    recentForm: [
      { game: "vs NU", pts: 18, reb: 10, ast: 3, result: "L" },
      { game: "vs UST", pts: 14, reb: 9, ast: 2, result: "L" },
      { game: "vs ADMU", pts: 16, reb: 11, ast: 3, result: "L" },
      { game: "vs DLSU", pts: 21, reb: 8, ast: 2, result: "L" },
      { game: "vs FEU", pts: 13, reb: 9, ast: 4, result: "L" },
    ],
    rankHistory: [
      { wk: "Wk1", rank: 6 }, { wk: "Wk2", rank: 5 }, { wk: "Wk3", rank: 5 },
      { wk: "Wk4", rank: 5 }, { wk: "Wk5", rank: 5 }, { wk: "Wk6", rank: 5 },
    ],
    analytics: [
      { skill: "Scoring", value: 78, fullMark: 100 }, { skill: "Playmaking", value: 74, fullMark: 100 },
      { skill: "Defense", value: 86, fullMark: 100 }, { skill: "Athleticism", value: 82, fullMark: 100 },
      { skill: "Shooting", value: 68, fullMark: 100 }, { skill: "IQ", value: 88, fullMark: 100 },
    ],
    percentiles: { scoring: 76, playmaking: 72, defense: 84, shooting: 62, athleticism: 80 },
  },
  {
    id: 6, name: "Ethan Buenaventura", position: "SG", school: "NU Bulldogs", schoolShort: "NU",
    year: "1st Year", height: `6'2"`, heightCm: "188 cm", weight: "180 lbs", hometown: "Pasig",
    rank: 6, prevRank: 4, rating: 83, ppg: 15.4, rpg: 3.1, apg: 3.8, spg: 1.6, bpg: 0.2,
    fg: 43.1, threePct: 36.8, ft: 79.6, per: 17.2, gp: 14,
    image: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&h=500&fit=crop&auto=format",
    verified: false, recruitingStatus: "Uncommitted",
    strengths: ["Energy", "Transition Offense", "Defensive Instincts"],
    recentForm: [
      { game: "vs UST", pts: 14, reb: 3, ast: 5, result: "L" },
      { game: "vs ADMU", pts: 18, reb: 4, ast: 4, result: "L" },
      { game: "vs UP", pts: 12, reb: 2, ast: 3, result: "W" },
      { game: "vs DLSU", pts: 16, reb: 3, ast: 4, result: "W" },
      { game: "vs FEU", pts: 19, reb: 5, ast: 4, result: "L" },
    ],
    rankHistory: [
      { wk: "Wk1", rank: 3 }, { wk: "Wk2", rank: 4 }, { wk: "Wk3", rank: 4 },
      { wk: "Wk4", rank: 4 }, { wk: "Wk5", rank: 4 }, { wk: "Wk6", rank: 6 },
    ],
    analytics: [
      { skill: "Scoring", value: 78, fullMark: 100 }, { skill: "Playmaking", value: 76, fullMark: 100 },
      { skill: "Defense", value: 80, fullMark: 100 }, { skill: "Athleticism", value: 90, fullMark: 100 },
      { skill: "Shooting", value: 80, fullMark: 100 }, { skill: "IQ", value: 74, fullMark: 100 },
    ],
    percentiles: { scoring: 74, playmaking: 74, defense: 78, shooting: 79, athleticism: 92 },
  },
  {
    id: 7, name: "Diego Fontanilla", position: "PF", school: "Adamson Falcons", schoolShort: "ADU",
    year: "2nd Year", height: `6'7"`, heightCm: "201 cm", weight: "225 lbs", hometown: "Antipolo",
    rank: 7, prevRank: 9, rating: 81, ppg: 13.9, rpg: 8.1, apg: 1.4, spg: 0.7, bpg: 1.8,
    fg: 55.4, threePct: 22.1, ft: 62.3, per: 16.8, gp: 12,
    image: "https://images.unsplash.com/photo-1546519638405-a2e41bc3a3c9?w=400&h=500&fit=crop&auto=format",
    verified: true, recruitingStatus: "Uncommitted",
    strengths: ["Rebounding", "Interior Defense", "Post Moves"],
    recentForm: [
      { game: "vs UST", pts: 14, reb: 9, ast: 1, result: "L" },
      { game: "vs FEU", pts: 16, reb: 8, ast: 2, result: "W" },
      { game: "vs NU", pts: 12, reb: 10, ast: 1, result: "L" },
      { game: "vs ADMU", pts: 13, reb: 7, ast: 2, result: "L" },
      { game: "vs UP", pts: 15, reb: 9, ast: 1, result: "W" },
    ],
    rankHistory: [
      { wk: "Wk1", rank: 12 }, { wk: "Wk2", rank: 11 }, { wk: "Wk3", rank: 10 },
      { wk: "Wk4", rank: 9 }, { wk: "Wk5", rank: 8 }, { wk: "Wk6", rank: 7 },
    ],
    analytics: [
      { skill: "Scoring", value: 68, fullMark: 100 }, { skill: "Playmaking", value: 52, fullMark: 100 },
      { skill: "Defense", value: 89, fullMark: 100 }, { skill: "Athleticism", value: 86, fullMark: 100 },
      { skill: "Shooting", value: 44, fullMark: 100 }, { skill: "IQ", value: 80, fullMark: 100 },
    ],
    percentiles: { scoring: 66, playmaking: 50, defense: 92, shooting: 40, athleticism: 86 },
  },
  {
    id: 8, name: "Ramon Villanueva", position: "PG", school: "EAC Generals", schoolShort: "EAC",
    year: "3rd Year", height: `5'11"`, heightCm: "181 cm", weight: "165 lbs", hometown: "Cavite",
    rank: 8, prevRank: 7, rating: 80, ppg: 17.1, rpg: 3.4, apg: 7.2, spg: 2.3, bpg: 0.1,
    fg: 42.8, threePct: 35.1, ft: 84.7, per: 18.4, gp: 14,
    image: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&h=500&fit=crop&auto=format",
    verified: false, recruitingStatus: "Uncommitted",
    strengths: ["Floor General", "Steal Machine", "Transition Offense"],
    recentForm: [
      { game: "vs JRU", pts: 19, reb: 4, ast: 8, result: "W" },
      { game: "vs SBU", pts: 14, reb: 3, ast: 9, result: "W" },
      { game: "vs LPU", pts: 22, reb: 3, ast: 6, result: "W" },
      { game: "vs MCU", pts: 16, reb: 4, ast: 7, result: "W" },
      { game: "vs Mapua", pts: 18, reb: 2, ast: 8, result: "L" },
    ],
    rankHistory: [
      { wk: "Wk1", rank: 9 }, { wk: "Wk2", rank: 8 }, { wk: "Wk3", rank: 8 },
      { wk: "Wk4", rank: 7 }, { wk: "Wk5", rank: 7 }, { wk: "Wk6", rank: 8 },
    ],
    analytics: [
      { skill: "Scoring", value: 82, fullMark: 100 }, { skill: "Playmaking", value: 91, fullMark: 100 },
      { skill: "Defense", value: 88, fullMark: 100 }, { skill: "Athleticism", value: 76, fullMark: 100 },
      { skill: "Shooting", value: 78, fullMark: 100 }, { skill: "IQ", value: 90, fullMark: 100 },
    ],
    percentiles: { scoring: 80, playmaking: 92, defense: 86, shooting: 76, athleticism: 74 },
  },
];

const GAMES = [
  { id: 1, date: "Jun 27", homeTeam: "UST", homeSchool: "UST Growling Tigers", awayTeam: "ADMU", awaySchool: "Ateneo Blue Eagles", homeScore: 78, awayScore: 72, status: "FINAL", league: "UAAP S87", venue: "Filoil EcoOil Centre", topPerformer: "Kai Santos", topStats: "22 PTS · 5 REB · 8 AST" },
  { id: 2, date: "Jun 27", homeTeam: "DLSU", homeSchool: "La Salle Green Archers", awayTeam: "FEU", awaySchool: "FEU Tamaraws", homeScore: 65, awayScore: 71, status: "FINAL", league: "UAAP S87", venue: "Mall of Asia Arena", topPerformer: "Andrei Abalos", topStats: "25 PTS · 5 REB · 2 AST" },
  { id: 3, date: "Jun 27", homeTeam: "UP", homeSchool: "UP Fighting Maroons", awayTeam: "NU", awaySchool: "NU Bulldogs", homeScore: 58, awayScore: 62, status: "FINAL", league: "UAAP S87", venue: "Araneta Coliseum", topPerformer: "Ethan Buenaventura", topStats: "19 PTS · 5 REB · 4 AST" },
  { id: 4, date: "Jun 28", homeTeam: "UST", homeSchool: "UST Growling Tigers", awayTeam: "FEU", awaySchool: "FEU Tamaraws", homeScore: null, awayScore: null, status: "TODAY · 4:00 PM", league: "UAAP S87", venue: "Filoil EcoOil Centre", topPerformer: null, topStats: null },
  { id: 5, date: "Jun 28", homeTeam: "ADMU", homeSchool: "Ateneo Blue Eagles", awayTeam: "UP", awaySchool: "UP Fighting Maroons", homeScore: null, awayScore: null, status: "TODAY · 6:30 PM", league: "UAAP S87", venue: "Mall of Asia Arena", topPerformer: null, topStats: null },
  { id: 6, date: "Jun 29", homeTeam: "DLSU", homeSchool: "La Salle Green Archers", awayTeam: "NU", awaySchool: "NU Bulldogs", homeScore: null, awayScore: null, status: "SUN · 4:00 PM", league: "UAAP S87", venue: "Mall of Asia Arena", topPerformer: null, topStats: null },
];

const STANDINGS = [
  { team: "UST Growling Tigers", short: "UST", w: 10, l: 4, pct: 0.714, streak: "W3", gb: "—" },
  { team: "Ateneo Blue Eagles", short: "ADMU", w: 9, l: 5, pct: 0.643, streak: "L1", gb: "1.0" },
  { team: "La Salle Green Archers", short: "DLSU", w: 9, l: 5, pct: 0.643, streak: "L1", gb: "1.0" },
  { team: "FEU Tamaraws", short: "FEU", w: 8, l: 6, pct: 0.571, streak: "W2", gb: "2.0" },
  { team: "UP Fighting Maroons", short: "UP", w: 7, l: 7, pct: 0.500, streak: "L4", gb: "3.0" },
  { team: "NU Bulldogs", short: "NU", w: 7, l: 7, pct: 0.500, streak: "W1", gb: "3.0" },
  { team: "Adamson Falcons", short: "ADU", w: 5, l: 9, pct: 0.357, streak: "L2", gb: "5.0" },
  { team: "UE Red Warriors", short: "UE", w: 3, l: 11, pct: 0.214, streak: "L3", gb: "7.0" },
];

const TICKER_ITEMS = [
  "FINAL · UST 78 ADMU 72 · Kai Santos 22 PTS 8 AST",
  "FINAL · FEU 71 DLSU 65 · Andrei Abalos 25 PTS",
  "FINAL · NU 62 UP 58 · Buenaventura 19 PTS",
  "TODAY 4PM · UST vs FEU · Filoil EcoOil Centre",
  "TODAY 6:30PM · ADMU vs UP · Mall of Asia Arena",
  "BOARD · Kai Santos rises to #1 Overall · ↑2",
  "BOARD · Andrei Abalos climbs to #4 · ↑2",
  "BOARD · Josh Reyes drops to #3 · ↓2 after 2-loss stretch",
  "UAAP S87 · Round 2 begins this weekend · 4 games remaining",
];

// ─── DISPLAY FONT HELPER ──────────────────────────────────────────────────────

const DISPLAY: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif" };

// ─── SMALL COMPONENTS ────────────────────────────────────────────────────────

function RankChange({ move }: { move: number }) {
  if (move > 0)
    return (
      <span className="flex items-center gap-0.5 text-emerald-400 text-[11px] font-mono font-semibold">
        <ChevronUp className="w-3 h-3" />{move}
      </span>
    );
  if (move < 0)
    return (
      <span className="flex items-center gap-0.5 text-rose-400 text-[11px] font-mono font-semibold">
        <ChevronDown className="w-3 h-3" />{Math.abs(move)}
      </span>
    );
  return <Minus className="w-3 h-3 text-muted-foreground" />;
}

function PosBadge({ pos }: { pos: string }) {
  return (
    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 border border-primary/40 text-primary bg-primary/10 tracking-wider rounded-sm">
      {pos}
    </span>
  );
}

function VerBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-sky-400 font-mono">
      <CheckCircle className="w-3 h-3" />VER
    </span>
  );
}

function PctBar({ label, value }: { label: string; value: number }) {
  const color = value >= 90 ? "#D4720D" : value >= 75 ? "#E8890F" : value >= 60 ? "#7A94B0" : "#4B6280";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-muted-foreground uppercase tracking-widest font-mono">{label}</span>
        <span className="text-xs font-mono text-foreground font-bold">{value}th PCT</span>
      </div>
      <div className="h-1.5 bg-secondary overflow-hidden">
        <div className="h-full transition-all duration-700" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function SectionHead({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-1 h-4 bg-primary shrink-0" />
      <h2 className="text-sm font-black uppercase tracking-[0.15em] text-foreground" style={DISPLAY}>
        {children}
      </h2>
      {sub && <span className="text-[10px] font-mono text-muted-foreground">{sub}</span>}
    </div>
  );
}

// ─── NAVIGATION ──────────────────────────────────────────────────────────────

function Navigation({ view, setView, onSearch }: { view: string; setView: (v: View) => void; onSearch: () => void }) {
  const [open, setOpen] = useState(false);
  const navItems: { id: View; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "rankings", label: "Rankings" },
    { id: "games", label: "Games" },
    { id: "league", label: "League" },
    { id: "search", label: "Search" },
  ];
  return (
    <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
      <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between">
        <button onClick={() => setView("home")} className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 bg-primary flex items-center justify-center rounded-sm">
            <span className="text-[11px] font-black text-white" style={DISPLAY}>PB</span>
          </div>
          <span className="text-[15px] font-black text-foreground tracking-tight" style={DISPLAY}>PEACH BASKET</span>
        </button>

        <div className="hidden md:flex items-center gap-0.5">
          {navItems.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`px-3 py-1.5 text-[12px] font-mono font-semibold uppercase tracking-wider transition-colors rounded-sm ${view === id || (view === "player" && id === "rankings") ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onSearch} className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors rounded-sm">
            <Search className="w-4 h-4" />
          </button>
          <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors rounded-sm hidden md:flex">
            <Bell className="w-4 h-4" />
          </button>
          <button className="hidden md:flex px-3 py-1.5 text-[11px] font-mono font-bold bg-primary text-white rounded-sm hover:bg-primary/90 transition-colors tracking-wider uppercase">
            Scout Login
          </button>
          <button onClick={() => setOpen(!open)} className="md:hidden p-2 text-muted-foreground">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-card px-4 py-3 flex flex-col gap-0.5">
          {navItems.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => { setView(id); setOpen(false); }}
              className={`text-left px-3 py-2.5 text-sm font-mono font-semibold uppercase tracking-wider rounded-sm transition-colors ${view === id ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}

// ─── LIVE TICKER ─────────────────────────────────────────────────────────────

function LiveTicker() {
  return (
    <div className="bg-secondary border-b border-border overflow-hidden py-2">
      <div className="flex gap-10 whitespace-nowrap" style={{ animation: "ticker 40s linear infinite" }}>
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
          <span key={i} className="text-[11px] font-mono text-muted-foreground tracking-wider shrink-0">
            <span className="text-primary mr-2">◆</span>{item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── HOME PAGE ───────────────────────────────────────────────────────────────

function HomePage({ onViewPlayer, setView }: { onViewPlayer: (id: number) => void; setView: (v: View) => void }) {
  const featured = PLAYERS[0];
  const movers = [...PLAYERS].sort((a, b) => Math.abs(b.prevRank - b.rank) - Math.abs(a.prevRank - a.rank));

  return (
    <div className="min-h-screen bg-background">
      {/* HERO */}
      <div className="relative overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-10"
          style={{ backgroundImage: "url(https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=1400&h=700&fit=crop&auto=format)" }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background/60" />

        <div className="relative max-w-screen-xl mx-auto px-4 py-16 md:py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-1 h-5 bg-primary" />
                <span className="text-[11px] font-mono text-primary uppercase tracking-[0.2em]">UAAP Season 87 · Now Live</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-black text-foreground leading-none mb-5 uppercase" style={DISPLAY}>
                The Home of<br />
                <span className="text-primary">Philippine</span><br />
                Basketball<br />
                Prospects.
              </h1>
              <p className="text-sm text-muted-foreground font-mono mb-8 leading-relaxed">
                112 active prospects · 8 leagues tracked<br />
                Updated daily by verified scouts nationwide
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setView("rankings")}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-[12px] font-mono font-bold rounded-sm hover:bg-primary/90 transition-colors tracking-wider uppercase"
                >
                  View Rankings <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setView("search")}
                  className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-foreground text-[12px] font-mono font-bold rounded-sm hover:bg-secondary/80 transition-colors tracking-wider uppercase border border-border"
                >
                  Search Players <Search className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Featured Player Card */}
            <button
              onClick={() => onViewPlayer(featured.id)}
              className="bg-card border border-border rounded-sm overflow-hidden text-left hover:border-primary/50 transition-all group relative"
            >
              <div className="absolute top-3 left-3 z-10">
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-primary">Featured Prospect</span>
              </div>
              <div
                className="h-72 bg-secondary bg-center bg-cover relative"
                style={{ backgroundImage: `url(${featured.image})` }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <div className="flex items-end justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-5xl font-black text-primary leading-none" style={DISPLAY}>#1</span>
                        <PosBadge pos={featured.position} />
                        {featured.verified && <VerBadge />}
                      </div>
                      <h2 className="text-2xl font-black text-foreground uppercase leading-tight" style={DISPLAY}>{featured.name}</h2>
                      <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{featured.school} · {featured.year}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-black text-foreground leading-none" style={DISPLAY}>{featured.rating}</div>
                      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Rating</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
                    {[{ v: featured.ppg, l: "PPG" }, { v: featured.apg, l: "APG" }, { v: featured.rpg, l: "RPG" }].map(({ v, l }) => (
                      <div key={l}>
                        <div className="text-base font-mono font-bold text-foreground">{v}</div>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase">{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="absolute bottom-5 right-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* BOARD MOVEMENT */}
      <div className="max-w-screen-xl mx-auto px-4 py-10 border-b border-border">
        <div className="flex items-center justify-between mb-5">
          <SectionHead sub="Week 6">Board Movement</SectionHead>
          <button onClick={() => setView("rankings")} className="text-[11px] font-mono text-primary hover:text-primary/80 flex items-center gap-1 transition-colors -mt-3">
            Full Rankings <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {movers.slice(0, 6).map((p) => {
            const move = p.prevRank - p.rank;
            return (
              <button
                key={p.id}
                onClick={() => onViewPlayer(p.id)}
                className="bg-card border border-border rounded-sm p-3 text-left hover:border-primary/50 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl font-black text-foreground" style={DISPLAY}>#{p.rank}</span>
                  <RankChange move={move} />
                </div>
                <div className="text-xs font-bold text-foreground leading-tight truncate" style={DISPLAY}>{p.name}</div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <PosBadge pos={p.position} />
                  <span className="text-[10px] font-mono text-muted-foreground">{p.schoolShort}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* PROSPECTS + BOARD LEADERS */}
      <div className="max-w-screen-xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Featured Prospects */}
          <div className="lg:col-span-2">
            <SectionHead>Featured Prospects</SectionHead>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {PLAYERS.slice(1, 5).map((p) => {
                const move = p.prevRank - p.rank;
                return (
                  <button
                    key={p.id}
                    onClick={() => onViewPlayer(p.id)}
                    className="bg-card border border-border rounded-sm overflow-hidden text-left hover:border-primary/50 transition-all group"
                  >
                    <div className="h-36 bg-secondary bg-center bg-cover relative" style={{ backgroundImage: `url(${p.image})` }}>
                      <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                      <div className="absolute top-2.5 left-2.5">
                        <span className="text-3xl font-black text-primary/80" style={DISPLAY}>#{p.rank}</span>
                      </div>
                      <div className="absolute top-2.5 right-2.5">
                        <RankChange move={move} />
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <div className="text-base font-black text-foreground uppercase leading-tight group-hover:text-primary transition-colors" style={DISPLAY}>{p.name}</div>
                          <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{p.school}</p>
                        </div>
                        <PosBadge pos={p.position} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border">
                        {[{ v: p.ppg, l: "PPG" }, { v: p.rpg, l: "RPG" }, { v: p.apg, l: "APG" }].map(({ v, l }) => (
                          <div key={l}>
                            <div className="text-sm font-mono font-bold text-foreground">{v}</div>
                            <div className="text-[10px] font-mono text-muted-foreground">{l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Board Leaders */}
          <div className="lg:col-span-1 space-y-6">
            <div>
              <SectionHead>National Board</SectionHead>
              <div className="bg-card border border-border rounded-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border grid grid-cols-12 gap-2">
                  <span className="col-span-1 text-[10px] font-mono text-muted-foreground uppercase">#</span>
                  <span className="col-span-6 text-[10px] font-mono text-muted-foreground uppercase">Player</span>
                  <span className="col-span-2 text-[10px] font-mono text-muted-foreground uppercase text-right">RTG</span>
                  <span className="col-span-3 text-[10px] font-mono text-muted-foreground uppercase text-right">+/−</span>
                </div>
                {PLAYERS.slice(0, 8).map((p, i) => {
                  const move = p.prevRank - p.rank;
                  return (
                    <button
                      key={p.id}
                      onClick={() => onViewPlayer(p.id)}
                      className={`w-full px-4 py-3 grid grid-cols-12 gap-2 items-center text-left hover:bg-secondary/50 transition-colors ${i < 7 ? "border-b border-border/40" : ""}`}
                    >
                      <span className={`col-span-1 text-lg font-black leading-none ${p.rank <= 3 ? "text-primary" : "text-muted-foreground"}`} style={DISPLAY}>
                        {p.rank}
                      </span>
                      <div className="col-span-6">
                        <div className="text-[12px] font-semibold text-foreground leading-tight">{p.name}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <PosBadge pos={p.position} />
                          <span className="text-[10px] font-mono text-muted-foreground">{p.schoolShort}</span>
                        </div>
                      </div>
                      <span className="col-span-2 text-sm font-mono font-bold text-foreground text-right">{p.rating}</span>
                      <div className="col-span-3 flex justify-end">
                        <RankChange move={move} />
                      </div>
                    </button>
                  );
                })}
                <div className="px-4 py-3 border-t border-border">
                  <button onClick={() => setView("rankings")} className="w-full text-center text-[11px] font-mono text-primary hover:text-primary/80 transition-colors uppercase tracking-wider">
                    Full Rankings →
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Scores */}
            <div>
              <SectionHead>Recent Scores</SectionHead>
              <div className="space-y-2">
                {GAMES.slice(0, 3).map((g) => (
                  <div key={g.id} className="bg-card border border-border rounded-sm p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{g.league}</span>
                      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{g.status}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className={`text-sm font-bold uppercase ${g.homeScore! > g.awayScore! ? "text-foreground" : "text-muted-foreground"}`} style={DISPLAY}>{g.homeTeam}</div>
                        <div className={`text-sm font-bold uppercase ${g.awayScore! > g.homeScore! ? "text-foreground" : "text-muted-foreground"}`} style={DISPLAY}>{g.awayTeam}</div>
                      </div>
                      <div className="text-right space-y-0.5">
                        <div className={`text-xl font-black font-mono ${g.homeScore! > g.awayScore! ? "text-foreground" : "text-muted-foreground"}`} style={DISPLAY}>{g.homeScore}</div>
                        <div className={`text-xl font-black font-mono ${g.awayScore! > g.homeScore! ? "text-foreground" : "text-muted-foreground"}`} style={DISPLAY}>{g.awayScore}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── RANKINGS PAGE ───────────────────────────────────────────────────────────

function RankingsPage({ onViewPlayer }: { onViewPlayer: (id: number) => void }) {
  const [pos, setPos] = useState("ALL");
  const [school, setSchool] = useState("ALL");
  const positions = ["ALL", "PG", "SG", "SF", "PF", "C"];
  const schools = ["ALL", "UST", "ADMU", "DLSU", "FEU", "UP", "NU"];

  const filtered = PLAYERS.filter((p) => {
    if (pos !== "ALL" && p.position !== pos) return false;
    if (school !== "ALL" && p.schoolShort !== school) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-screen-xl mx-auto px-4 py-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-5 bg-primary" />
            <span className="text-[11px] font-mono text-primary uppercase tracking-[0.2em]">UAAP Season 87</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-foreground uppercase" style={DISPLAY}>National Rankings</h1>
          <p className="text-sm font-mono text-muted-foreground mt-1">{PLAYERS.length} prospects · Updated Jun 28, 2025 · Peach Basket Scouting Network</p>
        </div>
      </div>

      {/* Filters */}
      <div className="sticky top-14 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-1 flex-wrap">
            {positions.map((p) => (
              <button key={p} onClick={() => setPos(p)} className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-sm transition-colors ${pos === p ? "bg-primary text-white" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>{p}</button>
            ))}
          </div>
          <div className="w-px h-4 bg-border hidden sm:block" />
          <div className="flex items-center gap-1 flex-wrap">
            {schools.map((s) => (
              <button key={s} onClick={() => setSchool(s)} className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-sm transition-colors ${school === s ? "bg-primary text-white" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>{s}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 py-6">
        {/* Desktop header */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 mb-1">
          <span className="col-span-1 text-[10px] font-mono text-muted-foreground uppercase">#</span>
          <span className="col-span-4 text-[10px] font-mono text-muted-foreground uppercase">Player</span>
          <span className="col-span-1 text-[10px] font-mono text-muted-foreground uppercase text-center">RTG</span>
          <span className="col-span-1 text-[10px] font-mono text-muted-foreground uppercase text-right">PPG</span>
          <span className="col-span-1 text-[10px] font-mono text-muted-foreground uppercase text-right">RPG</span>
          <span className="col-span-1 text-[10px] font-mono text-muted-foreground uppercase text-right">APG</span>
          <span className="col-span-1 text-[10px] font-mono text-muted-foreground uppercase text-right">FG%</span>
          <span className="col-span-2 text-[10px] font-mono text-muted-foreground uppercase text-right">Status</span>
        </div>

        <div className="space-y-1.5">
          {filtered.map((p) => {
            const move = p.prevRank - p.rank;
            return (
              <button
                key={p.id}
                onClick={() => onViewPlayer(p.id)}
                className="w-full bg-card border border-border rounded-sm hover:border-primary/50 hover:bg-secondary/20 transition-all text-left group"
              >
                {/* Desktop */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-4 items-center">
                  <div className="col-span-1 flex items-center gap-1.5">
                    <span className={`text-2xl font-black leading-none ${p.rank <= 3 ? "text-primary" : "text-foreground"}`} style={DISPLAY}>{p.rank}</span>
                    <RankChange move={move} />
                  </div>
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-sm bg-secondary bg-center bg-cover shrink-0" style={{ backgroundImage: `url(${p.image})` }} />
                    <div>
                      <div className="text-base font-black text-foreground uppercase leading-tight group-hover:text-primary transition-colors" style={DISPLAY}>{p.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <PosBadge pos={p.position} />
                        <span className="text-[11px] font-mono text-muted-foreground">{p.schoolShort} · {p.year}</span>
                        {p.verified && <VerBadge />}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <span className={`text-xl font-black ${p.rating >= 90 ? "text-primary" : p.rating >= 85 ? "text-orange-400" : "text-foreground"}`} style={DISPLAY}>{p.rating}</span>
                  </div>
                  <span className="col-span-1 text-sm font-mono font-semibold text-foreground text-right">{p.ppg}</span>
                  <span className="col-span-1 text-sm font-mono font-semibold text-foreground text-right">{p.rpg}</span>
                  <span className="col-span-1 text-sm font-mono font-semibold text-foreground text-right">{p.apg}</span>
                  <span className="col-span-1 text-sm font-mono font-semibold text-foreground text-right">{p.fg}%</span>
                  <span className={`col-span-2 text-[11px] font-mono font-semibold text-right ${p.recruitingStatus === "Uncommitted" ? "text-muted-foreground" : p.recruitingStatus.includes("Batang") || p.recruitingStatus.includes("Committed") ? "text-primary" : "text-orange-400"}`}>
                    {p.recruitingStatus}
                  </span>
                </div>

                {/* Mobile */}
                <div className="md:hidden px-4 py-3.5 grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-2 flex flex-col items-center">
                    <span className="text-2xl font-black text-primary leading-none" style={DISPLAY}>{p.rank}</span>
                    <RankChange move={move} />
                  </div>
                  <div className="col-span-8">
                    <div className="text-base font-black text-foreground uppercase leading-tight" style={DISPLAY}>{p.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <PosBadge pos={p.position} />
                      <span className="text-[11px] font-mono text-muted-foreground">{p.schoolShort}</span>
                    </div>
                  </div>
                  <div className="col-span-2 text-right">
                    <div className="text-2xl font-black text-primary" style={DISPLAY}>{p.rating}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">RTG</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 font-mono text-muted-foreground text-sm">No prospects match your filters.</div>
        )}
      </div>
    </div>
  );
}

// ─── PLAYER PROFILE ──────────────────────────────────────────────────────────

function PlayerProfilePage({ player, onBack }: { player: typeof PLAYERS[0]; onBack: () => void }) {
  const move = player.prevRank - player.rank;

  return (
    <div className="min-h-screen bg-background">
      {/* Dossier Header */}
      <div className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-cover bg-center opacity-8" style={{ backgroundImage: `url(${player.image})`, opacity: 0.08 }} aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background/70" />

        <div className="relative max-w-screen-xl mx-auto px-4 py-6">
          <button onClick={onBack} className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors mb-6 uppercase tracking-wider">
            ← Rankings
          </button>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-start">
            <div className="md:col-span-1">
              <div className="w-28 h-36 md:w-full md:h-52 rounded-sm bg-secondary bg-center bg-cover border border-border" style={{ backgroundImage: `url(${player.image})` }} />
            </div>

            <div className="md:col-span-3">
              <div className="flex items-center gap-4 mb-3">
                <span className="text-6xl md:text-8xl font-black text-primary leading-none" style={DISPLAY}>#{player.rank}</span>
                <div>
                  <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.2em] mb-1">National Rank</div>
                  <div className="flex items-center gap-2">
                    <RankChange move={move} />
                    {move !== 0 && <span className="text-[11px] font-mono text-muted-foreground">from #{player.prevRank}</span>}
                  </div>
                </div>
              </div>

              <h1 className="text-4xl md:text-6xl font-black text-foreground uppercase leading-none mb-3" style={DISPLAY}>{player.name}</h1>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-4">
                <PosBadge pos={player.position} />
                <span className="text-sm font-mono text-muted-foreground">{player.school}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-sm font-mono text-muted-foreground">{player.year}</span>
                {player.verified && <><span className="text-muted-foreground">·</span><VerBadge /></>}
              </div>

              <div className="flex flex-wrap gap-5 text-[12px] font-mono text-muted-foreground">
                <span><span className="text-muted-foreground/50 mr-1">HT</span>{player.height} / {player.heightCm}</span>
                <span><span className="text-muted-foreground/50 mr-1">WT</span>{player.weight}</span>
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{player.hometown}</span>
              </div>
            </div>

            <div className="md:col-span-1 flex flex-row md:flex-col items-center md:items-end gap-4">
              <div className="text-right">
                <div className="text-7xl font-black text-primary leading-none" style={DISPLAY}>{player.rating}</div>
                <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">Overall</div>
              </div>
              <div className={`px-3 py-1.5 text-[11px] font-mono font-semibold uppercase tracking-wider rounded-sm ${player.recruitingStatus === "Uncommitted" ? "bg-secondary text-muted-foreground border border-border" : "bg-primary/20 text-primary border border-primary/40"}`}>
                {player.recruitingStatus}
              </div>
            </div>
          </div>

          {/* Stats Band */}
          <div className="mt-8 grid grid-cols-5 gap-px bg-border overflow-hidden border border-border rounded-sm">
            {[
              { v: player.ppg, l: "PPG" }, { v: player.rpg, l: "RPG" }, { v: player.apg, l: "APG" },
              { v: `${player.fg}%`, l: "FG%" }, { v: player.per, l: "PER" },
            ].map(({ v, l }) => (
              <div key={l} className="bg-card px-4 py-4 text-center">
                <div className="text-2xl md:text-3xl font-black text-foreground" style={DISPLAY}>{v}</div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mt-0.5">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Analytics */}
          <div className="lg:col-span-2 space-y-8">
            {/* Percentile Rankings */}
            <div>
              <SectionHead sub="vs All UAAP Prospects">Percentile Rankings</SectionHead>
              <div className="bg-card border border-border rounded-sm p-5 space-y-5">
                <PctBar label="Scoring" value={player.percentiles.scoring} />
                <PctBar label="Playmaking" value={player.percentiles.playmaking} />
                <PctBar label="Defense" value={player.percentiles.defense} />
                <PctBar label="Shooting" value={player.percentiles.shooting} />
                <PctBar label="Athleticism" value={player.percentiles.athleticism} />
              </div>
            </div>

            {/* Skill Radar */}
            <div>
              <SectionHead>Skill Profile</SectionHead>
              <div className="bg-card border border-border rounded-sm p-5">
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={player.analytics} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                    <PolarGrid stroke="rgba(255,255,255,0.07)" />
                    <PolarAngleAxis dataKey="skill" tick={{ fill: "#7A94B0", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} />
                    <Radar name={player.name} dataKey="value" stroke="#D4720D" fill="#D4720D" fillOpacity={0.2} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Ranking History */}
            <div>
              <SectionHead>Ranking Movement</SectionHead>
              <div className="bg-card border border-border rounded-sm p-5">
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={player.rankHistory} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
                    <XAxis dataKey="wk" tick={{ fill: "#7A94B0", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} axisLine={{ stroke: "rgba(255,255,255,0.07)" }} tickLine={false} />
                    <YAxis reversed domain={[10, 1]} tick={{ fill: "#7A94B0", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} width={20} />
                    <RechartTooltip
                      contentStyle={{ background: "#0F2035", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "2px", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#F2EDE3" }}
                      formatter={(v: number) => [`#${v}`, "Rank"]}
                    />
                    <Line type="monotone" dataKey="rank" stroke="#D4720D" strokeWidth={2} dot={{ fill: "#D4720D", r: 3 }} activeDot={{ r: 4, fill: "#E8890F" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Game Log */}
            <div>
              <SectionHead>Recent Game Log</SectionHead>
              <div className="bg-card border border-border rounded-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border grid grid-cols-12 gap-2">
                  <span className="col-span-4 text-[10px] font-mono text-muted-foreground uppercase">Game</span>
                  <span className="col-span-2 text-[10px] font-mono text-muted-foreground uppercase text-right">PTS</span>
                  <span className="col-span-2 text-[10px] font-mono text-muted-foreground uppercase text-right">REB</span>
                  <span className="col-span-2 text-[10px] font-mono text-muted-foreground uppercase text-right">AST</span>
                  <span className="col-span-2 text-[10px] font-mono text-muted-foreground uppercase text-right">W/L</span>
                </div>
                {player.recentForm.map((g, i) => (
                  <div key={i} className={`px-4 py-3 grid grid-cols-12 gap-2 items-center ${i < player.recentForm.length - 1 ? "border-b border-border/40" : ""}`}>
                    <span className="col-span-4 text-[12px] font-mono text-muted-foreground">{g.game}</span>
                    <span className="col-span-2 text-sm font-mono font-semibold text-foreground text-right">{g.pts}</span>
                    <span className="col-span-2 text-sm font-mono font-semibold text-foreground text-right">{g.reb}</span>
                    <span className="col-span-2 text-sm font-mono font-semibold text-foreground text-right">{g.ast}</span>
                    <div className="col-span-2 flex justify-end">
                      <span className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${g.result === "W" ? "text-emerald-400 bg-emerald-400/10" : "text-rose-400 bg-rose-400/10"}`}>{g.result}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1 space-y-5">
            {/* Strengths */}
            <div className="bg-card border border-border rounded-sm p-5">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground mb-4" style={DISPLAY}>Scouting Strengths</h3>
              <div className="space-y-2.5">
                {player.strengths.map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-primary shrink-0" />
                    <span className="text-[12px] font-mono text-foreground">{s}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Season Averages */}
            <div className="bg-card border border-border rounded-sm p-5">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground mb-4" style={DISPLAY}>Season Averages</h3>
              <div className="space-y-0">
                {[
                  { l: "Games Played", v: `${player.gp} GP` },
                  { l: "Points", v: `${player.ppg} PPG` },
                  { l: "Rebounds", v: `${player.rpg} RPG` },
                  { l: "Assists", v: `${player.apg} APG` },
                  { l: "Steals", v: `${player.spg} SPG` },
                  { l: "Blocks", v: `${player.bpg} BPG` },
                  { l: "FG%", v: `${player.fg}%` },
                  { l: "3P%", v: player.threePct > 0 ? `${player.threePct}%` : "—" },
                  { l: "FT%", v: `${player.ft}%` },
                  { l: "PER", v: player.per.toFixed(1) },
                ].map(({ l, v }) => (
                  <div key={l} className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
                    <span className="text-[11px] font-mono text-muted-foreground">{l}</span>
                    <span className="text-[12px] font-mono font-bold text-foreground">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Player Info */}
            <div className="bg-card border border-border rounded-sm p-5">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground mb-4" style={DISPLAY}>Player Info</h3>
              <div className="space-y-0">
                {[
                  { l: "School", v: player.school },
                  { l: "Year", v: player.year },
                  { l: "Height", v: `${player.height} (${player.heightCm})` },
                  { l: "Weight", v: player.weight },
                  { l: "Hometown", v: player.hometown },
                  { l: "NCAA Elig.", v: player.ncaaEligible ? "Yes" : "No" },
                  { l: "Status", v: player.recruitingStatus },
                ].map(({ l, v }) => (
                  <div key={l} className="flex justify-between items-start py-2 border-b border-border/40 last:border-0 gap-2">
                    <span className="text-[11px] font-mono text-muted-foreground shrink-0">{l}</span>
                    <span className="text-[11px] font-mono font-semibold text-foreground text-right">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── GAME CARD ────────────────────────────────────────────────────────────────

function GameCard({ game, topPlayer, onViewPlayer }: { game: typeof GAMES[0]; topPlayer?: typeof PLAYERS[0]; onViewPlayer?: (id: number) => void }) {
  const isFinal = game.status === "FINAL";
  const isToday = game.status.includes("TODAY");

  return (
    <div className="bg-card border border-border rounded-sm overflow-hidden">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{game.league}</span>
        <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${isToday ? "text-primary" : "text-muted-foreground"}`}>{game.status}</span>
      </div>
      <div className="p-4">
        <div className="space-y-2 mb-3">
          {[
            { team: game.homeSchool, short: game.homeTeam, score: game.homeScore, isWinner: isFinal && game.homeScore! > game.awayScore! },
            { team: game.awaySchool, short: game.awayTeam, score: game.awayScore, isWinner: isFinal && game.awayScore! > game.homeScore! },
          ].map(({ team, score, isWinner }) => (
            <div key={team} className="flex items-center justify-between">
              <div>
                <div className={`text-base font-black uppercase ${isWinner ? "text-foreground" : "text-muted-foreground"}`} style={DISPLAY}>{team}</div>
              </div>
              {isFinal && (
                <span className={`text-3xl font-black font-mono ${isWinner ? "text-foreground" : "text-muted-foreground"}`} style={DISPLAY}>{score}</span>
              )}
              {!isFinal && <Clock className="w-4 h-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {isFinal && topPlayer && (
          <button onClick={() => onViewPlayer?.(topPlayer.id)} className="w-full pt-3 border-t border-border text-left hover:opacity-80 transition-opacity">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Top Performer</div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-sm bg-secondary bg-center bg-cover shrink-0" style={{ backgroundImage: `url(${topPlayer.image})` }} />
              <span className="text-xs font-semibold text-foreground">{game.topPerformer}</span>
              <span className="text-[11px] font-mono text-primary ml-auto">{game.topStats}</span>
            </div>
          </button>
        )}

        {!isFinal && (
          <div className="pt-3 border-t border-border flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
            <MapPin className="w-3 h-3" />{game.venue}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── GAMES PAGE ───────────────────────────────────────────────────────────────

function GamesPage({ onViewPlayer }: { onViewPlayer: (id: number) => void }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-screen-xl mx-auto px-4 py-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-5 bg-primary" />
            <span className="text-[11px] font-mono text-primary uppercase tracking-[0.2em]">UAAP Season 87</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-foreground uppercase" style={DISPLAY}>Games & Scores</h1>
          <p className="text-sm font-mono text-muted-foreground mt-1">Jun 28, 2025 · 2 games today</p>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 py-8 space-y-10">
        <div>
          <div className="flex items-center gap-3 mb-5">
            <SectionHead>Today — Jun 28</SectionHead>
            <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-sm uppercase tracking-wider -mt-4">Live</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {GAMES.filter(g => g.date === "Jun 28").map(g => {
              const tp = PLAYERS.find(p => p.name === g.topPerformer);
              return <GameCard key={g.id} game={g} topPlayer={tp} onViewPlayer={onViewPlayer} />;
            })}
          </div>
        </div>

        <div>
          <SectionHead>Yesterday — Jun 27</SectionHead>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {GAMES.filter(g => g.date === "Jun 27").map(g => {
              const tp = PLAYERS.find(p => p.name === g.topPerformer);
              return <GameCard key={g.id} game={g} topPlayer={tp} onViewPlayer={onViewPlayer} />;
            })}
          </div>
        </div>

        <div>
          <SectionHead>Upcoming</SectionHead>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {GAMES.filter(g => g.date === "Jun 29").map(g => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LEAGUE PAGE ──────────────────────────────────────────────────────────────

function LeaguePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-screen-xl mx-auto px-4 py-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-5 bg-primary" />
            <span className="text-[11px] font-mono text-primary uppercase tracking-[0.2em]">Philippines</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-foreground uppercase" style={DISPLAY}>UAAP Season 87</h1>
          <p className="text-sm font-mono text-muted-foreground mt-1">Men's Basketball · Elimination Round 2 · 8 Teams</p>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <SectionHead>Standings</SectionHead>
            <div className="bg-card border border-border rounded-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border grid grid-cols-12 gap-2">
                <span className="col-span-1 text-[10px] font-mono text-muted-foreground uppercase">#</span>
                <span className="col-span-5 text-[10px] font-mono text-muted-foreground uppercase">Team</span>
                <span className="col-span-1 text-[10px] font-mono text-muted-foreground uppercase text-center">W</span>
                <span className="col-span-1 text-[10px] font-mono text-muted-foreground uppercase text-center">L</span>
                <span className="col-span-2 text-[10px] font-mono text-muted-foreground uppercase text-right">PCT</span>
                <span className="col-span-1 text-[10px] font-mono text-muted-foreground uppercase text-right">GB</span>
                <span className="col-span-1 text-[10px] font-mono text-muted-foreground uppercase text-right">STK</span>
              </div>
              {STANDINGS.map((t, i) => (
                <div key={t.short} className={`px-4 py-3 grid grid-cols-12 gap-2 items-center ${i < 7 ? "border-b border-border/40" : ""} ${i < 4 ? "border-l-2 border-l-primary/50" : "border-l-2 border-l-transparent"}`}>
                  <span className={`col-span-1 text-lg font-black leading-none ${i < 4 ? "text-foreground" : "text-muted-foreground"}`} style={DISPLAY}>{i + 1}</span>
                  <div className="col-span-5">
                    <div className={`text-sm font-semibold ${i < 4 ? "text-foreground" : "text-muted-foreground"}`}>{t.team}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{t.short}</div>
                  </div>
                  <span className="col-span-1 text-sm font-mono font-bold text-foreground text-center">{t.w}</span>
                  <span className="col-span-1 text-sm font-mono text-muted-foreground text-center">{t.l}</span>
                  <span className="col-span-2 text-sm font-mono text-foreground text-right">{t.pct.toFixed(3)}</span>
                  <span className="col-span-1 text-[11px] font-mono text-muted-foreground text-right">{t.gb}</span>
                  <span className={`col-span-1 text-[11px] font-mono font-bold text-right ${t.streak.startsWith("W") ? "text-emerald-400" : "text-rose-400"}`}>{t.streak}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
              <div className="w-1 h-4 bg-primary/50" />
              <span>Top 4 advance to Final Four</span>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-5">
            <div className="bg-card border border-border rounded-sm p-5">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground mb-4" style={DISPLAY}>League Info</h3>
              <div className="space-y-0">
                {[
                  { l: "Season", v: "UAAP Season 87" },
                  { l: "Division", v: "Men's Basketball" },
                  { l: "Teams", v: "8" },
                  { l: "Games Played", v: "52 of 56" },
                  { l: "Round", v: "Elimination Round 2" },
                  { l: "Final Four", v: "Jul 12, 2025" },
                  { l: "Championship", v: "Jul 20, 2025" },
                  { l: "Primary Venue", v: "Filoil / MOA Arena" },
                ].map(({ l, v }) => (
                  <div key={l} className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
                    <span className="text-[11px] font-mono text-muted-foreground">{l}</span>
                    <span className="text-[11px] font-mono font-bold text-foreground">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-sm p-5">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground mb-4" style={DISPLAY}>Statistical Leaders</h3>
              <div className="space-y-0">
                {[
                  { cat: "Scoring", name: "Marco Dela Cruz", val: "21.3 PPG", school: "ADMU" },
                  { cat: "Rebounding", name: "Josh Reyes", val: "11.2 RPG", school: "DLSU" },
                  { cat: "Assists", name: "Kai Santos", val: "6.8 APG", school: "UST" },
                  { cat: "Steals", name: "Andrei Abalos", val: "2.1 SPG", school: "FEU" },
                  { cat: "Blocks", name: "Josh Reyes", val: "2.4 BPG", school: "DLSU" },
                ].map(({ cat, name, val, school }) => (
                  <div key={cat} className="py-2.5 border-b border-border/40 last:border-0">
                    <div className="text-[10px] font-mono text-primary uppercase tracking-wider">{cat}</div>
                    <div className="flex justify-between items-center mt-0.5">
                      <span className="text-[12px] font-semibold text-foreground">{name}</span>
                      <span className="text-[12px] font-mono font-bold text-foreground">{val}</span>
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground">{school}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SEARCH PAGE ──────────────────────────────────────────────────────────────

function SearchPage({ onViewPlayer }: { onViewPlayer: (id: number) => void }) {
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState("ALL");

  const results = PLAYERS.filter((p) => {
    const q = query.toLowerCase();
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.school.toLowerCase().includes(q) || p.schoolShort.toLowerCase().includes(q) || p.hometown.toLowerCase().includes(q);
    return matchQ && (pos === "ALL" || p.position === pos);
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-screen-xl mx-auto px-4 py-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-primary" />
            <h1 className="text-4xl md:text-6xl font-black text-foreground uppercase" style={DISPLAY}>Search Prospects</h1>
          </div>
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, school, hometown..."
              className="w-full bg-secondary border border-border rounded-sm pl-10 pr-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
              autoFocus
            />
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-6">
          {["ALL", "PG", "SG", "SF", "PF", "C"].map((p) => (
            <button key={p} onClick={() => setPos(p)} className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-sm transition-colors ${pos === p ? "bg-primary text-white" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>{p}</button>
          ))}
          <span className="text-[11px] font-mono text-muted-foreground ml-2">{results.length} result{results.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="space-y-2">
          {results.map((p) => {
            const move = p.prevRank - p.rank;
            return (
              <button
                key={p.id}
                onClick={() => onViewPlayer(p.id)}
                className="w-full bg-card border border-border rounded-sm p-4 text-left hover:border-primary/50 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-14 rounded-sm bg-secondary bg-center bg-cover shrink-0" style={{ backgroundImage: `url(${p.image})` }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xl font-black text-primary" style={DISPLAY}>#{p.rank}</span>
                      <PosBadge pos={p.position} />
                      <RankChange move={move} />
                      {p.verified && <VerBadge />}
                    </div>
                    <div className="text-lg font-black text-foreground uppercase group-hover:text-primary transition-colors" style={DISPLAY}>{p.name}</div>
                    <div className="text-[11px] font-mono text-muted-foreground">{p.school} · {p.year} · {p.height}</div>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    <div className="text-3xl font-black text-primary" style={DISPLAY}>{p.rating}</div>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase">Rating</div>
                  </div>
                  <div className="hidden md:flex items-center gap-5 shrink-0">
                    {[{ v: p.ppg, l: "PPG" }, { v: p.rpg, l: "RPG" }, { v: p.apg, l: "APG" }].map(({ v, l }) => (
                      <div key={l} className="text-right">
                        <div className="text-base font-mono font-bold text-foreground">{v}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{l}</div>
                      </div>
                    ))}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 hidden sm:block" />
                </div>
              </button>
            );
          })}
        </div>

        {results.length === 0 && (
          <div className="text-center py-20">
            <Search className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-sm font-mono text-muted-foreground">No prospects found{query ? ` for "${query}"` : ""}.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────

function Footer({ setView }: { setView: (v: View) => void }) {
  return (
    <footer className="border-t border-border bg-card mt-16">
      <div className="max-w-screen-xl mx-auto px-4 py-10">
        <div className="flex flex-col md:flex-row justify-between gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 bg-primary rounded-sm flex items-center justify-center">
                <span className="text-[10px] font-black text-white" style={DISPLAY}>PB</span>
              </div>
              <span className="text-sm font-black text-foreground tracking-tight" style={DISPLAY}>PEACH BASKET</span>
            </div>
            <p className="text-[11px] font-mono text-muted-foreground max-w-xs leading-relaxed">
              The definitive basketball recruiting, scouting, and player intelligence platform for the Philippines.
            </p>
            <p className="text-[10px] font-mono text-muted-foreground/60 mt-3">
              Built for scouts. Trusted by coaches.
            </p>
          </div>
          <div className="flex gap-12">
            <div>
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Platform</div>
              <div className="space-y-2">
                {(["rankings", "games", "league", "search"] as View[]).map((id) => (
                  <button key={id} onClick={() => setView(id)} className="block text-[12px] font-mono text-muted-foreground hover:text-foreground transition-colors capitalize">{id}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">Scouts</div>
              <div className="space-y-2">
                {["Scout Login", "Submit Report", "Verification", "API Access"].map((item) => (
                  <div key={item} className="text-[12px] font-mono text-muted-foreground">{item}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row justify-between gap-2">
          <span className="text-[11px] font-mono text-muted-foreground">© 2025 Peach Basket · All Rights Reserved</span>
          <span className="text-[11px] font-mono text-muted-foreground">Built for Philippine Basketball</span>
        </div>
      </div>
    </footer>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState<View>("home");
  const [prevView, setPrevView] = useState<View>("rankings");
  const [selectedPlayerId, setSelectedPlayerId] = useState<number>(1);

  const handleViewPlayer = (id: number) => {
    setPrevView(view as View);
    setSelectedPlayerId(id);
    setView("player");
  };

  const handleBack = () => setView(prevView);
  const handleSearch = () => setView("search");

  const selectedPlayer = PLAYERS.find((p) => p.id === selectedPlayerId) ?? PLAYERS[0];

  return (
    <>
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
      `}</style>

      <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
        <Navigation view={view} setView={setView} onSearch={handleSearch} />
        <LiveTicker />

        {view === "home" && <HomePage onViewPlayer={handleViewPlayer} setView={setView} />}
        {view === "rankings" && <RankingsPage onViewPlayer={handleViewPlayer} />}
        {view === "player" && <PlayerProfilePage player={selectedPlayer} onBack={handleBack} />}
        {view === "games" && <GamesPage onViewPlayer={handleViewPlayer} />}
        {view === "league" && <LeaguePage />}
        {view === "search" && <SearchPage onViewPlayer={handleViewPlayer} />}

        <Footer setView={setView} />
      </div>
    </>
  );
}

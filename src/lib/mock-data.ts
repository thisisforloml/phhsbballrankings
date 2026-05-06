export type Position = "PG" | "SG" | "SF" | "PF" | "C";
export type AgeGroup = "U13" | "U16" | "U19";
export type Gender = "Boys" | "Girls";
export type Tier = 1 | 2 | 3 | 4;

export interface BoxScoreAverages {
  fgPct?: number;
  threePct?: number;
  ftPct?: number;
  astTo?: number;
  steals?: number;
  blocks?: number;
  offensiveRebounds?: number;
  defensiveRebounds?: number;
}

export interface GameResult {
  league: string;
  opponent: string;
  result: "W" | "L";
  points: number;
  assists?: number;
  rebounds?: number;
  performanceScore: number;
}

export interface LeagueHistory {
  leagueName: string;
  season: string;
  tier: Tier;
  gamesPlayed: number;
  avgPoints: number;
  avgAssists?: number;
  avgRebounds?: number;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  position: Position | null;
  city: string;
  region: string;
  birthYear?: number;
  ageGroup: AgeGroup;
  rating: number;
  stars: 1 | 2 | 3 | 4 | 5;
  gamesPlayed: number;
  isRankEligible: boolean;
  isVerified: boolean;
  isClaimed: boolean;
  nationalRank: number;
  regionalRank: number;
  cityRank: number;
  positionRank?: number;
  avgPoints: number;
  avgAssists?: number;
  avgRebounds?: number;
  school?: string;
  contactInfo?: string;
  photoUrl?: string;
  topLeague: string;
  topLeagueTier: Tier;
  weeklyTrend: "up" | "down" | "flat";
  trendDelta: number;
  boxScoreAverages?: BoxScoreAverages;
  lastFiveGames: GameResult[];
  leaguesPlayed: LeagueHistory[];
}

export interface League {
  id: string;
  name: string;
  organizerName: string;
  city: string;
  region: string;
  ageGroup: AgeGroup;
  gender: Gender;
  tier: Tier;
  isVerified: boolean;
  teamCount: number;
  gamesPerTeam: number;
  complianceRate: number;
  qualityScore: number;
  playerCount: number;
}

export interface ScoreGame {
  id: string;
  league: string;
  date: string;
  region: string;
  city: string;
  ageGroup: AgeGroup;
  gender: Gender;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  isVerified: boolean;
}

export interface Team {
  id: string;
  name: string;
  schoolClub: string;
  city: string;
  region: string;
  ageGroup: AgeGroup;
  gender: Gender;
  rating: number;
  wins: number;
  losses: number;
  ppg: number;
  topPlayer?: Player;
  league: string;
}

export const players: Player[] = [];
export const leagues: League[] = [{"id":"d721a82a-f182-4a54-983a-01453650ec9e","name":"UAAP Season 88 HS Boys Basketball","organizerName":"UAAP","city":"Quezon City","region":"NCR","ageGroup":"U19","gender":"Boys","tier":4,"isVerified":true,"teamCount":10,"gamesPerTeam":28,"complianceRate":100,"qualityScore":85,"playerCount":0},{"id":"ea377aba-7d8a-48b9-acb1-0ecaa1e12aef","name":"UAAP Season 88 HS Girls Basketball","organizerName":"UAAP","city":"Quezon City","region":"NCR","ageGroup":"U19","gender":"Girls","tier":4,"isVerified":true,"teamCount":5,"gamesPerTeam":5,"complianceRate":100,"qualityScore":85,"playerCount":0}];
export const scoreGames: ScoreGame[] = [{"id":"5ae24cec-dd13-41db-bab4-096525e7fc60","league":"UAAP Season 88 HS Boys Basketball","date":"March 1, 2026","region":"NCR","city":"Quezon City","ageGroup":"U19","gender":"Boys","homeTeam":"FEU Jrs (FEU)","awayTeam":"UE Jrs (UE)","homeScore":71,"awayScore":62,"isVerified":true},{"id":"59afb838-aadc-4b4f-82e4-b133bbc9d8a3","league":"UAAP Season 88 HS Boys Basketball","date":"February 1, 2026","region":"NCR","city":"Manila","ageGroup":"U19","gender":"Boys","homeTeam":"UE Jrs (UE)","awayTeam":"LA SALLE Jrs (LA SALLE)","homeScore":64,"awayScore":60,"isVerified":true},{"id":"be199f85-db86-4c61-a302-32c132233392","league":"UAAP Season 88 HS Boys Basketball","date":"February 1, 2026","region":"NCR","city":"Manila","ageGroup":"U19","gender":"Boys","homeTeam":"FEU Jrs (FEU)","awayTeam":"ADU Jrs (ADU)","homeScore":83,"awayScore":76,"isVerified":true},{"id":"bf4fc597-9dd2-41e4-a116-35a07c247df7","league":"UAAP Season 88 HS Boys Basketball","date":"February 1, 2026","region":"NCR","city":"Manila","ageGroup":"U19","gender":"Boys","homeTeam":"ATENEO JRS (ATENEO)","awayTeam":"UPIS Jrs (UP)","homeScore":96,"awayScore":70,"isVerified":true},{"id":"0663287b-e968-4ba9-9267-bbb31d66baf8","league":"UAAP Season 88 HS Boys Basketball","date":"January 29, 2026","region":"NCR","city":"San Juan","ageGroup":"U19","gender":"Boys","homeTeam":"UST Jrs (UST)","awayTeam":"UPIS Jrs (UP)","homeScore":112,"awayScore":57,"isVerified":true},{"id":"bf0cff94-d843-4791-846a-2657c649ea19","league":"UAAP Season 88 HS Boys Basketball","date":"January 29, 2026","region":"NCR","city":"San Juan","ageGroup":"U19","gender":"Boys","homeTeam":"NU Jrs (NU)","awayTeam":"UE Jrs (UE)","homeScore":84,"awayScore":78,"isVerified":true},{"id":"502049cb-77b1-43fe-bcc8-ce6542aa850f","league":"UAAP Season 88 HS Boys Basketball","date":"January 29, 2026","region":"NCR","city":"San Juan","ageGroup":"U19","gender":"Boys","homeTeam":"ADU Jrs (ADU)","awayTeam":"ATENEO JRS (ATENEO)","homeScore":77,"awayScore":73,"isVerified":true},{"id":"929b90c0-4a78-4aea-9384-1047df47c4b8","league":"UAAP Season 88 HS Boys Basketball","date":"January 29, 2026","region":"NCR","city":"San Juan","ageGroup":"U19","gender":"Boys","homeTeam":"FEU Jrs (FEU)","awayTeam":"LA SALLE Jrs (LA SALLE)","homeScore":79,"awayScore":61,"isVerified":true},{"id":"4c2f641f-77e0-46d3-82a4-5c95b29019ce","league":"UAAP Season 88 HS Girls Basketball","date":"January 25, 2026","region":"NCR","city":"Quezon City","ageGroup":"U19","gender":"Girls","homeTeam":"LA SALLE Girls (LA SALLE)","awayTeam":"ATENEO Girls (ATENEO)","homeScore":101,"awayScore":21,"isVerified":true},{"id":"b3aece89-88ff-4bbe-b33c-a009e085fd89","league":"UAAP Season 88 HS Boys Basketball","date":"January 25, 2026","region":"NCR","city":"Quezon City","ageGroup":"U19","gender":"Boys","homeTeam":"ATENEO JRS (ATENEO)","awayTeam":"UST Jrs (UST)","homeScore":100,"awayScore":88,"isVerified":true},{"id":"0e42d9bd-fb36-423c-8e45-ae1f974058e3","league":"UAAP Season 88 HS Boys Basketball","date":"January 25, 2026","region":"NCR","city":"Quezon City","ageGroup":"U19","gender":"Boys","homeTeam":"UE Jrs (UE)","awayTeam":"FEU Jrs (FEU)","homeScore":73,"awayScore":96,"isVerified":true},{"id":"aa8377fb-222c-48f3-9777-2dccb40679a9","league":"UAAP Season 88 HS Boys Basketball","date":"January 25, 2026","region":"NCR","city":"Quezon City","ageGroup":"U19","gender":"Boys","homeTeam":"LA SALLE Jrs (LA SALLE)","awayTeam":"ADU Jrs (ADU)","homeScore":71,"awayScore":45,"isVerified":true},{"id":"7ef8c016-b654-46a5-9a94-3aaa3eccbc76","league":"UAAP Season 88 HS Boys Basketball","date":"January 25, 2026","region":"NCR","city":"Quezon City","ageGroup":"U19","gender":"Boys","homeTeam":"UPIS Jrs (UP)","awayTeam":"NU Jrs (NU)","homeScore":41,"awayScore":124,"isVerified":true},{"id":"fe681942-cbc8-41d2-81df-ef9b82a29548","league":"UAAP Season 88 HS Boys Basketball","date":"January 22, 2026","region":"NCR","city":"San Juan","ageGroup":"U19","gender":"Boys","homeTeam":"UE Jrs (UE)","awayTeam":"ADU Jrs (ADU)","homeScore":67,"awayScore":68,"isVerified":true},{"id":"ba5085fd-5ca6-4866-9c64-4806f6aeedc4","league":"UAAP Season 88 HS Boys Basketball","date":"January 22, 2026","region":"NCR","city":"San Juan","ageGroup":"U19","gender":"Boys","homeTeam":"UPIS Jrs (UP)","awayTeam":"FEU Jrs (FEU)","homeScore":75,"awayScore":93,"isVerified":true},{"id":"ad9513c8-39df-4ade-9c85-f83b5f2966a7","league":"UAAP Season 88 HS Boys Basketball","date":"January 22, 2026","region":"NCR","city":"San Juan","ageGroup":"U19","gender":"Boys","homeTeam":"ATENEO JRS (ATENEO)","awayTeam":"NU Jrs (NU)","homeScore":86,"awayScore":63,"isVerified":true},{"id":"8b9b8b4f-b547-48f7-aa93-7eef2ce5a6ff","league":"UAAP Season 88 HS Boys Basketball","date":"January 22, 2026","region":"NCR","city":"San Juan","ageGroup":"U19","gender":"Boys","homeTeam":"LA SALLE Jrs (LA SALLE)","awayTeam":"UST Jrs (UST)","homeScore":72,"awayScore":67,"isVerified":true},{"id":"f3c73b50-b95a-471b-aee0-61ba29dfd542","league":"UAAP Season 88 HS Girls Basketball","date":"January 22, 2026","region":"NCR","city":"San Juan","ageGroup":"U19","gender":"Girls","homeTeam":"NU Girls (NU)","awayTeam":"LA SALLE Girls (LA SALLE)","homeScore":95,"awayScore":45,"isVerified":true},{"id":"ef252535-dce9-45cf-9149-7ca054096b94","league":"UAAP Season 88 HS Girls Basketball","date":"January 18, 2026","region":"NCR","city":"Quezon City","ageGroup":"U19","gender":"Girls","homeTeam":"UST Girls (UST)","awayTeam":"ATENEO Girls (ATENEO)","homeScore":136,"awayScore":32,"isVerified":true},{"id":"e6e85c3a-34fe-4537-8b00-076dafd4152a","league":"UAAP Season 88 HS Boys Basketball","date":"January 18, 2026","region":"NCR","city":"Quezon City","ageGroup":"U19","gender":"Boys","homeTeam":"UPIS Jrs (UP)","awayTeam":"UE Jrs (UE)","homeScore":72,"awayScore":92,"isVerified":true},{"id":"aedc742e-992c-4e65-9b7a-3ce9a38f8365","league":"UAAP Season 88 HS Boys Basketball","date":"January 18, 2026","region":"NCR","city":"Quezon City","ageGroup":"U19","gender":"Boys","homeTeam":"ATENEO JRS (ATENEO)","awayTeam":"LA SALLE Jrs (LA SALLE)","homeScore":80,"awayScore":65,"isVerified":true},{"id":"d14129cc-56f4-4fb7-850b-3a55f26d8f88","league":"UAAP Season 88 HS Boys Basketball","date":"January 18, 2026","region":"NCR","city":"Quezon City","ageGroup":"U19","gender":"Boys","homeTeam":"FEU Jrs (FEU)","awayTeam":"NU Jrs (NU)","homeScore":79,"awayScore":78,"isVerified":true},{"id":"13a67b40-7762-4b2d-ba9d-cfa3c2973b1b","league":"UAAP Season 88 HS Boys Basketball","date":"January 18, 2026","region":"NCR","city":"Quezon City","ageGroup":"U19","gender":"Boys","homeTeam":"ADU Jrs (ADU)","awayTeam":"UST Jrs (UST)","homeScore":70,"awayScore":79,"isVerified":true},{"id":"98217004-b12d-442f-ac8a-18cdeb27b2ee","league":"UAAP Season 88 HS Boys Basketball","date":"January 14, 2026","region":"NCR","city":"San Juan","ageGroup":"U19","gender":"Boys","homeTeam":"FEU Jrs (FEU)","awayTeam":"ATENEO JRS (ATENEO)","homeScore":71,"awayScore":90,"isVerified":true},{"id":"f4c073dd-0d14-457c-b2e3-a38df9daf6de","league":"UAAP Season 88 HS Boys Basketball","date":"January 14, 2026","region":"NCR","city":"San Juan","ageGroup":"U19","gender":"Boys","homeTeam":"UST Jrs (UST)","awayTeam":"UE Jrs (UE)","homeScore":102,"awayScore":107,"isVerified":true},{"id":"333a35b9-5fa2-434e-a94d-7bf3fc93e721","league":"UAAP Season 88 HS Boys Basketball","date":"January 14, 2026","region":"NCR","city":"San Juan","ageGroup":"U19","gender":"Boys","homeTeam":"ADU Jrs (ADU)","awayTeam":"UPIS Jrs (UP)","homeScore":71,"awayScore":47,"isVerified":true},{"id":"180868d9-2d8d-4598-81ff-f789d81eb333","league":"UAAP Season 88 HS Boys Basketball","date":"January 14, 2026","region":"NCR","city":"San Juan","ageGroup":"U19","gender":"Boys","homeTeam":"NU Jrs (NU)","awayTeam":"LA SALLE (DLSZ)","homeScore":60,"awayScore":50,"isVerified":true},{"id":"41e4d109-906a-4aa9-91cf-b40048333186","league":"UAAP Season 88 HS Girls Basketball","date":"January 14, 2026","region":"NCR","city":"San Juan","ageGroup":"U19","gender":"Girls","homeTeam":"UST Girls (UST)","awayTeam":"LA SALLE Girls (DLSU)","homeScore":90,"awayScore":59,"isVerified":true},{"id":"6ccdb6f3-eb2e-458d-84f8-512210a5ca03","league":"UAAP Season 88 HS Boys Basketball","date":"January 11, 2026","region":"NCR","city":"Quezon City","ageGroup":"U19","gender":"Boys","homeTeam":"DE LA SALLE Jrs (DLSU)","awayTeam":"UPIS Jrs (UP)","homeScore":98,"awayScore":42,"isVerified":true},{"id":"2af50d57-3ca3-431c-bf01-bee7c2db20e4","league":"UAAP Season 88 HS Boys Basketball","date":"January 11, 2026","region":"NCR","city":"Quezon City","ageGroup":"U19","gender":"Boys","homeTeam":"NU Jrs (NU)","awayTeam":"ADU Jrs (ADU)","homeScore":76,"awayScore":74,"isVerified":true},{"id":"acf5d0cb-df9a-4d02-b0dd-ce85b4a66925","league":"UAAP Season 88 HS Boys Basketball","date":"January 11, 2026","region":"NCR","city":"Quezon City","ageGroup":"U19","gender":"Boys","homeTeam":"UST Jrs (UST)","awayTeam":"FEU Jrs (FEU)","homeScore":78,"awayScore":82,"isVerified":true},{"id":"1a6cf9c6-6cf8-459e-8abe-138d8be27248","league":"UAAP Season 88 HS Boys Basketball","date":"January 11, 2026","region":"NCR","city":"Quezon City","ageGroup":"U19","gender":"Boys","homeTeam":"UE Jrs (UE)","awayTeam":"ATENEO JRS (ATENEO)","homeScore":84,"awayScore":91,"isVerified":true},{"id":"e6939e61-e519-4744-80f2-e55df30c1ed9","league":"UAAP Season 88 HS Girls Basketball","date":"January 11, 2026","region":"NCR","city":"Quezon City","ageGroup":"U19","gender":"Girls","homeTeam":"ATENEO Girls (ATENEO)","awayTeam":"NU Girls (NU)","homeScore":29,"awayScore":155,"isVerified":true}];
export const teams: Team[] = [{"id":"e9b2dc44-3103-4612-ab7a-5ce67e7ef6a8","name":"ADU Jrs (ADU)","schoolClub":"ADU Jrs (ADU)","city":"Quezon City","region":"NCR","ageGroup":"U19","gender":"Boys","rating":78.17,"wins":3,"losses":4,"ppg":68.7,"league":"UAAP Season 88 HS Boys Basketball"},{"id":"acb69a9e-e10c-4486-b3e1-9fe8c056c57c","name":"ATENEO Girls (ATENEO)","schoolClub":"ATENEO Girls (ATENEO)","city":"Quezon City","region":"NCR","ageGroup":"U19","gender":"Girls","rating":61.83,"wins":0,"losses":3,"ppg":27.3,"league":"UAAP Season 88 HS Girls Basketball"},{"id":"1f44864b-91c6-4b52-a1d3-1b88eee3b487","name":"ATENEO JRS (ATENEO)","schoolClub":"ATENEO JRS (ATENEO)","city":"Quezon City","region":"NCR","ageGroup":"U19","gender":"Boys","rating":89,"wins":6,"losses":1,"ppg":88,"league":"UAAP Season 88 HS Boys Basketball"},{"id":"4108ff02-d59f-41aa-9219-070d56cfa5bc","name":"DE LA SALLE Jrs (DLSU)","schoolClub":"DE LA SALLE Jrs (DLSU)","city":"Quezon City","region":"NCR","ageGroup":"U19","gender":"Boys","rating":81.5,"wins":1,"losses":0,"ppg":98,"league":"UAAP Season 88 HS Boys Basketball"},{"id":"b9efc141-ef1a-4214-aebf-3a9db0f2071d","name":"FEU Jrs (FEU)","schoolClub":"FEU Jrs (FEU)","city":"Manila","region":"NCR","ageGroup":"U19","gender":"Boys","rating":89.45,"wins":7,"losses":1,"ppg":81.8,"league":"UAAP Season 88 HS Boys Basketball"},{"id":"53650e64-ec1e-48cd-b2eb-5f575362e691","name":"LA SALLE (DLSZ)","schoolClub":"LA SALLE (DLSZ)","city":"San Juan","region":"NCR","ageGroup":"U19","gender":"Boys","rating":67.5,"wins":0,"losses":1,"ppg":50,"league":"UAAP Season 88 HS Boys Basketball"},{"id":"c010e83f-8a2d-4084-8497-0bea7119c6db","name":"LA SALLE Girls (DLSU)","schoolClub":"LA SALLE Girls (DLSU)","city":"San Juan","region":"NCR","ageGroup":"U19","gender":"Girls","rating":69.75,"wins":0,"losses":1,"ppg":59,"league":"UAAP Season 88 HS Girls Basketball"},{"id":"8b25947c-21d2-4878-a44f-32dc5160b5bd","name":"LA SALLE Girls (LA SALLE)","schoolClub":"LA SALLE Girls (LA SALLE)","city":"San Juan","region":"NCR","ageGroup":"U19","gender":"Girls","rating":75.25,"wins":1,"losses":1,"ppg":73,"league":"UAAP Season 88 HS Girls Basketball"},{"id":"8f999ac0-0823-4eac-91af-842957c026ff","name":"LA SALLE Jrs (LA SALLE)","schoolClub":"LA SALLE Jrs (LA SALLE)","city":"Quezon City","region":"NCR","ageGroup":"U19","gender":"Boys","rating":75.45,"wins":2,"losses":3,"ppg":65.8,"league":"UAAP Season 88 HS Boys Basketball"},{"id":"9ebec3dc-2e89-4a32-9326-54297c71f8bc","name":"NU Girls (NU)","schoolClub":"NU Girls (NU)","city":"Quezon City","region":"NCR","ageGroup":"U19","gender":"Girls","rating":90.25,"wins":2,"losses":0,"ppg":125,"league":"UAAP Season 88 HS Girls Basketball"},{"id":"d81d5179-b450-4eba-b7a2-07f558a9268c","name":"NU Jrs (NU)","schoolClub":"NU Jrs (NU)","city":"Quezon City","region":"NCR","ageGroup":"U19","gender":"Boys","rating":83.2,"wins":4,"losses":2,"ppg":80.8,"league":"UAAP Season 88 HS Boys Basketball"},{"id":"e560fa7d-c846-465b-98b4-7704cb17416b","name":"UE Jrs (UE)","schoolClub":"UE Jrs (UE)","city":"Manila","region":"NCR","ageGroup":"U19","gender":"Boys","rating":80.6,"wins":3,"losses":5,"ppg":78.4,"league":"UAAP Season 88 HS Boys Basketball"},{"id":"e8e50710-0e6a-4482-ae1d-452b3471fdde","name":"UPIS Jrs (UP)","schoolClub":"UPIS Jrs (UP)","city":"Quezon City","region":"NCR","ageGroup":"U19","gender":"Boys","rating":69.42,"wins":0,"losses":7,"ppg":57.7,"league":"UAAP Season 88 HS Boys Basketball"},{"id":"8d66d8b4-c047-4257-b3b7-3d87b1a09aa3","name":"UST Girls (UST)","schoolClub":"UST Girls (UST)","city":"San Juan","region":"NCR","ageGroup":"U19","gender":"Girls","rating":87.25,"wins":2,"losses":0,"ppg":113,"league":"UAAP Season 88 HS Girls Basketball"},{"id":"7c2934ce-f07a-4f5c-af9e-d3d291b7428c","name":"UST Jrs (UST)","schoolClub":"UST Jrs (UST)","city":"Quezon City","region":"NCR","ageGroup":"U19","gender":"Boys","rating":80.92,"wins":2,"losses":4,"ppg":87.7,"league":"UAAP Season 88 HS Boys Basketball"}];

export const regions: string[] = ["NCR"];
export const ageGroups: AgeGroup[] = ["U13", "U16", "U19"];
export const genders: Gender[] = ["Boys", "Girls"];
export const positions: Position[] = ["PG", "SG", "SF", "PF", "C"];

export function eligibilityMinimum(gender: Gender) {
  return gender === "Girls" ? 8 : 10;
}

function withRanks(list: Player[]) {
  const ranked = [...list].sort((a, b) => b.rating - a.rating);
  return ranked.map((player, index) => ({
    ...player,
    nationalRank: index + 1,
    positionRank: player.position ? ranked.filter((item) => item.position === player.position).findIndex((item) => item.id === player.id) + 1 : undefined
  }));
}

export function getPlayersByAgeGroup(ageGroup: AgeGroup, gender?: Gender) {
  return withRanks(players.filter((player) => player.ageGroup === ageGroup).filter((player) => !gender || player.gender === gender).filter((player) => player.gamesPlayed >= eligibilityMinimum(player.gender)));
}

export function getPlayersByFilters(filters: {
  ageGroup?: AgeGroup;
  gender?: Gender;
  region?: string;
  city?: string;
  minimumGames?: number;
  position?: "All" | Position;
}) {
  return withRanks(players)
    .filter((player) => !filters.ageGroup || player.ageGroup === filters.ageGroup)
    .filter((player) => !filters.gender || player.gender === filters.gender)
    .filter((player) => !filters.region || filters.region === "All" || player.region === filters.region)
    .filter((player) => !filters.city || filters.city === "All" || player.city === filters.city)
    .filter((player) => player.gamesPlayed >= (filters.minimumGames ?? eligibilityMinimum(player.gender)))
    .filter((player) => !filters.position || filters.position === "All" || player.position === filters.position);
}

export function getPlayerById(id: string) {
  return players.find((player) => player.id === id);
}

export function getLeagueById(id: string) {
  return leagues.find((league) => league.id === id);
}

export function formatPlayerName(player: Player) {
  return `${player.firstName} ${player.lastName}`.trim();
}

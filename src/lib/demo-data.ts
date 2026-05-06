export const boysLeaderboardMinimumGames = 10;
export const girlsLeaderboardMinimumGames = 8;

export function leaderboardMinimumGamesForGender(gender: string) {
  return gender === "GIRLS" || gender === "Girls" ? girlsLeaderboardMinimumGames : boysLeaderboardMinimumGames;
}

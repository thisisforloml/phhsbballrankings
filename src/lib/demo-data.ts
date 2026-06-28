export {
  LAUNCH_POLICY_V1,
  LAUNCH_POLICY_V1_ID,
  leaderboardMinimumGamesForGender,
  publicBoardMinimumGames
} from "@/lib/eligibility/launch-policy";

import { LAUNCH_POLICY_V1 } from "@/lib/eligibility/launch-policy";

export const boysLeaderboardMinimumGames = LAUNCH_POLICY_V1.boysLaunchThreshold;
export const girlsLeaderboardMinimumGames = LAUNCH_POLICY_V1.girlsLaunchThreshold;

import { Suspense } from "react";
import { PlayerCompareClient } from "./PlayerCompareClient";

export const metadata = {
  title: "Compare Players",
  description: "Head-to-head player comparison on Peach Basket Rankings PH."
};

export default function PlayerComparePage() {
  return (
    <Suspense fallback={<div className="container-px py-10 text-sm font-semibold text-court-600">Loading compare view…</div>}>
      <PlayerCompareClient />
    </Suspense>
  );
}

export function WinLossPill({ result }: { result: "W" | "L" }) {
  return (
    <span className={`inline-grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-white ${result === "W" ? "bg-win-pill" : "bg-loss-pill"}`}>
      {result}
    </span>
  );
}

import { BarChart3, Scale, ShieldCheck, Users } from "lucide-react";

const items = [
  { title: "Production Score", description: "Box score output is normalized by role, pace, and minutes. Points are required, and submitted metrics such as field goal percentage, steals, blocks, turnovers, offensive rebounds, and defensive rebounds add rating confidence.", formula: "PTS · REB · AST · box score context", Icon: BarChart3 },
  { title: "League Weight", description: "Peach Basket scores leagues by governance, team count, season volume, and statistical compliance. Stronger league environments carry more signal in the national rating.", formula: "competition weight", Icon: ShieldCheck },
  { title: "Opponent Factor", description: "Production against stronger opponents is worth more. The model rewards performance that survives better competition.", formula: "opponent strength", Icon: Scale },
  { title: "Team Context", description: "Teammate quality and role share help prevent team strength from being mistaken for individual quality.", formula: "lineup adjustment", Icon: Users }
];

export function RatingExplainer() {
  return (
    <section id="rating-model" className="bg-navy-800 py-14 text-white lg:py-20">
      <div className="container-px">
        <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">How Ratings Work</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {items.map(({ title, description, formula, Icon }) => (
            <article key={title} className="rounded-lg border border-white/15 bg-white/10 p-6">
              <Icon className="h-6 w-6 text-amber-500" aria-hidden="true" />
              <h3 className="mt-5 font-display text-2xl font-bold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/70">{description}</p>
              <code className="mt-5 block rounded-md bg-navy-950 px-3 py-2 font-mono text-mono-sm text-amber-500">{formula}</code>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

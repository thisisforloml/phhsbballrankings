import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { formatHeight, getPlayerProfileHref } from "@/lib/format";
import { getClassYear } from "@/lib/ranking-eligibility";
import { ProgramEditor, TeamMonikerForm, type ProgramEditorData, type TeamEditorData } from "./ProgramDetailClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function aliasesToStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function inferGender(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase().includes("girls") ? "Girls" : "Boys";
}

function classYearLabel(birthDate: Date | null, override: number | null) {
  const year = override ?? getClassYear(birthDate);
  return year ? `Class of ${year}` : "Not listed";
}

function contextForTeam(team: NonNullable<Awaited<ReturnType<typeof loadProgram>>["program"]>["teams"][number]) {
  const contexts = new Set<string>();
  for (const game of [...team.homeGames, ...team.awayGames]) {
    contexts.add(`${game.season.league.ageGroup} ${inferGender(game.season.league.name, team.name)} / ${game.season.league.name} / ${game.season.name}`);
  }
  return Array.from(contexts).sort().join(" | ") || "No active official context";
}

async function loadProgram(id: string) {
  const program = await prisma.program.findFirst({
    where: { id, deletedAt: null },
    include: {
      teams: {
        where: { deletedAt: null },
        include: {
          homeGames: { where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } }, include: { season: { include: { league: true } } } },
          awayGames: { where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } }, include: { season: { include: { league: true } } } },
          gameStats: {
            where: { deletedAt: null, game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } },
            include: { player: { include: { currentProgram: true } } }
          }
        },
        orderBy: { name: "asc" }
      }
    }
  });
  return { program };
}

export default async function AdminProgramDetailPage({ params }: { params: { id: string } }) {
  await requireAdminUser();
  const { program } = await loadProgram(params.id);
  if (!program) notFound();

  const programData: ProgramEditorData = {
    id: program.id,
    fullName: program.fullName,
    abbreviation: program.abbreviation,
    type: program.type,
    city: program.city,
    region: program.region,
    aliasesText: aliasesToStrings(program.aliases).join("\n")
  };

  const teamRows: TeamEditorData[] = program.teams.map((team) => ({
    id: team.id,
    name: team.name,
    context: contextForTeam(team),
    officialGames: new Set([...team.homeGames, ...team.awayGames].map((game) => game.id)).size,
    gameStats: team.gameStats.length
  }));

  const playerMap = new Map<string, {
    id: string;
    displayName: string;
    gender: string;
    currentProgram: string;
    derivedProgram: string;
    classYear: string;
    position: string;
    height: string;
  }>();

  for (const team of program.teams) {
    for (const stat of team.gameStats) {
      if (!playerMap.has(stat.player.id)) {
        playerMap.set(stat.player.id, {
          id: stat.player.id,
          displayName: stat.player.displayName,
          gender: stat.player.gender,
          currentProgram: stat.player.currentProgram?.fullName ?? "Derived only",
          derivedProgram: program.fullName,
          classYear: classYearLabel(stat.player.birthDate, stat.player.classYearOverride),
          position: stat.player.position ?? "Not listed",
          height: formatHeight(stat.player.heightCm)
        });
      }
    }
  }

  const players = Array.from(playerMap.values()).sort((left, right) => left.displayName.localeCompare(right.displayName));
  const officialGames = teamRows.reduce((sum, team) => sum + team.officialGames, 0);
  const gameStats = teamRows.reduce((sum, team) => sum + team.gameStats, 0);

  return (
    <main className="min-h-screen bg-surface-50 pt-20">
      <div className="grid lg:grid-cols-[17rem_1fr]">
        <AdminSidebar active="programs" />
        <section className="container-px grid gap-6 py-8">
          <Link href="/admin/programs" className="text-sm font-semibold text-amber-700 hover:text-amber-800">Back to Program Management</Link>
          <div className="rounded-lg border border-surface-200 bg-white p-6 shadow-panel">
            <p className="label">Program Detail</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-stat-md text-navy-800">{program.fullName}</h1>
                <p className="mt-2 text-ink-600">{program.abbreviation || "No abbreviation"} / {program.type} / {[program.city, program.region].filter(Boolean).join(", ") || "Location not listed"}</p>
              </div>
              <div className="flex flex-wrap gap-2 font-mono text-mono-sm uppercase text-ink-600"><span>{teamRows.length} teams</span><span>{players.length} players</span><span>{officialGames} official games</span><span>{gameStats} stat rows</span></div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(26rem,0.9fr)_minmax(34rem,1.1fr)]">
            <ProgramEditor program={programData} />
            <section className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
              <p className="label">Transfer status</p>
              <h2 className="mt-2 font-display text-3xl text-navy-800">Player transfers</h2>
              <p className="mt-2 rounded-md bg-amber-50 p-4 text-sm text-amber-900">Player transfer history will be added in the next stage. Players below are derived from linked teams' active official GameStats. No Player.currentProgramId writes happen here.</p>
            </section>
          </div>

          <section className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-3xl text-navy-800">Teams / Monikers</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {teamRows.map((team) => <TeamMonikerForm key={team.id} programId={program.id} team={team} />)}
              {!teamRows.length ? <p className="text-sm text-ink-600">No teams linked to this Program.</p> : null}
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-surface-200 bg-white shadow-sm">
            <div className="border-b border-surface-200 p-5">
              <h2 className="font-display text-3xl text-navy-800">Derived Players</h2>
              <p className="mt-1 text-sm text-ink-600">Derived from active official GameStats for linked teams.</p>
            </div>
            <div className="hidden grid-cols-[1.4fr_7rem_1fr_9rem_8rem_9rem_8rem] gap-3 border-b border-surface-200 px-4 py-3 font-mono text-mono-sm uppercase text-ink-500 lg:grid">
              <span>Player</span><span>Gender</span><span>Current program</span><span>Class</span><span>Position</span><span>Height</span><span>Links</span>
            </div>
            {players.map((player) => (
              <div key={player.id} className="grid gap-2 border-b border-surface-200 px-4 py-4 last:border-b-0 lg:grid-cols-[1.4fr_7rem_1fr_9rem_8rem_9rem_8rem] lg:items-center">
                <strong className="text-ink-900">{player.displayName}</strong>
                <span className="font-mono text-sm text-ink-600">{player.gender}</span>
                <span className="text-sm text-ink-600">{player.currentProgram}</span>
                <span className="text-sm text-ink-600">{player.classYear}</span>
                <span className="text-sm text-ink-600">{player.position}</span>
                <span className="text-sm text-ink-600">{player.height}</span>
                <span className="flex flex-wrap gap-2 text-sm"><Link className="font-semibold text-amber-700" href="/admin/players">Edit</Link><Link className="font-semibold text-navy-700" href={getPlayerProfileHref({ id: player.id, displayName: player.displayName })}>Profile</Link></span>
              </div>
            ))}
            {!players.length ? <p className="p-5 text-sm text-ink-600">No active players derived from linked team stats.</p> : null}
          </section>
        </section>
      </div>
    </main>
  );
}
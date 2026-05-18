const fs = require('fs');
const path = require('path');

const reportPath = path.join(process.cwd(), 'scripts', 'reports', 'duplicate-player-diagnostic-round-2.json');
const outputPath = path.join(process.cwd(), 'scripts', 'reports', 'approved-player-merge-plan-round-2.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

const canonicalByGroup = new Map([
  [1, 'Audrey Biongcog'],
  [2, null],
  [3, 'John Dexter Santos'],
  [4, 'Rhon-J Matias'],
  [5, null]
]);

const groups = report.reports.map((group) => {
  if (group.suspectedDuplicatePlayersAppearInSameGame) {
    return { excluded: true, group: group.group, reason: 'Same-game conflict detected.' };
  }

  const activeRecords = group.playerRecords.filter((player) => player.deletedAt === null);
  const canonicalName = canonicalByGroup.get(group.group);
  let canonical = canonicalName
    ? activeRecords.find((player) => player.displayName === canonicalName)
    : activeRecords.find((player) => player.playerId === group.recommendedCanonicalPlayer?.playerId);

  if (!canonical) {
    return { excluded: true, group: group.group, reason: 'Canonical player not found among active records.' };
  }

  const duplicates = activeRecords.filter((player) => player.playerId !== canonical.playerId);
  if (!duplicates.length) {
    return { excluded: true, group: group.group, reason: 'No duplicate active player records found.' };
  }

  return {
    group: group.group,
    canonicalPlayerId: canonical.playerId,
    canonicalPlayerDisplayName: canonicalName ?? canonical.displayName,
    duplicatePlayerIds: duplicates.map((player) => player.playerId),
    duplicatePlayerDisplayNames: duplicates.map((player) => player.displayName),
    approved: true,
    reason: 'User-confirmed duplicate abbreviation/name variant',
    sameGameConflict: false
  };
});

const approvedGroups = groups.filter((group) => !group.excluded);
const excludedGroups = groups.filter((group) => group.excluded);
const output = {
  generatedAt: new Date().toISOString(),
  sourceReportPath: reportPath,
  approvedGroups,
  excludedGroups,
  approvedGroupsCount: approvedGroups.length,
  excludedGroupsCount: excludedGroups.length,
  totalDuplicatePlayersApproved: approvedGroups.reduce((sum, group) => sum + group.duplicatePlayerIds.length, 0)
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
console.log(JSON.stringify({
  planPath: outputPath,
  approvedGroupsCount: output.approvedGroupsCount,
  excludedGroupsCount: output.excludedGroupsCount,
  totalDuplicatePlayersApproved: output.totalDuplicatePlayersApproved,
  excludedGroups
}, null, 2));
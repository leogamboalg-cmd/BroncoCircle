const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const interests = profile => [...new Set((profile.interests || []).map(s => s.trim().toLowerCase()).filter(Boolean))].sort();
const minutes = time => /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : NaN;
const clock = n => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

function slots(profile) {
  const result = [];
  for (const day of days) {
    const ranges = (profile.availability || []).filter(s => s.day?.toLowerCase() === day.toLowerCase())
      .map(s => ({ day, start: minutes(s.start), end: minutes(s.end) }))
      .filter(s => s.start < s.end).sort((a, b) => a.start - b.start);
    for (const range of ranges) {
      const previous = result.at(-1);
      if (previous?.day === day && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
      else result.push(range);
    }
  }
  return result;
}

export function summarizeGroup(profiles) {
  if (!profiles.length) return { sharedInterests: [], sharedAvailability: [], overlapMinutes: 0 };
  let commonInterests = interests(profiles[0]);
  let commonSlots = slots(profiles[0]);
  for (const profile of profiles.slice(1)) {
    const values = new Set(interests(profile));
    commonInterests = commonInterests.filter(value => values.has(value));
    const other = slots(profile);
    commonSlots = commonSlots.flatMap(a => other.filter(b => a.day === b.day)
      .map(b => ({ day: a.day, start: Math.max(a.start, b.start), end: Math.min(a.end, b.end) })))
      .filter(s => s.end - s.start >= 30);
  }
  commonSlots = commonSlots.filter(s => s.end - s.start >= 30);
  return {
    sharedInterests: commonInterests,
    sharedAvailability: commonSlots.map(s => ({ day: s.day, start: clock(s.start), end: clock(s.end) })),
    overlapMinutes: commonSlots.reduce((sum, s) => sum + s.end - s.start, 0),
  };
}

const viable = summary => summary.sharedInterests.length > 0 && summary.overlapMinutes >= 30;
const quality = summary => summary.sharedInterests.length * 10000 + summary.overlapMinutes;

export function suggestGroups(current, candidates) {
  const pool = candidates.filter(p => String(p._id) !== String(current._id))
    .sort((a, b) => String(a._id).localeCompare(String(b._id)));
  const groups = new Map();
  for (const seed of pool) {
    const group = [current, seed];
    if (!viable(summarizeGroup(group))) continue;
    while (group.length < 6) {
      const next = pool.filter(p => !group.includes(p)).map(profile => ({ profile, summary: summarizeGroup([...group, profile]) }))
        .filter(item => viable(item.summary)).sort((a, b) => quality(b.summary) - quality(a.summary)
          || String(a.profile._id).localeCompare(String(b.profile._id)))[0];
      if (!next) break;
      group.push(next.profile);
    }
    const summary = summarizeGroup(group);
    const key = group.map(p => String(p._id)).sort().join(":");
    const first = summary.sharedAvailability[0];
    groups.set(key, {
      candidateIds: group.map(p => String(p._id)),
      members: group.map(p => ({ _id: p._id, name: p.name, major: p.major })),
      ...summary,
      smallGroup: group.length < 4,
      reason: `Everyone shares ${summary.sharedInterests.join(", ")} and is free ${first.day} ${first.start}–${first.end}.`,
    });
  }
  return [...groups.entries()].sort(([keyA, a], [keyB, b]) => b.members.length - a.members.length
    || quality(b) - quality(a) || keyA.localeCompare(keyB)).slice(0, 5).map(([, group]) => group);
}

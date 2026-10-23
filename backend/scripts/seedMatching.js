import { connectDB, db } from "../db.js";
import { connectModels, Account, Profile, Post } from "../models/index.js";
import { hashPassword } from "../services/authService.js";
import { suggestGroups } from "../services/matchingService.js";
import { matchingFixtures, matchingPostFixtures, DEMO_PASSWORD } from "./matchingFixtures.js";

const fixtures = matchingFixtures();

async function main() {
  const preview = process.argv.includes("--preview");
  if (process.argv.slice(2).some(arg => arg !== "--preview")) throw new Error("Usage: npm run seed:matching [-- --preview]");
  // Validate fixtures using real schemas before writing any records.
  for (const { account, profile } of fixtures) {
    await new Account({ ...account, passwordHash: "fixture-placeholder" }).validate();
    await new Profile(profile).validate();
  }
  for (const post of matchingPostFixtures()) await new Post(post).validate();

  if (preview) {
    console.log("Preview only: no database connection or writes.");
  } else {
    if (!process.env.MONGODB_URI && !process.env.MONGO_URI) throw new Error("Set MONGODB_URI in backend/.env first.");
    await connectDB();
    connectModels();
    await Account.createIndexes();
    await Profile.createIndexes();
    for (const { account, profile } of fixtures) {
      await Account.updateOne({ _id: account._id }, { $setOnInsert: {
        ...account, passwordHash: await hashPassword(DEMO_PASSWORD), createdAt: new Date(),
      } }, { upsert: true });
      await Profile.updateOne({ _id: profile._id }, { $setOnInsert: profile }, { upsert: true });
    }
    for (const post of matchingPostFixtures()) {
      await Post.updateOne({ _id: post._id }, { $setOnInsert: { ...post, createdAt: new Date() } }, { upsert: true });
    }
    console.log("Demo records ensured: 11 accounts, 11 profiles, and 2 posts. Existing records/edits were preserved.");
  }

  console.table(fixtures.map(({ account, profile }) => ({
    email: account.email, profileId: String(profile._id), matching: profile.matchingEnabled,
  })));
  console.log(`New demo account password: ${DEMO_PASSWORD}`);
  const profiles = preview ? fixtures.map(f => f.profile) : await Profile.find({ _id: { $in: fixtures.map(f => f.profile._id) } });
  const eligible = profiles.filter(p => p.matchingEnabled);
  for (const key of ["alex", "casey", "avery", "riley", "quinn", "drew"]) {
    const current = profiles.find(p => String(p._id) === String(fixtures.find(f => f.key === key).profile._id));
    const suggestions = suggestGroups(current, eligible);
    console.log(`\n${current.name}: ${suggestions.length} demo-only suggestion(s)`);
    for (const group of suggestions) console.log(`  ${group.members.map(p => p.name).join(", ")}: ${group.reason}`);
  }
  console.log("\nLog in through POST /api/auth/login or the frontend. No circles were pre-created; accept a suggestion to test joining.");
}

try { await main(); }
catch (error) {
  // Avoid printing connection strings or provider error objects.
  console.error(`Seed failed (${error.name}). Check MongoDB connectivity, indexes, and whether demo IDs/emails already conflict.`);
  process.exitCode = 1;
} finally {
  if (db) await db.client.close();
}

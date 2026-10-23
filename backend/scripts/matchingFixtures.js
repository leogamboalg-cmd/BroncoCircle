import { createHash } from "node:crypto";
import { Types } from "mongoose";

export const DEMO_PASSWORD = "BroncoDemo123!";
export const demoId = key => new Types.ObjectId(createHash("sha256").update(`broncocircle-matching-demo-v1:${key}`).digest("hex").slice(0, 24));

const students = [
  ["alex", "Alex", "Computer Science", ["Soccer", "study buddies"], "Thursday", "12:00", "13:30", true],
  ["jordan", "Jordan", "Mechanical Engineering", [" soccer ", "gym"], "Thursday", "12:15", "13:15", true],
  ["sam", "Sam", "Biology", ["soccer", "music"], "Thursday", "12:30", "13:30", true],
  ["taylor", "Taylor", "Business", ["SOCCER", "hiking"], "Thursday", "12:00", "13:00", true],
  ["casey", "Casey", "Computer Science", ["gaming", "anime"], "Friday", "15:00", "16:00", true],
  ["morgan", "Morgan", "Art", ["Gaming", "drawing"], "Friday", "15:30", "16:30", true],
  ["avery", "Avery", "Architecture", ["soccer"], "Monday", "12:00", "13:00", true],
  ["riley", "Riley", "Chemistry", ["chess"], "Thursday", "12:00", "13:30", true],
  ["quinn", "Quinn", "Psychology", ["soccer"], "Thursday", "13:10", "14:00", true],
  ["jamie", "Jamie", "Mathematics", ["soccer"], "Thursday", "12:00", "13:30", false],
  ["drew", "Drew", "History", ["soccer"], null, null, null, true],
];

export function matchingFixtures() {
  return students.map(([key, name, major, interests, day, start, end, matchingEnabled]) => ({
    key,
    account: { _id: demoId(`account:${key}`), name, email: `${key}@matching-demo.example` },
    profile: { _id: demoId(`profile:${key}`), account: demoId(`account:${key}`), name, major,
      interests, availability: day ? [{ day, start, end }] : [], matchingEnabled },
  }));
}

export function matchingPostFixtures() {
  return [
    { _id: demoId("post:soccer"), author: demoId("profile:alex"), text: "[Matching demo] Anyone up for soccer and lunch on Thursday?",
      likes: [demoId("profile:jordan"), demoId("profile:sam")],
      comments: [{ _id: demoId("comment:soccer"), author: demoId("profile:taylor"), text: "I am free at 12:30!" }] },
    { _id: demoId("post:gaming"), author: demoId("profile:casey"), text: "[Matching demo] Looking for Friday gaming friends.",
      likes: [demoId("profile:morgan")], comments: [] },
  ];
}

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import { Types } from "mongoose";
import { connectDB, db } from "../db.js";

const origin = `http://127.0.0.1:${process.env.PORT || 3000}`;
const tag = `browser-${randomUUID()}`;
const password = `Browser-${randomUUID()}`;
const accounts = [], profiles = [], posts = [], results = [], errors = [];
let browser;
async function check(name, fn) {
  try { await fn(); results.push({ name, passed: true }); console.log(`PASS: ${name}`); }
  catch (error) { results.push({ name, passed: false, error: error.message }); throw error; }
}
async function api(path, token, body) {
  const response = await fetch(`${origin}/api${path}`, {
    method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
  });
  assert.ok(response.ok, `${path}: ${response.status}`); return response.json();
}
async function main() {
  await connectDB(); assert.ok(db);
  const users = [];
  for (const name of ["Host", "Guest"]) {
    const email = `${tag}-${name.toLowerCase()}@browser-test.example`;
    const account = await api("/auth/signup", undefined, { name: `Browser ${name}`, email, password });
    accounts.push(new Types.ObjectId(account.account._id));
    const profile = await api("/profiles", account.token, { name: `Browser ${name}`, major: "Testing" });
    profiles.push(new Types.ObjectId(profile._id));
    users.push({ email, token: account.token });
  }
  const event = await api("/posts", users[0].token, {
    text: "A simple live browser test.", event: { title: "Coffee <em>test</em>", location: "BSC café patio",
      dateTime: "2026-11-01T20:00:00Z", endTime: "2026-11-01T21:00:00Z", capacity: 1,
      category: "Coffee", hostNote: "Look for the green notebook." },
  });
  posts.push(new Types.ObjectId(event._id));
  const plain = await api("/posts", users[0].token, { text: "Plain post stays plain." });
  posts.push(new Types.ObjectId(plain._id));
  const executablePath = process.env.BROWSER_PATH || [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find(existsSync);
  assert.ok(executablePath, "Set BROWSER_PATH to an installed Chromium browser executable");
  browser = await chromium.launch({ executablePath, headless: true });
  const a = await browser.newContext();
  const b = await browser.newContext({ viewport: { width: 390, height: 844 } });
  for (const context of [a, b]) context.on("page", page => page.on("pageerror", error => errors.push(error.message)));
  await b.addInitScript(({ token, origin }) => {
    if (location.origin === origin) sessionStorage.setItem("broncocircle-token", token);
  }, { token: users[1].token, origin });
  const host = await a.newPage(), guest = await b.newPage();
  const url = `${origin}/event.html?id=${event._id}`;
  await check("Logged-out event page offers login", async () => {
    await host.goto(url);
    await host.locator("#event-login").waitFor({ state: "visible" });
    assert.match(await host.locator("#event-status").innerText(), /Log in/);
    assert.equal(await host.locator("#event-detail").isVisible(), false);
  });
  await check("Login returns user to the event", async () => {
    await host.locator("#event-login").click();
    await host.locator('#account-form [name="email"]').fill(users[0].email);
    await host.locator('#account-form [name="password"]').fill(password);
    await host.locator('#account-form button[value="login"]').click();
    await host.waitForURL(url);
    await host.locator("#event-detail").waitFor({ state: "visible" });
  });
  await check("Details render safely and optional cover remains hidden", async () => {
    assert.equal(await host.locator("#event-title").innerText(), "Coffee <em>test</em>");
    assert.equal(await host.locator("#event-title em").count(), 0);
    assert.match(await host.locator("#event-time").innerText(), /PST/);
    assert.equal(await host.locator("#event-location").innerText(), "BSC café patio");
    assert.equal(await host.locator("#event-note").innerText(), "Look for the green notebook.");
    assert.equal(await host.locator("#event-cover").isVisible(), false);
  });
  await guest.goto(url); await guest.locator("#event-detail").waitFor({ state: "visible" });
  await check("Browser RSVP updates name, count, and cancel button", async () => {
    await host.locator("#event-rsvp").click();
    await host.waitForFunction(() => document.getElementById("event-rsvp").textContent.includes("Cancel RSVP"));
    assert.match(await host.locator("#event-attendance").innerText(), /1 of 1/);
    assert.match(await host.locator("#event-attendees").innerText(), /Browser Host/);
  });
  await check("Stale guest RSVP handles full-event conflict and disables button", async () => {
    await guest.locator("#event-rsvp").click();
    await guest.waitForFunction(() => document.getElementById("event-rsvp").textContent === "Event is full");
    assert.equal(await guest.locator("#event-rsvp").isDisabled(), true);
    assert.match(await guest.locator("#event-status").innerText(), /full/);
  });
  await check("Cancel frees the spot and refresh lets another account join", async () => {
    await host.locator("#event-rsvp").click();
    await host.waitForFunction(() => document.getElementById("event-status").textContent === "RSVP cancelled.");
    await guest.locator("#event-refresh").click();
    await guest.waitForFunction(() => document.getElementById("event-rsvp").textContent === "RSVP" && !document.getElementById("event-rsvp").disabled);
    await guest.locator("#event-rsvp").click();
    await guest.waitForFunction(() => document.getElementById("event-rsvp").textContent.includes("Cancel RSVP"));
    await host.locator("#event-refresh").click();
    await host.waitForFunction(() => document.getElementById("event-rsvp").textContent === "Event is full");
    assert.match(await host.locator("#event-attendees").innerText(), /Browser Guest/);
  });
  await check("Mobile page fits viewport", async () => {
    assert.ok(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  });
  await check("Refresh retains attendance from MongoDB", async () => {
    await guest.reload(); await guest.locator("#event-detail").waitFor({ state: "visible" });
    assert.match(await guest.locator("#event-rsvp").innerText(), /Cancel RSVP/);
    assert.equal((await db.collection("posts").findOne({ _id: posts[0] })).event.attendees.length, 1);
  });
  await check("Feed links open the live event details", async () => {
    await host.goto(`${origin}/`);
    const link = host.locator(`#posts a[href="/event.html?id=${event._id}"]`);
    await link.waitFor({ state: "visible" }); await link.click();
    await host.locator("#event-detail").waitFor({ state: "visible" });
  });
  await check("Invalid, missing, and non-event links have clear errors", async () => {
    await host.goto(`${origin}/event.html?id=bad`);
    await host.waitForFunction(() => document.getElementById("event-status").textContent.includes("invalid"));
    await host.goto(`${origin}/event.html?id=${new Types.ObjectId()}`);
    await host.waitForFunction(() => document.getElementById("event-status").textContent.includes("not found"));
    await host.goto(`${origin}/event.html?id=${plain._id}`);
    await host.waitForFunction(() => document.getElementById("event-status").textContent.includes("not an event"));
  });
  await check("No browser JavaScript exceptions", async () => assert.deepEqual(errors, []));
}

try { await main(); }
catch (error) {
  console.error(`Browser test failed: ${error.message}`); process.exitCode = 1;
  if (!results.some(r => !r.passed)) results.push({ name: "Browser setup", passed: false, error: error.name });
} finally {
  if (browser) await browser.close();
  if (db) {
    await db.collection("posts").deleteMany({ _id: { $in: posts } });
    await db.collection("profiles").deleteMany({ _id: { $in: profiles } });
    await db.collection("accounts").deleteMany({ _id: { $in: accounts }, email: { $regex: `^${tag}-` } });
    await db.client.close();
  }
  await writeFile(new URL("../browser-test-report.json", import.meta.url), JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
  console.log(`${results.filter(r => r.passed).length}/${results.length} browser checks passed. Temporary records removed.`);
}

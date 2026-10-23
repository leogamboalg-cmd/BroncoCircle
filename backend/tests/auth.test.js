import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import Account from "../models/Account.js";
import auth from "../routes/auth.js";
import { hashToken, verifyPassword } from "../services/authService.js";

test("signup, login, and bearer authentication", async (t) => {
  const accounts = [];
  t.mock.method(Account, "createIndexes", async () => {});
  t.mock.method(Account.prototype, "save", async function () {
    if (accounts.some(a => a !== this && a.email === this.email)) {
      throw Object.assign(new Error("Duplicate email"), { code: 11000 });
    }
    if (!accounts.includes(this)) accounts.push(this);
    return this;
  });
  t.mock.method(Account, "findOne", query => {
    const account = accounts.find(a => query.email
      ? a.email === query.email
      : a.tokenHash === query.tokenHash && a.tokenExpiresAt > query.tokenExpiresAt.$gt);
    return { select: async () => account, then: resolve => Promise.resolve(account).then(resolve) };
  });
  const app = express();
  app.use(express.json());
  app.use("/api/auth", auth);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  async function request(path, body, token) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  const input = { name: "Alex", email: " Alex@CPP.edu ", password: "demo-password-123" };
  assert.equal((await request("signup", {})).status, 400);
  const signup = await request("signup", input);
  assert.equal(signup.status, 201);
  assert.equal(signup.body.account.email, "alex@cpp.edu");
  assert.equal(signup.body.account.passwordHash, undefined);
  assert.equal(signup.body.account.tokenHash, undefined);
  assert.notEqual(accounts[0].passwordHash, input.password);
  assert.ok(await verifyPassword(input.password, accounts[0].passwordHash));
  assert.equal(accounts[0].tokenHash, hashToken(signup.body.token));
  assert.equal((await request("signup", input)).status, 409);
  assert.equal((await request("me")).status, 401);
  assert.equal((await request("me", undefined, "bad-token")).status, 401);
  assert.equal((await request("me", undefined, "a".repeat(64))).status, 401);
  assert.equal((await request("me", undefined, signup.body.token)).status, 200);
  assert.equal((await request("login", { ...input, password: "wrong-password" })).status, 401);
  const login = await request("login", input);
  assert.equal(login.status, 200);
  assert.equal((await request("me", undefined, signup.body.token)).status, 401);
  assert.equal((await request("me", undefined, login.body.token)).status, 200);
  accounts[0].tokenExpiresAt = new Date(0);
  assert.equal((await request("me", undefined, login.body.token)).status, 401);
  t.mock.method(Account, "findOne", () => { throw new Error("Database unavailable"); });
  t.mock.method(console, "error", () => {});
  assert.equal((await request("me", undefined, login.body.token)).status, 503);
});

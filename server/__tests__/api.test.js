import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "../server.mjs";

function makeTempDirs() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-project-"));
  const storiesDir = path.join(root, "stories");
  const testsDir = path.join(root, "tests");
  fs.mkdirSync(storiesDir, { recursive: true });
  fs.mkdirSync(testsDir, { recursive: true });
  return { root, storiesDir, testsDir };
}

async function withServer(fn) {
  const { root, storiesDir, testsDir } = makeTempDirs();
  const server = createServer({
    projectRoot: root,
    uiDir: root,
    storiesDir,
    testsDir,
    mockRuns: true,
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await fn({ baseUrl, root, storiesDir, testsDir });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("health and validate endpoints", async () => {
  await withServer(async ({ baseUrl }) => {
    const health = await fetch(`${baseUrl}/api/health`);
    const healthJson = await health.json();
    assert.equal(healthJson.ok, true);

    const validate = await fetch(`${baseUrl}/api/validate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "" }),
    });
    const validateJson = await validate.json();
    assert.equal(validateJson.ok, false);
    assert.ok(validateJson.errors.length > 0);
  });
});

test("story CRUD + delete all", async () => {
  await withServer(async ({ baseUrl }) => {
    const save = await fetch(`${baseUrl}/api/stories`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filename: "login", content: "As a user\n- do thing\nAcceptance:" }),
    });
    const saveJson = await save.json();
    assert.equal(saveJson.ok, true);

    const list = await fetch(`${baseUrl}/api/stories`);
    const listJson = await list.json();
    assert.deepEqual(listJson.files, ["login.md"]);

    const getStory = await fetch(`${baseUrl}/api/story?name=login.md`);
    const getJson = await getStory.json();
    assert.equal(getJson.name, "login.md");

    const delStory = await fetch(`${baseUrl}/api/story?name=login.md`, { method: "DELETE" });
    const delJson = await delStory.json();
    assert.equal(delJson.ok, true);

    await fetch(`${baseUrl}/api/stories`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filename: "one", content: "As a user\n- step\nAcceptance:" }),
    });
    await fetch(`${baseUrl}/api/stories`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filename: "two", content: "As a user\n- step two\nAcceptance:" }),
    });
    const deleteAll = await fetch(`${baseUrl}/api/stories`, { method: "DELETE" });
    const deleteAllJson = await deleteAll.json();
    assert.equal(deleteAllJson.deletedCount, 2);
  });
});

test("test CRUD + delete all", async () => {
  await withServer(async ({ baseUrl }) => {
    const put = await fetch(`${baseUrl}/api/test?name=demo.spec.js`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "test('demo', () => {})" }),
    });
    const putJson = await put.json();
    assert.equal(putJson.ok, true);

    const list = await fetch(`${baseUrl}/api/tests`);
    const listJson = await list.json();
    assert.deepEqual(listJson.files, ["demo.spec.js"]);

    const get = await fetch(`${baseUrl}/api/test?name=demo.spec.js`);
    const getJson = await get.json();
    assert.equal(getJson.name, "demo.spec.js");

    const del = await fetch(`${baseUrl}/api/test?name=demo.spec.js`, { method: "DELETE" });
    const delJson = await del.json();
    assert.equal(delJson.ok, true);

    await fetch(`${baseUrl}/api/test?name=a.spec.js`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "test('a', () => {})" }),
    });
    await fetch(`${baseUrl}/api/test?name=b.spec.js`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "test('b', () => {})" }),
    });

    const deleteAll = await fetch(`${baseUrl}/api/tests`, { method: "DELETE" });
    const deleteAllJson = await deleteAll.json();
    assert.equal(deleteAllJson.deletedCount, 2);
  });
});

test("run endpoints return mocked output", async () => {
  await withServer(async ({ baseUrl }) => {
    const endpoints = [
      "/api/run/ai-gen",
      "/api/run/tests",
      "/api/run/analyze",
      "/api/run/pipeline",
    ];

    for (const endpoint of endpoints) {
      const res = await fetch(`${baseUrl}${endpoint}`, { method: "POST" });
      const json = await res.json();
      assert.equal(json.ok, true);
      assert.ok(json.stdout.includes("mocked:"));
    }
  });
});

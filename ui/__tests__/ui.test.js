import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

function buildDom() {
  const dom = new JSDOM(
    `<!doctype html>
    <body>
      <span id="health"></span>
      <input id="filename" />
      <textarea id="story"></textarea>
      <input id="fileInput" type="file" />
      <div id="storyValidation" class="inline-error hidden"></div>
      <ul id="storyList"></ul>
      <ul id="testList"></ul>
      <button id="generateBtn"></button>
      <button id="generateStoriesBtn"></button>
      <button id="runPipelineBtn"></button>
      <button id="runTestsBtn"></button>
      <button id="analyzeBtn"></button>
      <span id="runStatus"></span>
      <div id="runSummary"></div>
      <div id="runError" class="hidden"></div>
      <div id="runLog"></div>
      <a id="openReportBtn" class="hidden"></a>
      <button id="copyStdoutBtn"></button>
      <button id="copyStderrBtn"></button>
      <div id="runStepper">
        <div class="step" data-step="validate"><span class="dot"></span></div>
        <div class="step" data-step="save"><span class="dot"></span></div>
        <div class="step" data-step="generate"><span class="dot"></span></div>
        <div class="step" data-step="run"><span class="dot"></span></div>
        <div class="step" data-step="analyze"><span class="dot"></span></div>
        <div class="step" data-step="report"><span class="dot"></span></div>
      </div>
      <div id="runConsoleCard" class="card run-console"></div>
      <button id="validateBtn"></button>
      <button id="saveBtn"></button>
      <button id="uploadBtn"></button>
      <button id="refreshBtn"></button>
      <button id="deleteAllStoriesBtn"></button>
      <button id="refreshTestsBtn"></button>
      <button id="deleteAllTestsBtn"></button>
      <button id="generateAllStoriesBtn"></button>
      <button id="runAllTestsBtn"></button>
      <button id="editorModeStory"></button>
      <button id="editorModeTest"></button>
      <label id="filenameLabel"></label>
      <label id="editorLabel"></label>
      <div id="confirmModal" class="hidden">
        <div data-close="true"></div>
        <div>
          <h3 id="confirmTitle"></h3>
          <p id="confirmMessage"></p>
          <button id="confirmCancelBtn"></button>
          <button id="confirmOkBtn"></button>
        </div>
      </div>
      <button id="aiTemplateBtn"></button>
      <div id="aiModal" class="hidden">
        <div data-close="true"></div>
        <div>
          <button id="aiCancelBtn"></button>
          <button id="aiGenerateBtn"></button>
          <button id="aiNextBtn"></button>
          <button id="aiBackBtn"></button>
          <button id="aiSkipBtn"></button>
          <span id="aiSpinner" class="hidden"></span>
          <div id="aiError" class="hidden"></div>
          <textarea id="aiRequirements"></textarea>
          <textarea id="aiSelectors"></textarea>
          <textarea id="aiPath"></textarea>
          <textarea id="aiExpected"></textarea>
          <div class="wizard-step" data-step="0"></div>
          <div class="wizard-step" data-step="1"></div>
          <div class="wizard-step" data-step="2"></div>
          <div class="wizard-step" data-step="3"></div>
          <div data-panel="0"></div>
          <div data-panel="1" class="hidden"></div>
          <div data-panel="2" class="hidden"></div>
          <div data-panel="3" class="hidden"></div>
        </div>
      </div>
    </body>`,
    { url: "http://localhost" },
  );
  global.window = dom.window;
  global.document = dom.window.document;
  global.File = dom.window.File;
  global.Blob = dom.window.Blob;
  if (!global.navigator) {
    Object.defineProperty(global, "navigator", {
      value: dom.window.navigator,
      configurable: true,
    });
  }
  if (!global.navigator.clipboard) {
    global.navigator.clipboard = {
      writeText: async () => {},
    };
  }
  dom.window.confirm = () => true;
  global.confirm = () => true;
  global.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    const method = (init.method || "GET").toUpperCase();
    if (method === "GET" && url === "/api/health") return jsonResponse({ ok: true });
    if (method === "GET" && url === "/api/stories") return jsonResponse({ files: [] });
    if (method === "GET" && url === "/api/tests") return jsonResponse({ files: [] });
    return jsonResponse({ ok: true });
  };
  return dom;
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockFetch(handlers) {
  global.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    const method = (init.method || "GET").toUpperCase();
    const match = handlers.find((h) => h.match(url, method, init));
    if (!match) throw new Error(`Unhandled fetch: ${method} ${url}`);
    return match.handler({ url, method, init });
  };
}

let ui;

async function loadUi() {
  const url = new URL("../ui.js", import.meta.url);
  url.searchParams.set("t", String(Date.now()) + String(Math.random()));
  return import(url.href);
}

test("ui module functions", async () => {
  buildDom();
  mockFetch([
    { match: (url, method) => method === "GET" && url === "/api/health", handler: () => jsonResponse({ ok: true }) },
    { match: (url, method) => method === "GET" && url === "/api/stories", handler: () => jsonResponse({ files: [] }) },
    { match: (url, method) => method === "GET" && url === "/api/tests", handler: () => jsonResponse({ files: [] }) },
  ]);
  ui = await loadUi();

  assert.equal(typeof ui.renderValidation, "function");
  assert.equal(typeof ui.renderRunResult, "function");
});

test("stripExtension and escapeHtml", async () => {
  buildDom();
  ui = await loadUi();
  assert.equal(ui.stripExtension("login.md"), "login");
  assert.equal(ui.stripExtension("a.b.c.txt"), "a.b.c");
  assert.equal(ui.escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#039;");
});

test("renderValidation updates storyValidation panel", async () => {
  buildDom();
  ui = await loadUi();
  ui.renderValidation({ ok: false, errors: ["Missing"], warnings: ["Tip"], savedAs: "foo.md" });
  const panel = document.getElementById("storyValidation");
  assert.ok(panel.innerHTML.includes("Errors"));
  assert.ok(panel.innerHTML.includes("Missing"));
});

test("run console helpers update status, log, and CTA", async () => {
  buildDom();
  ui = await loadUi();
  ui.setRunStatus("running");
  assert.ok(document.getElementById("runStatus").classList.contains("running"));
  assert.ok(document.getElementById("runConsoleCard").classList.contains("running"));

  ui.setRunButtonsDisabled(true);
  assert.equal(document.getElementById("generateAllStoriesBtn").disabled, true);

  ui.resetRunConsole();
  assert.equal(document.getElementById("runLog").textContent, "Awaiting action...");

  ui.setRunLog("hello");
  assert.equal(document.getElementById("runLog").textContent, "hello");

  ui.setRunSummary({ ok: true, warnings: ["All good"] });
  assert.ok(document.getElementById("runSummary").innerHTML.includes("All good"));

  ui.toggleReportCta({ show: true });
  assert.equal(document.getElementById("openReportBtn").classList.contains("hidden"), false);

  ui.setRunError("Boom");
  assert.equal(document.getElementById("runError").textContent, "Boom");
});

test("stepper status updates", async () => {
  buildDom();
  ui = await loadUi();
  ui.setStepStatus("generate", "running");
  const step = document.querySelector('[data-step="generate"]');
  assert.ok(step.classList.contains("running"));

  ui.resetStepper();
  assert.equal(step.classList.contains("running"), false);

  ui.setStepStatusForAction("Run pipeline", "done");
  assert.ok(document.querySelector('[data-step="generate"]').classList.contains("done"));
  assert.ok(document.querySelector('[data-step="run"]').classList.contains("done"));
});

test("renderRunResult writes summary and logs", async () => {
  buildDom();
  ui = await loadUi();
  ui.renderRunResult(
    { ok: true, exitCode: 0, stdout: "ok", stderr: "" },
    { actionLabel: "Generate tests", generated: ["a.spec.js"], totalCount: 1, storyCount: 1 },
  );
  assert.ok(document.getElementById("runSummary").innerHTML.includes("Generate tests"));
  assert.ok(document.getElementById("runLog").textContent.includes("stdout"));
});

test("story and test CRUD flows", async () => {
  buildDom();
  mockFetch([
    {
      match: (url, method) => url === "/api/validate" && method === "POST",
      handler: () => jsonResponse({ ok: true, errors: [], warnings: [] }),
    },
    {
      match: (url, method) => url === "/api/stories" && method === "POST",
      handler: () => jsonResponse({ ok: true, savedAs: "story.md", warnings: [] }),
    },
    {
      match: (url, method) => url === "/api/stories" && method === "GET",
      handler: () => jsonResponse({ files: ["story.md"] }),
    },
    {
      match: (url, method) => url.startsWith("/api/story") && method === "GET",
      handler: () => jsonResponse({ ok: true, name: "story.md", content: "hello" }),
    },
    {
      match: (url, method) => url.startsWith("/api/story") && method === "DELETE",
      handler: () => jsonResponse({ ok: true, deleted: "story.md" }),
    },
    {
      match: (url, method) => url === "/api/stories" && method === "DELETE",
      handler: () => jsonResponse({ ok: true, deletedCount: 1 }),
    },
    {
      match: (url, method) => url === "/api/tests" && method === "GET",
      handler: () => jsonResponse({ files: ["a.spec.js"] }),
    },
    {
      match: (url, method) => url.startsWith("/api/run/ai-gen") && method === "POST",
      handler: () => jsonResponse({ ok: true, stdout: "gen", stderr: "" }),
    },
    {
      match: (url, method) => url.startsWith("/api/test") && method === "GET",
      handler: () => jsonResponse({ ok: true, name: "a.spec.js", content: "test" }),
    },
    {
      match: (url, method) => url.startsWith("/api/test") && method === "PUT",
      handler: () => jsonResponse({ ok: true, saved: "a.spec.js" }),
    },
    {
      match: (url, method) => url.startsWith("/api/test") && method === "DELETE",
      handler: () => jsonResponse({ ok: true, deleted: "a.spec.js" }),
    },
    {
      match: (url, method) => url === "/api/tests" && method === "DELETE",
      handler: () => jsonResponse({ ok: true, deletedCount: 1 }),
    },
  ]);
  ui = await loadUi();

  document.getElementById("story").value = "As a user...";
  await ui.onValidate();
  await ui.onSave();
  await ui.loadStories();
  assert.equal(document.querySelectorAll("#storyList li").length, 1);
  const generateStoryBtn = document.querySelector("#storyList li .story-actions .btn");
  assert.ok(generateStoryBtn);

  await ui.onEditStory("story.md");
  assert.equal(document.getElementById("filename").value, "story");

  const deleteStory = ui.onDeleteStory("story.md");
  document.getElementById("confirmOkBtn").click();
  await deleteStory;
  const deleteAllStories = ui.onDeleteAllStories();
  document.getElementById("confirmOkBtn").click();
  await deleteAllStories;

  await ui.loadTests();
  assert.equal(document.querySelectorAll("#testList li").length, 1);
  await ui.onEditTest("a.spec.js");
  assert.equal(document.getElementById("filename").value, "a.spec.js");
  await ui.onSaveTest();
  const deleteTest = ui.onDeleteTest("a.spec.js");
  document.getElementById("confirmOkBtn").click();
  await deleteTest;
  const deleteAllTests = ui.onDeleteAllTests();
  document.getElementById("confirmOkBtn").click();
  await deleteAllTests;
});

test("run actions and generate flows", async () => {
  buildDom();
  mockFetch([
    { match: (url, method) => url === "/api/stories" && method === "GET", handler: () => jsonResponse({ files: ["one.md"] }) },
    { match: (url, method) => url === "/api/tests" && method === "GET", handler: () => jsonResponse({ files: ["a.spec.js"] }) },
    { match: (url, method) => url === "/api/run/ai-gen" && method === "POST", handler: () => jsonResponse({ ok: true, stdout: "gen", stderr: "" }) },
    { match: (url, method) => url === "/api/run/pipeline" && method === "POST", handler: () => jsonResponse({ ok: true, stdout: "pipe", stderr: "" }) },
    { match: (url, method) => url === "/api/run/tests" && method === "POST", handler: () => jsonResponse({ ok: true, stdout: "tests", stderr: "" }) },
    { match: (url, method) => url === "/api/run/analyze" && method === "POST", handler: () => jsonResponse({ ok: true, stdout: "analyze", stderr: "" }) },
  ]);
  ui = await loadUi();

  await ui.onGenerate();
  assert.ok(document.getElementById("runSummary").innerHTML.includes("Generate tests"));

  await ui.onRunPipeline();
  assert.ok(document.getElementById("runSummary").innerHTML.includes("Run pipeline"));

  await ui.onRunTests();
  assert.ok(document.getElementById("runSummary").innerHTML.includes("Run tests"));

  await ui.onAnalyze();
  assert.ok(document.getElementById("runSummary").innerHTML.includes("Analyze"));
});

test("upload uses file input and shows results", async () => {
  buildDom();
  mockFetch([
    { match: (url, method) => url === "/api/health" && method === "GET", handler: () => jsonResponse({ ok: true }) },
    {
      match: (url, method) => url === "/api/stories" && method === "POST",
      handler: () => jsonResponse({ ok: true, savedAs: "upload.md" }),
    },
    { match: (url, method) => url === "/api/stories" && method === "GET", handler: () => jsonResponse({ files: ["upload.md"] }) },
    { match: (url, method) => url === "/api/tests" && method === "GET", handler: () => jsonResponse({ files: [] }) },
  ]);
  ui = await loadUi();

  const file = { name: "upload.md", text: async () => "hello" };
  const input = document.getElementById("fileInput");
  Object.defineProperty(input, "files", { value: [file], configurable: true, writable: true });
  assert.equal(Array.from(input.files).length, 1);

  await ui.onUpload();
  assert.ok(document.getElementById("storyValidation").innerHTML.includes("Upload results"));
});

test("AI story assistant generates story text", async () => {
  buildDom();
  mockFetch([
    {
      match: (url, method) => url === "/api/ai/story" && method === "POST",
      handler: () => jsonResponse({ ok: true, story: "Title: Demo\nStory:\nAs a user, I want to ...\nAcceptance:\n- Do X" }),
    },
  ]);
  ui = await loadUi();

  document.getElementById("aiRequirements").value = "User logs in";
  document.getElementById("aiExpected").value = "Dashboard loads";

  await ui.onGenerateStoryFromAi();

  const editor = document.getElementById("story");
  assert.ok(editor.value.includes("Title: Demo"));
});

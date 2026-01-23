import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import * as api from "../modules/api.js";

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
      <div id="runReportCard" class="card run-report hidden"></div>
      <div id="runReportNotice" class="hidden"></div>
      <div id="runReportFailedList"></div>
      <div id="runReportScreenshotsTitle" class="hidden"></div>
      <div id="runReportScreenshots" class="hidden"></div>
      <iframe id="runReportFrame"></iframe>
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
  global.DOMParser = dom.window.DOMParser;
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

async function loadModule(path) {
  const url = new URL(path, import.meta.url);
  url.searchParams.set("t", String(Date.now()) + String(Math.random()));
  return import(url.href);
}

function getElements() {
  const $ = (id) => document.getElementById(id);
  return {
    health: $("health"),
    filename: $("filename"),
    story: $("story"),
    fileInput: $("fileInput"),
    storyValidation: $("storyValidation"),
    storyList: $("storyList"),
    testList: $("testList"),
    runStatus: $("runStatus"),
    runSummary: $("runSummary"),
    runLog: $("runLog"),
    openReportBtn: $("openReportBtn"),
    runStepper: $("runStepper"),
    runError: $("runError"),
    runConsoleCard: $("runConsoleCard"),
    runReportCard: $("runReportCard"),
    runReportFrame: $("runReportFrame"),
    runReportFailedList: $("runReportFailedList"),
    runReportScreenshots: $("runReportScreenshots"),
    runReportScreenshotsTitle: $("runReportScreenshotsTitle"),
    runReportNotice: $("runReportNotice"),
    copyStdoutBtn: $("copyStdoutBtn"),
    copyStderrBtn: $("copyStderrBtn"),
    confirmModal: $("confirmModal"),
    confirmMessage: $("confirmMessage"),
    confirmOkBtn: $("confirmOkBtn"),
    confirmCancelBtn: $("confirmCancelBtn"),
    confirmTitle: $("confirmTitle"),
    editorModeStoryBtn: $("editorModeStory"),
    editorModeTestBtn: $("editorModeTest"),
    filenameLabel: $("filenameLabel"),
    editorLabel: $("editorLabel"),
    aiTemplateBtn: $("aiTemplateBtn"),
    aiModal: $("aiModal"),
    aiCancelBtn: $("aiCancelBtn"),
    aiGenerateBtn: $("aiGenerateBtn"),
    aiNextBtn: $("aiNextBtn"),
    aiBackBtn: $("aiBackBtn"),
    aiSkipBtn: $("aiSkipBtn"),
    aiSpinner: $("aiSpinner"),
    aiError: $("aiError"),
    aiRequirements: $("aiRequirements"),
    aiSelectors: $("aiSelectors"),
    aiPath: $("aiPath"),
    aiExpected: $("aiExpected"),
    validateBtn: $("validateBtn"),
    saveBtn: $("saveBtn"),
    uploadBtn: $("uploadBtn"),
    refreshBtn: $("refreshBtn"),
    deleteAllStoriesBtn: $("deleteAllStoriesBtn"),
    refreshTestsBtn: $("refreshTestsBtn"),
    deleteAllTestsBtn: $("deleteAllTestsBtn"),
    generateAllStoriesBtn: $("generateAllStoriesBtn"),
    runAllTestsBtn: $("runAllTestsBtn"),
  };
}

async function setupUiModules() {
  const elements = getElements();
  const { initEditor } = await loadModule("../modules/editor.js");
  const { initAiWizard } = await loadModule("../modules/aiWizard.js");
  const { initConfirm, confirm } = await loadModule("../modules/confirmModal.js");
  const { initRunConsole } = await loadModule("../modules/runConsole.js");
  const { createLists } = await loadModule("../modules/lists.js");

  initConfirm(elements);

  let editor = null;
  let runConsole = null;
  const lists = createLists(
    { storyList: elements.storyList, testList: elements.testList },
    api,
    {
      onEditStory: (...args) => editor?.onEditStory?.(...args),
      onDeleteStory: (...args) => editor?.onDeleteStory?.(...args),
      onGenerateForStory: (storyFile) => runConsole?.onGenerateForStory(storyFile),
      onEditTest: (...args) => editor?.onEditTest?.(...args),
      onDeleteTest: (...args) => editor?.onDeleteTest?.(...args),
      onRunTest: (testFile) => runConsole?.onRunTest(testFile),
    },
  );

  runConsole = initRunConsole(
    {
      runStatus: elements.runStatus,
      runSummary: elements.runSummary,
      runLog: elements.runLog,
      runError: elements.runError,
      openReportBtn: elements.openReportBtn,
      runStepper: elements.runStepper,
      runConsoleCard: elements.runConsoleCard,
      copyStdoutBtn: elements.copyStdoutBtn,
      copyStderrBtn: elements.copyStderrBtn,
      generateAllStoriesBtn: elements.generateAllStoriesBtn,
      runAllTestsBtn: elements.runAllTestsBtn,
    },
    api,
    { loadTests: async () => lists?.loadTests() },
  );

  editor = initEditor({ elements, api, lists, runConsole, confirm });
  const aiWizard = initAiWizard({ elements, api, editor });

  return { elements, editor, runConsole, lists, aiWizard };
}

test("ui module functions", async () => {
  buildDom();
  mockFetch([
    { match: (url, method) => method === "GET" && url === "/api/health", handler: () => jsonResponse({ ok: true }) },
    { match: (url, method) => method === "GET" && url === "/api/stories", handler: () => jsonResponse({ files: [] }) },
    { match: (url, method) => method === "GET" && url === "/api/tests", handler: () => jsonResponse({ files: [] }) },
  ]);
  const { editor, runConsole } = await setupUiModules();

  assert.equal(typeof editor.renderValidation, "function");
  assert.equal(typeof runConsole.renderRunResult, "function");
});

test("stripExtension and escapeHtml", async () => {
  buildDom();
  const { stripExtension, escapeHtml } = await loadModule("../modules/editor.js");
  assert.equal(stripExtension("login.md"), "login");
  assert.equal(stripExtension("a.b.c.txt"), "a.b.c");
  assert.equal(escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#039;");
});

test("renderValidation updates storyValidation panel", async () => {
  buildDom();
  const { editor } = await setupUiModules();
  editor.renderValidation({ ok: false, errors: ["Missing"], warnings: ["Tip"], savedAs: "foo.md" });
  const panel = document.getElementById("storyValidation");
  assert.ok(panel.innerHTML.includes("Errors"));
  assert.ok(panel.innerHTML.includes("Missing"));
});

test("run console helpers update status, log, and CTA", async () => {
  buildDom();
  const { runConsole } = await setupUiModules();
  runConsole.setRunStatus("running");
  assert.ok(document.getElementById("runStatus").classList.contains("running"));
  assert.ok(document.getElementById("runConsoleCard").classList.contains("running"));

  runConsole.setRunButtonsDisabled(true);
  assert.equal(document.getElementById("generateAllStoriesBtn").disabled, true);

  runConsole.resetRunConsole();
  assert.equal(document.getElementById("runLog").textContent, "Awaiting action...");

  runConsole.setRunLog("hello");
  assert.equal(document.getElementById("runLog").textContent, "hello");

  runConsole.setRunSummary({ ok: true, warnings: ["All good"] });
  assert.ok(document.getElementById("runSummary").innerHTML.includes("All good"));

  runConsole.toggleReportCta({ show: true });
  assert.equal(document.getElementById("openReportBtn").classList.contains("hidden"), false);

  runConsole.setRunError("Boom");
  assert.equal(document.getElementById("runError").textContent, "Boom");
});

test("stepper status updates", async () => {
  buildDom();
  const { runConsole } = await setupUiModules();
  runConsole.setStepStatus("generate", "running");
  const step = document.querySelector('[data-step="generate"]');
  assert.ok(step.classList.contains("running"));

  runConsole.resetStepper();
  assert.equal(step.classList.contains("running"), false);

  runConsole.setStepStatusForAction("Run pipeline", "done");
  assert.ok(document.querySelector('[data-step="generate"]').classList.contains("done"));
  assert.ok(document.querySelector('[data-step="run"]').classList.contains("done"));
});

test("renderRunResult writes summary and logs", async () => {
  buildDom();
  const { runConsole } = await setupUiModules();
  runConsole.renderRunResult(
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
  const { editor, lists } = await setupUiModules();

  document.getElementById("story").value = "As a user...";
  await editor.onValidate();
  await editor.onSave();
  await lists.loadStories();
  assert.equal(document.querySelectorAll("#storyList li").length, 1);
  const generateStoryBtn = document.querySelector("#storyList li .story-actions .btn");
  assert.ok(generateStoryBtn);

  await editor.onEditStory("story.md");
  assert.equal(document.getElementById("filename").value, "story");

  const deleteStory = editor.onDeleteStory("story.md");
  document.getElementById("confirmOkBtn").click();
  await deleteStory;
  const deleteAllStories = editor.onDeleteAllStories();
  document.getElementById("confirmOkBtn").click();
  await deleteAllStories;

  await lists.loadTests();
  assert.equal(document.querySelectorAll("#testList li").length, 1);
  await editor.onEditTest("a.spec.js");
  assert.equal(document.getElementById("filename").value, "a.spec.js");
  await editor.onSaveTest();
  const deleteTest = editor.onDeleteTest("a.spec.js");
  document.getElementById("confirmOkBtn").click();
  await deleteTest;
  const deleteAllTests = editor.onDeleteAllTests();
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
    { match: (url, method) => url === "/api/run/report" && method === "POST", handler: () => jsonResponse({ ok: true, stdout: "analyze", stderr: "" }) },
  ]);
  const { runConsole } = await setupUiModules();

  await runConsole.onGenerateAll();
  assert.ok(document.getElementById("runSummary").innerHTML.includes("Generate tests"));

  await runConsole.runAction({
    request: () => api.runPipeline(),
    actionLabel: "Run pipeline",
    includeGenerated: true,
  });
  assert.ok(document.getElementById("runSummary").innerHTML.includes("Run pipeline"));

  await runConsole.runAction({
    request: () => api.runTestsAll(),
    actionLabel: "Run tests",
  });
  assert.ok(document.getElementById("runSummary").innerHTML.includes("Run tests"));

  await runConsole.runAction({
    request: () => api.runAnalyze(),
    actionLabel: "Analyze",
  });
  assert.ok(document.getElementById("runSummary").innerHTML.includes("Analyze"));
});

test("fix with AI sends payload and reruns test", async () => {
  buildDom();
  let fixPayload = null;
  mockFetch([
    { match: (url, method) => url === "/api/ai/fix-test" && method === "POST", handler: async ({ init }) => {
      fixPayload = JSON.parse(init.body || "{}");
      return jsonResponse({ ok: true, updatedFile: "add_remove_elements.spec.js" });
    } },
    { match: (url, method) => url.startsWith("/api/run/tests?test=add_remove_elements.spec.js") && method === "POST", handler: () => jsonResponse({ ok: true, stdout: "tests ok", stderr: "" }) },
    { match: (url, method) => url === "/api/run/report" && method === "POST", handler: () => jsonResponse({ ok: true, stdout: "report", stderr: "" }) },
    { match: (url, method) => url === "/api/stories" && method === "GET", handler: () => jsonResponse({ files: [] }) },
    { match: (url, method) => url === "/api/tests" && method === "GET", handler: () => jsonResponse({ files: ["add_remove_elements.spec.js"] }) },
  ]);
  const { runConsole } = await setupUiModules();
  runConsole.renderRunResult(
    { ok: false, stdout: "tests/add_remove_elements.spec.js:3:1 › Add/Remove Elements - wrong expectations\nError Context: test-results/add_remove_elements/error-context.md", stderr: "" },
    { actionLabel: "Run tests (add_remove_elements.spec.js)" },
  );
  const list = document.getElementById("runReportFailedList");
  list.innerHTML = `
    <button class="btn" data-action="fix-test" data-test-title="Add/Remove Elements - wrong expectations" data-test-file="add_remove_elements.spec.js" data-error-context="test-results/add_remove_elements/error-context.md"></button>
  `;
  list.querySelector("button").click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(fixPayload);
  assert.equal(fixPayload.testFile, "add_remove_elements.spec.js");
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
  const { editor } = await setupUiModules();

  const file = { name: "upload.md", text: async () => "hello" };
  const input = document.getElementById("fileInput");
  Object.defineProperty(input, "files", { value: [file], configurable: true, writable: true });
  assert.equal(Array.from(input.files).length, 1);

  await editor.onUpload();
  assert.ok(document.getElementById("storyValidation").innerHTML.includes("Upload results"));
});

test("AI story assistant generates story text", async () => {
  buildDom();
  mockFetch([
    { match: (url, method) => url === "/api/health" && method === "GET", handler: () => jsonResponse({ ok: true }) },
    { match: (url, method) => url === "/api/stories" && method === "GET", handler: () => jsonResponse({ files: [] }) },
    { match: (url, method) => url === "/api/tests" && method === "GET", handler: () => jsonResponse({ files: [] }) },
    {
      match: (url, method) => url === "/api/ai/story" && method === "POST",
      handler: () => jsonResponse({ ok: true, story: "Title: Demo\nStory:\nAs a user, I want to ...\nAcceptance:\n- Do X" }),
    },
  ]);
  const { aiWizard } = await setupUiModules();

  document.getElementById("aiRequirements").value = "User logs in";
  document.getElementById("aiExpected").value = "Dashboard loads";

  await aiWizard.onGenerateStoryFromAi();

  const editor = document.getElementById("story");
  assert.ok(editor.value.includes("Title: Demo"));
});

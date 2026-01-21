import * as api from "./modules/api.js";
import { initRunConsole } from "./modules/runConsole.js";
import { createLists } from "./modules/lists.js";

const hasDom = typeof document !== "undefined";
const $ = (id) => (hasDom ? document.getElementById(id) : null);

const elements = {
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

const wizardPanels = hasDom ? Array.from(document.querySelectorAll("[data-panel]")) : [];
const wizardSteps = hasDom ? Array.from(document.querySelectorAll(".wizard-step")) : [];

let confirmResolver = null;
let editorMode = "story";
let activeTestName = "";
let activeStoryName = "";
let aiStep = 0;
let storyValidated = false;
let lists = null;
let runConsole = null;

if (elements.validateBtn) elements.validateBtn.addEventListener("click", onValidate);
if (elements.saveBtn) elements.saveBtn.addEventListener("click", onSave);
if (elements.uploadBtn) elements.uploadBtn.addEventListener("click", onUpload);
if (elements.refreshBtn) elements.refreshBtn.addEventListener("click", () => lists?.loadStories());
if (elements.deleteAllStoriesBtn) elements.deleteAllStoriesBtn.addEventListener("click", onDeleteAllStories);
if (elements.refreshTestsBtn) elements.refreshTestsBtn.addEventListener("click", () => lists?.loadTests());
if (elements.deleteAllTestsBtn) elements.deleteAllTestsBtn.addEventListener("click", onDeleteAllTests);
if (elements.generateAllStoriesBtn) elements.generateAllStoriesBtn.addEventListener("click", () => runConsole?.onGenerateAll());
if (elements.runAllTestsBtn) elements.runAllTestsBtn.addEventListener("click", () => runConsole?.onRunTestsAll());
if (elements.editorModeStoryBtn) elements.editorModeStoryBtn.addEventListener("click", () => setEditorMode("story"));
if (elements.editorModeTestBtn) elements.editorModeTestBtn.addEventListener("click", () => setEditorMode("test"));
if (elements.aiTemplateBtn) elements.aiTemplateBtn.addEventListener("click", openAiModal);
if (elements.aiCancelBtn) elements.aiCancelBtn.addEventListener("click", closeAiModal);
if (elements.aiGenerateBtn) elements.aiGenerateBtn.addEventListener("click", onGenerateStoryFromAi);
if (elements.aiNextBtn) elements.aiNextBtn.addEventListener("click", () => onWizardNext());
if (elements.aiBackBtn) elements.aiBackBtn.addEventListener("click", () => onWizardBack());
if (elements.aiSkipBtn) elements.aiSkipBtn.addEventListener("click", () => onWizardSkip());
if (elements.aiModal) {
  elements.aiModal.addEventListener("click", (event) => {
    const target = event.target;
    if (target && target.dataset?.close === "true") closeAiModal();
  });
}
if (elements.confirmModal) {
  elements.confirmModal.addEventListener("click", (event) => {
    const target = event.target;
    if (target && target.dataset?.close === "true") closeConfirm(false);
  });
}
if (elements.confirmCancelBtn) elements.confirmCancelBtn.addEventListener("click", () => closeConfirm(false));
if (elements.confirmOkBtn) elements.confirmOkBtn.addEventListener("click", () => closeConfirm(true));
if (elements.story) elements.story.addEventListener("input", () => setStoryValidated(false));

if (hasDom) {
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
  lists = createLists(
    { storyList: elements.storyList, testList: elements.testList },
    api,
    {
      onEditStory,
      onDeleteStory,
      onGenerateForStory: (storyFile) => runConsole?.onGenerateForStory(storyFile),
      onEditTest,
      onDeleteTest,
      onRunTest: (testFile) => runConsole?.onRunTest(testFile),
    },
  );
  init();
}

async function init() {
  await checkHealth();
  await lists.loadStories();
  await lists.loadTests();
  runConsole.setRunStatus("idle");
  runConsole.resetRunConsole();
  setEditorMode("story");
  renderValidation({ ok: true, errors: [], warnings: ["Paste a story and click Validate."] });
}

async function checkHealth() {
  try {
    const r = await fetch("/api/health");
    const j = await r.json();
    elements.health.textContent = j.ok ? "Server OK" : "Server not ready";
  } catch {
    elements.health.textContent = "Server offline";
  }
}

async function onValidate() {
  if (editorMode === "test") {
    renderValidation({ ok: false, errors: ["Validation is only available for stories."] });
    return;
  }
  const content = elements.story.value;
  const r = await api.validateStory(content);
  setStoryValidated(r.data.ok);
  setValidateState(r.data.ok ? "ok" : "error");
  renderValidation(r.data);
  runConsole?.setStepStatus("validate", r.data.ok ? "done" : "failed");
}

async function onSave() {
  if (editorMode === "test") return onSaveTest();
  if (!storyValidated) {
    setValidateState("error");
    renderValidation({ ok: false, errors: ["Please validate the story before saving."] });
    return;
  }
  const content = elements.story.value;
  const name = elements.filename.value;
  const r = await api.saveStory({ filename: name, content });
  const j = r.data;
  if (!r.ok) {
    renderValidation(j);
    runConsole?.setStepStatus("save", "failed");
    return;
  }
  renderValidation({ ok: true, errors: [], warnings: j.warnings || [], savedAs: j.savedAs });
  activeStoryName = j.savedAs || "";
  runConsole?.setStepStatus("save", "done");
  await lists?.loadStories();
}

async function onUpload() {
  const files = Array.from(elements.fileInput.files || []);
  if (!files.length) {
    renderValidation({ ok: false, errors: ["Choose up to 5 story files to upload."] });
    return;
  }
  if (files.length > 5) {
    renderValidation({ ok: false, errors: ["You can upload up to 5 stories at a time."] });
    return;
  }

  const results = [];
  for (const file of files) {
    const content = await file.text();
    const baseName = stripExtension(file.name);
    const r = await api.saveStory({ filename: baseName, content });
    results.push({ file: file.name, ok: r.ok, ...r.data });
  }

  elements.fileInput.value = "";
  renderUploadResults(results);
  runConsole?.setStepStatus("save", results.every((r) => r.ok) ? "done" : "failed");
  await lists?.loadStories();
}

async function fetchStories() {
  const r = await api.getStories();
  return r.data.files || [];
}

async function fetchTests() {
  const r = await api.getTests();
  return r.data.files || [];
}

async function loadStories() {
  return lists?.loadStories();
}

async function loadTests() {
  return lists?.loadTests();
}

async function onEditStory(fileName) {
  const r = await api.getStory(fileName);
  const j = r.data;
  if (!r.ok) {
    renderValidation({ ok: false, errors: [j.error || "Failed to load story."] });
    return;
  }

  elements.filename.value = stripExtension(j.name);
  elements.story.value = j.content || "";
  activeTestName = "";
  activeStoryName = j.name;
  setEditorMode("story");
  renderValidation({ ok: true, warnings: ["Loaded story into editor."] });
}

async function onDeleteStory(fileName) {
  const confirmDelete = await showConfirm(`Delete ${fileName}? This cannot be undone.`);
  if (!confirmDelete) return;

  const r = await api.deleteStory(fileName);
  const j = r.data;
  if (!r.ok) {
    renderValidation({ ok: false, errors: [j.error || "Failed to delete story."] });
    return;
  }

  renderValidation({ ok: true, warnings: [`Deleted ${j.deleted}.`] });
  await lists?.loadStories();
}

async function onEditTest(fileName) {
  const r = await api.getTest(fileName);
  const j = r.data;
  if (!r.ok) {
    renderValidation({ ok: false, errors: [j.error || "Failed to load test."] });
    return;
  }

  activeTestName = j.name;
  activeStoryName = "";
  elements.filename.value = j.name;
  elements.story.value = j.content || "";
  setEditorMode("test");
  renderValidation({ ok: true, warnings: ["Loaded test into editor."] });
}

async function onDeleteTest(fileName) {
  const confirmDelete = await showConfirm(`Delete ${fileName}? This cannot be undone.`);
  if (!confirmDelete) return;

  const r = await api.deleteTest(fileName);
  const j = r.data;
  if (!r.ok) {
    renderValidation({ ok: false, errors: [j.error || "Failed to delete test."] });
    return;
  }

  renderValidation({ ok: true, warnings: [`Deleted ${j.deleted}.`] });
  await lists?.loadTests();
}

async function onDeleteAllTests() {
  const confirmDelete = await showConfirm("Delete ALL tests? This cannot be undone.");
  if (!confirmDelete) return;

  const r = await api.deleteAllTests();
  const j = r.data;
  if (!r.ok) {
    renderValidation({ ok: false, errors: [j.error || "Failed to delete tests."] });
    return;
  }

  renderValidation({ ok: true, warnings: [`Deleted ${j.deletedCount} tests.`] });
  closeTestEditor();
  await lists?.loadTests();
}

async function onDeleteAllStories() {
  const confirmDelete = await showConfirm("Delete ALL stories? This cannot be undone.");
  if (!confirmDelete) return;

  const r = await api.deleteAllStories();
  const j = r.data;
  if (!r.ok) {
    renderValidation({ ok: false, errors: [j.error || "Failed to delete stories."] });
    return;
  }

  renderValidation({ ok: true, warnings: [`Deleted ${j.deletedCount} stories.`] });
  await lists?.loadStories();
}

async function onSaveTest() {
  const name = elements.filename.value || activeTestName;
  const content = elements.story.value;
  if (!name) {
    renderValidation({ ok: false, errors: ["Test filename is required."] });
    return;
  }
  if (!name.endsWith(".spec.js")) {
    renderValidation({ ok: false, errors: ["Test filename must end with .spec.js."] });
    return;
  }

  const r = await api.saveTest(name, content);
  const j = r.data;
  if (!r.ok) {
    renderValidation({ ok: false, errors: [j.error || "Failed to save test."] });
    return;
  }

  renderValidation({ ok: true, warnings: [`Saved ${j.saved}.`] });
  activeTestName = name;
  await lists?.loadTests();
}

function closeTestEditor() {
  activeTestName = "";
}

async function onGenerateStories() {
  if (editorMode !== "story") setEditorMode("story");
  await onValidate();
  if (!storyValidated) return;
  await onSave();
}

function renderValidation(result) {
  const { errors = [] } = result || {};
  if (!errors.length) {
    setStoryValidationBox("");
    return;
  }
  const html = `<div><strong>Errors</strong><ul>${errors.map(e => `<li>${escapeHtml(e)}</li>`).join("")}</ul></div>`;
  setStoryValidationBox(html, "error");
}

function setEditorMode(mode) {
  editorMode = mode === "test" ? "test" : "story";
  if (elements.editorModeStoryBtn) elements.editorModeStoryBtn.classList.toggle("primary", editorMode === "story");
  if (elements.editorModeTestBtn) elements.editorModeTestBtn.classList.toggle("primary", editorMode === "test");
  if (elements.editorModeStoryBtn) {
    const lockStory = Boolean(activeStoryName) || editorMode === "story";
    elements.editorModeStoryBtn.disabled = lockStory && editorMode === "story";
  }
  if (elements.editorModeTestBtn) {
    const lockTest = Boolean(activeTestName) || editorMode === "test";
    elements.editorModeTestBtn.disabled = lockTest && editorMode === "test";
  }
  if (elements.editorModeStoryBtn && activeTestName) elements.editorModeStoryBtn.disabled = true;
  if (elements.editorModeTestBtn && activeStoryName) elements.editorModeTestBtn.disabled = true;
  if (elements.filenameLabel) elements.filenameLabel.textContent = editorMode === "test" ? "Test filename" : "Filename (optional)";
  if (elements.editorLabel) elements.editorLabel.textContent = editorMode === "test" ? "Test code" : "Story text";
  if (elements.story) {
    elements.story.placeholder = editorMode === "test"
      ? "import { test, expect } from '@playwright/test';\n\ntest('...', async ({ page }) => {\n  // ...\n});"
      : "As a user, I want to ...\n\nAcceptance:\n- Navigate to ...\n- Click ...\n- Expect ...";
  }
  if (elements.validateBtn) {
    elements.validateBtn.disabled = editorMode === "test";
    elements.validateBtn.classList.toggle("hidden", editorMode === "test");
  }
  if (elements.saveBtn) {
    elements.saveBtn.textContent = editorMode === "test" ? "Save test" : "Save story";
    if (editorMode === "test") elements.saveBtn.disabled = false;
  }
  setValidateState("idle");
  setStoryValidated(false);
  setStoryValidationBox("");
}

function setValidateState(state) {
  if (!elements.validateBtn) return;
  elements.validateBtn.classList.remove("success", "error");
  if (state === "ok") {
    elements.validateBtn.classList.add("success");
    elements.validateBtn.textContent = "Valid ✓";
  } else if (state === "error") {
    elements.validateBtn.classList.add("error");
    elements.validateBtn.textContent = "Fix errors";
  } else {
    elements.validateBtn.textContent = "Validate Story";
  }
}

function setStoryValidated(ok) {
  storyValidated = Boolean(ok);
  if (elements.saveBtn && editorMode === "story") {
    elements.saveBtn.disabled = !storyValidated;
  }
}

function setStoryValidationBox(content, type = "error") {
  if (!elements.storyValidation) return;
  if (!content) {
    elements.storyValidation.textContent = "";
    elements.storyValidation.classList.add("hidden");
    elements.storyValidation.classList.remove("inline-error", "inline-info");
    return;
  }
  elements.storyValidation.innerHTML = content;
  elements.storyValidation.classList.remove("hidden", "inline-error", "inline-info");
  elements.storyValidation.classList.add(type === "info" ? "inline-info" : "inline-error");
}

function renderUploadResults(results) {
  const parts = ["<div><strong>Upload results</strong></div><ul>"];
  for (const r of results) {
    const fileLabel = escapeHtml(r.file);
    const status = r.ok ? "✅ Saved" : "❌ Failed";
    const savedAs = r.savedAs ? ` as <code>${escapeHtml(r.savedAs)}</code>` : "";

    const details = [];
    if (r.errors?.length) {
      details.push(`<div style="margin-top:6px;"><strong>Errors</strong><ul>${r.errors.map(e => `<li>${escapeHtml(e)}</li>`).join("")}</ul></div>`);
    }
    if (r.warnings?.length) {
      details.push(`<div style="margin-top:6px;"><strong>Warnings</strong><ul>${r.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join("")}</ul></div>`);
    }

    parts.push(`<li>${fileLabel} — ${status}${savedAs}${details.join("")}</li>`);
  }
  parts.push("</ul>");
  setStoryValidationBox(parts.join(""), "info");
}

function openAiModal() {
  if (!elements.aiModal) return;
  setAiError("");
  setAiLoading(false);
  setWizardStep(0);
  elements.aiModal.classList.remove("hidden");
}

function closeAiModal() {
  if (!elements.aiModal) return;
  elements.aiModal.classList.add("hidden");
}

function setAiError(message) {
  if (!elements.aiError) return;
  if (!message) {
    elements.aiError.textContent = "";
    elements.aiError.classList.add("hidden");
    return;
  }
  elements.aiError.textContent = message;
  elements.aiError.classList.remove("hidden");
}

function setAiLoading(isLoading) {
  if (elements.aiGenerateBtn) elements.aiGenerateBtn.disabled = isLoading;
  if (elements.aiNextBtn) elements.aiNextBtn.disabled = isLoading;
  if (elements.aiBackBtn) elements.aiBackBtn.disabled = isLoading;
  if (elements.aiSkipBtn) elements.aiSkipBtn.disabled = isLoading;
  if (elements.aiSpinner) elements.aiSpinner.classList.toggle("hidden", !isLoading);
  [elements.aiRequirements, elements.aiSelectors, elements.aiPath, elements.aiExpected].forEach((el) => {
    if (el) el.disabled = isLoading;
  });
}

function setWizardStep(step) {
  aiStep = Math.max(0, Math.min(3, step));
  wizardPanels.forEach((panel) => {
    panel.classList.toggle("hidden", String(aiStep) !== panel.dataset.panel);
  });
  wizardSteps.forEach((stepEl) => {
    stepEl.classList.toggle("active", String(aiStep) === stepEl.dataset.step);
  });
  if (elements.aiBackBtn) elements.aiBackBtn.disabled = aiStep === 0;
  if (elements.aiSkipBtn) elements.aiSkipBtn.classList.toggle("hidden", aiStep === 0 || aiStep === 3);
  if (elements.aiNextBtn) elements.aiNextBtn.classList.toggle("hidden", aiStep === 3);
  if (elements.aiGenerateBtn) elements.aiGenerateBtn.classList.toggle("hidden", aiStep !== 3);
  setAiError("");
}

function onWizardNext() {
  if (aiStep === 0 && !elements.aiRequirements?.value?.trim()) {
    setAiError("Please add plain requirements.");
    return;
  }
  if (aiStep === 3 && !elements.aiExpected?.value?.trim()) {
    setAiError("Please add the expected outcome.");
    return;
  }
  setWizardStep(aiStep + 1);
}

function onWizardBack() {
  setWizardStep(aiStep - 1);
}

function onWizardSkip() {
  setWizardStep(aiStep + 1);
}

async function onGenerateStoryFromAi() {
  const requirements = elements.aiRequirements?.value?.trim() || "";
  const selectors = elements.aiSelectors?.value?.trim() || "";
  const path = elements.aiPath?.value?.trim() || "";
  const expected = elements.aiExpected?.value?.trim() || "";

  if (!requirements) {
    setAiError("Please add plain requirements.");
    return;
  }
  if (!expected) {
    setAiError("Please add the expected outcome.");
    return;
  }

  setAiError("");
  setAiLoading(true);
  try {
    const r = await api.generateStoryFromAi({ requirements, selectors, path, expected });
    if (!r.ok || !r.data.ok) {
      setAiError(r.data.error || `Failed to generate story. (${r.status})`);
      return;
    }
    if (elements.story) elements.story.value = r.data.story || "";
    setEditorMode("story");
    setValidateState("idle");
    setStoryValidationBox("");
    closeAiModal();
  } catch (error) {
    setAiError(`Failed to generate story. ${String(error?.message || "").trim()}`);
  } finally {
    setAiLoading(false);
  }
}

function showConfirm(message, title = "Confirm action") {
  if (!elements.confirmModal || !elements.confirmMessage || !elements.confirmOkBtn || !elements.confirmCancelBtn || !elements.confirmTitle) {
    return window.confirm(message);
  }
  elements.confirmMessage.textContent = message;
  elements.confirmTitle.textContent = title;
  elements.confirmModal.classList.remove("hidden");
  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function closeConfirm(result) {
  if (!elements.confirmModal) return;
  elements.confirmModal.classList.add("hidden");
  if (confirmResolver) {
    confirmResolver(result);
    confirmResolver = null;
  }
}

function stripExtension(name) {
  return String(name).replace(/\.[^/.]+$/, "");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[m]));
}

export {
  init,
  onValidate,
  onSave,
  onUpload,
  fetchStories,
  fetchTests,
  loadStories,
  loadTests,
  onEditStory,
  onDeleteStory,
  onEditTest,
  onDeleteTest,
  onDeleteAllStories,
  onDeleteAllTests,
  onSaveTest,
  closeTestEditor,
  onGenerateStories,
  renderValidation,
  setEditorMode,
  setValidateState,
  setStoryValidated,
  setStoryValidationBox,
  openAiModal,
  closeAiModal,
  onGenerateStoryFromAi,
  showConfirm,
  stripExtension,
  escapeHtml,
  initRunConsole,
  createLists,
  // run console proxy exports for tests
  setRunStatus,
  setRunButtonsDisabled,
  resetRunConsole,
  setRunLog,
  setRunSummary,
  setRunError,
  formatLogs,
  setStepStatus,
  resetStepper,
  setStepStatusForAction,
  toggleReportCta,
  renderRunResult,
  onGenerate,
  onRunPipeline,
  onRunTests,
  onRunTest,
  onAnalyze,
};

function setRunStatus(...args) { return runConsole?.setRunStatus(...args); }
function setRunButtonsDisabled(...args) { return runConsole?.setRunButtonsDisabled(...args); }
function resetRunConsole(...args) { return runConsole?.resetRunConsole(...args); }
function setRunLog(...args) { return runConsole?.setRunLog(...args); }
function setRunSummary(...args) { return runConsole?.setRunSummary(...args); }
function setRunError(...args) { return runConsole?.setRunError(...args); }
function formatLogs(...args) { return runConsole?.formatLogs(...args); }
function setStepStatus(...args) { return runConsole?.setStepStatus(...args); }
function resetStepper(...args) { return runConsole?.resetStepper(...args); }
function setStepStatusForAction(...args) { return runConsole?.setStepStatusForAction(...args); }
function toggleReportCta(...args) { return runConsole?.toggleReportCta(...args); }
function renderRunResult(...args) { return runConsole?.renderRunResult(...args); }
function onGenerate(...args) { return runConsole?.onGenerateAll(...args); }
function onRunPipeline() {
  return runConsole?.runAction
    ? runConsole.runAction({
      request: () => api.runPipeline(),
      actionLabel: "Run pipeline",
      includeGenerated: true,
    })
    : undefined;
}
function onRunTests(...args) { return runConsole?.onRunTestsAll(...args); }
function onRunTest(...args) { return runConsole?.onRunTest(...args); }
function onAnalyze() {
  return runConsole?.runAction
    ? runConsole.runAction({
      request: () => api.runAnalyze(),
      actionLabel: "Analyze",
    })
    : undefined;
}

import * as api from "./modules/api.js";
import { initRunConsole } from "./modules/runConsole.js";
import { createLists } from "./modules/lists.js";
import { initEditor } from "./modules/editor.js";
import { initAiWizard } from "./modules/aiWizard.js";
import { initConfirm, confirm } from "./modules/confirmModal.js";

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
  runReportCard: $("runReportCard"),
  runReportFrame: $("runReportFrame"),
  runReportTraditionalFrame: $("runReportTraditionalFrame"),
  runReportFailedList: $("runReportFailedList"),
  runReportScreenshots: $("runReportScreenshots"),
  runReportScreenshotsTitle: $("runReportScreenshotsTitle"),
  runReportNotice: $("runReportNotice"),
  reportTabAi: $("reportTabAi"),
  reportTabTraditional: $("reportTabTraditional"),
  runReportPanelAi: $("runReportPanelAi"),
  runReportPanelTraditional: $("runReportPanelTraditional"),
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

let lists = null;
let runConsole = null;
let editor = null;

if (hasDom) {
  initConfirm(elements);

  lists = createLists(
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
      runReportCard: elements.runReportCard,
      runReportFrame: elements.runReportFrame,
      runReportTraditionalFrame: elements.runReportTraditionalFrame,
      runReportFailedList: elements.runReportFailedList,
      runReportScreenshots: elements.runReportScreenshots,
      runReportScreenshotsTitle: elements.runReportScreenshotsTitle,
      runReportNotice: elements.runReportNotice,
      reportTabAi: elements.reportTabAi,
      reportTabTraditional: elements.reportTabTraditional,
      runReportPanelAi: elements.runReportPanelAi,
      runReportPanelTraditional: elements.runReportPanelTraditional,
      copyStdoutBtn: elements.copyStdoutBtn,
      copyStderrBtn: elements.copyStderrBtn,
      generateAllStoriesBtn: elements.generateAllStoriesBtn,
      runAllTestsBtn: elements.runAllTestsBtn,
    },
    api,
    { loadTests: async () => lists?.loadTests() },
  );

  editor = initEditor({ elements, api, lists, runConsole, confirm });

  initAiWizard({ elements, api, editor });

  if (elements.generateAllStoriesBtn) elements.generateAllStoriesBtn.addEventListener("click", () => runConsole?.onGenerateAll());
  if (elements.runAllTestsBtn) elements.runAllTestsBtn.addEventListener("click", () => runConsole?.onRunTestsAll());

  init();
}

async function init() {
  await checkHealth();
  await lists?.loadStories();
  await lists?.loadTests();
  runConsole?.setRunStatus("idle");
  runConsole?.resetRunConsole();
  editor?.setEditorMode("story");
  editor?.renderValidation({ ok: true, errors: [], warnings: ["Paste a story and click Validate."] });
}

async function checkHealth() {
  if (!elements.health) return;
  try {
    const r = await fetch("/api/health");
    const j = await r.json();
    elements.health.textContent = j.ok ? "Server OK" : "Server not ready";
  } catch {
    elements.health.textContent = "Server offline";
  }
}

export { init };

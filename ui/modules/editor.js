let elements = {};
let api = null;
let lists = null;
let runConsole = null;
let confirmAction = null;

let editorMode = "story";
let activeTestName = "";
let activeStoryName = "";
let storyValidated = false;

export function initEditor({ elements: nextElements, api: nextApi, lists: nextLists, runConsole: nextRunConsole, confirm }) {
  elements = nextElements || {};
  api = nextApi;
  lists = nextLists;
  runConsole = nextRunConsole;
  confirmAction = confirm;

  if (elements.validateBtn) elements.validateBtn.addEventListener("click", onValidate);
  if (elements.saveBtn) elements.saveBtn.addEventListener("click", onSave);
  if (elements.uploadBtn) elements.uploadBtn.addEventListener("click", onUpload);
  if (elements.refreshBtn) elements.refreshBtn.addEventListener("click", () => lists?.loadStories());
  if (elements.deleteAllStoriesBtn) elements.deleteAllStoriesBtn.addEventListener("click", onDeleteAllStories);
  if (elements.refreshTestsBtn) elements.refreshTestsBtn.addEventListener("click", () => lists?.loadTests());
  if (elements.deleteAllTestsBtn) elements.deleteAllTestsBtn.addEventListener("click", onDeleteAllTests);
  if (elements.editorModeStoryBtn) elements.editorModeStoryBtn.addEventListener("click", () => setEditorMode("story"));
  if (elements.editorModeTestBtn) elements.editorModeTestBtn.addEventListener("click", () => setEditorMode("test"));
  if (elements.story) elements.story.addEventListener("input", () => setStoryValidated(false));

  return {
    onValidate,
    onSave,
    onUpload,
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
    renderUploadResults,
    stripExtension,
    escapeHtml,
  };
}

export async function onValidate() {
  if (editorMode === "test") {
    renderValidation({ ok: false, errors: ["Validation is only available for stories."] });
    return;
  }
  const content = elements.story?.value || "";
  const r = await api.validateStory(content);
  setStoryValidated(r.data.ok);
  setValidateState(r.data.ok ? "ok" : "error");
  renderValidation(r.data);
  runConsole?.setStepStatus("validate", r.data.ok ? "done" : "failed");
}

export async function onSave() {
  if (editorMode === "test") return onSaveTest();
  if (!storyValidated) {
    setValidateState("error");
    renderValidation({ ok: false, errors: ["Please validate the story before saving."] });
    return;
  }
  const content = elements.story?.value || "";
  const name = elements.filename?.value || "";
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

export async function onUpload() {
  const files = Array.from(elements.fileInput?.files || []);
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

  if (elements.fileInput) elements.fileInput.value = "";
  renderUploadResults(results);
  runConsole?.setStepStatus("save", results.every((r) => r.ok) ? "done" : "failed");
  await lists?.loadStories();
}

export async function onEditStory(fileName) {
  const r = await api.getStory(fileName);
  const j = r.data;
  if (!r.ok) {
    renderValidation({ ok: false, errors: [j.error || "Failed to load story."] });
    return;
  }

  if (elements.filename) elements.filename.value = stripExtension(j.name);
  if (elements.story) elements.story.value = j.content || "";
  activeTestName = "";
  activeStoryName = j.name;
  setEditorMode("story");
  renderValidation({ ok: true, warnings: ["Loaded story into editor."] });
}

export async function onDeleteStory(fileName) {
  const confirmDelete = await confirmAction?.(`Delete ${fileName}? This cannot be undone.`);
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

export async function onEditTest(fileName) {
  const r = await api.getTest(fileName);
  const j = r.data;
  if (!r.ok) {
    renderValidation({ ok: false, errors: [j.error || "Failed to load test."] });
    return;
  }

  activeTestName = j.name;
  activeStoryName = "";
  if (elements.filename) elements.filename.value = j.name;
  if (elements.story) elements.story.value = j.content || "";
  setEditorMode("test");
  renderValidation({ ok: true, warnings: ["Loaded test into editor."] });
}

export async function onDeleteTest(fileName) {
  const confirmDelete = await confirmAction?.(`Delete ${fileName}? This cannot be undone.`);
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

export async function onDeleteAllTests() {
  const confirmDelete = await confirmAction?.("Delete ALL tests? This cannot be undone.");
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

export async function onDeleteAllStories() {
  const confirmDelete = await confirmAction?.("Delete ALL stories? This cannot be undone.");
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

export async function onSaveTest() {
  const name = elements.filename?.value || activeTestName;
  const content = elements.story?.value || "";
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

export function closeTestEditor() {
  activeTestName = "";
}

export async function onGenerateStories() {
  if (editorMode !== "story") setEditorMode("story");
  await onValidate();
  if (!storyValidated) return;
  await onSave();
}

export function renderValidation(result) {
  const { errors = [] } = result || {};
  if (!errors.length) {
    setStoryValidationBox("");
    return;
  }
  const html = `<div><strong>Errors</strong><ul>${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul></div>`;
  setStoryValidationBox(html, "error");
}

export function setEditorMode(mode) {
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

export function setValidateState(state) {
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

export function setStoryValidated(ok) {
  storyValidated = Boolean(ok);
  if (elements.saveBtn && editorMode === "story") {
    elements.saveBtn.disabled = !storyValidated;
  }
}

export function setStoryValidationBox(content, type = "error") {
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

export function renderUploadResults(results) {
  const parts = ["<div><strong>Upload results</strong></div><ul>"];
  for (const r of results) {
    const fileLabel = escapeHtml(r.file);
    const status = r.ok ? "✅ Saved" : "❌ Failed";
    const savedAs = r.savedAs ? ` as <code>${escapeHtml(r.savedAs)}</code>` : "";

    const details = [];
    if (r.errors?.length) {
      details.push(`<div style="margin-top:6px;"><strong>Errors</strong><ul>${r.errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul></div>`);
    }
    if (r.warnings?.length) {
      details.push(`<div style="margin-top:6px;"><strong>Warnings</strong><ul>${r.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul></div>`);
    }

    parts.push(`<li>${fileLabel} — ${status}${savedAs}${details.join("")}</li>`);
  }
  parts.push("</ul>");
  setStoryValidationBox(parts.join(""), "info");
}

export function stripExtension(name) {
  return String(name).replace(/\.[^/.]+$/, "");
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[m]));
}

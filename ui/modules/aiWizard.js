const hasDom = typeof document !== "undefined";

let elements = {};
let api = null;
let editor = null;
let wizardPanels = [];
let wizardSteps = [];
let aiStep = 0;

export function initAiWizard({ elements: nextElements, api: nextApi, editor: nextEditor }) {
  elements = nextElements || {};
  api = nextApi;
  editor = nextEditor;

  if (hasDom) {
    wizardPanels = Array.from(document.querySelectorAll("[data-panel]"));
    wizardSteps = Array.from(document.querySelectorAll(".wizard-step"));
  }

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

  return { openAiModal, closeAiModal, onGenerateStoryFromAi };
}

export function openAiModal() {
  if (!elements.aiModal) return;
  setAiError("");
  setAiLoading(false);
  setWizardStep(0);
  elements.aiModal.classList.remove("hidden");
}

export function closeAiModal() {
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

export async function onGenerateStoryFromAi() {
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
    editor?.setEditorMode?.("story");
    editor?.setValidateState?.("idle");
    editor?.setStoryValidationBox?.("");
    closeAiModal();
  } catch (error) {
    setAiError(`Failed to generate story. ${String(error?.message || "").trim()}`);
  } finally {
    setAiLoading(false);
  }
}

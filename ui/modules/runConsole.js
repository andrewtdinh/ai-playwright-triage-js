export function initRunConsole(elements, api, { loadTests }) {
  const {
    runStatus,
    runSummary,
    runLog,
    runError,
    openReportBtn,
    runStepper,
    runConsoleCard,
    copyStdoutBtn,
    copyStderrBtn,
    generateAllStoriesBtn,
    runAllTestsBtn,
  } = elements;

  let lastRunOutput = { stdout: "", stderr: "" };

  if (copyStdoutBtn) copyStdoutBtn.addEventListener("click", () => copyRunOutput("stdout"));
  if (copyStderrBtn) copyStderrBtn.addEventListener("click", () => copyRunOutput("stderr"));

  function setRunStatus(state) {
    if (!runStatus) return;
    const labels = {
      idle: "Idle",
      running: "Running",
      failed: "Failed",
      passed: "Passed",
    };
    runStatus.textContent = labels[state] || "Idle";
    runStatus.classList.remove("idle", "running", "failed", "passed");
    runStatus.classList.add(state || "idle");
    if (runConsoleCard) {
      runConsoleCard.classList.toggle("running", state === "running");
    }
  }

  function setRunButtonsDisabled(disabled) {
    [generateAllStoriesBtn, runAllTestsBtn].forEach((btn) => {
      if (btn) btn.disabled = disabled;
    });
  }

  function resetRunConsole() {
    if (runSummary) runSummary.innerHTML = "";
    setRunLog("Awaiting action...");
    setRunError("");
    lastRunOutput = { stdout: "", stderr: "" };
    toggleReportCta({ show: false });
  }

  function setRunLog(content) {
    if (!runLog) return;
    runLog.textContent = content || "";
  }

  function setRunError(message) {
    if (!runError) return;
    if (!message) {
      runError.textContent = "";
      runError.classList.add("hidden");
      return;
    }
    runError.textContent = message;
    runError.classList.remove("hidden");
  }

  function setRunSummary(result) {
    const { ok, errors = [], warnings = [] } = result || {};
    const parts = [];
    parts.push(`<div><strong>Status:</strong> ${ok ? "✅ OK" : "❌ Fix required"}</div>`);
    if (errors.length) {
      parts.push(`<div style="margin-top:8px;"><strong>Errors</strong><ul>${errors.map(e => `<li>${escapeHtml(e)}</li>`).join("")}</ul></div>`);
    }
    if (warnings.length) {
      parts.push(`<div style="margin-top:8px;"><strong>Warnings</strong><ul>${warnings.map(w => `<li>${escapeHtml(w)}</li>`).join("")}</ul></div>`);
    }
    if (runSummary) runSummary.innerHTML = parts.join("");
  }

  function formatLogs(stdout, stderr, error) {
    const logs = [];
    if (stdout) logs.push(`stdout:\n${stdout}`);
    if (stderr) logs.push(`stderr:\n${stderr}`);
    if (error && !stderr) logs.push(`error:\n${error}`);
    return logs.length ? logs.join("\n\n") : "No log output.";
  }

  function setStepStatus(step, status) {
    if (!runStepper) return;
    const el = runStepper.querySelector(`[data-step="${step}"]`);
    if (!el) return;
    el.classList.remove("done", "running", "failed");
    if (status) el.classList.add(status);
  }

  function resetStepper() {
    if (!runStepper) return;
    runStepper.querySelectorAll(".step").forEach((step) => {
      step.classList.remove("done", "running", "failed");
    });
  }

  function setStepStatusForAction(actionLabel, status) {
    const label = String(actionLabel || "").toLowerCase();
    if (label.includes("pipeline")) {
      if (status === "running") {
        setStepStatus("generate", "running");
        setStepStatus("run", "");
        setStepStatus("analyze", "");
        setStepStatus("report", "");
      } else if (status === "done") {
        ["generate", "run", "analyze", "report"].forEach((step) => setStepStatus(step, "done"));
      } else if (status === "failed") {
        setStepStatus("generate", "failed");
      }
      return;
    }
    if (label.includes("generate")) return setStepStatus("generate", status);
    if (label.includes("run")) return setStepStatus("run", status);
    if (label.includes("analyze")) return setStepStatus("analyze", status);
    if (label.includes("report")) return setStepStatus("report", status);
  }

  function toggleReportCta({ actionLabel = "", stdout = "", stderr = "", ok = false, show } = {}) {
    if (!openReportBtn) return;
    const shouldShow = typeof show === "boolean"
      ? show
      : ok && (
        String(actionLabel).toLowerCase().includes("pipeline")
        || String(actionLabel).toLowerCase().includes("report")
        || String(stdout).includes("ai-report.html")
        || String(stderr).includes("ai-report.html")
      );
    openReportBtn.classList.toggle("hidden", !shouldShow);
  }

  function focusRunConsole() {
    if (runConsoleCard && runConsoleCard.scrollIntoView) {
      runConsoleCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderRunResult(
    result,
    { actionLabel = "Run", generated = [], totalCount = null, storyCount = null } = {},
  ) {
    const { ok, exitCode, stdout = "", stderr = "", error } = result || {};
    const parts = [];
    const statusLabel = ok ? "✅ Success" : "❌ Failed";

    parts.push(`<div><strong>${escapeHtml(actionLabel)}:</strong> ${statusLabel}</div>`);
    if (typeof exitCode === "number") parts.push(`<div><strong>Exit code:</strong> ${exitCode}</div>`);
    if (typeof storyCount === "number") {
      parts.push(`<div><strong>Stories processed:</strong> ${storyCount}</div>`);
    }
    if (generated.length) {
      const suffix = typeof storyCount === "number" ? ` / ${storyCount}` : "";
      parts.push(`<div><strong>Generated:</strong> ${generated.length}${suffix}</div>`);
      parts.push(`<ul>${generated.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>`);
    } else if (ok) {
      parts.push("<div><strong>Generated:</strong> No new test files.</div>");
    }
    if (typeof totalCount === "number") parts.push(`<div><strong>Total tests:</strong> ${totalCount}</div>`);
    if (error) parts.push(`<div><strong>Error:</strong> ${escapeHtml(error)}</div>`);

    runSummary.innerHTML = parts.join("");
    setRunLog(formatLogs(stdout, stderr, error));
    setRunError(ok ? "" : (error || stderr || "Run failed."));
    lastRunOutput = { stdout: stdout || "", stderr: stderr || "" };
    toggleReportCta({ actionLabel, stdout, stderr, ok });
  }

  async function onGenerateAll() {
    focusRunConsole();
    setRunButtonsDisabled(true);
    setRunStatus("running");
    setRunError("");
    setStepStatus("generate", "running");
    const startedAt = Date.now();
    const storyFiles = await api.getStories();
    const storyCount = storyFiles.data.files?.length || 0;

    const tick = () => {
      const elapsed = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
      setRunLog(`Generating tests for ${storyCount} stories... (${elapsed}s)`);
    };
    tick();
    const intervalId = setInterval(tick, 1000);

    const beforeTests = await api.getTests();
    try {
      const r = await api.runGenerateAll();
      const afterTests = await api.getTests();
      const beforeSet = new Set(beforeTests.data.files || []);
      const generated = (afterTests.data.files || []).filter((f) => !beforeSet.has(f));
      renderRunResult(r.data, {
        actionLabel: "Generate tests",
        generated,
        totalCount: (afterTests.data.files || []).length,
        storyCount,
      });
      setRunStatus(r.ok && r.data.ok !== false ? "passed" : "failed");
      setStepStatus("generate", r.ok && r.data.ok !== false ? "done" : "failed");
    } catch (error) {
      setRunSummary({ ok: false, errors: ["Generation failed. Try again."] });
      setRunStatus("failed");
      setStepStatus("generate", "failed");
    } finally {
      clearInterval(intervalId);
      setRunButtonsDisabled(false);
    }
    await loadTests();
  }

  async function onGenerateForStory(storyFile) {
    focusRunConsole();
    setRunButtonsDisabled(true);
    setRunStatus("running");
    setRunError("");
    setStepStatus("generate", "running");
    const startedAt = Date.now();

    const tick = () => {
      const elapsed = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
      setRunLog(`Generating tests for ${storyFile}... (${elapsed}s)`);
    };
    tick();
    const intervalId = setInterval(tick, 1000);

    const beforeTests = await api.getTests();
    try {
      const r = await api.runGenerateStory(storyFile);
      const afterTests = await api.getTests();
      const beforeSet = new Set(beforeTests.data.files || []);
      const generated = (afterTests.data.files || []).filter((f) => !beforeSet.has(f));
      renderRunResult(r.data, {
        actionLabel: `Generate tests (${storyFile})`,
        generated,
        totalCount: (afterTests.data.files || []).length,
        storyCount: 1,
      });
      setRunStatus(r.ok && r.data.ok !== false ? "passed" : "failed");
      setStepStatus("generate", r.ok && r.data.ok !== false ? "done" : "failed");
    } catch (error) {
      setRunSummary({ ok: false, errors: ["Generation failed. Try again."] });
      setRunStatus("failed");
      setStepStatus("generate", "failed");
    } finally {
      clearInterval(intervalId);
      setRunButtonsDisabled(false);
    }
    await loadTests();
  }

  async function runAction({ request, actionLabel, includeGenerated = false }) {
    focusRunConsole();
    setRunButtonsDisabled(true);
    setRunStatus("running");
    setRunError("");
    resetRunConsole();
    setStepStatusForAction(actionLabel, "running");
    const startedAt = Date.now();
    const storyFiles = await api.getStories();
    const storyCount = storyFiles.data.files?.length || 0;
    const beforeTests = includeGenerated ? await api.getTests() : { data: { files: [] } };

    const tick = () => {
      const elapsed = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
      setRunLog(`${actionLabel}... (${elapsed}s)`);
    };
    tick();
    const intervalId = setInterval(tick, 1000);

    try {
      const r = await request();
      const afterTests = includeGenerated ? await api.getTests() : { data: { files: [] } };
      const beforeSet = new Set(beforeTests.data.files || []);
      const generated = includeGenerated ? (afterTests.data.files || []).filter((f) => !beforeSet.has(f)) : [];
      renderRunResult(r.data, {
        actionLabel,
        generated,
        totalCount: includeGenerated ? (afterTests.data.files || []).length : null,
        storyCount: includeGenerated ? storyCount : null,
      });
      setRunStatus(r.ok && r.data.ok !== false ? "passed" : "failed");
      setStepStatusForAction(actionLabel, r.ok && r.data.ok !== false ? "done" : "failed");
    } catch (error) {
      setRunSummary({ ok: false, errors: [`${actionLabel} failed. Try again.`] });
      setRunStatus("failed");
      setStepStatusForAction(actionLabel, "failed");
    } finally {
      clearInterval(intervalId);
      setRunButtonsDisabled(false);
    }

    await loadTests();
  }

  async function onRunTestsAll() {
    await runAction({
      request: () => api.runTestsAll(),
      actionLabel: "Run tests",
    });
  }

  async function onRunTest(testFile) {
    await runAction({
      request: () => api.runTestFile(testFile),
      actionLabel: `Run tests (${testFile})`,
    });
  }

  function copyRunOutput(kind) {
    const text = kind === "stderr" ? lastRunOutput.stderr : lastRunOutput.stdout;
    if (!text) return;
    navigator.clipboard.writeText(text)
      .then(() => setRunError(`${kind} copied to clipboard.`))
      .catch((error) => setRunError(`Copy failed. ${String(error?.message || "")}`.trim()));
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

  return {
    setRunStatus,
    setRunButtonsDisabled,
    resetRunConsole,
    setRunLog,
    setRunError,
    setRunSummary,
    formatLogs,
    setStepStatus,
    resetStepper,
    setStepStatusForAction,
    toggleReportCta,
    renderRunResult,
    focusRunConsole,
    onGenerateAll,
    onGenerateForStory,
    onRunTestsAll,
    onRunTest,
    runAction,
  };
}

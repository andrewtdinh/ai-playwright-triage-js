export function initRunConsole(elements, api, { loadTests }) {
  const {
    runStatus,
    runSummary,
    runLog,
    runError,
    openReportBtn,
    runStepper,
    runConsoleCard,
    runReportCard,
    runReportFrame,
    runReportFailedList,
    runReportScreenshots,
    runReportScreenshotsTitle,
    runReportNotice,
    copyStdoutBtn,
    copyStderrBtn,
    generateAllStoriesBtn,
    runAllTestsBtn,
  } = elements;

  let lastRunOutput = { stdout: "", stderr: "" };

  if (copyStdoutBtn) copyStdoutBtn.addEventListener("click", () => copyRunOutput("stdout"));
  if (copyStderrBtn) copyStderrBtn.addEventListener("click", () => copyRunOutput("stderr"));
  if (runReportFailedList) runReportFailedList.addEventListener("click", onFixClick);

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
    if (runSummary) {
      runSummary.innerHTML = "";
      runSummary.classList.add("hidden");
    }
    setRunLog("Awaiting action...");
    setRunError("");
    lastRunOutput = { stdout: "", stderr: "" };
    toggleReportCta({ show: false });
    resetReport();
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

  function setReportNotice(message) {
    if (!runReportNotice) return;
    if (!message) {
      runReportNotice.textContent = "";
      runReportNotice.classList.add("hidden");
      return;
    }
    runReportNotice.textContent = message;
    runReportNotice.classList.remove("hidden");
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
    if (runSummary) {
      runSummary.innerHTML = parts.join("");
      runSummary.classList.toggle("hidden", parts.length === 0);
    }
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

  function focusRunOutput() {
    focusRunConsole();
  }

  function resetReport() {
    if (runReportCard) runReportCard.classList.add("hidden");
    if (runReportFrame) runReportFrame.removeAttribute("src");
    if (runReportFailedList) runReportFailedList.innerHTML = "";
    if (runReportScreenshots) {
      runReportScreenshots.innerHTML = "";
      runReportScreenshots.classList.add("hidden");
    }
    if (runReportScreenshotsTitle) runReportScreenshotsTitle.classList.add("hidden");
    setReportNotice("");
  }

  async function showReport() {
    if (runReportCard) runReportCard.classList.remove("hidden");
    const reportUrl = `/ai-report.html?ts=${Date.now()}`;
    if (runReportFrame) runReportFrame.src = reportUrl;
    if (openReportBtn) openReportBtn.href = reportUrl;
    if (!runReportFailedList && !runReportScreenshots) return;

    try {
      const response = await fetch(reportUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("Report not available");
      const html = await response.text();
      const artifacts = extractFailureArtifacts(`${lastRunOutput.stdout}\n${lastRunOutput.stderr}`);
      const hasFailures = renderReportDetails(html, reportUrl, artifacts);
      if (!hasFailures && runReportCard) {
        runReportCard.classList.add("hidden");
        if (runReportFrame) runReportFrame.removeAttribute("src");
      }
    } catch (error) {
      if (runReportFailedList) {
        runReportFailedList.innerHTML = "<div class=\"inline-info\">Report is not available yet. Run Analyze again after the server reloads.</div>";
      }
      if (runReportScreenshots) runReportScreenshots.classList.add("hidden");
      if (runReportScreenshotsTitle) runReportScreenshotsTitle.classList.add("hidden");
    }
  }

  function renderReportDetails(html, reportUrl, artifacts = {}) {
    if (!runReportFailedList && !runReportScreenshots) return false;
    const doc = new DOMParser().parseFromString(html, "text/html");
    const sections = Array.from(doc.querySelectorAll("section.test"));
    const failedItems = [];

    sections.forEach((section) => {
      const title = section.querySelector("h2")?.textContent?.trim() || "Untitled test";
      const statusText = section.querySelector(".badge-status")?.textContent?.trim() || "unknown";
      const hints = artifacts[title] || {};
      const isFailed = /unexpected|failed|error/i.test(statusText);
      if (isFailed) {
        failedItems.push({ title, statusText, ...hints });
      }
    });

    if (runReportFailedList) {
      if (!sections.length) {
        runReportFailedList.innerHTML = "<div class=\"inline-info\">No report data found yet.</div>";
      } else if (!failedItems.length) {
        runReportFailedList.innerHTML = "<div class=\"inline-info\">No failed tests detected.</div>";
      } else {
        runReportFailedList.innerHTML = failedItems.map(({ title, statusText, testFile, errorContext }) => `
          <div class="report-item">
            <div>
              <div class="report-title">${escapeHtml(title)}</div>
              <div class="report-sub">
                <span class="report-status failed">${escapeHtml(statusText)}</span>
                ${testFile ? `<span class="report-file">${escapeHtml(testFile)}</span>` : ""}
              </div>
            </div>
            <div class="report-actions">
              <button
                class="btn small ai"
                data-action="fix-test"
                data-test-title="${escapeHtml(title)}"
                data-test-file="${escapeHtml(testFile || "")}"
                data-error-context="${escapeHtml(errorContext || "")}"
                type="button"
              >
                Fix with AI
              </button>
            </div>
          </div>
        `).join("");
      }
    }

    if (runReportScreenshots) {
      const images = Array.from(doc.querySelectorAll("img"))
        .map((img) => img.getAttribute("src"))
        .filter(Boolean)
        .map((src) => new URL(src, reportUrl).href);

      if (!images.length) {
        runReportScreenshots.classList.add("hidden");
        runReportScreenshots.innerHTML = "";
        if (runReportScreenshotsTitle) runReportScreenshotsTitle.classList.add("hidden");
      } else {
        runReportScreenshots.classList.remove("hidden");
        runReportScreenshots.innerHTML = images.map((src) => `
          <div class="report-screenshot">
            <img src="${escapeHtml(src)}" alt="Test screenshot" loading="lazy" />
          </div>
        `).join("");
        if (runReportScreenshotsTitle) runReportScreenshotsTitle.classList.remove("hidden");
      }
    }
    return failedItems.length > 0;
  }

  async function onFixClick(event) {
    const button = event.target.closest("[data-action=\"fix-test\"]");
    if (!button) return;
    const title = button.getAttribute("data-test-title") || "test";
    const testFile = button.getAttribute("data-test-file") || "";
    const errorContext = button.getAttribute("data-error-context") || "";
    button.disabled = true;
    button.classList.add("loading");
    setReportNotice(`Fixing ${title} with AI...`);

    try {
      const payload = {
        testTitle: title,
        testFile,
        stdout: lastRunOutput.stdout,
        stderr: lastRunOutput.stderr,
        errorContextPaths: errorContext ? [errorContext] : [],
      };
      const response = await api.fixTestWithAi(payload);
      if (!response.ok || response.data?.ok === false) {
        const message = response.data?.error || "AI fix failed. Try again.";
        setReportNotice(message);
        return;
      }
      const updatedFile = response.data?.updatedFile || testFile || "test file";
      setReportNotice(`Applied AI fix to ${updatedFile}. Re-running tests...`);
      resetReport();
      if (updatedFile) {
        await onRunTest(updatedFile);
      }
    } catch (error) {
      setReportNotice(`AI fix failed. ${String(error?.message || "")}`.trim());
    } finally {
      button.disabled = false;
      button.classList.remove("loading");
    }
  }

  function extractFailureArtifacts(rawLogs) {
    const artifacts = {};
    if (!rawLogs) return artifacts;
    const entries = [];
    const entryRegex = /tests\/([^\s]+\.spec\.js):\d+:\d+\s+›\s+([^\n]+)/g;
    let match;
    while ((match = entryRegex.exec(rawLogs))) {
      entries.push({ testFile: match[1], title: match[2].trim() });
    }
    const contextRegex = /Error Context:\s*([^\s]+)/g;
    const contexts = [];
    while ((match = contextRegex.exec(rawLogs))) {
      contexts.push(match[1]);
    }
    entries.forEach((entry, index) => {
      artifacts[entry.title] = {
        testFile: entry.testFile,
        errorContext: contexts[index] || "",
      };
    });
    return artifacts;
  }

  function buildRunResultContent(
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

    return {
      ok: Boolean(ok),
      summaryHtml: parts.join(""),
      logText: formatLogs(stdout, stderr, error),
      errorText: ok ? "" : (error || stderr || "Run failed."),
      output: { stdout: stdout || "", stderr: stderr || "" },
    };
  }

  function renderRunResult(
    result,
    { actionLabel = "Run", generated = [], totalCount = null, storyCount = null } = {},
  ) {
    const content = buildRunResultContent(result, { actionLabel, generated, totalCount, storyCount });
    runSummary.innerHTML = content.summaryHtml;
    runSummary.classList.toggle("hidden", !content.summaryHtml);
    setRunLog(content.logText);
    setRunError(content.errorText);
    lastRunOutput = { ...content.output };
    toggleReportCta({ actionLabel, stdout: content.output.stdout, stderr: content.output.stderr, ok: content.ok });
    if (content.ok && String(actionLabel).toLowerCase().includes("analyze")) {
      showReport();
    }
  }

  function combineSummaries(summaries) {
    return summaries
      .filter(Boolean)
      .map((html, index) => (index === 0 ? html : `<div style="margin-top:10px;"></div>${html}`))
      .join("");
  }

  function appendLabeledOutput(current, label, output) {
    const stdout = output?.stdout || "";
    const stderr = output?.stderr || "";
    const labelLine = label ? `[${label}]` : "";
    const nextStdout = stdout ? `${labelLine}${labelLine ? "\n" : ""}${stdout}` : "";
    const nextStderr = stderr ? `${labelLine}${labelLine ? "\n" : ""}${stderr}` : "";
    return {
      stdout: [current.stdout, nextStdout].filter(Boolean).join("\n\n"),
      stderr: [current.stderr, nextStderr].filter(Boolean).join("\n\n"),
    };
  }

  async function onGenerateAll() {
    focusRunOutput();
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
    focusRunOutput();
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
    focusRunOutput();
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
    focusRunOutput();
    setRunButtonsDisabled(true);
    setRunStatus("running");
    setRunError("");
    resetRunConsole();
    resetStepper();

    const startedAt = Date.now();
    let currentLabel = "Run tests";
    const tick = () => {
      const elapsed = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
      setRunLog(`${currentLabel}... (${elapsed}s)`);
    };
    tick();
    const intervalId = setInterval(tick, 1000);

    const summaries = [];
    let combinedOutput = { stdout: "", stderr: "" };
    let runContent = null;
    let analyzeContent = null;
    let runOk = false;
    let analyzeOk = false;

    try {
      setStepStatus("run", "running");
      const runResult = await api.runTestsAll();
      runContent = buildRunResultContent(runResult.data, { actionLabel: "Run tests" });
      summaries.push(runContent.summaryHtml);
      combinedOutput = appendLabeledOutput(combinedOutput, "Run tests", runContent.output);

      runOk = runResult.ok && runResult.data.ok !== false;
      setStepStatus("run", runOk ? "done" : "failed");

      currentLabel = "Analyze";
      setStepStatus("analyze", "running");
      setStepStatus("report", "running");
      const analyzeResult = await api.runAnalyze();
      analyzeContent = buildRunResultContent(analyzeResult.data, { actionLabel: "Analyze" });
      summaries.push(analyzeContent.summaryHtml);
      combinedOutput = appendLabeledOutput(combinedOutput, "Analyze", analyzeContent.output);

      analyzeOk = analyzeResult.ok && analyzeResult.data.ok !== false;
      setStepStatus("analyze", analyzeOk ? "done" : "failed");
      setStepStatus("report", analyzeOk ? "done" : "failed");
      if (analyzeOk) {
        showReport();
      }
    } catch (error) {
      analyzeContent = buildRunResultContent(
        { ok: false, error: "Analyze failed. Try again." },
        { actionLabel: "Analyze" },
      );
      summaries.push(analyzeContent.summaryHtml);
      setStepStatus("analyze", "failed");
      setStepStatus("report", "failed");
    } finally {
      clearInterval(intervalId);
      setRunButtonsDisabled(false);
    }

    if (!runContent) {
      runContent = buildRunResultContent({ ok: false, error: "Run tests failed. Try again." }, { actionLabel: "Run tests" });
      summaries.unshift(runContent.summaryHtml);
    }

    runSummary.innerHTML = combineSummaries(summaries);
    runSummary.classList.toggle("hidden", summaries.length === 0);
    setRunLog([runContent.logText, analyzeContent?.logText].filter(Boolean).join("\n\n"));
    setRunError(
      !runOk
        ? runContent.errorText
        : (analyzeOk ? "" : (analyzeContent?.errorText || "Analyze failed.")),
    );
    lastRunOutput = { ...combinedOutput };
    toggleReportCta({
      show: analyzeOk,
      actionLabel: "Analyze",
      stdout: combinedOutput.stdout,
      stderr: combinedOutput.stderr,
      ok: analyzeOk,
    });
    setRunStatus(runOk && analyzeOk ? "passed" : "failed");

    await loadTests();
  }

  async function onRunTest(testFile) {
    focusRunOutput();
    setRunButtonsDisabled(true);
    setRunStatus("running");
    setRunError("");
    resetRunConsole();
    resetStepper();

    const startedAt = Date.now();
    let currentLabel = `Run tests (${testFile})`;
    const tick = () => {
      const elapsed = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
      setRunLog(`${currentLabel}... (${elapsed}s)`);
    };
    tick();
    const intervalId = setInterval(tick, 1000);

    const summaries = [];
    let combinedOutput = { stdout: "", stderr: "" };
    let runContent = null;
    let analyzeContent = null;
    let runOk = false;
    let analyzeOk = false;

    try {
      setStepStatus("run", "running");
      const runResult = await api.runTestFile(testFile);
      runContent = buildRunResultContent(runResult.data, { actionLabel: `Run tests (${testFile})` });
      summaries.push(runContent.summaryHtml);
      combinedOutput = appendLabeledOutput(combinedOutput, `Run tests (${testFile})`, runContent.output);

      runOk = runResult.ok && runResult.data.ok !== false;
      setStepStatus("run", runOk ? "done" : "failed");

      currentLabel = "Analyze";
      setStepStatus("analyze", "running");
      setStepStatus("report", "running");
      const analyzeResult = await api.runAnalyze();
      analyzeContent = buildRunResultContent(analyzeResult.data, { actionLabel: "Analyze" });
      summaries.push(analyzeContent.summaryHtml);
      combinedOutput = appendLabeledOutput(combinedOutput, "Analyze", analyzeContent.output);

      analyzeOk = analyzeResult.ok && analyzeResult.data.ok !== false;
      setStepStatus("analyze", analyzeOk ? "done" : "failed");
      setStepStatus("report", analyzeOk ? "done" : "failed");

      runSummary.innerHTML = combineSummaries(summaries);
      runSummary.classList.toggle("hidden", summaries.length === 0);
      setRunLog([runContent.logText, analyzeContent.logText].filter(Boolean).join("\n\n"));
      setRunError(!runOk ? runContent.errorText : (analyzeOk ? "" : analyzeContent.errorText));
      lastRunOutput = { ...combinedOutput };
      toggleReportCta({
        show: analyzeOk,
        actionLabel: "Analyze",
        stdout: combinedOutput.stdout,
        stderr: combinedOutput.stderr,
        ok: analyzeOk,
      });
      if (analyzeOk) {
        showReport();
      }
      setRunStatus(runOk && analyzeOk ? "passed" : "failed");
    } catch (error) {
      runSummary.innerHTML = combineSummaries(summaries);
      runSummary.classList.toggle("hidden", summaries.length === 0);
      analyzeContent = buildRunResultContent(
        { ok: false, error: "Analyze failed. Try again." },
        { actionLabel: "Analyze" },
      );
      if (analyzeContent?.summaryHtml) {
        summaries.push(analyzeContent.summaryHtml);
        runSummary.innerHTML = combineSummaries(summaries);
        runSummary.classList.toggle("hidden", summaries.length === 0);
      }
      if (!runContent) {
        runContent = buildRunResultContent(
          { ok: false, error: `Run tests (${testFile}) failed. Try again.` },
          { actionLabel: `Run tests (${testFile})` },
        );
        summaries.unshift(runContent.summaryHtml);
        runSummary.innerHTML = combineSummaries(summaries);
        runSummary.classList.toggle("hidden", summaries.length === 0);
      }
      setRunLog([runContent?.logText, analyzeContent?.logText].filter(Boolean).join("\n\n"));
      setRunError(!runOk ? `Run tests (${testFile}) failed. Try again.` : "Analyze failed. Try again.");
      setRunStatus("failed");
      if (!runOk) setStepStatus("run", "failed");
      setStepStatus("analyze", "failed");
      setStepStatus("report", "failed");
    } finally {
      clearInterval(intervalId);
      setRunButtonsDisabled(false);
    }

    await loadTests();
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
    focusRunOutput,
    onGenerateAll,
    onGenerateForStory,
    onRunTestsAll,
    onRunTest,
    runAction,
  };
}

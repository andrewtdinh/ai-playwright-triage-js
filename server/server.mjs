// server/server.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import OpenAI from "openai";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultRoot = path.join(__dirname, "..");

const PORT = process.env.PORT ? Number(process.env.PORT) : 5173;

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8", ...headers });
  res.end(body);
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(body);
}

function safeFileName(input) {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "story";
}

function nextUntitledStoryName(storiesDir) {
  const files = fs.readdirSync(storiesDir).filter((f) => f.startsWith("untitled_story_") && f.endsWith(".md"));
  let max = 0;
  for (const file of files) {
    const match = file.match(/^untitled_story_(\d+)\.md$/);
    if (match) {
      const num = Number(match[1]);
      if (Number.isFinite(num)) max = Math.max(max, num);
    }
  }
  return `untitled_story_${max + 1}`;
}

function safeStoryFile(input) {
  const raw = String(input || "").trim();
  if (!raw || raw.includes("/") || raw.includes("\\") || raw.includes("..")) return null;
  if (!raw.endsWith(".md")) return null;
  return raw;
}

function safeTestFile(input) {
  const raw = String(input || "").trim();
  if (!raw || raw.includes("/") || raw.includes("\\") || raw.includes("..")) return null;
  if (!raw.endsWith(".spec.js")) return null;
  return raw;
}

function safeRelativePath(input) {
  const raw = String(input || "").trim();
  if (!raw || raw.includes("\\") || raw.includes("..")) return null;
  return raw.startsWith("/") ? raw.slice(1) : raw;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function validateStoryText(text) {
  const errors = [];
  const warnings = [];

  const t = (text || "").trim();
  if (!t) errors.push("Story text is empty.");

  // Acceptance section with bullets (simple + practical)
  const hasAcceptance = /(?:^|\n)\s*(acceptance(?:\s+criteria)?|ac)\s*:?\s*/i.test(t);
  const hasBullets = /(^|\n)\s*-\s+.+/m.test(t);

  if (!hasAcceptance) warnings.push("Missing an 'Acceptance:' section (recommended).");
  if (!hasBullets) warnings.push("No bullet steps found (e.g. '- Navigate to ...').");

  // Optional: base URL presence
  const hasUrl = /(https?:\/\/[^\s)]+)/i.test(t);
  if (!hasUrl) warnings.push("No Base URL detected (you can still generate tests, but URL helps).");

  return { ok: errors.length === 0, errors, warnings };
}

function isDuplicateStory(storiesDir, content) {
  const normalized = (content || "").trim();
  if (!normalized) return false;
  const files = fs.readdirSync(storiesDir).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const existing = fs.readFileSync(path.join(storiesDir, file), "utf8").trim();
    if (existing === normalized) {
      return file;
    }
  }
  return null;
}

function createServer(options = {}) {
  const projectRoot = options.projectRoot || defaultRoot;
  const uiDir = options.uiDir || path.join(projectRoot, "ui");
  const storiesDir = options.storiesDir || path.join(projectRoot, "stories");
  const testsDir = options.testsDir || path.join(projectRoot, "tests");
  const mockRuns = options.mockRuns === true;
  let isRunning = false;
  const aiClient = options.aiClient || (process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null);

  if (!fs.existsSync(storiesDir)) fs.mkdirSync(storiesDir, { recursive: true });

  function runCommand(res, command) {
    if (isRunning) return sendJson(res, 429, { ok: false, error: "Pipeline already running." });
    isRunning = true;

    if (mockRuns) {
      isRunning = false;
      return sendJson(res, 200, {
        ok: true,
        exitCode: 0,
        stdout: `mocked: ${command}`,
        stderr: "",
      });
    }

    exec(command, { cwd: projectRoot, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      isRunning = false;
      if (error) {
        return sendJson(res, 200, {
          ok: false,
          exitCode: error.code ?? 1,
          stdout: stdout || "",
          stderr: stderr || error.message,
        });
      }
      return sendJson(res, 200, { ok: true, exitCode: 0, stdout: stdout || "", stderr: stderr || "" });
    });
  }

  function serveStatic(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;

  const rootFiles = {
    "/ai-report.html": path.join(projectRoot, "ai-report.html"),
    "/ai-report.css": path.join(projectRoot, "ai-report.css"),
    "/ai-analysis.json": path.join(projectRoot, "ai-analysis.json"),
  };

  if (rootFiles[pathname]) {
    const filePath = rootFiles[pathname];
    if (!fs.existsSync(filePath)) return send(res, 404, "Not found");
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
    };
    const contentType = types[ext] || "application/octet-stream";
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { "content-type": contentType });
    res.end(data);
    return;
  }

  if (pathname.startsWith("/playwright-report")) {
    const reportRoot = path.join(projectRoot, "playwright-report");
    const relPath = pathname.replace("/playwright-report", "") || "/index.html";
    const filePath = path.join(reportRoot, relPath.replace(/^\//, ""));
    if (!filePath.startsWith(reportRoot)) return send(res, 403, "Forbidden");
    if (!fs.existsSync(filePath)) return send(res, 404, "Not found");
    if (fs.statSync(filePath).isDirectory()) {
      const indexPath = path.join(filePath, "index.html");
      if (!fs.existsSync(indexPath)) return send(res, 404, "Not found");
      return serveStaticFile(indexPath, res);
    }
    return serveStaticFile(filePath, res);
  }

    // Only serve from /ui
    const filePath = path.join(uiDir, pathname.replace(/^\//, ""));
    if (!filePath.startsWith(uiDir)) return send(res, 403, "Forbidden");

    if (!fs.existsSync(filePath)) return send(res, 404, "Not found");

    return serveStaticFile(filePath, res);
  }

  function serveStaticFile(filePath, res) {
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".json": "application/json; charset=utf-8",
    };

    const contentType = types[ext] || "application/octet-stream";
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { "content-type": contentType });
    res.end(data);
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

  // --- API ---
  if (url.pathname === "/api/health" && req.method === "GET") {
    return sendJson(res, 200, { ok: true });
  }

  if (url.pathname === "/api/stories" && req.method === "GET") {
    const files = fs
      .readdirSync(storiesDir)
      .filter((f) => f.endsWith(".md"))
      .sort();
    return sendJson(res, 200, { files });
  }

  if (url.pathname === "/api/stories" && req.method === "DELETE") {
    const files = fs
      .readdirSync(storiesDir)
      .filter((f) => f.endsWith(".md"));

    for (const f of files) {
      const filePath = path.join(storiesDir, f);
      if (filePath.startsWith(storiesDir)) fs.unlinkSync(filePath);
    }

    return sendJson(res, 200, { ok: true, deletedCount: files.length });
  }

  if (url.pathname === "/api/tests" && req.method === "GET") {
    const files = fs
      .readdirSync(testsDir)
      .filter((f) => f.endsWith(".spec.js"))
      .filter((f) => {
        const filePath = path.join(testsDir, f);
        return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
      })
      .sort();
    return sendJson(res, 200, { files });
  }

  if (url.pathname === "/api/tests" && req.method === "DELETE") {
    const files = fs
      .readdirSync(testsDir)
      .filter((f) => f.endsWith(".spec.js"))
      .filter((f) => {
        const filePath = path.join(testsDir, f);
        return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
      });

    for (const f of files) {
      const filePath = path.join(testsDir, f);
      if (filePath.startsWith(testsDir)) fs.unlinkSync(filePath);
    }

    return sendJson(res, 200, { ok: true, deletedCount: files.length });
  }

  if (url.pathname === "/api/test" && req.method === "GET") {
    const name = safeTestFile(url.searchParams.get("name"));
    if (!name) return sendJson(res, 400, { ok: false, error: "Invalid test name." });

    const filePath = path.join(testsDir, name);
    if (!filePath.startsWith(testsDir)) return sendJson(res, 403, { ok: false, error: "Forbidden." });
    if (!fs.existsSync(filePath)) return sendJson(res, 404, { ok: false, error: "Not found." });

    const content = fs.readFileSync(filePath, "utf8");
    return sendJson(res, 200, { ok: true, name, content });
  }

  if (url.pathname === "/api/test" && req.method === "DELETE") {
    const name = safeTestFile(url.searchParams.get("name"));
    if (!name) return sendJson(res, 400, { ok: false, error: "Invalid test name." });

    const filePath = path.join(testsDir, name);
    if (!filePath.startsWith(testsDir)) return sendJson(res, 403, { ok: false, error: "Forbidden." });
    if (!fs.existsSync(filePath)) return sendJson(res, 404, { ok: false, error: "Not found." });

    fs.unlinkSync(filePath);
    return sendJson(res, 200, { ok: true, deleted: name });
  }

  if (url.pathname === "/api/test" && req.method === "PUT") {
    const name = safeTestFile(url.searchParams.get("name"));
    if (!name) return sendJson(res, 400, { ok: false, error: "Invalid test name." });

    const body = await readBody(req);
    const { content } = JSON.parse(body || "{}");
    const cleaned = String(content || "");
    if (!cleaned.trim()) return sendJson(res, 400, { ok: false, error: "Test content is empty." });

    const filePath = path.join(testsDir, name);
    if (!filePath.startsWith(testsDir)) return sendJson(res, 403, { ok: false, error: "Forbidden." });
    fs.writeFileSync(filePath, cleaned, "utf8");

    return sendJson(res, 200, { ok: true, saved: name });
  }

  if (url.pathname === "/api/story" && req.method === "GET") {
    const name = safeStoryFile(url.searchParams.get("name"));
    if (!name) return sendJson(res, 400, { ok: false, error: "Invalid story name." });

    const filePath = path.join(storiesDir, name);
    if (!filePath.startsWith(storiesDir)) return sendJson(res, 403, { ok: false, error: "Forbidden." });
    if (!fs.existsSync(filePath)) return sendJson(res, 404, { ok: false, error: "Not found." });

    const content = fs.readFileSync(filePath, "utf8");
    return sendJson(res, 200, { ok: true, name, content });
  }

  if (url.pathname === "/api/story" && req.method === "DELETE") {
    const name = safeStoryFile(url.searchParams.get("name"));
    if (!name) return sendJson(res, 400, { ok: false, error: "Invalid story name." });

    const filePath = path.join(storiesDir, name);
    if (!filePath.startsWith(storiesDir)) return sendJson(res, 403, { ok: false, error: "Forbidden." });
    if (!fs.existsSync(filePath)) return sendJson(res, 404, { ok: false, error: "Not found." });

    fs.unlinkSync(filePath);
    return sendJson(res, 200, { ok: true, deleted: name });
  }

  if (url.pathname === "/api/validate" && req.method === "POST") {
    const body = await readBody(req);
    const { content } = JSON.parse(body || "{}");
    return sendJson(res, 200, validateStoryText(content));
  }

  if (url.pathname === "/api/stories" && req.method === "POST") {
    const body = await readBody(req);
    const { filename, content } = JSON.parse(body || "{}");

    const cleaned = (content || "").trim();
    const v = validateStoryText(cleaned);

    // Block save only if truly empty/invalid
    if (!v.ok) return sendJson(res, 400, v);

    const duplicate = isDuplicateStory(storiesDir, cleaned);
    if (duplicate) {
      return sendJson(res, 409, {
        ok: false,
        error: `Duplicate story content matches ${duplicate}.`,
      });
    }

    const provided = String(filename || "").trim();
    const base = provided ? safeFileName(provided) : nextUntitledStoryName(storiesDir);
    const outPath = path.join(storiesDir, `${base}.md`);
    fs.writeFileSync(outPath, cleaned, "utf8");

    return sendJson(res, 200, { ok: true, savedAs: `${base}.md`, ...v });
  }

  if (url.pathname === "/api/run/ai-gen" && req.method === "POST") {
    const storyName = safeStoryFile(url.searchParams.get("story"));
    if (storyName) {
      return runCommand(res, `npm run ai:gen -- --story "${storyName}"`);
    }
    return runCommand(res, "npm run ai:gen");
  }

  if (url.pathname === "/api/run/tests" && req.method === "POST") {
    const testName = safeTestFile(url.searchParams.get("test"));
    if (testName) {
      return runCommand(res, `npx playwright test "tests/${testName}" --config=playwright.config.mjs`);
    }
    return runCommand(res, "npm run ai:test");
  }

  if (url.pathname === "/api/run/analyze" && req.method === "POST") {
    const wantsHtml = url.searchParams.get("html") !== "0" && url.searchParams.get("report") !== "0";
    return runCommand(res, wantsHtml ? "npm run ai:report" : "npm run ai:analyze");
  }

  if (url.pathname === "/api/run/report" && req.method === "POST") {
    return runCommand(res, "npm run ai:report");
  }

  if (url.pathname === "/api/run/pipeline" && req.method === "POST") {
    return runCommand(res, "npm run ai:flow");
  }

  if (url.pathname === "/api/ai/story" && req.method === "POST") {
    if (!aiClient) return sendJson(res, 500, { ok: false, error: "OpenAI API key not configured." });
    const body = await readBody(req);
    const { requirements, selectors, path: userPath, expected } = JSON.parse(body || "{}");

    if (!requirements || !expected) {
      return sendJson(res, 400, { ok: false, error: "Requirements and expected outcome are required." });
    }

    const prompt = `
You are a QA analyst writing user stories for test automation.

Create a concise story in plain English. Format:

Title: <short title>
Base URL: <optional if provided>
Story:
As a user, I want to ...

Acceptance:
- ...
- ...
- ...

Inputs:
Requirements: ${requirements}
Selectors/UI: ${selectors || "n/a"}
Path/Steps: ${userPath || "n/a"}
Expected outcome: ${expected}
`.trim();

    try {
      const response = await aiClient.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: "You write crisp user stories for QA. No markdown." },
          { role: "user", content: prompt },
        ],
      });
      const storyText = (response.choices?.[0]?.message?.content || "").trim();
      return sendJson(res, 200, { ok: true, story: storyText });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: "AI generation failed." });
    }
  }

  if (url.pathname === "/api/ai/fix-test" && req.method === "POST") {
    if (!aiClient) return sendJson(res, 500, { ok: false, error: "OpenAI API key not configured." });
    const body = await readBody(req);
    const {
      testTitle = "",
      testFile = "",
      stdout = "",
      stderr = "",
      errorContextPaths = [],
    } = JSON.parse(body || "{}");

    let safeTest = safeTestFile(testFile);
    if (!safeTest && testTitle) {
      const files = fs.readdirSync(testsDir).filter((f) => f.endsWith(".spec.js"));
      for (const file of files) {
        const filePath = path.join(testsDir, file);
        if (!fs.statSync(filePath).isFile()) continue;
        const contents = fs.readFileSync(filePath, "utf8");
        const titleRegex = /test\s*\(\s*['"`]([^'"`]+)['"`]/g;
        let match;
        while ((match = titleRegex.exec(contents))) {
          if (match[1] === testTitle) {
            safeTest = file;
            break;
          }
        }
        if (safeTest) break;
      }
    }
    if (!safeTest) return sendJson(res, 400, { ok: false, error: "Invalid test file." });

    const testPath = path.join(testsDir, safeTest);
    if (!testPath.startsWith(testsDir)) return sendJson(res, 403, { ok: false, error: "Forbidden." });
    if (!fs.existsSync(testPath)) return sendJson(res, 404, { ok: false, error: "Test file not found." });

    const currentTest = fs.readFileSync(testPath, "utf8");
    const testResultsDir = path.join(projectRoot, "test-results");
    const errorContexts = Array.isArray(errorContextPaths)
      ? errorContextPaths
          .map((p) => safeRelativePath(p))
          .filter(Boolean)
          .map((p) => path.join(projectRoot, p))
          .filter((p) => p.startsWith(testResultsDir) && fs.existsSync(p))
          .map((p) => fs.readFileSync(p, "utf8"))
      : [];

    let storyContext = "";
    try {
      const rawTitle = String(testTitle || "");
      const slug = rawTitle
        .split(" - ")[0]
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      const storyPath = path.join(projectRoot, "stories", `${slug}.md`);
      if (slug && fs.existsSync(storyPath)) {
        storyContext = fs.readFileSync(storyPath, "utf8");
      }
    } catch {
      storyContext = "";
    }

    const prompt = `
You are a senior QA engineer specializing in Playwright.
You will receive a failing test and logs. Return the FULL corrected test file contents only.
Do not include markdown fences or commentary.

Test title: ${testTitle}
Test file: ${safeTest}

Current test file:
${currentTest}

Run stdout:
${stdout}

Run stderr:
${stderr}

Error context:
${errorContexts.join("\n\n")}

Related story (if any):
${storyContext}

Requirements:
- Preserve the file structure and imports if possible.
- Fix the test based on the real behavior of https://the-internet.herokuapp.com when applicable.
- Return ONLY the corrected file contents.
`.trim();

    try {
      const response = await aiClient.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          { role: "system", content: "You fix Playwright tests. Return full file contents only." },
          { role: "user", content: prompt },
        ],
      });
      const fixedContent = (response.choices?.[0]?.message?.content || "").trim();
      if (!fixedContent) return sendJson(res, 500, { ok: false, error: "AI returned empty response." });

      const summaryPrompt = `
Summarize the fix in 1-2 sentences, focusing on what changed and why.

Original test:
${currentTest.slice(0, 4000)}

Updated test:
${fixedContent.slice(0, 4000)}

Error context:
${errorContexts.join("\n\n").slice(0, 2000)}
`.trim();
      let summary = "";
      try {
        const summaryRes = await aiClient.chat.completions.create({
          model: "gpt-4.1-mini",
          messages: [
            { role: "system", content: "Summarize test fixes concisely." },
            { role: "user", content: summaryPrompt },
          ],
        });
        summary = (summaryRes.choices?.[0]?.message?.content || "").trim();
      } catch {
        summary = "";
      }

      const backupDir = path.join(testsDir, ".ai-backups");
      fs.mkdirSync(backupDir, { recursive: true });
      const backupPath = path.join(backupDir, `${safeTest}.${Date.now()}.bak`);
      fs.writeFileSync(backupPath, currentTest, "utf8");
      fs.writeFileSync(testPath, fixedContent + "\n", "utf8");

      return sendJson(res, 200, {
        ok: true,
        updatedFile: safeTest,
        preview: fixedContent.slice(0, 2000),
        summary,
      });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: "AI fix failed." });
    }
  }

    // --- Static UI ---
    return serveStatic(req, res);
  });

  return server;
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return pathToFileURL(process.argv[1]).href === import.meta.url;
}

if (isMainModule()) {
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`✅ UI running at http://localhost:${PORT}`);
  });
}

export { createServer, validateStoryText, safeFileName, safeStoryFile, safeTestFile };

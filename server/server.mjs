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

    // Only serve from /ui
    const filePath = path.join(uiDir, pathname.replace(/^\//, ""));
    if (!filePath.startsWith(uiDir)) return send(res, 403, "Forbidden");

    if (!fs.existsSync(filePath)) return send(res, 404, "Not found");

    const ext = path.extname(filePath).toLowerCase();
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".png": "image/png",
      ".svg": "image/svg+xml",
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
      .filter((f) => f !== ".gitkeep" && f !== ".DS_Store")
      .sort();
    return sendJson(res, 200, { files });
  }

  if (url.pathname === "/api/tests" && req.method === "DELETE") {
    const files = fs
      .readdirSync(testsDir)
      .filter((f) => f !== ".gitkeep" && f !== ".DS_Store");

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

    const base = safeFileName(filename || "story");
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
    return runCommand(res, "npm run ai:analyze");
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

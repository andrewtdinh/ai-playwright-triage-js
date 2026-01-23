async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

export function validateStory(content) {
  return requestJson("/api/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

export function saveStory({ filename, content }) {
  return requestJson("/api/stories", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filename, content }),
  });
}

export function getStories() {
  return requestJson("/api/stories");
}

export function deleteAllStories() {
  return requestJson("/api/stories", { method: "DELETE" });
}

export function getStory(name) {
  return requestJson(`/api/story?name=${encodeURIComponent(name)}`);
}

export function deleteStory(name) {
  return requestJson(`/api/story?name=${encodeURIComponent(name)}`, { method: "DELETE" });
}

export function getTests() {
  return requestJson("/api/tests");
}

export function deleteAllTests() {
  return requestJson("/api/tests", { method: "DELETE" });
}

export function getTest(name) {
  return requestJson(`/api/test?name=${encodeURIComponent(name)}`);
}

export function saveTest(name, content) {
  return requestJson(`/api/test?name=${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

export function deleteTest(name) {
  return requestJson(`/api/test?name=${encodeURIComponent(name)}`, { method: "DELETE" });
}

export function runGenerateAll() {
  return requestJson("/api/run/ai-gen", { method: "POST" });
}

export function runGenerateStory(storyFile) {
  return requestJson(`/api/run/ai-gen?story=${encodeURIComponent(storyFile)}`, { method: "POST" });
}

export function runTestsAll() {
  return requestJson("/api/run/tests", { method: "POST" });
}

export function runTestFile(testFile) {
  return requestJson(`/api/run/tests?test=${encodeURIComponent(testFile)}`, { method: "POST" });
}

export function runAnalyze() {
  return requestJson("/api/run/report", { method: "POST" });
}

export function fixTestWithAi(payload) {
  return requestJson("/api/ai/fix-test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
}

export function runPipeline() {
  return requestJson("/api/run/pipeline", { method: "POST" });
}

export function generateStoryFromAi(payload) {
  return requestJson("/api/ai/story", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

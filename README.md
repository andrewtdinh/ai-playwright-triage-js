# 🚀 AI Playwright Test Lab

An end-to-end **AI-powered test automation pipeline** that:

✔️ **Generates Playwright tests** from plain-English user stories

✔️ **Runs your Playwright suite**

✔️ **Analyzes failed tests using AI**, producing explanations, root causes, fix suggestions, and flakiness tips

✔️ **Builds a beautifully styled HTML dashboard** of all AI results

✔️ **One-command workflow** using `npm run ai:flow`

---

## 📸 Demo Overview

This workflow turns simple input like:

**`stories/login.md`**

```
As a user, I want to log in with valid credentials so I can access my dashboard.

Acceptance:
- Navigate to login page
- Enter valid email/password
- Click login
- Expect dashboard to load
```

Into:

* A generated Playwright test
* A full run
* AI failure analysis
* A glowing, animated HTML dashboard like this:

**`ai-report.html`** (auto-opens):

* Plain English explanation
* Root cause analysis
* Suggested test fixes
* Flakiness mitigation
* Styled cards, badges, gradients, animations

---

## 🔧 Tech Stack

* **Node.js + ES Modules**
* **Playwright** (`@playwright/test`)
* **OpenAI API (GPT-4.1)**
* **Custom HTML reporting with external CSS**
* **Dark-mode dashboard UI**

---

## 📂 Project Structure

```
ai_project/
│
├── stories/
│   └── login.md               # Your natural language test cases
│
├── tests/
│   └── login.spec.js          # Auto-generated Playwright test
│
├── analyze/
│   ├── analyzeFailures.js      # AI engine (JSON + HTML dashboard)
│   └── ...                    # (additional helper files optional)
│
├── ai-analysis.json            # AI output (JSON)
├── ai-report.html              # Human-friendly HTML dashboard
├── ai-report.css               # Dashboard styling
│
├── generateTest.js             # Converts stories → Playwright tests
├── playwright.config.mjs       # Config + JSON reporter
├── package.json                # NPM scripts for full automation
└── README.md                   # (this file)
```

---

## ⚙️ Installation

```bash
git clone https://github.com/jtur671/playwright-ai-triage.git
cd playwright-ai-triage
npm install
npx playwright install
export OPENAI_API_KEY="your-key"
```

---

## 🧠 One-Command Workflow

Run this to:

1. Generate the test from your story
2. Run all Playwright tests
3. Analyze failures using AI
4. Build & open the HTML dashboard

```bash
npm run ai:flow
```

---

## 👉 Individual Commands (Optional)
## 🧭 UI Dashboard (Local)

Run the UI:

```bash
npm run ui
```

Open `http://localhost:5173`.

### What you can do in the UI

**Run Bar**
- Run full pipeline or individual steps (Generate / Run Tests / Analyze)
- Live status chip: Idle / Running / Failed / Passed

**Editor**
- Single editor for stories and tests (toggle mode)
- Story validation required before save
- Upload up to 5 stories at a time
- AI Story Assistant (wizard) builds a story from requirements + optional selectors/steps + expected outcome

**Saved Stories**
- Refresh, delete all, edit
- Per‑story Generate button (creates tests just for that story)

**Generated Tests**
- Refresh, delete all, edit
- Per‑test Run button (runs only that test)

**Run Console**
- Stepper: Validate → Save → Generate → Run → Analyze → Report
- Live logs, inline errors, copy stdout/stderr
- “Open report” CTA when available

**Safety / UX**
- Custom confirm modal for deletes
- Buttons disabled during runs
 

### Generate tests from your stories

```bash
npm run ai:gen
```

Creates Playwright test files under `tests/`.

---

### Run the Playwright test suite

```bash
npm run ai:test
```

Saves `playwright-report.json`.

---

### Analyze failures using AI (JSON only)

```bash
npm run ai:analyze
```

Saves structured output in `ai-analysis.json`.

---

### Build + open the HTML dashboard

```bash
npm run ai:report
```

Auto-opens `ai-report.html` in your browser.

---

## 🤖 How AI Analysis Works

After Playwright executes the tests, all failure metadata is passed to GPT-4.1:

* Error message
* Stack trace
* Test title + project name
* stdout/stderr logs

AI returns structured HTML with:

### **1. Plain-English Explanation**

Why did this fail?

### **2. Probable Root Causes**

2–3 likely technical problems.

### **3. Suggested Test Fixes**

Specific Playwright code improvements.

### **4. Flakiness Mitigation**

Ways to reduce intermittent failures.

---

## 🎨 HTML Dashboard Themes & Features

* Dark-mode
* Animated gradient highlight bars
* Glowing hover transitions
* Status badges
* Collapsible AI analysis sections
* External CSS for easy editing
* Radial gradients & neon accent hues

---

## 🧪 Example AI Output (HTML)

```
<h3>Plain-English Explanation</h3>
<p>The success message never appeared...</p>

<h3>Probable Root Causes</h3>
<ul>
  <li>Selector mismatch</li>
  <li>API response delay</li>
  <li>Redirect timing issue</li>
</ul>

<h3>Suggested Test Fixes</h3>
<ul>
  <li>Use page.waitForURL('/dashboard')</li>
  <li>Wait for stable locator instead of getByText</li>
</ul>

<h3>Flakiness Mitigation</h3>
<p>Increase timeout or add a network idle wait.</p>
```

---

## 📦 Environment Variables

Set your OpenAI key using one of these methods:

**Option 1: Export (recommended for quick setup)**
```bash
export OPENAI_API_KEY="your-key"
```

**Option 2: .env file (recommended for persistence)**
```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your key
OPENAI_API_KEY=your-key
```

Both methods work! If you use `export`, it takes precedence over the `.env` file.

---

## 🧭 Roadmap & Enhancements

* Multi-story batch generation
* Test-to-story reverse engineering
* Hit-map UI of frequent failures
* CI pipeline integration
* Slack/Teams bot that posts AI insights
* Flaky test scoring over time

---

## 💬 Contributing

Pull requests welcome!

Open issues for bugs, ideas, or UX/UI enhancements.

---

## ⭐ Star the repo if you like it!

This project helps show how AI can supercharge real-world QA automation.

Let's build the future of testing. 🔥


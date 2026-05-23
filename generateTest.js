// generateTest.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { claudePrompt } from './utils/claudeClient.js';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateForStory(storyPath) {
  const story = fs.readFileSync(storyPath, 'utf8');
  const storyName = path.basename(storyPath, '.md'); // e.g. login, checkboxes
  const outPath = path.join(__dirname, 'tests', `${storyName}.spec.js`);

  const prompt = `Generate a SINGLE Playwright test in JavaScript based on this user story:

${story}

Requirements:
- Use: import { test, expect } from '@playwright/test';
- Use the Base URL from the story. If present, prepend it to any relative paths like /login.
- Use page.goto, page.locator, page.fill, page.click, expect(...)
- Use data from the Acceptance criteria.
- Output ONLY the JavaScript code. No explanations, no markdown, no comments.
- Start directly with "import { test, expect }".
  `;

  let code = await claudePrompt(
    'You are a Playwright test code generator. Output ONLY the complete JavaScript code for a Playwright test. Do not include any explanations, comments about the code, or markdown formatting. Start directly with "import { test, expect }".',
    prompt
  );

  // Safety: strip stray markdown fences if they sneak in
  code = code
    .replace(/```[a-zA-Z]*/g, '')
    .replace(/```/g, '')
    .trim();

  if (!fs.existsSync(path.join(__dirname, 'tests'))) {
    fs.mkdirSync(path.join(__dirname, 'tests'), { recursive: true });
  }

  fs.writeFileSync(outPath, code);
  console.log(`✅ Generated test for ${storyName}: ${outPath}`);
}

function parseStoryArg() {
  const args = process.argv.slice(2);
  const idx = args.findIndex(arg => arg === '--story');
  if (idx === -1) return null;
  const name = args[idx + 1];
  if (!name) return null;
  return name;
}

async function main() {
  const storiesDir = path.join(__dirname, 'stories');
  const storyArg = parseStoryArg();
  const files = fs.readdirSync(storiesDir).filter(f => f.endsWith('.md'));

  if (files.length === 0) {
    console.error('No .md story files found in ./stories');
    process.exit(1);
  }

  if (storyArg) {
    if (!files.includes(storyArg)) {
      console.error(`Story not found: ${storyArg}`);
      process.exit(1);
    }
    const fullPath = path.join(storiesDir, storyArg);
    await generateForStory(fullPath);
    return;
  }

  for (const file of files) {
    const fullPath = path.join(storiesDir, file);
    await generateForStory(fullPath);
  }
}

main().catch(err => {
  console.error('Error generating tests:', err);
});

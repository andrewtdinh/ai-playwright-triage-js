import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const execAsync = promisify(exec);

export async function claudePrompt(systemMsg, userMsg, { model } = {}) {
  const combined = systemMsg
    ? `${systemMsg}\n\n${userMsg}`
    : userMsg;

  // For very long prompts (test files, stack traces), use temp file to avoid shell limits
  if (combined.length > 4000) {
    return await claudePromptWithFile(combined, model);
  }

  // Short prompts: inline with proper escaping
  const escaped = combined
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');

  const modelFlag = model ? `--model "${model}"` : '';
  const { stdout } = await execAsync(`claude -p "${escaped}" ${modelFlag}`, {
    maxBuffer: 10 * 1024 * 1024,
  });

  return stdout.trim();
}

async function claudePromptWithFile(content, model) {
  const filename = `prompt_${crypto.randomBytes(4).toString('hex')}.txt`;
  const tempPath = path.join(tmpdir(), filename);

  try {
    await writeFile(tempPath, content, 'utf8');
    const modelFlag = model ? `--model "${model}"` : '';
    const { stdout } = await execAsync(`claude -p "$(cat '${tempPath}')" ${modelFlag}`, {
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout.trim();
  } finally {
    try {
      await unlink(tempPath);
    } catch {
      // ignore cleanup errors
    }
  }
}

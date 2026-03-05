#!/usr/bin/env node

require('dotenv/config');
const { execSync } = require('child_process');
const readline = require('readline');
const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `あなたはgit commitメッセージを生成する専門家です。
与えられたgit diffを分析し、Conventional Commits形式のコミットメッセージを1つだけ生成してください。

ルール:
- 形式: <type>(<scope>): <description>
- type: feat, fix, refactor, docs, style, test, chore, perf のいずれか
- scope: 変更の対象（省略可）
- description: 英語、小文字始まり、末尾にピリオドなし、命令形で書く
- 1行目は72文字以内
- 必要に応じて空行の後にbody（変更の詳細）を追加
- bodyは箇条書きで、各項目は "- " で始める
- コミットメッセージのみを出力し、それ以外の説明は一切含めない`;

const MAX_DIFF_LENGTH = 100000;

function checkGit() {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'pipe' });
  } catch {
    console.error('\x1b[31mError: Not a git repository or git is not installed.\x1b[0m');
    process.exit(1);
  }
}

function getStagedDiff() {
  try {
    const diff = execSync('git diff --staged', { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    return diff;
  } catch (e) {
    console.error('\x1b[31mError: Failed to get staged diff.\x1b[0m');
    console.error(e.message);
    process.exit(1);
  }
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function generateCommitMessage(client, diff) {
  let userMessage = diff;
  if (diff.length > MAX_DIFF_LENGTH) {
    console.warn(`\x1b[33mWarning: Diff is very large (${diff.length} chars). Truncating to ${MAX_DIFF_LENGTH} chars.\x1b[0m`);
    userMessage = diff.slice(0, MAX_DIFF_LENGTH);
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  return response.content[0].text.trim();
}

async function main() {
  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('\x1b[31mError: ANTHROPIC_API_KEY が設定されていません。\x1b[0m');
    console.error('.envファイルにANTHROPIC_API_KEYを設定するか、export ANTHROPIC_API_KEY=sk-ant-xxxxx を実行してください');
    process.exit(1);
  }

  // Check git
  checkGit();

  // Get staged diff
  const diff = getStagedDiff();
  if (!diff.trim()) {
    console.error('\x1b[33mNo staged changes found. Use "git add" to stage your changes first.\x1b[0m');
    process.exit(1);
  }

  const client = new Anthropic();

  let message;

  while (true) {
    // Generate commit message
    console.log('\x1b[90mGenerating commit message...\x1b[0m');
    try {
      message = await generateCommitMessage(client, diff);
    } catch (e) {
      console.error(`\x1b[31mAPI Error: ${e.message}\x1b[0m`);
      const retry = await ask('Retry? (Y/n): ');
      if (retry.toLowerCase() === 'n') {
        process.exit(1);
      }
      continue;
    }

    // Display message
    console.log('\n\x1b[36m' + message + '\x1b[0m\n');

    // Ask user
    const answer = await ask('Commit with this message? (Y/n/e[dit/regenerate]): ');
    const choice = answer.trim().toLowerCase();

    if (choice === 'n') {
      console.log('Aborted.');
      process.exit(0);
    } else if (choice === 'e') {
      // Regenerate
      continue;
    } else {
      // Y or Enter - commit
      break;
    }
  }

  // Execute commit
  try {
    const escaped = message.replace(/"/g, '\\"');
    const result = execSync(`git commit -m "${escaped}"`, { encoding: 'utf-8' });
    console.log(result);

    // Show commit hash
    const hash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    console.log(`\x1b[32mCommitted: ${hash}\x1b[0m`);
  } catch (e) {
    console.error(`\x1b[31mCommit failed: ${e.message}\x1b[0m`);
    process.exit(1);
  }
}

main();

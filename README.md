# ai-commit

AI-powered commit message generator using Claude API. Analyzes your staged changes and generates Conventional Commits format messages.

## Setup

```bash
cd ai-commit && npm install
export ANTHROPIC_API_KEY=sk-ant-xxxxx
```

## Usage

```bash
# Stage your changes
git add .

# Generate commit message
node ai-commit.js
```

### Global install (optional)

```bash
npm link
ai-commit
```

## How it works

1. Reads `git diff --staged` to get your staged changes
2. Sends the diff to Claude API (claude-sonnet-4-20250514)
3. Generates a Conventional Commits format message
4. Shows the message and asks for confirmation:
   - **Y** (or Enter) - commit with the generated message
   - **n** - abort
   - **e** - regenerate a new message

## Requirements

- Node.js
- git
- `ANTHROPIC_API_KEY` environment variable

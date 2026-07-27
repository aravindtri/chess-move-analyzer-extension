# Chess Move Analyzer - Chrome Extension

AI-powered chess analysis directly in your browser. Paste moves or upload a score sheet photo, get grandmaster-level analysis with an interactive chess board and AI chat.

## Features

- ♟ **Interactive chess board** — step through moves with highlighting
- 📷 **Score sheet scanning** — upload a photo, AI transcribes and analyzes
- 🤖 **Multi-LLM support** — Gemini, OpenAI Compatible (DeepSeek), Azure OpenAI
- 💬 **AI Chat** — ask questions about your game in a two-way conversation
- 🎨 **Dark theme** — clean, modern UI

## Install

1. Clone this repo or download as ZIP
2. Go to `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select this folder

## Configure

Click ⚙ in the extension popup:

| Field | Description |
|-------|-------------|
| API Key | Your LLM provider's API key |
| Provider | Gemini, OpenAI Compatible, or Azure OpenAI |
| Base URL | For OpenAI Compatible/Azure: e.g. `https://api.deepseek.com` |
| Model | Model name: `gemini-2.5-flash`, `deepseek-v4-pro`, etc. |
| API Version | Azure only: e.g. `2024-02-15-preview` |

## Usage

1. Click the extension icon in Chrome toolbar
2. Paste chess moves (e.g. `1. e4 e5 2. Nf3 Nc6...`) or upload a score sheet photo
3. Click **Analyze Moves**
4. Step through the game on the interactive board
5. Ask the AI coach questions about your game

## Providers

| Provider | Base URL | Auth |
|----------|----------|------|
| **Gemini** | (built-in) | Query param `?key=` |
**DeepSeek setup:**
- Provider: **OpenAI Compatible**
- Base URL: `https://api.deepseek.com`
- Model: `deepseek-chat`
- API Key: Your DeepSeek API key from [platform.deepseek.com](https://platform.deepseek.com)
| **Azure OpenAI** | `https://{resource}.openai.azure.com` | `api-key` header |
| **OpenAI** | `https://api.openai.com` | `Bearer` header |

# AVI — Futuristic Mobile Voice Assistant

A mobile-first web app with:
- Hindi/English browser speech recognition and spoken replies
- Optional “Hey AVI” wake-word mode (page must remain open)
- AI answers through a server-side OpenAI API call
- Website shortcuts and basic voice commands for YouTube, Google, Gmail, Maps, and WhatsApp
- Conversation history stored in the current browser's `localStorage`, with memory on/off and erase controls
- Basic API rate limiting and input-size limits

## Run locally

Requirements: Node.js 18+.

1. Unzip this project.
2. In this folder, install dependencies:
   ```bash
   npm install
   ```
3. Set your API key in the server environment. Never place it in `public/index.html`.
   macOS/Linux:
   ```bash
   export OPENAI_API_KEY="your-api-key"
   npm start
   ```
   Windows PowerShell:
   ```powershell
   $env:OPENAI_API_KEY="your-api-key"
   npm start
   ```
4. Open `http://localhost:3000` in your browser.

Optional: set `OPENAI_MODEL` to a model available to your API account. The default is `gpt-4.1-mini`.

## Deploy for mobile use

Deploy the project to a Node.js host that supports environment variables and HTTPS. Set `OPENAI_API_KEY` in the host's secret/environment settings. Open the deployed HTTPS URL on your phone. You can use “Add to Home Screen” in a compatible browser.

Do not publish your API key, commit it to source control, or put it in client-side JavaScript. Add authentication and stronger per-user quotas before exposing a public service.

## Browser / platform limits

- Speech recognition support varies. Chrome on Android is generally the best starting point; Firefox and some embedded browsers may not support `SpeechRecognition`.
- Microphone permission is required. Most browsers require HTTPS for microphone access, except localhost.
- “Hey AVI” is not an operating-system-level hotword. It uses continuous browser speech recognition while the page is open, and can stop when the phone locks, the browser is backgrounded, the OS suspends the tab, or the browser ends the recognition session. It may use more battery and may send speech to the browser's speech service.
- Speech recognition can mishear Hindi/English code-switching. Change the voice language selector for the best result.
- Opening websites works from a user interaction or supported spoken command. Mobile OSes may block automatic app launching; deep links and WhatsApp/Gmail behavior depend on installed apps and browser settings.
- Conversation memory is local to this browser/device. It does not sync between devices and may be removed if browser data is cleared. The most recent chat history is sent to the AI server for context when memory is enabled.
- AI responses require an OpenAI API key, API account access, and billing. This project makes requests on the server; the key is not exposed to the browser. A production deployment should add authentication, privacy notice/consent, abuse monitoring, and user-specific storage.
- This is a web app, not a native Android service. Reliable always-on wake word, lock-screen controls, and native app integrations require a native Android app and platform permissions.

## Security notes

This starter has basic API rate limiting and request validation. Before public deployment, consider adding login, per-user rate limits, cost limits, CSRF/origin protections appropriate to your hosting setup, monitoring, and a privacy policy. Never use browser local storage for highly sensitive information.

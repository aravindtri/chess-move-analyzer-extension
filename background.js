// Background service worker for Chess Move Analyzer
// Handles API calls to avoid CORS issues in popup

importScripts('lib/llm.js');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyze') {
    handleAnalyze(request.data).then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true; // keep channel open for async
  }
  if (request.action === 'chat') {
    handleChat(request.data).then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  }
});

async function handleAnalyze(data) {
  try {
    return await analyzeMoves(data.movesText, data.skillLevel, data.imageBase64);
  } catch (e) {
    return { error: e.message };
  }
}

async function handleChat(data) {
  try {
    return await chatAboutMoves(data.movesText, data.analysis, data.question, data.history);
  } catch (e) {
    return { error: e.message };
  }
}

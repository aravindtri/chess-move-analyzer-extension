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
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out after 3min')), 180000));
    const result = await Promise.race([analyzeMoves(data.movesText, data.skillLevel, data.imageBase64), timeout]);
    return result;
  } catch (e) {
    console.error('Analyze error:', e);
    return { error: e.message };
  }
}

async function handleChat(data) {
  try {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Chat timed out after 2min')), 120000));
    const result = await Promise.race([chatAboutMoves(data.movesText, data.analysis, data.question, data.history), timeout]);
    return result;
  } catch (e) {
    console.error('Chat error:', e);
    return { error: e.message };
  }
}

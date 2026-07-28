// Fullscreen mode - hide panels immediately, then load saved analysis
(function() {
  // Run synchronously before popup.js DOMContentLoaded fires
  var inputPanel = document.getElementById('inputPanel');
  var settingsPanel = document.getElementById('settingsPanel');
  if (inputPanel) inputPanel.style.display = 'none';
  if (settingsPanel) settingsPanel.style.display = 'none';
})();

window.addEventListener('load', async () => {
  // Poll for data (popup might still be saving when we load)
  let data;
  for (let i = 0; i < 10; i++) {
    data = await chrome.storage.local.get(['lastAnalysis', 'lastChatHistory', 'lastPlies', 'lastPly']);
    if (data.lastAnalysis) break;
    await new Promise(r => setTimeout(r, 300));
  }

  if (!data || !data.lastAnalysis) {
    document.getElementById('loadingMsg').textContent = 'No analysis. Run analysis in popup first.';
    return;
  }

  analysisResult = data.lastAnalysis;
  chatHistory = data.lastChatHistory || [];
  plies = data.lastPlies || [];
  currentPly = data.lastPly || plies.length;

  showResults(analysisResult);
  document.getElementById('loadingMsg').classList.add('hidden');
  document.getElementById('chatSend').onclick = sendChat;
  document.getElementById('chatInput').onkeydown = e => { if (e.key === 'Enter') sendChat(); };
  document.getElementById('btnFirst').onclick = () => setPly(0);
  document.getElementById('btnPrev').onclick = () => setPly(currentPly - 1);
  document.getElementById('btnNext').onclick = () => setPly(currentPly + 1);
  document.getElementById('btnLast').onclick = () => setPly(plies.length);
  document.getElementById('btnFlip').onclick = () => { isFlipped = !isFlipped; renderBoard(); };
});
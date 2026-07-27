// Fullscreen mode - loads saved analysis from popup
document.addEventListener('DOMContentLoaded', async () => {
  loadSettings();

  const data = await chrome.storage.local.get('fullscreenData');
  if (!data.fullscreenData || !data.fullscreenData.analysis) {
    document.getElementById('loadingMsg').textContent = 'No analysis found. Run analysis in the popup first.';
    return;
  }

  const { analysis, chatHistory, plies: savedPlies, ply } = data.fullscreenData;
  analysisResult = analysis;
  chatHistory = chatHistory || [];
  plies = savedPlies || [];
  currentPly = ply || plies.length;

  showResults(analysis);
  document.getElementById('loadingMsg').classList.add('hidden');

  // Wire up controls
  document.getElementById('settingsBtn').addEventListener('click', toggleSettings);
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('provider').addEventListener('change', toggleProviderFields);
  document.getElementById('chatSend').addEventListener('click', sendChat);
  document.getElementById('chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
  document.getElementById('btnFirst').addEventListener('click', () => setPly(0));
  document.getElementById('btnPrev').addEventListener('click', () => setPly(currentPly - 1));
  document.getElementById('btnNext').addEventListener('click', () => setPly(currentPly + 1));
  document.getElementById('btnLast').addEventListener('click', () => setPly(plies.length));
  document.getElementById('btnFlip').addEventListener('click', () => { isFlipped = !isFlipped; renderBoard(); });
});

// Override renderChat to save state for refresh
const origRenderChat = renderChat;
renderChat = function() {
  origRenderChat();
  chrome.storage.local.set({ fullscreenData: { analysis: analysisResult, chatHistory, plies, ply: currentPly } }).catch(() => {});
};

// Fullscreen mode - loads saved analysis after popup.js init
window.addEventListener('load', async () => {
  document.getElementById('inputPanel')?.classList.add('hidden');
  document.getElementById('settingsPanel')?.classList.add('hidden');

  const data = await chrome.storage.local.get('fullscreenData');
  if (!data.fullscreenData?.analysis) {
    document.getElementById('loadingMsg').textContent = 'No analysis. Run analysis in popup first.';
    return;
  }

  var d = data.fullscreenData;
  analysisResult = d.analysis;
  chatHistory = d.chatHistory || [];
  plies = d.plies || [];
  currentPly = d.ply || plies.length;

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
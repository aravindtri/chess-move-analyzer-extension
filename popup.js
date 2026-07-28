// Chess Move Analyzer - Popup Script
let analysisResult = null;
let currentPly = 0;
let plies = [];
let isFlipped = false;
let chatHistory = [];

// Piece mapping (Unicode)
const PIECES = {
  W_K: '♔', W_Q: '♕', W_R: '♖', W_B: '♗', W_N: '♘', W_P: '♙',
  B_K: '♚', B_Q: '♛', B_R: '♜', B_B: '♝', B_N: '♞', B_P: '♟'
};

const INITIAL_BOARD = [
  ['B_R','B_N','B_B','B_Q','B_K','B_B','B_N','B_R'],
  ['B_P','B_P','B_P','B_P','B_P','B_P','B_P','B_P'],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  ['W_P','W_P','W_P','W_P','W_P','W_P','W_P','W_P'],
  ['W_R','W_N','W_B','W_Q','W_K','W_B','W_N','W_R']
];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  document.getElementById('settingsBtn').addEventListener('click', toggleSettings);
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('provider').addEventListener('change', toggleProviderFields);
  document.getElementById('visionProvider').addEventListener('change', toggleVisionFields);
  document.getElementById('uploadBtn').addEventListener('click', () => document.getElementById('imageUpload').click());
  document.getElementById('imageUpload').addEventListener('change', handleImageUpload);
  document.getElementById('analyzeBtn').addEventListener('click', analyzeMoves);
  document.getElementById('reanalyzeBtn').addEventListener('click', reanalyzeMoves);
  document.getElementById('chatSend').addEventListener('click', sendChat);
  document.getElementById('chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
  document.getElementById('openSettingsLink').addEventListener('click', e => { e.preventDefault(); showSettings(); });
  document.getElementById('btnFirst').addEventListener('click', () => setPly(0));
  document.getElementById('btnPrev').addEventListener('click', () => setPly(currentPly - 1));
  document.getElementById('btnNext').addEventListener('click', () => setPly(currentPly + 1));
  document.getElementById('btnLast').addEventListener('click', () => setPly(plies.length));
  document.getElementById('btnFlip').addEventListener('click', () => { isFlipped = !isFlipped; renderBoard(); });
});

// Settings
async function loadSettings() {
  const config = await getConfig();
  const apiKey = await getApiKey();
  document.getElementById('apiKey').value = apiKey;
  document.getElementById('provider').value = config.provider;
  document.getElementById('baseUrl').value = config.baseUrl || '';
  document.getElementById('visionModel').value = config.visionModel || '';
  document.getElementById('textModel').value = config.textModel || '';
  document.getElementById('apiVersion').value = config.apiVersion || '';
  document.getElementById('visionProvider').value = config.visionProvider || '';
  document.getElementById('visionApiKey').value = config.visionApiKey || '';
  toggleVisionFields();
  toggleProviderFields();
  checkApiWarning();
}

function checkApiWarning() {
  getApiKey().then(key => {
    document.getElementById('noApiWarning').classList.toggle('hidden', !!key);
  });
}

function toggleProviderFields() {
  const provider = document.getElementById('provider').value;
  const showOpenAi = provider === 'openai_compatible' || provider === 'azure_openai';
  const showAzure = provider === 'azure_openai';
  document.querySelector('.openai-field').classList.toggle('hidden', !showOpenAi);
  document.querySelector('.azure-field').classList.toggle('hidden', !showAzure);
}

function toggleVisionFields() {
  const visProv = document.getElementById('visionProvider').value;
  document.getElementById('visionApiKeyGroup').style.display = visProv ? 'block' : 'none';
}

function toggleSettings() {
  document.getElementById('settingsPanel').classList.toggle('hidden');
}

function showSettings() {
  document.getElementById('settingsPanel').classList.remove('hidden');
}

async function saveSettings() {
  try {
    await saveApiKey(document.getElementById('apiKey').value);
    await saveConfig({
      provider: document.getElementById('provider').value,
      baseUrl: document.getElementById('baseUrl').value,
      visionModel: document.getElementById('visionModel').value,
      textModel: document.getElementById('textModel').value,
      apiVersion: document.getElementById('apiVersion').value,
      visionProvider: document.getElementById('visionProvider').value,
      visionApiKey: document.getElementById('visionApiKey').value
    });
    document.getElementById('settingsPanel').classList.add('hidden');
    checkApiWarning();
  } catch (e) {
    alert('Failed to save: ' + e.message);
  }
}

// Fullscreen - inline onclick to beat popup closure
function openFullscreen() {
  if (!analysisResult) return;
  chrome.storage.local.set({
    lastAnalysis: analysisResult, lastChatHistory: chatHistory,
    lastPlies: plies, lastPly: currentPly
  });
  chrome.windows.create({
    url: chrome.runtime.getURL('fullscreen.html'),
    type: 'popup', width: 820, height: 900
  });
}

// Image upload
let imageBase64 = null;
function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    imageBase64 = reader.result.split(',')[1];
    document.getElementById('uploadBtn').textContent = '📷 Photo Ready';
  };
  reader.readAsDataURL(file);
}

// Analyze moves
async function analyzeMoves() {
  const movesText = document.getElementById('movesInput').value.trim();
  if (!movesText && !imageBase64) return;

  const status = document.getElementById('analyzeStatus');
  status.classList.remove('hidden');
  status.textContent = 'Analyzing...';

  try {
    const skillLevel = document.getElementById('skillLevel').value;
    const result = await chrome.runtime.sendMessage({
      action: 'analyze',
      data: { movesText: movesText || 'Analyze the score sheet in the image', skillLevel, imageBase64 }
    });

    if (result.error) throw new Error(result.error);

    analysisResult = result;
    parsePlies(result.moves);
    currentPly = plies.length;
    chatHistory = [];
    imageBase64 = null;
    document.getElementById('uploadBtn').textContent = '📷 Upload Photo';
    document.getElementById('imageUpload').value = '';

    // Save state for fullscreen mode
    chrome.storage.local.set({
      lastAnalysis: result,
      lastChatHistory: [],
      lastPlies: plies,
      lastPly: currentPly
    });

    showResults(result);
    status.classList.add('hidden');

    // Show edit button for image uploads
    if (imageBase64) {
      document.getElementById('editMovesSection').classList.remove('hidden');
      const movesDisplay = (result.moves || []).map(m => `${m.moveNumber}. ${m.whiteMove} ${m.blackMove}`).join(' ');
      document.getElementById('editMovesInput').value = movesDisplay;
    }
  } catch (e) {
    status.textContent = 'Error: ' + e.message;
    status.style.color = '#e74c3c';
  }
}

async function reanalyzeMoves() {
  const movesText = document.getElementById('editMovesInput').value.trim();
  if (!movesText) return;
  const status = document.getElementById('analyzeStatus');
  status.classList.remove('hidden');
  status.textContent = 'Re-analyzing...';
  status.style.color = '#d4a574';
  try {
    const result = await chrome.runtime.sendMessage({
      action: 'analyze',
      data: { movesText, skillLevel: document.getElementById('skillLevel').value, imageBase64: null }
    });
    if (result.error) throw new Error(result.error);
    analysisResult = result;
    parsePlies(result.moves);
    currentPly = plies.length;
    chatHistory = [];
    showResults(result);
    status.classList.add('hidden');
  } catch (e) {
    status.textContent = 'Error: ' + e.message;
    status.style.color = '#e74c3c';
  }
}

function parsePlies(moves) {
  plies = [];
  let idx = 0;
  (moves || []).forEach(m => {
    if (m.whiteMove) plies.push({ idx: idx++, num: m.moveNumber, white: true, san: m.whiteMove, miss: m.isTacticalMiss });
    if (m.blackMove) plies.push({ idx: idx++, num: m.moveNumber, white: false, san: m.blackMove, miss: m.isTacticalMiss });
  });
}

function showResults(result) {
  document.getElementById('inputPanel').classList.add('hidden');
  document.getElementById('resultsPanel').classList.remove('hidden');
  document.getElementById('openingName').textContent = result.opening || 'Custom Game';
  document.getElementById('evaluation').textContent = result.evaluation || '+0.0';

  // Tactical misses
  const missesDiv = document.getElementById('tacticalMisses');
  if (result.tacticalMisses && result.tacticalMisses.length) {
    missesDiv.classList.remove('hidden');
    missesDiv.innerHTML = '<h4>⚠ Tactical Misses</h4>' +
      result.tacticalMisses.map(m => `<div class="item">${m.moveNumber}: ${m.explanation}</div>`).join('');
  } else missesDiv.classList.add('hidden');

  // Positional insights
  const posDiv = document.getElementById('positionalInsights');
  if (result.positionalInsights && result.positionalInsights.length) {
    posDiv.classList.remove('hidden');
    posDiv.innerHTML = '<h4>🧠 Positional Insights</h4>' +
      result.positionalInsights.map(i => `<div class="item">${i}</div>`).join('');
  } else posDiv.classList.add('hidden');

  // Endgame
  const endDiv = document.getElementById('endgameStrategy');
  if (result.endgameStrategy && result.endgameStrategy.length) {
    endDiv.classList.remove('hidden');
    endDiv.innerHTML = '<h4>🎯 Endgame Strategy</h4>' +
      result.endgameStrategy.map(s => `<div class="item">${s}</div>`).join('');
  } else endDiv.classList.add('hidden');

  // Summary
  document.getElementById('summary').innerHTML = `<h4>📋 Summary</h4><div>${result.summary || ''}</div>`;

  renderBoard();
  renderMoveChips();
  renderChat();
}

// Board rendering
function renderBoard() {
  const board = computeBoardAtPly(currentPly);
  const lastFrom = board.lastFrom;
  const lastTo = board.lastTo;
  const grid = board.grid;

  const container = document.getElementById('chessboard');
  container.innerHTML = '';

  for (let displayRow = 0; displayRow < 8; displayRow++) {
    const row = isFlipped ? 7 - displayRow : displayRow;
    for (let displayCol = 0; displayCol < 8; displayCol++) {
      const col = isFlipped ? 7 - displayCol : displayCol;
      const isLight = (row + col) % 2 === 0;
      const isFrom = lastFrom && lastFrom[0] === row && lastFrom[1] === col;
      const isTo = lastTo && lastTo[0] === row && lastTo[1] === col;

      const sq = document.createElement('div');
      sq.className = 'square ' + (isLight ? 'light' : 'dark');
      if (isFrom) sq.classList.add('highlight-from');
      if (isTo) sq.classList.add('highlight-to');

      const piece = grid[row][col];
      if (piece) {
        const span = document.createElement('span');
        span.className = 'piece ' + (piece.startsWith('W_') ? 'w' : 'b');
        span.textContent = PIECES[piece] || '';
        sq.appendChild(span);
      }

      if (displayCol === 0) {
        const coord = document.createElement('span');
        coord.className = 'coord rank';
        coord.textContent = 8 - row;
        sq.appendChild(coord);
      }
      if (displayRow === 7) {
        const coord = document.createElement('span');
        coord.className = 'coord file';
        coord.textContent = 'abcdefgh'[col];
        sq.appendChild(coord);
      }

      container.appendChild(sq);
    }
  }

  // Update controls
  document.getElementById('moveLabel').textContent = currentPly === 0 ? 'Start' : `Move ${currentPly}/${plies.length}`;
  document.getElementById('btnFirst').disabled = currentPly === 0;
  document.getElementById('btnPrev').disabled = currentPly === 0;
  document.getElementById('btnNext').disabled = currentPly >= plies.length;
  document.getElementById('btnLast').disabled = currentPly >= plies.length;
}

function setPly(n) {
  currentPly = Math.max(0, Math.min(plies.length, n));
  renderBoard();
  renderMoveChips();
}

function renderMoveChips() {
  const container = document.getElementById('movesChips');
  container.innerHTML = plies.map((p, i) => {
    const label = `${p.num}${p.white ? '.' : '...'}${p.san}`;
    const active = i + 1 === currentPly ? ' active' : '';
    const miss = p.miss ? ' miss' : '';
    return `<span class="move-chip${active}${miss}" onclick="setPly(${i + 1})">${label}</span>`;
  }).join('');
}

// Simple SAN-based board computation
function computeBoardAtPly(targetPly) {
  const grid = INITIAL_BOARD.map(r => [...r]);
  let lastFrom = null, lastTo = null;

  const sanList = plies.map(p => p.san);
  const movesToApply = sanList.slice(0, targetPly);

  movesToApply.forEach((rawSan, idx) => {
    const isWhite = idx % 2 === 0;
    const colorPrefix = isWhite ? 'W_' : 'B_';
    let san = rawSan.replace(/[+#!?]/g, '').trim();
    if (!san) return;

    // Castling
    if (san === 'O-O' || san === '0-0') {
      const r = isWhite ? 7 : 0;
      grid[r][4] = null; grid[r][6] = colorPrefix + 'K';
      grid[r][7] = null; grid[r][5] = colorPrefix + 'R';
      lastFrom = [r, 4]; lastTo = [r, 6]; return;
    }
    if (san === 'O-O-O' || san === '0-0-0') {
      const r = isWhite ? 7 : 0;
      grid[r][4] = null; grid[r][2] = colorPrefix + 'K';
      grid[r][0] = null; grid[r][3] = colorPrefix + 'R';
      lastFrom = [r, 4]; lastTo = [r, 2]; return;
    }

    // Promotion
    if (san.includes('=')) san = san.split('=')[0];

    // Remove capture and dash
    san = san.replace(/[x-]/g, '');

    const pieceType = 'NBRQK'.includes(san[0]) ? san[0] : 'P';
    const rest = pieceType === 'P' ? san : san.slice(1);
    if (rest.length < 2) return;

    const target = rest.slice(-2);
    const toCol = target.charCodeAt(0) - 97;
    const toRow = 8 - parseInt(target[1]);
    if (toCol < 0 || toCol > 7 || toRow < 0 || toRow > 7) return;

    const disambig = rest.slice(0, -2);
    const fileFilter = disambig && /[a-h]/.test(disambig[0]) ? disambig.charCodeAt(0) - 97 : null;
    const rankFilter = disambig && /[1-8]/.test(disambig.slice(-1)) ? 8 - parseInt(disambig.slice(-1)) : null;

    let foundFrom = null;
    for (let r = 0; r < 8 && !foundFrom; r++) {
      for (let c = 0; c < 8 && !foundFrom; c++) {
        if (grid[r][c] === colorPrefix + pieceType) {
          if (fileFilter !== null && c !== fileFilter) continue;
          if (rankFilter !== null && r !== rankFilter) continue;
          if (canReach(grid, pieceType, isWhite, r, c, toRow, toCol)) {
            foundFrom = [r, c];
          }
        }
      }
    }

    if (foundFrom) {
      const [fr, fc] = foundFrom;
      if (pieceType === 'P' && fc !== toCol && !grid[toRow][toCol]) {
        grid[fr][toCol] = null;
      }
      grid[fr][fc] = null;
      grid[toRow][toCol] = colorPrefix + pieceType;
      lastFrom = foundFrom;
      lastTo = [toRow, toCol];
    }
  });

  return { grid, lastFrom, lastTo };
}

function canReach(grid, pieceType, isWhite, fr, fc, tr, tc) {
  const dR = Math.abs(fr - tr), dC = Math.abs(fc - tc);
  switch (pieceType) {
    case 'P':
      if (fc === tc) {
        if (isWhite) return tr === fr - 1 || (fr === 6 && tr === 4 && !grid[5][fc]);
        return tr === fr + 1 || (fr === 1 && tr === 3 && !grid[2][fc]);
      }
      if (dC === 1) return isWhite ? tr === fr - 1 : tr === fr + 1;
      return false;
    case 'N': return (dR === 1 && dC === 2) || (dR === 2 && dC === 1);
    case 'K': return Math.max(dR, dC) === 1;
    case 'B': return dR === dC && dR > 0 && pathClear(grid, fr, fc, tr, tc);
    case 'R': return ((dR === 0 && dC > 0) || (dC === 0 && dR > 0)) && pathClear(grid, fr, fc, tr, tc);
    case 'Q': return (dR === dC || dR === 0 || dC === 0) && pathClear(grid, fr, fc, tr, tc);
  }
  return false;
}

function pathClear(grid, r1, c1, r2, c2) {
  const stepR = Math.sign(r2 - r1), stepC = Math.sign(c2 - c1);
  let cr = r1 + stepR, cc = c1 + stepC;
  while (cr !== r2 || cc !== c2) {
    if (grid[cr][cc]) return false;
    cr += stepR; cc += stepC;
  }
  return true;
}

// Chat
function renderChat() {
  const container = document.getElementById('chatMessages');
  container.innerHTML = chatHistory.map(msg =>
    `<div class="chat-msg ${msg.role}">${msg.content}</div>`
  ).join('');
  container.scrollTop = container.scrollHeight;
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  const question = input.value.trim();
  if (!question || !analysisResult) return;

  input.value = '';
  chatHistory.push({ role: 'user', content: question });
  renderChat();

  const movesText = (analysisResult.moves || []).map(m => `${m.moveNumber}. ${m.whiteMove} ${m.blackMove}`).join(' ');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'chat',
      data: { movesText, analysis: analysisResult, question, history: chatHistory.slice(0, -1) }
    });

    if (response.error) throw new Error(response.error);
    chatHistory.push({ role: 'ai', content: response });
  } catch (e) {
    chatHistory.push({ role: 'ai', content: 'Sorry: ' + e.message });
  }
  renderChat();
}

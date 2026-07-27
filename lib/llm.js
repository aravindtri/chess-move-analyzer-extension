// LLM Provider abstraction for Chrome extension
const LLM_PROVIDERS = {
  gemini: 'gemini',
  openai: 'openai_compatible',
  azure: 'azure_openai'
};

const DEFAULT_CONFIG = {
  provider: LLM_PROVIDERS.gemini,
  baseUrl: '',
  model: '',
  visionModel: '',
  textModel: '',
  apiVersion: '2024-02-15-preview',
  visionProvider: '',
  visionApiKey: ''
};

function effectiveModel(config, isVision) {
  const specific = isVision ? config.visionModel : config.textModel;
  return specific || config.model;
}

function effectiveProvider(isVision) {
  return getConfig().then(config => {
    if (isVision && config.visionProvider) return config.visionProvider;
    return config.provider;
  });
}

function effectiveApiKey(isVision) {
  return Promise.all([getApiKey(), getConfig()]).then(([key, config]) => {
    if (isVision && config.visionApiKey) return config.visionApiKey;
    return key;
  });
}

async function getConfig() {
  const result = await chrome.storage.local.get('llmConfig');
  return { ...DEFAULT_CONFIG, ...result.llmConfig };
}

async function saveConfig(config) {
  await chrome.storage.local.set({ llmConfig: config });
}

async function getApiKey() {
  const result = await chrome.storage.local.get('apiKey');
  return result.apiKey || '';
}

async function saveApiKey(key) {
  await chrome.storage.local.set({ apiKey: key });
}

// ===== Gemini Provider =====
async function callGemini(prompt, imageBase64, apiKey, config, isVision) {
  const model = effectiveModel(config, isVision) || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const parts = [{ text: prompt }];
  if (imageBase64) {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
  }

  const body = {
    contents: [{ parts }],
    generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8192 }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) throw new Error(`Gemini API error ${response.status}`);
  const data = await response.json();
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return cleanJsonText(text);
}

// ===== OpenAI Compatible Provider =====
async function callOpenAI(prompt, imageBase64, apiKey, config, isVision) {
  const base = (config.baseUrl || 'https://api.openai.com').replace(/\/$/, '');
  const model = effectiveModel(config, isVision) || 'gpt-4o';
  const url = `${base}/v1/chat/completions`;

  const userContent = [];
  userContent.push({ type: 'text', text: prompt });
  if (imageBase64) {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
    });
  }

  const body = {
    model,
    messages: [
      { role: 'system', content: 'You are a Grandmaster Chess Engine. Respond ONLY with valid JSON, no markdown.' },
      { role: 'user', content: imageBase64 ? userContent : prompt }
    ],
    temperature: 0.1,
    max_tokens: 4096
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API error ${response.status}: ${errorBody.substring(0, 300)}`);
  }
  const data = await response.json();
  return cleanJsonText(data.choices?.[0]?.message?.content || '');
}

// ===== Azure OpenAI Provider =====
async function callAzure(prompt, imageBase64, apiKey, config, isVision) {
  const base = (config.baseUrl || '').replace(/\/$/, '');
  const deployment = effectiveModel(config, isVision) || 'gpt-4o';
  const apiVersion = config.apiVersion || '2024-02-15-preview';
  const url = `${base}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  const userContent = [];
  userContent.push({ type: 'text', text: prompt });
  if (imageBase64) {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
    });
  }

  const body = {
    messages: [
      { role: 'system', content: 'You are a Grandmaster Chess Engine. Respond ONLY with valid JSON, no markdown.' },
      { role: 'user', content: imageBase64 ? userContent : prompt }
    ],
    temperature: 0.1,
    max_tokens: 4096
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) throw new Error(`Azure API error ${response.status}`);
  const data = await response.json();
  return cleanJsonText(data.choices?.[0]?.message?.content || '');
}

function cleanJsonText(text) {
  text = text.trim();
  if (text.startsWith('```')) {
    text = text.substring(text.indexOf('\n') + 1);
    text = text.substring(0, text.lastIndexOf('```')).trim();
  }
  return text;
}

// ===== Main analyze function with retry =====
const ANALYSIS_PROMPT = `You are a Grandmaster Chess Engine & Tactical Coach.
Analyze these chess moves at skill level: %SKILL%.
Return ONLY a JSON object (no markdown) with this exact structure:
{
  "opening": "Opening name",
  "evaluation": "+1.4",
  "moves": [{"moveNumber":1,"whiteMove":"e4","blackMove":"e5","isTacticalMiss":false,"annotation":""}],
  "tacticalMisses": [{"moveNumber":"7. Qd2","movePlayed":"7. Qd2","suggestedMove":"7. Nd5!","explanation":"..."}],
  "positionalInsights": ["insight1"],
  "endgameStrategy": ["strategy1"],
  "summary": "Overall summary"
}

Moves:
%MOVES%`;

async function analyzeMoves(movesText, skillLevel, imageBase64 = null) {
  const apiKey = await effectiveApiKey(!!imageBase64);
  if (!apiKey) throw new Error('API key not configured');

  const config = await getConfig();
  const provider = imageBase64 && config.visionProvider ? config.visionProvider : config.provider;
  const prompt = ANALYSIS_PROMPT.replace('%SKILL%', skillLevel).replace('%MOVES%', movesText);

  let rawJson;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const isVision = !!imageBase64;
      switch (provider) {
        case LLM_PROVIDERS.openai:
          rawJson = await callOpenAI(prompt, imageBase64, apiKey, config, !!imageBase64);
          break;
        case LLM_PROVIDERS.azure:
          rawJson = await callAzure(prompt, imageBase64, apiKey, config, !!imageBase64);
          break;
        default:
          rawJson = await callGemini(prompt, imageBase64, apiKey, config, !!imageBase64);
      }
      return JSON.parse(rawJson);
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

// ===== Chat function =====
async function chatAboutMoves(movesText, analysis, userQuestion, conversationHistory) {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('API key not configured');

  const config = await getConfig();

  const systemPrompt = `You are a Grandmaster Chess Coach. You have analyzed these chess moves:
${movesText}

Analysis summary: ${analysis.opening}, evaluation ${analysis.evaluation}. ${analysis.summary}

Tactical misses: ${(analysis.tacticalMisses || []).map(m => `${m.moveNumber}: ${m.explanation}`).join('; ')}

Answer the user's question about this game. Be specific, reference move numbers, and give actionable advice. Keep responses focused and helpful.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(conversationHistory || []),
    { role: 'user', content: userQuestion }
  ];

  const body = {
    messages,
    max_tokens: 2048
  };

  let url, headers;
  const model = config.model || 'gemini-2.5-flash';

  if (config.provider === LLM_PROVIDERS.gemini) {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    headers = { 'Content-Type': 'application/json' };
    body.contents = messages.map(m => ({
      role: m.role === 'system' ? 'user' : m.role,
      parts: [{ text: m.role === 'system' ? m.content : m.content }]
    }));
    delete body.messages;
    delete body.max_tokens;
    body.generationConfig = { maxOutputTokens: 2048 };
  } else if (config.provider === LLM_PROVIDERS.azure) {
    const base = (config.baseUrl || '').replace(/\/$/, '');
    const deployment = config.model || 'gpt-4o';
    const apiVersion = config.apiVersion || '2024-02-15-preview';
    url = `${base}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
    headers = { 'Content-Type': 'application/json', 'api-key': apiKey };
    body.model = deployment;
  } else {
    const base = (config.baseUrl || 'https://api.openai.com').replace(/\/$/, '');
    url = `${base}/v1/chat/completions`;
    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
    body.model = model;
  }

  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Chat API error ${response.status}`);
  const data = await response.json();

  if (config.provider === LLM_PROVIDERS.gemini) {
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
  }
  return data.choices?.[0]?.message?.content || 'No response';
}

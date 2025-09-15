const els = {
  baseUrlRow: document.getElementById('baseUrlRow'),
  baseUrl: document.getElementById('baseUrl'),
  loginView: document.getElementById('loginView'),
  createView: document.getElementById('createView'),
  loginError: document.getElementById('loginError'),
  username: document.getElementById('username'),
  password: document.getElementById('password'),
  loginBtn: document.getElementById('loginBtn'),
  url: document.getElementById('url'),
  name: document.getElementById('name'),
  description: document.getElementById('description'),
  tags: document.getElementById('tags'),
  favorite: document.getElementById('favorite'),
  passcode: document.getElementById('passcode'),
  autoTags: document.getElementById('autoTags'),
  autoDesc: document.getElementById('autoDesc'),
  createBtn: document.getElementById('createBtn'),
  createMsg: document.getElementById('createMsg'),
  createError: document.getElementById('createError'),
  logoutBtn: document.getElementById('logoutBtn'),
};

async function getActiveTabInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return { url: tab?.url || '', title: tab?.title || '' };
  } catch {
    return { url: '', title: '' };
  }
}

function show(el, on) {
  el.classList.toggle('hidden', !on);
}

function isLocal(url) {
  return /localhost|127\.0\.0\.1/i.test(url || '');
}

async function getInstallType() {
  try {
    if (chrome.management && chrome.management.getSelf) {
      return await new Promise((resolve) => {
        chrome.management.getSelf((info) => resolve(info?.installType || 'unknown'));
      });
    }
  } catch { }
  return 'unknown';
}

async function loadState() {
  const stored = await chrome.storage.local.get([
    'memorizeBaseUrl',
    'memorizeToken',
    // migration from previous keys
    'venseraBaseUrl',
    'venseraToken',
  ]);
  const installType = await getInstallType();
  const isDev = installType === 'development';

  // Decide default base URL by install type
  // Migrate old keys to new keys if present
  if (!stored.memorizeBaseUrl && stored.venseraBaseUrl) {
    await chrome.storage.local.set({ memorizeBaseUrl: stored.venseraBaseUrl });
    await chrome.storage.local.remove('venseraBaseUrl');
  }
  if (!stored.memorizeToken && stored.venseraToken) {
    await chrome.storage.local.set({ memorizeToken: stored.venseraToken });
    await chrome.storage.local.remove('venseraToken');
  }

  let base = stored.memorizeBaseUrl;
  if (!base) {
    base = isDev ? 'http://localhost:4001' : 'https://vensera.up.railway.app';
    await chrome.storage.local.set({ memorizeBaseUrl: base });
  }
  els.baseUrl.value = base;

  // Show row in dev, or if no URL is set yet; otherwise hide/lock in packed installs
  const shouldShow = isDev || !stored.memorizeBaseUrl;
  const lock = !shouldShow;

  els.baseUrl.readOnly = lock;
  els.baseUrl.disabled = lock;
  if (els.baseUrlRow) show(els.baseUrlRow, shouldShow);

  const token = stored.memorizeToken || '';
  show(els.loginView, !token);
  show(els.createView, !!token);
  if (token) {
    const { url, title } = await getActiveTabInfo();
    els.url.value = url;
    els.name.value = title || '';
  }
}

els.baseUrl.addEventListener('change', async () => {
  await chrome.storage.local.set({ memorizeBaseUrl: els.baseUrl.value.trim() });
});

els.loginBtn.addEventListener('click', async () => {
  const base = (els.baseUrl.value || '').trim();
  const username = (els.username.value || '').trim();
  const password = els.password.value || '';
  show(els.loginError, false);
  try {
    const res = await fetch(`${base}/api/ext/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('application/json')) {
      const text = await res.text();
      throw new Error('Server returned HTML. Please set Server URL to your API host (e.g., http://localhost:4001).');
    }
    const j = await res.json();
    if (!res.ok) {
      throw new Error(j.message || 'Login failed');
    }
    await chrome.storage.local.set({ memorizeToken: j.token, memorizeBaseUrl: base });
    els.password.value = '';
    await loadState();
  } catch (e) {
    els.loginError.textContent = e.message || 'Login failed';
    show(els.loginError, true);
  }
});

els.logoutBtn.addEventListener('click', async () => {
  await chrome.storage.local.remove('memorizeToken');
  await loadState();
});

els.createBtn.addEventListener('click', async () => {
  const base = (els.baseUrl.value || '').trim();
  const token = (await chrome.storage.local.get('memorizeToken')).memorizeToken;
  const payload = {
    url: (els.url.value || '').trim(),
    name: (els.name.value || '').trim(),
    description: (els.description.value || '').trim() || null,
    tags: (els.tags.value || '').trim(),
    isFavorite: !!els.favorite.checked,
    passcode: (els.passcode.value || '').trim() || undefined,
    autoGenerateTags: !!els.autoTags.checked,
    autoGenerateDescription: !!els.autoDesc.checked,
  };
  show(els.createError, false);
  show(els.createMsg, false);
  try {
    const res = await fetch(`${base}/api/ext/bookmarks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('application/json')) {
      const text = await res.text();
      throw new Error('Server returned non-JSON. Verify Server URL points to your API (e.g., http://localhost:4001).');
    }
    const j = await res.json();
    if (!res.ok) {
      throw new Error(j.message || 'Failed to create');
    }
    els.createMsg.textContent = 'Bookmark created!';
    show(els.createMsg, true);
    // notifications disabled per policy preferences; inline success is shown
    // Close the popup shortly after success
    setTimeout(() => {
      try { window.close(); } catch { }
    }, 1000);
    // Optionally clear simple fields
    // els.tags.value = '';
  } catch (e) {
    els.createError.textContent = e.message || 'Failed to create bookmark';
    show(els.createError, true);
    // notifications disabled; inline error is shown
  }
});

loadState();

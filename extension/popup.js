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
  category: document.getElementById('category'),
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
  } catch {}
  return 'unknown';
}

async function loadCategories() {
  try {
    const base = (els.baseUrl.value || '').trim();
    const token = (await chrome.storage.local.get('memorizeToken')).memorizeToken;

    if (!base || !token) return;

    const res = await fetch(`${base}/api/categories`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return;

    const categories = await res.json();

    // Clear existing options except the first one
    els.category.innerHTML = '<option value="">Select a folder...</option>';

    // Add categories to dropdown
    categories.forEach((category) => {
      const option = document.createElement('option');
      option.value = category.id;
      option.textContent = category.name;
      els.category.appendChild(option);
    });
  } catch (error) {
    console.error('Failed to load categories:', error);
  }
}

async function processAiFeaturesInBackground(base, token, bookmarkId, wantsAiTags, wantsAiDesc) {
  try {
    // Process AI features in parallel
    const promises = [];

    if (wantsAiTags) {
      promises.push(
        fetch(`${base}/api/bookmarks/${bookmarkId}/auto-tags`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        }).catch((error) => {
          console.error('AI tags failed:', error);
          return { ok: false, error };
        }),
      );
    }

    if (wantsAiDesc) {
      promises.push(
        fetch(`${base}/api/bookmarks/${bookmarkId}/auto-description`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        }).catch((error) => {
          console.error('AI description failed:', error);
          return { ok: false, error };
        }),
      );
    }

    // Wait for all AI processing to complete (but don't block the UI)
    Promise.all(promises).then((results) => {
      const successCount = results.filter((r) => r && r.ok).length;
      const totalCount = results.length;

      if (successCount === totalCount) {
        console.log('All AI features processed successfully');
      } else {
        console.warn(`AI processing completed: ${successCount}/${totalCount} features succeeded`);
      }
    });
  } catch (error) {
    console.error('Background AI processing failed:', error);
  }
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
    // Load categories when user is logged in
    await loadCategories();
  }
}

els.baseUrl.addEventListener('change', async () => {
  await chrome.storage.local.set({ memorizeBaseUrl: els.baseUrl.value.trim() });
  // Reload categories when base URL changes
  await loadCategories();
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
      throw new Error(
        'Server returned HTML. Please set Server URL to your API host (e.g., http://localhost:4001).',
      );
    }
    const j = await res.json();
    if (!res.ok) {
      throw new Error(j.message || 'Login failed');
    }
    await chrome.storage.local.set({ memorizeToken: j.token, memorizeBaseUrl: base });
    els.password.value = '';
    await loadState();
    // Load categories after successful login
    await loadCategories();
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
  const categoryId = els.category.value ? parseInt(els.category.value) : null;
  const wantsAiTags = !!els.autoTags.checked;
  const wantsAiDesc = !!els.autoDesc.checked;

  // Create payload without AI flags for immediate creation
  const payload = {
    url: (els.url.value || '').trim(),
    name: (els.name.value || '').trim(),
    description: (els.description.value || '').trim() || null,
    tags: (els.tags.value || '').trim(),
    categoryId: categoryId,
    isFavorite: !!els.favorite.checked,
    passcode: (els.passcode.value || '').trim() || undefined,
    // Don't include AI flags in initial creation
  };

  show(els.createError, false);
  show(els.createMsg, false);

  // Show loading state
  const originalText = els.createBtn.textContent;
  els.createBtn.textContent = 'Creating...';
  els.createBtn.disabled = true;

  try {
    // Create bookmark immediately without AI
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
      throw new Error(
        'Server returned non-JSON. Verify Server URL points to your API (e.g., http://localhost:4001).',
      );
    }

    const j = await res.json();
    if (!res.ok) {
      throw new Error(j.message || 'Failed to create');
    }

    // Show immediate success
    els.createMsg.textContent = 'Bookmark created!';
    show(els.createMsg, true);

    // If AI features are requested, process them in the background
    if ((wantsAiTags || wantsAiDesc) && j.id) {
      els.createMsg.textContent = 'Bookmark created! AI processing in background...';
      processAiFeaturesInBackground(base, token, j.id, wantsAiTags, wantsAiDesc);
    }

    // Close the popup after a short delay
    setTimeout(
      () => {
        try {
          window.close();
        } catch {}
      },
      wantsAiTags || wantsAiDesc ? 2000 : 1000,
    );
  } catch (e) {
    els.createError.textContent = e.message || 'Failed to create bookmark';
    show(els.createError, true);
  } finally {
    // Restore button state
    els.createBtn.textContent = originalText;
    els.createBtn.disabled = false;
  }
});

loadState();

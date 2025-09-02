/*
 * Copyright (C) 2024 OpenSignage Project.
 * All rights reserved.
 *
 * This software is licensed under the Elastic License 2.0 (ELv2).
 * You may obtain a copy of the license at:
 * https://www.elastic.co/licensing/elastic-license
 */

import { Context } from 'hono';

/**
 * Render a minimal HTML upload form for product info files.
 * - The page derives `productName` strictly from the path `/ext-api/products_info/upload-form/{productName}`
 * - Shows selected files, allows adding/removing, and posts to `/ext-api/products_info/upload/{productName}`
 * - On successful upload of all files, the page auto-navigates back after a short delay
 */
export const uploadProductsInfoFormHandler = async (c: Context) => {
  const rawProductName = c.req.param?.('productName') as string | undefined;
  const productNameParam = rawProductName ? decodeURIComponent(rawProductName) : '';
  if (!productNameParam) {
    return c.text('productName がパスに指定されていません。/ext-api/products_info/upload-form/{productName} の形式でアクセスしてください。', 400);
  }
  const headerPath = `persistent_data/products_info/${productNameParam}`;

  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>商品情報のアップロード</title>
  <style>
    :root { --bg:#f3f4f6; --card:#ffffff; --text:#111827; --muted:#6b7280; --line:#e5e7eb; --primary:#111827; --accent:#2563eb; }
    body.dark { --bg:#0b1220; --card:#111827; --text:#e5e7eb; --muted:#9ca3af; --line:#1f2937; --primary:#2563eb; --accent:#60a5fa; }
    body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif; margin: 0; background: var(--bg); color: var(--text); }
    .container { max-width: 840px; margin: 32px auto; padding: 0 16px; }
    .card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,.04); }
    .header { display:flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 8px; }
    .header h1 { font-size: 20px; margin: 0; }
    .header .muted { color: var(--muted); font-size: 12px; }
    .mode { display:flex; align-items:center; gap:8px; font-size:12px; }
    .divider { height: 1px; background: var(--line); margin: 12px 0 16px; }
    .field { margin: 12px 0; }
    label { display: block; margin: 0 0 6px; font-weight: 600; }
    input[type="text"] { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; background:#fff; color: var(--text); }
    body.dark input[type="text"] { background:#0f172a; border-color:#334155; color:#e5e7eb; }
    input[type="file"] { margin-top: 4px; }
    .hint { color: var(--muted); font-size: 12px; margin-top: 4px; }
    .files { background:#f9fafb; border:1px dashed #d1d5db; border-radius:8px; padding:10px; margin-top:8px; }
    .files.empty { color: var(--muted); }
    .files ul { list-style: disc; }
    .files li { display:flex; justify-content: space-between; align-items:center; gap:8px; }
    .chip { background:#e5e7eb; color:#111827; border-radius:12px; padding:2px 8px; font-size:12px; }
    .remove { background:#ef4444; color:#fff; border:none; border-radius:6px; padding:4px 8px; cursor:pointer; }
    .remove:hover { background:#dc2626; }
    .actions { display:flex; gap:12px; align-items:center; margin-top: 16px; }
    button { padding: 10px 16px; background: var(--primary); color: #fff; border: none; border-radius: 8px; cursor: pointer; }
    body.dark #submitBtn { background: var(--primary); color: #fff; }
    button.secondary { background: #374151; }
    button:disabled { opacity: .6; cursor: not-allowed; }
    .note { color: var(--muted); font-size: 12px; }
    .status { color: var(--muted); font-size: 12px; }
    pre { background: #0b1220; color:#d1eaff; padding: 12px; border-radius: 8px; overflow: auto; min-height: 96px; }

    /* Dark mode adjustments for file list readability */
    body.dark .files { background:#0f172a; border-color:#334155; }
    body.dark .files li span:first-child { color:#e5e7eb; }
  </style>
</head>
<body class="dark">
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>商品情報のアップロード</h1>
        <span class="muted">${headerPath}</span>
        <div class="mode">
          <label for="displayMode">表示モード</label>
          <select id="displayMode">
            <option value="light">light</option>
            <option value="dark" selected>dark</option>
          </select>
        </div>
      </div>
      <div class="divider"></div>
      <form id="f">
        <div class="field">
          <div class="hint">商品（${productNameParam}）に関連する情報をアップロードします。</div>
        </div>

        <div class="field">
          <label for="files">ファイル（複数選択可）</label>
          <input id="files" name="file" type="file" multiple accept=".pdf,.ppt,.pptx,.txt,.md,.url" />
          <input id="moreFiles" type="file" multiple accept=".pdf,.ppt,.pptx,.txt,.md,.url" style="display:none" />
          <div class="hint">許可拡張子: .pdf / .ppt / .pptx / .txt / .md / .url</div>
          <div id="fileList" class="files empty">未選択</div>
        </div>

        <div class="actions">
          <button id="backBtn" type="button" class="secondary">戻る</button>
          <button id="addBtn" type="button" class="secondary">追加選択</button>
          <button id="clearBtn" type="button" class="secondary">選択を全削除</button>
          <button id="submitBtn" type="submit">アップロード</button>
          <span id="status" class="status"></span>
        </div>
      </form>
      <h3>結果</h3>
      <pre id="out">(未送信)</pre>
    </div>
  </div>

  <script>
    // Display mode toggle (light/dark). We keep UI dark by default.
    const displayMode = document.getElementById('displayMode');
    // default to dark
    displayMode.value = 'dark';
    displayMode.addEventListener('change', function() {
      if (displayMode.value === 'dark') document.body.classList.add('dark');
      else document.body.classList.remove('dark');
    });

    const f = document.getElementById('f');
    const out = document.getElementById('out');
    const btn = document.getElementById('submitBtn');
    // The form no longer has a productName input. We rely only on the path parameter.
    const filesInput = document.getElementById('files');
    const moreFilesInput = document.getElementById('moreFiles');
    const fileList = document.getElementById('fileList');
    const statusEl = document.getElementById('status');
    const addBtn = document.getElementById('addBtn');
    const clearBtn = document.getElementById('clearBtn');
    const backBtn = document.getElementById('backBtn');
    const selectedFiles = [];

    // Extract productName from the path /ext-api/products_info/upload-form/{productName}
    // and decode it for display and submission.
    var productNameFromPath = '';
    (function() {
      var prefix = '/ext-api/products_info/upload-form/';
      var path = window.location.pathname || '';
      var idx = path.indexOf(prefix);
      if (idx >= 0) {
        var rest = path.substring(idx + prefix.length);
        var end = rest.length;
        var s1 = rest.indexOf('/'); if (s1 >= 0 && s1 < end) end = s1;
        var s2 = rest.indexOf('?'); if (s2 >= 0 && s2 < end) end = s2;
        var s3 = rest.indexOf('#'); if (s3 >= 0 && s3 < end) end = s3;
        var raw = rest.substring(0, end);
        try { productNameFromPath = decodeURIComponent(raw); } catch (_) { productNameFromPath = raw; }
      }
    })();
    const productNameParam = productNameFromPath || '';

    // Back navigation behavior: prefer document.referrer, otherwise use history.back()
    backBtn.addEventListener('click', function() {
      if (document.referrer) { window.location.href = document.referrer; return; }
      history.back();
    });

    // Render the currently selected files as a simple list with remove buttons.
    function renderFileList() {
      if (!selectedFiles || selectedFiles.length === 0) {
        fileList.textContent = '未選択';
        fileList.classList.add('empty');
        return;
      }
      fileList.classList.remove('empty');
      const ul = document.createElement('ul');
      ul.style.margin = '0';
      ul.style.paddingLeft = '16px';
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const li = document.createElement('li');
        const left = document.createElement('span');
        left.textContent = file.name + ' (' + Math.round(file.size/1024) + ' KB)';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'remove';
        btn.setAttribute('data-index', String(i));
        btn.textContent = '削除';
        li.appendChild(left);
        li.appendChild(btn);
        ul.appendChild(li);
      }
      fileList.innerHTML = '';
      fileList.appendChild(ul);
    }

    // Append unique files from a FileList/array-like into selectedFiles.
    // This prevents accidental duplicates (same name/size/lastModified).
    function addUnique(files) {
      if (!files || typeof files.length !== 'number') return;
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        var exists = false;
        for (var j = 0; j < selectedFiles.length; j++) {
          var g = selectedFiles[j];
          if (g.name === f.name && g.size === f.size && g.lastModified === f.lastModified) { exists = true; break; }
        }
        if (!exists) { selectedFiles.push(f); }
      }
    }

    // Reset the selection to what the main file input currently holds.
    filesInput.addEventListener('change', function() {
      selectedFiles.length = 0;
      addUnique(filesInput.files);
      renderFileList();
    });

    // Support adding more files via a hidden input without resetting selection.
    moreFilesInput.addEventListener('change', function() {
      addUnique(moreFilesInput.files);
      renderFileList();
      moreFilesInput.value = '';
    });

    // Trigger the hidden input to select additional files.
    addBtn.addEventListener('click', function() { moreFilesInput.click(); });

    // Clear all selected files.
    clearBtn.addEventListener('click', function() {
      selectedFiles.length = 0;
      filesInput.value = '';
      renderFileList();
    });

    // Delegate remove action from the file list.
    fileList.addEventListener('click', function(e) {
      var target = e.target || e.srcElement;
      if (target && target.classList && target.classList.contains('remove')) {
        var idx = target.getAttribute('data-index');
        var i = parseInt(idx, 10);
        if (!isNaN(i) && i >= 0 && i < selectedFiles.length) {
          selectedFiles.splice(i, 1);
          renderFileList();
        }
      }
    });

    // Submit handler: builds FormData, posts to the upload endpoint, and renders per-file results.
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      out.textContent = 'Uploading...';
      statusEl.textContent = '送信中...';
      btn.disabled = true;
      const originalBtn = btn.textContent;
      btn.textContent = 'Uploading...';
      try {
        const candidate = productNameParam;
        if (!candidate) { out.textContent = 'productName を入力してください'; btn.disabled = false; return; }
        if (!selectedFiles.length) { out.textContent = 'ファイルを選択してください'; btn.disabled = false; statusEl.textContent = ''; return; }
        const fd = new FormData();
        for (const f of selectedFiles) fd.append('file', f);
        const res = await fetch('/ext-api/products_info/upload/' + encodeURIComponent(candidate), { method: 'POST', body: fd });
        const data = await res.json();
        // Render concise per-file results without dumping raw JSON.
        if (res.ok && data && Array.isArray(data.files)) {
          var uploadedSet = {};
          for (var i = 0; i < data.files.length; i++) {
            var df = data.files[i];
            if (df && df.filename) { uploadedSet[df.filename] = true; }
          }
          var lines = [];
          for (var j = 0; j < selectedFiles.length; j++) {
            var name = selectedFiles[j].name;
            var ok = !!uploadedSet[name];
            lines.push(name + ': ' + (ok ? '成功' : '失敗'));
          }
          out.textContent = 'アップロード結果\\n' + lines.join('\\n');
          // Auto-back if all files succeeded. This shows the results, then navigates back
          // after a short delay so the user has time to read. The delay is configured below.
          var allOk = true;
          for (var m = 0; m < selectedFiles.length; m++) {
            if (!uploadedSet[selectedFiles[m].name]) { allOk = false; break; }
          }
          if (allOk) {
            // Inform the user before navigating back
            out.textContent += '\\nすべてのファイルが正常にアップロードされました。5秒後に戻ります。';
            statusEl.textContent = '完了 (5秒後に戻ります)';
            if (document.referrer) {
              setTimeout(function(){ window.location.href = document.referrer; }, 5000);
            } else if (history.length > 1) {
              setTimeout(function(){ history.back(); }, 5000);
            }
          }
        } else {
          var linesFail = [];
          for (var k = 0; k < selectedFiles.length; k++) {
            linesFail.push(selectedFiles[k].name + ': 失敗');
          }
          if (data && data.error) { linesFail.push('エラー: ' + String(data.error)); }
          out.textContent = 'アップロード結果\\n' + linesFail.join('\\n');
        }
        statusEl.textContent = res.ok ? '完了' : '失敗';
      } catch (err) {
        out.textContent = String(err);
        statusEl.textContent = 'エラー';
      } finally {
        btn.disabled = false;
        btn.textContent = originalBtn;
      }
    });
  </script>
</body>
</html>`;
  return c.body(html, 200, {
    'Content-Type': 'text/html; charset=utf-8',
  });
};

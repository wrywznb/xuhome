/* 本地写作台 —— 通过 /api 读写 content/posts/ 下的 Markdown */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    list: $('post-list'),
    count: $('count'),
    search: $('search'),
    title: $('f-title'),
    date: $('f-date'),
    tags: $('f-tags'),
    slug: $('f-slug'),
    summary: $('f-summary'),
    content: $('content'),
    draft: $('f-draft'),
    preview: $('preview'),
    status: $('status'),
    toast: $('toast'),
    save: $('btn-save'),
    del: $('btn-delete'),
    create: $('btn-new'),
    imageBtn: $('btn-image'),
    fileInput: $('file-input')
  };

  var state = { posts: [], slug: null, dirty: false, tab: 'write', filter: '', previewTimer: null };

  /* ---------------------------------------------------------------- 工具 */

  function today() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function setStatus(text, type) {
    el.status.textContent = text;
    el.status.className = 'status' + (type ? ' is-' + type : '');
  }

  var toastTimer = null;
  function toast(text, isErr) {
    el.toast.textContent = text;
    el.toast.className = 'toast' + (isErr ? ' is-err' : '');
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.hidden = true; }, 2600);
  }

  function api(path, options) {
    return fetch(path, options).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error(data.error || '请求失败（' + res.status + '）');
        return data;
      });
    });
  }

  function markDirty() {
    if (!state.dirty) setStatus('有未保存的修改');
    state.dirty = true;
  }

  function canLeave() {
    return !state.dirty || window.confirm('当前文章还没保存，确定要离开吗？');
  }

  /* ---------------------------------------------------------------- 列表 */

  function loadPosts() {
    return api('/api/posts')
      .then(function (data) {
        state.posts = data.posts || [];
        renderList();
      })
      .catch(function (err) {
        setStatus(err.message, 'err');
      });
  }

  function renderList() {
    var q = state.filter.trim().toLowerCase();
    var list = state.posts.filter(function (p) {
      return !q || p.title.toLowerCase().indexOf(q) !== -1 || (p.tags || []).join(' ').toLowerCase().indexOf(q) !== -1;
    });

    el.count.textContent = state.posts.length;
    el.list.innerHTML = '';

    if (!list.length) {
      var tip = document.createElement('li');
      tip.className = 'empty-tip';
      tip.textContent = q ? '没有匹配的文章' : '还没有文章，点右上角「新建」开始写吧';
      el.list.appendChild(tip);
      return;
    }

    list.forEach(function (post) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'post-item' + (post.slug === state.slug ? ' is-active' : '');
      btn.innerHTML =
        '<span class="post-item-title">' + escapeHtml(post.title) + '</span>' +
        '<span class="post-item-meta">' + escapeHtml(post.date) +
        (post.draft ? '<span class="draft-dot">草稿</span>' : '') + '</span>';
      btn.addEventListener('click', function () { openPost(post.slug); });
      li.appendChild(btn);
      el.list.appendChild(li);
    });
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---------------------------------------------------------------- 读写 */

  function fill(data) {
    el.title.value = data.title || '';
    el.date.value = data.date || today();
    el.tags.value = (data.tags || []).join(', ');
    el.slug.value = data.slug || '';
    el.summary.value = data.summary || '';
    el.content.value = data.content || '';
    el.draft.checked = !!data.draft;
    state.slug = data.slug || null;
    state.dirty = false;
    setStatus(data.slug ? '已载入' : '新文章');
    if (state.tab === 'preview') renderPreview();
  }

  function openPost(slug) {
    if (!canLeave()) return;
    api('/api/post?slug=' + encodeURIComponent(slug))
      .then(function (data) {
        fill(data);
        renderList();
      })
      .catch(function (err) { toast(err.message, true); });
  }

  function newPost() {
    if (!canLeave()) return;
    fill({ date: today(), tags: [], draft: false, content: '' });
    el.slug.value = '';
    renderList();
    setTimeout(function () { el.title.focus(); }, 30);
  }

  function payload() {
    return {
      originalSlug: state.slug,
      slug: el.slug.value.trim(),
      title: el.title.value.trim(),
      date: el.date.value,
      tags: el.tags.value.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean),
      summary: el.summary.value.trim(),
      draft: el.draft.checked,
      content: el.content.value
    };
  }

  function save() {
    var data = payload();
    if (!data.title) { toast('请先填标题', true); el.title.focus(); return; }
    if (!data.date) { toast('请选择日期', true); return; }

    el.save.disabled = true;
    setStatus('保存中…');
    api('/api/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (res) {
        state.slug = res.slug;
        el.slug.value = res.slug;
        state.dirty = false;
        setStatus('已保存 · 刷新博客即可看到', 'ok');
        toast('保存成功');
        return loadPosts();
      })
      .catch(function (err) {
        setStatus('保存失败：' + err.message, 'err');
        toast(err.message, true);
      })
      .then(function () { el.save.disabled = false; });
  }

  function remove() {
    if (!state.slug) { toast('这篇还没保存过', true); return; }
    if (!window.confirm('确定删除《' + el.title.value + '》？文件会从 content/posts/ 里移除。')) return;
    api('/api/post?slug=' + encodeURIComponent(state.slug), { method: 'DELETE' })
      .then(function () {
        toast('已删除');
        fill({ date: today(), tags: [], draft: false, content: '' });
        renderList();
      })
      .catch(function (err) { toast(err.message, true); });
  }

  /* ---------------------------------------------------------------- 预览 */

  function renderPreview() {
    api('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: el.content.value })
    })
      .then(function (data) { el.preview.innerHTML = data.html; })
      .catch(function () { el.preview.innerHTML = '<p style="color:#b3261e">预览失败</p>'; });
  }

  function setTab(tab) {
    state.tab = tab;
    document.querySelectorAll('.tab').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.tab === tab);
    });
    var previewing = tab === 'preview';
    el.content.hidden = previewing;
    el.preview.hidden = !previewing;
    if (previewing) renderPreview();
  }

  /* ---------------------------------------------------------------- 图片 */

  function insertAtCursor(text) {
    var start = el.content.selectionStart || 0;
    var end = el.content.selectionEnd || 0;
    var value = el.content.value;
    el.content.value = value.slice(0, start) + text + value.slice(end);
    var pos = start + text.length;
    el.content.setSelectionRange(pos, pos);
    el.content.focus();
    markDirty();
  }

  function uploadImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('读取图片失败')); };
      reader.onload = function () {
        api('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: file.name, data: reader.result })
        }).then(resolve, reject);
      };
      reader.readAsDataURL(file);
    });
  }

  function handleFiles(files) {
    var list = Array.prototype.slice.call(files || []).filter(function (f) {
      return /^image\//.test(f.type);
    });
    if (!list.length) {
      toast('只能上传图片', true);
      return;
    }

    setStatus('上传 ' + list.length + ' 张图片…');
    var done = 0;
    var chain = Promise.resolve();
    list.forEach(function (file) {
      chain = chain.then(function () {
        return uploadImage(file).then(function (res) {
          insertAtCursor('\n\n' + res.markdown + '\n\n');
          done++;
        });
      });
    });

    chain
      .then(function () {
        setStatus('已插入 ' + done + ' 张图片', 'ok');
        toast('图片已插入');
        if (state.tab === 'preview') renderPreview();
      })
      .catch(function (err) {
        setStatus('上传失败：' + err.message, 'err');
        toast(err.message, true);
      });
  }

  /* ---------------------------------------------------------------- 事件 */

  document.querySelectorAll('.tab').forEach(function (btn) {
    btn.addEventListener('click', function () { setTab(btn.dataset.tab); });
  });

  [el.title, el.date, el.tags, el.slug, el.summary, el.content].forEach(function (input) {
    input.addEventListener('input', function () {
      markDirty();
      if (state.tab === 'preview') {
        clearTimeout(state.previewTimer);
        state.previewTimer = setTimeout(renderPreview, 350);
      }
    });
  });

  el.draft.addEventListener('change', markDirty);
  el.save.addEventListener('click', save);
  el.del.addEventListener('click', remove);
  el.create.addEventListener('click', newPost);

  el.imageBtn.addEventListener('click', function () {
    el.fileInput.click();
  });

  el.fileInput.addEventListener('change', function () {
    handleFiles(el.fileInput.files);
    el.fileInput.value = '';
  });

  el.content.addEventListener('paste', function (e) {
    var items = (e.clipboardData && e.clipboardData.items) || [];
    var files = [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].kind === 'file' && /^image\//.test(items[i].type)) {
        var file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length) {
      e.preventDefault();
      handleFiles(files);
    }
  });

  el.content.addEventListener('dragover', function (e) {
    if (!e.dataTransfer) return;
    var hasFile = Array.prototype.some.call(e.dataTransfer.items || [], function (item) {
      return item.kind === 'file';
    });
    if (hasFile) {
      e.preventDefault();
      el.content.classList.add('is-dragover');
    }
  });

  el.content.addEventListener('dragleave', function () {
    el.content.classList.remove('is-dragover');
  });

  el.content.addEventListener('drop', function (e) {
    if (!e.dataTransfer) return;
    var files = Array.prototype.slice.call(e.dataTransfer.files || []).filter(function (f) {
      return /^image\//.test(f.type);
    });
    if (!files.length) return;
    e.preventDefault();
    el.content.classList.remove('is-dragover');
    handleFiles(files);
  });

  el.search.addEventListener('input', function () {
    state.filter = el.search.value;
    renderList();
  });

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
  });

  window.addEventListener('beforeunload', function (e) {
    if (state.dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  /* ---------------------------------------------------------------- 启动 */

  el.date.value = today();
  setTab('write');
  setStatus('就绪');
  loadPosts().then(function () {
    // 支持 /admin/?edit=文章名 直接打开某一篇
    var target = new URLSearchParams(location.search).get('edit');
    if (target) openPost(target);
  });
})();

/* 拾光笔记 · 交互脚本 */
(function () {
  'use strict';

  /* ---------------------------------------------------------- 界面文案 */
  // 由构建脚本写入页面里的 <script id="ui-texts">，见 theme/texts.mjs
  var UI = (function () {
    var defaults = {
      copy: '复制',
      copied: '已复制',
      copyFail: '复制失败',
      searchEmpty: '没有找到相关文章，换个关键词试试。',
      searchFound: '找到 {n} 篇相关文章。',
      searchFail: '搜索索引加载失败，请通过本地服务器或线上地址访问。',
      searchHint: '试试搜索「写作」「Markdown」或「博客」。',
      themeToDark: '切换到深色模式',
      themeToLight: '切换到浅色模式',
    };
    try {
      var el = document.getElementById('ui-texts');
      if (!el) return defaults;
      var parsed = JSON.parse(el.textContent || '{}');
      for (var k in defaults) {
        if (typeof parsed[k] !== 'string') parsed[k] = defaults[k];
      }
      return parsed;
    } catch (e) {
      return defaults;
    }
  })();

  /* ---------------------------------------------------------- 深色模式 */
  var root = document.documentElement;
  var toggle = document.getElementById('theme-toggle');

  function setTheme(theme) {
    root.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {}
    if (toggle) {
      toggle.setAttribute('aria-label', theme === 'dark' ? UI.themeToLight : UI.themeToDark);
    }
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
    });
  }

  /* ---------------------------------------------------------- 页头与进度条 */
  var header = document.querySelector('.site-header');
  var progress = document.getElementById('progress-bar');
  var ticking = false;

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (header) header.classList.toggle('is-scrolled', y > 8);
    if (progress) {
      var height = document.documentElement.scrollHeight - window.innerHeight;
      var ratio = height > 0 ? Math.min(1, Math.max(0, y / height)) : 0;
      progress.style.width = (ratio * 100).toFixed(2) + '%';
    }
    ticking = false;
  }

  window.addEventListener(
    'scroll',
    function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(onScroll);
      }
    },
    { passive: true }
  );
  onScroll();

  /* ---------------------------------------------------------- 代码复制 */
  document.querySelectorAll('.prose pre').forEach(function (pre) {
    var btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.type = 'button';
    btn.textContent = UI.copy;
    btn.addEventListener('click', function () {
      var code = pre.querySelector('code');
      var text = code ? code.textContent : pre.textContent;
      var done = function () {
        btn.textContent = UI.copied;
        btn.classList.add('is-done');
        setTimeout(function () {
          btn.textContent = UI.copy;
          btn.classList.remove('is-done');
        }, 1600);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else {
        fallback();
      }
      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          done();
        } catch (e) {
          btn.textContent = UI.copyFail;
        }
        document.body.removeChild(ta);
      }
    });
    pre.appendChild(btn);
  });

  /* ---------------------------------------------------------- 搜索 */
  var input = document.getElementById('search-input');
  if (!input) return;

  var resultsEl = document.getElementById('search-results');
  var hintEl = document.getElementById('search-hint');
  var index = null;
  var loading = false;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function highlight(text, terms) {
    var out = escapeHtml(text);
    terms.forEach(function (term) {
      if (!term) return;
      var re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      out = out.replace(re, function (m) {
        return '<mark>' + m + '</mark>';
      });
    });
    return out;
  }

  function snippet(text, terms) {
    var plain = text || '';
    var lower = plain.toLowerCase();
    var pos = -1;
    for (var i = 0; i < terms.length; i++) {
      var p = lower.indexOf(terms[i]);
      if (p !== -1 && (pos === -1 || p < pos)) pos = p;
    }
    if (pos === -1) return plain.slice(0, 120) + (plain.length > 120 ? '…' : '');
    var start = Math.max(0, pos - 40);
    var end = Math.min(plain.length, pos + 120);
    return (start > 0 ? '…' : '') + plain.slice(start, end) + (end < plain.length ? '…' : '');
  }

  function score(item, terms) {
    var total = 0;
    var title = (item.title || '').toLowerCase();
    var tags = (item.tags || []).join(' ').toLowerCase();
    var summary = (item.summary || '').toLowerCase();
    var text = (item.text || '').toLowerCase();
    terms.forEach(function (term) {
      if (!term) return;
      if (title.indexOf(term) !== -1) total += 12;
      if (tags.indexOf(term) !== -1) total += 6;
      if (summary.indexOf(term) !== -1) total += 4;
      if (text.indexOf(term) !== -1) total += 1;
    });
    return total;
  }

  function render(items, terms) {
    if (!items.length) {
      resultsEl.innerHTML = '<p class="empty">' + escapeHtml(UI.searchEmpty) + '</p>';
      return;
    }
    resultsEl.innerHTML = items
      .map(function (item) {
        return (
          '<a class="search-item" href="' +
          item.url +
          '">' +
          '<p class="search-item-title">' +
          highlight(item.title, terms) +
          '</p>' +
          '<div class="search-item-meta"><span>' +
          item.date +
          '</span>' +
          (item.tags || [])
            .map(function (t) {
              return '<span>#' + escapeHtml(t) + '</span>';
            })
            .join('') +
          '</div>' +
          '<p class="search-item-text">' +
          highlight(snippet(item.text || item.summary, terms), terms) +
          '</p>' +
          '</a>'
        );
      })
      .join('');
  }

  function runSearch(query) {
    var q = query.trim().toLowerCase();
    if (!q) {
      resultsEl.innerHTML = '';
      hintEl.textContent = UI.searchHint;
      return;
    }
    if (!index) return;
    var terms = q.split(/\s+/).filter(Boolean);
    var hits = index
      .map(function (item) {
        return { item: item, s: score(item, terms) };
      })
      .filter(function (h) {
        return h.s > 0;
      })
      .sort(function (a, b) {
        return b.s - a.s;
      })
      .slice(0, 20)
      .map(function (h) {
        return h.item;
      });
    hintEl.textContent = hits.length ? UI.searchFound.replace('{n}', String(hits.length)) : '';
    render(hits, terms);
  }

  function loadIndex() {
    if (index || loading) return;
    loading = true;
    fetch('search-index.json')
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        index = data;
        if (input.value.trim()) runSearch(input.value);
      })
      .catch(function () {
        hintEl.textContent = UI.searchFail;
      })
      .then(function () {
        loading = false;
      });
  }

  var timer = null;
  input.addEventListener('input', function () {
    loadIndex();
    clearTimeout(timer);
    timer = setTimeout(function () {
      runSearch(input.value);
    }, 120);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== input) {
      e.preventDefault();
      input.focus();
    }
    if (e.key === 'Escape' && document.activeElement === input) {
      input.value = '';
      runSearch('');
      input.blur();
    }
  });

  loadIndex();
})();

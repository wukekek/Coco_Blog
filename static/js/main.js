// 嵌入式技术博客 - 前端交互脚本

document.addEventListener('DOMContentLoaded', function() {
  // 初始化主题
  initTheme();

  // 初始化搜索
  initSearch();

  // 初始化 Mermaid
  initMermaid();

  // 代码块增强
  enhanceCodeBlocks();

  // 平滑滚动到锚点
  initSmoothScroll();

  // 目录高亮
  initTocHighlight();
});

// 主题切换功能
function initTheme() {
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = themeToggle?.querySelector('.theme-icon');

  // 读取保存的主题
  const savedTheme = localStorage.getItem('theme') || 'light';
  setTheme(savedTheme);

  // 点击切换主题
  themeToggle?.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  });

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    // 更新图标
    if (themeIcon) {
      themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }
}

// 搜索功能
function initSearch() {
  const searchInput = document.getElementById('searchInput');
  const sidebarSearch = document.getElementById('sidebarSearch');
  const searchResults = document.getElementById('searchResults');

  function performSearch(query) {
    if (!query || query.length < 2) {
      searchResults?.classList.remove('active');
      return [];
    }

    const searchData = window.searchData || [];
    query = query.toLowerCase();

    return searchData.filter(post => {
      return post.title.toLowerCase().includes(query) ||
             post.excerpt.toLowerCase().includes(query) ||
             (post.tags && post.tags.some(tag => tag.toLowerCase().includes(query))) ||
             (post.categories && post.categories.some(cat => cat.toLowerCase().includes(query)));
    }).slice(0, 10);
  }

  function showResults(results, query) {
    if (!searchResults) return;

    if (results.length === 0) {
      searchResults.innerHTML = '<div class="search-result-item"><div class="search-result-title">未找到相关文章</div></div>';
    } else {
      searchResults.innerHTML = results.map(post => `
        <a href="/posts/${post.slug}.html" class="search-result-item">
          <div class="search-result-title">${highlightMatch(post.title, query)}</div>
          <div class="search-result-excerpt">${post.excerpt}...</div>
        </a>
      `).join('');
    }
    searchResults.classList.add('active');
  }

  function highlightMatch(text, query) {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  function hideResults() {
    setTimeout(() => {
      searchResults?.classList.remove('active');
    }, 200);
  }

  // 导航栏搜索
  searchInput?.addEventListener('input', (e) => {
    const results = performSearch(e.target.value);
    showResults(results, e.target.value);
  });

  searchInput?.addEventListener('focus', (e) => {
    if (e.target.value.length >= 2) {
      searchResults?.classList.add('active');
    }
  });

  searchInput?.addEventListener('blur', hideResults);

  // 侧边栏搜索
  sidebarSearch?.addEventListener('input', (e) => {
    const results = performSearch(e.target.value);
    // 简单实现：跳转到第一篇匹配的文章
    if (results.length > 0 && e.target.value.length >= 2) {
      window.location.href = '/posts/' + results[0].slug + '.html';
    }
  });
}

// 初始化 Mermaid 图表
function initMermaid() {
  if (typeof mermaid !== 'undefined') {
    // 处理 highlight.js 格式的 mermaid 代码块
    const mermaidBlocks = document.querySelectorAll('pre code.language-mermaid');
    mermaidBlocks.forEach(block => {
      const pre = block.parentElement;
      const code = block.textContent;

      // 创建 mermaid 容器
      const mermaidDiv = document.createElement('div');
      mermaidDiv.className = 'mermaid';
      mermaidDiv.textContent = code;

      // 替换原来的代码块
      pre.parentNode.replaceChild(mermaidDiv, pre);
    });

    // 渲染 mermaid 图表
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose',
      flowchart: { useMaxWidth: true }
    });

    mermaid.run(undefined, document.querySelectorAll('.mermaid'));
  }
}

// 代码块增强
function enhanceCodeBlocks() {
  const codeBlocks = document.querySelectorAll('pre code');

  codeBlocks.forEach(block => {
    const className = block.className || '';
    const langMatch = className.match(/language-(\w+)/);

    if (langMatch) {
      const lang = langMatch[1];
      const pre = block.parentElement;

      if (!pre.querySelector('.lang-label')) {
        const langLabel = document.createElement('span');
        langLabel.className = 'lang-label';
        langLabel.textContent = lang.toUpperCase();
        pre.insertBefore(langLabel, pre.firstChild);
      }
    }

    const pre = block.parentElement;
    if (!pre.querySelector('.copy-btn')) {
      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.textContent = '复制';
      copyBtn.title = '复制代码';

      copyBtn.addEventListener('click', () => {
        const code = block.textContent;
        navigator.clipboard.writeText(code).then(() => {
          copyBtn.textContent = '已复制!';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.textContent = '复制';
            copyBtn.classList.remove('copied');
          }, 2000);
        });
      });

      pre.insertBefore(copyBtn, pre.firstChild);
    }
  });
}

// 平滑滚动
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;

      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}

// 目录高亮
function initTocHighlight() {
  // 兼容新旧模板：同时支持 .post-toc 和 .post-toc-sidebar
  const tocLinks = document.querySelectorAll('.post-toc a, .post-toc-sidebar .toc-link');
  if (tocLinks.length === 0) return;

  const headings = [];
  tocLinks.forEach(link => {
    const id = link.getAttribute('href').substring(1);
    const heading = document.getElementById(id);
    if (heading) {
      headings.push({ id, element: heading });
    }
  });

  if (headings.length === 0) return;

  // 更新高亮并滚动目录到可见区域
  function setActiveToc(link) {
    if (!link) return;
    tocLinks.forEach(l => l.parentElement.classList.remove('active'));
    link.parentElement.classList.add('active');

    // 滚动目录容器使激活项可见
    const tocContainer = link.closest('.post-toc-sidebar, .post-toc');
    if (tocContainer) {
      const linkRect = link.getBoundingClientRect();
      const containerRect = tocContainer.getBoundingClientRect();
      const relativeTop = linkRect.top - containerRect.top + tocContainer.scrollTop;

      // 计算滚动位置，使激活项居中
      const scrollTop = Math.max(0, relativeTop - containerRect.height / 2 + linkRect.height / 2);
      tocContainer.scrollTo({
        top: scrollTop,
        behavior: 'smooth'
      });
    }
  }

  // 点击目录链接时立即更新高亮
  tocLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      const id = this.getAttribute('href').substring(1);
      const heading = document.getElementById(id);
      if (heading) {
        // 等待页面滚动后更新高亮
        setTimeout(() => setActiveToc(this), 100);
      }
    });
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const activeLink = document.querySelector(`.post-toc a[href="#${entry.target.id}"], .post-toc-sidebar .toc-link[href="#${entry.target.id}"]`);
          if (activeLink) {
            setActiveToc(activeLink);
          }
        }
      });
    },
    { rootMargin: '-20% 0px -60% 0px' }
  );

  headings.forEach(h => observer.observe(h.element));

  // 初始化时设置第一个为高亮
  if (tocLinks.length > 0) {
    setActiveToc(tocLinks[0]);
  }
}

// 添加复制按钮样式
const style = document.createElement('style');
style.textContent = `
  .copy-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #9ca3af;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    opacity: 0;
    transition: all 0.2s;
  }

  pre:hover .copy-btn {
    opacity: 1;
  }

  .copy-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
  }

  .copy-btn.copied {
    background: #10b981;
    border-color: #10b981;
    color: #fff;
  }

  .lang-label {
    position: absolute;
    top: 0;
    right: 0;
    background: rgba(255, 255, 255, 0.1);
    color: #9ca3af;
    padding: 2px 8px;
    font-size: 10px;
    border-radius: 0 16px 0 4px;
    font-family: monospace;
  }

  pre {
    position: relative;
  }

  .post-toc a.active {
    color: #3b82f6;
    font-weight: 600;
  }

  /* 暗色主题下代码块样式 */
  [data-theme="dark"] .copy-btn {
    background: rgba(0, 0, 0, 0.3);
    border-color: rgba(255, 255, 255, 0.1);
  }

  [data-theme="dark"] .copy-btn:hover {
    background: rgba(0, 0, 0, 0.5);
  }

  [data-theme="dark"] .lang-label {
    background: rgba(0, 0, 0, 0.3);
  }

  /* 搜索高亮 */
  .search-result-title mark {
    background: rgba(59, 130, 246, 0.3);
    color: var(--primary-color);
    padding: 0 2px;
    border-radius: 2px;
  }

  /* 移动端搜索框 */
  @media (max-width: 768px) {
    .search-box {
      display: none;
    }
  }
`;
document.head.appendChild(style);

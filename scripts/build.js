const fs = require('fs-extra');
const path = require('path');
const matter = require('gray-matter');
const { Marked } = require('marked');
const { markedHighlight } = require('marked-highlight');
const hljs = require('highlight.js');
const ejs = require('ejs');

const config = require('./config');

// slugify 函数 - 支持中英文
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fa5-]/g, (match) => {
      // 保留中文、英文、数字、下划线和连字符
      // 如果是标点符号，返回空字符串
      return '';
    })
    .replace(/([a-z0-9])([\u4e00-\u9fa5])/g, '$1-$2') // 英文数字和中文之间加连字符
    .replace(/([\u4e00-\u9fa5])([a-z0-9])/g, '$1-$2') // 中文和英文数字之间加连字符
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') // 去除首尾连字符
    .trim() || 'section';
}

// 初始化 marked 并配置代码高亮
const marked = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    }
  })
);

// 配置 marked 选项
marked.setOptions({
  gfm: true,
  breaks: true
});

// 为标题添加 id 的后处理函数
function addIdsToHeadings(html) {
  return html.replace(/<(h[1-6])>([^<]+)<\/\1>/g, function(match, tag, text) {
    const slug = slugify(text);
    return `<${tag} id="${slug}">${text}</${tag}>`;
  });
}

class BlogBuilder {
  constructor() {
    this.posts = [];
    this.categories = {};
    this.tags = {};
    this.basePath = path.resolve(__dirname, '..');
  }

  async build() {
    console.log('🚀 开始构建博客...\n');

    try {
      // 1. 清理 public 目录
      await this.clean();

      // 2. 读取所有文章
      await this.loadPosts();

      // 3. 处理分类和标签
      this.processCategoriesAndTags();

      // 4. 生成页面
      await this.generatePages();

      // 5. 复制静态资源
      await this.copyStatic();

      console.log('\n✅ 博客构建完成！');
    } catch (error) {
      console.error('❌ 构建失败:', error);
      process.exit(1);
    }
  }

  async clean() {
    const publicPath = path.join(this.basePath, config.paths.public);
    await fs.remove(publicPath);
    await fs.ensureDir(publicPath);
    console.log('🧹 已清理 public 目录');
  }

  async loadPosts() {
    const postsPath = path.join(this.basePath, config.paths.posts);

    // 确保目录存在
    await fs.ensureDir(postsPath);

    const files = await fs.readdir(postsPath);
    const mdFiles = files.filter(f => f.endsWith('.md'));

    console.log(`📄 发现 ${mdFiles.length} 篇文章`);

    for (const file of mdFiles) {
      const filePath = path.join(postsPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const { data, content: markdownContent } = matter(content);

      // 解析 Markdown 为 HTML，并添加标题 id
      const rawHtml = marked.parse(markdownContent);
      const htmlContent = addIdsToHeadings(rawHtml);

      const post = {
        slug: file.replace('.md', ''),
        title: data.title || '无标题',
        date: data.date ? new Date(data.date) : new Date(),
        categories: data.categories || [],
        tags: data.tags || [],
        excerpt: data.excerpt || this.generateExcerpt(markdownContent),
        content: htmlContent,
        originalContent: markdownContent,
        toc: this.generateToc(markdownContent)
      };

      this.posts.push(post);
    }

    // 按日期倒序排序
    this.posts.sort((a, b) => b.date - a.date);

    console.log(`📄 已加载 ${this.posts.length} 篇文章`);
  }

  generateExcerpt(content, maxLength = 200) {
    // 移除 markdown 语法，生成纯文本摘要
    const plainText = content
      .replace(/```[\s\S]*?```/g, '') // 移除代码块
      .replace(/`[^`]+`/g, '') // 移除行内代码
      .replace(/[#*_~\[\]()]/g, '') // 移除 markdown 符号
      .replace(/\n+/g, ' ') // 换行转空格
      .trim();

    return plainText.length > maxLength
      ? plainText.substring(0, maxLength) + '...'
      : plainText;
  }

  generateToc(content) {
    // 提取标题生成目录
    const headingRegex = /^(#{1,3})\s+(.+)$/gm;
    const toc = [];
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      toc.push({
        level: match[1].length,
        text: match[2],
        slug: this.slugify(match[2])
      });
    }

    return toc;
  }

  slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fa5-]/g, (match) => {
        return '';
      })
      .replace(/([a-z0-9])([\u4e00-\u9fa5])/g, '$1-$2')
      .replace(/([\u4e00-\u9fa5])([a-z0-9])/g, '$1-$2')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .trim() || 'section';
  }

  processCategoriesAndTags() {
    for (const post of this.posts) {
      // 处理分类
      for (const cat of post.categories) {
        if (!this.categories[cat]) {
          this.categories[cat] = [];
        }
        this.categories[cat].push(post);
      }

      // 处理标签
      for (const tag of post.tags) {
        if (!this.tags[tag]) {
          this.tags[tag] = [];
        }
        this.tags[tag].push(post);
      }
    }

    console.log(`📂 发现 ${Object.keys(this.categories).length} 个分类`);
    console.log(`🏷️  发现 ${Object.keys(this.tags).length} 个标签`);
  }

  async generatePages() {
    // 生成日历数据
    const currentDate = this.generateCalendarData();

    // 准备模板数据
    const templateData = {
      site: config.site,
      posts: this.posts,
      categories: this.categories,
      tags: this.tags,
      formatDate: this.formatDate,
      config: config,
      stats: {
        totalPosts: this.posts.length,
        totalTags: Object.keys(this.tags).length,
        totalCategories: Object.keys(this.categories).length
      },
      currentDate: currentDate
    };

    // 1. 生成首页
    await this.renderTemplate('index.ejs', templateData, 'index.html');

    // 2. 生成文章详情页
    for (const post of this.posts) {
      const postData = {
        ...templateData,
        post,
        currentPost: post,
        relatedPosts: this.getRelatedPosts(post)
      };
      await this.renderTemplate('post.ejs', postData, `posts/${post.slug}.html`);
    }

    // 3. 生成分类页
    for (const [category, posts] of Object.entries(this.categories)) {
      const categoryData = {
        ...templateData,
        category,
        posts,
        type: 'category'
      };
      await this.renderTemplate('category.ejs', categoryData, `categories/${this.slugify(category)}.html`);
    }

    // 4. 生成标签页
    for (const [tag, posts] of Object.entries(this.tags)) {
      const tagData = {
        ...templateData,
        tag,
        posts,
        type: 'tag'
      };
      await this.renderTemplate('category.ejs', tagData, `tags/${this.slugify(tag)}.html`);
    }

    // 5. 生成关于页面
    await this.renderTemplate('about.ejs', templateData, 'about.html');

    console.log('📝 已生成所有页面');

    // 生成分类和标签索引页面
    await this.generateIndexPages();
  }

  async generateIndexPages() {
    const publicPath = path.join(this.basePath, config.paths.public);

    // 简化版 sidebar
    const sidebarHtml = `
  <div class="widget avatar-widget">
    <div class="avatar-container">
      <img src="${config.site.avatar}" alt="头像" class="avatar-img">
      <div class="avatar-ring"></div>
    </div>
    <h3 class="avatar-name">${config.site.author}</h3>
    <p class="avatar-motto">${config.site.motto}</p>
  </div>
  <div class="widget categories-widget">
    <h3 class="widget-title">分类</h3>
    <ul class="category-list">
      ${Object.keys(this.categories).map(cat => `
      <li><a href="/categories/${this.slugify(cat)}.html"><span class="cat-name">📁 ${cat}</span><span class="cat-count">${this.categories[cat].length}</span></a></li>`).join('')}
    </ul>
  </div>
  <div class="widget tags-widget">
    <h3 class="widget-title">标签云</h3>
    <div class="tag-cloud">
      ${Object.keys(this.tags).map(tag => `<a href="/tags/${this.slugify(tag)}.html" class="tag">🏷️ ${tag}</a>`).join('')}
    </div>
  </div>`;

    // 统计挂件
    const calendarData = this.generateCalendarData();
    const statsHtml = `
  <div class="widget stats-widget">
    <h3 class="widget-title">站点统计</h3>
    <div class="stats-list">
      <div class="stats-item"><span class="stats-icon">📄</span><span class="stats-label">文章</span><span class="stats-value">${this.posts.length}</span></div>
      <div class="stats-item"><span class="stats-icon">🏷️</span><span class="stats-label">标签</span><span class="stats-value">${Object.keys(this.tags).length}</span></div>
      <div class="stats-item"><span class="stats-icon">📁</span><span class="stats-label">分类</span><span class="stats-value">${Object.keys(this.categories).length}</span></div>
    </div>
  </div>
  <div class="widget calendar-widget">
    <h3 class="widget-title">日历</h3>
    <div class="calendar-container">
      <div class="calendar-header">
        <span class="calendar-year">${calendarData.year}</span>
        <span class="calendar-month">${calendarData.monthName}</span>
      </div>
      <div class="calendar-weekdays">
        <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
      </div>
      <div class="calendar-days">
        ${calendarData.days.map(day => `<span class="${day.isToday ? 'today' : ''}">${day.date}</span>`).join('')}
      </div>
    </div>
  </div>`;

    // 头部导航（带搜索和主题切换）
    const headerHtml = `<header class="site-header">
  <div class="header-inner">
    <a href="/" class="site-logo"><span class="logo-icon">⚡</span><span class="logo-text">${config.site.title}</span></a>
    <nav class="site-nav">
      <a href="/" class="nav-link"><span class="nav-icon">🏠</span>首页</a>
      <a href="/categories/" class="nav-link"><span class="nav-icon">📂</span>分类</a>
      <a href="/tags/" class="nav-link"><span class="nav-icon">🏷️</span>标签</a>
      <a href="/about.html" class="nav-link"><span class="nav-icon">👤</span>关于</a>
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" id="searchInput" class="search-input" placeholder="搜索文章...">
        <div class="search-results" id="searchResults"></div>
      </div>
      <button class="theme-toggle" id="themeToggle" title="切换主题"><span class="theme-icon">🌙</span></button>
    </nav>
  </div>
</header>`;

    // 搜索数据
    const searchData = this.posts.map(post => ({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt.substring(0, 100),
      tags: post.tags,
      categories: post.categories
    }));

    // 搜索脚本
    const searchScript = `
  <script>
    window.searchData = ${JSON.stringify(searchData)};
  </script>`;

    // 生成分类索引页
    const categoriesHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>分类 - ${config.site.title}</title>
  <link rel="stylesheet" href="/css/style.css">
  <style>span.search-icon,span.theme-icon,span.nav-icon,span.logo-icon{font-family:"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji",sans-serif!important}</style>
  ${searchScript}
</head>
<body>
  <div class="layout">
    ${headerHtml}
    <main class="main-content home-page">
      <div class="content-wrapper">
        <aside class="sidebar">${sidebarHtml}</aside>
        <div class="posts-section">
          <h1 class="page-title">全部分类</h1>
          <div class="posts-list">
            ${Object.keys(this.categories).map(cat => `<article class="post-card"><h2 class="post-title"><a href="/categories/${this.slugify(cat)}.html">${cat}</a></h2></article>`).join('')}
          </div>
        </div>
        <aside class="home-right-sidebar">${statsHtml}</aside>
      </div>
    </main>
    <footer class="site-footer"><div class="footer-inner"><div class="footer-info"><p>&copy; ${new Date().getFullYear()} ${config.site.title}. All rights reserved.</p></div></div></footer>
  </div>
  <script src="/js/main.js"></script>
</body>
</html>`;

    await fs.ensureDir(path.join(publicPath, 'categories'));
    await fs.writeFile(path.join(publicPath, 'categories', 'index.html'), categoriesHtml, 'utf-8');

    // 生成标签索引页
    const tagsHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>标签 - ${config.site.title}</title>
  <link rel="stylesheet" href="/css/style.css">
  <style>span.search-icon,span.theme-icon,span.nav-icon,span.logo-icon{font-family:"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji",sans-serif!important}</style>
  ${searchScript}
</head>
<body>
  <div class="layout">
    ${headerHtml}
    <main class="main-content home-page">
      <div class="content-wrapper">
        <aside class="sidebar">${sidebarHtml}</aside>
        <div class="posts-section">
          <h1 class="page-title">全部标签</h1>
          <div class="posts-list">
            ${Object.keys(this.tags).map(tag => `<article class="post-card"><h2 class="post-title"><a href="/tags/${this.slugify(tag)}.html">${tag}</a></h2></article>`).join('')}
          </div>
        </div>
        <aside class="home-right-sidebar">${statsHtml}</aside>
      </div>
    </main>
    <footer class="site-footer"><div class="footer-inner"><div class="footer-info"><p>&copy; ${new Date().getFullYear()} ${config.site.title}. All rights reserved.</p></div></div></footer>
  </div>
  <script src="/js/main.js"></script>
</body>
</html>`;

    await fs.ensureDir(path.join(publicPath, 'tags'));
    await fs.writeFile(path.join(publicPath, 'tags', 'index.html'), tagsHtml, 'utf-8');

    console.log('📂 已生成分类/标签索引页');
  }

  getRelatedPosts(post, limit = 3) {
    // 基于分类和标签计算相关性
    const scores = this.posts.filter(p => p.slug !== post.slug).map(p => {
      let score = 0;

      // 相同分类 +2 分
      score += post.categories.filter(c => p.categories.includes(c)).length * 2;

      // 相同标签 +1 分
      score += post.tags.filter(t => p.tags.includes(t)).length;

      return { post: p, score };
    });

    // 按分数排序，取前 N 个
    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.post);
  }

  // 预加载 partials
  async loadPartials() {
    const partialsDir = path.join(this.basePath, config.paths.partials);
    const partials = {};

    const files = await fs.readdir(partialsDir);
    for (const file of files) {
      if (file.endsWith('.ejs')) {
        const name = file.replace('.ejs', '');
        const content = await fs.readFile(path.join(partialsDir, file), 'utf-8');
        partials[name] = content;
      }
    }

    return partials;
  }

  async renderTemplate(templateName, data, outputPath) {
    const templatePath = path.join(this.basePath, config.paths.templates, templateName);
    const outputDir = path.join(this.basePath, config.paths.public, path.dirname(outputPath));
    const outputFile = path.join(this.basePath, config.paths.public, outputPath);

    // 确保输出目录存在
    await fs.ensureDir(outputDir);

    // 读取模板内容
    let templateContent = await fs.readFile(templatePath, 'utf-8');

    // 预加载 partials 并替换 include 语句
    const partials = await this.loadPartials();

    // 替换 <%- include('partials/xxx') %> 为实际内容
    for (const [name, content] of Object.entries(partials)) {
      const includeRegex = new RegExp(`<%- include\\(['"]partials/${name}['"]\\s*\\) %>`, 'g');
      templateContent = templateContent.replace(includeRegex, content);
    }

    // 渲染模板
    const html = ejs.render(templateContent, {
      ...data,
      // 辅助函数
      _: {
        slugify: this.slugify,
        formatDate: this.formatDate.bind(this)
      }
    });

    // 写入文件
    await fs.writeFile(outputFile, html, 'utf-8');
  }

  generateCalendarData() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = now.getDate();

    const days = [];
    // 添加空白天数
    for (let i = 0; i < firstDay; i++) {
      days.push({ date: '', isToday: false });
    }
    // 添加实际天数
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: i,
        isToday: i === today
      });
    }

    return {
      year,
      monthName: monthNames[month],
      days
    };
  }

  formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async copyStatic() {
    const staticPath = path.join(this.basePath, config.paths.static);
    const publicPath = path.join(this.basePath, config.paths.public);

    if (await fs.pathExists(staticPath)) {
      await fs.copy(staticPath, publicPath);
      console.log('📦 已复制静态资源');
    }
  }
}

// 运行构建
const builder = new BlogBuilder();
builder.build();

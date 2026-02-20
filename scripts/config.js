module.exports = {
  // 站点基本信息
  site: {
    title: 'Coco_Blog',
    subtitle: '嵌入式硬件 · 软件开发 · 技术笔记',
    description: '个人嵌入式技术博客，记录学习和工作中的技术笔记',
    author: 'Coco',
    role: '嵌入式底层观察者',
    motto: '以程序为脉，以硬件为骨，记录真实的技术之路',
    github: 'https://github.com/wukekek',
    email: 'your@email.com',
    url: 'https://yourusername.github.io',
    avatar: '/images/avatar.png', // 头像 URL
    motto: '专注嵌入式技术，分享学习心得', // 个人座右铭

    // 社交链接
    social: {
      github: 'https://github.com',
      bilibili: 'https://www.bilibili.com'
    }
  },

  // 目录路径配置
  paths: {
    content: 'content',
    posts: 'content/posts',
    images: 'content/images',
    templates: 'templates',
    partials: 'templates/partials',
    static: 'static',
    public: 'public'
  },

  // 分页配置
  pagination: {
    postsPerPage: 10
  },

  // 代码高亮配置
  highlight: {
    theme: 'atom-one-dark',
    languages: ['c', 'cpp', 'asm', 'armasm', 'bash', 'python', 'javascript', 'typescript', 'json', 'makefile']
  },

  // 日期格式化
  dateFormat: {
    locale: 'zh-CN',
    format: 'YYYY-MM-DD'
  }
};

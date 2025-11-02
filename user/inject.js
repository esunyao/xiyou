// xiyou injection: Vue component control buttons
console.log('[xiyou] injection loaded');

(function() {
  // 配置：需要运行的路径
  const ALLOWED_PATHS = [
    'mock-paper',     // 模拟试卷
    'study',          // 学习页面
    'course',         // 课程页面
    'practice',       // 练习页面
    'exam',           // 考试页面
    'paperScore',     // 试卷评分页面
    'login',          // 登录页面
    'home'           // 首页
  ];
  
  // 检查是否在允许的页面
  const currentUrl = window.location.href;
  const currentHash = window.location.hash;
  
  console.log('[xiyou] Current URL:', currentUrl);
  console.log('[xiyou] Current Hash:', currentHash);
  
  // 总是在目标域名下执行基础注入
  if (!currentUrl.includes('xiyouyingyu.com')) {
    console.log('[xiyou] Not on target domain, skipping injection');
    return;
  }
  
  // 辅助函数：暂停所有媒体播放
  function pauseAllMedia() {
    // 暂停所有 video 元素
    document.querySelectorAll('video').forEach(video => {
      try {
        if (!video.paused) {
          video.pause();
          console.log('[xiyou] Paused video:', video);
        }
      } catch (e) {
        console.warn('[xiyou] Failed to pause video:', e);
      }
    });

    // 暂停所有 audio 元素
    document.querySelectorAll('audio').forEach(audio => {
      try {
        if (!audio.paused) {
          audio.pause();
          console.log('[xiyou] Paused audio:', audio);
        }
      } catch (e) {
        console.warn('[xiyou] Failed to pause audio:', e);
      }
    });

    // 暂停所有 iframe 中可能的媒体
    document.querySelectorAll('iframe').forEach(iframe => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          iframeDoc.querySelectorAll('video, audio').forEach(media => {
            try {
              if (!media.paused) {
                media.pause();
                console.log('[xiyou] Paused media in iframe:', media);
              }
            } catch (e) {
              console.warn('[xiyou] Failed to pause iframe media:', e);
            }
          });
        }
      } catch (e) {
        // 跨域 iframe 会抛出错误，这是正常的
      }
    });
  }

  // 检查是否在允许的页面
  const isAllowed = ALLOWED_PATHS.some(path => 
    currentUrl.includes(path) || currentHash.includes(path)
  );
  
  if (!isAllowed) {
    console.log('[xiyou] Not on allowed path, but on target domain - proceeding with basic injection');
  } else {
    console.log('[xiyou] On allowed path - proceeding with full injection');
  }
  
  console.log('[xiyou] Path check passed, continuing with injection...');

  // 检查按钮是否已存在，避免重复创建
  const existingButtons = document.querySelectorAll('[data-xiyou-control]');
  if (existingButtons.length > 0) {
    console.log('[xiyou] Control buttons already exist, skipping initialization...');
    return;
  }

  // 使用 MutationObserver 持续监听目标元素
  let targetElement = null;
  let vueInstance = null;
  
  function findAndSetupElement() {
    // 如果已经找到并设置了，就不重复处理
    if (vueInstance && document.querySelectorAll('[data-xiyou-control]').length > 0) {
      return;
    }
    
    // 查找目标元素
    const element = document.querySelector('div[data-v-6abbda0b].bar-right');
    if (!element) {
      return;
    }
    
    // 如果元素已存在但还没创建按钮，尝试获取 Vue 实例
    if (element !== targetElement) {
      targetElement = element;
      
      // 立即尝试获取 Vue 实例
      const instance = getVueInstance(element);
      if (instance && instance !== vueInstance) {
        vueInstance = instance;
        console.log('[xiyou] Target element and Vue instance found');
        createControlButtons(instance);
      } else {
        // 如果 Vue 实例还没绑定，监听元素的属性变化
        // 一旦 __vue__ 属性出现，MutationObserver 会再次触发
        console.log('[xiyou] Target element found but Vue instance not ready yet, waiting...');
      }
    }
  }
  
  // 启动 DOM 监听器（纯事件驱动，零轮询）
  function startObserver() {
    const observer = new MutationObserver((mutations) => {
      // 只在有 DOM 变化时检查
      findAndSetupElement();
    });
    
    // 监听 DOM 结构变化（这是我们能通过 MutationObserver 捕获的唯一事件）
    observer.observe(document.documentElement, {
      childList: true,      // 监听子节点的添加或删除
      subtree: true,        // 监听所有后代节点
      attributes: true,     // 监听属性变化（data-v-*, class 等）
      attributeFilter: ['class', 'data-v-6abbda0b'], // 优化性能：只监听关键属性
      characterData: true,  // 监听文本变化
      attributeOldValue: false // 不需要旧值，提升性能
    });
    
    // 立即检查一次
    findAndSetupElement();
    
    return observer;
  }
  
  let domObserver = null;

  // 获取 Vue 实例
  function getVueInstance(element) {
    // Vue 2
    if (element.__vue__) {
      return element.__vue__;
    }

    // Vue 3 或向上查找
    let current = element;
    while (current) {
      if (current.__vue__) {
        return current.__vue__;
      }
      // 检查是否是 Vue 组件根节点（有 data-v-* 属性）
      const hasDataV = Array.from(current.attributes || []).some(attr => 
        attr.name.startsWith('data-v-')
      );
      if (hasDataV && current.__vue__) {
        return current.__vue__;
      }
      current = current.parentElement;
      if (!current || current === document.body) break;
    }
    return null;
  }

  // 创建控制按钮
  function createControlButtons(vueInstance) {
    // 检查是否已存在按钮
    const existing = document.querySelectorAll('[data-xiyou-control]');
    if (existing.length > 0) {
      console.log('[xiyou] Buttons already exist, skipping...');
      return;
    }

    // 辅助：更激进地查找持有 audioTime 的实例（支持 Vue2/Vue3/全局）
    function resolveVueInstance() {
      try {
        // 1) 常规查找：从已知容器向上查找 __vue__ 或 __vueParentComponent
        const seed = document.querySelector('div[data-v-6abbda0b].bar-right') || document.body;
        const elements = seed ? Array.from(seed.querySelectorAll('*')) : Array.from(document.querySelectorAll('*'));

        for (const el of elements) {
          // Vue 2
          const v2 = el.__vue__;
          if (v2) {
            // 检查多种位置
            if ('audioTime' in v2) return {inst: v2, foundOn: el};
            if (v2.$data && 'audioTime' in v2.$data) return {inst: v2, foundOn: el};
            if (v2.$props && 'audioTime' in v2.$props) return {inst: v2, foundOn: el};
          }

          // Vue 3
          const parentComp = el.__vueParentComponent;
          if (parentComp && parentComp.proxy) {
            const proxy = parentComp.proxy;
            if ('audioTime' in proxy) return {inst: proxy, foundOn: el};
            if (proxy.$ && proxy.$data && 'audioTime' in proxy.$data) return {inst: proxy, foundOn: el};
          }
        }

        // 2) 全局或 window 上查找常见变量名
        const candidates = ['audioTime','AudioTime','audio_time','audioTimer','audioCurrentTime'];
        for (const name of candidates) {
          if (name in window) return {inst: window, foundOn: window};
        }

        // 3) 广泛扫描所有 DOM 节点（在极端情况下）
        const all = document.querySelectorAll('*');
        for (const el of all) {
          const v2 = el.__vue__;
          if (v2) {
            if ('audioTime' in v2) return {inst: v2, foundOn: el};
            if (v2.$data && 'audioTime' in v2.$data) return {inst: v2, foundOn: el};
          }
          const parentComp = el.__vueParentComponent;
          if (parentComp && parentComp.proxy) {
            const proxy = parentComp.proxy;
            if ('audioTime' in proxy) return {inst: proxy, foundOn: el};
          }
        }
      } catch (e) {
        console.warn('[xiyou] resolveVueInstance error', e);
      }
      return null;
    }

    // 优先尝试直接定位目标元素并使用其 Vue 实例（依据你提供的参考）
    function getTargetVue() {
      try {
        const targetElement = document.querySelector('div[data-v-6abbda0b].bar-right') || document.querySelector('div[data-v-6abbda0b].mock-paper') || document.querySelector('[data-v-6abbda0b]');
        if (!targetElement) return null;
        // 直接返回 Vue2 实例
        if (targetElement.__vue__) return targetElement.__vue__;
        // 或者向上查找父级的 __vue__
        let p = targetElement.parentElement;
        while (p) {
          if (p.__vue__) return p.__vue__;
          p = p.parentElement;
        }
      } catch (e) {
        console.warn('[xiyou] getTargetVue error', e);
      }
      return null;
    }

    // 创建按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.setAttribute('data-xiyou-control', 'container');
    buttonContainer.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      display: flex;
      gap: 10px;
      background: rgba(0, 0, 0, 0.6);
      padding: 10px;
      border-radius: 8px;
      pointer-events: auto;
    `;

    // 创建"下一步"按钮
    const buttonNext = document.createElement('button');
    buttonNext.textContent = '下一步';
    buttonNext.setAttribute('data-xiyou-control', 'next');
    buttonNext.style.cssText = `
      padding: 8px 16px;
      font-size: 14px;
      cursor: pointer;
      background: #4caf50;
      color: white;
      border: none;
      border-radius: 4px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      font-weight: bold;
      pointer-events: auto;
    `;
    buttonNext.title = '跳到下一步';

    function setAudioLike(inst, value) {
      try {
        const containers = [];
        if (inst == null) return false;
        containers.push(inst);
        if (inst.$data) containers.push(inst.$data);
        if (inst.$props) containers.push(inst.$props);
        if (inst.proxy) containers.push(inst.proxy);

        const nameRegex = /(audio|time|current|play|progress)/i;
        for (const c of containers) {
          for (const key of Object.keys(c)) {
            if (nameRegex.test(key) && typeof c[key] === 'number') {
              const prev = c[key];
              try { c[key] = value; } catch (e) { continue; }
              console.log('[xiyou] fallback set', key, 'from', prev, 'to', value, 'on', c);
              return true;
            }
          }
        }
      } catch (e) {
        console.warn('[xiyou] setAudioLike error', e);
      }
      return false;
    }

    buttonNext.addEventListener('click', function (ev) {
      console.log('[xiyou] 下一步 按钮被点击', ev);
  // 优先使用显式目标实例（更可靠），其次使用之前的解析策略
  const target = getTargetVue();
  let resolved = resolveVueInstance();
  let inst = target || vueInstance || (resolved && resolved.inst) || null;
      if (resolved && resolved.foundOn) console.log('[xiyou] 下一步 resolved on element:', resolved.foundOn);
  if (target) console.log('[xiyou] 下一步 target vue instance found via getTargetVue()', target);
      if (inst) {
        try {
          // 支持设在不同位置：实例自身或 $data
          if ('audioTime' in inst) {
            const previousValue = inst.audioTime;
            inst.audioTime = 0;
            console.log('[xiyou] audioTime set to 0. Previous value:', previousValue);
          } else if (inst.$data && 'audioTime' in inst.$data) {
            const previousValue = inst.$data.audioTime;
            inst.$data.audioTime = 0;
            console.log('[xiyou] $data.audioTime set to 0. Previous value:', previousValue);
          } else {
            console.warn('[xiyou] 找到实例但没有 audioTime 属性, 尝试 fallback 设置', inst);
            const ok = setAudioLike(inst, 0);
            if (!ok) {
              // 打印一些可用键帮助调试
              try {
                console.log('[xiyou] 实例 keys:', Object.keys(inst));
                if (inst.$data) console.log('[xiyou] 实例 $data keys:', Object.keys(inst.$data));
                if (inst.$props) console.log('[xiyou] 实例 $props keys:', Object.keys(inst.$props));
              } catch (e) {}
            }
          }
        } catch (err) {
          console.error('[xiyou] 设置 audioTime 为 0 出错', err, inst);
        }
      } else {
        console.warn('[xiyou] Vue instance / audioTime not found on 下一步 click');
      }
      // 点击视觉反馈
      buttonNext.style.filter = 'brightness(0.9)';
      setTimeout(() => buttonNext.style.filter = '', 150);
    });

    // 创建"暂停"按钮
    const buttonPause = document.createElement('button');
    buttonPause.textContent = '暂停';
    buttonPause.setAttribute('data-xiyou-control', 'pause');
    buttonPause.style.cssText = `
      padding: 8px 16px;
      font-size: 14px;
      cursor: pointer;
      background: #2196f3;
      color: white;
      border: none;
      border-radius: 4px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      font-weight: bold;
      pointer-events: auto;
    `;
    buttonPause.title = '暂停当前步骤';

    buttonPause.addEventListener('click', function (ev) {
      console.log('[xiyou] 暂停 按钮被点击', ev);
  const target = getTargetVue();
  let resolved = resolveVueInstance();
  let inst = target || vueInstance || (resolved && resolved.inst) || null;
  if (resolved && resolved.foundOn) console.log('[xiyou] 暂停 resolved on element:', resolved.foundOn);
  if (target) console.log('[xiyou] 暂停 target vue instance found via getTargetVue()', target);
      if (inst) {
        try {
          if ('audioTime' in inst) {
            const previousValue = inst.audioTime;
            inst.audioTime = 10000;
            console.log('[xiyou] audioTime set to 10000. Previous value:', previousValue);
          } else if (inst.$data && 'audioTime' in inst.$data) {
            const previousValue = inst.$data.audioTime;
            inst.$data.audioTime = 10000;
            console.log('[xiyou] $data.audioTime set to 10000. Previous value:', previousValue);
          } else {
            console.warn('[xiyou] 找到实例但没有 audioTime 属性, 尝试 fallback 设置', inst);
            const ok = setAudioLike(inst, 10000);
            if (!ok) {
              try {
                console.log('[xiyou] 实例 keys:', Object.keys(inst));
                if (inst.$data) console.log('[xiyou] 实例 $data keys:', Object.keys(inst.$data));
                if (inst.$props) console.log('[xiyou] 实例 $props keys:', Object.keys(inst.$props));
              } catch (e) {}
            }
          }
        } catch (err) {
          console.error('[xiyou] 设置 audioTime 为 10000 出错', err, inst);
        }
      } else {
        console.warn('[xiyou] Vue instance / audioTime not found on 暂停 click');
      }
      // 点击视觉反馈
      buttonPause.style.filter = 'brightness(0.9)';
      setTimeout(() => buttonPause.style.filter = '', 150);
    });

    // 添加按钮到容器
    buttonContainer.appendChild(buttonNext);
    buttonContainer.appendChild(buttonPause);
    
    // 添加容器到页面
    document.body.appendChild(buttonContainer);
    console.log('[xiyou] Control buttons created successfully.');
  }

  // 主函数：初始化观察器
  function init() {
    console.log('[xiyou] Starting element observer...');
    
    // 如果已经有观察器在运行，先断开
    if (domObserver) {
      domObserver.disconnect();
    }
    
    // 重置状态
    targetElement = null;
    vueInstance = null;
    
    // 移除可能存在的旧按钮
    const existingButtons = document.querySelectorAll('[data-xiyou-control]');
    existingButtons.forEach(btn => btn.remove());
    
    // 启动新的观察器
    domObserver = startObserver();
  }

  // 如果 DOM 已加载完成，直接执行；否则等待
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
    });
  } else {
    init();
  }

  // 监听页面导航（对于 SPA，特别是 hash 路由）
  let lastUrl = window.location.href;
  let lastHash = window.location.hash;
  
  function checkNavigation() {
    const currentUrl = window.location.href;
    const currentHash = window.location.hash;
    if (currentUrl !== lastUrl || currentHash !== lastHash) {
      lastUrl = currentUrl;
      lastHash = currentHash;
      console.log('[xiyou] Navigation detected, reinitializing observer');
      // 重新初始化观察器（MutationObserver 会立即捕获 DOM 变化）
      init();
    }
  }
  
  // 监听 hash 变化和 URL 变化
  window.addEventListener('hashchange', checkNavigation);
  window.addEventListener('popstate', checkNavigation);
})();


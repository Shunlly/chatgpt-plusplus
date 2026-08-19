/**
 * 会话删除 Tweak
 * 为会话列表中的每个会话添加删除按钮、右键菜单、自定义确认对话框等
 */

// 全局状态
const state = {
  observer: null,
  intersectionObserver: null,
  contextMenuListener: null,
  animationTheme: 'slide', // 默认动画主题: slide, fade, scale, flip
  processedItems: new WeakSet(),
};

export default {
  async start(api) {
    api.log.info('会话删除 tweak 已启动');

    // 加载用户设置
    state.animationTheme = api.storage.get('deleteAnimationTheme', 'slide');

    // 注入样式
    injectStyles();

    // 等待 React 就绪
    await new Promise(resolve => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
      } else {
        resolve();
      }
    });

    // 等待一下让页面完全加载
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 使用 IntersectionObserver 实现性能优化
    state.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          processConversationItem(entry.target, api);
        }
      });
    }, {
      root: null,
      rootMargin: '50px',
      threshold: 0.1,
    });

    // 监听 DOM 变化
    state.observer = new MutationObserver((mutations) => {
      observeNewConversationItems(api);
    });

    // 开始观察整个文档
    state.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 添加右键菜单监听
    state.contextMenuListener = (e) => handleContextMenu(e, api);
    document.addEventListener('contextmenu', state.contextMenuListener);

    // 初始处理
    observeNewConversationItems(api);

    api.log.info('会话删除 tweak 初始化完成');

    // 注册设置页面
    if (api.settings) {
      api.settings.register({
        id: 'conversation-delete-settings',
        title: '删除动画主题',
        description: '选择删除会话时的动画效果',
        render: (root) => {
          root.innerHTML = `
            <div style="padding: 16px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 500;">动画主题</label>
              <select id="animation-theme-select" style="padding: 8px; border-radius: 6px; border: 1px solid #ccc; width: 100%;">
                <option value="slide" ${state.animationTheme === 'slide' ? 'selected' : ''}>滑出</option>
                <option value="fade" ${state.animationTheme === 'fade' ? 'selected' : ''}>淡出</option>
                <option value="scale" ${state.animationTheme === 'scale' ? 'selected' : ''}>缩放</option>
                <option value="flip" ${state.animationTheme === 'flip' ? 'selected' : ''}>翻转</option>
              </select>
            </div>
          `;

          const select = root.querySelector('#animation-theme-select');
          select.addEventListener('change', (e) => {
            state.animationTheme = e.target.value;
            api.storage.set('deleteAnimationTheme', e.target.value);
            api.log.info(`动画主题已更改为: ${e.target.value}`);
          });
        },
      });
    }

    // 返回清理函数
    return () => {
      if (state.observer) state.observer.disconnect();
      if (state.intersectionObserver) state.intersectionObserver.disconnect();
      if (state.contextMenuListener) {
        document.removeEventListener('contextmenu', state.contextMenuListener);
      }
      document.querySelectorAll('[data-conversation-delete-btn]').forEach(btn => btn.remove());
      document.querySelectorAll('[data-conversation-delete-modal]').forEach(modal => modal.remove());
      document.querySelectorAll('[data-conversation-context-menu]').forEach(menu => menu.remove());
      const style = document.querySelector('#conversation-delete-styles');
      if (style) style.remove();
    };
  },

  stop() {
    // 清理工作已在返回的清理函数中处理
  }
};

/**
 * 注入全局样式
 */
function injectStyles() {
  if (document.querySelector('#conversation-delete-styles')) return;

  const style = document.createElement('style');
  style.id = 'conversation-delete-styles';
  style.textContent = `
    /* 自定义确认对话框 */
    .conversation-delete-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: modalFadeIn 0.2s ease-out;
    }

    @keyframes modalFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .conversation-delete-modal-content {
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: modalSlideIn 0.3s ease-out;
    }

    @media (prefers-color-scheme: dark) {
      .conversation-delete-modal-content {
        background: #2d2d2d;
        color: #e0e0e0;
      }
    }

    @keyframes modalSlideIn {
      from {
        transform: scale(0.9) translateY(-20px);
        opacity: 0;
      }
      to {
        transform: scale(1) translateY(0);
        opacity: 1;
      }
    }

    .conversation-delete-modal-header {
      display: flex;
      align-items: center;
      margin-bottom: 16px;
    }

    .conversation-delete-modal-icon {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #ff3b30 0%, #ff6b6b 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 16px;
      flex-shrink: 0;
    }

    .conversation-delete-modal-title {
      font-size: 20px;
      font-weight: 600;
      margin: 0;
    }

    .conversation-delete-modal-body {
      margin-bottom: 20px;
      line-height: 1.5;
      color: #666;
    }

    @media (prefers-color-scheme: dark) {
      .conversation-delete-modal-body {
        color: #a0a0a0;
      }
    }

    .conversation-delete-modal-info {
      background: #f5f5f5;
      border-radius: 8px;
      padding: 12px;
      margin-top: 12px;
      font-size: 14px;
    }

    @media (prefers-color-scheme: dark) {
      .conversation-delete-modal-info {
        background: #3d3d3d;
      }
    }

    .conversation-delete-modal-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .conversation-delete-modal-btn {
      padding: 10px 20px;
      border-radius: 8px;
      border: none;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .conversation-delete-modal-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .conversation-delete-modal-btn:active {
      transform: translateY(0);
    }

    .conversation-delete-modal-btn-cancel {
      background: #f0f0f0;
      color: #333;
    }

    @media (prefers-color-scheme: dark) {
      .conversation-delete-modal-btn-cancel {
        background: #4d4d4d;
        color: #e0e0e0;
      }
    }

    .conversation-delete-modal-btn-cancel:hover {
      background: #e0e0e0;
    }

    @media (prefers-color-scheme: dark) {
      .conversation-delete-modal-btn-cancel:hover {
        background: #5d5d5d;
      }
    }

    .conversation-delete-modal-btn-delete {
      background: linear-gradient(135deg, #ff3b30 0%, #ff6b6b 100%);
      color: white;
    }

    .conversation-delete-modal-btn-delete:hover {
      background: linear-gradient(135deg, #ff2d21 0%, #ff5555 100%);
    }

    .conversation-delete-modal-btn-delete.loading {
      position: relative;
      color: transparent;
      pointer-events: none;
    }

    .conversation-delete-modal-btn-delete.loading::after {
      content: '';
      position: absolute;
      width: 16px;
      height: 16px;
      top: 50%;
      left: 50%;
      margin-left: -8px;
      margin-top: -8px;
      border: 2px solid white;
      border-radius: 50%;
      border-top-color: transparent;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* 右键菜单 */
    .conversation-context-menu {
      position: fixed;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      padding: 4px 0;
      min-width: 180px;
      z-index: 10000;
      animation: menuFadeIn 0.15s ease-out;
    }

    @media (prefers-color-scheme: dark) {
      .conversation-context-menu {
        background: #2d2d2d;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      }
    }

    @keyframes menuFadeIn {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    .conversation-context-menu-item {
      padding: 10px 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: background 0.15s;
      font-size: 14px;
    }

    .conversation-context-menu-item:hover {
      background: #f5f5f5;
    }

    @media (prefers-color-scheme: dark) {
      .conversation-context-menu-item:hover {
        background: #3d3d3d;
      }
    }

    .conversation-context-menu-item.danger {
      color: #ff3b30;
    }

    .conversation-context-menu-item svg {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    /* 删除动画 */
    .deleting-slide {
      animation: deleteSlide 0.4s ease-out forwards;
    }

    @keyframes deleteSlide {
      0% {
        opacity: 1;
        transform: translateX(0);
      }
      50% {
        opacity: 0.5;
        transform: translateX(-30px);
      }
      100% {
        opacity: 0;
        transform: translateX(-100%);
        max-height: 0;
        margin: 0;
        padding: 0;
        overflow: hidden;
      }
    }

    .deleting-fade {
      animation: deleteFade 0.4s ease-out forwards;
    }

    @keyframes deleteFade {
      0% {
        opacity: 1;
      }
      100% {
        opacity: 0;
        max-height: 0;
        margin: 0;
        padding: 0;
        overflow: hidden;
      }
    }

    .deleting-scale {
      animation: deleteScale 0.4s ease-out forwards;
    }

    @keyframes deleteScale {
      0% {
        opacity: 1;
        transform: scale(1);
      }
      50% {
        opacity: 0.5;
        transform: scale(0.8);
      }
      100% {
        opacity: 0;
        transform: scale(0);
        max-height: 0;
        margin: 0;
        padding: 0;
        overflow: hidden;
      }
    }

    .deleting-flip {
      animation: deleteFlip 0.5s ease-out forwards;
    }

    @keyframes deleteFlip {
      0% {
        opacity: 1;
        transform: rotateY(0deg);
      }
      50% {
        opacity: 0.5;
        transform: rotateY(90deg);
      }
      100% {
        opacity: 0;
        transform: rotateY(180deg);
        max-height: 0;
        margin: 0;
        padding: 0;
        overflow: hidden;
      }
    }

    /* 删除成功动画 */
    @keyframes successPulse {
      0% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.1);
      }
      100% {
        transform: scale(1);
      }
    }
  `;
  document.head.appendChild(style);
}

/**
 * 观察新的会话列表项（性能优化版）
 */
function observeNewConversationItems(api) {
  const conversationItems = findConversationItems();

  conversationItems.forEach(item => {
    // 使用 WeakSet 避免重复处理
    if (!state.processedItems.has(item)) {
      state.processedItems.add(item);
      // 使用 IntersectionObserver 延迟处理不可见的项
      if (state.intersectionObserver) {
        state.intersectionObserver.observe(item);
      }
    }
  });
}

/**
 * 处理单个会话项
 */
function processConversationItem(item, api) {
  // 如果已经添加过删除按钮，跳过
  if (item.querySelector('[data-conversation-delete-btn]')) {
    return;
  }

  // 添加删除按钮
  addDeleteButton(item, api);
}

/**
 * 查找会话列表项
 */
function findConversationItems() {
  const items = [];
  const selectors = [
    'nav a[href^="/c/"]',
    'nav li > a',
    '[data-testid^="conversation"]',
    'nav ol > li',
  ];

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      items.push(...elements);
      break;
    }
  }

  return items;
}

/**
 * 处理右键菜单
 */
function handleContextMenu(e, api) {
  const existingMenu = document.querySelector('[data-conversation-context-menu]');
  if (existingMenu) {
    existingMenu.remove();
  }

  const conversationItem = e.target.closest('a[href^="/c/"], nav li > a');
  if (!conversationItem) return;

  const conversationId = getConversationId(conversationItem);
  if (!conversationId) return;

  e.preventDefault();
  e.stopPropagation();

  const menu = document.createElement('div');
  menu.className = 'conversation-context-menu';
  menu.setAttribute('data-conversation-context-menu', 'true');
  menu.style.left = `${e.pageX}px`;
  menu.style.top = `${e.pageY}px`;

  menu.innerHTML = `
    <div class="conversation-context-menu-item danger" data-action="delete">
      <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 2H10M2 4H14M12.6667 4L12.1991 11.0129C12.129 12.065 12.0939 12.5911 11.8667 12.99C11.6666 13.3412 11.3648 13.6235 11.0011 13.7998C10.588 14 10.0607 14 9.00623 14H6.99377C5.93927 14 5.41202 14 4.99889 13.7998C4.63517 13.6235 4.33339 13.3412 4.13332 12.99C3.90607 12.5911 3.871 12.065 3.80086 11.0129L3.33333 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>删除会话</span>
    </div>
  `;

  document.body.appendChild(menu);

  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    menu.style.left = `${e.pageX - rect.width}px`;
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = `${e.pageY - rect.height}px`;
  }

  menu.querySelector('[data-action="delete"]').addEventListener('click', async () => {
    menu.remove();
    await showDeleteConfirmModal(conversationItem, conversationId, api);
  });

  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => {
    document.addEventListener('click', closeMenu);
  }, 0);
}

/**
 * 显示自定义删除确认对话框
 */
async function showDeleteConfirmModal(item, conversationId, api) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'conversation-delete-modal';
    modal.setAttribute('data-conversation-delete-modal', 'true');

    const conversationTitle = item.textContent?.trim() || '未命名会话';

    modal.innerHTML = `
      <div class="conversation-delete-modal-content">
        <div class="conversation-delete-modal-header">
          <div class="conversation-delete-modal-icon">
            <svg width="24" height="24" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 2H10M2 4H14M12.6667 4L12.1991 11.0129C12.129 12.065 12.0939 12.5911 11.8667 12.99C11.6666 13.3412 11.3648 13.6235 11.0011 13.7998C10.588 14 10.0607 14 9.00623 14H6.99377C5.93927 14 5.41202 14 4.99889 13.7998C4.63517 13.6235 4.33339 13.3412 4.13332 12.99C3.90607 12.5911 3.871 12.065 3.80086 11.0129L3.33333 4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h2 class="conversation-delete-modal-title">删除会话</h2>
        </div>
        <div class="conversation-delete-modal-body">
          <p>确定要删除这个会话吗？此操作无法撤销。</p>
          <div class="conversation-delete-modal-info">
            <strong>会话：</strong>${escapeHtml(conversationTitle.substring(0, 50))}${conversationTitle.length > 50 ? '...' : ''}
          </div>
        </div>
        <div class="conversation-delete-modal-actions">
          <button class="conversation-delete-modal-btn conversation-delete-modal-btn-cancel">取消</button>
          <button class="conversation-delete-modal-btn conversation-delete-modal-btn-delete">删除</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const cancelBtn = modal.querySelector('.conversation-delete-modal-btn-cancel');
    const deleteBtn = modal.querySelector('.conversation-delete-modal-btn-delete');

    cancelBtn.addEventListener('click', () => {
      modal.remove();
      resolve(false);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        resolve(false);
      }
    });

    deleteBtn.addEventListener('click', async () => {
      deleteBtn.classList.add('loading');
      deleteBtn.disabled = true;
      cancelBtn.disabled = true;

      try {
        await deleteConversation(item, conversationId, api);

        const icon = modal.querySelector('.conversation-delete-modal-icon');
        icon.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 6L9 17L4 12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
        icon.style.background = 'linear-gradient(135deg, #34c759 0%, #30d158 100%)';
        icon.style.animation = 'successPulse 0.4s ease-out';

        setTimeout(() => {
          modal.remove();
          resolve(true);
        }, 800);

        api.log.info(`已删除会话: ${conversationId}`);
      } catch (error) {
        deleteBtn.classList.remove('loading');
        deleteBtn.disabled = false;
        cancelBtn.disabled = false;

        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'color: #ff3b30; font-size: 14px; margin-top: 12px; text-align: center;';
        errorDiv.textContent = '删除失败，请稍后重试';
        modal.querySelector('.conversation-delete-modal-body').appendChild(errorDiv);

        api.log.error('删除会话失败:', error);

        setTimeout(() => {
          errorDiv.remove();
        }, 3000);
      }
    });

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        resolve(false);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  });
}

/**
 * HTML 转义
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 为会话项添加删除按钮
 */
function addDeleteButton(item, api) {
  const deleteBtn = document.createElement('button');
  deleteBtn.setAttribute('data-conversation-delete-btn', 'true');
  deleteBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 2H10M2 4H14M12.6667 4L12.1991 11.0129C12.129 12.065 12.0939 12.5911 11.8667 12.99C11.6666 13.3412 11.3648 13.6235 11.0011 13.7998C10.588 14 10.0607 14 9.00623 14H6.99377C5.93927 14 5.41202 14 4.99889 13.7998C4.63517 13.6235 4.33339 13.3412 4.13332 12.99C3.90607 12.5911 3.871 12.065 3.80086 11.0129L3.33333 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;

  deleteBtn.style.cssText = `
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    opacity: 0;
    transition: opacity 0.2s, background-color 0.2s;
    color: currentColor;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  `;

  deleteBtn.addEventListener('mouseenter', () => {
    deleteBtn.style.backgroundColor = 'rgba(255, 59, 48, 0.1)';
    deleteBtn.style.color = '#ff3b30';
  });

  deleteBtn.addEventListener('mouseleave', () => {
    deleteBtn.style.backgroundColor = 'transparent';
    deleteBtn.style.color = 'currentColor';
  });

  deleteBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const conversationId = getConversationId(item);
    if (!conversationId) {
      api.log.warn('无法获取会话 ID');
      return;
    }

    await showDeleteConfirmModal(item, conversationId, api);
  });

  if (item.style.position !== 'relative' && item.style.position !== 'absolute') {
    item.style.position = 'relative';
  }

  item.addEventListener('mouseenter', () => {
    deleteBtn.style.opacity = '1';
  });

  item.addEventListener('mouseleave', () => {
    deleteBtn.style.opacity = '0';
  });

  item.appendChild(deleteBtn);
}

/**
 * 从会话项中提取会话 ID
 */
function getConversationId(item) {
  const href = item.getAttribute('href');
  if (href) {
    const match = href.match(/\/c\/([a-f0-9-]+)/);
    if (match) return match[1];
  }

  const dataId = item.getAttribute('data-conversation-id');
  if (dataId) return dataId;

  const link = item.querySelector('a[href^="/c/"]');
  if (link) {
    const match = link.getAttribute('href').match(/\/c\/([a-f0-9-]+)/);
    if (match) return match[1];
  }

  return null;
}

/**
 * 删除会话（带动画效果）
 */
async function deleteConversation(item, conversationId, api) {
  const container = item.closest('li') || item.parentElement;

  if (api.react) {
    const fiber = api.react.getFiber(item);
    if (fiber) {
      const deleteHandler = findDeleteHandler(fiber);
      if (deleteHandler) {
        try {
          await deleteHandler(conversationId);
          playDeleteAnimation(container);
          return;
        } catch (e) {
          api.log.warn('React Fiber 删除失败，尝试 API 方式:', e);
        }
      }
    }
  }

  await deleteConversationViaApi(conversationId, api);
  playDeleteAnimation(container);
}

/**
 * 播放删除动画
 */
function playDeleteAnimation(element) {
  if (!element) return;

  const animationClass = `deleting-${state.animationTheme}`;
  element.style.overflow = 'hidden';
  element.classList.add(animationClass);

  const duration = state.animationTheme === 'flip' ? 500 : 400;
  setTimeout(() => {
    element.remove();
  }, duration);
}

/**
 * 在 React Fiber 树中查找删除处理函数
 */
function findDeleteHandler(fiber) {
  let current = fiber;
  let depth = 0;
  const maxDepth = 20;

  while (current && depth < maxDepth) {
    const props = current.memoizedProps;
    if (props) {
      for (const key of Object.keys(props)) {
        if (typeof props[key] === 'function' &&
            (key.toLowerCase().includes('delete') ||
             key.toLowerCase().includes('remove') ||
             key.toLowerCase().includes('archive'))) {
          return props[key];
        }
      }
    }

    const state = current.memoizedState;
    if (state && typeof state === 'object') {
      for (const key of Object.keys(state)) {
        if (typeof state[key] === 'function' &&
            (key.toLowerCase().includes('delete') ||
             key.toLowerCase().includes('remove'))) {
          return state[key];
        }
      }
    }

    current = current.return;
    depth++;
  }

  return null;
}

/**
 * 通过 API 删除会话（备用方案）
 */
async function deleteConversationViaApi(conversationId, api) {
  const response = await fetch(`https://chatgpt.com/backend-api/conversation/${conversationId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      is_visible: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`API 请求失败: ${response.status}`);
  }
}

/**
 * 会话删除 Tweak
 * 为会话列表中的每个会话添加删除按钮
 */

export default {
  async start(api) {
    api.log.info('会话删除 tweak 已启动');

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

    // 监听 DOM 变化，为会话项添加删除按钮
    const observer = new MutationObserver((mutations) => {
      processConversationItems(api);
    });

    // 开始观察整个文档
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 初始处理
    processConversationItems(api);

    api.log.info('会话删除 tweak 初始化完成');

    // 返回清理函数
    return () => {
      observer.disconnect();
      // 移除所有添加的删除按钮
      document.querySelectorAll('[data-conversation-delete-btn]').forEach(btn => btn.remove());
    };
  },

  stop() {
    // 清理工作
  }
};

/**
 * 处理会话列表项，添加删除按钮
 */
function processConversationItems(api) {
  // 查找所有会话列表项
  // ChatGPT 的会话列表项通常在侧边栏中，需要找到正确的选择器
  const conversationItems = findConversationItems();

  conversationItems.forEach(item => {
    // 如果已经添加过删除按钮，跳过
    if (item.querySelector('[data-conversation-delete-btn]')) {
      return;
    }

    // 添加删除按钮
    addDeleteButton(item, api);
  });
}

/**
 * 查找会话列表项
 * 需要根据实际的 DOM 结构调整选择器
 */
function findConversationItems() {
  const items = [];

  // 尝试多种可能的选择器
  // ChatGPT 的会话列表项可能在导航栏中
  const selectors = [
    'nav a[href^="/c/"]',  // 会话链接
    'nav li > a',  // 导航列表项
    '[data-testid^="conversation"]',  // 可能的 testid
    'nav ol > li',  // 有序列表项
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
 * 为会话项添加删除按钮
 */
function addDeleteButton(item, api) {
  // 创建删除按钮
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

    // 获取会话 ID
    const conversationId = getConversationId(item);
    if (!conversationId) {
      api.log.warn('无法获取会话 ID');
      return;
    }

    // 确认删除
    if (!confirm('确定要删除这个会话吗？此操作无法撤销。')) {
      return;
    }

    try {
      // 尝试调用删除功能
      await deleteConversation(item, conversationId, api);
      api.log.info(`已删除会话: ${conversationId}`);
    } catch (error) {
      api.log.error('删除会话失败:', error);
      alert('删除失败，请稍后重试');
    }
  });

  // 确保父元素有相对定位
  if (item.style.position !== 'relative' && item.style.position !== 'absolute') {
    item.style.position = 'relative';
  }

  // 鼠标悬停时显示删除按钮
  item.addEventListener('mouseenter', () => {
    deleteBtn.style.opacity = '1';
  });

  item.addEventListener('mouseleave', () => {
    deleteBtn.style.opacity = '0';
  });

  // 添加按钮到会话项
  item.appendChild(deleteBtn);
}

/**
 * 从会话项中提取会话 ID
 */
function getConversationId(item) {
  // 尝试从 href 中提取
  const href = item.getAttribute('href');
  if (href) {
    const match = href.match(/\/c\/([a-f0-9-]+)/);
    if (match) return match[1];
  }

  // 尝试从 data 属性中提取
  const dataId = item.getAttribute('data-conversation-id');
  if (dataId) return dataId;

  // 尝试从父元素或子元素中查找
  const link = item.querySelector('a[href^="/c/"]');
  if (link) {
    const match = link.getAttribute('href').match(/\/c\/([a-f0-9-]+)/);
    if (match) return match[1];
  }

  return null;
}

/**
 * 删除会话
 * 通过 React Fiber 找到组件并调用删除方法
 */
async function deleteConversation(item, conversationId, api) {
  // 尝试通过 React Fiber 找到删除函数
  if (api.react) {
    const fiber = api.react.getFiber(item);
    if (fiber) {
      // 尝试查找包含删除方法的父组件
      const deleteHandler = findDeleteHandler(fiber);
      if (deleteHandler) {
        await deleteHandler(conversationId);
        return;
      }
    }
  }

  // 备用方案：通过 API 调用删除
  await deleteConversationViaApi(conversationId, api);
}

/**
 * 在 React Fiber 树中查找删除处理函数
 */
function findDeleteHandler(fiber) {
  let current = fiber;
  let depth = 0;
  const maxDepth = 20;

  while (current && depth < maxDepth) {
    // 检查 props 中是否有删除相关的函数
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

    // 检查 state 中是否有删除相关的函数
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
  // 尝试通过 fetch 调用 ChatGPT 的 API
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

  // 刷新页面或移除 DOM 元素
  const item = document.querySelector(`a[href="/c/${conversationId}"]`);
  if (item) {
    const parent = item.closest('li') || item.parentElement;
    if (parent) {
      parent.style.transition = 'opacity 0.3s, transform 0.3s';
      parent.style.opacity = '0';
      parent.style.transform = 'translateX(-20px)';
      setTimeout(() => parent.remove(), 300);
    }
  }
}

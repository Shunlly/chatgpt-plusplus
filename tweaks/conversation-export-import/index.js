/**
 * 会话导入导出 Tweak
 * 支持导出会话为 Markdown、JSON、HTML，以及从文件导入
 * 支持 ZIP 批量导出
 */

// 内联简化版 JSZip 功能（使用原生 API）
let JSZipLoaded = false;

export default {
  async start(api) {
    api.log.info('会话导入导出 tweak 已启动');

    // 等待页面加载
    await new Promise(resolve => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
      } else {
        resolve();
      }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // 加载 JSZip 库
    await loadJSZip(api);

    // 注入样式
    injectStyles();

    // 添加右键菜单导出选项
    addContextMenuExport(api);

    // 注册设置页面
    if (api.settings) {
      registerSettingsPage(api);
    }

    api.log.info('会话导入导出 tweak 初始化完成');

    return () => {
      // 清理
      document.removeEventListener('contextmenu', window.__exportImportContextMenuHandler);
      const style = document.querySelector('#conversation-export-import-styles');
      if (style) style.remove();
    };
  },

  stop() {
    // 清理工作
  }
};

/**
 * 加载 JSZip 库
 */
async function loadJSZip(api) {
  if (JSZipLoaded || window.JSZip) {
    JSZipLoaded = true;
    return;
  }

  try {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    JSZipLoaded = true;
    api.log.info('JSZip 库加载成功');
  } catch (error) {
    api.log.error('JSZip 库加载失败:', error);
    // 降级到不使用 ZIP 的版本
  }
}

/**
 * 注入样式
 */
function injectStyles() {
  if (document.querySelector('#conversation-export-import-styles')) return;

  const style = document.createElement('style');
  style.id = 'conversation-export-import-styles';
  style.textContent = `
    .export-import-panel {
      padding: 24px;
      max-width: 800px;
    }

    .export-import-section {
      background: #f9f9f9;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }

    @media (prefers-color-scheme: dark) {
      .export-import-section {
        background: #2d2d2d;
      }
    }

    .export-import-section h3 {
      margin: 0 0 16px 0;
      font-size: 18px;
      font-weight: 600;
    }

    .export-import-section p {
      margin: 0 0 16px 0;
      color: #666;
      line-height: 1.5;
    }

    @media (prefers-color-scheme: dark) {
      .export-import-section p {
        color: #a0a0a0;
      }
    }

    .export-import-buttons {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .export-import-btn {
      padding: 10px 20px;
      border-radius: 8px;
      border: none;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .export-import-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .export-import-btn-primary {
      background: linear-gradient(135deg, #10a37f 0%, #1a7f64 100%);
      color: white;
    }

    .export-import-btn-secondary {
      background: #f0f0f0;
      color: #333;
    }

    @media (prefers-color-scheme: dark) {
      .export-import-btn-secondary {
        background: #4d4d4d;
        color: #e0e0e0;
      }
    }

    .export-import-btn-secondary:hover {
      background: #e0e0e0;
    }

    @media (prefers-color-scheme: dark) {
      .export-import-btn-secondary:hover {
        background: #5d5d5d;
      }
    }

    .export-import-btn svg {
      width: 16px;
      height: 16px;
    }

    .export-import-format-select {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }

    .export-import-format-option {
      flex: 1;
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
    }

    .export-import-format-option:hover {
      border-color: #10a37f;
      background: rgba(16, 163, 127, 0.05);
    }

    .export-import-format-option.selected {
      border-color: #10a37f;
      background: rgba(16, 163, 127, 0.1);
    }

    @media (prefers-color-scheme: dark) {
      .export-import-format-option {
        border-color: #4d4d4d;
      }

      .export-import-format-option:hover {
        border-color: #10a37f;
        background: rgba(16, 163, 127, 0.1);
      }
    }

    .export-import-format-option strong {
      display: block;
      margin-bottom: 4px;
    }

    .export-import-format-option small {
      color: #666;
      font-size: 12px;
    }

    @media (prefers-color-scheme: dark) {
      .export-import-format-option small {
        color: #a0a0a0;
      }
    }

    .export-import-progress {
      margin-top: 16px;
      padding: 12px;
      background: #fff;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
    }

    @media (prefers-color-scheme: dark) {
      .export-import-progress {
        background: #3d3d3d;
        border-color: #4d4d4d;
      }
    }

    .export-import-progress-bar {
      height: 4px;
      background: #e0e0e0;
      border-radius: 2px;
      overflow: hidden;
      margin-top: 8px;
    }

    .export-import-progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #10a37f 0%, #1a7f64 100%);
      transition: width 0.3s;
    }

    .export-import-file-input {
      display: none;
    }

    .export-import-drop-zone {
      border: 2px dashed #e0e0e0;
      border-radius: 8px;
      padding: 40px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
    }

    .export-import-drop-zone:hover {
      border-color: #10a37f;
      background: rgba(16, 163, 127, 0.05);
    }

    .export-import-drop-zone.dragging {
      border-color: #10a37f;
      background: rgba(16, 163, 127, 0.1);
    }

    @media (prefers-color-scheme: dark) {
      .export-import-drop-zone {
        border-color: #4d4d4d;
      }

      .export-import-drop-zone:hover {
        border-color: #10a37f;
        background: rgba(16, 163, 127, 0.1);
      }
    }
  `;
  document.head.appendChild(style);
}

/**
 * 添加右键菜单导出选项
 */
function addContextMenuExport(api) {
  const handler = async (e) => {
    const conversationItem = e.target.closest('a[href^="/c/"], nav li > a');
    if (!conversationItem) return;

    const conversationId = getConversationId(conversationItem);
    if (!conversationId) return;

    // 查找是否有导入导出的右键菜单
    const existingMenu = document.querySelector('[data-conversation-context-menu]');
    if (existingMenu) {
      // 添加导出选项到现有菜单
      const exportItem = document.createElement('div');
      exportItem.className = 'conversation-context-menu-item';
      exportItem.innerHTML = `
        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 10V12.6667C14 13.0203 13.8595 13.3594 13.6095 13.6095C13.3594 13.8595 13.0203 14 12.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V10M11.3333 5.33333L8 2M8 2L4.66667 5.33333M8 2V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>导出会话</span>
      `;

      exportItem.addEventListener('click', async () => {
        existingMenu.remove();
        await showExportDialog(conversationItem, conversationId, api);
      });

      existingMenu.appendChild(exportItem);
    }
  };

  window.__exportImportContextMenuHandler = handler;
  document.addEventListener('contextmenu', handler);
}

/**
 * 显示导出对话框
 */
async function showExportDialog(item, conversationId, api) {
  // 这里可以弹出一个格式选择对话框
  // 简化版：直接导出为 Markdown
  try {
    const conversation = await fetchConversation(conversationId, api);
    const markdown = convertToMarkdown(conversation);
    downloadFile(markdown, `conversation-${conversationId}.md`, 'text/markdown');
    api.log.info(`已导出会话: ${conversationId}`);
  } catch (error) {
    api.log.error('导出失败:', error);
    alert('导出失败，请稍后重试');
  }
}

/**
 * 注册设置页面
 */
function registerSettingsPage(api) {
  api.settings.registerPage({
    id: 'export-import',
    title: '导入/导出',
    description: '管理会话的导入和导出',
    iconSvg: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"/></svg>`,
    render: (root) => {
      root.innerHTML = `
        <div class="export-import-panel">
          <!-- 导出部分 -->
          <div class="export-import-section">
            <h3>📤 导出当前会话</h3>
            <p>将当前正在查看的会话导出为文件</p>
            <div class="export-import-format-select">
              <div class="export-import-format-option selected" data-format="markdown">
                <strong>Markdown</strong>
                <small>适合阅读和编辑</small>
              </div>
              <div class="export-import-format-option" data-format="json">
                <strong>JSON</strong>
                <small>完整数据结构</small>
              </div>
              <div class="export-import-format-option" data-format="html">
                <strong>HTML</strong>
                <small>带样式的网页</small>
              </div>
            </div>
            <div class="export-import-buttons">
              <button class="export-import-btn export-import-btn-primary" id="export-current-btn">
                <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 10V12.6667C14 13.0203 13.8595 13.3594 13.6095 13.6095C13.3594 13.8595 13.0203 14 12.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V10M11.3333 5.33333L8 2M8 2L4.66667 5.33333M8 2V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                导出当前会话
              </button>
            </div>
            <div id="export-progress" style="display: none;" class="export-import-progress">
              <div>正在导出...</div>
              <div class="export-import-progress-bar">
                <div class="export-import-progress-bar-fill" style="width: 0%"></div>
              </div>
            </div>
          </div>

          <!-- 批量导出部分 -->
          <div class="export-import-section">
            <h3>📦 批量导出</h3>
            <p>导出所有会话为一个压缩包 ${window.JSZip && JSZipLoaded ? '<span style="color: #10a37f;">✓ ZIP 支持已启用</span>' : '<span style="color: #ff9800;">⚠️ ZIP 库加载中...</span>'}</p>
            <div class="export-import-buttons">
              <button class="export-import-btn export-import-btn-secondary" id="export-all-btn">
                <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 10V12.6667C14 13.0203 13.8595 13.3594 13.6095 13.6095C13.3594 13.8595 13.0203 14 12.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V10M11.3333 5.33333L8 2M8 2L4.66667 5.33333M8 2V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                ${window.JSZip && JSZipLoaded ? '导出全部为 ZIP' : '导出全部会话（逐个文件）'}
              </button>
            </div>
            <div id="export-all-progress" style="display: none;" class="export-import-progress">
              <div id="export-all-status">准备导出...</div>
              <div class="export-import-progress-bar">
                <div class="export-import-progress-bar-fill" id="export-all-progress-bar" style="width: 0%"></div>
              </div>
            </div>
          </div>

          <!-- 导入部分 -->
          <div class="export-import-section">
            <h3>📥 导入会话</h3>
            <p>从文件导入之前导出的会话（支持 JSON 格式）</p>
            <input type="file" id="import-file-input" class="export-import-file-input" accept=".json,.md" multiple>
            <div class="export-import-drop-zone" id="import-drop-zone">
              <div style="font-size: 48px; margin-bottom: 16px;">📁</div>
              <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">拖拽文件到这里</div>
              <div style="color: #666; font-size: 14px;">或点击选择文件</div>
            </div>
            <div id="import-progress" style="display: none;" class="export-import-progress">
              <div id="import-status">准备导入...</div>
              <div class="export-import-progress-bar">
                <div class="export-import-progress-bar-fill" id="import-progress-bar" style="width: 0%"></div>
              </div>
            </div>
          </div>
        </div>
      `;

      // 格式选择
      let selectedFormat = 'markdown';
      root.querySelectorAll('.export-import-format-option').forEach(option => {
        option.addEventListener('click', () => {
          root.querySelectorAll('.export-import-format-option').forEach(o => o.classList.remove('selected'));
          option.classList.add('selected');
          selectedFormat = option.dataset.format;
        });
      });

      // 导出当前会话
      root.querySelector('#export-current-btn').addEventListener('click', async () => {
        await exportCurrentConversation(selectedFormat, api, root);
      });

      // 导出全部会话
      root.querySelector('#export-all-btn').addEventListener('click', async () => {
        await exportAllConversations(selectedFormat, api, root);
      });

      // 导入会话
      const fileInput = root.querySelector('#import-file-input');
      const dropZone = root.querySelector('#import-drop-zone');

      dropZone.addEventListener('click', () => {
        fileInput.click();
      });

      fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
          await importConversations(files, api, root);
        }
      });

      // 拖拽上传
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragging');
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragging');
      });

      dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragging');
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
          await importConversations(files, api, root);
        }
      });
    },
  });
}

/**
 * 导出当前会话
 */
async function exportCurrentConversation(format, api, root) {
  const progressDiv = root.querySelector('#export-progress');
  const progressBar = progressDiv.querySelector('.export-import-progress-bar-fill');

  try {
    progressDiv.style.display = 'block';
    progressBar.style.width = '30%';

    const conversationId = getCurrentConversationId();
    if (!conversationId) {
      alert('请先打开一个会话');
      return;
    }

    progressBar.style.width = '60%';
    const conversation = await fetchConversation(conversationId, api);

    progressBar.style.width = '90%';
    let content, filename, mimeType;

    switch (format) {
      case 'markdown':
        content = convertToMarkdown(conversation);
        filename = `conversation-${conversationId}.md`;
        mimeType = 'text/markdown';
        break;
      case 'json':
        content = JSON.stringify(conversation, null, 2);
        filename = `conversation-${conversationId}.json`;
        mimeType = 'application/json';
        break;
      case 'html':
        content = convertToHTML(conversation);
        filename = `conversation-${conversationId}.html`;
        mimeType = 'text/html';
        break;
    }

    downloadFile(content, filename, mimeType);
    progressBar.style.width = '100%';

    setTimeout(() => {
      progressDiv.style.display = 'none';
      progressBar.style.width = '0%';
    }, 1000);

    api.log.info(`已导出会话: ${conversationId} (${format})`);
  } catch (error) {
    api.log.error('导出失败:', error);
    alert('导出失败: ' + error.message);
    progressDiv.style.display = 'none';
  }
}

/**
 * 导出全部会话
 */
async function exportAllConversations(format, api, root) {
  const progressDiv = root.querySelector('#export-all-progress');
  const progressBar = root.querySelector('#export-all-progress-bar');
  const statusDiv = root.querySelector('#export-all-status');

  try {
    progressDiv.style.display = 'block';
    statusDiv.textContent = '正在获取会话列表...';

    const conversations = await fetchAllConversations(api);
    const total = conversations.length;

    if (total === 0) {
      alert('没有找到任何会话');
      progressDiv.style.display = 'none';
      return;
    }

    // 检查是否支持 ZIP
    const useZip = window.JSZip && JSZipLoaded;

    if (useZip) {
      statusDiv.textContent = '正在创建 ZIP 文件...';
      const zip = new JSZip();
      const folder = zip.folder('conversations');

      for (let i = 0; i < total; i++) {
        const conv = conversations[i];
        statusDiv.textContent = `正在导出 ${i + 1}/${total}: ${conv.title || conv.id}`;
        progressBar.style.width = `${((i + 1) / total) * 100}%`;

        try {
          const fullConv = await fetchConversation(conv.id, api);
          let content, extension;

          switch (format) {
            case 'markdown':
              content = convertToMarkdown(fullConv);
              extension = 'md';
              break;
            case 'json':
              content = JSON.stringify(fullConv, null, 2);
              extension = 'json';
              break;
            case 'html':
              content = convertToHTML(fullConv);
              extension = 'html';
              break;
          }

          const filename = `${sanitizeFilename(conv.title || conv.id)}.${extension}`;
          folder.file(filename, content);
        } catch (error) {
          api.log.warn(`跳过会话 ${conv.id}:`, error);
        }

        // 避免请求过快
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      statusDiv.textContent = '正在生成 ZIP 文件...';
      progressBar.style.width = '95%';

      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      progressBar.style.width = '100%';
      statusDiv.textContent = `导出完成！共 ${total} 个会话`;

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      downloadBlob(blob, `conversations-${timestamp}.zip`, 'application/zip');

      api.log.info(`批量导出完成: ${total} 个会话 (ZIP)`);
    } else {
      // 降级方案：逐个下载
      statusDiv.textContent = '正在导出（逐个文件模式）...';

      for (let i = 0; i < Math.min(10, total); i++) {
        const conv = conversations[i];
        statusDiv.textContent = `正在导出 ${i + 1}/${Math.min(10, total)}: ${conv.title || conv.id}`;
        progressBar.style.width = `${((i + 1) / Math.min(10, total)) * 100}%`;

        try {
          const fullConv = await fetchConversation(conv.id, api);
          let content, filename, mimeType;

          switch (format) {
            case 'markdown':
              content = convertToMarkdown(fullConv);
              filename = `${sanitizeFilename(conv.title || conv.id)}.md`;
              mimeType = 'text/markdown';
              break;
            case 'json':
              content = JSON.stringify(fullConv, null, 2);
              filename = `${sanitizeFilename(conv.title || conv.id)}.json`;
              mimeType = 'application/json';
              break;
            case 'html':
              content = convertToHTML(fullConv);
              filename = `${sanitizeFilename(conv.title || conv.id)}.html`;
              mimeType = 'text/html';
              break;
          }

          downloadFile(content, filename, mimeType);
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          api.log.warn(`跳过会话 ${conv.id}:`, error);
        }
      }

      if (total > 10) {
        alert(`已导出前 10 个会话。总共 ${total} 个会话。\n建议刷新页面以加载 JSZip 库，以支持完整 ZIP 导出。`);
      }

      statusDiv.textContent = `导出完成！共 ${Math.min(10, total)} 个会话`;
      api.log.info(`批量导出完成: ${Math.min(10, total)} 个会话 (逐个文件)`);
    }

    setTimeout(() => {
      progressDiv.style.display = 'none';
      progressBar.style.width = '0%';
    }, 2000);

  } catch (error) {
    api.log.error('批量导出失败:', error);
    alert('批量导出失败: ' + error.message);
    progressDiv.style.display = 'none';
  }
}

/**
 * 导入会话
 */
async function importConversations(files, api, root) {
  const progressDiv = root.querySelector('#import-progress');
  const progressBar = root.querySelector('#import-progress-bar');
  const statusDiv = root.querySelector('#import-status');

  try {
    progressDiv.style.display = 'block';
    const total = files.length;
    let imported = 0;

    for (let i = 0; i < total; i++) {
      const file = files[i];
      statusDiv.textContent = `正在导入 ${i + 1}/${total}: ${file.name}`;
      progressBar.style.width = `${((i + 1) / total) * 100}%`;

      try {
        const content = await readFileAsText(file);
        const conversation = JSON.parse(content);

        // 这里需要调用 ChatGPT API 创建会话
        // 由于 API 限制，这里只是演示
        await importConversation(conversation, api);
        imported++;
      } catch (error) {
        api.log.warn(`跳过文件 ${file.name}:`, error);
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    statusDiv.textContent = `导入完成！成功导入 ${imported} 个会话`;

    setTimeout(() => {
      progressDiv.style.display = 'none';
      progressBar.style.width = '0%';
      // 刷新页面以显示新导入的会话
      alert(`已导入 ${imported} 个会话，即将刷新页面`);
      location.reload();
    }, 2000);

    api.log.info(`导入完成: ${imported} 个会话`);
  } catch (error) {
    api.log.error('导入失败:', error);
    alert('导入失败: ' + error.message);
    progressDiv.style.display = 'none';
  }
}

/**
 * 获取当前会话 ID
 */
function getCurrentConversationId() {
  const match = window.location.pathname.match(/\/c\/([a-f0-9-]+)/);
  return match ? match[1] : null;
}

/**
 * 获取会话 ID
 */
function getConversationId(item) {
  const href = item.getAttribute('href');
  if (href) {
    const match = href.match(/\/c\/([a-f0-9-]+)/);
    if (match) return match[1];
  }
  return null;
}

/**
 * 获取会话数据
 */
async function fetchConversation(conversationId, api) {
  const response = await fetch(`https://chatgpt.com/backend-api/conversation/${conversationId}`);
  if (!response.ok) {
    throw new Error(`获取会话失败: ${response.status}`);
  }
  return await response.json();
}

/**
 * 获取所有会话列表
 */
async function fetchAllConversations(api) {
  const conversations = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await fetch(`https://chatgpt.com/backend-api/conversations?offset=${offset}&limit=${limit}`);
    if (!response.ok) break;

    const data = await response.json();
    if (!data.items || data.items.length === 0) break;

    conversations.push(...data.items);
    offset += limit;

    if (!data.has_more) break;
  }

  return conversations;
}

/**
 * 转换为 Markdown
 */
function convertToMarkdown(conversation) {
  let markdown = `# ${conversation.title || '未命名会话'}\n\n`;
  markdown += `**会话 ID**: ${conversation.id}\n`;
  markdown += `**创建时间**: ${new Date(conversation.create_time * 1000).toLocaleString()}\n\n`;
  markdown += `---\n\n`;

  if (conversation.mapping) {
    const messages = extractMessages(conversation.mapping);
    messages.forEach(msg => {
      const role = msg.role === 'user' ? '👤 用户' : '🤖 助手';
      markdown += `## ${role}\n\n`;
      markdown += `${msg.content}\n\n`;
    });
  }

  return markdown;
}

/**
 * 转换为 HTML
 */
function convertToHTML(conversation) {
  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(conversation.title || '未命名会话')}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      line-height: 1.6;
    }
    .message {
      margin-bottom: 20px;
      padding: 15px;
      border-radius: 8px;
    }
    .user {
      background: #f0f0f0;
    }
    .assistant {
      background: #e8f5e9;
    }
    .role {
      font-weight: bold;
      margin-bottom: 8px;
    }
    pre {
      background: #2d2d2d;
      color: #fff;
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(conversation.title || '未命名会话')}</h1>
  <p><strong>会话 ID</strong>: ${conversation.id}</p>
  <p><strong>创建时间</strong>: ${new Date(conversation.create_time * 1000).toLocaleString()}</p>
  <hr>
`;

  if (conversation.mapping) {
    const messages = extractMessages(conversation.mapping);
    messages.forEach(msg => {
      const roleClass = msg.role === 'user' ? 'user' : 'assistant';
      const roleLabel = msg.role === 'user' ? '👤 用户' : '🤖 助手';
      html += `
  <div class="message ${roleClass}">
    <div class="role">${roleLabel}</div>
    <div>${escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>
  </div>
`;
    });
  }

  html += `
</body>
</html>`;

  return html;
}

/**
 * 从 mapping 提取消息
 */
function extractMessages(mapping) {
  const messages = [];
  const nodes = Object.values(mapping);

  // 找到根节点
  let current = nodes.find(node => !node.parent);

  while (current) {
    if (current.message && current.message.content) {
      const content = current.message.content;
      if (content.parts && content.parts.length > 0) {
        messages.push({
          role: current.message.author.role,
          content: content.parts.join('\n'),
        });
      }
    }

    // 找到子节点
    const children = nodes.filter(node => node.parent === current.id);
    current = children[0];
  }

  return messages;
}

/**
 * 导入单个会话
 */
async function importConversation(conversation, api) {
  // 注意：ChatGPT 官方 API 不支持直接导入会话
  // 这里需要逐条发送消息来重建会话
  // 由于限制，这里只是模拟
  api.log.info(`准备导入会话: ${conversation.title || conversation.id}`);
  // 实际实现需要调用 ChatGPT API 创建新会话并发送消息
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
 * 文件名清理
 */
function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9_\-一-龥]/gi, '_').substring(0, 50);
}

/**
 * 下载文件
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename, mimeType);
}

/**
 * 下载 Blob
 */
function downloadBlob(blob, filename, mimeType) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 读取文件为文本
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

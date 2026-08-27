/**
 * 视觉工具箱：侧边栏配置页。MCP 实际能力在 mcp-server.mjs。
 * 用户配置写到 tweak-data/config.json（升级不覆盖），不改随包 manifest。
 */
"use strict";

const DEFAULTS = {
  apiKey: "YOUR_VISION_API_KEY",
  baseUrl: "https://api.groq.com/openai/v1",
  model: "qwen/qwen3.6-27b",
  protocol: "openai",
  lang: "zh",
  maxTokens: "1024",
  enabledModels: "deepseek-v4-flash,deepseek-v4-pro,glm-5.2,glm-5.3,qwen3.7-max",
  idleExitMinutes: "30",
};

const STORAGE_KEYS = {
  apiKey: "vision_api_key",
  baseUrl: "vision_base_url",
  model: "vision_model",
  protocol: "vision_protocol",
  lang: "vision_lang",
  maxTokens: "vision_max_tokens",
  enabledModels: "vision_enabled_models",
  idleExitMinutes: "vision_idle_exit_minutes",
};

module.exports = {
  async start(api) {
    api.log.info("视觉工具箱 tweak 已启动");
    if (api.settings) registerSettingsPage(api);
  },
  stop() {},
};

async function loadConfig(api) {
  const cfg = { ...DEFAULTS };
  for (const [k, sk] of Object.entries(STORAGE_KEYS)) {
    const v = api.storage.get(sk);
    if (v != null && String(v).trim() !== "") cfg[k] = String(v);
  }
  try {
    Object.assign(cfg, JSON.parse(await api.fs.read("config.json")));
  } catch {
    // 首次使用或尚未保存过
  }
  return cfg;
}

function registerSettingsPage(api) {
  api.settings.registerPage({
    id: "vision-toolkit",
    title: "视觉工具箱",
    description: "为纯文本模型接入云端视觉能力的配置",
    iconSvg: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/></svg>`,
    render: (root) => {
      void (async () => {
        const config = await loadConfig(api);
        root.innerHTML = `
        <div style="padding: 24px; max-width: 800px;">
          <div style="background: #f9f9f9; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
            <h3 style="margin-top: 0;">视觉模型配置</h3>
            <div style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 6px; font-weight: 500;">API Key</label>
              <input type="password" id="vision-api-key"
                style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; font-family: monospace;"
                placeholder="输入你的视觉模型 API Key">
              <small style="display: block; margin-top: 4px; color: #666;">
                如使用 Groq，从 <a href="https://console.groq.com/keys" target="_blank">console.groq.com</a> 获取
              </small>
            </div>
            <div style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 6px; font-weight: 500;">API Base URL</label>
              <input type="text" id="vision-base-url"
                style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; font-family: monospace;">
            </div>
            <div style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 6px; font-weight: 500;">模型名称</label>
              <input type="text" id="vision-model"
                style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; font-family: monospace;"
                placeholder="例如: qwen/qwen3.6-27b">
            </div>
            <div style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 6px; font-weight: 500;">协议类型</label>
              <select id="vision-protocol" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px;">
                <option value="openai">OpenAI (通用)</option>
                <option value="anthropic">Anthropic</option>
                <option value="dashscope">DashScope (阿里云)</option>
              </select>
            </div>
            <div style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 6px; font-weight: 500;">描述语言</label>
              <select id="vision-lang" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px;">
                <option value="zh">中文</option>
                <option value="en">English</option>
              </select>
            </div>
            <div style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 6px; font-weight: 500;">最大 Tokens</label>
              <input type="number" id="vision-max-tokens" min="128" max="4096"
                style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px;">
            </div>
          </div>
          <div style="background: #f9f9f9; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
            <h3 style="margin-top: 0;">模型白名单</h3>
            <textarea id="vision-enabled-models" rows="3"
              style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; font-family: monospace;"
              placeholder="用逗号分隔，例如: deepseek-v4-flash,glm-5.2"></textarea>
            <small style="display: block; margin-top: 4px; color: #666;">只有这些模型能调用 vision_glance 工具</small>
          </div>
          <div style="background: #f9f9f9; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
            <h3 style="margin-top: 0;">高级选项</h3>
            <label style="display: block; margin-bottom: 6px; font-weight: 500;">空闲退出时间（分钟）</label>
            <input type="number" id="vision-idle-exit" min="5" max="120"
              style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px;">
            <small style="display: block; margin-top: 4px; color: #666;">MCP 服务器空闲多久后自动退出（节省内存）</small>
          </div>
          <div style="display: flex; gap: 12px;">
            <button id="vision-save-btn" style="flex: 1; padding: 12px; background: #10a37f; color: white; border: none; border-radius: 6px; font-weight: 500; cursor: pointer;">保存配置</button>
            <button id="vision-reset-btn" style="flex: 1; padding: 12px; background: #ef4444; color: white; border: none; border-radius: 6px; font-weight: 500; cursor: pointer;">重置为默认值</button>
          </div>
          <div id="vision-status" style="margin-top: 16px; padding: 12px; border-radius: 6px; display: none;"></div>
          <div style="margin-top: 24px; padding: 16px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
            <strong>注意事项：</strong>
            <ul style="margin: 8px 0 0; padding-left: 20px;">
              <li>修改配置后需要<strong>重启 ChatGPT++</strong> 才能生效</li>
              <li>API Key 明文存在本机 tweak-data，升级不会覆盖</li>
              <li>确保选择的模型支持视觉输入（multimodal）</li>
            </ul>
          </div>
        </div>`;

        const el = (id) => root.querySelector(id);
        el("#vision-api-key").value = config.apiKey ?? "";
        el("#vision-base-url").value = config.baseUrl ?? "";
        el("#vision-model").value = config.model ?? "";
        el("#vision-protocol").value = config.protocol ?? "openai";
        el("#vision-lang").value = config.lang ?? "zh";
        el("#vision-max-tokens").value = config.maxTokens ?? "1024";
        el("#vision-enabled-models").value = config.enabledModels ?? "";
        el("#vision-idle-exit").value = config.idleExitMinutes ?? "30";

        const status = el("#vision-status");
        const showStatus = (message, isError = false) => {
          status.textContent = message;
          status.style.display = "block";
          status.style.background = isError ? "#fee" : "#efe";
          status.style.color = isError ? "#c00" : "#0a0";
          status.style.border = `1px solid ${isError ? "#fcc" : "#cfc"}`;
          setTimeout(() => { status.style.display = "none"; }, 3000);
        };

        el("#vision-save-btn").addEventListener("click", async () => {
          try {
            const newConfig = {
              apiKey: el("#vision-api-key").value.trim(),
              baseUrl: el("#vision-base-url").value.trim(),
              model: el("#vision-model").value.trim(),
              protocol: el("#vision-protocol").value,
              lang: el("#vision-lang").value,
              maxTokens: el("#vision-max-tokens").value,
              enabledModels: el("#vision-enabled-models").value.trim(),
              idleExitMinutes: el("#vision-idle-exit").value,
            };
            if (!newConfig.apiKey || newConfig.apiKey === "YOUR_VISION_API_KEY") {
              showStatus("请输入有效的 API Key", true);
              return;
            }
            if (!newConfig.baseUrl || !newConfig.model) {
              showStatus("API URL 和模型名称不能为空", true);
              return;
            }
            for (const [k, sk] of Object.entries(STORAGE_KEYS)) {
              api.storage.set(sk, newConfig[k]);
            }
            await api.fs.write("config.json", JSON.stringify(newConfig, null, 2));
            showStatus("配置已保存。请重启 ChatGPT++ 使配置生效。");
            api.log.info("视觉工具箱配置已写入 tweak-data/config.json");
          } catch (error) {
            showStatus(`保存失败: ${error.message}`, true);
            api.log.error("保存配置失败:", error);
          }
        });

        el("#vision-reset-btn").addEventListener("click", () => {
          if (!confirm("确定要重置为默认配置吗？")) return;
          el("#vision-api-key").value = DEFAULTS.apiKey;
          el("#vision-base-url").value = DEFAULTS.baseUrl;
          el("#vision-model").value = DEFAULTS.model;
          el("#vision-protocol").value = DEFAULTS.protocol;
          el("#vision-lang").value = DEFAULTS.lang;
          el("#vision-max-tokens").value = DEFAULTS.maxTokens;
          el("#vision-enabled-models").value = DEFAULTS.enabledModels;
          el("#vision-idle-exit").value = DEFAULTS.idleExitMinutes;
          showStatus("已重置为默认值，点击「保存配置」生效");
        });
      })();
    },
  });
}

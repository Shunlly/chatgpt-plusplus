#!/usr/bin/env node

/**
 * Dream Skin v2.0 主题管理 CLI
 *
 * 功能：
 * - 验证主题 JSON 格式
 * - 安装主题到 presets 目录
 * - 自动更新 index.js
 * - 列出已安装主题
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRESETS_DIR = path.join(__dirname, "presets");
const INDEX_FILE = path.join(__dirname, "index.js");

// 颜色输出
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(msg, color = "reset") {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function error(msg) {
  log(`❌ ${msg}`, "red");
}

function success(msg) {
  log(`✅ ${msg}`, "green");
}

function info(msg) {
  log(`ℹ️  ${msg}`, "cyan");
}

function warn(msg) {
  log(`⚠️  ${msg}`, "yellow");
}

// 验证主题配置
function validateTheme(themeConfig, filePath) {
  const errors = [];
  const warnings = [];

  // 必需字段
  if (!themeConfig.schemaVersion) {
    errors.push("缺少 schemaVersion 字段");
  } else if (themeConfig.schemaVersion !== 2) {
    errors.push(`schemaVersion 必须是 2，当前值: ${themeConfig.schemaVersion}`);
  }

  if (!themeConfig.id) {
    errors.push("缺少 id 字段");
  } else if (!/^[a-z0-9-]+$/.test(themeConfig.id)) {
    errors.push("id 必须只包含小写字母、数字和连字符");
  }

  if (!themeConfig.name) {
    errors.push("缺少 name 字段");
  }

  if (!themeConfig.type) {
    errors.push("缺少 type 字段");
  } else if (!["static", "canvas", "video"].includes(themeConfig.type)) {
    errors.push(`type 必须是 static/canvas/video，当前值: ${themeConfig.type}`);
  }

  if (!themeConfig.version) {
    warnings.push("建议添加 version 字段");
  }

  if (!themeConfig.author) {
    warnings.push("建议添加 author 字段");
  }

  if (!themeConfig.description) {
    warnings.push("建议添加 description 字段");
  }

  if (!themeConfig.tags || !Array.isArray(themeConfig.tags)) {
    warnings.push("建议添加 tags 字段（数组）");
  }

  if (!themeConfig.performance) {
    warnings.push("建议添加 performance 字段（low/medium/high）");
  } else if (!["low", "medium", "high"].includes(themeConfig.performance)) {
    warnings.push(`performance 应该是 low/medium/high，当前值: ${themeConfig.performance}`);
  }

  if (!themeConfig.backgroundColor) {
    warnings.push("建议添加 backgroundColor 字段");
  }

  if (!themeConfig.appearance) {
    warnings.push("建议添加 appearance 字段（dark/light/auto）");
  }

  // Canvas 类型特定验证
  if (themeConfig.type === "canvas") {
    if (!themeConfig.effects || !Array.isArray(themeConfig.effects)) {
      errors.push("canvas 类型必须有 effects 数组");
    } else if (themeConfig.effects.length === 0) {
      warnings.push("effects 数组为空，主题可能没有视觉效果");
    } else {
      // 验证每个效果
      themeConfig.effects.forEach((effect, index) => {
        if (!effect.type) {
          errors.push(`effects[${index}] 缺少 type 字段`);
        }
        if (!effect.config || typeof effect.config !== "object") {
          warnings.push(`effects[${index}] 建议添加 config 对象`);
        }
      });
    }

    if (!themeConfig.interactive) {
      warnings.push("建议添加 interactive 配置（mouse/click）");
    }
  }

  return { errors, warnings };
}

// 安装主题
async function installTheme(themeFilePath) {
  info(`正在安装主题: ${themeFilePath}`);

  // 读取主题文件
  let themeConfig;
  try {
    const content = fs.readFileSync(themeFilePath, "utf8");
    themeConfig = JSON.parse(content);
  } catch (err) {
    error(`读取主题文件失败: ${err.message}`);
    return false;
  }

  // 验证主题
  const { errors, warnings } = validateTheme(themeConfig, themeFilePath);

  if (errors.length > 0) {
    error("主题验证失败:");
    errors.forEach((err) => console.log(`  - ${err}`));
    return false;
  }

  if (warnings.length > 0) {
    warn("主题验证警告:");
    warnings.forEach((w) => console.log(`  - ${w}`));
  }

  // 创建主题目录
  const themeId = themeConfig.id;
  const themeDir = path.join(PRESETS_DIR, themeId);

  if (fs.existsSync(themeDir)) {
    warn(`主题目录已存在: ${themeId}`);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise((resolve) => {
      rl.question("是否覆盖? (y/N): ", (ans) => {
        rl.close();
        resolve(ans);
      });
    });

    if (answer.toLowerCase() !== "y") {
      info("取消安装");
      process.exit(0);
    }
  }

  try {
    // 创建目录
    if (!fs.existsSync(themeDir)) {
      fs.mkdirSync(themeDir, { recursive: true });
    }

    // 复制主题文件
    const targetPath = path.join(themeDir, "theme.json");
    fs.copyFileSync(themeFilePath, targetPath);

    success(`主题已安装到: ${themeDir}`);

    // 更新 index.js
    updateIndexFile(themeId);

    success("安装完成！");
    info(`主题 ID: ${themeId}`);
    info(`主题名称: ${themeConfig.name}`);
    if (themeConfig.description) {
      info(`描述: ${themeConfig.description}`);
    }

    return true;
  } catch (err) {
    error(`安装失败: ${err.message}`);
    return false;
  }
}

// 更新 index.js 的 PRESET_IDS
function updateIndexFile(themeId) {
  try {
    let content = fs.readFileSync(INDEX_FILE, "utf8");

    // 检查是否已存在
    if (content.includes(`"${themeId}"`)) {
      info(`${themeId} 已在 PRESET_IDS 中`);
      return;
    }

    // 找到 PRESET_IDS 数组
    const presetIdsRegex = /const PRESET_IDS = \[([\s\S]*?)\];/;
    const match = content.match(presetIdsRegex);

    if (!match) {
      warn("未找到 PRESET_IDS 数组，请手动添加主题 ID");
      return;
    }

    // 在数组末尾添加新 ID
    const currentIds = match[1];
    const newIds = currentIds.trim() + `,\n  "${themeId}"`;

    content = content.replace(
      presetIdsRegex,
      `const PRESET_IDS = [${newIds}\n];`
    );

    fs.writeFileSync(INDEX_FILE, content, "utf8");
    success(`已将 ${themeId} 添加到 PRESET_IDS`);
  } catch (err) {
    warn(`更新 index.js 失败: ${err.message}`);
    info(`请手动在 index.js 的 PRESET_IDS 数组中添加: "${themeId}"`);
  }
}

// 列出主题
function listThemes() {
  if (!fs.existsSync(PRESETS_DIR)) {
    warn("presets 目录不存在");
    return;
  }

  const themes = [];
  const dirs = fs.readdirSync(PRESETS_DIR);

  for (const dir of dirs) {
    const themeFile = path.join(PRESETS_DIR, dir, "theme.json");
    if (fs.existsSync(themeFile)) {
      try {
        const config = JSON.parse(fs.readFileSync(themeFile, "utf8"));
        themes.push({
          id: config.id || dir,
          name: config.name || "未命名",
          version: config.version || "N/A",
          author: config.author || "未知",
          type: config.type || "unknown",
          performance: config.performance || "N/A",
        });
      } catch (err) {
        warn(`读取主题失败: ${dir}`);
      }
    }
  }

  if (themes.length === 0) {
    info("没有已安装的主题");
    return;
  }

  log("\n已安装的主题:\n", "cyan");
  themes.forEach((theme, index) => {
    console.log(`${index + 1}. ${theme.name} (${theme.id})`);
    console.log(`   版本: ${theme.version} | 作者: ${theme.author}`);
    console.log(`   类型: ${theme.type} | 性能: ${theme.performance}\n`);
  });
}

// 验证主题
function validateThemeFile(themeFilePath) {
  info(`正在验证主题: ${themeFilePath}`);

  let themeConfig;
  try {
    const content = fs.readFileSync(themeFilePath, "utf8");
    themeConfig = JSON.parse(content);
  } catch (err) {
    error(`读取主题文件失败: ${err.message}`);
    return false;
  }

  const { errors, warnings } = validateTheme(themeConfig, themeFilePath);

  if (errors.length === 0 && warnings.length === 0) {
    success("主题验证通过，没有错误或警告！");
    return true;
  }

  if (errors.length > 0) {
    error("验证失败:");
    errors.forEach((err) => console.log(`  ❌ ${err}`));
  }

  if (warnings.length > 0) {
    warn("验证警告:");
    warnings.forEach((w) => console.log(`  ⚠️  ${w}`));
  }

  return errors.length === 0;
}

// 显示帮助
function showHelp() {
  console.log(`
Dream Skin v2.0 主题管理工具

用法:
  node theme-cli.js <command> [options]

命令:
  install <file>   安装主题 JSON 文件
  validate <file>  验证主题 JSON 格式
  list            列出已安装的主题
  help            显示帮助信息

示例:
  node theme-cli.js install my-theme.json
  node theme-cli.js validate my-theme.json
  node theme-cli.js list
`);
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    showHelp();
    return;
  }

  const command = args[0];

  switch (command) {
    case "install":
      if (args.length < 2) {
        error("请指定主题文件路径");
        console.log("用法: node theme-cli.js install <file>");
        process.exit(1);
      }
      await installTheme(args[1]);
      break;

    case "validate":
      if (args.length < 2) {
        error("请指定主题文件路径");
        console.log("用法: node theme-cli.js validate <file>");
        process.exit(1);
      }
      validateThemeFile(args[1]);
      break;

    case "list":
      listThemes();
      break;

    case "help":
    case "--help":
    case "-h":
      showHelp();
      break;

    default:
      error(`未知命令: ${command}`);
      showHelp();
      process.exit(1);
  }
}

// 运行
main();

export { validateTheme, installTheme, listThemes };

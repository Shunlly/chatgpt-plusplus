#!/usr/bin/env node
/**
 * 清理脚本：删除旧版本安装包和构建缓存，只保留最新版本
 *
 * 清理内容：
 * 1. .build/ 目录（构建缓存，约 1.5GB）
 * 2. dist/installers/ 中的旧版本安装包（只保留最新 2 个版本）
 * 3. dist/installers/ 中的临时文件（gui-darwin, chatgpt-plusplus 二进制）
 */

import { rmSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUILD_DIR = join(ROOT, '.build');
const INSTALLERS_DIR = join(ROOT, 'dist', 'installers');

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function getDirSize(path) {
  try {
    let size = 0;
    const files = readdirSync(path, { withFileTypes: true });
    for (const file of files) {
      const filePath = join(path, file.name);
      if (file.isDirectory()) {
        size += getDirSize(filePath);
      } else {
        size += statSync(filePath).size;
      }
    }
    return size;
  } catch {
    return 0;
  }
}

function cleanBuildDir() {
  console.log('\n🧹 清理构建缓存...');
  try {
    const size = getDirSize(BUILD_DIR);
    console.log(`  当前大小: ${formatBytes(size)}`);
    rmSync(BUILD_DIR, { recursive: true, force: true });
    console.log(`  ✅ 已删除 .build/ (节省 ${formatBytes(size)})`);
    return size;
  } catch (error) {
    console.log(`  ⚠️  删除失败: ${error.message}`);
    return 0;
  }
}

function cleanOldInstallers() {
  console.log('\n🧹 清理旧版本安装包...');

  try {
    const files = readdirSync(INSTALLERS_DIR);

    // 提取版本号并分组
    const dmgFiles = [];
    const exeFiles = [];
    const tempFiles = [];

    for (const file of files) {
      if (file.endsWith('.dmg')) {
        const match = file.match(/ChatGPT\+\+-(\d+\.\d+\.\d+)-/);
        if (match) {
          const version = match[1];
          const [major, minor, patch] = version.split('.').map(Number);
          dmgFiles.push({
            file,
            version,
            sortKey: major * 10000 + minor * 100 + patch,
            size: statSync(join(INSTALLERS_DIR, file)).size
          });
        }
      } else if (file.endsWith('.exe')) {
        const match = file.match(/ChatGPT\+\+-(\d+\.\d+\.\d+)-/);
        if (match) {
          const version = match[1];
          const [major, minor, patch] = version.split('.').map(Number);
          exeFiles.push({
            file,
            version,
            sortKey: major * 10000 + minor * 100 + patch,
            size: statSync(join(INSTALLERS_DIR, file)).size
          });
        }
      } else if (file === 'gui-darwin' || file === 'chatgpt-plusplus') {
        // 临时文件
        tempFiles.push({
          file,
          size: getDirSize(join(INSTALLERS_DIR, file))
        });
      }
    }

    // 排序（最新的在前）
    dmgFiles.sort((a, b) => b.sortKey - a.sortKey);
    exeFiles.sort((a, b) => b.sortKey - a.sortKey);

    let totalSaved = 0;

    // 保留最新 2 个版本的 DMG
    console.log(`\n  DMG 文件: 发现 ${dmgFiles.length} 个版本`);
    if (dmgFiles.length > 2) {
      console.log(`    保留: ${dmgFiles.slice(0, 2).map(f => f.version).join(', ')}`);
      for (let i = 2; i < dmgFiles.length; i++) {
        const { file, version, size } = dmgFiles[i];
        console.log(`    删除: ${version} (${formatBytes(size)})`);
        rmSync(join(INSTALLERS_DIR, file), { force: true });
        totalSaved += size;
      }
    } else {
      console.log(`    保留全部 (共 ${dmgFiles.length} 个)`);
    }

    // 保留最新 2 个版本的 EXE
    console.log(`\n  EXE 文件: 发现 ${exeFiles.length} 个版本`);
    if (exeFiles.length > 2) {
      console.log(`    保留: ${exeFiles.slice(0, 2).map(f => f.version).join(', ')}`);
      for (let i = 2; i < exeFiles.length; i++) {
        const { file, version, size } = exeFiles[i];
        console.log(`    删除: ${version} (${formatBytes(size)})`);
        rmSync(join(INSTALLERS_DIR, file), { force: true });
        totalSaved += size;
      }
    } else {
      console.log(`    保留全部 (共 ${exeFiles.length} 个)`);
    }

    // 删除临时文件
    if (tempFiles.length > 0) {
      console.log(`\n  临时文件: 发现 ${tempFiles.length} 个`);
      for (const { file, size } of tempFiles) {
        console.log(`    删除: ${file} (${formatBytes(size)})`);
        rmSync(join(INSTALLERS_DIR, file), { recursive: true, force: true });
        totalSaved += size;
      }
    }

    console.log(`\n  ✅ 已清理旧版本 (节省 ${formatBytes(totalSaved)})`);
    return totalSaved;

  } catch (error) {
    console.log(`  ⚠️  清理失败: ${error.message}`);
    return 0;
  }
}

function main() {
  console.log('🚀 ChatGPT++ 构建产物清理工具');
  console.log('=================================');

  const beforeSize = getDirSize(BUILD_DIR) + getDirSize(INSTALLERS_DIR);
  console.log(`\n📊 当前总大小: ${formatBytes(beforeSize)}`);

  const buildSaved = cleanBuildDir();
  const installersSaved = cleanOldInstallers();

  const totalSaved = buildSaved + installersSaved;
  const afterSize = beforeSize - totalSaved;

  console.log('\n📊 清理完成');
  console.log('=================================');
  console.log(`  清理前: ${formatBytes(beforeSize)}`);
  console.log(`  清理后: ${formatBytes(afterSize)}`);
  console.log(`  节省空间: ${formatBytes(totalSaved)} (${((totalSaved / beforeSize) * 100).toFixed(1)}%)`);
  console.log('');
}

main();

/**
 * Codex 官方 UI 通过 Statsig 的 use_hidden_models 控制模型下拉列表：
 * 为 true 时只展示 Statsig 白名单内的模型，自定义 model_catalog_json
 * （如 sub2api-model-catalog.json）里的模型会被隐藏，表现为“模型目录
 * 加载不出来”。这里在页面脚本执行前把 localStorage 缓存里的
 * use_hidden_models 全部改为 false，让自定义模型目录正常展示。
 * 返回匹配/修改的缓存项数量，供日志观测。
 */
export declare function applyStatsigModelVisibilityPatch(): {
    matched: number;
    changed: number;
    skipped: number;
};

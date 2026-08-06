/**
 * Codex 官方 UI 通过 Statsig 的 use_hidden_models 控制模型下拉列表：
 * 为 true 时只展示 Statsig 白名单内的模型，自定义 model_catalog_json
 * （如 sub2api-model-catalog.json）里的模型会被隐藏，表现为“模型目录
 * 加载不出来”。这里在页面脚本执行前把 localStorage 缓存里的
 * use_hidden_models 全部改为 false，让自定义模型目录正常展示。
 * 返回匹配/修改的缓存项数量，供日志观测。
 */
export function applyStatsigModelVisibilityPatch(): {
  matched: number;
  changed: number;
  skipped: number;
} {
  let matched = 0;
  let changed = 0;
  let skipped = 0;
  const prefix = "statsig.cached.evaluations.";

  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(prefix)) continue;
    try {
      const original = localStorage.getItem(key);
      if (!original) {
        skipped++;
        continue;
      }
      const outer = JSON.parse(original);
      const dataWasString = typeof outer?.data === "string";
      const data = dataWasString ? JSON.parse(outer.data) : outer?.data;
      const configs = data?.dynamic_configs;
      if (typeof configs !== "object" || configs === null) {
        skipped++;
        continue;
      }

      let touched = false;
      for (const config of Object.values(configs) as Array<{
        value?: Record<string, unknown>;
      }>) {
        const value = config?.value;
        if (
          typeof value !== "object" ||
          value === null ||
          !Object.prototype.hasOwnProperty.call(value, "use_hidden_models")
        ) {
          continue;
        }
        if (value.use_hidden_models !== false) {
          value.use_hidden_models = false;
          changed++;
        }
        touched = true;
      }

      if (!touched) {
        skipped++;
        continue;
      }
      outer.data = dataWasString ? JSON.stringify(data) : data;
      localStorage.setItem(key, JSON.stringify(outer));
      matched++;
    } catch {
      skipped++;
    }
  }

  return { matched, changed, skipped };
}

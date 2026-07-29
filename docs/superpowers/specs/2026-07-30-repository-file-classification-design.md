# 仓库文件分类设计

## 目标

在不改变插件功能、不拆分现有大文件的前提下，将散落在仓库根目录的 JavaScript 功能模块按职责分类。

## 目录结构

酒馆直接加载的入口与项目配置继续保留在根目录：

- `index.js`
- `style.css`
- `manifest.json`
- `package.json`
- `README.md`
- `LICENSE`

现有模块移动到以下一级目录：

### `api/`

- `api-request-parameters.js`
- `api-utils.js`
- `stream-utils.js`

### `generation/`

- `generation-entry.js`
- `generation-error.js`
- `prompt-builder.js`
- `prompt-log.js`
- `template-compat.js`

### `sources/`

- `baibai-book.js`
- `component-sources.js`
- `prompt-source-cache.js`
- `source-selection.js`
- `worldbook-scan.js`

### `ui/`

- `floating-ball-position.js`
- `notification-utils.js`
- `preview-sizing.js`

### `settings/`

- `scheme-utils.js`

### `injection/`

- `inject-utils.js`
- `tag-rules.js`

`tests/` 和 `docs/` 保持现有位置与内容，不做删除。

## 引用调整

- 更新 `index.js` 中所有被移动模块的导入路径，并保留现有 `?ver=0.1.0` 查询参数。
- 更新模块之间的相对导入路径。
- 更新测试文件中指向源码模块的相对路径。
- 更新直接读取源码文件的测试路径。
- `manifest.json` 继续加载根目录的 `index.js`，酒馆入口不变。

## 范围限制

- 不改变任何业务逻辑或界面行为。
- 不拆分 `index.js` 或 `style.css`。
- 不重命名模块文件。
- 不删除测试、文档或其他现有文件。
- 不引入构建工具或新依赖。

## 验证

整理后运行完整 `npm test`、`npm run check` 和 `git diff --check`。全部通过后，确认根目录只保留入口、样式、清单、包配置、说明和许可证等顶层文件。

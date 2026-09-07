export const HELP_STEP_COUNT = 5;

const HELP_STEPS = Object.freeze([
  {
    phase: '准备生成服务',
    title: '配置外置 API',
    description: '前往“运行设置 → API 配置”，填写 API 地址、模型和密钥。没有可用的 API，插件无法开始生成。',
    icon: 'fa-plug',
  },
  {
    phase: '告诉模型任务',
    title: '确认任务指令',
    description: '任务指令决定模型要生成什么。需要发送组件库内容时，指令中必须包含组件占位符。',
    code: '{{external_components}}',
    icon: 'fa-pen-to-square',
  },
  {
    phase: '准备生成素材',
    title: '选择需要的内容',
    description: '在预设、世界书和组件库中启用这次真正需要的内容；不需要的来源可以不选。',
    icon: 'fa-layer-group',
  },
  {
    phase: '先检查结果',
    title: '生成并查看预览',
    description: '点击生成后，结果只会进入预览框。你可以先检查或修改，不会立刻改变聊天正文。',
    icon: 'fa-wand-magic-sparkles',
  },
  {
    phase: '写入当前回复',
    title: '确认后再注入',
    description: '内容确认无误后再点击注入。插件会把结果写入当前聊天的最新 assistant 回复。',
    icon: 'fa-file-import',
  },
]);

function normalizeStep(step) {
  const value = Number.parseInt(step, 10);
  return Number.isFinite(value) ? Math.max(0, Math.min(HELP_STEP_COUNT - 1, value)) : 0;
}

export function renderHelpStep(step = 0) {
  const index = normalizeStep(step);
  const item = HELP_STEPS[index];
  return `<article class="st-esg-help-step" data-help-step="${index}">
    <div class="st-esg-help-step-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</div>
    <div class="st-esg-help-step-copy">
      <span>${item.phase}</span>
      <h2>${item.title}</h2>
      <p>${item.description}</p>
      ${item.code ? `<code>${item.code}</code>` : ''}
    </div>
    <i class="fa-solid ${item.icon}" aria-hidden="true"></i>
  </article>`;
}

function renderStepDots() {
  return `<div class="st-esg-help-step-dots" aria-hidden="true">${HELP_STEPS.map((_, index) => `<span${index === 0 ? ' class="active"' : ''} data-help-step-dot="${index}"></span>`).join('')}</div>`;
}

export function renderHelpGuide() {
  return `<section class="st-esg-help-quick-start" aria-labelledby="st-esg-help-quick-title">
    <header class="st-esg-help-quick-head">
      <div><h1 id="st-esg-help-quick-title">快速上手</h1><span data-help-step-progress>第 1 步 / 共 ${HELP_STEP_COUNT} 步</span></div>
      ${renderStepDots()}
    </header>
    <div class="st-esg-help-step-stage" data-help-step-content>${renderHelpStep(0)}</div>
    <nav class="st-esg-help-step-actions" aria-label="快速上手步骤">
      <button class="menu_button st-esg-secondary-action" type="button" data-help-step-previous disabled>上一步</button>
      <button class="menu_button st-esg-primary-action" type="button" data-help-step-next>下一步</button>
    </nav>
  </section>

  <section class="st-esg-help-reference" aria-labelledby="st-esg-help-reference-title">
    <header class="st-esg-help-reference-head"><h2 id="st-esg-help-reference-title">功能说明</h2><span>只保留容易误解的操作</span></header>

    <section class="st-esg-help-reference-section">
      <h3>方案按钮</h3>
      <div class="st-esg-help-scheme-legend" aria-label="方案按钮说明">
        <div><span class="st-esg-help-scheme-icon"><i class="fa-solid fa-download" aria-hidden="true"></i></span><strong>载入</strong></div>
        <div><span class="st-esg-help-scheme-icon"><i class="fa-solid fa-plus" aria-hidden="true"></i></span><strong>另存</strong></div>
        <div><span class="st-esg-help-scheme-icon"><i class="fa-solid fa-file-pen" aria-hidden="true"></i></span><strong>覆盖</strong></div>
        <div><span class="st-esg-help-scheme-icon"><i class="fa-solid fa-link" aria-hidden="true"></i></span><strong>绑定聊天</strong></div>
        <div><span class="st-esg-help-scheme-icon"><i class="fa-solid fa-trash" aria-hidden="true"></i></span><strong>删除</strong></div>
      </div>
      <p class="st-esg-help-emphasis"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><span>在选择框中选中方案不会自动应用，还需要点击“载入”。</span></p>
    </section>

    <section class="st-esg-help-reference-section">
      <h3>容易混淆</h3>
      <div class="st-esg-help-comparisons">
        <div class="st-esg-help-comparison"><span><strong>生成</strong><small>结果进入预览</small></span><span><strong>注入</strong><small>写入聊天正文</small></span></div>
        <div class="st-esg-help-comparison"><span><strong>提示词模式</strong><small>本次直接发送</small></span><span><strong>导入组件</strong><small>复制进组件库管理</small></span></div>
        <div class="st-esg-help-comparison"><span><strong>单任务</strong><small>使用当前页面设置</small></span><span><strong>多任务</strong><small>每项使用自己的方案</small></span></div>
      </div>
    </section>

    <section class="st-esg-help-reference-section">
      <h3>进阶功能</h3>
      <div class="st-esg-help-topics">
        <details data-help-topic="batch"><summary>多任务批量开关<i class="fa-solid fa-chevron-down" aria-hidden="true"></i></summary><p>只决定任务是否参加“全部”操作；关闭后仍然可以单独生成、注入和撤回。</p></details>
        <details data-help-topic="automation"><summary>自动生成与自动撤回<i class="fa-solid fa-chevron-down" aria-hidden="true"></i></summary><p>自动生成监听最新回复；生成前撤回只处理同一目标楼层上对应任务的最新注入。</p></details>
        <details data-help-topic="component-scheme"><summary>组件方案保存什么<i class="fa-solid fa-chevron-down" aria-hidden="true"></i></summary><p>保存组件和小剧场的启用状态及随机设置，不复制组件正文；组件内容始终使用库中的最新版本。</p></details>
        <details data-help-topic="memory"><summary>记忆来源<i class="fa-solid fa-chevron-down" aria-hidden="true"></i></summary><p>聊天记录提供原始对话；柏宝书提供剧情与现状；Anima 可提供世界书召回内容和状态变量，勾选哪个就读取哪个。</p></details>
        <details data-help-topic="cleanup"><summary>标签清理<i class="fa-solid fa-chevron-down" aria-hidden="true"></i></summary><p>聊天记录清理发生在发送前；生成内容剥离发生在注入前，预览仍会保留模型的原始返回内容。</p></details>
      </div>
    </section>
  </section>`;
}

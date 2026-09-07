export const HELP_TOUR_STEPS = Object.freeze([
  {
    tab: 'runtime',
    title: '连接本次生成使用的 API',
    description: '织幕会单独向这里配置的 API 发起生成请求，不会占用酒馆当前回复所用的 API；也可以直接载入已保存的 API 方案。',
    targetSelectors: ['.st-esg-api-fields'],
    openClosestDetails: true,
  },
  {
    tab: 'task',
    title: '告诉模型这次要完成什么',
    description: '任务指令定义本次生成目标，默认以 user 身份放在聊天记录之后，成为本次请求的最新 user 消息；{{external_components}} 会在发送前展开为当前启用的组件。',
    targetSelectors: ['[data-tab-panel="task"] > .st-esg-card:not(.st-esg-output-protocol-details) > .st-esg-card-head'],
  },
  {
    tab: 'task',
    title: '用最后一条消息约束返回格式',
    description: '尾部格式约束位于整组提示词末尾，用来规定模型如何返回结果。若 Gemini 等接口提示 assistant 预填充（prefill）错误，可将“消息角色”改为 system 或 user。',
    targetSelectors: ['.st-esg-output-protocol-toolbar'],
    openClosestDetails: true,
  },
  {
    tab: 'preset',
    title: '选择任务执行前要提供的上下文',
    description: '预设、世界书和组件会作为任务前的上下文发送给模型；这里只启用本次生成确实需要读取的内容。',
    targetSelectors: [
      '.st-esg-tab[data-tab="preset"]',
      '.st-esg-tab[data-tab="worldbook"]',
      '.st-esg-tab[data-tab="components"]',
    ],
  },
  {
    tab: 'workspace',
    title: '把手动流程连起来',
    description: '自动生成会在最新 assistant 正文结束后启动任务，自动注入会在结果解析成功后写回正文；生成前撤回只清理当前楼层对应任务的上次注入。',
    targetSelectors: [
      '#st-esg-auto-generate',
      '#st-esg-auto-inject',
      '#st-esg-rollback-before-generation',
    ],
    openGenerationSettings: true,
    groupTargets: true,
  },
  {
    tab: 'workspace',
    title: '先生成，再检查结果',
    description: '生成只会把模型返回结果放进预览，不会修改聊天正文；确认内容或编辑完成后，再决定是否注入。',
    targetSelectors: ['.st-esg-generation-content'],
  },
  {
    tab: 'workspace',
    title: '最后把结果写入目标楼层',
    description: '注入才会按照当前注入方式，将处理后的结果写入本次生成绑定的目标楼层；开启自动注入时，这一步会自动完成。',
    targetSelectors: ['.st-esg-footer-actions'],
  },
]);

function normalizeTourStep(stepIndex) {
  const value = Number.parseInt(stepIndex, 10);
  return Number.isFinite(value) ? Math.max(0, Math.min(HELP_TOUR_STEPS.length - 1, value)) : 0;
}

export function renderHelpTour(stepIndex = 0) {
  const index = normalizeTourStep(stepIndex);
  const step = HELP_TOUR_STEPS[index];
  const isLast = index === HELP_TOUR_STEPS.length - 1;
  return `<aside class="st-esg-help-tour" role="region" aria-live="polite" aria-label="快速上手指引" data-help-tour-step="${index}">
    <div class="st-esg-help-tour-copy">
      <span>快速上手 · ${index + 1}/${HELP_TOUR_STEPS.length}</span>
      <strong>${step.title}</strong>
      <p>${step.description}</p>
    </div>
    <div class="st-esg-help-tour-actions">
      <button class="menu_button st-esg-secondary-action" type="button" data-help-tour-exit>退出</button>
      <button class="menu_button st-esg-secondary-action" type="button" data-help-tour-previous${index === 0 ? ' disabled' : ''}>上一步</button>
      <button class="menu_button st-esg-primary-action" type="button" data-help-tour-next>${isLast ? '完成' : '下一步'}</button>
    </div>
  </aside>`;
}

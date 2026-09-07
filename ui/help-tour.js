export const HELP_TOUR_STEPS = Object.freeze([
  {
    tab: 'runtime',
    title: '先配置外置 API',
    description: '填写 API 地址、模型和密钥。已经保存过 API 方案的话，也可以直接载入。',
    targetSelectors: ['.st-esg-api-fields'],
    openClosestDetails: true,
  },
  {
    tab: 'task',
    title: '确认生成任务指令',
    description: '这里决定模型要生成什么。需要使用组件库时，任务指令里要保留 {{external_components}}。',
    targetSelectors: ['[data-tab-panel="task"] > .st-esg-card:not(.st-esg-output-protocol-details)'],
    placement: 'top',
  },
  {
    tab: 'preset',
    title: '选择生成所需内容',
    description: '按需查看预设、世界书和组件库；只启用这次确实需要发送的内容。',
    targetSelectors: [
      '.st-esg-tab[data-tab="preset"]',
      '.st-esg-tab[data-tab="worldbook"]',
      '.st-esg-tab[data-tab="components"]',
    ],
  },
  {
    tab: 'workspace',
    title: '设置自动生成与注入',
    description: '自动生成负责监听新回复，自动注入负责写回正文；生成前撤回只清理同一楼层对应任务的上次注入。',
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
    title: '先生成并检查预览',
    description: '生成结果会先出现在这里，可以检查和编辑，不会立刻修改聊天正文。',
    targetSelectors: ['.st-esg-generation-content'],
  },
  {
    tab: 'workspace',
    title: '确认后再注入',
    description: '内容没有问题后再点击注入；开启自动注入时，这一步会在生成结束后自动完成。',
    targetSelectors: ['.st-esg-footer-actions'],
    placement: 'top',
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
  return `<aside class="st-esg-help-tour${step.placement === 'top' ? ' is-top' : ''}" role="region" aria-live="polite" aria-label="快速上手指引" data-help-tour-step="${index}">
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

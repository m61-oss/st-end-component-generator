const HELP_SECTIONS = Object.freeze([
  {
    id: 'quick-start',
    title: '快速上手',
    summary: '先理解生成内容从哪里来、最后写到哪里。',
    content: `
      <div class="st-esg-help-lead">织幕使用独立 API，根据聊天记录、任务指令和所选来源生成附加内容。生成结果会先进入预览，不会立即修改正文。</div>
      <ol class="st-esg-help-steps">
        <li><strong>准备 API</strong><span>首次使用先在“运行设置”中填写 API 地址、模型与密钥。</span></li>
        <li><strong>确定任务</strong><span>任务指令决定要生成什么；需要发送组件库内容时，指令中必须包含 <code>{{external_components}}</code>。</span></li>
        <li><strong>检查来源</strong><span>按需启用预设、世界书和组件，不需要的来源可以不选。</span></li>
        <li><strong>先看再注入</strong><span>生成后可在预览框检查和编辑；只有注入才会写入当前聊天的最新 assistant 楼层。</span></li>
      </ol>
      <div class="st-esg-help-note"><strong>第一次使用</strong><span>建议先关闭自动生成和自动注入，手动完成一次“生成—检查—注入”。</span></div>`,
  },
  {
    id: 'multi-task',
    title: '单任务与多任务',
    summary: '理解任务胶囊、状态灯和批量操作的范围。',
    content: `
      <div class="st-esg-help-item"><strong>什么时候使用多任务</strong><p>需要分别生成状态栏、小剧场等多类内容时使用。只有一类内容，或还不熟悉插件时，使用单任务更直接。</p></div>
      <div class="st-esg-help-item"><strong>任务胶囊与状态灯</strong><p>胶囊用于切换正在查看的任务。蓝色呼吸灯表示生成中；完成、已注入和失败会显示对应的静态状态。</p></div>
      <div class="st-esg-help-item"><strong>加入批量</strong><p>只决定该任务是否参加“生成全部、注入全部和撤回全部”。关闭后仍可单独生成、注入或撤回，不会删除任务配置。</p></div>
      <div class="st-esg-help-item"><strong>并发、顺序与间隔</strong><p>并发数决定同时生成几个任务，超出的任务会排队。自动注入可按返回顺序立即处理，也可等待并按任务顺序处理；注入间隔用于减轻连续渲染造成的卡顿。</p></div>
      <div class="st-esg-help-note"><strong>失败任务</strong><span>失败或停止的任务会自动跳过，不会阻塞其他任务；单独重试只处理当前任务。</span></div>`,
  },
  {
    id: 'schemes',
    title: '方案与聊天绑定',
    summary: '分清载入、保存、覆盖和应用到当前聊天。',
    content: `
      <div class="st-esg-help-item"><strong>载入方案</strong><p>把方案中保存的设置恢复到当前页面。仅在选择框中选中名称，并不等于已经载入。</p></div>
      <div class="st-esg-help-item"><strong>另存、覆盖与删除</strong><p>“另存”创建新方案；“覆盖”用当前设置更新已选方案。删除会移除方案并解除绑定；删除预设方案时，绑定到它的预设组件也会一并删除，操作前会提示。</p></div>
      <div class="st-esg-help-item"><strong>应用到当前聊天</strong><p>将当前方案绑定到这个聊天窗口。以后回到该聊天时会继续使用它，不影响其他聊天。</p></div>
      <div class="st-esg-help-item"><strong>不同方案保存什么</strong><p>任务、预设、世界书和 API 方案各自保存对应页面的配置；组件方案只保存组件库与小剧场库的启用状态和随机设置，不复制组件正文。</p></div>
      <div class="st-esg-help-note"><strong>多任务方案</strong><span>保存任务列表、每个任务选择的方案以及是否加入批量；额外指令仍是临时内容，不会保存。</span></div>`,
  },
  {
    id: 'sources',
    title: '预设、世界书与组件库',
    summary: '了解内容参与生成的两种方式。',
    content: `
      <div class="st-esg-help-item"><strong>提示词模式</strong><p>勾选的预设或世界书条目会在本次生成时直接发送给外置 API，不会加入组件库。</p></div>
      <div class="st-esg-help-item"><strong>导入组件模式</strong><p>将勾选条目复制到组件库或小剧场库，并可选择归属范围和目标分组。导入后在组件库中独立管理。</p></div>
      <div class="st-esg-help-item"><strong>组件归属</strong><p>全局组件不绑定预设或角色；预设组件跟随对应预设方案；角色组件只在当前角色下使用。最终是否发送仍取决于启用状态和任务指令中的组件占位符。</p></div>
      <div class="st-esg-help-item"><strong>预设额外选项</strong><p>可指定任务指令插入位置、替换预设中的 {{LastUserMessage}}，或不向外置 API 发送聊天记录里的 user 消息。只在确实需要改变提示词结构时开启。</p></div>
      <div class="st-esg-help-item"><strong>方案与导入导出</strong><p>组件方案记录“哪些组件启用”；导入导出传递的是组件分组和具体内容，两者不会互相替代。</p></div>
      <div class="st-esg-help-note"><strong>单任务</strong><span>直接使用组件库当前状态。多任务则由每个任务选择的组件方案决定启用状态。</span></div>`,
  },
  {
    id: 'automation',
    title: '自动生成与楼层面板',
    summary: '弄清自动流程、目标楼层和撤回范围。',
    content: `
      <div class="st-esg-help-item"><strong>自动生成</strong><p>监听新的 assistant 正文结束事件。设置触发字符串后，只有最新正文原样包含该字符串才会启动。</p></div>
      <div class="st-esg-help-item"><strong>自动注入</strong><p>生成成功并完成解析后自动写入目标楼层。关闭时结果会停在待注入状态，仍可检查和编辑。</p></div>
      <div class="st-esg-help-item"><strong>生成前自动撤回</strong><p>开始新一轮生成前，只撤回同一目标楼层上对应任务的最新注入，不会跨楼层删除旧内容。</p></div>
      <div class="st-esg-help-item"><strong>楼层面板</strong><p>面板记录该楼层的生成状态和结果。多任务下可切换任务并执行当前楼层允许的生成、注入、撤回或重试。</p></div>
      <div class="st-esg-help-item"><strong>调试信息</strong><p>用于查看本次生成流程以及实际发送给外置 API 的消息。压缩连续 system 只改变日志的查看方式，不改变请求内容。</p></div>
      <div class="st-esg-help-note"><strong>目标限制</strong><span>生成与撤回记录绑定聊天和楼层；切换聊天或目标楼层变化后，旧记录不会当作当前楼层操作。</span></div>`,
  },
  {
    id: 'memory-cleanup',
    title: '记忆与标签处理',
    summary: '分清记忆来源，以及生成前后两类清理规则。',
    content: `
      <div class="st-esg-help-item"><strong>聊天记录</strong><p>可读取全部未隐藏消息，或只保留最近若干条。它提供原始对话上下文，不等同于长期记忆摘要。</p></div>
      <div class="st-esg-help-item"><strong>柏宝书与 Anima</strong><p>柏宝书可提供此前剧情和故事现状；Anima 可读取其世界书召回内容与状态变量。勾选哪个来源，就注入哪个来源。</p></div>
      <div class="st-esg-help-item"><strong>聊天历史清理</strong><p>在聊天记录发送给模型前处理已有内容，用来移除不希望再次发送的标签块。</p></div>
      <div class="st-esg-help-item"><strong>生成内容剥离</strong><p>预览仍保留模型返回内容；真正注入正文前，才按这里的规则移除指定标签块。</p></div>
      <div class="st-esg-help-item"><strong>标签与正则</strong><p>“标签”填写标签名，例如 <code>thinking</code>；“正则”填写需要匹配的完整表达式。历史规则中的“保留”表示最近多少条 assistant 回复不执行该规则，填 0 表示全部处理。</p></div>`,
  },
]);

export function renderHelpGuide(initialSection = 'quick-start') {
  const activeId = HELP_SECTIONS.some((section) => section.id === initialSection) ? initialSection : 'quick-start';
  return `<div class="st-esg-help-accordion" aria-label="使用帮助分类">${HELP_SECTIONS.map((section) => `
    <details class="st-esg-help-section" data-help-section="${section.id}"${section.id === activeId ? ' open' : ''}>
      <summary><span><strong>${section.title}</strong><small>${section.summary}</small></span><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></summary>
      <div class="st-esg-help-section-body">${section.content}</div>
    </details>`).join('')}</div>`;
}

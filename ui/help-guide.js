export function renderHelpGuide() {
  return `<section class="st-esg-help-quick-start" aria-labelledby="st-esg-help-quick-title">
    <div>
      <h1 id="st-esg-help-quick-title">跟着页面快速上手</h1>
      <p>指引会沿着“连接 API → 组织提示词 → 生成预览 → 注入正文”的实际流程切换页面，不会替你修改任何设置。</p>
    </div>
    <button class="menu_button st-esg-primary-action" type="button" data-help-tour-start><i class="fa-solid fa-route" aria-hidden="true"></i><span>开始指引</span></button>
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
        <div class="st-esg-help-comparison"><span><strong>生成</strong><small>模型返回内容进入预览</small></span><span><strong>注入</strong><small>处理后写入目标楼层正文</small></span></div>
        <div class="st-esg-help-comparison"><span><strong>提示词模式</strong><small>勾选内容参与本次请求</small></span><span><strong>导入组件</strong><small>将条目复制进组件库管理</small></span></div>
        <div class="st-esg-help-comparison"><span><strong>单任务</strong><small>直接使用当前页面配置</small></span><span><strong>多任务</strong><small>每项载入各自保存的方案</small></span></div>
      </div>
    </section>

    <section class="st-esg-help-reference-section">
      <h3>进阶功能</h3>
      <div class="st-esg-help-topics">
        <details data-help-topic="task-actions"><summary>多任务操作按钮<i class="fa-solid fa-chevron-down" aria-hidden="true"></i></summary>
          <div class="st-esg-help-task-action-legend" aria-label="多任务操作按钮说明">
            <div><span class="st-esg-help-scheme-icon"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></span><strong>撤回</strong></div>
            <div><span class="st-esg-help-scheme-icon"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i></span><strong>生成</strong></div>
            <div><span class="st-esg-help-scheme-icon"><i class="fa-solid fa-file-import" aria-hidden="true"></i></span><strong>注入</strong></div>
            <div><span class="st-esg-help-scheme-icon st-esg-help-batch-switch" aria-hidden="true"><span></span></span><strong>参加全部</strong></div>
          </div>
          <div class="st-esg-help-task-action-notes">
            <p><strong>撤回</strong><span>撤回当前任务在当前楼层的最新一次注入。</span></p>
            <p><strong>生成</strong><span>只生成当前任务；生成中再次点击可停止它。</span></p>
            <p><strong>注入</strong><span>只把当前任务的预览结果写入目标楼层。</span></p>
            <p><strong>参加全部</strong><span>开启时参加“生成全部、注入全部、撤回全部”；关闭后，“全部”操作会跳过它，旁边三个按钮仍可单独使用。</span></p>
          </div>
        </details>
        <details data-help-topic="scheme-binding"><summary>方案与当前聊天绑定<i class="fa-solid fa-chevron-down" aria-hidden="true"></i></summary><p>绑定后，这个聊天窗口会继续使用对应方案，不影响其他聊天；仅在选择框中选中并不会建立绑定。</p></details>
        <details data-help-topic="output-protocol"><summary>尾部格式约束<i class="fa-solid fa-chevron-down" aria-hidden="true"></i></summary><p>它会作为整组提示词的最后一条消息约束返回格式。若 Gemini 等接口提示 assistant 预填充错误，可将消息角色改为 system 或 user；普通与锚点模式分别保存。</p></details>
        <details data-help-topic="cleanup"><summary>标签清理<i class="fa-solid fa-chevron-down" aria-hidden="true"></i></summary><p>聊天记录清理发生在发送前；生成内容剥离只发生在注入前，因此预览会保留模型的原始返回内容。</p></details>
      </div>
    </section>
  </section>`;
}

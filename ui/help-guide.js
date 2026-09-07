export function renderHelpGuide() {
  return `<section class="st-esg-help-quick-start" aria-labelledby="st-esg-help-quick-title">
    <div>
      <h1 id="st-esg-help-quick-title">跟着页面快速上手</h1>
      <p>指引会切换到对应页面并标出需要关注的位置，不会替你修改任何设置。</p>
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
        <div class="st-esg-help-comparison"><span><strong>生成</strong><small>结果进入预览</small></span><span><strong>注入</strong><small>写入聊天正文</small></span></div>
        <div class="st-esg-help-comparison"><span><strong>提示词模式</strong><small>本次直接发送</small></span><span><strong>导入组件</strong><small>复制进组件库管理</small></span></div>
        <div class="st-esg-help-comparison"><span><strong>单任务</strong><small>使用当前页面设置</small></span><span><strong>多任务</strong><small>每项使用自己的方案</small></span></div>
      </div>
    </section>

    <section class="st-esg-help-reference-section">
      <h3>进阶功能</h3>
      <div class="st-esg-help-topics">
        <details data-help-topic="batch"><summary>多任务批量开关<i class="fa-solid fa-chevron-down" aria-hidden="true"></i></summary><p>只决定任务是否参加“全部”操作；关闭后仍然可以单独生成、注入和撤回。</p></details>
        <details data-help-topic="scheme-binding"><summary>方案与当前聊天绑定<i class="fa-solid fa-chevron-down" aria-hidden="true"></i></summary><p>绑定后，这个聊天窗口会继续使用对应方案，不影响其他聊天；仅在选择框中选中并不会建立绑定。</p></details>
        <details data-help-topic="component-scheme"><summary>组件方案与导入导出<i class="fa-solid fa-chevron-down" aria-hidden="true"></i></summary><p>组件方案只保存启用状态和随机设置；导入导出传递组件分组与正文，两者互不替代。</p></details>
        <details data-help-topic="cleanup"><summary>标签清理<i class="fa-solid fa-chevron-down" aria-hidden="true"></i></summary><p>聊天记录清理发生在发送前；生成内容剥离发生在注入前，预览仍会保留模型的原始返回内容。</p></details>
      </div>
    </section>
  </section>`;
}

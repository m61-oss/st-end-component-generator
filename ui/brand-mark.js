export function renderBrandMark(context = 'default') {
  const contextClass = String(context || 'default').replace(/[^a-z0-9_-]/gi, '');
  if (contextClass === 'menu' || contextClass === 'floor') {
    return `<svg class="st-esg-brand-mark st-esg-brand-mark-${contextClass}" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path class="st-esg-brand-mark-menu-path" d="M8 13 19 20.56M29 27.44 40 35V13L29 20.56M19 27.44 8 35V13"></path><path class="st-esg-brand-mark-bridge" d="m20.5 26.7 7-5"></path></svg>`;
  }
  return `<svg class="st-esg-brand-mark st-esg-brand-mark-${contextClass}" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path class="st-esg-brand-mark-path" d="M8 13 40 35V13L8 35Z"></path><path class="st-esg-brand-mark-flow st-esg-brand-mark-flow-tail" pathLength="112" d="M8 13 40 35V13L8 35Z"></path><path class="st-esg-brand-mark-flow st-esg-brand-mark-flow-body" pathLength="112" d="M8 13 40 35V13L8 35Z"></path><path class="st-esg-brand-mark-flow st-esg-brand-mark-flow-head" pathLength="112" d="M8 13 40 35V13L8 35Z"></path><path class="st-esg-brand-mark-cut" d="m20.5 21.8 7 4.9"></path><path class="st-esg-brand-mark-bridge" d="m20.5 26.7 7-5"></path></svg>`;
}

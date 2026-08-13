const textOf = (value) => String(value ?? '').trim();

const RUNTIME_CONTEXT_NOTE = '〔记忆系统私密简报｜仅你可见〕下列内容由记忆系统在幕后提供,仅供你参考以保持剧情连贯一致。';
const RUNTIME_CONTEXT_END = '〔私密简报结束〕以上仅供你了解前情。';

function isTrackableAssistantMessage(message) {
  return Boolean(message && !message.is_user && !message.is_system && textOf(message.mes));
}

function latestAssistantFloor(context) {
  const chat = Array.isArray(context?.chat) ? context.chat : [];
  for (let index = chat.length - 1; index >= 0; index -= 1) {
    if (isTrackableAssistantMessage(chat[index])) return index;
  }
  return null;
}

export function selectBaiBaiBookSnapshot(api, context) {
  if (!api || typeof api.getSnapshot !== 'function') return null;
  const floor = latestAssistantFloor(context);
  if (floor === null || typeof api.getFloor !== 'function') return api.getSnapshot();

  let at = 'before';
  try {
    at = api.getFloor(floor)?.memory?.valid ? 'after' : 'before';
  } catch (_) {
    at = 'before';
  }

  try {
    return api.getSnapshot({ floor, at });
  } catch (_) {
    return api.getSnapshot();
  }
}

function oneLine(value) {
  return textOf(value).replace(/\s*[\r\n]+\s*/g, ' ');
}

function formatFields(fields) {
  return fields
    .filter(([, value]) => oneLine(value))
    .map(([label, value]) => `  - ${label}：${oneLine(value)}`)
    .join('\n');
}

function formatProtagonist(protagonist, name) {
  const content = formatFields([
    ['性别', protagonist?.gender],
    ['身份', protagonist?.identity],
    ['外貌', protagonist?.appearance],
    ['着装', protagonist?.outfit],
    ['状态', protagonist?.condition],
  ]);
  return content ? `[主角当前状态]\n${oneLine(name) || '主角'}:\n${content}` : '';
}

function pathOfScene(scene) {
  const path = Array.isArray(scene?.path) ? scene.path.map(oneLine).filter(Boolean) : [];
  return path.length ? path : (oneLine(scene?.name) ? [oneLine(scene.name)] : []);
}

function sceneMatchesPath(scene, locationPath) {
  const scenePath = pathOfScene(scene);
  return scenePath.length > 0
    && scenePath.length <= locationPath.length
    && scenePath.every((part, index) => part === locationPath[index]);
}

function formatScenes(snapshot) {
  const scenes = Array.isArray(snapshot?.scenes) ? snapshot.scenes : [];
  const locationPath = Array.isArray(snapshot?.state?.locationPath)
    ? snapshot.state.locationPath.map(oneLine).filter(Boolean)
    : [];
  const current = scenes.filter((scene) => sceneMatchesPath(scene, locationPath));
  const currentIds = new Set(current.map((scene) => scene?.id).filter(Boolean));
  const currentText = current
    .sort((a, b) => pathOfScene(a).length - pathOfScene(b).length)
    .map((scene) => {
      const name = oneLine(scene?.name) || pathOfScene(scene).at(-1);
      const desc = oneLine(scene?.desc);
      return desc ? `${name}（${desc}）` : name;
    })
    .filter(Boolean)
    .join(' › ');
  const others = scenes
    .filter((scene) => !currentIds.has(scene?.id))
    .map((scene) => pathOfScene(scene).join(' › '))
    .filter(Boolean);
  const lines = [];
  if (currentText) lines.push(`当前所在(由大到小):${currentText}`);
  if (others.length) lines.push(`其他已知地点(仅名称):\n${others.map((item) => `  - ${item}`).join('\n')}`);
  return lines.length ? `地点记忆:\n${lines.join('\n')}` : '';
}

function formatItems(items) {
  const lines = (Array.isArray(items) ? items : [])
    .filter((item) => oneLine(item?.name))
    .map((item) => {
      const details = [
        item.carried === false ? `[存:${oneLine(item.location) || '某处'}]` : '',
      ].filter(Boolean);
      const qty = typeof item.qty === 'number' ? ` ×${item.qty}` : '';
      const place = details.length ? ` ${details.join(' ')}` : '';
      const desc = oneLine(item.desc) ? ` —— ${oneLine(item.desc)}` : '';
      return `  - ${oneLine(item.name)}${qty}${place}${desc}`;
    });
  return lines.length ? `物品清单：\n${lines.join('\n')}` : '';
}

function classifyNpcs(npcs, snapshot) {
  const location = oneLine(snapshot?.state?.location);
  const locationPath = Array.isArray(snapshot?.state?.locationPath)
    ? snapshot.state.locationPath.map(oneLine).filter(Boolean)
    : [];
  const groups = { important: [], present: [], nearby: [], absent: [] };
  for (const npc of Array.isArray(npcs) ? npcs : []) {
    if (!oneLine(npc?.name)) continue;
    if (npc.important) groups.important.push(npc);
    else if (npc.follow || oneLine(npc.location) === location) groups.present.push(npc);
    else if (locationPath.includes(oneLine(npc.location))) groups.nearby.push(npc);
    else groups.absent.push(npc);
  }
  return groups;
}

function relationHead(value) {
  const relation = oneLine(value);
  if (!relation) return '';
  const head = relation.split(/[,，;；、——]/)[0].trim();
  return head.length <= 12 ? head : '';
}

function formatNpcLine(npc, detail = 'full') {
  const name = oneLine(npc.name);
  const identity = [
    oneLine(npc.gender) ? `·${oneLine(npc.gender)}` : '',
    oneLine(npc.title) ? `·${oneLine(npc.title)}` : '',
  ].filter(Boolean).join('');
  const identityBlock = identity ? `(${identity})` : '';
  const relation = oneLine(npc.relation);
  if (detail === 'main') {
    const state = [
      oneLine(npc.outfit) ? `着装:${oneLine(npc.outfit)}` : '',
      oneLine(npc.condition) ? `状态:${oneLine(npc.condition)}` : '',
      npc.follow ? '随行' : oneLine(npc.location) ? `在:${oneLine(npc.location)}` : '',
    ].filter(Boolean);
    const relationText = relation ? ` —— 与主角:${relation}` : '';
    return `  - ${name}${identityBlock}${relationText}${state.length ? ` 〔${state.join(';')}〕` : ''}`;
  }
  if (detail === 'present') {
    const profile = [
      relation ? `与主角:${relation}` : '',
      oneLine(npc.personality) ? `性格:${oneLine(npc.personality)}` : '',
      oneLine(npc.desc),
    ].filter(Boolean);
    const place = npc.follow ? ' [随行]' : '';
    const state = [
      oneLine(npc.outfit) ? `着装:${oneLine(npc.outfit)}` : '',
      oneLine(npc.condition) ? `状态:${oneLine(npc.condition)}` : '',
    ].filter(Boolean);
    return `  - ${name}${identityBlock}${place}${profile.length ? ` —— ${profile.join(';')}` : ''}${state.length ? ` 〔${state.join(';')}〕` : ''}`;
  }
  if (detail === 'nearby') {
    const profile = [
      relation ? `与主角:${relation}` : '',
      oneLine(npc.personality) ? `性格:${oneLine(npc.personality)}` : '',
    ].filter(Boolean);
    const personality = profile.length ? ` —— ${profile.join(';')}` : '';
    const place = oneLine(npc.location) ? ` [在:${oneLine(npc.location)}]` : '';
    return `  - ${name}${identityBlock}${personality}${place}`;
  }
  const shortRelation = relationHead(npc.relation);
  const shortIdentity = [
    oneLine(npc.gender) ? `·${oneLine(npc.gender)}` : '',
    shortRelation ? `·${shortRelation}` : '',
    oneLine(npc.title) ? `·${oneLine(npc.title)}` : '',
  ].filter(Boolean).join('');
  const place = oneLine(npc.location) ? ` [在:${oneLine(npc.location)}]` : '';
  return `  - ${name}${shortIdentity ? `(${shortIdentity})` : ''}${place}`;
}

function formatNpcGroup(label, npcs, detail) {
  if (!npcs.length) return '';
  return `${label}:\n${npcs.map((npc) => formatNpcLine(npc, detail)).join('\n')}`;
}

function formatNpcTies(npcs) {
  const grouped = new Map();
  for (const npc of Array.isArray(npcs) ? npcs : []) {
    const name = oneLine(npc?.name);
    const ties = oneLine(npc?.ties);
    if (!name || !ties) continue;
    const key = name.toLowerCase();
    if (!grouped.has(key)) grouped.set(key, { name, ties: [], seen: new Set() });
    const entry = grouped.get(key);
    for (const tie of ties.split(/[；;]/).map((item) => item.trim()).filter(Boolean)) {
      const tieKey = tie.toLowerCase();
      if (entry.seen.has(tieKey)) continue;
      entry.seen.add(tieKey);
      entry.ties.push(tie);
    }
  }
  const rows = [...grouped.values()].map((entry) => `  - ${entry.name}:${entry.ties.join(';')}`);
  return rows.length
    ? `角色长期关系(血缘/婚姻/主仆/宿敌等，不因是否在场而失效):\n${rows.join('\n')}`
    : '';
}

function formatNpcs(npcs, snapshot) {
  const groups = classifyNpcs(npcs, snapshot);
  const sections = [
    formatNpcTies(npcs),
    formatNpcGroup('主要角色', groups.important, 'main'),
    formatNpcGroup('在场角色', groups.present, 'present'),
    formatNpcGroup('同区域角色', groups.nearby, 'nearby'),
    formatNpcGroup('其他已知角色', groups.absent, 'short'),
  ].filter(Boolean);
  return sections.length ? `NPC名册:\n${sections.join('\n')}` : '';
}

function formatPlans(plans) {
  const lines = (Array.isArray(plans) ? plans : [])
    .filter((plan) => textOf(plan?.content) && plan?.status === 'open')
    .map((plan, index) => {
      const kind = plan.kind === 'suspense' ? '悬念' : '计划';
      const created = oneLine(plan.createdTime);
      const target = oneLine(plan.targetTime);
      const timing = [created ? `立于 ${created}` : '', target ? `目标 ${target}` : ''].filter(Boolean).join(' · ');
      return `  p${index + 1}. [${kind}] ${oneLine(plan.content)}${timing ? `(${timing})` : ''}`;
    });
  return lines.length ? `未了结的计划/悬念:\n${lines.join('\n')}` : '';
}

function getCurrentCharacter(context) {
  if (context?.groupId) return {};
  const characterId = context?.characterId ?? context?.this_chid;
  if (characterId === undefined || characterId === null || String(characterId).trim() === '') {
    return context?.character || {};
  }
  return context?.characters?.[characterId] || context?.character || {};
}

function getBaiBaiVariableMeaning(context) {
  const settings = context?.extensionSettings?.baibai_book || {};
  const character = getCurrentCharacter(context);
  const characterData = character?.data || {};
  const characterKey = oneLine(character?.avatar || characterData?.avatar || character?.name || characterData?.name);
  const characterTemplate = characterKey && settings?.varsTemplateByChar?.[characterKey];
  const chatMetadata = context?.chatMetadata || context?.chat_metadata || {};
  const chatTemplate = chatMetadata?.baibai_book?.varsTemplate;
  return [
    settings?.varsGlobalTemplate?.meaning,
    characterTemplate?.meaning,
    chatTemplate?.meaning,
  ].map(oneLine).filter(Boolean).join('\n\n');
}

function formatVars(vars, meaning = '') {
  if (!vars || typeof vars !== 'object' || Array.isArray(vars) || !Object.keys(vars).length) return '';
  const meaningBlock = meaning ? `\n变量含义(仅帮你理解上面的值,不要输出):\n${meaning}` : '';
  return `自定义变量:\n${JSON.stringify(vars, null, 2)}${meaningBlock}`;
}

function buildHistoryText(history) {
  const text = textOf(history?.relativeText || history?.text);
  return text ? `${RUNTIME_CONTEXT_NOTE}\n[历史剧情摘要]\n${text}\n${RUNTIME_CONTEXT_END}` : '';
}

function getProtagonistName(context, substituteParams) {
  if (typeof substituteParams === 'function') {
    try {
      const name = oneLine(substituteParams('{{user}}'));
      if (name && name !== '{{user}}') return name;
    } catch (_) {
      // Fall back to the generic label when Tavern's macro function is unavailable.
    }
  }
  return '主角';
}

function buildStateText(snapshot, context, substituteParams) {
  if (!snapshot) return '';
  const state = snapshot.state || {};
  const sections = [
    `[当前状态]\n当前时间:${oneLine(state.time)}\n当前地点:${oneLine(state.location)}`,
    formatScenes(snapshot),
    formatProtagonist(
      snapshot.protagonist,
      getProtagonistName(context, substituteParams || context?.substituteParams),
    ),
    formatItems(snapshot.items),
    formatNpcs(snapshot.npcs, snapshot),
    formatPlans(snapshot.plans),
    formatVars(snapshot.vars, getBaiBaiVariableMeaning(context)),
  ].filter((section) => oneLine(section));
  return `${RUNTIME_CONTEXT_NOTE}\n${sections.join('\n')}\n${RUNTIME_CONTEXT_END}`;
}

export function buildBaiBaiBookInjections({ api, context, substituteParams, includeHistory = false, includeState = false } = {}) {
  if (!api) return [];
  const injections = [];
  if (includeHistory && typeof api.getInjectedHistory === 'function') {
    const history = buildHistoryText(api.getInjectedHistory());
    if (history) injections.push({ role: 'system', content: history, depth: 9999, order: 100, preserveSystemMessage: true });
  }
  if (includeState) {
    const snapshot = selectBaiBaiBookSnapshot(api, context);
    const state = buildStateText(snapshot, context, substituteParams);
    if (state) {
      const floor = latestAssistantFloor(context);
      let depth = 2;
      if (floor !== null) {
        try { depth = api.getFloor(floor)?.memory?.valid ? 1 : 2; } catch (_) { depth = 2; }
      }
      injections.push({ role: 'system', content: state, depth, order: 100, preserveSystemMessage: true });
    }
  }
  return injections;
}

export function getBaiBaiBookApi(targetWindow) {
  const api = targetWindow?.STBaiBaiBook;
  return api && typeof api.getSnapshot === 'function' ? api : null;
}

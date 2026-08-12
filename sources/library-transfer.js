const FORMAT_NAME = 'st-end-component-library';
const FORMAT_VERSION = 1;
const COMPONENT_SCOPE_GLOBAL = '全局';
const COMPONENT_SCOPE_PRESET = '预设';
const COMPONENT_SCOPE_CHARACTER = '角色';

const textOf = (value) => String(value ?? '').trim();
const scopeOrder = [COMPONENT_SCOPE_GLOBAL, COMPONENT_SCOPE_PRESET, COMPONENT_SCOPE_CHARACTER];
const defaultGroupNames = {
  [COMPONENT_SCOPE_GLOBAL]: '全局默认分组',
  [COMPONENT_SCOPE_PRESET]: '预设默认分组',
  [COMPONENT_SCOPE_CHARACTER]: '角色默认分组',
};

function exportItem(item) {
  return {
    name: textOf(item?.name) || '未命名条目',
    content: String(item?.content ?? ''),
    enabled: item?.enabled !== false,
    source: textOf(item?.source),
    sourceType: textOf(item?.sourceType),
  };
}

function selectedItems(items, selectedIds) {
  const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  return (Array.isArray(items) ? items : []).filter((item) => selected.has(textOf(item?.id)));
}

function createExportGroup(name, library, enabled, items) {
  return { name, library, enabled: enabled !== false, items: items.map(exportItem) };
}

export function createLibraryExportPackage({
  components = [],
  componentGroups = [],
  theaterComponents = [],
  theaterGroups = [],
  selectedComponentIds = new Set(),
  selectedTheaterIds = new Set(),
  defaultGroupEnabled = {},
  theaterDefaultGroupEnabled = true,
  exportedAt = new Date().toISOString(),
} = {}) {
  const chosenComponents = selectedItems(components, selectedComponentIds);
  const chosenTheaters = selectedItems(theaterComponents, selectedTheaterIds);
  const componentGroupMap = new Map((Array.isArray(componentGroups) ? componentGroups : []).map((group) => [textOf(group?.id), group]));
  const theaterGroupMap = new Map((Array.isArray(theaterGroups) ? theaterGroups : []).map((group) => [textOf(group?.id), group]));
  const componentExportGroups = [];

  scopeOrder.forEach((scope) => {
    (Array.isArray(componentGroups) ? componentGroups : [])
      .filter((group) => textOf(group?.scope) === scope)
      .forEach((group) => {
        const items = chosenComponents.filter((item) => textOf(item?.groupId) === textOf(group?.id));
        if (items.length) componentExportGroups.push(createExportGroup(textOf(group?.name) || '未命名分组', 'components', group?.enabled !== false, items));
      });
    const ungrouped = chosenComponents.filter((item) => textOf(item?.scope) === scope && !textOf(item?.groupId));
    if (ungrouped.length) componentExportGroups.push(createExportGroup(defaultGroupNames[scope], 'components', defaultGroupEnabled?.[scope] !== false, ungrouped));
  });
  const orphanedComponents = chosenComponents.filter((item) => {
    const groupId = textOf(item?.groupId);
    return groupId && !componentGroupMap.has(groupId);
  });
  if (orphanedComponents.length) componentExportGroups.push(createExportGroup('未匹配分组', 'components', true, orphanedComponents));

  const theaterExportGroups = [];
  (Array.isArray(theaterGroups) ? theaterGroups : []).forEach((group) => {
    const items = chosenTheaters.filter((item) => textOf(item?.groupId) === textOf(group?.id));
    if (items.length) theaterExportGroups.push(createExportGroup(textOf(group?.name) || '未命名分组', 'theater', group?.enabled !== false, items));
  });
  const ungroupedTheaters = chosenTheaters.filter((item) => !textOf(item?.groupId));
  if (ungroupedTheaters.length) theaterExportGroups.push(createExportGroup('小剧场默认分组', 'theater', theaterDefaultGroupEnabled !== false, ungroupedTheaters));
  const orphanedTheaters = chosenTheaters.filter((item) => {
    const groupId = textOf(item?.groupId);
    return groupId && !theaterGroupMap.has(groupId);
  });
  if (orphanedTheaters.length) theaterExportGroups.push(createExportGroup('未匹配分组', 'theater', true, orphanedTheaters));

  return {
    format: FORMAT_NAME,
    version: FORMAT_VERSION,
    exportedAt,
    libraries: {
      components: { groups: componentExportGroups },
      theater: { groups: theaterExportGroups },
    },
  };
}

function normalizeGroups(value, library) {
  if (!Array.isArray(value?.groups)) return [];
  return value.groups.map((group) => {
    if (group?.library && group.library !== library) throw new Error('导入文件中的库类型不一致。');
    if (!Array.isArray(group?.items)) throw new Error('导入文件中的分组条目格式不正确。');
    return {
      name: textOf(group?.name) || '未命名分组',
      enabled: group?.enabled !== false,
      items: group.items.map(exportItem),
    };
  });
}

export function importLibraryPackage(bundle, idFactories = {}) {
  if (bundle?.format !== FORMAT_NAME || Number(bundle?.version) !== FORMAT_VERSION) throw new Error('无法识别这个组件库文件。');
  const createComponentId = idFactories.createComponentId;
  const createComponentGroupId = idFactories.createComponentGroupId;
  const createTheaterId = idFactories.createTheaterId;
  const createTheaterGroupId = idFactories.createTheaterGroupId;
  if ([createComponentId, createComponentGroupId, createTheaterId, createTheaterGroupId].some((factory) => typeof factory !== 'function')) throw new Error('导入组件库时无法创建新标识。');

  const components = [];
  const componentGroups = normalizeGroups(bundle?.libraries?.components, 'components').map((group, order) => {
    const id = createComponentGroupId();
    group.items.forEach((item) => components.push({
      ...item,
      id: createComponentId(),
      scope: COMPONENT_SCOPE_GLOBAL,
      presetSchemeId: '',
      bindName: '',
      groupId: id,
    }));
    return { id, name: group.name, scope: COMPONENT_SCOPE_GLOBAL, enabled: group.enabled, order };
  });

  const theaterComponents = [];
  const theaterGroups = normalizeGroups(bundle?.libraries?.theater, 'theater').map((group, order) => {
    const id = createTheaterGroupId();
    group.items.forEach((item) => theaterComponents.push({ ...item, id: createTheaterId(), groupId: id }));
    return { id, name: group.name, enabled: group.enabled, order };
  });

  return { components, componentGroups, theaterComponents, theaterGroups };
}

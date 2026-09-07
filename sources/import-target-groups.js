const textOf = (value) => String(value ?? '').trim();

function normalizeOrderedGroups(groups) {
  return (Array.isArray(groups) ? groups : [])
    .map((group, index) => ({
      id: textOf(group?.id),
      name: textOf(group?.name),
      scope: textOf(group?.scope),
      order: Number.isFinite(Number(group?.order)) ? Number(group.order) : index,
      index,
    }))
    .filter((group) => group.id && group.name)
    .sort((left, right) => left.order - right.order || left.index - right.index);
}

export function listImportTargetGroups({ library, scope, componentGroups, theaterGroups } = {}) {
  const groups = library === 'theater' ? theaterGroups : componentGroups;
  const normalizedScope = textOf(scope) || '全局';
  return normalizeOrderedGroups(groups)
    .filter((group) => library === 'theater' || group.scope === normalizedScope)
    .map(({ id, name }) => ({ id, name }));
}

export function resolveImportTargetGroupId(options = {}) {
  const requestedId = textOf(options.groupId);
  if (!requestedId) return '';
  return listImportTargetGroups(options).some((group) => group.id === requestedId) ? requestedId : '';
}

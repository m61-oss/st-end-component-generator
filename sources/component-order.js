const textOf = (value) => String(value ?? '').trim();

function unchanged(components) {
  return { moved: false, components };
}

function findValidGroup(componentGroups, scope, groupId) {
  const id = textOf(groupId);
  if (!id) return null;
  return componentGroups.find((group) => textOf(group?.id) === id && textOf(group?.scope) === scope) || null;
}

export function applyComponentPositionMove(components, componentGroups, sourceIdOrIds, target, options = {}) {
  if (!Array.isArray(components) || !Array.isArray(componentGroups) || !target) return unchanged(components);

  const rawSourceIds = Array.isArray(sourceIdOrIds) ? sourceIdOrIds : [sourceIdOrIds];
  const sourceIds = [...new Set(rawSourceIds.map(textOf).filter(Boolean))];
  const sourceIdSet = new Set(sourceIds);
  if (!sourceIds.length || (Array.isArray(sourceIdOrIds)
    && sourceIds.length === 1
    && rawSourceIds.map(textOf).filter(Boolean).length > 1)) return unchanged(components);

  const source = components.find((component) => textOf(component?.id) === sourceIds[0]);
  if (!source) return unchanged(components);

  const sourceScope = textOf(source.scope);
  const eligibleIdSet = Array.isArray(options.eligibleComponentIds)
    ? new Set(options.eligibleComponentIds.map(textOf).filter(Boolean))
    : null;
  const eligibleIndexes = components.reduce((indexes, component, index) => {
    const componentId = textOf(component?.id);
    if (textOf(component?.scope) === sourceScope && (!eligibleIdSet || eligibleIdSet.has(componentId))) indexes.push(index);
    return indexes;
  }, []);
  const eligibleComponents = eligibleIndexes.map((index) => components[index]);
  const eligibleSourceIdSet = new Set(eligibleComponents.map((component) => textOf(component?.id)));
  if (sourceIds.some((id) => !eligibleSourceIdSet.has(id))) return unchanged(components);
  const movingComponents = eligibleComponents.filter((component) => sourceIdSet.has(textOf(component?.id)));
  let targetGroupId = '';
  let targetComponentId = '';

  if (target.kind === 'after') {
    targetComponentId = textOf(target.componentId);
    if (!targetComponentId || sourceIdSet.has(targetComponentId)) return unchanged(components);
    const targetComponent = eligibleComponents.find((component) => textOf(component?.id) === targetComponentId);
    if (!targetComponent || textOf(targetComponent.scope) !== sourceScope) return unchanged(components);
    const requestedGroupId = textOf(targetComponent.groupId);
    targetGroupId = findValidGroup(componentGroups, sourceScope, requestedGroupId)?.id || '';
  } else if (target.kind === 'group-start') {
    const targetScope = textOf(target.scope);
    if (targetScope !== sourceScope) return unchanged(components);
    const requestedGroupId = textOf(target.groupId);
    if (requestedGroupId && !findValidGroup(componentGroups, sourceScope, requestedGroupId)) return unchanged(components);
    targetGroupId = requestedGroupId;
  } else {
    return unchanged(components);
  }

  if (target.kind === 'group-start') {
    const targetGroupComponents = eligibleComponents.filter((component) => {
      const componentGroupId = findValidGroup(componentGroups, sourceScope, component?.groupId)?.id || '';
      return componentGroupId === targetGroupId;
    });
    const alreadyAtGroupStart = movingComponents.every((component, index) => {
      const sourceGroupId = findValidGroup(componentGroups, sourceScope, component?.groupId)?.id || '';
      return sourceGroupId === targetGroupId
        && textOf(component.groupId) === targetGroupId
        && textOf(targetGroupComponents[index]?.id) === textOf(component.id);
    });
    if (alreadyAtGroupStart) return unchanged(components);
  }

  const remaining = eligibleComponents.filter((component) => !sourceIdSet.has(textOf(component?.id)));
  let insertIndex = remaining.length;
  if (target.kind === 'after') {
    const targetIndex = remaining.findIndex((component) => textOf(component?.id) === targetComponentId);
    if (targetIndex < 0) return unchanged(components);
    insertIndex = targetIndex + 1;
  } else {
    const firstGroupIndex = remaining.findIndex((component) => {
      if (textOf(component?.scope) !== sourceScope) return false;
      const componentGroupId = findValidGroup(componentGroups, sourceScope, component?.groupId)?.id || '';
      return componentGroupId === targetGroupId;
    });
    if (firstGroupIndex >= 0) insertIndex = firstGroupIndex;
  }

  const movedSources = movingComponents.map((component) => {
    const sourceGroupId = findValidGroup(componentGroups, sourceScope, component.groupId)?.id || '';
    return sourceGroupId === targetGroupId && textOf(component.groupId) === targetGroupId
      ? component
      : { ...component, groupId: targetGroupId };
  });
  const nextEligibleComponents = remaining.slice();
  nextEligibleComponents.splice(insertIndex, 0, ...movedSources);
  const nextComponents = components.slice();
  eligibleIndexes.forEach((componentIndex, index) => {
    nextComponents[componentIndex] = nextEligibleComponents[index];
  });

  const moved = nextComponents.length === components.length
    && nextComponents.some((component, index) => component !== components[index]);
  return moved ? { moved: true, components: nextComponents } : unchanged(components);
}

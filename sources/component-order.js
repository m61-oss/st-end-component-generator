const textOf = (value) => String(value ?? '').trim();

function unchanged(components) {
  return { moved: false, components };
}

function findValidGroup(componentGroups, scope, groupId) {
  const id = textOf(groupId);
  if (!id) return null;
  return componentGroups.find((group) => textOf(group?.id) === id && textOf(group?.scope) === scope) || null;
}

export function applyComponentPositionMove(components, componentGroups, sourceId, target, options = {}) {
  if (!Array.isArray(components) || !Array.isArray(componentGroups) || !target) return unchanged(components);

  const id = textOf(sourceId);
  const sourceIndex = components.findIndex((component) => textOf(component?.id) === id);
  const source = components[sourceIndex];
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
  const eligibleSourceIndex = eligibleComponents.findIndex((component) => textOf(component?.id) === id);
  if (eligibleSourceIndex < 0) return unchanged(components);
  let targetGroupId = '';
  let targetComponentId = '';

  if (target.kind === 'after') {
    targetComponentId = textOf(target.componentId);
    if (!targetComponentId || targetComponentId === id) return unchanged(components);
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
    const firstTargetGroupComponent = eligibleComponents.find((component) => {
      const componentGroupId = findValidGroup(componentGroups, sourceScope, component?.groupId)?.id || '';
      return componentGroupId === targetGroupId;
    });
    if (textOf(firstTargetGroupComponent?.id) === id) return unchanged(components);
  }

  const remaining = eligibleComponents.filter((_, index) => index !== eligibleSourceIndex);
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

  const sourceGroupId = findValidGroup(componentGroups, sourceScope, source.groupId)?.id || '';
  const movedSource = sourceGroupId === targetGroupId && textOf(source.groupId) === targetGroupId
    ? source
    : { ...source, groupId: targetGroupId };
  const nextEligibleComponents = remaining.slice();
  nextEligibleComponents.splice(insertIndex, 0, movedSource);
  const nextComponents = components.slice();
  eligibleIndexes.forEach((componentIndex, index) => {
    nextComponents[componentIndex] = nextEligibleComponents[index];
  });

  const moved = nextComponents.length === components.length
    && nextComponents.some((component, index) => component !== components[index]);
  return moved ? { moved: true, components: nextComponents } : unchanged(components);
}

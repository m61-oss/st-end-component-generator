const textOf = (value) => String(value ?? '').trim();

function unchanged(components) {
  return { moved: false, components };
}

function findValidGroup(componentGroups, scope, groupId) {
  const id = textOf(groupId);
  if (!id) return null;
  return componentGroups.find((group) => textOf(group?.id) === id && textOf(group?.scope) === scope) || null;
}

export function applyComponentPositionMove(components, componentGroups, sourceId, target) {
  if (!Array.isArray(components) || !Array.isArray(componentGroups) || !target) return unchanged(components);

  const id = textOf(sourceId);
  const sourceIndex = components.findIndex((component) => textOf(component?.id) === id);
  const source = components[sourceIndex];
  if (!source) return unchanged(components);

  const sourceScope = textOf(source.scope);
  let targetGroupId = '';
  let targetComponentId = '';

  if (target.kind === 'after') {
    targetComponentId = textOf(target.componentId);
    if (!targetComponentId || targetComponentId === id) return unchanged(components);
    const targetComponent = components.find((component) => textOf(component?.id) === targetComponentId);
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

  const remaining = components.filter((_, index) => index !== sourceIndex);
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
  const nextComponents = remaining.slice();
  nextComponents.splice(insertIndex, 0, movedSource);

  const moved = nextComponents.length === components.length
    && nextComponents.some((component, index) => component !== components[index]);
  return moved ? { moved: true, components: nextComponents } : unchanged(components);
}

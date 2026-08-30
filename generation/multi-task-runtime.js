import { applyComponentSchemeSnapshot } from '../settings/component-schemes.js';

const textOf = (value) => String(value ?? '').trim();
const clone = (value) => {
  if (typeof globalThis.structuredClone === 'function') return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

function runtimeError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requireScheme(list, id, type, { optional = false } = {}) {
  const schemeId = textOf(id);
  if (!schemeId) {
    if (optional) return null;
    throw runtimeError(`missing-${type}-scheme`, `Task has no ${type} scheme`);
  }
  const scheme = (Array.isArray(list) ? list : []).find((item) => textOf(item?.id) === schemeId);
  if (!scheme) throw runtimeError(`unknown-${type}-scheme`, `The selected ${type} scheme no longer exists`);
  return scheme;
}

function applyPreset(runtime, scheme) {
  if (!scheme) {
    return {
      ...runtime,
      presetRuntimeMode: 'tavern',
      activeSourcePreset: '',
      promptSelections: {},
      sourceContentOverrides: {},
    };
  }
  const snapshot = clone(scheme.snapshot || {});
  return {
    ...runtime,
    ...snapshot,
    presetRuntimeMode: 'scheme',
    presetSchemeId: scheme.id,
    promptSelections: { ...(runtime.promptSelections || {}), ...(snapshot.promptSelections || {}) },
    sourceContentOverrides: { ...(runtime.sourceContentOverrides || {}), ...(snapshot.sourceContentOverrides || {}) },
  };
}

function applyWorldbook(runtime, scheme) {
  if (!scheme) {
    return {
      ...runtime,
      worldbookRuntimeMode: 'tavern',
      worldbookDraftSources: [],
      promptSelections: { ...(runtime.promptSelections || {}) },
      worldbookActivationOverrides: {},
      worldbookKeywordOverrides: {},
    };
  }
  const snapshot = clone(scheme.snapshot || {});
  return {
    ...runtime,
    ...snapshot,
    worldbookRuntimeMode: 'scheme',
    worldbookSchemeId: scheme.id,
    worldbookDraftSources: Array.isArray(snapshot.worldbookSources) ? [...snapshot.worldbookSources] : [],
    promptSelections: { ...(runtime.promptSelections || {}), ...(snapshot.promptSelections || {}) },
    sourceContentOverrides: { ...(runtime.sourceContentOverrides || {}), ...(snapshot.sourceContentOverrides || {}) },
    worldbookActivationOverrides: { ...(snapshot.worldbookActivationOverrides || {}) },
    worldbookKeywordOverrides: { ...(snapshot.worldbookKeywordOverrides || {}) },
  };
}

export function resolveMultiTaskRuntimeSettings(baseSettings = {}, task = {}, schemeLists = {}) {
  const apiScheme = requireScheme(schemeLists.apiSchemes, task.apiSchemeId, 'api');
  const componentScheme = requireScheme(schemeLists.componentSchemes, task.componentSchemeId, 'component');
  const presetScheme = requireScheme(schemeLists.presetSchemes, task.presetSchemeId, 'preset', { optional: true });
  const worldbookScheme = requireScheme(schemeLists.worldbookSchemes, task.worldbookSchemeId, 'worldbook', { optional: true });

  let runtime = {
    ...clone(baseSettings),
    ...clone(apiScheme.snapshot || {}),
    promptSelections: {},
    sourceContentOverrides: {},
    worldbookActivationOverrides: {},
    worldbookKeywordOverrides: {},
    taskId: textOf(task.id),
    taskName: textOf(task.name),
    extraInstruction: String(task.extraInstruction ?? ''),
    injectMode: task.injectMode === 'anchor' ? 'anchor' : 'append',
  };
  runtime = applyPreset(runtime, presetScheme);
  runtime = applyWorldbook(runtime, worldbookScheme);
  runtime = applyComponentSchemeSnapshot(runtime, componentScheme.snapshot || {});
  runtime.componentSchemeId = componentScheme.id;
  runtime.apiSchemeId = apiScheme.id;
  return runtime;
}

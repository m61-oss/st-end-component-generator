const textOf = (value) => String(value ?? '').trim();

export const DEFAULT_TASK_INSTRUCTION = [
  '现在停止生成正文，为最新的正文补充以下内容，未提及的内容禁止擅自添加。',
  '',
  '——补充内容开始——',
  '{{external_components}}',
  '——补充内容结束——',
].join('\n');

const OLD_DEFAULT_TASK_INSTRUCTION = [
  '现在停止生成正文，为最新的正文补充下面这些内容。',
  '{{external_components}}',
  '上方为需要补充的内容，现在开始输出思考过程并按规则和格式输出需要补充的内容，禁止额外生成正文。',
].join('\n');

export function migrateDefaultTaskInstruction(value) {
  return value === OLD_DEFAULT_TASK_INSTRUCTION ? DEFAULT_TASK_INSTRUCTION : value;
}

export function composeTaskInstruction(taskPrompt, temporaryInstruction) {
  const task = String(taskPrompt ?? '').trimEnd();
  const temporary = textOf(temporaryInstruction);
  if (!temporary) return task;
  return task ? `${task}\n${temporary}` : temporary;
}

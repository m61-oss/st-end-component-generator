const textOf = (value) => String(value ?? '').trim();

export function composeTaskInstruction(taskPrompt, temporaryInstruction) {
  const task = String(taskPrompt ?? '').trimEnd();
  const temporary = textOf(temporaryInstruction);
  if (!temporary) return task;
  return task ? `${task}\n${temporary}` : temporary;
}

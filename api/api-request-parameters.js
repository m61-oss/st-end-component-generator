const textOf = (value) => String(value ?? '').trim();
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export class ApiParameterValidationError extends Error {
  constructor(field, message, { line = null, column = null } = {}) {
    const location = line ? `（第 ${line} 行${column ? `，第 ${column} 列` : ''}）` : '';
    super(`${field}：${message}${location}`);
    this.name = 'ApiParameterValidationError';
    this.field = field;
    this.line = line;
    this.column = column;
  }
}

function getParserLocation(error) {
  const position = Array.isArray(error?.linePos) ? error.linePos[0] : null;
  if (Array.isArray(position)) return { line: position[0] ?? null, column: position[1] ?? null };
  return { line: position?.line ?? null, column: position?.col ?? position?.column ?? null };
}

function parseYamlSource(source, field, yamlParser) {
  if (!textOf(source)) return null;
  try {
    return yamlParser.parse(String(source));
  } catch (error) {
    const location = getParserLocation(error);
    throw new ApiParameterValidationError(field, error?.message || 'YAML 格式错误', location);
  }
}

function parseIncludedObject(source, field, yamlParser) {
  const parsed = parseYamlSource(source, field, yamlParser);
  if (parsed === null) return {};
  if (isRecord(parsed)) return { ...parsed };
  if (Array.isArray(parsed) && parsed.every(isRecord)) return Object.assign({}, ...parsed);
  throw new ApiParameterValidationError(field, '顶层必须是对象，或由对象组成的列表');
}

function parseExcludedKeys(source, field, yamlParser) {
  const parsed = parseYamlSource(source, field, yamlParser);
  if (parsed === null) return [];
  if (typeof parsed === 'string' && parsed.trim()) return [parsed.trim()];
  if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string' && item.trim())) {
    return [...new Set(parsed.map((item) => item.trim()))];
  }
  if (isRecord(parsed)) return Object.keys(parsed);
  throw new ApiParameterValidationError(field, '顶层必须是字段名、字段名列表或对象');
}

export function parseApiNumericSettings({ maxTokens, temperature }) {
  const parsedMaxTokens = Number(maxTokens);
  const parsedTemperature = Number(temperature);
  if (!Number.isInteger(parsedMaxTokens) || parsedMaxTokens <= 0) {
    throw new ApiParameterValidationError('最大 Token', '必须填写大于 0 的整数');
  }
  if (!Number.isFinite(parsedTemperature)) {
    throw new ApiParameterValidationError('温度', '必须填写有效数字');
  }
  return { maxTokens: parsedMaxTokens, temperature: parsedTemperature };
}

export function parseApiAdditionalParameters(settings, yamlParser) {
  const additionalBodyYaml = settings?.additionalBodyYaml;
  const excludedBodyYaml = settings?.excludedBodyYaml;
  const additionalHeadersYaml = settings?.additionalHeadersYaml;
  if (!textOf(additionalBodyYaml) && !textOf(excludedBodyYaml) && !textOf(additionalHeadersYaml)) {
    return { additionalBody: {}, excludedBodyKeys: [], additionalHeaders: {} };
  }
  if (!yamlParser || typeof yamlParser.parse !== 'function') {
    throw new ApiParameterValidationError('附加参数', '酒馆 YAML 解析器不可用');
  }
  return {
    additionalBody: parseIncludedObject(additionalBodyYaml, '追加请求体参数', yamlParser),
    excludedBodyKeys: parseExcludedKeys(excludedBodyYaml, '排除请求体参数', yamlParser),
    additionalHeaders: parseIncludedObject(additionalHeadersYaml, '追加请求头', yamlParser),
  };
}

export function serializeRequestHeadersYaml(headers) {
  if (!isRecord(headers)) return '';
  return Object.entries(headers)
    .filter(([name, value]) => textOf(name) && value !== null && value !== undefined)
    .map(([name, value]) => `${JSON.stringify(String(name))}: ${JSON.stringify(String(value))}`)
    .join('\n');
}

export function buildApiRequestParts(baseBody, baseHeaders, parsed) {
  const body = { ...baseBody, ...(parsed?.additionalBody || {}) };
  for (const key of parsed?.excludedBodyKeys || []) delete body[key];
  return {
    body,
    headers: { ...baseHeaders, ...(parsed?.additionalHeaders || {}) },
  };
}

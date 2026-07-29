# API Additional Parameters Design

## Goal

Mirror SillyTavern's native custom-endpoint Additional Parameters workflow in the
extension while adding save-time YAML validation. Restore editable temperature
and maximum-token inputs and use their actual values in generation requests.

## Reference behavior

SillyTavern's release branch stores three YAML strings for custom endpoints:

- body parameters to include;
- body parameters to exclude;
- request headers to include.

It builds the default request body, merges included body parameters, removes
excluded keys, and merges custom headers into the request headers. The extension
will follow this request order while using a confirm/cancel dialog instead of
SillyTavern's immediate-save popup.

References:

- `public/scripts/openai.js`, especially `onCustomizeParametersClick` and custom
  request construction:
  https://github.com/SillyTavern/SillyTavern/blob/release/public/scripts/openai.js
- `public/scripts/templates/customEndpointAdditionalParameters.html`:
  https://github.com/SillyTavern/SillyTavern/blob/release/public/scripts/templates/customEndpointAdditionalParameters.html
- SillyTavern's browser library export for `yaml`:
  https://github.com/SillyTavern/SillyTavern/blob/release/public/lib.js

## API settings interface

The API section uses this reading order:

1. API URL
2. API Key
3. Model
4. Temperature and maximum tokens
5. Streaming option
6. Action row

Temperature and maximum tokens are editable numeric inputs. Their defaults are:

- temperature: `1`
- maximum tokens: `65535`

Maximum tokens must be a positive integer. Temperature must be a finite number.
Invalid numeric values prevent generation and show a useful warning.

The action row contains `拉取模型`, followed immediately by `附加参数`.

## Additional Parameters dialog

The extension owns a themed modal dialog containing three YAML textareas:

1. `追加请求体参数`
2. `排除请求体参数`
3. `追加请求头`

The placeholders include examples compatible with SillyTavern's native format.
Opening the dialog copies saved values into a draft. Cancel closes the dialog and
discards the draft.

Save validates all three fields with the `yaml` export from SillyTavern's
`lib.js`:

- included body YAML must be an object or a list of objects;
- excluded body YAML must identify keys with a string, list, or object keys;
- included headers YAML must be an object or a list of objects;
- blank fields are valid and resolve to an empty result.

If parsing or shape validation fails, the dialog stays open, identifies the
failing section, displays the parser's line and column when available, and does
not change saved settings. Successful validation stores all three source strings
together and marks the active API scheme dirty.

## Request construction

Generation uses this order:

1. Parse and validate numeric temperature and maximum-token settings.
2. Build the base body with `model`, `messages`, `max_tokens`, `temperature`, and
   `stream`.
3. Merge included body parameters. These may intentionally override base fields.
4. Remove excluded body keys.
5. Build base headers with `Content-Type` and optional bearer authorization.
6. Merge included request headers. These may intentionally override base headers.

Model-list requests apply custom headers but do not apply request-body additions
or exclusions because the model endpoint is a GET request.

YAML is validated again before use so corrupted or externally edited saved
settings cannot produce an unintended request. A validation failure prevents the
network request and shows the same specific error.

## Persistence and privacy

The three YAML source strings, temperature, and maximum tokens are part of the
extension settings and every API scheme snapshot. Applying or overwriting an API
scheme restores all five values.

Prompt logs use the actual effective temperature and maximum-token values.
Custom header values are never written to prompt logs because they may contain
credentials.

## Verification

Regression tests cover:

- defaults of `1` and `65535`;
- numeric validation and request use of user values;
- successful YAML parsing and merge/exclude precedence;
- invalid YAML and invalid shapes returning section-specific errors;
- no partial save when any dialog field is invalid;
- custom headers on generation and model-list requests;
- API scheme snapshot and restore of all new fields;
- action button order and dialog markup;
- absence of custom header values from prompt logs.

The complete existing test suite and syntax check run after focused tests.

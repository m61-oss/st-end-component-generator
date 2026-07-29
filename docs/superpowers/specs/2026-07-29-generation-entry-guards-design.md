# Generation Entry Guards and Settings Layout Design

## Goal

Fix the worldbook green-light keyword lookup, restore the floating ball's intended
default position, prevent overlapping generation requests according to their
entry point, and reorder the API settings without changing injection behavior.

## Confirmed behavior

- A green-light worldbook entry activates when any configured keyword matches.
- The floating ball starts at the bottom-right when no saved coordinates exist.
  A position explicitly saved by the user remains authoritative.
- Clicking the main Generate button during generation aborts the current request.
- Clicking the Quick Reply Generate shortcut during generation does not abort or
  restart anything and shows `已在生成中`.
- An automatic generation trigger received during generation is ignored silently.
- Injection remains unrestricted and unchanged, including repeated manual injection.
- API settings appear in this order: API URL, API Key, model, then other parameters.

## Implementation design

### Worldbook keyword source

Worldbook import candidates carry a stable internal `key` for identity and
`worldbookKeys` for activation keywords. Green-light matching will prefer
`worldbookKeys` when present and fall back to `key` for raw entries and backward
compatibility.

### Generation entry handling

Keep one shared abort controller as the source of truth for an active generation.
Pass an explicit entry type into the generation function:

- `manual`: abort the active request.
- `quickReply`: show `已在生成中` and return.
- `automatic`: return silently.

When no generation is active, all three entry types follow the existing generation
path. This keeps the guard centralized while preserving the main button's current
stop behavior.

### Floating ball position

Treat only finite numeric saved coordinates as saved. `null`, `undefined`, empty
strings, and invalid values use the default bottom-right coordinates. Existing
viewport clamping remains in place.

### API settings layout

Move the API Key control between API URL and model in the panel markup. Keep field
IDs and persistence behavior unchanged.

## Verification

Add regression tests for:

- Real imported worldbook candidate shape using `worldbookKeys`.
- Missing versus valid saved floating-ball coordinates.
- Manual, Quick Reply, and automatic behavior while generation is active.
- API field source order.

Run the complete test suite after the focused tests.

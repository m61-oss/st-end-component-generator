# Anima Memory Integration Implementation Plan

**Goal:** Keep worldbook entries complete, reuse existing Anima memory entries when they exist, replace Anima state macros from message variables, and expose mutually exclusive memory-source settings without changing the normal prompt ordering.

**Architecture:** Add a small pure Anima adapter for identifying entries, reading message-scoped `anima_data`, and serializing state. Capture the active Anima worldbook entries at generation start and pass that snapshot into the existing prompt builder; the builder overrides matching existing entries only, then continues through the existing selection, green/blue activation, ordering, and injection pipeline. Keep UI changes in `index.js` and add focused regression tests for each pure/helper behavior and markup contract.

**Scope:**

1. Replace the worldbook detail auto-scroll that moves Tavern's outer document with a panel-local, non-invasive scroll operation.
2. Preserve empty worldbook entries in import candidates and selected Anima placeholders when their current content is empty.
3. Capture only existing `[anima_status]`, `[ANIMA_Chat_History_Container]`, and `[ANIMA_Knowledge_Container]` entries; never create a synthetic entry. Override matching entry content from the captured snapshot before normal prompt assembly.
4. Read the latest available message-scoped `anima_data` and replace Anima status macros (`status`, `anima_data`, `ANIMA_STATUS`, `ANIMA_BASE_STATUS`, and nested paths) during prompt construction.
5. Add a collapsible `记忆设置` section with one radio choice (`柏宝书`/`anima`/`无`), conditional checkboxes, and rename the existing template checkbox section to `提示词语法`.

**Verification:** Run the focused tests after each red/green cycle, then run `npm.cmd test`, `node --check index.js`, and `git diff --check` before committing.

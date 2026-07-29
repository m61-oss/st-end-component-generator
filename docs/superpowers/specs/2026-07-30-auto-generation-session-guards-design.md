# Auto-generation Session Guards Design

## Goal

Trigger automatic status-bar generation only after a genuine assistant reply
finishes successfully. Ignore background AI requests, rewritten user messages,
old assistant messages that are merely rendered again, and every generation the
user manually stops.

## Confirmed behavior

- A completed normal, regenerate, swipe, or continue reply triggers automatic
  status-bar generation.
- Quiet generation, impersonation, and dry runs never trigger it.
- A manually stopped generation never triggers it, regardless of how much text
  was already produced.
- Background requests from extensions such as Black Tech Database do not trigger
  it.
- Rewriting or rendering a user or system message does not trigger it.
- Re-rendering an unchanged old assistant message does not trigger it.

## Root causes

The current tracker treats global generation events as a single flat cycle.
Extensions can run nested background generations inside a normal generation, so
their start and end events can replace or finish the wrong cycle.

SillyTavern also emits `GENERATION_ENDED` while hiding the stop button before it
emits `GENERATION_STOPPED`. Waiting one timer tick does not guarantee that the
stop listener runs first because event listeners are asynchronous and ordered.

Finally, `CHARACTER_MESSAGE_RENDERED` proves only that an assistant message was
rendered. It does not prove that the message is a newly completed reply.

## Design

### Session state

Replace the flat candidate tracker with an explicit foreground generation
session. At the start of an eligible generation, capture:

- generation type;
- the current last message index;
- the current last message role and content;
- whether the session has been stopped;
- the candidate assistant message index.

Excluded generation types do not become foreground sessions and must not erase
an already active eligible session.

### Assistant candidate

An assistant render is only a candidate. It must refer to a non-user,
non-system message with non-empty content. Recording it does not immediately
start status-bar generation.

### Manual-stop latch

Register the synchronous stop handler with the highest event priority supported
by SillyTavern. It marks the foreground session as stopped and cancels any
pending completion.

The stopped state survives later end, render, or save events belonging to that
session. It is cleared only when a new eligible foreground generation begins.

### Final validation

Before automatic status-bar generation starts, re-read the chat and require all
of the following:

1. The session was not manually stopped.
2. The candidate still exists.
3. The candidate is the current last chat message.
4. The candidate is an assistant message, not a user or system message.
5. Its content is non-empty.
6. Compared with the session-start snapshot, it is either a newly added
   assistant message or an existing assistant message whose content changed.

This supports normal replies, regeneration, swipes, and continuation while
rejecting background generations and unrelated message refreshes.

### Completion scheduling

`GENERATION_ENDED` requests completion but does not consume the session
immediately. Completion runs after the current event stack settles. A
high-priority stop event cancels the pending completion before final validation.

Only one completion can consume a session, preventing duplicate automatic
status-bar requests.

## Verification

Add focused regression tests for:

- completed normal, regenerate, swipe, and continue replies;
- quiet generation, impersonation, and dry runs;
- stopped generation before any content;
- stopped generation after partial assistant content;
- `GENERATION_ENDED` arriving before `GENERATION_STOPPED`;
- nested quiet generation inside an eligible foreground generation;
- rewritten user message as the current chat tail;
- unchanged old assistant message re-render;
- candidate assistant message that is no longer the chat tail;
- duplicate end events consuming a session only once.

Run the focused test file, syntax checks, and the complete test suite.

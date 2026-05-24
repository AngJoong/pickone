# Pick One MVP Interaction Rules

Status: MVP decision draft
Date: 2026-05-24
Domain: pickone.antabear.com
Tagline: Pick one. Make your case.
Related safety rules: `Pick_One_MVP_Safety_Rules.md`

## Scope

Pick One MVP is an account-based 1:1 choice arena. Users pick one side, write short cases, react to arguments, challenge specific claims, and may later be swayed by a Say from the other side. The product should feel light and fast, but the account history remains durable.

## Product Rules

- Users must sign up and participate with their main account.
- Anonymous, guest, and temporary-nickname participation are out of scope.
- User-created topics and user-suggested topics are out of scope for MVP.
- Topics are curated/admin-seeded only.
- MVP topics are 1:1 choices.
- Topic status is only `active` or `inactive`.
- `inactive` covers not-yet-public, temporarily disabled, and taken-down topics.
- Deleting a topic is a separate destructive action, not a topic status.
- Moderation and punishment state must live in separate future tables, not topic columns.

## Core Actions

- `Pick`: the user's current side on a topic.
- `Say`: a short argument or opinion written for the user's current side.
- `Boost`: support signal for a Say from the same side.
- `Challenge`: direct rebuttal against a specific Say.
- `Mark`: lightweight meta reaction, separate from Report.
- `Swayed`: button label on a Say. When successful, it changes the user's Pick to the Say's side.
- `Sway count` / `sway_count`: the number of successful `Swayed` actions credited to a Say.

## Pick And Swayed

A user has one current Pick per topic.

When a user taps `Swayed` on a Say:

- create a durable `Swayed` event;
- update the user's current Pick to the Say's side;
- preserve previous Pick history;
- attach the Say as the change source;
- increment that Say's `sway_count`.

`Swayed` is the single name for this action across product, events, and data.

Suggested event shape:

```ts
Swayed({
  topic_id,
  user_id,
  from_pick,
  to_pick,
  sway_say_id: string,
  case_text?: string,
  created_at
})
```

`case_text` is optional. A valid `Swayed` action must succeed without written case text. The event stores `case_text` only when the user chooses to add an optional reason.

## Say Rules

A Say belongs to:

- one topic;
- one author;
- one side snapshot at creation time.

The Say side must not change when the author later changes Pick. This keeps old arguments historically honest and prevents timeline items from changing meaning.

## Swayed Validation

`Swayed` succeeds only when:

- the Say belongs to the same topic;
- the Say was written for the opposite side from the user's current Pick;
- the Say was not written by the user tapping `Swayed`;
- the Say is visible and eligible at action time.
- `case_text` is not required for validation.

When valid, the Say gets `sway_count + 1`, or an equivalent derived count from the `Swayed` event log.

MVP UI copy:

- Button: `Swayed`
- Korean count: `이 Say로 {n}명이 선택을 바꿨어요`
- English count: `{n} Sways`
- Optional post-success prompt: ask why the Say swayed the user, but skipping it must not undo or block `Swayed`.

## Challenge Rules

Challenge targets a Say, not a user, topic, or side in general.

MVP challenge meaning:

- "I challenge this argument."
- No formal winner.
- No judge system.
- No deep infinite debate tree.

This keeps conflict anchored to a concrete claim and avoids vague side-level fighting.

## Timeline Rules

Pick One needs both a personal timeline and a global timeline.

Personal timeline should show the signed-in user's topic journey:

- Pick;
- Swayed actions;
- own Say;
- own Challenge;
- Boost activity relevant to own Say;
- Sway count credited to own Say;
- responses to own Say.

Global timeline should stay selective:

- meaningful Say;
- Challenge;
- Swayed actions.

Boost should mainly power ranking and aggregate counts. It should not be sprayed into the global timeline as one event per Boost.

## MVP Non-Goals

- No anonymous mode.
- No guest mode.
- No user-created topics.
- No user-suggested topics.
- No N-option topics yet.
- No topic statuses beyond `active` and `inactive`.
- No side mutation on historical Says.
- No Sway count without a successful `Swayed` action that changes Pick.
- No automated attribution from views, likes, or comments.
- No punishment columns on Topic.
- No formal Challenge winner or verdict.

## Open Next Decisions

- Define exact `Mark` labels.
- Define Challenge reply depth.
- Define ranking weights for Say lists.
- Refine report/admin workflow from `Pick_One_MVP_Safety_Rules.md`.

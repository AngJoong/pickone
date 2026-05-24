# Pick One MVP Interaction Rules

Status: MVP decision draft
Date: 2026-05-24
Domain: pickone.antabear.com
Tagline: Pick one. Make your case.
Related safety rules: `Pick_One_MVP_Safety_Rules.md`

## Scope

Pick One MVP is an account-based 1:1 choice arena. Users pick one side, write short cases, react to arguments, challenge specific claims, and may later switch sides. The product should feel light and fast, but the account history remains durable.

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
- `Switch`: Pick change from one side to the other.
- `Sway`: attribution metric credited to a Say when that Say is selected as the reason for a Switch.

## Pick And Switch

A user has one current Pick per topic.

When a user switches sides:

- create a durable `Switch` event;
- update the user's current Pick;
- preserve previous Pick history;
- optionally attach `sway_say_id` when the user selects a Say as the reason for switching.

`Switch` is the user action. `Sway` is not a separate action; it is the attribution produced when a Switch names a Say as its reason.

Suggested event shape:

```ts
Switch({
  topic_id,
  user_id,
  from_pick,
  to_pick,
  sway_say_id?: string,
  case_text?: string,
  created_at
})
```

## Say Rules

A Say belongs to:

- one topic;
- one author;
- one side snapshot at creation time.

The Say side must not change when the author later switches Pick. This keeps old arguments historically honest and prevents timeline items from changing meaning.

## Sway Validation

A Switch may include `sway_say_id` only when:

- the Say belongs to the same topic;
- the Say was written for the side the user is switching to;
- the Say was not written by the switching user;
- the Say is visible and eligible at switch time.

When valid, the Say gets `say_sway_count + 1`, or an equivalent derived count from the Switch event log.

MVP UI copy:

- Korean: `이 Say로 {n}명이 선택을 바꿨어요`
- English: `{n} Sways`

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
- Switch;
- own Say;
- own Challenge;
- Boost activity relevant to own Say;
- Sway credited to own Say;
- responses to own Say.

Global timeline should stay selective:

- meaningful Say;
- Challenge;
- Switch;
- Sway-attributed Switch.

Boost should mainly power ranking and aggregate counts. It should not be sprayed into the global timeline as one event per Boost.

## MVP Non-Goals

- No anonymous mode.
- No guest mode.
- No user-created topics.
- No user-suggested topics.
- No N-option topics yet.
- No topic statuses beyond `active` and `inactive`.
- No side mutation on historical Says.
- No Sway without an actual Switch.
- No automated attribution from views, likes, or comments.
- No punishment columns on Topic.
- No formal Challenge winner or verdict.

## Open Next Decisions

- Define exact `Mark` labels.
- Define Challenge reply depth.
- Define ranking weights for Say lists.
- Decide whether Switch requires `case_text`.
- Refine report/admin workflow from `Pick_One_MVP_Safety_Rules.md`.

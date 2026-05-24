# Pick One MVP Safety Rules

Status: MVP decision draft
Date: 2026-05-25
Owner: Cheda
Related: `Pick_One_MVP_Interaction_Rules.md`

## Scope

Pick One is a debate-shaped social product, so safety must cover more than technical security. MVP safety includes abuse prevention, reporting, content visibility, ranking integrity, privacy, and manipulation controls around `Pick`, `Say`, `ReSay`, `Boost`, `Swayed`, and `sway_count`.

## Safety Principles

- Keep participation light, but keep account responsibility durable.
- Separate product reactions from safety actions.
- Do not use public shame mechanics for safety.
- Do not let ranking, Boost, ReSay, or `Swayed` reward harassment or coordinated pile-ons.
- Store moderation and punishment outside topic columns.
- Prefer reversible visibility controls before irreversible destructive actions.

## Report Rules

`Report` is a safety action, not a reaction.

Report targets may include:

- Topic;
- Say;
- user account.

MVP report behavior:

- Reports are private and not shown as public counters.
- A user can report the same target once per reason group.
- Reports create review records; they do not automatically punish the target.
- Reported content remains visible unless a moderation rule or reviewer hides it.
- Reporter identity is not exposed to the reported user.

Suggested report reasons:

- harassment or personal attack;
- hate or discrimination;
- private information;
- spam or manipulation;
- illegal or dangerous content;
- off-topic or low-quality abuse.

## Content Visibility And Eligibility

Topic lifecycle stays `active | inactive`.

- `active`: visible to normal users and open for participation.
- `inactive`: private to normal users, excluded from feeds, search, detail pages, and global timelines, with admin preview/review only.

Individual content uses separate visibility and eligibility controls.

For Say and ReSay:

- `visible`: can appear in feeds and timelines;
- `hidden`: not shown in public feeds;
- `eligible`: can receive Boost, ReSay, and Swayed actions;
- `ineligible`: visible or hidden content is excluded from ranking and attribution.

Safety rule:

- Hidden content is always ineligible.
- Ineligible content must not receive new Boost, ReSay, or Swayed actions.
- Existing event history should remain auditable even when content becomes hidden.

This keeps moderation from rewriting product history while preventing unsafe content from gaining more distribution.

## ReSay Abuse Controls

ReSay targets a Say, not a person.

MVP controls:

- A ReSay is stored as `Say`.
- A 1-depth Say has no `parent_say_id`.
- A 2-depth ReSay must reference one 1-depth parent Say through `parent_say_id`.
- A true 3-depth reply tree is blocked for MVP.
- Replying to a 2-depth ReSay creates another 2-depth ReSay under the same parent Say.
- The specific 2-depth ReSay being answered is preserved with `reply_to_say_id`.
- ReSay copy and UI should avoid person-targeting language.
- ReSay against hidden or ineligible Says is blocked.
- ReSay from a blocked or enforcement-limited user is blocked.

This keeps conflict anchored to a concrete Say while avoiding deep pile-on trees.

## Boost Integrity

Boost is a support signal, not a safety signal.

MVP controls:

- One Boost per user per Say.
- Users cannot Boost their own Say.
- Boost from the same side is allowed; cross-side Boost is out of scope unless later product direction changes.
- Boost on hidden or ineligible Say is blocked.
- Boost should mainly affect aggregate ranking, not global timeline spam.

Ranking caution:

- Do not rank only by Boost count.
- Down-rank content with abnormal Boost velocity, repeated coordinated accounts, or active report pressure until reviewed.

## Swayed Integrity

`Swayed` is stronger than Boost because it means a Say changed the user's Pick.

MVP controls:

- `Swayed` must change the user's Pick.
- `Swayed` requires a valid Say target.
- The Say must belong to the same topic.
- The Say must support the side the user is moving to.
- Users cannot tap `Swayed` on their own Say.
- Hidden or ineligible Says cannot receive new Swayed actions.
- One user can add Sway count to a given Say at most once per topic.
- Missing `case_text` must not make a valid `Swayed` action suspicious by itself.

Do not infer Sway count from views, likes, comments, or reading order. Attribution must come from an explicit `Swayed` action.

Manual Pick changes are allowed, but they are not `Swayed` actions. They must not increment `sway_count`, must not attach a Say attribution source, and should stay out of the global timeline by default.

## Account And Privacy

Pick One is main-account based, but public exposure should still be deliberate.

MVP rules:

- Account identity is required for actions.
- Internal audit logs keep actor, target, action, and timestamp.
- Public UI should not expose report authors.
- Personal timeline can show the signed-in user's full topic journey.
- Manual Pick changes can appear in the signed-in user's personal timeline and internal audit logs.
- Global timeline should avoid stalking-style per-user activity trails.
- Deleted account behavior is a later policy decision.

## Enforcement Data Boundary

Do not store punishment state on `Topic`.

Future safety tables should be separate, for example:

- `reports`;
- `content_visibility_actions`;
- `user_enforcement_actions`;
- `moderation_audit_logs`;
- `appeals`.

MVP can start with reports and content visibility actions before building a full punishment system.

## Timeline Safety

Personal timeline may show detailed self-history.

Global timeline should be selective:

- show meaningful Say, ReSay, and Swayed events;
- do not show manual Pick changes by default;
- avoid one event per Boost;
- avoid flooding repeated Swayed events from the same user;
- hide events tied to hidden or ineligible content;
- hide events tied to inactive topics from normal users;
- avoid report and punishment events in public timeline.

## MVP Non-Goals

- No public report counts.
- No automatic punishment from report volume alone.
- No formal moderation court or public verdict system.
- No public shame badges.
- No deep Say reply trees.
- No Sway count without explicit `Swayed` action.
- No Sway count from manual Pick changes.
- No ranking system that uses only raw Boost or Sway counts.
- No `locked` topic status in MVP.

## Open Next Decisions

- Exact report reason taxonomy.
- First ranking formula for Say lists.
- Initial reviewer/admin workflow.
- Account deletion and content retention policy.

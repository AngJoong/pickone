# Pick One

Pick one. Make your case.

Pick One is an account-based 1:1 choice arena for fast opinion battles. The MVP starts with curated topics, durable account history, short Says, shallow ReSays, and the `Swayed` action that lets a Say change a user's Pick.

## MVP App

The current MVP is a local runnable app with no external service dependency.

```bash
npm run dev
```

Open `http://localhost:5173`.

Implemented MVP flow:

- demo account selection and signup;
- curated active topics with inactive topics hidden from normal users;
- Pick and manual Pick changes;
- Say and 2-depth ReSay with flattened replies;
- Boost, Report, and Swayed actions;
- personal and global timelines;
- SQLite-backed local persistence in `data/pickone.sqlite`.

Verification:

```bash
npm run check
npm test
```

## Knowledge Base

- `knowledge-base/wiki/concepts/Pick_One_MVP_Interaction_Rules.md`
- `knowledge-base/wiki/concepts/Pick_One_MVP_Safety_Rules.md`

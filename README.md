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
- Korean and English UI switching;
- Google, Naver, and Kakao login wiring;
- SQLite-backed local persistence in `data/pickone.sqlite`.

## Social Login

The app runs without provider credentials. When credentials are missing, login buttons stay visible but disabled.

For local OAuth testing, register these redirect URIs with each provider:

- Google: `http://localhost:5173/auth/google/callback`
- Naver: `http://localhost:5173/auth/naver/callback`
- Kakao: `http://localhost:5173/auth/kakao/callback`

Set the matching environment variables before `npm run dev`:

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...
KAKAO_REST_API_KEY=...
# Optional if enabled in Kakao app settings:
KAKAO_CLIENT_SECRET=...
```

Use `APP_BASE_URL` if the public callback base is not `http://localhost:5173`. Without `APP_BASE_URL`, OAuth redirect construction only trusts localhost hosts.

Verification:

```bash
npm run check
npm test
```

## Knowledge Base

- `knowledge-base/wiki/concepts/Pick_One_MVP_Interaction_Rules.md`
- `knowledge-base/wiki/concepts/Pick_One_MVP_Safety_Rules.md`

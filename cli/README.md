# oauth-guide

Step-by-step guides for setting up an OAuth app with a provider (Spotify, Notion, Calendly…), from [oauth-guide.akshatsethi.com](https://oauth-guide.akshatsethi.com).

```bash
npx oauth-guide spotify
```

If there's no guide for the app yet, it's researched live first: progress goes to stderr and the guide to stdout, so you can pipe it to an agent:

```bash
npx oauth-guide spotify --prompt | claude -p
```

## Options

| | |
|---|---|
| `--prompt` | Print the guide as an agent prompt |
| `--json` | Print the guide as JSON |
| `--exact` | Research the name as written, without matching typos to known apps ("calandly" → Calendly) |

Apps with no OAuth for third-party apps exit with code 2 and name the API to try instead.

## Feedback

Feedback shows on the guide, and the next research run checks wrong and stuck reports.

```bash
oauth-guide spotify --worked                          # it worked
oauth-guide spotify --waiting                         # done, waiting on the provider's review
oauth-guide spotify --stuck 3 "what happened"         # couldn't get past step 3
oauth-guide spotify --report "what you saw" --step 2  # the guide is wrong
```

`OAUTH_GUIDE_URL` points it at another server (e.g. `http://localhost:3000`). Needs Node 18+.

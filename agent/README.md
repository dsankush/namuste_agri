# Kisan Sathi agent (voice + chat)

The AI assistant for farmers, retailers and distributors. It runs on **LiveKit Cloud** and talks to customers
in the browser by voice (WebRTC) or typed chat.

| Part | What it uses |
|---|---|
| Listening | Sarvam `saaras` speech-to-text, auto-detects Indian languages |
| Thinking | OpenAI (`gpt-4.1-mini` by default) with tools |
| Speaking | Sarvam `bulbul:v3` text-to-speech in 11 Indian languages |
| Data | Supabase (products, prices, stock by state, orders, advisory) via `agent_*` SQL functions |

## How a conversation flows

1. **Intake** asks for the mobile number, looks the customer up, or registers them. It switches to the
   customer's language (saved language, or the language of their state).
2. **Retailers and distributors** go to the ordering assistant: search products, see carton prices and
   minimum orders for their role and state, get a quote (stock is held 10 minutes), confirm, and get an
   order number. Out of stock offers alternatives and "notify me". Order status and cancellation work too.
3. **Farmers** go to the advisory assistant: describe the problem, get a diagnosis from the crop-problem
   knowledge base, the right product, quantity for their acres, safety advice, and nearby retailers with stock.
4. "Talk to a human" is always available and creates an escalation for your team.

Every message is saved to the `conversations` and `messages` tables.

## Files

```
src/agent.py      stages (Intake, Trade, Farmer), tools, voice/chat wiring
src/prompts.py    instructions for each stage (edit tone and rules here)
src/db.py         Supabase calls and error messages
src/languages.py  language codes and fallbacks
tests/            offline tests (no API keys needed)
scenarios.yaml    full conversation tests run by LiveKit
```

## Keys

Put these in `.env.local` (never commit it; `.gitignore` already excludes it):

```
OPENAI_API_KEY=...
SARVAM_API_KEY=...
SUPABASE_URL=https://merbxpgjarsjxxsyeiyt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...    # Supabase > Project Settings > API keys > service_role / secret key
```

`LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` are already in `.env.local` from `lk app create`.
Optional settings are listed in `.env.example`.

## Run locally

```bash
uv sync
uv run pytest                     # offline tests
lk agent dev                      # starts the agent and prints a console link
```

Open the printed `cloud.livekit.io/.../agents/console` link to talk to it in the browser. Try:
- "My number is 9000000007" (test retailer in Maharashtra) then "I need 3 cartons of Pegasus 250 gram"
- "9000000005" (test farmer, cotton and onion) then "my cotton leaves are curling, small white insects"

Test mobiles 9000000001 to 9000000007 are TEST customers in Madhya Pradesh, Punjab, Maharashtra and Telangana.

## Deploy to LiveKit Cloud

```bash
lk agent create                   # first time only; it offers to load secrets from .env.local
lk agent deploy                   # every later update
lk agent update-secrets --secrets-file .env.local   # when a key changes
lk agent logs                     # live logs
```

LiveKit's own credentials are injected automatically and are skipped when secrets are loaded.

## What the web app must do

- Create a room token on the server (Vercel API route) with **agent dispatch** for `kisan-sathi`
  (the `AGENT_NAME`).
- Set participant attributes when joining:
  - `mode`: `voice` or `chat` (can be changed any time; the agent switches instantly)
  - `language` (optional): e.g. `hi-IN`, `mr-IN`, `ta-IN` if the user picks a language in the UI
- Chat: send typed text on the `lk.chat` topic; show agent replies and live transcripts from
  `lk.transcription` (the LiveKit React components do this for you).

## Test orders

`scenarios.yaml` and local testing create real rows (orders, registrations). Delete test orders from
Supabase before going live.

# Kisan Sathi website

The customer-facing page: voice call and chat with the AI agri assistant, with live actions.
Next.js (App Router) + LiveKit. Deploys to Vercel.

## Run locally

```bash
cd web
npm install
cp .env.example .env.local     # then fill in the 3 LiveKit values (same as agent/.env.local)
npm run dev                    # open http://localhost:3000
```

The agent must be running: either deployed on LiveKit Cloud, or `lk agent dev` in `../agent`.

## Deploy on Vercel

1. Push the repo to GitHub.
2. In Vercel: **Add New → Project → import the repo**.
3. Set **Root Directory** to `web`. Framework is detected as Next.js.
4. Add **Environment Variables**:
   - `LIVEKIT_URL` = `wss://farmer-retailer-gatpp085.livekit.cloud`
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
   - optional: `AGENT_NAME` (default `kisan-sathi`), `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_BUSINESS_NAME`,
     `NEXT_PUBLIC_ASSISTANT_NAME`, `NEXT_PUBLIC_DEMO_URL`
5. Deploy.

## How it works

- `app/api/token/route.ts` creates a short-lived LiveKit token for a fresh room and dispatches the
  `kisan-sathi` agent into it. The secret stays on the server.
- The page joins the room over WebRTC. Voice uses the microphone; Chat sends text on `lk.chat`.
  Switching Voice/Chat or language mid-conversation updates participant attributes and the agent follows.
- The agent publishes tool activity on the `agent.activity` topic, shown in **Live Actions**.

## Customise

- Brand, business and assistant names: env vars above, or `lib/config.ts`.
- Suggestions per customer type, languages, demo numbers: `lib/config.ts`.
- Colours: CSS variables at the top of `app/globals.css` (light and dark).
- Logo: `components/Header.tsx` (`Logo`).

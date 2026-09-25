# Agri Assistant

Voice + chat AI assistant for farmers, retailers and distributors.

```
agent/   Python agent (LiveKit Agents + Sarvam + OpenAI + Supabase) → deployed on LiveKit Cloud
web/     Next.js website (voice call + chat UI)                    → deployed on Vercel
```

- Agent: see `agent/README.md` (`lk agent deploy` to update)
- Website: see `web/README.md` (Vercel root directory = `web`)
- Database: Supabase project `farmer_retailer`

Never commit `.env.local` files; they hold API keys.

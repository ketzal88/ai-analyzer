# AI Analyst — Deep Dive

## Overview

The AI Analyst is a conversational chat panel (420px right sidebar) that provides real-time analysis of any channel's data using Claude Sonnet 4.5. It replaces one-shot Gemini reports with multi-turn, context-aware conversations.

## Architecture Flow

```
User clicks "Analizar con IA" in channel page
  → AnalystContext.openAnalyst(channelId, initialPrompt?)
  → AnalystPanel.tsx renders (fixed right panel)
  → User types or clicks suggested question
  → useAnalystChat.ts sends POST /api/ai-analyst/chat
  → Server: auth → rate limit → context-builder → xml-formatter → Anthropic SSE
  → Client: reads SSE stream token-by-token → renders markdown
```

## Key Files

### Server-Side (src/lib/ai-analyst/)

**types.ts**
- `ChannelId`: `'meta_ads' | 'google_ads' | 'ga4' | 'ecommerce' | 'email' | 'leads' | 'cross_channel' | 'creative_briefs'`
- `CHANNEL_TO_FIRESTORE`: Maps ChannelId → ChannelType (`meta_ads` → `'META'`, `cross_channel` → `null`)
- `SUGGESTED_QUESTIONS`: 3 questions per channel (in Spanish)
- `AnalystContext`: `{ _meta, channel, cross_channel_insights? }`
- `ChatRequestBody`: `{ messages, channelId, clientId, dateRange }`

**context-builder.ts**
- Builds `AnalystContext` by reading from Firestore:
  - Client config from `clients/{clientId}`
  - Channel snapshots for current + previous period
  - Channel-specific details (campaigns, products, creatives, etc.)
- Token budget caps: 15 campaigns, 10 creatives, 10 products, 10 email campaigns, 10 automations
- Nulls omitted, floats rounded to 2 decimals

**Data sources per channel:**

| Channel | Summary | Details |
|---------|---------|---------|
| `meta_ads` | `channel_snapshots` (META) | `daily_entity_snapshots` (campaigns) + `entity_rolling_metrics` (top ads) + `creative_dna` |
| `google_ads` | `channel_snapshots` (GOOGLE) | `rawData.campaigns` from snapshots |
| `ga4` | `channel_snapshots` (GA4) | `rawData.trafficSources`, `rawData.topLandingPages`, `rawData.deviceBreakdown` |
| `ecommerce` | `channel_snapshots` (ECOMMERCE) | `rawData.topProducts` + `rawData.attributionBreakdown` |
| `email` | `channel_snapshots` (EMAIL) | `rawData.campaigns` + `rawData.automations/flows` |
| `leads` | `channel_snapshots` (LEADS) | `rawData.funnelStages`, `rawData.closerBreakdown`, `rawData.utmBreakdown` |
| `cross_channel` | All channels combined | Attribution gap, spend distribution, email vs paid |
| `creative_briefs` | `channel_snapshots` (META) | Winning ads grouped by angle + creative DNA + diversity score |

**xml-formatter.ts**
- Converts `AnalystContext` → semantic XML (`<business_data>` tags)
- Claude comprehends XML ~30% better than JSON for structured data
- Format: `<business_data><meta>...</meta><channel id="meta_ads"><summary>...</summary><details>...</details></channel></business_data>`

**prompts.ts**
- Returns channel-specific system prompts
- First checks `brain_prompts/{channelId}` in Firestore (5-min memory cache)
- Falls back to built-in defaults (hardcoded in the file)
- Each prompt includes: persona, benchmarks table, diagnostic frameworks, optimization playbooks, platform-specific gotchas

### API Route (src/app/api/ai-analyst/chat/route.ts)

POST handler flow:
1. **Auth**: Verify Firebase session from cookie
2. **Rate limit**: 30 requests/hour per user (tracked in `ai_analyst_rate_limits/{uid}`)
3. **Build context**: `buildAnalystContext(channelId, clientId, dateRange)`
4. **Format**: `formatContextToXml(context)`
5. **Get prompt**: `getChannelPrompt(channelId)`
6. **Call Anthropic**: Claude Sonnet 4.5 with:
   - System prompt: channel prompt + XML data
   - `cache_control: { type: 'ephemeral' }` on system prompt (5-min cache, ~90% cost reduction on follow-ups)
   - Messages: conversation history
   - `stream: true`
7. **Return**: `ReadableStream` with SSE events (`delta`, `done`, `error`)

### Client-Side

**useAnalystChat.ts**
- Manages messages array, streaming state
- SSE reader with `TextDecoder` for streaming
- Abort on panel close (via AbortController)
- Auto-scrolls to bottom on new content

**AnalystContext.tsx** (React context)
- `openAnalyst(channelId: ChannelId, initialPrompt?: string)`
- `closeAnalyst()`
- Wraps app in `layout.tsx` via `AnalystProvider`

**AnalystPanel.tsx**
- 420px fixed right panel
- Header with channel name + close button
- MessageList with markdown rendering + streaming indicator
- AnalystInput (auto-resize textarea, Enter=send, Shift+Enter=newline)
- SuggestedQuestions (3 chips, visible when no messages)

## Prompt Stacking Architecture

4 layers, most specific last:

| Layer | Source | Content |
|-------|--------|---------|
| 1. Base Role | `prompts.ts` or `brain_prompts/{channelId}` | Analyst persona, language (Spanish), diagnostic rules |
| 2. Domain Expertise | Built into prompt | Benchmarks, frameworks, platform gotchas |
| 3. Business Context | `context-builder.ts` → XML | Client config, targets, growth mode |
| 4. Live Data | `context-builder.ts` → XML | Actual metrics, campaigns, products |

## Brain Prompts Management

### Storage
- Collection: `brain_prompts/{channelId}`
- Channel IDs as doc IDs: `meta_ads`, `google_ads`, `ga4`, `ecommerce`, `email`, `leads`, `cross_channel`, `creative_briefs`

### Admin APIs
- `GET /api/admin/brain-prompts` — List all custom prompts
- `POST /api/admin/brain-prompts` — Create/update prompt `{ channelId, prompt }`
- `DELETE /api/admin/brain-prompts?channelId=X` — Delete (reverts to default)
- `GET /api/admin/brain-prompts/defaults` — Built-in defaults from code

### Cerebro Tab 5
- Shows all channels with their current prompt
- Custom prompts marked with amber dot
- Edit → save to Firestore
- Reset → delete from Firestore → falls back to default
- 5-minute server cache on reads

## Adding a New Channel to AI Analyst

1. Add ChannelId to `types.ts` (`ChannelId` type + `CHANNEL_TO_FIRESTORE` mapping + `SUGGESTED_QUESTIONS`)
2. Add context builder logic in `context-builder.ts` (new case in switch)
3. Add XML formatting in `xml-formatter.ts` (new details section)
4. Add default system prompt in `prompts.ts`
5. Add "Analizar con IA" button in the channel's page component
6. (Optional) Seed brain_prompt in Firestore via `/api/admin/seed-brain-prompts`

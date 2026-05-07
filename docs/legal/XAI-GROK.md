# xAI Grok Provider Notes

Updated: 2026-05-07

## Production Use

BB Sports uses xAI Grok only as an inference provider. The BB Sports database remains the source of truth for generated-media metadata, approval state, prompts, credits, and public placement.

Production media generation is gated behind both:

- `XAI_API_KEY`
- `BBSPORTS_APPROVED_XAI=true`

If either value is missing, the admin media desk renders but generation fails closed.

## API Surface Used

- Image generation: `POST https://api.x.ai/v1/images/generations`
- Video generation: `POST https://api.x.ai/v1/videos/generations`
- Video polling: `GET https://api.x.ai/v1/videos/{request_id}`

## Editorial Guardrails

- Generated media is staged as unapproved by default.
- Public surfaces only render approved generated assets.
- Credits read: `AI-generated via xAI Grok; approved by BB Sports before public use.`
- Prompts instruct Grok not to copy official team logos, league marks, broadcast graphics, watermarks, player likenesses, celebrity likenesses, or copyrighted photos.
- Generated media cannot replace Brad's article approval gate.

## Source Documentation

- xAI image generation docs: https://docs.x.ai/developers/model-capabilities/images/generation
- xAI video generation docs: https://docs.x.ai/developers/model-capabilities/video/generation

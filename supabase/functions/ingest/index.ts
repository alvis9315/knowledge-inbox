// supabase/functions/ingest/index.ts
//
// The ONE entrypoint for adding content. Every future entrypoint (LINE bot,
// PWA share target, bookmarklet) just calls POST /ingest — no classification
// logic lives in them. All intelligence stays here.
//
// STATUS: Phase 1 skeleton. It normalises the input and files a placeholder
// entry with status 'pending_review'. Phase 2 wires in Claude Haiku classification
// (see the TODO block) and confidence routing per PLAN.md §4.
//
// Deploy:  supabase functions deploy ingest
// Secrets: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   (NEVER in the frontend)

import { createClient } from 'jsr:@supabase/supabase-js@2'

interface IngestPayload {
  content?: string
  source_url?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let payload: IngestPayload
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const raw = (payload.content ?? '').trim()
  if (!raw && !payload.source_url) {
    return json({ error: 'Provide `content` and/or `source_url`' }, 400)
  }

  // Step 1 — normalise source (PLAN.md §4.1)
  // TODO(Phase 2): if source_url, fetch og metadata + extract main text
  //   (Jina Reader https://r.jina.ai/{url}, or @mozilla/readability + linkedom).
  const content = raw || payload.source_url!

  // Step 2 — LLM classify + extract (PLAN.md §4.2)
  // TODO(Phase 2): call Claude Haiku with the classify prompt (current
  //   type_definitions + recent classification_feedback few-shots) and parse the
  //   structured JSON { type, confidence, title, attrs, tags, summary, new_type_proposal }.
  //
  //   const res = await fetch('https://api.anthropic.com/v1/messages', {
  //     method: 'POST',
  //     headers: {
  //       'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
  //       'anthropic-version': '2023-06-01',
  //       'content-type': 'application/json',
  //     },
  //     body: JSON.stringify({
  //       model: 'claude-haiku-4-5',
  //       max_tokens: 1024,
  //       messages: [{ role: 'user', content: classifyPrompt }],
  //     }),
  //   })
  //
  // Step 3 — confidence routing (PLAN.md §4.3)
  //   confidence > 0.85 -> status 'filed', else 'pending_review'.

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return json(
      { error: 'Edge Function not configured (missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' },
      501,
    )
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const { data, error } = await supabase
    .from('entries')
    .insert({
      title: content.slice(0, 80),
      content,
      source_url: payload.source_url ?? null,
      status: 'pending_review', // Phase 1: always needs human review (no LLM yet)
    })
    .select('id, status')
    .single()

  if (error) return json({ error: error.message }, 500)

  return json({ ok: true, entry: data, note: 'Filed as pending_review (LLM classification not yet wired — Phase 2).' }, 201)
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

import { FastifyInstance } from 'fastify';
import axios from 'axios';
import { z } from 'zod';
import { careAiDbService } from '../services/CareAiDbService';

// Voice is now handled via free Google Translate TTS + native device speech synthesis

// System prompt builder for CareRing Safety AI
function buildSystemPrompt(params: {
  voiceMode?: boolean;
  language?: string;
  context?: {
    isAdmin?: boolean;
    circleId?: string;
    speed?: number;
    isDriving?: boolean;
    batteryLevel?: number;
    circleName?: string;
    membersCount?: number;
    currentUserName?: string;
    address?: string;
    activeEmergency?: {
      senderName: string;
      latitude?: number;
      longitude?: number;
      time?: string;
    } | null;
    members?: Array<{
      id?: string;
      name: string;
      nickname?: string;
      isSelf?: boolean;
      location?: string;
      latitude?: number;
      longitude?: number;
      speed?: number;
      isMoving?: boolean;
      isStationary?: boolean;
      stationaryDuration?: string;
      battery?: number;
      isCharging?: boolean;
      isOnline?: boolean;
      lastSeen?: string;
      inBubble?: boolean;
      savedPlace?: string;
      distanceFromCaller?: string;
      etaFromCaller?: string;
    }>;
    savedPlaces?: Array<{
      name: string;
      address?: string;
      radius?: number;
    }>;
  };
}): string {
  const { voiceMode, language, context } = params;

  let prompt = `You are "CareAI", the intelligent, warm, and highly capable companion for CareRing (a family safety, real-time location, driving insights, and circles platform).

Key Guidelines:
1. Persona: Empathetic, alert, protective, friendly, and proactive. You are an expert assistant for everything inside the app.
2. Languages: You fluently understand and speak Hindi (हिंदी), English, and natural conversational Hinglish. 
   - If the user talks in Hindi, respond warmly in Hindi (Devanagari or clean conversational Hinglish).
   - If the user uses Hinglish, reply naturally in Hinglish.
   - If the user speaks in English, reply in English.
   - Preferred language setting: ${language || 'auto'}.
3. Safety & Emergency Awareness:
   - If a user asks for emergency help, advise immediate trigger of the SOS button, contact local emergency services (112 in India, 911 in US), or alert circle members.
   - Emphasize driver safety if the user or any member is currently moving/driving.`;

  if (context) {
    prompt += `\n\n=== LIVE CIRCLE TELEMETRY, MEMBERS & PERMISSIONS ===`;
    
    if (context.activeEmergency) {
      prompt += `\n\n🚨🚨 CRITICAL ACTIVE EMERGENCY SOS ALERT:
An emergency SOS was broadcasted by circle member "${context.activeEmergency.senderName}"!
If the user asks about safety, is everyone okay, or asks about this member, immediately alert them about this active emergency!`;
    }

    if (context.circleName) prompt += `\n- Active Group/Circle: "${context.circleName}"`;
    if (context.circleId) prompt += ` (Circle ID: ${context.circleId})`;
    if (context.membersCount) prompt += ` (${context.membersCount} members total)`;
    if (context.currentUserName) prompt += `\n- Current User: "${context.currentUserName}" (Admin: ${context.isAdmin ? 'YES' : 'NO'})`;
    
    if (context.savedPlaces && context.savedPlaces.length > 0) {
      prompt += `\n- Saved Circle Places: ` + context.savedPlaces.map((p) => `"${p.name}" (${p.address || 'preset location'})`).join(', ');
    }

    if (context.members && context.members.length > 0) {
      prompt += `\n\nActive Circle Members Live Status:`;
      context.members.forEach((m, idx) => {
        const selfTag = m.isSelf ? ' [CURRENT USER / CALLER]' : '';
        const nickTag = m.nickname ? ` (Nickname: "${m.nickname}")` : '';
        const idTag = m.id ? ` [ID: ${m.id}]` : '';
        prompt += `\n${idx + 1}. "${m.name}"${nickTag}${idTag}${selfTag}:`;
        prompt += `\n   - Current Address/Location: ${m.location || 'Location sharing active'}`;
        if (m.savedPlace) {
          prompt += `\n   - Currently at Saved Place: "${m.savedPlace}"`;
        }
        if (m.distanceFromCaller) {
          prompt += `\n   - Distance from caller: ${m.distanceFromCaller}${m.etaFromCaller ? ` (${m.etaFromCaller})` : ''}`;
        }
        if (m.speed !== undefined) {
          prompt += `\n   - Speed & Movement: ${m.speed} km/h (${m.isMoving ? 'Moving / Driving' : 'Stationary'}${m.stationaryDuration ? ` since ${m.stationaryDuration}` : ''})`;
        }
        if (m.battery !== undefined) {
          prompt += `\n   - Phone Battery: ${m.battery}% (${m.isCharging ? 'Charging ⚡' : 'Discharging'})${m.battery <= 20 ? ' [LOW BATTERY WARNING!]' : ''}`;
        }
        prompt += `\n   - Connectivity: ${m.isOnline ? 'Online active now' : `Last seen: ${m.lastSeen || 'recently'}`}`;
        if (m.inBubble) {
          prompt += `\n   - Privacy Bubble: Active (ghost location radius enabled)`;
        }
      });
    }

    prompt += `\n\nINTELLIGENCE & APP ACTIONS:
CRITICAL RULE:
- NEVER say "Opening modal", "Navigating to page", or "Redirecting you". 
- NEVER tell the user to check another screen or modal.
- Always provide the full answer, driving metrics, or timeline directly IN THIS CHAT MESSAGE!
- For driving reports: State the member's Safety Score, Top Speed, Total Distance, Trips, and any harsh events right in the chat.
- For timeline: State their visited places/stops, trip routes, durations, and departure/arrival times right in the chat.
- Append an action tag at the very end in the format: <<<ACTION:{"type":"ACTION_TYPE", ...params}>>> so the app can render an inline interactive visual card right inside the chat bubble.

Supported Action Types:
1. VIEW_DRIVING_REPORT: User asks for driving score, speeding, trips, or driving record.
   <<<ACTION:{"type":"VIEW_DRIVING_REPORT","memberId":"<member_id>","memberName":"<member_name>"}>>>
2. VIEW_TIMELINE: User asks for timeline, today's route, places visited, or history.
   <<<ACTION:{"type":"VIEW_TIMELINE","memberId":"<member_id>","memberName":"<member_name>"}>>>
3. SET_NICKNAME: User asks to set or change nickname for anyone or themselves.
   <<<ACTION:{"type":"SET_NICKNAME","memberId":"<member_id>","memberName":"<name>","nickname":"<new_nickname>"}>>>
4. REMOVE_MEMBER: User asks to remove someone from the circle (note: user must be admin).
   <<<ACTION:{"type":"REMOVE_MEMBER","memberId":"<member_id>","memberName":"<name>"}>>>
5. JOIN_CIRCLE: User asks to join a circle or mentions an invite code.
   <<<ACTION:{"type":"JOIN_CIRCLE","inviteCode":"<optional_code>"}>>>
6. CREATE_CIRCLE: User asks to create a new circle / group.
   <<<ACTION:{"type":"CREATE_CIRCLE","circleName":"<optional_name>"}>>>
7. INVITE_MEMBER: User asks to invite someone or share invite code.
   <<<ACTION:{"type":"INVITE_MEMBER"}>>>
8. TRIGGER_SOS: Emergency alert or help requested.
   <<<ACTION:{"type":"TRIGGER_SOS"}>>>
9. CREATE_BUBBLE: Turn on privacy bubble / ghost location.
   <<<ACTION:{"type":"CREATE_BUBBLE"}>>>
10. ADD_PLACE: Save a new location or place (home, work, gym).
   <<<ACTION:{"type":"ADD_PLACE"}>>>

General Query Advice:
- "Where is <Name>?" / "<Name> kahan hai?": State their address/place, distance, ETA, driving/stationary status, and battery.
- "Who is driving?" / "Who is moving?": List members with speed > 15 km/h.
- "Who is stationary?": List members who haven't moved and since when.
- "Who has low battery?": List members with battery <= 20%.
- "Is everyone safe?": Check emergencies first, then summarize status.`;
  }

  if (voiceMode) {
    prompt += `\n\nCRITICAL VOICE MODE INSTRUCTIONS:
- You are speaking aloud in conversational voice mode.
- Keep your answers concise, natural, and friendly (1 to 2 sentences maximum).
- DO NOT use markdown formatting (no asterisks *, no hashtags #, no bullet lists -, no tables, no bolding) because the text is spoken directly.
- NEVER say "Opening modal" or "Opening screen". Always speak the findings directly (e.g. "Rohan drove 12 kilometers today with a 95 safety score and zero hard brakings.") and append the <<<ACTION:...>>> tag at the end.`;
  }

  return prompt;
}

// Ultra-fast Gemini model priority list (gemini-3.1-flash-lite responds in ~700ms)
let cachedWorkingModel: string = 'gemini-3.1-flash-lite';

async function callGeminiApi(apiKey: string, payload: any) {
  const cleanKey = apiKey.replace(/^["']|["']$/g, '').trim();
  const models = [
    cachedWorkingModel,
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
  ].filter((m, idx, arr) => arr.indexOf(m) === idx);

  let lastError: any = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      });
      cachedWorkingModel = model;
      return { response, model };
    } catch (err: any) {
      lastError = err;
      if (err.response?.status === 404 || err.response?.status === 429) {
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

// Extract <<<ACTION:{...}>>> if emitted by AI
function parseActionFromReply(text: string): { cleanReply: string; action: any | null } {
  const match = text.match(/<<<ACTION:\s*(\{.*?\})\s*>>>/s);
  if (match) {
    try {
      const action = JSON.parse(match[1]);
      const cleanReply = text.replace(/<<<ACTION:\s*\{.*?\}\s*>>>/s, '').trim();
      return { cleanReply, action };
    } catch (_) {}
  }
  return { cleanReply: text.trim(), action: null };
}

// Safe direct PostgreSQL database execution for CareAI actions
async function processAiActionWithDb(action: any | null, context?: any) {
  if (!action || !action.type) return action;

  try {
    // Resolve target member ID if not directly set
    let targetMemberId = action.memberId;
    if (!targetMemberId && action.memberName && context?.members) {
      const found = context.members.find((m: any) =>
        m.name?.toLowerCase().includes(action.memberName.toLowerCase()) ||
        m.nickname?.toLowerCase().includes(action.memberName.toLowerCase())
      );
      if (found) targetMemberId = found.id;
    }

    if (action.type === 'VIEW_DRIVING_REPORT') {
      const memId = targetMemberId || context?.members?.[0]?.id;
      if (memId && context?.circleId) {
        const stats = await careAiDbService.getMemberDrivingStats(context.circleId, memId);
        if (stats) {
          action.drivingStats = stats;
        }
      }
    } else if (action.type === 'VIEW_TIMELINE') {
      const memId = targetMemberId || context?.members?.[0]?.id;
      if (memId && context?.circleId) {
        const timeline = await careAiDbService.getMemberTimeline(context.circleId, memId);
        if (timeline) {
          action.timelineData = timeline;
        }
      }
    } else if (action.type === 'REMOVE_MEMBER' && action.memberId && context?.circleId && context.isAdmin) {
      const callerId = context.members?.find((m: any) => m.isSelf)?.id || '';
      const result = await careAiDbService.removeMember(context.circleId, callerId, action.memberId);
      action.dbResult = result;
    } else if (action.type === 'JOIN_CIRCLE' && action.inviteCode) {
      const callerId = context.members?.find((m: any) => m.isSelf)?.id || '';
      if (callerId) {
        const result = await careAiDbService.joinCircleByCode(callerId, action.inviteCode);
        action.dbResult = result;
      }
    }
  } catch (err) {
    console.warn('[CareAI] Direct DB action process fallback:', err);
  }

  return action;
}

export async function aiRoutes(fastify: FastifyInstance) {
  // 1. Get AI Configuration and Available Providers
  fastify.get('/api/ai/config', async (_req, reply) => {
    const rawGemini = process.env.GEMINI_API_KEY || '';
    const cleanGemini = rawGemini.replace(/^["']|["']$/g, '').trim();

    return reply.send({
      status: 'ok',
      defaultProvider: 'gemini',
      availableProviders: [
        { id: 'gemini', name: 'Google Gemini (3.5 Flash)', isDefault: true },
        { id: 'claude', name: 'Anthropic Claude (3.5 Sonnet / Haiku)', isDefault: false },
        { id: 'openai', name: 'OpenAI (GPT-4o Mini)', isDefault: false },
      ],
      serverConfig: {
        hasDefaultGemini: cleanGemini.length > 5,
        hasDefaultOpenAI: !!process.env.OPENAI_API_KEY,
        hasDefaultClaude: !!process.env.ANTHROPIC_API_KEY,
        ttsProvider: 'google-tts-free',
      },
      supportedLanguages: [
        { code: 'auto', label: 'Auto (Hindi / English / Hinglish)' },
        { code: 'hi', label: 'Hindi (हिंदी)' },
        { code: 'en', label: 'English' },
        { code: 'hinglish', label: 'Hinglish (Conversational)' },
      ],
    });
  });

  // 2. Chat Completion Route (Supports Gemini, Claude, OpenAI)
  fastify.post('/api/ai/chat', async (request, reply) => {
    const schema = z.object({
      messages: z.array(
        z.object({
          role: z.enum(['user', 'assistant', 'system']),
          content: z.string(),
        })
      ).min(1),
      provider: z.enum(['gemini', 'claude', 'openai']).optional().default('gemini'),
      language: z.string().optional().default('auto'),
      voiceMode: z.boolean().optional().default(false),
      audioDataUri: z.string().optional(),
      context: z.object({
        isAdmin: z.boolean().optional(),
        circleId: z.string().optional(),
        speed: z.number().optional(),
        isDriving: z.boolean().optional(),
        batteryLevel: z.number().optional(),
        circleName: z.string().optional(),
        membersCount: z.number().optional(),
        currentUserName: z.string().optional(),
        address: z.string().optional(),
        activeEmergency: z.any().optional(),
        members: z.array(z.any()).optional(),
        savedPlaces: z.array(z.any()).optional(),
      }).passthrough().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.issues });
    }

    const { messages, provider, language, voiceMode, audioDataUri, context } = parsed.data;

    // 1. Direct PostgreSQL DB Enrichment: Only query DB if client did not already provide members
    let effectiveContext = context ? { ...context } : {};
    if (effectiveContext?.circleId && (!effectiveContext.members || effectiveContext.members.length === 0)) {
      try {
        const [dbMembers, dbPlaces, dbEmergency] = await Promise.all([
          careAiDbService.getCircleMembers(effectiveContext.circleId),
          careAiDbService.getCirclePlaces(effectiveContext.circleId),
          careAiDbService.getActiveEmergency(effectiveContext.circleId),
        ]);

        if (dbMembers && dbMembers.length > 0) {
          effectiveContext.members = dbMembers.map((dm) => ({
            id: dm.id,
            name: dm.name,
            location: dm.location,
            latitude: dm.latitude,
            longitude: dm.longitude,
            speed: dm.speed !== undefined ? dm.speed : 0,
            isMoving: (dm.speed || 0) > 15,
            isStationary: dm.isStationary,
            stationaryDuration: dm.stationarySince,
            battery: dm.battery,
            isOnline: dm.isOnline,
            lastSeen: dm.lastSeen,
            inBubble: dm.inBubble,
          }));
          effectiveContext.membersCount = dbMembers.length;
        }

        if (dbPlaces && dbPlaces.length > 0) {
          effectiveContext.savedPlaces = dbPlaces;
        }
        if (dbEmergency && !effectiveContext.activeEmergency) {
          effectiveContext.activeEmergency = dbEmergency;
        }
      } catch (dbErr) {
        console.warn('[CareAI] DB query fallback (using client context):', dbErr);
      }
    }

    // Check for user-provided custom key in headers
    const customApiKey = (request.headers['x-custom-ai-key'] as string)?.trim();
    const systemPrompt = buildSystemPrompt({ voiceMode, language, context: effectiveContext });

    try {
      if (provider === 'gemini') {
        const rawApiKey = customApiKey || process.env.GEMINI_API_KEY || '';
        const apiKey = rawApiKey.replace(/^["']|["']$/g, '').trim();

        if (!apiKey) {
          return reply.status(400).send({
            error: 'No Gemini API key available. Please add GEMINI_API_KEY in server .env or set your custom key in AI Settings.',
            code: 'MISSING_API_KEY',
            provider: 'gemini',
          });
        }

        // Convert messages to Gemini format
        const contents = messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content || 'Voice message from user' }],
          }));

        // If physical audio was recorded from mic, attach directly for Gemini speech understanding
        if (audioDataUri) {
          const match = audioDataUri.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            const mimeType = match[1];
            const base64Data = match[2];
            const lastUserIdx = contents.map((c) => c.role).lastIndexOf('user');
            if (lastUserIdx !== -1) {
              (contents[lastUserIdx].parts as any[]).unshift({
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              });
            }
          }
        }

        const { response, model } = await callGeminiApi(apiKey, {
          contents,
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          generationConfig: {
            temperature: voiceMode ? 0.6 : 0.7,
            maxOutputTokens: voiceMode ? 120 : 500,
          },
        });

        const rawReply =
          response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
          'Sorry, I could not generate a response right now.';
        const { cleanReply, action } = parseActionFromReply(rawReply);
        const processedAction = await processAiActionWithDb(action, effectiveContext);

        return reply.send({
          reply: cleanReply,
          action: processedAction,
          provider: 'gemini',
          model,
        });
      } else if (provider === 'claude') {
        const apiKey = (customApiKey || process.env.ANTHROPIC_API_KEY || '').replace(/^["']|["']$/g, '').trim();
        if (!apiKey) {
          return reply.status(400).send({
            error: 'No Claude API key provided. Please supply your Anthropic API Key in AI Settings.',
            code: 'MISSING_API_KEY',
            provider: 'claude',
          });
        }

        const claudeMessages = messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          }));

        const response = await axios.post(
          'https://api.anthropic.com/v1/messages',
          {
            model: 'claude-3-5-haiku-20241022',
            max_tokens: voiceMode ? 600 : 1500,
            system: systemPrompt,
            messages: claudeMessages,
          },
          {
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            timeout: 20000,
          }
        );

        const rawReply = response.data?.content?.[0]?.text || '';
        const { cleanReply, action } = parseActionFromReply(rawReply);
        const processedAction = await processAiActionWithDb(action, effectiveContext);
        return reply.send({
          reply: cleanReply,
          action: processedAction,
          provider: 'claude',
          model: 'claude-3-5-haiku',
        });
      } else if (provider === 'openai') {
        const apiKey = (customApiKey || process.env.OPENAI_API_KEY || '').replace(/^["']|["']$/g, '').trim();
        if (!apiKey) {
          return reply.status(400).send({
            error: 'No OpenAI API key provided. Please supply your OpenAI API Key in AI Settings.',
            code: 'MISSING_API_KEY',
            provider: 'openai',
          });
        }

        const openAiMessages = [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ];

        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4o-mini',
            messages: openAiMessages,
            max_tokens: voiceMode ? 600 : 1500,
            temperature: voiceMode ? 0.7 : 0.8,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 20000,
          }
        );

        const rawReply = response.data?.choices?.[0]?.message?.content || '';
        const { cleanReply, action } = parseActionFromReply(rawReply);
        const processedAction = await processAiActionWithDb(action, effectiveContext);
        return reply.send({
          reply: cleanReply,
          action: processedAction,
          provider: 'openai',
          model: 'gpt-4o-mini',
        });
      } else {
        return reply.status(400).send({ error: 'Unsupported provider' });
      }
    } catch (err: any) {
      fastify.log.error(err.response?.data || err.message);
      const apiErrorMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'AI Generation Failed';
      return reply.status(500).send({
        error: `AI provider error (${provider}): ${apiErrorMsg}`,
        code: 'AI_PROVIDER_ERROR',
      });
    }
  });

  // 3. Free Text-to-Speech Route (Google Translate TTS — no API key required)
  fastify.post('/api/ai/tts', async (request, reply) => {
    const schema = z.object({
      text: z.string().min(1).max(2500),
      language: z.string().optional(),
      voice: z.string().optional(), // 'female' | 'male' (hint only, for native fallback)
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid TTS body', details: parsed.error.issues });
    }

    const { text, language } = parsed.data;

    // Clean up markdown for natural speech
    const sanitizedText = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/#{1,6}\s+/g, '')
      .replace(/`{1,3}.*?`{1,3}/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .trim();

    // Determine language code for Google Translate TTS
    let langCode = 'en';
    if (language === 'hi') langCode = 'hi';
    else if (language === 'hinglish') langCode = 'hi'; // Hindi engine handles Hinglish well
    else if (language === 'en') langCode = 'en';
    else langCode = 'en'; // auto → default English

    // Chunk text into max 200-char segments (Google Translate TTS limit per request)
    const chunkText = (input: string, maxLen = 190): string[] => {
      const sentences = input.match(/[^।.!?]+[।.!?]*/g) || [input];
      const chunks: string[] = [];
      let current = '';
      for (const s of sentences) {
        if ((current + s).length > maxLen) {
          if (current.trim()) chunks.push(current.trim());
          current = s;
        } else {
          current += s;
        }
      }
      if (current.trim()) chunks.push(current.trim());
      return chunks.length ? chunks : [input.substring(0, maxLen)];
    };

    try {
      const chunks = chunkText(sanitizedText);

      // Fetch all audio chunks in parallel for minimal latency
      const chunkBuffers = await Promise.all(
        chunks.map(async (chunk) => {
          const encoded = encodeURIComponent(chunk);
          const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${langCode}&client=tw-ob`;
          const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; CareRingAI/1.0)',
              Referer: 'https://translate.google.com/',
            },
          });
          return Buffer.from(response.data);
        })
      );

      // Concatenate all audio chunks
      const combined = Buffer.concat(chunkBuffers);
      const audioBase64 = combined.toString('base64');
      const audioDataUri = `data:audio/mpeg;base64,${audioBase64}`;

      return reply.send({
        status: 'ok',
        useNativeSpeech: false,
        audioBase64,
        audioDataUri,
        format: 'audio/mpeg',
        provider: 'google-tts-free',
        charCount: sanitizedText.length,
      });
    } catch (err: any) {
      fastify.log.warn('[TTS] Google Translate TTS failed, using native speech fallback:', err.message);
      // Graceful fallback to device native speech synthesis
      return reply.send({
        status: 'fallback_native',
        useNativeSpeech: true,
        text: sanitizedText,
        language: language || 'auto',
        message: 'Using device speech synthesis',
      });
    }
  });

  // 4. Test Key Validation Route
  fastify.post('/api/ai/test-key', async (request, reply) => {
    const schema = z.object({
      provider: z.enum(['gemini', 'claude', 'openai']),
      apiKey: z.string().min(1),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid parameters', details: parsed.error.issues });
    }

    const { provider, apiKey } = parsed.data;
    const cleanKey = apiKey.replace(/^["']|["']$/g, '').trim();

    try {
      if (provider === 'gemini') {
        const { model } = await callGeminiApi(cleanKey, {
          contents: [{ parts: [{ text: 'Hello' }] }],
        });
        return reply.send({ valid: true, message: `Gemini API key is active (${model})!` });
      } else if (provider === 'claude') {
        await axios.post(
          'https://api.anthropic.com/v1/messages',
          {
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }],
          },
          {
            headers: {
              'x-api-key': cleanKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            timeout: 10000,
          }
        );
        return reply.send({ valid: true, message: 'Anthropic Claude key is valid!' });
      } else if (provider === 'openai') {
        await axios.get('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${cleanKey}` },
          timeout: 10000,
        });
        return reply.send({ valid: true, message: 'OpenAI API key is valid!' });
      }
      return reply.status(400).send({ valid: false, error: 'Unknown provider' });
    } catch (err: any) {
      const errMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.response?.data?.detail?.message ||
        err.message ||
        'Key verification failed';
      return reply.send({ valid: false, error: errMsg });
    }
  });
}

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { env } from './env.js';

export const DEFAULT_MODEL = 'claude-opus-5-5';

// Models that accept the server-side `fallbacks: "default"` parameter.
const SUPPORTS_FALLBACKS = /^claude-(opus-5|fable-5|sonnet-5-5)/;

export class ClaudeError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ClaudeError';
    Object.assign(this, details);
  }
}

export function hasClaude() {
  return Boolean(env('ANTHROPIC_API_KEY') || env('ANTHROPIC_AUTH_TOKEN'));
}

/**
 * Thin wrapper around the Messages API that returns schema-validated JSON.
 *
 * `client` can be injected for tests; otherwise the SDK resolves credentials
 * from ANTHROPIC_API_KEY (or an `ant auth login` profile).
 */
export function createClaude({ model = env('MB_MODEL', DEFAULT_MODEL), client } = {}) {
  const anthropic = client ?? new Anthropic({ maxRetries: 4 });

  return {
    model,

    /**
     * @param {object} opts
     * @param {string} opts.system   Stable instructions (cached across calls).
     * @param {string} opts.prompt   The per-item request.
     * @param {import('zod').ZodType} opts.schema  Output shape.
     * @param {'low'|'medium'|'high'|'xhigh'|'max'} [opts.effort]
     */
    async json({ system, prompt, schema, effort = 'medium', maxTokens = 32000 }) {
      const params = {
        model,
        max_tokens: maxTokens,
        thinking: { type: 'adaptive' },
        output_config: { effort, format: betaZodOutputFormat(schema) },
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: prompt }],
      };
      if (SUPPORTS_FALLBACKS.test(model)) {
        params.betas = ['server-side-fallback-2026-07-01'];
        params.fallbacks = 'default';
      }

      let message;
      try {
        message = await anthropic.beta.messages.stream(params).finalMessage();
      } catch (err) {
        if (err instanceof Anthropic.AuthenticationError) {
          throw new ClaudeError('Anthropic rejected the API key. Check ANTHROPIC_API_KEY in mockingbird/.env.', { cause: err });
        }
        if (err instanceof Anthropic.RateLimitError) {
          throw new ClaudeError('Anthropic rate limit hit after retries. Lower --concurrency or try again shortly.', { cause: err });
        }
        if (err instanceof Anthropic.BadRequestError) {
          throw new ClaudeError(`Anthropic rejected the request: ${err.message}`, { cause: err });
        }
        if (err instanceof Anthropic.APIError) {
          throw new ClaudeError(`Anthropic API error ${err.status ?? ''}: ${err.message}`, { cause: err });
        }
        throw err;
      }

      if (message.stop_reason === 'refusal') {
        throw new ClaudeError(`Claude declined this request (${message.stop_details?.category ?? 'no category'}).`, {
          stopReason: 'refusal',
        });
      }
      if (message.stop_reason === 'max_tokens') {
        throw new ClaudeError('Claude ran out of output tokens before finishing. Raise maxTokens.', { stopReason: 'max_tokens' });
      }
      if (!message.parsed_output) {
        throw new ClaudeError('Claude returned output that did not match the expected shape.');
      }
      return { data: message.parsed_output, usage: message.usage, model: message.model };
    },
  };
}

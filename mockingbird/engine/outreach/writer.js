import { pitchContext } from './context.js';
import { lintPitch } from './lint.js';
import { leadPrompt, SequenceSchema, systemPrompt } from './prompt.js';
import { templateSequence } from './templates.js';
import { nowIso } from '../lib/util.js';

function normalize(sequence, ctx) {
  // Claude is asked for exactly three steps; make sure that's what we store,
  // numbered 1..3 with the configured delays.
  const emails = [...sequence.emails]
    .sort((a, b) => a.step - b.step)
    .slice(0, ctx.sequence.length)
    .map((email, i) => ({ step: i + 1, delayDays: ctx.sequence[i]?.delayDays ?? 0, body: email.body.trim() }));
  return {
    angle: sequence.angle,
    subject: sequence.subject.trim(),
    altSubjects: (sequence.alt_subjects ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 3),
    firstLine: sequence.first_line?.trim() ?? '',
    emails,
  };
}

/**
 * Draft the outreach sequence for one lead.
 * @param {object} opts.claude  from createClaude(), or null to use templates
 */
export async function writePitch(company, { config, claude }) {
  const ctx = pitchContext(company, config);
  let raw;
  let source;
  let usage;
  if (claude) {
    const result = await claude.json({
      system: systemPrompt(config),
      prompt: leadPrompt(ctx),
      schema: SequenceSchema,
      effort: config.ai.effort?.pitch ?? 'medium',
    });
    raw = result.data;
    source = result.model;
    usage = result.usage;
  } else {
    raw = templateSequence(ctx);
    source = 'template';
  }
  const pitch = { at: nowIso(), service: ctx.service, source, ...normalize(raw, ctx) };
  pitch.lint = lintPitch(pitch, company, config);
  return { pitch, usage };
}

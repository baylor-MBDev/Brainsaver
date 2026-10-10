import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, env } from './env.js';

let cached;

export async function loadConfig(file = env('MB_CONFIG', path.join(ROOT, 'mockingbird.config.js'))) {
  if (cached && cached.file === file) return cached.config;
  const mod = await import(pathToFileURL(file).href);
  const config = mod.default;
  validate(config);
  config.ai.model = env('MB_MODEL', config.ai.model);
  cached = { file, config };
  return config;
}

export const SERVICES = ['websites', 'automation', 'apps'];

function validate(config) {
  const problems = [];
  for (const key of ['business', 'sender', 'services', 'icps', 'outreach', 'ai']) {
    if (!config?.[key]) problems.push(`missing "${key}" section`);
  }
  for (const service of SERVICES) {
    if (!config?.services?.[service]) problems.push(`services.${service} is missing`);
  }
  for (const [id, icp] of Object.entries(config?.icps ?? {})) {
    if (!SERVICES.includes(icp.service)) problems.push(`icps.${id}.service must be one of ${SERVICES.join(', ')}`);
  }
  if (problems.length) throw new Error(`mockingbird.config.js: ${problems.join('; ')}`);
}

export function getIcp(config, id) {
  const icp = config.icps[id];
  if (!icp) {
    throw new Error(`Unknown ICP "${id}". Defined in mockingbird.config.js: ${Object.keys(config.icps).join(', ')}`);
  }
  return { id, ...icp };
}

/** Things that must be true before any cold email goes out. */
export function sendingBlockers(config) {
  const blockers = [];
  if (!config.business.postalAddress?.trim()) {
    blockers.push('business.postalAddress is empty (CAN-SPAM requires a physical address in every commercial email)');
  }
  if (!config.sender.firstName?.trim() || !config.sender.lastName?.trim()) {
    blockers.push('sender.firstName / sender.lastName are not both set (emails must come from a real, named person)');
  }
  return blockers;
}

export function senderName(config) {
  return [config.sender.firstName, config.sender.lastName].filter(Boolean).join(' ');
}

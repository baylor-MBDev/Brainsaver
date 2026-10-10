import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSignals } from '../engine/audit/signals.js';
import { extractBrand } from '../engine/audit/brand.js';
import { visibleText } from '../engine/audit/html.js';
import { auditSite } from '../engine/audit/index.js';
import { scoreLead } from '../engine/audit/score.js';
import { fakeFetch, fixture } from './helpers.js';

const NOW = new Date('2026-10-10T12:00:00Z');

test('dated plumber site: legacy markup, no viewport, stale footer, dead analytics', () => {
  const html = fixture('old-plumber.html');
  const s = extractSignals(html, { url: 'http://bluebonnetplumbing.com/' });
  assert.equal(s.title, 'Home');
  assert.equal(s.metaDescription, null);
  assert.equal(s.viewport, false);
  assert.equal(s.h1Count, 0);
  assert.equal(s.copyrightYear, 2016);
  assert.equal(s.tech.jquery, '1.8.3');
  assert.ok(s.tech.legacy.includes('table-layout'));
  assert.ok(s.tech.legacy.includes('font-tags'));
  assert.ok(s.tech.legacy.includes('pre-html5-doctype'));
  assert.deepEqual(s.analytics, ['universal-analytics']);
  assert.deepEqual(s.phones, ['(254) 555-0142']);
  assert.equal(s.ctas.call, false, 'number is printed but not tap-to-call');
  assert.equal(s.images.missingAlt, 6);
  assert.match(s.contactUrl, /contact\.html$/);
  assert.ok(s.navItems.includes('Drain Cleaning'));
});

test('modern dental site: schema, booking, chat, GA4, tap-to-call', () => {
  const html = fixture('modern-dental.html');
  const s = extractSignals(html, { url: 'https://lakeviewdental.com/' });
  assert.equal(s.viewport, true);
  assert.equal(s.hasLocalBusinessSchema, true);
  assert.deepEqual(s.jsonLdTypes, ['Dentist']);
  assert.ok(s.analytics.includes('ga4'));
  assert.ok(s.tech.framework.includes('nextjs'));
  assert.deepEqual(s.chat, ['podium']);
  assert.deepEqual(s.booking, ['localmed']);
  assert.equal(s.ctas.call, true);
  assert.equal(s.ctas.book, true);
  assert.equal(s.copyrightYear, 2025);
  assert.equal(s.h1s[0], 'Gentle dentistry for the whole family');

  const brand = extractBrand(html, s, { url: 'https://lakeviewdental.com/', domain: 'lakeviewdental.com', text: visibleText(html) });
  assert.equal(brand.name, 'Lakeview Family Dental');
  assert.equal(brand.logo, 'https://lakeviewdental.com/logo.svg');
  assert.equal(brand.colors[0], '#0e7c86');
  assert.equal(brand.address.city, 'Austin');
  assert.ok(brand.services.includes('Invisalign'));
});

test('wix gym: builder, membership, third-party booking, login, no app', () => {
  const s = extractSignals(fixture('wix-gym.html'), { url: 'https://ironworksfitness.com/' });
  assert.deepEqual(s.tech.builder, ['wix']);
  assert.ok(s.booking.includes('mindbody'));
  assert.equal(s.membership, true);
  assert.equal(s.login, true);
  assert.equal(s.multiLocation, true);
  assert.equal(s.appStore || s.playStore, false);
  assert.equal(s.social.instagram, 'https://www.instagram.com/ironworksfitness');
});

test('auditSite falls back to http, finds the email on the contact page', async () => {
  const fetch = fakeFetch({
    'https://bluebonnetplumbing.com/': { error: 'ERR_TLS_CERT_ALTNAME_INVALID' },
    'http://bluebonnetplumbing.com/': { body: fixture('old-plumber.html') },
    'http://bluebonnetplumbing.com/contact.html': { body: fixture('old-plumber-contact.html') },
    'http://bluebonnetplumbing.com/robots.txt': { status: 404, body: 'not found' },
    'http://bluebonnetplumbing.com/sitemap.xml': { status: 404, body: 'not found' },
  });
  const audit = await auditSite({ name: 'Bluebonnet Plumbing', website: 'bluebonnetplumbing.com', domain: 'bluebonnetplumbing.com' }, { fetch });
  assert.equal(audit.reachable, true);
  assert.equal(audit.https, false);
  assert.equal(audit.sslError, 'ERR_TLS_CERT_ALTNAME_INVALID');
  assert.deepEqual(audit.signals.emails, ['office@bluebonnetplumbing.com']);
  assert.equal(audit.signals.forms.count, 1);
  assert.equal(audit.signals.sitemap, false);
  assert.equal(audit.brand.name, 'Bluebonnet Plumbing');
  assert.equal(audit.brand.address.city, 'Waco');

  const result = scoreLead({ name: 'Bluebonnet Plumbing', industry: 'plumbing' }, audit, { icpService: 'websites', now: NOW });
  assert.equal(result.primaryService, 'websites');
  assert.ok(result.scores.websites >= 80, `websites score ${result.scores.websites}`);
  const ids = result.findings.map((f) => f.id);
  for (const id of ['ssl-error', 'not-mobile', 'legacy-markup', 'stale-copyright', 'seo-basics', 'dead-analytics']) {
    assert.ok(ids.includes(id), `expected finding ${id}, got ${ids.join(', ')}`);
  }
  assert.ok(result.talkingPoints.every((f) => f.service === 'websites'));
});

test('bot-protected site is "blocked", not "down"', async () => {
  const fetch = fakeFetch({
    'https://guarded.com/': { status: 403, body: fixture('cloudflare-challenge.html'), headers: { server: 'cloudflare', 'cf-ray': 'abc' } },
  });
  const audit = await auditSite({ website: 'https://guarded.com' }, { fetch });
  assert.equal(audit.blocked, true);
  const result = scoreLead({ name: 'Guarded' }, audit, { now: NOW });
  assert.ok(!result.findings.some((f) => f.id === 'site-down'));
});

test('unreachable site is retried once, then described in plain language', async () => {
  const fetch = fakeFetch({});
  const audit = await auditSite({ website: 'gone-forever.com' }, { fetch, retryDelayMs: 0 });
  assert.equal(audit.reachable, false);
  assert.equal(audit.error, 'ENOTFOUND');
  assert.equal(fetch.calls.filter((c) => c.url === 'https://gone-forever.com/').length, 2, 'retried once');
  const down = scoreLead({ name: 'Gone', domain: 'gone-forever.com' }, audit, { now: NOW }).findings.find((f) => f.id === 'site-down');
  assert.equal(down.title, 'Domain doesn’t resolve');
  assert.equal(down.point, 'when I tried to open gone-forever.com, the domain doesn’t point to a website anymore');
});

test('no-website leads', async () => {
  const none = await auditSite({ website: 'https://www.facebook.com/joesbbq' });
  assert.equal(none.noWebsite, true);
  const scored = scoreLead({ name: "Joe's BBQ", socialUrl: 'https://www.facebook.com/joesbbq', reviewCount: 212, rating: 4.7, industry: 'restaurant' }, none, { now: NOW });
  assert.equal(scored.primaryService, 'websites');
  assert.match(scored.talkingPoints[0].point, /facebook\.com page/);
});

test('modern dental site scores as an automation lead, not a website lead', async () => {
  const fetch = fakeFetch({
    'https://lakeviewdental.com/': { body: fixture('modern-dental.html') },
    'http://lakeviewdental.com/': { status: 301, redirect: 'https://lakeviewdental.com/' },
    'https://lakeviewdental.com/robots.txt': { body: 'User-agent: *\nSitemap: https://lakeviewdental.com/sitemap.xml', headers: { 'content-type': 'text/plain' } },
    'https://lakeviewdental.com/sitemap.xml': { body: '<urlset></urlset>', headers: { 'content-type': 'application/xml' } },
    're:pagespeedonline': { body: { lighthouseResult: { categories: { performance: { score: 0.92 }, seo: { score: 1 }, accessibility: { score: 0.95 }, 'best-practices': { score: 1 } }, audits: { 'largest-contentful-paint': { numericValue: 1800 } } } } },
  });
  const company = { name: 'Lakeview Family Dental', website: 'lakeviewdental.com', domain: 'lakeviewdental.com', industry: 'dental', employees: 18, reviewCount: 340 };
  const audit = await auditSite(company, { fetch, pagespeed: true });
  assert.equal(audit.redirectsToHttps, true);
  assert.equal(audit.psi.performance, 92);
  assert.equal(audit.signals.sitemap, true);
  const result = scoreLead(company, audit, { icpService: 'automation', now: NOW });
  assert.ok(result.scores.websites < 30, `websites ${result.scores.websites}`);
  assert.equal(result.primaryService, 'automation');
});

test('audits never fetch private or local addresses, even via a redirect', async () => {
  const { getPage, isPublicHost } = await import('../engine/audit/fetchSite.js');
  for (const host of ['localhost', 'printer.local', 'db.internal', '10.0.0.5', '127.0.0.1', '169.254.169.254', '192.168.1.1', '[::1]', 'fd00::1']) {
    assert.equal(await isPublicHost(host, { resolve: false }), false, host);
  }
  assert.equal(await isPublicHost('8.8.8.8', { resolve: false }), true);
  assert.equal(await isPublicHost('example.com', { resolve: false }), true);

  const fetch = fakeFetch({
    'https://sneaky.com/': { status: 302, redirect: 'http://192.168.1.1/admin' },
  });
  const direct = await getPage('http://127.0.0.1:8080/', { fetch });
  assert.equal(direct.error, 'BLOCKED_HOST');
  const viaRedirect = await getPage('https://sneaky.com/', { fetch });
  assert.equal(viaRedirect.error, 'BLOCKED_HOST');
  assert.ok(!fetch.calls.some((c) => c.url.includes('192.168.1.1')), 'the private address is never requested');
});

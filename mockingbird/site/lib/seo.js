// Structured data (schema.org JSON-LD) builders. Every builder takes the
// site context so URLs are absolute and empty config fields simply drop out
// (jsonLdScript() strips null/empty values).

export const absoluteUrl = (siteUrl, pathname = '/') => new URL(pathname, `${String(siteUrl).replace(/\/+$/, '')}/`).href;

export function sameAs(business) {
  return Object.values(business.social ?? {}).filter((url) => typeof url === 'string' && /^https?:\/\//.test(url));
}

/** Where the studio works: the local markets in config.seo.regions plus the
 * home country. (business.region is where it's based, not its reach.) */
export function areaServed(config) {
  const places = (config.seo?.regions ?? []).filter(Boolean).map((name) => ({ '@type': 'Place', name }));
  const country = config.business.country ? [{ '@type': 'Country', name: config.business.country }] : [];
  return [...places, ...country];
}

export function postalAddress(business) {
  if (!business.city && !business.region) return null;
  return { '@type': 'PostalAddress', addressLocality: business.city, addressRegion: business.region, addressCountry: business.country };
}

const orgId = (ctx) => `${ctx.url('/')}#organization`;

export function organizationLd(ctx) {
  const { business } = ctx.config;
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': orgId(ctx),
    name: business.name,
    alternateName: business.shortName,
    description: business.tagline,
    url: ctx.url('/'),
    logo: ctx.url('/favicon.svg'),
    image: ctx.url('/favicon.svg'),
    email: business.email,
    telephone: business.phone,
    address: postalAddress(business),
    areaServed: areaServed(ctx.config),
    sameAs: sameAs(business),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Services',
      itemListElement: ctx.services.map((s) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.label, url: ctx.url(s.path) } })),
    },
  };
}

export function websiteLd(ctx) {
  const { business } = ctx.config;
  return { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${ctx.url('/')}#website`, name: business.name, url: ctx.url('/'), publisher: { '@id': orgId(ctx) }, inLanguage: 'en' };
}

const provider = (ctx) => ({ '@type': 'ProfessionalService', '@id': orgId(ctx), name: ctx.config.business.name, url: ctx.url('/') });

export function serviceLd(ctx, service) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${ctx.url(service.path)}#service`,
    name: service.label,
    serviceType: service.label,
    description: service.summary,
    url: ctx.url(service.path),
    provider: provider(ctx),
    areaServed: areaServed(ctx.config),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: `${service.label}: what's included`,
      itemListElement: (service.deliverables ?? []).map((d) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: d } })),
    },
  };
}

export function blogPostingLd(ctx, post) {
  const { business } = ctx.config;
  const url = ctx.url(post.path);
  const publisher = { '@type': 'Organization', '@id': orgId(ctx), name: business.name, url: ctx.url('/'), logo: { '@type': 'ImageObject', url: ctx.url('/favicon.svg') } };
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title.length > 110 ? `${post.title.slice(0, 109)}…` : post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated ?? post.date,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: post.author ? { '@type': 'Person', name: post.author } : { '@type': 'Organization', name: business.name, url: ctx.url('/') },
    publisher,
    image: ctx.ogImage ? ctx.url(ctx.ogImage) : null,
    keywords: [post.keyword, ...post.tags.map((t) => t.label)].filter(Boolean).join(', '),
    articleSection: post.service ? ctx.serviceByKey(post.service)?.label : null,
    wordCount: post.words,
    inLanguage: 'en',
  };
}

export function breadcrumbLd(ctx, trail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, i) => ({ '@type': 'ListItem', position: i + 1, name: crumb.name, item: ctx.url(crumb.path) })),
  };
}

/** items: [{ q, a }] with plain-text answers. */
export function faqLd(items) {
  if (!items?.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })),
  };
}

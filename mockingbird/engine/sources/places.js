import { requestJson } from '../lib/http.js';
import { companyId } from '../lib/store.js';
import { isPlatformProfile, normalizeDomain } from '../lib/util.js';

// Google Places API (New), Text Search. The best source for owner-run local
// businesses: Apollo's coverage of a 6-person plumbing company is thin, while
// Google has their phone, website, and review count. No emails, though; the
// audit finds those on the business's own site.

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.types',
  'places.googleMapsUri',
  'nextPageToken',
].join(',');

export async function searchPlaces(textQuery, { apiKey, maxResults = 60, fetch } = {}) {
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY is not set. See docs/SETUP.md.');
  const places = [];
  let pageToken;
  do {
    const json = { textQuery, pageSize: Math.min(20, maxResults - places.length) };
    if (pageToken) json.pageToken = pageToken;
    const data = await requestJson(ENDPOINT, {
      method: 'POST',
      headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK },
      json,
      fetch,
    });
    places.push(...(data.places ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken && places.length < maxResults);
  return places.slice(0, maxResults);
}

function component(place, type, form = 'longText') {
  return place.addressComponents?.find((c) => c.types?.includes(type))?.[form] ?? null;
}

// Location pages on a chain's website ("/locations/waco") belong to a brand
// the local owner doesn't control. Not worth pitching a website to.
const CHAIN_PATH = /\/(?:locations?|stores?|branch(?:es)?|offices?|clinics?|franchise)\//i;

export function placeToCompany(place, { icp, query } = {}) {
  const site = place.websiteUri ?? null;
  const profile = site && isPlatformProfile(site);
  let chainLocation = false;
  try {
    chainLocation = Boolean(site && !profile && CHAIN_PATH.test(new URL(site).pathname + '/'));
  } catch {
    // ignore malformed URLs
  }
  const company = {
    source: 'places',
    sourceQuery: query,
    icp: icp?.id,
    serviceHint: icp?.service,
    placeId: place.id,
    name: place.displayName?.text ?? null,
    website: site && !profile ? site : null,
    domain: site && !profile ? normalizeDomain(site) : null,
    socialUrl: profile ? site : null,
    chainLocation,
    phone: place.nationalPhoneNumber ?? null,
    address: place.formattedAddress ?? null,
    city: component(place, 'locality') ?? component(place, 'postal_town'),
    state: component(place, 'administrative_area_level_1', 'shortText'),
    country: component(place, 'country', 'shortText'),
    rating: place.rating ?? null,
    reviewCount: place.userRatingCount ?? 0,
    industry: place.primaryTypeDisplayName?.text ?? place.primaryType?.replace(/_/g, ' ') ?? null,
    categories: place.types ?? [],
    mapsUrl: place.googleMapsUri ?? null,
    businessStatus: place.businessStatus ?? null,
    contacts: [],
  };
  company.id = companyId(company);
  return company;
}

export function placesQueries(icp, { city, query } = {}) {
  if (query) return [query];
  const cfg = icp.places;
  if (!cfg?.queries?.length) throw new Error(`ICP "${icp.id}" has no places.queries in mockingbird.config.js`);
  const cities = city ? [city] : cfg.cities ?? [];
  if (!cities.length) return cfg.queries.filter((q) => !q.includes('{city}'));
  return cities.flatMap((c) => cfg.queries.map((q) => q.replaceAll('{city}', c)));
}

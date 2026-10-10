// Mockingbird growth system: everything the engine needs to know about the
// business lives here. The engine, the website, the demo sites, and the
// outreach copy all read from this one file.
//
// Fields marked REQUIRED have to be filled in before `mb doctor` will clear
// you to send email. Search for "TODO".

export default {
  business: {
    name: 'Mockingbird Software Development',
    shortName: 'Mockingbird',
    tagline: 'Websites, AI automations, and apps for businesses that are done waiting on software.',
    siteUrl: 'https://mockingbird.dev', // TODO: your real domain
    email: 'hello@mockingbird.dev', // TODO: public contact address shown on the site
    phone: '', // optional, shown on the site
    // REQUIRED for cold email: CAN-SPAM needs a valid physical postal address
    // in every commercial email (a PO box or registered mailbox is fine).
    postalAddress: '', // TODO, e.g. '123 Main St, Suite 100, Waco, TX 76701'
    city: '', // TODO, e.g. 'Waco' (used for local SEO and the site footer)
    region: 'TX', // TODO: state/region you're based in
    country: 'US',
    calendarUrl: '', // TODO: Cal.com / Calendly link for booking intro calls
    social: {
      github: 'https://github.com/baylor-MBDev',
      linkedin: '',
      x: '',
      instagram: '',
    },
  },

  // Who the cold emails come from. Use a real person.
  sender: {
    firstName: 'Baylor',
    lastName: '', // TODO
    title: 'Founder',
    // Send cold email from a separate domain (e.g. trymockingbird.com), never
    // from your main domain. See docs/SETUP.md, "Sending domains".
  },

  site: {
    // Cloudflare Web Analytics beacon token (free, cookie-free). Optional.
    analyticsToken: '',
    // Cloudflare Turnstile site key for the contact form (the secret key is a
    // Worker secret, never stored here). Optional; leave empty to skip.
    turnstileSiteKey: '',
    // Separate Cloudflare project that hosts prospect demo sites.
    demoBaseUrl: '', // TODO, e.g. 'https://demo.mockingbird.dev' or 'https://mockingbird-demos.pages.dev'
  },

  brand: {
    colors: {
      ink: '#111317',
      paper: '#F6F5F0',
      slate: '#5A616E',
      mist: '#E6E4DD',
      accent: '#2D5BFF', // "song blue"
      ember: '#FF6A3D',
    },
    fonts: {
      display: 'Space Grotesk',
      body: 'Inter',
    },
  },

  // What you sell. The outreach writer only pitches what is described here,
  // and only makes the offers listed here.
  services: {
    websites: {
      label: 'Websites',
      slug: 'websites', // page path on the site: /websites/
      headline: 'Fast, modern websites that turn visitors into calls',
      summary:
        'Custom, mobile-first marketing sites built in weeks, not months, hosted on Cloudflare so they load instantly everywhere, with SEO foundations and lead capture wired in.',
      outcomes: [
        'Loads in about a second on a phone',
        'Clear calls to action: call, book, or request a quote from any page',
        'Built-in SEO: clean structure, schema markup, sitemap, fast Core Web Vitals',
        'You own it: no page-builder lock-in, no surprise platform fees',
      ],
      deliverables: ['Design + copy', 'Custom build', 'Cloudflare hosting', 'Analytics + lead tracking', 'Care plan (optional)'],
      // The no-risk first step offered in cold email. Written to the
      // prospect ("your"), since it's dropped straight into the copy.
      offer: 'a free homepage concept built from your current site, so you can see the upgrade before spending anything',
      cta: 'Want me to send the concept over?',
    },
    automation: {
      label: 'AI Automations',
      slug: 'ai-automation',
      headline: 'AI that answers, books, and follows up while you work',
      summary:
        'AI receptionists and chat that answer questions and book appointments around the clock, instant follow-up on every lead, and automations that take repetitive admin work off your team.',
      outcomes: [
        'Every call, text, and form gets an answer in seconds, even after hours',
        'Leads get followed up automatically until they book',
        'Intake, scheduling, reminders, and data entry run themselves',
        'Plugs into the tools you already use (CRM, calendar, email, SMS)',
      ],
      deliverables: ['Workflow audit', 'AI receptionist / chat', 'Lead follow-up automations', 'CRM + calendar integration', 'Monitoring'],
      offer: 'a free 20-minute automation audit that maps the three tasks eating the most of your team’s time and what automating them would look like',
      cta: 'Worth a 20-minute look?',
    },
    apps: {
      label: 'Apps',
      slug: 'apps',
      headline: 'Mobile and web apps your customers actually open',
      summary:
        'iOS, Android, and web apps for bookings, memberships, loyalty, ordering, and internal operations. Designed, built, and shipped to the app stores.',
      outcomes: [
        'One codebase for iPhone, Android, and web',
        'Bookings, payments, memberships, rewards, and push notifications',
        'Internal tools and portals that replace spreadsheets and paper',
        'We handle app store submission and ongoing updates',
      ],
      deliverables: ['Product scoping', 'UX/UI design', 'iOS + Android + web build', 'App store launch', 'Support + iteration'],
      offer: 'a free scoping call that ends with a one-page plan for your app: core features, a realistic timeline, and a ballpark budget',
      cta: 'Open to a quick call to scope it?',
    },
  },

  // Real work you can point to. The outreach writer may ONLY cite what is
  // listed here; it is told never to invent clients, numbers, or results.
  proof: [
    {
      name: 'DOOMTYPE',
      service: 'apps',
      summary:
        'An Android app we designed and built that blocks doomscroll apps behind a typing challenge and counts pushups through the camera with on-device pose detection.',
      short: 'an Android app with on-device pose detection that counts pushups through the camera',
      url: 'https://github.com/baylor-MBDev/Brainsaver',
    },
    // { name: 'Client name', service: 'websites', summary: 'What you built and the result.', short: 'a one-line version', url: 'https://...' },
  ],

  // Ideal customer profiles. Each one says who to look for, where, and which
  // service it's for. `mb source apollo --icp <id>` and `mb source places --icp <id>`
  // read these. Apollo filters are passed to the API as-is.
  icps: {
    'local-services-websites': {
      service: 'websites',
      label: 'Home & local service businesses',
      why: 'Owner-run, live and die by phone calls and Google, and often stuck with a dated or slow site.',
      apollo: {
        organizations: {
          q_organization_keyword_tags: ['hvac', 'plumbing', 'roofing', 'electrical contractor', 'landscaping', 'pest control', 'remodeling', 'pool service', 'garage door', 'concrete'],
          organization_num_employees_ranges: ['1,10', '11,20', '21,50'],
          organization_locations: ['United States'], // TODO: narrow to your region, e.g. ['Texas, US']
        },
        people: {
          person_titles: ['owner', 'founder', 'co-founder', 'president', 'ceo', 'general manager'],
          person_seniorities: ['owner', 'founder', 'c_suite'],
        },
      },
      places: {
        // {city} is replaced with each entry of `cities`.
        queries: ['plumbers in {city}', 'hvac contractors in {city}', 'roofing contractors in {city}', 'landscaping companies in {city}', 'electricians in {city}'],
        cities: ['Waco, TX', 'Austin, TX', 'Dallas, TX', 'Houston, TX', 'San Antonio, TX'], // TODO: your markets
      },
    },
    'appointment-practices-automation': {
      service: 'automation',
      label: 'Appointment-driven practices',
      why: 'Revenue depends on answering every call and filling the calendar; front desks are overloaded and after-hours leads go cold.',
      apollo: {
        organizations: {
          q_organization_keyword_tags: ['dental', 'orthodontics', 'med spa', 'chiropractic', 'physical therapy', 'veterinary', 'dermatology', 'optometry', 'personal injury law', 'family law'],
          organization_num_employees_ranges: ['1,10', '11,20', '21,50', '51,100'],
          organization_locations: ['United States'],
        },
        people: {
          person_titles: ['owner', 'practice owner', 'practice manager', 'office manager', 'managing partner', 'founder', 'ceo', 'director of operations'],
          person_seniorities: ['owner', 'founder', 'c_suite', 'partner', 'director', 'manager'],
        },
      },
      places: {
        queries: ['dentists in {city}', 'med spas in {city}', 'chiropractors in {city}', 'veterinarians in {city}'],
        cities: ['Waco, TX', 'Austin, TX', 'Dallas, TX'],
      },
    },
    'ops-heavy-smb-automation': {
      service: 'automation',
      label: 'Ops-heavy small and mid-size companies',
      why: '20-200 people with back-office work done by hand: quoting, dispatch, intake, invoicing, reporting.',
      apollo: {
        organizations: {
          q_organization_keyword_tags: ['logistics', 'freight', 'property management', 'construction', 'distribution', 'insurance agency', 'staffing', 'accounting'],
          organization_num_employees_ranges: ['21,50', '51,100', '101,200'],
          organization_locations: ['United States'],
        },
        people: {
          person_titles: ['ceo', 'coo', 'president', 'owner', 'director of operations', 'vp operations', 'operations manager'],
          person_seniorities: ['owner', 'founder', 'c_suite', 'vp', 'director'],
        },
      },
    },
    'membership-businesses-apps': {
      service: 'apps',
      label: 'Membership & repeat-customer businesses',
      why: 'Customers come back weekly. An app with booking, rewards, and push notifications keeps them coming back.',
      apollo: {
        organizations: {
          q_organization_keyword_tags: ['fitness', 'gym', 'yoga', 'pilates', 'martial arts', 'crossfit', 'church', 'car wash', 'salon', 'coffee', 'restaurant group', 'youth sports'],
          organization_num_employees_ranges: ['11,20', '21,50', '51,100', '101,200'],
          organization_locations: ['United States'],
        },
        people: {
          person_titles: ['owner', 'founder', 'ceo', 'president', 'general manager', 'director of operations', 'marketing director'],
          person_seniorities: ['owner', 'founder', 'c_suite', 'director'],
        },
      },
      places: {
        queries: ['gyms in {city}', 'yoga studios in {city}', 'car washes in {city}', 'coffee shops in {city}'],
        cities: ['Waco, TX', 'Austin, TX', 'Dallas, TX'],
      },
    },
    'startups-apps': {
      service: 'apps',
      label: 'Early-stage startups',
      why: 'Need to ship an MVP or v2 faster than they can hire engineers.',
      apollo: {
        organizations: {
          q_organization_keyword_tags: ['saas', 'marketplace', 'consumer app', 'fintech', 'healthtech', 'edtech', 'proptech'],
          organization_num_employees_ranges: ['1,10', '11,20', '21,50'],
          organization_locations: ['United States'],
        },
        people: {
          person_titles: ['founder', 'co-founder', 'ceo', 'cto', 'head of product'],
          person_seniorities: ['founder', 'c_suite', 'head'],
        },
      },
    },
  },

  audit: {
    // Google PageSpeed Insights adds real performance scores and Core Web
    // Vitals. Slower (≈15-30s per site) but makes the best talking points.
    pagespeed: true,
    concurrency: 4,
    timeoutMs: 20_000,
  },

  scoring: {
    // A lead needs at least this opportunity score (0-100) in some service to
    // be worth revealing a contact and writing a pitch.
    qualifyAt: 45,
    // Extra points for the service the ICP was sourced for.
    icpBonus: 10,
  },

  outreach: {
    // Step 1 goes out immediately; follow-ups reply in the same thread.
    sequence: [
      { step: 1, delayDays: 0 },
      { step: 2, delayDays: 3 },
      { step: 3, delayDays: 7 },
    ],
    maxWords: 110,
    // Where the demo-site link goes: 'first' email, 'followup' (after they
    // say yes / in step 2), or 'never'. Links in a first cold email hurt
    // deliverability, so 'followup' is the default.
    demoLink: 'followup',
    optOutLine: "If this isn't useful, just reply \"no thanks\" and I won't email again.",
    requireApproval: true,
  },

  seo: {
    // Who the blog is for. Topics are planned against these.
    audiences: ['home service businesses', 'dental and medical practices', 'law firms', 'gyms and fitness studios', 'restaurants', 'startup founders', 'operations leaders'],
    regions: ['Texas'], // TODO: places you want to rank locally
    postsPerWeek: 1,
    minWords: 1200,
    voice:
      'Plain-spoken, practical, and specific. Written by builders for busy owners. Short paragraphs, concrete examples, no hype, no filler intros.',
  },

  ai: {
    // Override with MB_MODEL in .env.
    model: 'claude-opus-5-5',
    effort: { pitch: 'medium', demo: 'medium', blogPlan: 'medium', blogWrite: 'high' },
  },
};

// Page copy for the marketing site. The templates in site/pages/ read their
// words from here, so copy can change without touching markup.
//
// Review before launch: every line here should be true for the studio today.
// Stick to what you can stand behind: no invented clients, testimonials,
// numbers, prices, or guaranteed timelines. Business facts (name, email,
// services, offers, case studies) live in mockingbird.config.js; change them
// there, not here. Lines marked "Review" make a promise about how you work;
// keep them only if they're true.

export default function siteCopy(config) {
  const { business, sender } = config;
  const founder = [sender.firstName, sender.lastName].filter(Boolean).join(' ');

  return {
    // Optional social preview image (1200x630 PNG or JPG). Put the file in
    // site/assets/ and set e.g. '/assets/og.png' to get large link previews.
    ogImage: '',

    cta: {
      book: 'Book a free call',
      message: 'Send a message',
      email: 'Email us',
      title: 'Got a project in mind?',
      text: 'Book a free call or send a short note. We’ll tell you plainly whether we can help.',
    },

    footer: {
      audit: 'Free website check-up',
    },

    home: {
      title: `${business.name}: websites, AI automations, and apps`,
      description: 'Mockingbird builds fast websites, AI automations, and mobile and web apps for businesses. Start with a free call, concept, or audit.',
      eyebrow: 'Websites · AI automations · Apps',
      // Review: promises a written plan up front and weekly demos.
      lede: 'Mockingbird is a small software studio. We build fast websites, AI that answers and follows up, and mobile and web apps. You get a written plan before work starts and a working demo every week until launch.',
      secondaryCta: 'See what we build',
      auditPrompt: 'Already have a website?',
      auditLink: 'Get a free website check-up',
      services: {
        eyebrow: 'What we build',
        title: 'One studio. Three kinds of software.',
        intro: 'Most businesses don’t need a big agency. They need a site that brings in calls, less time lost to admin, and maybe an app customers will actually open. That’s the work.',
      },
      process: {
        eyebrow: 'How we work',
        title: 'How a project runs',
        // Review: this is the process the site promises on every page.
        steps: [
          { title: 'Free audit or concept', text: 'We look at what you have and show you what better looks like before you spend anything: a homepage concept, an automation audit, or an app scoping call.' },
          { title: 'Fixed-scope plan', text: 'You get a written plan with what we’ll build, what it costs, and when. You approve it before any work starts.' },
          { title: 'Build with weekly demos', text: 'We build in short cycles and show you working software every week, so you can react early instead of at the end.' },
          { title: 'Launch and care', text: 'We launch, watch it closely, and fix what comes up. Ongoing care is there if you want it.' },
        ],
      },
      proof: {
        eyebrow: 'Proof',
        title: 'Work we can show you',
        intro: 'We only list real work. New projects go here when they ship and the client is happy for us to share them.',
      },
      faq: {
        title: 'Questions owners ask us',
        items: [
          { q: 'What does a project cost?', a: 'It depends on scope, so there’s no price list. After a free call, you get a fixed-scope plan with a price, in writing, before any work starts.' },
          { q: 'How do we get started?', a: 'Book a free call or pick a free starting point: a homepage concept for websites, an automation audit, or an app scoping call. You see what we’d do before you spend anything.' },
          // Review: ownership terms.
          { q: 'Who owns what you build?', a: 'You do. Your code, your content, and your accounts. No page-builder lock-in and no surprise platform fees.' },
          { q: 'What happens after launch?', a: 'We stay on if you want us to: a care plan for websites, monitoring for automations, and support and updates for apps.' },
          { q: 'Can you work with the tools we already use?', a: 'Usually, yes. Automations plug into the CRM, calendar, email, and SMS tools you already have, so your team doesn’t have to switch systems.' },
        ],
      },
      blog: { eyebrow: 'From the blog', title: 'Notes for busy owners', all: 'All posts' },
    },

    // Per-service copy. Headline, summary, outcomes, deliverables, and the
    // offer come from config.services; this adds what only the site needs.
    services: {
      websites: {
        title: 'Custom websites that turn visitors into calls',
        description: 'Fast, mobile-first websites hosted on Cloudflare, with SEO foundations and lead capture built in. Start with a free homepage concept.',
        offerAction: 'Get my free concept',
        faq: [
          { q: 'What does a new website cost?', a: 'It depends on the number of pages, the content, and what the site needs to do, so there’s no price list. You get a fixed price in writing before any work starts.' },
          { q: 'How long does a website take?', a: 'Marketing sites are built in weeks, not months. Your plan includes a timeline we agree on before we start.' },
          { q: 'Do I have to write the copy?', a: 'No. Design and copy are both part of the project. You review and approve everything before it goes live.' },
          { q: 'Where is the site hosted?', a: 'On Cloudflare, so pages load fast everywhere. You own the site and the accounts, with no page-builder lock-in.' },
          { q: 'Will it help us show up on Google?', a: 'Every site ships with SEO foundations: clean structure, schema markup, a sitemap, and fast Core Web Vitals. Rankings depend on more than the site itself, so we don’t promise positions.' },
        ],
      },
      automation: {
        title: 'AI automations: receptionist, follow-up, and admin',
        description: 'AI receptionists and chat that answer and book around the clock, automatic lead follow-up, and admin work that runs itself. Start with a free audit.',
        offerAction: 'Book the free audit',
        faq: [
          { q: 'What can you automate?', a: 'Answering calls, texts, and web chats; booking appointments; following up with leads until they book; and repetitive admin like intake, scheduling, reminders, and data entry.' },
          { q: 'Will an AI receptionist say the wrong thing?', a: 'It’s set up with your services, hours, and the questions you actually get, and it’s tested before it talks to a customer. After launch we monitor it and adjust.' },
          { q: 'Does it work with our current tools?', a: 'Usually, yes. We connect to the tools you already use: CRM, calendar, email, and SMS.' },
          { q: 'Where do we start?', a: 'With the free 20-minute automation audit. We map the three tasks eating the most of your team’s time and what automating them would look like.' },
        ],
      },
      apps: {
        title: 'Mobile and web app development',
        description: 'iOS, Android, and web apps for bookings, memberships, loyalty, ordering, and internal operations. Start with a free scoping call.',
        offerAction: 'Book a scoping call',
        faq: [
          { q: 'iPhone, Android, or web?', a: 'Usually all three, from one codebase.' },
          { q: 'Do you handle the app stores?', a: 'Yes. We handle App Store and Google Play submission, and ongoing updates after launch.' },
          { q: 'What does an app cost?', a: 'It depends on the features. The free scoping call ends with a one-page plan for your app: core features, a realistic timeline, and a ballpark budget.' },
          { q: 'Can you build internal tools, not just customer apps?', a: 'Yes. Internal tools and portals that replace spreadsheets and paper are a good fit.' },
        ],
      },
    },

    servicePage: {
      outcomesTitle: 'What changes',
      deliverablesTitle: 'What’s included',
      offerEyebrow: 'Start here',
      proofTitle: 'Related work',
      faqTitle: 'Common questions',
      postsTitle: 'Further reading',
      auditPrompt: 'Not ready for a concept?',
      auditLink: 'Get a free website check-up instead',
    },

    work: {
      title: 'Work',
      description: `Projects ${business.name} has designed and built, described plainly.`,
      h1: 'Work we can show you',
      intro: 'Every project here is real. We add work when it ships and the client is happy for us to share it.',
    },

    about: {
      title: 'About',
      description: `${business.name} is a small software studio building websites, AI automations, and mobile and web apps for businesses.`,
      h1: 'A small studio that builds practical software.',
      // Review: replace with your own story when you're ready.
      intro: [
        `${business.name} builds websites, AI automations, and mobile and web apps for businesses that would rather spend their time on the work than on software.`,
        'We keep it plain: a written plan before we start, a working demo every week, and no jargon in between. If a project isn’t a good fit for us, we’ll say so.',
      ],
      nameTitle: 'Why “Mockingbird”',
      nameText: 'The northern mockingbird is known for singing many different songs. That’s the idea behind the studio: one team that can build the website, automate the busywork behind it, and ship the app your customers use.',
      principlesTitle: 'What you can expect',
      principles: [
        { title: 'Plain language', text: 'You’ll know what we’re building, why, and what it costs, in words that make sense.' },
        { title: 'Fixed scope', text: 'A written plan with scope, price, and timeline, agreed before work starts.' },
        { title: 'Weekly demos', text: 'Working software every week, not a big reveal at the end.' },
        { title: 'You own it', text: 'Your code, your content, your accounts. No lock-in.' },
      ],
      peopleTitle: 'Who you’ll work with',
      // Review: confirm this matches how you run projects.
      peopleText: founder ? `You’ll work with ${founder}, ${sender.title ? `${sender.title.toLowerCase()} of Mockingbird, ` : ''}from the first call through launch.` : '',
      codeText: 'Some of our work is public on GitHub.',
      codeLink: 'See our GitHub',
    },

    contact: {
      title: 'Contact',
      description: 'Ask about a website, an AI automation, or an app. Send a short note or book a free call, and we’ll reply by email.',
      h1: 'Tell us what you’re working on.',
      intro: 'A few sentences is plenty: what you have now and what you want it to do.',
      callTitle: 'Prefer to talk?',
      callText: 'Pick a time that works for you.',
      callFallback: 'Mention a few times that work in your message and we’ll set up a call.',
      emailTitle: 'Email',
      phoneTitle: 'Phone',
      nextTitle: 'What happens next',
      nextSteps: ['We read your message and reply by email.', 'If it looks like a fit, we set up a short call.', 'You get a written plan with scope and price. No obligation.'],
      form: {
        name: 'Your name',
        email: 'Email',
        company: 'Company',
        website: 'Current website',
        service: 'What do you need?',
        servicePlaceholder: 'Pick one',
        serviceOther: 'Something else',
        budget: 'Budget',
        budgetHint: 'A rough range is fine.',
        message: 'What are you working on?',
        submit: 'Send message',
        success: 'Thanks. Your message is in, and we’ll reply by email.',
      },
    },

    audit: {
      title: 'Free website check-up',
      description: 'Send your website and get a short written review of its mobile experience, speed, SEO basics, and calls to action within one business day. Free.',
      h1: 'Free website check-up: we’ll review your site the way your customers see it.',
      // Review: promises a human-written review within one business day.
      lede: 'Send us your website. Within one business day, a real person will email you a short written review of what’s working and what to fix first. It’s free.',
      checksTitle: 'What we look at',
      checks: [
        { title: 'Mobile experience', text: 'How the site looks and works on a phone: text size, menus, buttons, and forms.' },
        { title: 'Speed', text: 'Your Google PageSpeed scores and the main things slowing the page down.' },
        { title: 'SEO basics', text: 'Page titles, descriptions, headings, and whether Google can make sense of your pages.' },
        { title: 'Calls, bookings, and quotes', text: 'Whether a visitor can easily call, book, or request a quote from the page they land on.' },
      ],
      stepsTitle: 'How it works',
      steps: [
        'Send your website and your email address.',
        'We go through the site by hand on a phone and a laptop, and run Google PageSpeed.',
        'Within one business day, you get a short written review by email: what’s working, what isn’t, and what we’d fix first.',
      ],
      fine: 'No call required and no obligation. If you want help with any of it, just reply.',
      form: {
        title: 'Get your check-up',
        website: 'Your website',
        websitePlaceholder: 'yourbusiness.com',
        name: 'Your name',
        email: 'Email',
        businessType: 'Type of business',
        businessTypePlaceholder: 'e.g. plumbing, dental practice, gym',
        submit: 'Send me the check-up',
        success: 'Got it. Your check-up will arrive by email within one business day.',
      },
      faqTitle: 'Questions about the check-up',
      faq: [
        { q: 'Is it really free?', a: 'Yes. No card, no call, and no obligation.' },
        { q: 'Is this an automated report?', a: 'Not just that. We use tools, including Google PageSpeed, to measure speed and check the technical basics. Then a person looks at your site on a phone and a laptop and writes up what matters most.' },
        { q: 'My site is on Wix, Squarespace, or WordPress. Is that OK?', a: 'Yes. We review what your visitors see, whatever the site is built on.' },
        { q: 'What happens after I get the review?', a: 'Nothing, unless you want help. If you do, reply to the email and we’ll talk it through.' },
      ],
    },

    // Messages shown when a form can't be sent. With JavaScript off, the
    // Worker redirects back to the form and these show up via #fragment.
    formErrors: {
      invalid: 'Some required fields are missing or not quite right. Please check the form and try again.',
      spam: 'We couldn’t confirm the form was sent by a person. Please try again.',
      server: 'Something went wrong on our end and your message wasn’t sent. Please try again.',
      emailFallback: 'You can always email us at',
    },

    thanks: {
      title: 'Thanks',
      description: 'Your message was sent.',
      h1: 'Thanks. We got your message.',
      text: 'We read every message and reply by email. If you asked for a website check-up, it will arrive within one business day.',
      home: 'Back to the homepage',
      blog: 'Read the blog',
    },

    blog: {
      title: 'Blog',
      description: 'Plain answers about websites, AI automation, and apps for people who run businesses.',
      h1: 'Notes for busy owners',
      intro: 'Plain answers about websites, AI automation, and apps for people who run businesses.',
      empty: 'No posts yet. Check back soon.',
      tagTitle: (tag) => `Posts tagged “${tag}”`,
      newer: 'Newer posts',
      older: 'Older posts',
      onThisPage: 'On this page',
      related: 'Keep reading',
      postCtaTitle: 'Want help with this?',
    },

    notFound: {
      title: 'Page not found',
      h1: 'This page flew off.',
      text: 'The page you’re looking for has moved or never existed. Try one of these instead:',
    },

    // Review: have someone check this policy against how you actually handle
    // data before launch. Sections about analytics and Turnstile only appear
    // when those are switched on in config.site.
    privacy: {
      title: 'Privacy policy',
      description: `How ${business.name} handles the information you send through this website.`,
      updated: '2026-10-10',
      sections({ analytics, turnstile }) {
        return [
          {
            title: 'Who we are',
            text: [`This website is run by ${business.name}. Questions about this policy go to ${business.email}.`],
          },
          {
            title: 'What we collect',
            text: [
              'When you send the contact form or ask for a website check-up, we receive what you type: your name, email address, and anything else you choose to share, such as your company, website, budget, or message.',
              'With each submission we also store the page you sent it from, any campaign tags in the page address (like utm_source), your browser’s user agent, and a one-way hash of your IP address. We use these to spot spam and abuse. We never store your IP address itself.',
            ],
          },
          {
            title: 'How we use it',
            text: [
              'We use what you send to answer your inquiry, deliver what you asked for, and follow up about it. We don’t sell your information, rent it, or use it for advertising.',
              'Submissions are stored in a database on Cloudflare, which hosts this site, and a copy is emailed to us so we can reply. We keep inquiries as long as we need them to work with you and keep a record of our conversations. Ask and we’ll delete yours.',
            ],
          },
          {
            title: 'Cookies and analytics',
            text: analytics
              ? ['This site doesn’t set cookies. We use Cloudflare Web Analytics to count visits. It’s cookie-free and doesn’t track you across sites or build a profile of you.']
              : ['This site doesn’t set cookies and doesn’t run analytics or tracking scripts.'],
          },
          turnstile && {
            title: 'Spam protection',
            text: ['Our forms use Cloudflare Turnstile to check that they’re being filled in by a person. Turnstile is run by Cloudflare under its own privacy policy.'],
          },
          {
            title: 'Fonts',
            text: ['Our fonts are served by Google Fonts. When your browser loads them, Google receives your IP address, as with any web request.'],
          },
          {
            title: 'Your choices',
            text: [`Email ${business.email} to see, correct, or delete the information we have about you. We’ll handle it promptly.`],
          },
          {
            title: 'Changes',
            text: ['If this policy changes, we’ll update it here and change the date at the top.'],
          },
        ].filter(Boolean);
      },
    },
  };
}

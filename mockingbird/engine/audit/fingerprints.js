// Technology fingerprints, matched against a homepage's raw HTML.
// Patterns are deliberately specific (CDN hosts, script names) so a blog post
// that merely mentions "Calendly" doesn't count as having Calendly installed.

export const FINGERPRINTS = [
  // --- site builders & templated vertical providers ------------------------
  { id: 'wix', label: 'Wix', category: 'builder', re: /static\.wixstatic\.com|wix-code-|_wixCIDX|\.wixsite\.com|wixstatic/i },
  { id: 'squarespace', label: 'Squarespace', category: 'builder', re: /static1\.squarespace\.com|squarespace-cdn\.com|This is Squarespace\./i },
  { id: 'godaddy', label: 'GoDaddy Website Builder', category: 'builder', re: /img1\.wsimg\.com|wsimg\.com\/blobby|godaddysites\.com|Go Daddy Website Builder|Starfield Technologies/i },
  { id: 'weebly', label: 'Weebly / Square Online', category: 'builder', re: /editmysite\.com|weebly\.com\/(?:uploads|weebly)|_W\.configDomain/i },
  { id: 'webflow', label: 'Webflow', category: 'builder', re: /data-wf-site=|data-wf-page=|assets\.website-files\.com|cdn\.prod\.website-files\.com/i },
  { id: 'duda', label: 'Duda', category: 'builder', re: /irp\.cdn-website\.com|dudaone|multiscreensite|dmAPI\b/i },
  { id: 'framer', label: 'Framer', category: 'builder', re: /framerusercontent\.com|data-framer-/i },
  { id: 'jimdo', label: 'Jimdo', category: 'builder', re: /jimcdn\.com|jimdo(?:free)?\.com/i },
  { id: 'zyro', label: 'Hostinger Website Builder', category: 'builder', re: /zyrosite\.com|zyro\.com|hostinger-cdn/i },
  { id: 'carrd', label: 'Carrd', category: 'builder', re: /carrd\.co\b/i },
  { id: 'google-sites', label: 'Google Sites', category: 'builder', re: /sites\.google\.com\/view|gstatic\.com\/atari/i },
  { id: 'hibu', label: 'Hibu', category: 'builder', re: /hibu\.com|hibu-/i },
  { id: 'thryv', label: 'Thryv', category: 'builder', re: /thryv\.com|thryvcdn/i },
  { id: 'scorpion', label: 'Scorpion', category: 'builder', re: /scorpion\.co\b|scorpioncms|sc-cdn\.net/i },
  { id: 'prosites', label: 'ProSites', category: 'builder', re: /prosites\.com/i },
  { id: 'officite', label: 'Officite', category: 'builder', re: /officite/i },
  { id: 'pbhs', label: 'PBHS', category: 'builder', re: /pbhs\.com/i },
  { id: 'findlaw', label: 'FindLaw', category: 'builder', re: /findlaw\.(?:com|net)\/(?:static|ws)|lawyermarketing\.com/i },
  { id: 'justia', label: 'Justia', category: 'builder', re: /justia\.(?:com|net)\/(?:static|assets)|justatic\.com/i },

  // --- CMS ------------------------------------------------------------------
  { id: 'wordpress', label: 'WordPress', category: 'cms', re: /\/wp-content\/|\/wp-includes\/|wp-json|content="WordPress/i },
  { id: 'joomla', label: 'Joomla', category: 'cms', re: /\/media\/jui\/|content="Joomla/i },
  { id: 'drupal', label: 'Drupal', category: 'cms', re: /drupal-settings-json|Drupal\.settings|\/sites\/default\/files\//i },
  { id: 'hubspot-cms', label: 'HubSpot CMS', category: 'cms', re: /\.hs-sites\.com|hubspot\.net\/hub\/|hs-cta-wrapper/i },
  { id: 'ghost', label: 'Ghost', category: 'cms', re: /content="Ghost\s\d/i },

  // --- modern frameworks (a sign someone invested recently) ----------------
  { id: 'nextjs', label: 'Next.js', category: 'framework', re: /\/_next\/static\/|__NEXT_DATA__/i },
  { id: 'nuxt', label: 'Nuxt', category: 'framework', re: /__NUXT__|\/_nuxt\//i },
  { id: 'gatsby', label: 'Gatsby', category: 'framework', re: /___gatsby/i },
  { id: 'astro', label: 'Astro', category: 'framework', re: /astro-island|data-astro-cid/i },
  { id: 'sveltekit', label: 'SvelteKit', category: 'framework', re: /__sveltekit/i },

  // --- analytics & tracking -------------------------------------------------
  { id: 'ga4', label: 'Google Analytics 4', category: 'analytics', re: /googletagmanager\.com\/gtag\/js\?id=G-|gtag\(\s*['"]config['"]\s*,\s*['"]G-/i },
  { id: 'gtm', label: 'Google Tag Manager', category: 'analytics', re: /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{4,}/ },
  { id: 'universal-analytics', label: 'Universal Analytics (retired 2023)', category: 'analytics', re: /google-analytics\.com\/(?:analytics|ga)\.js|['"]UA-\d{4,}-\d+['"]/ },
  { id: 'meta-pixel', label: 'Meta Pixel', category: 'analytics', re: /connect\.facebook\.net\/[^"']*\/fbevents\.js|fbq\(\s*['"]init/i },
  { id: 'hotjar', label: 'Hotjar', category: 'analytics', re: /static\.hotjar\.com/i },
  { id: 'clarity', label: 'Microsoft Clarity', category: 'analytics', re: /clarity\.ms\/tag/i },
  { id: 'plausible', label: 'Plausible', category: 'analytics', re: /plausible\.io\/js/i },
  { id: 'callrail', label: 'CallRail call tracking', category: 'analytics', re: /cdn\.callrail\.com/i },

  // --- chat & messaging -----------------------------------------------------
  { id: 'intercom', label: 'Intercom', category: 'chat', re: /widget\.intercom\.io|intercomSettings/i },
  { id: 'drift', label: 'Drift', category: 'chat', re: /js\.driftt\.com/i },
  { id: 'tidio', label: 'Tidio', category: 'chat', re: /code\.tidio\.co/i },
  { id: 'livechat', label: 'LiveChat', category: 'chat', re: /cdn\.livechatinc\.com/i },
  { id: 'tawk', label: 'tawk.to', category: 'chat', re: /embed\.tawk\.to/i },
  { id: 'zendesk', label: 'Zendesk chat', category: 'chat', re: /static\.zdassets\.com|v2\.zopim\.com/i },
  { id: 'crisp', label: 'Crisp', category: 'chat', re: /client\.crisp\.chat/i },
  { id: 'hubspot-chat', label: 'HubSpot chat', category: 'chat', re: /js\.usemessages\.com/i },
  { id: 'olark', label: 'Olark', category: 'chat', re: /static\.olark\.com/i },
  { id: 'freshchat', label: 'Freshchat', category: 'chat', re: /wchat\.freshchat\.com|fw-cdn\.com/i },
  { id: 'podium', label: 'Podium webchat', category: 'chat', re: /connect\.podium\.com|podium-webchat/i },
  { id: 'birdeye', label: 'Birdeye webchat', category: 'chat', re: /birdeye\.com\/embed|birdeye-webchat/i },
  { id: 'leadconnector', label: 'LeadConnector / GoHighLevel chat', category: 'chat', re: /widgets\.leadconnectorhq\.com\/loader|leadconnectorhq\.com\/chat-widget/i },
  { id: 'smartsupp', label: 'Smartsupp', category: 'chat', re: /smartsuppchat\.com/i },
  { id: 'messenger', label: 'Facebook Messenger chat', category: 'chat', re: /xfbml\.customerchat|fb-customerchat/i },
  { id: 'gorgias', label: 'Gorgias', category: 'chat', re: /config\.gorgias\.chat|gorgias\.io/i },
  { id: 'ai-chatbot', label: 'AI chatbot', category: 'chat', re: /chatbase\.co\/embed|cdn\.botpress\.cloud|cdn\.voiceflow\.com|static\.landbot\.io|widget\.manychat\.com/i },
  { id: 'apexchat', label: 'ApexChat', category: 'chat', re: /apexchat\.(?:com|net)/i },
  { id: 'ngage', label: 'Ngage live chat', category: 'chat', re: /ngagelive\.com/i },
  { id: 'weave', label: 'Weave', category: 'chat', re: /getweave\.com|weave-text-connect/i },

  // --- online booking & ordering ---------------------------------------------
  { id: 'calendly', label: 'Calendly', category: 'booking', re: /calendly\.com\/[a-z0-9-]+|assets\.calendly\.com/i },
  { id: 'acuity', label: 'Acuity Scheduling', category: 'booking', re: /acuityscheduling\.com|app\.squarespacescheduling\.com/i },
  { id: 'square-appointments', label: 'Square Appointments', category: 'booking', re: /squareup\.com\/appointments|book\.squareup\.com/i },
  { id: 'mindbody', label: 'Mindbody', category: 'booking', re: /mindbodyonline\.com|healcode/i },
  { id: 'vagaro', label: 'Vagaro', category: 'booking', re: /vagaro\.com\/[a-z0-9]/i },
  { id: 'booksy', label: 'Booksy', category: 'booking', re: /booksy\.com\/[a-z]/i },
  { id: 'fresha', label: 'Fresha', category: 'booking', re: /fresha\.com\/[a-z]/i },
  { id: 'setmore', label: 'Setmore', category: 'booking', re: /setmore\.com/i },
  { id: 'simplybook', label: 'SimplyBook', category: 'booking', re: /simplybook\.(?:me|it)/i },
  { id: 'zocdoc', label: 'Zocdoc', category: 'booking', re: /zocdoc\.com/i },
  { id: 'localmed', label: 'LocalMed', category: 'booking', re: /localmed\.com/i },
  { id: 'nexhealth', label: 'NexHealth', category: 'booking', re: /nexhealth\.com/i },
  { id: 'jane', label: 'Jane', category: 'booking', re: /\.janeapp\.com/i },
  { id: 'servicetitan', label: 'ServiceTitan scheduler', category: 'booking', re: /servicetitan\.com|embed\.scheduler\.servicetitan/i },
  { id: 'housecall-pro', label: 'Housecall Pro', category: 'booking', re: /housecallpro\.com/i },
  { id: 'jobber', label: 'Jobber', category: 'booking', re: /getjobber\.com/i },
  { id: 'workiz', label: 'Workiz', category: 'booking', re: /workiz\.com/i },
  { id: 'opentable', label: 'OpenTable', category: 'booking', re: /opentable\.com\/(?:widget|r\/|restref)/i },
  { id: 'resy', label: 'Resy', category: 'booking', re: /resy\.com\/(?:cities|widget)/i },
  { id: 'tock', label: 'Tock', category: 'booking', re: /exploretock\.com/i },
  { id: 'toast', label: 'Toast online ordering', category: 'booking', re: /toasttab\.com/i },
  { id: 'chownow', label: 'ChowNow', category: 'booking', re: /chownow\.com/i },
  { id: 'ghl-calendar', label: 'GoHighLevel calendar', category: 'booking', re: /(?:leadconnectorhq|msgsndr)\.com\/widget\/booking/i },
  { id: 'cal-com', label: 'Cal.com', category: 'booking', re: /app\.cal\.com|cal\.com\/embed/i },
  { id: 'hubspot-meetings', label: 'HubSpot meetings', category: 'booking', re: /meetings\.hubspot\.com/i },
  { id: 'gym-software', label: 'Gym management software', category: 'booking', re: /glofox\.com|zenplanner\.com|wodify\.com|pushpress\.com|clubready\.com|abcfitness/i },
  { id: 'church-center', label: 'Planning Center', category: 'booking', re: /churchcenter\.com|planningcenteronline\.com/i },

  // --- e-commerce -----------------------------------------------------------
  { id: 'shopify', label: 'Shopify', category: 'ecommerce', re: /cdn\.shopify\.com|Shopify\.theme|\.myshopify\.com/i },
  { id: 'woocommerce', label: 'WooCommerce', category: 'ecommerce', re: /woocommerce/i },
  { id: 'bigcommerce', label: 'BigCommerce', category: 'ecommerce', re: /cdn\d*\.bigcommerce\.com/i },
  { id: 'ecwid', label: 'Ecwid', category: 'ecommerce', re: /app\.ecwid\.com/i },
  { id: 'magento', label: 'Magento', category: 'ecommerce', re: /Magento_|mage\/cookies/i },

  // --- reviews widgets ------------------------------------------------------
  { id: 'elfsight', label: 'Elfsight widget', category: 'reviews', re: /elfsightcdn\.com|elfsight-app/i },
  { id: 'trustindex', label: 'Trustindex', category: 'reviews', re: /trustindex\.io/i },
  { id: 'yotpo', label: 'Yotpo', category: 'reviews', re: /yotpo\.com/i },
  { id: 'nicejob', label: 'NiceJob', category: 'reviews', re: /nicejob\.co/i },

  // --- CRM & marketing automation -----------------------------------------
  { id: 'hubspot', label: 'HubSpot', category: 'crm', re: /js\.hs-scripts\.com|js\.hsforms\.net|js\.hs-analytics\.net/i },
  { id: 'mailchimp', label: 'Mailchimp', category: 'crm', re: /chimpstatic\.com|list-manage\.com/i },
  { id: 'klaviyo', label: 'Klaviyo', category: 'crm', re: /static\.klaviyo\.com|klaviyo\.com\/onsite/i },
  { id: 'activecampaign', label: 'ActiveCampaign', category: 'crm', re: /activehosted\.com|trackcmp\.net/i },
  { id: 'constant-contact', label: 'Constant Contact', category: 'crm', re: /ctctcdn\.com|constantcontact\.com\/(?:signup|forms)/i },
  { id: 'pardot', label: 'Salesforce Pardot', category: 'crm', re: /pi\.pardot\.com|go\.pardot\.com/i },
  { id: 'zoho', label: 'Zoho', category: 'crm', re: /salesiq\.zoho|zohopublic|crm\.zoho/i },
  { id: 'keap', label: 'Keap', category: 'crm', re: /infusionsoft\.com|keap\.app/i },
  { id: 'gohighlevel', label: 'GoHighLevel', category: 'crm', re: /leadconnectorhq\.com|msgsndr\.com/i },

  // --- form builders --------------------------------------------------------
  { id: 'jotform', label: 'Jotform', category: 'forms', re: /jotform\.(?:com|us)|jotfor\.ms/i },
  { id: 'typeform', label: 'Typeform', category: 'forms', re: /embed\.typeform\.com|\.typeform\.com\/to\//i },
  { id: 'gravity-forms', label: 'Gravity Forms', category: 'forms', re: /gform_wrapper|gravityforms/i },
  { id: 'contact-form-7', label: 'Contact Form 7', category: 'forms', re: /wpcf7/i },
  { id: 'wpforms', label: 'WPForms', category: 'forms', re: /wpforms-/i },
  { id: 'google-forms', label: 'Google Forms', category: 'forms', re: /docs\.google\.com\/forms/i },
];

export function detectTech(html, headers = {}) {
  const found = {};
  for (const fp of FINGERPRINTS) {
    if (fp.re.test(html)) (found[fp.category] ??= []).push(fp.id);
  }
  // A few platforms announce themselves in response headers.
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
  const addHeaderHit = (category, id) => {
    found[category] ??= [];
    if (!found[category].includes(id)) found[category].push(id);
  };
  if (h['x-wix-request-id'] || /wix/i.test(h.server ?? '')) addHeaderHit('builder', 'wix');
  if (/squarespace/i.test(h.server ?? '')) addHeaderHit('builder', 'squarespace');
  if (h['x-shopid'] || h['x-shopify-stage']) addHeaderHit('ecommerce', 'shopify');
  if (/wp engine|kinsta|flywheel/i.test(`${h['x-powered-by'] ?? ''} ${h.server ?? ''}`)) addHeaderHit('cms', 'wordpress');
  return found;
}

export const labelFor = (id) => FINGERPRINTS.find((fp) => fp.id === id)?.label ?? id;

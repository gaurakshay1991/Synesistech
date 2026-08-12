import crypto from 'node:crypto';

const hash = value => crypto.createHash('sha256').update(String(value || '')).digest('hex');
const cleanText = value => String(value || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const tag = (block, name) => cleanText(block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] || '');
const attrLink = block => String(block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] || '').trim();

export const LIVE_SOURCE_CATALOG = [
  {
    id: 'rbi-notifications', name: 'Reserve Bank of India — Notifications', regulator: 'Reserve Bank of India',
    jurisdiction: 'India', domain: 'Banking / FEMA / Payments / Prudential', authorityRank: 100,
    mode: 'rss', url: 'https://rbi.org.in/notifications_rss.xml', allowedDomains: ['rbi.org.in'], backgroundEnabled: true
  },
  {
    id: 'sebi-rss', name: 'SEBI — Circulars, Orders and Press Releases', regulator: 'Securities and Exchange Board of India',
    jurisdiction: 'India', domain: 'Securities / Capital markets / Funds', authorityRank: 100,
    mode: 'rss', url: 'https://www.sebi.gov.in/sebirss.xml', allowedDomains: ['sebi.gov.in'], backgroundEnabled: true
  },
  {
    id: 'india-code', name: 'India Code', regulator: 'Ministry of Law and Justice / Government of India', jurisdiction: 'India',
    domain: 'Central and State Acts / subordinate legislation / rules / regulations / notifications / orders / circulars', authorityRank: 100,
    mode: 'live-search', url: 'https://www.indiacode.nic.in/', allowedDomains: ['indiacode.nic.in'], backgroundEnabled: false
  },
  {
    id: 'india-egazette', name: 'e-Gazette of India', regulator: 'Government of India', jurisdiction: 'India',
    domain: 'Official Gazette / notifications / rules / commencement / amendments', authorityRank: 100,
    mode: 'live-search', url: 'https://egazette.gov.in/', allowedDomains: ['egazette.gov.in'], backgroundEnabled: false
  },
  {
    id: 'mca-india', name: 'Ministry of Corporate Affairs', regulator: 'Ministry of Corporate Affairs', jurisdiction: 'India',
    domain: 'Companies / LLP / insolvency / corporate rules / circulars / notifications', authorityRank: 100,
    mode: 'live-search', url: 'https://www.mca.gov.in/', allowedDomains: ['mca.gov.in'], backgroundEnabled: false
  },
  {
    id: 'meity-india', name: 'Ministry of Electronics and Information Technology', regulator: 'MeitY', jurisdiction: 'India',
    domain: 'Data protection / information technology / cyber policy / digital regulation', authorityRank: 100,
    mode: 'live-search', url: 'https://www.meity.gov.in/', allowedDomains: ['meity.gov.in'], backgroundEnabled: false
  },
  {
    id: 'cbic-india', name: 'CBIC Tax Information Portal', regulator: 'Central Board of Indirect Taxes and Customs', jurisdiction: 'India',
    domain: 'GST / customs / excise / indirect tax / notifications / circulars / amendments', authorityRank: 100,
    mode: 'live-search', url: 'https://taxinformation.cbic.gov.in/', allowedDomains: ['cbic.gov.in','taxinformation.cbic.gov.in'], backgroundEnabled: false
  },
  {
    id: 'income-tax-india', name: 'Income Tax Department', regulator: 'Central Board of Direct Taxes / Income Tax Department', jurisdiction: 'India',
    domain: 'Direct tax / rules / notifications / circulars / implementation', authorityRank: 100,
    mode: 'live-search', url: 'https://www.incometax.gov.in/', allowedDomains: ['incometax.gov.in'], backgroundEnabled: false
  },
  {
    id: 'labour-india', name: 'Ministry of Labour and Employment', regulator: 'Ministry of Labour and Employment', jurisdiction: 'India',
    domain: 'Employment / labour codes / rules / gazette notifications / social security', authorityRank: 100,
    mode: 'live-search', url: 'https://www.labour.gov.in/', allowedDomains: ['labour.gov.in'], backgroundEnabled: false
  },
  {
    id: 'cci-india', name: 'Competition Commission of India', regulator: 'Competition Commission of India', jurisdiction: 'India',
    domain: 'Competition / combinations / antitrust / regulations / orders / notifications', authorityRank: 100,
    mode: 'live-search', url: 'https://www.cci.gov.in/', allowedDomains: ['cci.gov.in'], backgroundEnabled: false
  },
  {
    id: 'supreme-court-india', name: 'Supreme Court of India', regulator: 'Supreme Court of India', jurisdiction: 'India',
    domain: 'Judgments / orders / binding precedent / court rules', authorityRank: 100,
    mode: 'live-search', url: 'https://www.sci.gov.in/', allowedDomains: ['sci.gov.in'], backgroundEnabled: false
  },
  {
    id: 'ifsca-india', name: 'International Financial Services Centres Authority', regulator: 'IFSCA', jurisdiction: 'India',
    domain: 'IFSC banking / finance companies / funds / capital markets / insurance / circulars / regulations', authorityRank: 100,
    mode: 'live-search', url: 'https://ifsca.gov.in/', allowedDomains: ['ifsca.gov.in'], backgroundEnabled: false
  },
  {
    id: 'irdai-india', name: 'Insurance Regulatory and Development Authority of India', regulator: 'IRDAI', jurisdiction: 'India',
    domain: 'Insurance / reinsurance / regulations / circulars / AML-CFT', authorityRank: 100,
    mode: 'live-search', url: 'https://irdai.gov.in/', allowedDomains: ['irdai.gov.in'], backgroundEnabled: false
  },
  {
    id: 'pfrda-india', name: 'Pension Fund Regulatory and Development Authority', regulator: 'PFRDA', jurisdiction: 'India',
    domain: 'Pensions / NPS / regulations / circulars / compliance', authorityRank: 100,
    mode: 'live-search', url: 'https://www.pfrda.org.in/', allowedDomains: ['pfrda.org.in'], backgroundEnabled: false
  },
  {
    id: 'fiu-india', name: 'Financial Intelligence Unit — India', regulator: 'FIU-IND', jurisdiction: 'India',
    domain: 'AML / PMLA reporting / suspicious transaction / guidance', authorityRank: 100,
    mode: 'live-search', url: 'https://fiuindia.gov.in/', allowedDomains: ['fiuindia.gov.in'], backgroundEnabled: false
  },
  {
    id: 'dgft-india', name: 'Directorate General of Foreign Trade', regulator: 'DGFT', jurisdiction: 'India',
    domain: 'Foreign trade policy / import-export / licensing / notifications / public notices', authorityRank: 100,
    mode: 'live-search', url: 'https://www.dgft.gov.in/', allowedDomains: ['dgft.gov.in'], backgroundEnabled: false
  },
  {
    id: 'us-federal-register', name: 'United States Federal Register', regulator: 'US Federal agencies',
    jurisdiction: 'United States', domain: 'Federal rules / notices / proposed rules', authorityRank: 98,
    mode: 'federal-register-json', url: 'https://www.federalregister.gov/api/v1/documents.json?per_page=40&order=newest',
    allowedDomains: ['federalregister.gov'], backgroundEnabled: true
  },
  {
    id: 'eur-lex', name: 'EUR-Lex', regulator: 'European Union', jurisdiction: 'European Union',
    domain: 'EU legislation / regulations / directives / case-law', authorityRank: 100,
    mode: 'live-search', url: 'https://eur-lex.europa.eu/', allowedDomains: ['eur-lex.europa.eu'], backgroundEnabled: false
  },
  {
    id: 'sec', name: 'US Securities and Exchange Commission', regulator: 'SEC', jurisdiction: 'United States',
    domain: 'Securities / rules / enforcement / disclosures', authorityRank: 100,
    mode: 'live-search', url: 'https://www.sec.gov/rules-regulations', allowedDomains: ['sec.gov'], backgroundEnabled: false
  },
  {
    id: 'fca', name: 'UK Financial Conduct Authority', regulator: 'FCA', jurisdiction: 'United Kingdom',
    domain: 'Financial services / conduct / handbook', authorityRank: 100,
    mode: 'live-search', url: 'https://www.fca.org.uk/', allowedDomains: ['fca.org.uk'], backgroundEnabled: false
  },
  {
    id: 'uk-legislation', name: 'UK Legislation', regulator: 'UK Government', jurisdiction: 'United Kingdom',
    domain: 'Acts / statutory instruments', authorityRank: 100,
    mode: 'live-search', url: 'https://www.legislation.gov.uk/', allowedDomains: ['legislation.gov.uk'], backgroundEnabled: false
  },
  {
    id: 'mas', name: 'Monetary Authority of Singapore', regulator: 'MAS', jurisdiction: 'Singapore',
    domain: 'Banking / payments / capital markets / AML', authorityRank: 100,
    mode: 'live-search', url: 'https://www.mas.gov.sg/regulation', allowedDomains: ['mas.gov.sg'], backgroundEnabled: false
  },
  {
    id: 'asic', name: 'Australian Securities and Investments Commission', regulator: 'ASIC', jurisdiction: 'Australia',
    domain: 'Corporations / financial services / markets', authorityRank: 100,
    mode: 'live-search', url: 'https://asic.gov.au/regulatory-resources/', allowedDomains: ['asic.gov.au'], backgroundEnabled: false
  },
  {
    id: 'ofac', name: 'US Treasury OFAC', regulator: 'OFAC', jurisdiction: 'United States / Global sanctions',
    domain: 'Sanctions / restricted parties / enforcement', authorityRank: 100,
    mode: 'live-search', url: 'https://ofac.treasury.gov/recent-actions', allowedDomains: ['ofac.treasury.gov'], backgroundEnabled: false
  },
  {
    id: 'fatf', name: 'Financial Action Task Force', regulator: 'FATF', jurisdiction: 'Global',
    domain: 'AML / CFT / proliferation financing standards', authorityRank: 96,
    mode: 'live-search', url: 'https://www.fatf-gafi.org/', allowedDomains: ['fatf-gafi.org'], backgroundEnabled: false
  },
  {
    id: 'bis', name: 'Bank for International Settlements', regulator: 'BIS / Basel Committee', jurisdiction: 'Global',
    domain: 'Banking standards / prudential / payments', authorityRank: 96,
    mode: 'live-search', url: 'https://www.bis.org/', allowedDomains: ['bis.org'], backgroundEnabled: false
  },
  {
    id: 'canada-laws', name: 'Justice Laws Website — Canada', regulator: 'Government of Canada', jurisdiction: 'Canada',
    domain: 'Federal statutes / regulations', authorityRank: 100,
    mode: 'live-search', url: 'https://laws-lois.justice.gc.ca/', allowedDomains: ['laws-lois.justice.gc.ca'], backgroundEnabled: false
  },
  {
    id: 'au-legislation', name: 'Federal Register of Legislation — Australia', regulator: 'Australian Government', jurisdiction: 'Australia',
    domain: 'Federal legislation', authorityRank: 100,
    mode: 'live-search', url: 'https://www.legislation.gov.au/', allowedDomains: ['legislation.gov.au'], backgroundEnabled: false
  },
  {
    id: 'sg-statutes', name: 'Singapore Statutes Online', regulator: 'Singapore Government', jurisdiction: 'Singapore',
    domain: 'Acts / subsidiary legislation', authorityRank: 100,
    mode: 'live-search', url: 'https://sso.agc.gov.sg/', allowedDomains: ['sso.agc.gov.sg'], backgroundEnabled: false
  }
];

export function classifyLegalChange(title = '') {
  const value = String(title).toLowerCase();
  if (/repeal|rescission|rescinded|withdrawn|supersed|cease to have effect/.test(value)) return 'Repeal / rescission / supersession';
  if (/amend|modif|revision|revised|substitut|omission|insert|corrigendum/.test(value)) return 'Amendment / modification';
  if (/master circular|master direction|consolidat/.test(value)) return 'Master / consolidation';
  if (/circular/.test(value)) return 'Circular';
  if (/notification/.test(value)) return 'Notification';
  if (/guideline|guidance|advisory/.test(value)) return 'Guideline / guidance';
  if (/final rule|rulemaking|\brule\b/.test(value)) return 'Rule';
  if (/order|ruling|judgment|judgement|enforcement/.test(value)) return 'Order / judgment / enforcement';
  if (/consultation|proposed rule|draft/.test(value)) return 'Proposal / consultation';
  if (/act|regulation|directive|statute/.test(value)) return 'Legislation / regulation';
  return 'Regulatory publication';
}

export function parseRssOrAtom(xml, source) {
  const blocks = [...String(xml || '').matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)].map(match => match[2]);
  return blocks.slice(0, 80).map(block => {
    const title = tag(block, 'title');
    const link = tag(block, 'link') || attrLink(block) || tag(block, 'guid');
    const published = tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'updated') || tag(block, 'dc:date');
    const summary = tag(block, 'description') || tag(block, 'summary') || tag(block, 'content');
    const fingerprint = hash(`${source.id}|${link}|${title}|${published}`);
    return {
      id: `live-${fingerprint.slice(0, 24)}`,
      contentHash: fingerprint,
      sourceId: source.id,
      sourceName: source.name,
      regulator: source.regulator,
      jurisdiction: source.jurisdiction,
      domain: source.domain,
      authorityRank: source.authorityRank,
      title,
      summary: summary.slice(0, 1800),
      sourceReference: link || source.url,
      publishedDate: published || 'Source date unavailable',
      effectiveDate: 'Requires legal-effective-date determination',
      changeType: classifyLegalChange(title),
      status: 'Live source detected — impact analysis required',
      severity: 'Unassessed',
      confidence: source.authorityRank,
      retrievedAt: new Date().toISOString(),
      provenance: 'Direct official feed'
    };
  }).filter(item => item.title);
}

export function parseFederalRegister(payload, source) {
  const results = Array.isArray(payload?.results) ? payload.results : [];
  return results.slice(0, 80).map(item => {
    const title = cleanText(item.title);
    const link = item.html_url || item.pdf_url || item.raw_text_url || source.url;
    const published = item.publication_date || '';
    const fingerprint = hash(`${source.id}|${item.document_number || link}|${title}|${published}`);
    return {
      id: `live-${fingerprint.slice(0, 24)}`,
      contentHash: fingerprint,
      sourceId: source.id,
      sourceName: source.name,
      regulator: Array.isArray(item.agencies) && item.agencies.length ? item.agencies.map(value => value.name).filter(Boolean).join(', ') : source.regulator,
      jurisdiction: source.jurisdiction,
      domain: source.domain,
      authorityRank: source.authorityRank,
      title,
      summary: cleanText(item.abstract || item.excerpts || '').slice(0, 1800),
      sourceReference: link,
      publishedDate: published || 'Source date unavailable',
      effectiveDate: item.effective_on || 'Requires legal-effective-date determination',
      changeType: cleanText(item.type) || classifyLegalChange(title),
      status: 'Live source detected — impact analysis required',
      severity: 'Unassessed',
      confidence: source.authorityRank,
      retrievedAt: new Date().toISOString(),
      provenance: 'Direct official API'
    };
  }).filter(item => item.title);
}

export async function fetchBackgroundSource(source, { timeoutMs = 18000 } = {}) {
  if (!source?.backgroundEnabled) return { source, items: [], skipped: true, reason: 'Live-search source; no autonomous polling endpoint configured.' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'Synesis-Legal-Intelligence/8.0 (+compliance-monitor; respects source terms and rate limits)',
        'Accept': source.mode === 'federal-register-json' ? 'application/json' : 'application/rss+xml, application/atom+xml, text/xml, application/xml, text/plain;q=0.8'
      },
      redirect: 'follow',
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`${source.name} returned HTTP ${response.status}`);
    if (source.mode === 'federal-register-json') return { source, items: parseFederalRegister(await response.json(), source), skipped: false };
    return { source, items: parseRssOrAtom(await response.text(), source), skipped: false };
  } finally {
    clearTimeout(timer);
  }
}

export function sourceStatusView(source, lastChecked = null, lastStatus = null) {
  return {
    id: source.id,
    name: source.name,
    regulator: source.regulator,
    jurisdiction: source.jurisdiction,
    type: source.backgroundEnabled ? `Autonomous ${source.mode.toUpperCase()} monitor` : 'Real-time authoritative search source',
    status: lastStatus || (source.backgroundEnabled ? 'Autonomous monitor configured' : 'Query-time live search configured'),
    url: source.url,
    domain: source.domain,
    authorityRank: source.authorityRank,
    backgroundEnabled: source.backgroundEnabled,
    lastChecked
  };
}

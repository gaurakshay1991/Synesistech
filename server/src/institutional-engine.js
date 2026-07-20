import crypto from 'node:crypto';

const number = value => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? '').replace(/[₹$€£,%\s,]/g, '').replace(/\(([^)]+)\)/, '-$1');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));
const pct = value => round(value, 2);
const severity = score => score >= 75 ? 'High' : score >= 45 ? 'Medium' : 'Low';
const slug = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const first = (...values) => values.find(value => value !== undefined && value !== null && String(value).trim() !== '');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell.trim());
      cell = '';
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(value => value !== '')) rows.push(row);
  if (rows.length < 2) throw new Error('The portfolio file needs a header row and at least one holding.');
  const headers = rows[0].map(slug);
  return rows.slice(1).map((values, index) => {
    const record = { __row: index + 2 };
    headers.forEach((header, column) => { record[header || `column_${column + 1}`] = values[column] ?? ''; });
    return record;
  });
}

function pick(record, aliases) {
  for (const alias of aliases) {
    if (record[alias] !== undefined && String(record[alias]).trim() !== '') return record[alias];
  }
  return '';
}

const ALIASES = {
  security: ['security', 'security_name', 'instrument', 'holding', 'name', 'company', 'issuer_name'],
  issuer: ['issuer', 'issuer_name', 'company', 'group', 'counterparty'],
  sector: ['sector', 'industry', 'sector_name'],
  assetClass: ['asset_class', 'assetclass', 'category', 'instrument_type', 'type'],
  value: ['market_value', 'marketvalue', 'value', 'amount', 'current_value', 'aum', 'exposure', 'net_asset_value'],
  weight: ['weight', 'weight_percent', 'weightage', 'portfolio_weight', 'percentage', 'allocation'],
  rating: ['rating', 'credit_rating', 'external_rating'],
  liquidityDays: ['liquidity_days', 'days_to_liquidate', 'liquidation_days', 'days_liquidity'],
  adv: ['adv', 'average_daily_volume', 'daily_volume'],
  listed: ['listed', 'listing_status', 'unlisted'],
  maturity: ['maturity', 'maturity_date', 'tenor'],
  quantity: ['quantity', 'qty', 'units'],
  price: ['price', 'market_price', 'nav_price']
};

function groupWeights(holdings, key) {
  const map = new Map();
  holdings.forEach(item => {
    const label = item[key] || 'Unclassified';
    map.set(label, (map.get(label) || 0) + item.weight);
  });
  return [...map.entries()].map(([name, weight]) => ({ name, weight: pct(weight) })).sort((a, b) => b.weight - a.weight);
}

function ratingRank(value) {
  const normalized = String(value || '').toUpperCase().replace(/[^A-Z0-9+-]/g, '');
  const ranks = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB', 'B', 'C', 'D'];
  const index = ranks.indexOf(normalized);
  return index === -1 ? 999 : index;
}

function redemptionScenario(holdings, requestedWeight) {
  let remaining = requestedWeight;
  const plan = [];
  const ordered = [...holdings].sort((a, b) => {
    const cashA = /cash|treasury|money market|liquid/i.test(`${a.assetClass} ${a.security}`) ? -1 : 0;
    const cashB = /cash|treasury|money market|liquid/i.test(`${b.assetClass} ${b.security}`) ? -1 : 0;
    return cashA - cashB || a.liquidityDays - b.liquidityDays || b.weight - a.weight;
  });
  ordered.forEach(item => {
    if (remaining <= 0) return;
    const sale = Math.min(item.weight, remaining);
    if (sale > 0) plan.push({ security: item.security, issuer: item.issuer, sell_weight: pct(sale), liquidity_days: item.liquidityDays || null });
    remaining -= sale;
  });
  const residualWeight = Math.max(0.01, 100 - requestedWeight);
  const post = holdings.map(item => {
    const sold = plan.find(entry => entry.security === item.security)?.sell_weight || 0;
    return { ...item, postWeight: pct(Math.max(0, item.weight - sold) / residualWeight * 100) };
  });
  const top = [...post].sort((a, b) => b.postWeight - a.postWeight)[0];
  const slow = plan.filter(item => (item.liquidity_days || 0) > 5).reduce((sum, item) => sum + item.sell_weight, 0);
  return {
    redemption_percent: requestedWeight,
    executable: remaining <= 0.01,
    uncovered_percent: pct(Math.max(0, remaining)),
    estimated_slow_asset_sales_percent: pct(slow),
    post_redemption_top_holding: top ? { security: top.security, weight: top.postWeight } : null,
    sale_plan: plan.slice(0, 15),
    warnings: [
      remaining > 0.01 ? 'The uploaded portfolio does not contain enough mapped exposure to satisfy this scenario.' : null,
      slow > requestedWeight * 0.25 ? 'A material portion of the scenario depends on holdings marked as taking more than five days to liquidate.' : null,
      top?.postWeight > 12 ? 'The remaining portfolio becomes more concentrated after the simulated sales.' : null
    ].filter(Boolean)
  };
}

export function analyzePortfolioCsv(text, options = {}) {
  const records = parseCsv(String(text || '').replace(/^\uFEFF/, ''));
  const preliminary = records.map(record => ({
    row: record.__row,
    security: String(first(pick(record, ALIASES.security), pick(record, ALIASES.issuer), `Holding ${record.__row}`)).trim(),
    issuer: String(first(pick(record, ALIASES.issuer), pick(record, ALIASES.security), 'Unknown issuer')).trim(),
    sector: String(first(pick(record, ALIASES.sector), 'Unclassified')).trim(),
    assetClass: String(first(pick(record, ALIASES.assetClass), 'Unclassified')).trim(),
    value: number(pick(record, ALIASES.value)),
    suppliedWeight: number(pick(record, ALIASES.weight)),
    rating: String(first(pick(record, ALIASES.rating), 'Not supplied')).trim(),
    liquidityDays: Math.max(0, number(pick(record, ALIASES.liquidityDays))),
    adv: Math.max(0, number(pick(record, ALIASES.adv))),
    listed: String(first(pick(record, ALIASES.listed), 'Not supplied')).trim(),
    maturity: String(pick(record, ALIASES.maturity) || '').trim(),
    quantity: number(pick(record, ALIASES.quantity)),
    price: number(pick(record, ALIASES.price))
  }));
  const hasWeights = preliminary.some(item => item.suppliedWeight > 0);
  const totalValue = preliminary.reduce((sum, item) => sum + item.value, 0);
  if (!hasWeights && totalValue <= 0) throw new Error('Include either a portfolio weight or market value column.');
  const weightTotal = preliminary.reduce((sum, item) => sum + item.suppliedWeight, 0);
  const holdings = preliminary.map(item => ({
    ...item,
    weight: pct(hasWeights ? item.suppliedWeight / (weightTotal || 100) * 100 : item.value / totalValue * 100)
  })).sort((a, b) => b.weight - a.weight);

  const sectors = groupWeights(holdings, 'sector');
  const issuers = groupWeights(holdings, 'issuer');
  const ratings = groupWeights(holdings, 'rating');
  const assetClasses = groupWeights(holdings, 'assetClass');
  const cashWeight = pct(holdings.filter(item => /cash|treasury|money market|liquid/i.test(`${item.assetClass} ${item.security}`)).reduce((sum, item) => sum + item.weight, 0));
  const unlistedWeight = pct(holdings.filter(item => /unlisted|no|false/i.test(item.listed)).reduce((sum, item) => sum + item.weight, 0));
  const belowAAWeight = pct(holdings.filter(item => ratingRank(item.rating) > ratingRank('AA-') && ratingRank(item.rating) < 999).reduce((sum, item) => sum + item.weight, 0));
  const slowLiquidityWeight = pct(holdings.filter(item => item.liquidityDays > 5).reduce((sum, item) => sum + item.weight, 0));
  const missingLiquidityWeight = pct(holdings.filter(item => !item.liquidityDays && !item.adv).reduce((sum, item) => sum + item.weight, 0));

  const flags = [];
  issuers.filter(item => item.weight > 10).forEach(item => flags.push({
    id: crypto.randomUUID(), severity: item.weight > 15 ? 'High' : 'Medium', category: 'Issuer concentration',
    title: `${item.name} represents ${item.weight}% of the portfolio`, evidence: `Calculated from uploaded holding rows for ${item.name}.`,
    action: 'Verify the scheme and internal single-issuer limit and obtain approval or rebalance where required.'
  }));
  sectors.filter(item => item.weight > 30).forEach(item => flags.push({
    id: crypto.randomUUID(), severity: item.weight > 40 ? 'High' : 'Medium', category: 'Sector concentration',
    title: `${item.name} sector exposure is ${item.weight}%`, evidence: 'Aggregated from the uploaded sector column.',
    action: 'Assess benchmark, mandate, correlation and stress concentration before further exposure.'
  }));
  if (cashWeight < 3) flags.push({ id: crypto.randomUUID(), severity: 'Medium', category: 'Liquidity', title: `Mapped cash and liquid exposure is ${cashWeight}%`, evidence: 'Cash-like holdings were identified from asset-class and security labels.', action: 'Validate settlement cash, expected flows and redemption buffer.' });
  if (slowLiquidityWeight > 15) flags.push({ id: crypto.randomUUID(), severity: slowLiquidityWeight > 25 ? 'High' : 'Medium', category: 'Liquidity', title: `${slowLiquidityWeight}% is marked above five liquidation days`, evidence: 'Calculated from the uploaded liquidity-days field.', action: 'Run stressed redemption scenarios and document the disposal sequence.' });
  if (missingLiquidityWeight > 25) flags.push({ id: crypto.randomUUID(), severity: 'Medium', category: 'Data quality', title: `Liquidity evidence is missing for ${missingLiquidityWeight}% of exposure`, evidence: 'Neither liquidity-days nor ADV was supplied for these rows.', action: 'Complete security-level liquidity inputs before relying on redemption results.' });
  if (belowAAWeight > 10) flags.push({ id: crypto.randomUUID(), severity: belowAAWeight > 20 ? 'High' : 'Medium', category: 'Credit', title: `${belowAAWeight}% is rated below AA-`, evidence: 'Calculated from supplied external ratings.', action: 'Check scheme rating restrictions, internal credit limits and downgrade actions.' });

  const dataGaps = [
    holdings.every(item => item.sector === 'Unclassified') ? 'Sector classification was not supplied.' : null,
    holdings.every(item => item.rating === 'Not supplied') ? 'Credit ratings were not supplied.' : null,
    holdings.every(item => !item.liquidityDays && !item.adv) ? 'No security-level liquidity field was supplied.' : null,
    holdings.every(item => item.listed === 'Not supplied') ? 'Listing status was not supplied.' : null,
    Math.abs(holdings.reduce((sum, item) => sum + item.weight, 0) - 100) > 0.5 ? 'Normalised portfolio weights differ materially from 100%; inspect the source data.' : null
  ].filter(Boolean);

  const score = Math.min(100, Math.round(
    Math.min(30, (issuers[0]?.weight || 0) * 1.3) +
    Math.min(22, (sectors[0]?.weight || 0) * 0.45) +
    Math.min(20, slowLiquidityWeight * 0.7) +
    Math.min(15, belowAAWeight * 0.5) +
    Math.min(13, dataGaps.length * 3)
  ));

  return {
    kind: 'portfolio',
    title: options.title || 'Uploaded portfolio',
    generated_at: new Date().toISOString(),
    engine: 'server-calculated-portfolio-v1',
    source_rows: records.length,
    currency: options.currency || 'As supplied',
    total_value: round(totalValue, 2),
    overall_risk: severity(score),
    overall_score: score,
    metrics: {
      holdings: holdings.length,
      cash_weight: cashWeight,
      top_holding_weight: issuers[0]?.weight || 0,
      top_sector_weight: sectors[0]?.weight || 0,
      below_aa_weight: belowAAWeight,
      unlisted_weight: unlistedWeight,
      slow_liquidity_weight: slowLiquidityWeight,
      missing_liquidity_weight: missingLiquidityWeight
    },
    holdings: holdings.slice(0, 250),
    top_holdings: holdings.slice(0, 12),
    issuer_exposure: issuers.slice(0, 20),
    sector_exposure: sectors.slice(0, 20),
    rating_distribution: ratings.slice(0, 20),
    asset_class_distribution: assetClasses.slice(0, 20),
    flags,
    data_gaps: dataGaps,
    redemption_scenarios: [5, 10, 20, 30].map(value => redemptionScenario(holdings, value)),
    assumptions: [
      'Weights are normalised to 100% from the supplied weight column or calculated from market value.',
      'Liquidity scenarios use uploaded liquidity-days or security labels; they do not represent executable market quotes.',
      'No market, issuer or regulatory fact is invented when it is absent from the uploaded data.'
    ]
  };
}

function lineReference(text, index) {
  return `Line ${String(text).slice(0, index).split('\n').length}`;
}

const DOCUMENT_RULES = [
  [/guaranteed return|assured return|capital guarantee/i, 'Investor promise', 88, 'The document contains language that may be read as guaranteeing capital or returns.', 'Confirm whether the statement is legally and factually supportable and align all investor communication.'],
  [/absolute discretion|sole discretion|without restriction/i, 'Uncontrolled discretion', 72, 'Material discretion appears insufficiently constrained by mandate, approval or fiduciary standards.', 'Define objective parameters, escalation conditions and accountable approval.'],
  [/related party|associate|affiliate transaction|conflict of interest/i, 'Conflict of interest', 82, 'The document contemplates a related-party or conflict-sensitive decision.', 'Record conflict assessment, independent approval, pricing basis and investor-interest rationale.'],
  [/suspend.{0,80}(redemption|withdrawal)|gate.{0,80}redemption/i, 'Redemption restriction', 78, 'The document permits a restriction on investor liquidity.', 'Map the trigger, authority, notice, fairness assessment and review process.'],
  [/leverage|borrow.{0,40}portfolio|derivative/i, 'Leverage and derivatives', 66, 'Leverage or derivative exposure can amplify market, liquidity and counterparty risk.', 'Specify purpose, limits, collateral, stress tests and independent monitoring.'],
  [/valuation.{0,100}(discretion|estimate|model)|fair value/i, 'Valuation judgement', 63, 'Valuation depends on judgement or a model rather than an observable price.', 'Define hierarchy, validation, stale-price controls, overrides and review evidence.'],
  [/delegate|outsourc|service provider|fund administrator|custodian|rta/i, 'Third-party dependency', 58, 'A material activity is delegated to an external provider.', 'Map responsibilities, oversight evidence, SLA, incident, audit, continuity and exit controls.'],
  [/personal data|investor data|pan|aadhaar|passport|bank account/i, 'Investor data', 70, 'Investor or identity data is processed.', 'Confirm purpose, access, retention, location, incident response and lawful disclosure controls.'],
  [/material non-public|inside information|mnpi|insider trading/i, 'Market conduct', 84, 'The document touches material non-public information or dealing restrictions.', 'Apply information barriers, restricted lists, pre-clearance, surveillance and evidence retention.'],
  [/may change.{0,80}without notice|unilateral.{0,80}change/i, 'Unilateral change', 61, 'Material terms may be changed without adequate notice or approval.', 'Require defined authority, impact assessment, investor communication and change control.']
];

export function analyzeInstitutionalDocument(text, options = {}) {
  const clean = String(text || '').replace(/\u0000/g, '').trim();
  if (clean.length < 20) throw new Error('The document does not contain enough readable text.');
  const lower = clean.toLowerCase();
  const type = /scheme information|investment objective|asset allocation/.test(lower) ? 'Scheme / Investment Mandate'
    : /circular|regulation|master circular|direction|guideline/.test(lower) ? 'Regulatory Document'
      : /investment committee|investment proposal|credit note/.test(lower) ? 'Investment Proposal'
        : /service level|vendor|custodian|administrator|agreement/.test(lower) ? 'Service Provider / Commercial Document'
          : 'Institutional Document';
  const findings = [];
  DOCUMENT_RULES.forEach(([regex, title, score, explanation, action]) => {
    const match = regex.exec(clean);
    if (!match) return;
    const start = Math.max(0, (match.index || 0) - 100);
    const end = Math.min(clean.length, (match.index || 0) + match[0].length + 220);
    findings.push({
      id: crypto.randomUUID(), title, category: title, severity: severity(score), score,
      reference: lineReference(clean, match.index || 0),
      evidence: clean.slice(start, end).replace(/\s+/g, ' ').trim(),
      fact: `The uploaded text contains language relevant to ${title.toLowerCase()}.`,
      inference: explanation,
      action,
      confidence: 88
    });
  });
  const missing = [
    !/owner|responsible|accountable/i.test(clean) ? 'A clearly accountable owner was not identified.' : null,
    !/approval|approved by|committee|board|trustee/i.test(clean) ? 'The approval authority or governance route was not clearly identified.' : null,
    !/review date|periodic review|annually|quarterly/i.test(clean) ? 'A review frequency or expiry date was not located.' : null,
    !/limit|threshold|maximum|minimum|not exceed/i.test(clean) ? 'Objective limits or thresholds were not located.' : null,
    !/evidence|record|retain|audit trail/i.test(clean) ? 'Evidence-retention requirements were not located.' : null
  ].filter(Boolean);
  const high = findings.filter(item => item.severity === 'High').length;
  const score = Math.min(100, Math.round((findings.reduce((sum, item) => sum + item.score, 0) / Math.max(1, findings.length)) * 0.72 + high * 5 + missing.length * 2));
  return {
    kind: 'document', title: options.title || 'Uploaded institutional document', document_type: type,
    generated_at: new Date().toISOString(), engine: 'server-institutional-rules-v1', overall_risk: severity(score), overall_score: score,
    summary: `Fresh analysis of the uploaded text identified ${findings.length} material signal(s), including ${high} high-priority item(s), and ${missing.length} governance or evidence gap(s).`,
    findings, missing_information: missing,
    next_actions: findings.slice(0, 6).map((item, index) => ({ priority: index + 1, owner: item.category === 'Investor data' ? 'Data Protection / Operations' : item.category === 'Third-party dependency' ? 'Operations / Risk' : 'Investment / Risk / Compliance', action: item.action })),
    source_boundaries: ['Document facts are taken only from the uploaded text.', 'Interpretive statements are marked as inference.', 'Current external law, market data and issuer facts are not assumed.']
  };
}

function extractMandateRules(text) {
  const clean = String(text || '').replace(/\u0000/g, ' ');
  const patterns = [
    { type: 'issuer_max', label: 'Maximum single issuer exposure', regex: /(?:single|one|any)\s+issuer.{0,80}?(?:not exceed|maximum|up to)\s+(\d+(?:\.\d+)?)\s*%/ig },
    { type: 'sector_max', label: 'Maximum sector exposure', regex: /(?:one|any|single)\s+sector.{0,80}?(?:not exceed|maximum|up to)\s+(\d+(?:\.\d+)?)\s*%/ig },
    { type: 'cash_min', label: 'Minimum cash or liquid assets', regex: /(?:cash|liquid assets?).{0,80}?(?:at least|minimum|not less than)\s+(\d+(?:\.\d+)?)\s*%/ig },
    { type: 'below_aa_max', label: 'Maximum exposure below AA-', regex: /(?:below\s+aa-?|rated lower than\s+aa-?).{0,100}?(?:not exceed|maximum|up to)\s+(\d+(?:\.\d+)?)\s*%/ig },
    { type: 'unlisted_max', label: 'Maximum unlisted exposure', regex: /unlisted.{0,80}?(?:not exceed|maximum|up to)\s+(\d+(?:\.\d+)?)\s*%/ig },
    { type: 'slow_liquidity_max', label: 'Maximum illiquid or slow-liquidity exposure', regex: /(?:illiquid|not readily marketable|slow liquidity).{0,100}?(?:not exceed|maximum|up to)\s+(\d+(?:\.\d+)?)\s*%/ig }
  ];
  const rules = [];
  patterns.forEach(pattern => {
    for (const match of clean.matchAll(pattern.regex)) {
      rules.push({ id: crypto.randomUUID(), type: pattern.type, label: pattern.label, limit: number(match[1]), reference: lineReference(clean, match.index || 0), evidence: match[0].replace(/\s+/g, ' ').trim() });
    }
  });
  return rules;
}

export function analyzeMandate(text, portfolio, options = {}) {
  const clean = String(text || '').trim();
  if (clean.length < 20) throw new Error('Upload or paste a readable mandate or scheme document.');
  const rules = extractMandateRules(clean);
  const metrics = portfolio?.metrics || {};
  const actualByType = {
    issuer_max: metrics.top_holding_weight,
    sector_max: metrics.top_sector_weight,
    cash_min: metrics.cash_weight,
    below_aa_max: metrics.below_aa_weight,
    unlisted_max: metrics.unlisted_weight,
    slow_liquidity_max: metrics.slow_liquidity_weight
  };
  const tests = rules.map(rule => {
    const actual = actualByType[rule.type];
    if (actual === undefined || actual === null) return { ...rule, status: 'Not testable', actual: null, variance: null, explanation: 'The active portfolio does not contain the metric required for this rule.' };
    const isMinimum = rule.type === 'cash_min';
    const pass = isMinimum ? actual >= rule.limit : actual <= rule.limit;
    return {
      ...rule, status: pass ? 'Compliant' : 'Breach', actual: pct(actual), variance: pct(isMinimum ? actual - rule.limit : rule.limit - actual),
      explanation: pass ? `Uploaded portfolio value ${actual}% is within the ${rule.limit}% rule.` : `Uploaded portfolio value ${actual}% is outside the ${rule.limit}% rule.`
    };
  });
  const breachCount = tests.filter(item => item.status === 'Breach').length;
  return {
    kind: 'mandate', title: options.title || 'Mandate compliance review', generated_at: new Date().toISOString(), engine: 'server-mandate-mapper-v1',
    rules, tests, breach_count: breachCount, overall_risk: breachCount ? 'High' : rules.length ? 'Low' : 'Medium',
    summary: rules.length ? `${rules.length} quantitative rule(s) were extracted and ${tests.filter(item => item.status !== 'Not testable').length} were tested against the active portfolio.` : 'No reliably testable percentage restriction was extracted. The document may use a table or drafting style that requires manual rule configuration.',
    missing_information: [!portfolio ? 'No active uploaded portfolio was supplied for testing.' : null, !rules.length ? 'No supported quantitative limit was extracted.' : null].filter(Boolean),
    actions: tests.filter(item => item.status === 'Breach').map(item => ({ owner: 'Fund Manager / Risk / Compliance', action: `Investigate and resolve the ${item.label.toLowerCase()} breach; actual ${item.actual}% against limit ${item.limit}%.`, evidence: item.evidence }))
  };
}

export function analyzeRegulatoryChange(text, options = {}) {
  const clean = String(text || '').replace(/\u0000/g, '').trim();
  if (clean.length < 20) throw new Error('Upload or paste a readable regulatory update.');
  const sentences = clean.split(/(?<=[.;])\s+|\n+/).map(value => value.trim()).filter(value => value.length > 25);
  const obligations = sentences.filter(value => /\b(shall|must|required to|will be required|ensure|prohibited|not permit|submit|report|disclose|maintain)\b/i.test(value)).slice(0, 20).map((sentence, index) => ({
    id: crypto.randomUUID(), reference: `Extract ${index + 1}`, obligation: sentence.slice(0, 700),
    owner: /nav|valuation|pricing/i.test(sentence) ? 'Fund Accounting / Valuation' : /investor|complaint|disclosure|communication/i.test(sentence) ? 'Investor Relations / Compliance' : /liquidity|risk|stress/i.test(sentence) ? 'Risk / Fund Management' : /cyber|data|technology/i.test(sentence) ? 'Technology / Information Security' : 'Compliance / Operations',
    due_date: (sentence.match(/\b(?:by|before|within)\s+([^.;]{3,60})/i)?.[1] || 'Not explicit').trim(),
    status: 'Assessment required'
  }));
  const areas = [
    [/liquidity|redemption|stress test/i, 'Liquidity and redemption risk'],
    [/valuation|nav|price|fair value/i, 'Valuation and NAV'],
    [/investor|unit holder|complaint|disclosure/i, 'Investor servicing and disclosure'],
    [/scheme|investment limit|asset allocation|issuer|sector/i, 'Scheme mandate and portfolio restrictions'],
    [/custodian|rta|service provider|outsourc/i, 'Service-provider oversight'],
    [/cyber|data|technology|incident/i, 'Technology, data and resilience'],
    [/trustee|board|committee|governance/i, 'Governance and approvals'],
    [/report|return|filing|submit/i, 'Regulatory reporting']
  ].filter(([regex]) => regex.test(clean)).map(([, area]) => area);
  const dates = [...clean.matchAll(/\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/gi)].map(match => match[0]).slice(0, 12);
  return {
    kind: 'regulatory', title: options.title || 'Regulatory change assessment', generated_at: new Date().toISOString(), engine: 'server-regulatory-impact-v1',
    summary: `The uploaded update contains ${obligations.length} obligation-like statement(s) and touches ${areas.length || 1} institutional operating area(s).`,
    affected_areas: areas.length ? areas : ['General governance and compliance assessment'], obligations, detected_dates: dates,
    action_plan: obligations.slice(0, 12).map((item, index) => ({ priority: index < 3 ? 'Immediate' : 'Planned', owner: item.owner, action: `Assess, map and evidence: ${item.obligation.slice(0, 240)}`, due_date: item.due_date })),
    evidence_pack: ['Uploaded source text and content fingerprint', 'Obligation register', 'Affected policy, control and process mapping', 'Assigned remediation tasks', 'Approval and closure evidence'],
    limitations: ['This analysis maps only the uploaded text.', 'Official applicability, effective date and current legal status require authorised verification.']
  };
}

export function answerFromInstitutionalContext(question, context = {}) {
  const terms = String(question || '').toLowerCase().split(/[^a-z0-9]+/).filter(term => term.length > 3);
  const candidates = [];
  const collect = (label, items = []) => items.forEach(item => {
    const text = JSON.stringify(item);
    const score = terms.reduce((sum, term) => sum + Number(text.toLowerCase().includes(term)), 0);
    if (score) candidates.push({ label, item, score });
  });
  collect('Portfolio flag', context.portfolio?.flags);
  collect('Holding', context.portfolio?.top_holdings);
  collect('Mandate test', context.mandate?.tests);
  collect('Document finding', context.document?.findings);
  collect('Regulatory obligation', context.regulatory?.obligations);
  candidates.sort((a, b) => b.score - a.score);
  if (!candidates.length) return 'The active uploaded analyses do not contain enough evidence to answer that question reliably.';
  return candidates.slice(0, 6).map(entry => `${entry.label}: ${JSON.stringify(entry.item, null, 2)}`).join('\n\n');
}

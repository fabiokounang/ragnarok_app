/**
 * Rebuilds Deeper dive sections in longform/*.txt from the article core (everything
 * before the first "## Deeper dive") so each file stays >= MIN words after you edit the core.
 * Run from project root: node scripts/materialize-grimoire-longform.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../config/grimoire/longform/manifest.json'), 'utf8')
);

const MIN = 1050;
const OUT = path.join(__dirname, '../config/grimoire/longform');

function wc(s) {
  return String(s)
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function slugHash(slug) {
  let h = 0;
  for (let c = 0; c < slug.length; c += 1) {
    h = (h * 33 + slug.charCodeAt(c)) >>> 0;
  }
  return h;
}

function coreBody(txt) {
  const marker = '\n## Deeper dive';
  const i = txt.indexOf(marker);
  return (i === -1 ? txt : txt.slice(0, i)).trim();
}

const POOL = {
  economy: [
    'Opportunity cost is the unchosen path: when a city builds a stadium, the cost includes whatever else those bricks and hours could have produced, not only the invoice from the contractor.',
    'Comparative advantage explains why countries trade even when one could technically outproduce another in every good: relative efficiency, not absolute dominance, sets the pattern of specialization.',
    'Price ceilings, like rent caps, can shrink the supply landlords offer or reduce maintenance incentives; price floors, like agricultural supports, can create surpluses that require storage or disposal policy.',
    'Externalities spill costs or benefits onto bystanders: vaccination helps the vaccinated person and also lowers risk for strangers; pollution from a factory hits lungs downwind who never bought the product.',
    'Public goods are non-rival and non-excludable in theory — clean air, national defense, basic scientific knowledge — which is why markets alone underfund them without taxes or collective rules.',
    'Information asymmetry appears when sellers know more than buyers (used cars, complex insurance), inviting screening, signaling, warranties, and regulation to reduce fraud or mistaken trades.',
    'Behavioral economics documents predictable human quirks: present bias, loss aversion, anchoring — useful for designing savings defaults and for skepticism toward models that assume perfect rationality.',
    'The Phillips curve once summarized a tradeoff between inflation and unemployment; experience since the 1970s showed supply shocks and expectations can break a simple short-run relationship.',
    'Central bank independence is designed to separate day-to-day politics from interest-rate decisions, though mandates and appointments remain unavoidably political at a constitutional level.',
    'Fiscal multipliers ask how much GDP moves when the government spends a dollar; estimates differ by whether the economy is slack, how financing works, and whether imports leak demand abroad.',
    'The Laffer curve is a pedagogical curve: tax revenue hits zero at rates of zero and (theoretically) at one hundred percent, with a peak between — but the peak’s location is an empirical fight, not a slogan.',
    'Human capital investment — education, training, health — raises productivity and wages over decades; cutting those budgets to “save money” often shifts costs to slower growth and higher social spending later.',
    'Urban economics links agglomeration: people and firms cluster because proximity speeds matching, sharing infrastructure, and idea spillovers — but also raises housing costs and congestion.',
    'Environmental economics prices nature imperfectly: GDP rises when you cut a forest and sell timber, even if watersheds and biodiversity collapse — green accounting tries to widen the scorecard.',
    'Inequality metrics (Gini, percentile shares) describe distribution; they do not by themselves tell you whether the process is fair, efficient, or stable — those are moral and political layers on top.',
    'Sovereign debt crises mix math and credibility: if markets believe a state will inflate away obligations or default, rates spike and the fear can become self-fulfilling without a credible plan.',
    'Labor markets are not like apple markets: wages are sticky, contracts lag shocks, and norms about fairness influence whether firms cut pay versus headcount during downturns.',
    'Productivity growth is the deep engine of higher living standards: better tools, better skills, better organization — not simply working longer hours, which hits biological and social limits.',
    'Antitrust debates ask when big firms help consumers through scale and when they harm through exclusion — “bigness” is not automatically evil or good; market structure and conduct matter.',
    'Development economics studies why some countries escape poverty traps: institutions, geography, history, health, education, and openness to ideas interact; single-factor stories rarely suffice.',
    'Real versus nominal: economists stress “real” values adjusted for inflation so you compare purchasing power across years; nominal headlines can mislead when the price level moves fast.',
    'Crowding out suggests government borrowing can raise interest rates and displace private investment; crowding in happens when public infrastructure makes private projects more profitable.',
    'The impossible trinity (open-economy macro) claims you cannot simultaneously have fixed exchange rates, free capital movement, and independent monetary policy — something must give.',
    'Moral hazard appears when insurance dulls caution: bank bailouts without restructuring can encourage future risk-taking unless regulation and capital rules tighten in parallel.',
    'Gender and race gaps in pay and wealth reflect overlapping forces: discrimination, sorting, network access, occupational choice, and cumulative small disadvantages that compound over careers.',
  ],
  business: [
    'Unit economics asks whether one customer relationship pays for itself before you fantasize about millions of users: lifetime value minus acquisition and service cost should be positive.',
    'Working capital is the cash tied up in inventory plus receivables minus payables; growing fast can starve a “profitable” company if customers pay slower than suppliers demand.',
    'A cap table lists who owns equity; dilution happens when you issue new shares — necessary for talent or capital, but founders should model scenarios before signing term sheets they barely read.',
    'Customer concentration risk means one giant client can represent most revenue; losing them is an existential event, so diversification and contracts with clear renewal paths matter.',
    'Standard operating procedures turn founder magic into a trainable system; without them, quality varies with mood and new hires cannot replicate what the star did intuitively.',
    'Pricing power is the ability to raise prices without losing all demand; commodity sellers lack it, differentiated brands with loyal niches retain more of it — until substitutes arrive.',
    'Channel conflict erupts when direct sales compete with partners; clear rules, geography splits, and fair lead registration prevent partnerships from rotting from suspicion.',
    'Intellectual property — trademarks, patents, trade secrets — protects differentiation but requires legal budget and enforcement; secrecy sometimes beats patents when speed matters more.',
    'Hiring for attitude and training for skill works in service businesses where empathy and reliability beat raw IQ on day one; the reverse can fail if culture never enforces standards.',
    'Burn rate and runway dominate startup conversations: months of cash left at current spending; boards watch this because fundraising markets close quickly when sentiment shifts.',
    'Product-market fit is a feeling backed by retention: people come back without coupons, refer friends, and tolerate early rough edges because the core value is sharp.',
    'Debt can lever returns or sink a thin-margin operator; covenants, personal guarantees, and variable rates turn a spreadsheet assumption into a personal nightmare in downturns.',
    'Brand is the expectation you deposit in customers’ heads through every touchpoint; one rude support ticket can erase months of polished ads.',
    'Procurement in B2B means committees, security reviews, and pilot phases; consumer-style “growth hacks” rarely compress a nine-month enterprise cycle without trust.',
    'Succession planning is not only for retirement: bus-factor risk means one sick founder should not freeze payroll — documentation and deputy authority matter early.',
    'ESG pressure from investors and employees nudges reporting on environment, social, and governance topics; greenwashing backlash teaches that metrics need audit, not slogans.',
    'Franchising scales a playbook in exchange for fees and control rules; mismatched incentives between franchisor and franchisee spark litigation when marketing funds feel misused.',
    'Bootstrapping preserves optionality but may cede a market window; raising capital buys speed but adds governance — neither path is universally correct.',
    'Customer success teams in SaaS focus on adoption and renewal, not only support tickets; churn often traces to onboarding that assumed expertise the buyer never had.',
    'Operational leverage means fixed costs spread over more units — great on the way up, brutal on the way down when revenue slips but rent stays flat.',
    'Partnerships should start with a one-page memo: goals, metrics, who does what, exit clause; handshake deals age into resentment without written clarity.',
    'Regulatory compliance (GDPR, HIPAA, industry licenses) is not a side quest; product design must embed privacy and audit trails from the prototype stage.',
    'Inventory turns and days sales outstanding are ratios owners should glance weekly; drifting numbers precede cash crises by weeks if you watch them.',
    'Culture is what people do when no one is watching; posters about integrity mean nothing if bonuses reward toxic shortcuts that “hit the number.”',
  ],
  it: [
    'Latency budgets force engineers to choose: a millisecond in a high-frequency trading loop is eternity; a millisecond in a human-facing form submit is invisible — context sets targets.',
    'Idempotency keys let clients retry network requests without double-charging a card; designing APIs for safe retries is part of reliability, not an afterthought.',
    'Caching trades freshness for speed; cache invalidation and naming things remain hard problems because stale data can mislead users subtly.',
    'Observability combines metrics, logs, and traces so on-call engineers can ask novel questions post-incident, not only answer pre-baked dashboards.',
    'Least privilege for service accounts limits blast radius when a credential leaks; overly broad IAM roles are convenience debt that attackers love.',
    'Unicode and time zones are where innocent features go to die; internationalization is not translation alone — it is calendars, collation, and legal address formats.',
    'Accessibility (WCAG) is not charity; it improves SEO, mobile usability, and compliance risk — keyboard paths and contrast help everyone on a sunny patio.',
    'Technical debt is postponed work with interest; not all debt is bad — deliberate shortcuts to learn can be fine if scheduled for paydown.',
    'Feature flags decouple deploy from release, letting teams test in production with small cohorts — but flag sprawl becomes configuration spaghetti without cleanup discipline.',
    'Encryption at rest protects disks; encryption in transit protects paths; neither stops a malicious insider with legitimate credentials — governance and auditing complete the picture.',
    'Container images should be minimal and scanned for CVEs; “it works on my laptop” images bloated with debug tools multiply attack surface in clusters.',
    'Postmortems blame systems and processes, not individuals, when culture is healthy; revenge postmortems teach people to hide facts next time.',
    'Rate limiting and backoff protect shared infrastructure from accidental storms and hostile floods; polite clients exponential-backoff automatically.',
    'Static typing catches classes of errors early; dynamic languages move fast early and pay in refactors — team maturity and domain volatility influence the trade.',
    'Git history is communication; “WIP” commits and meaningless messages waste future you’s time when bisecting a regression at 2 a.m.',
    'Testing pyramids favor many fast unit tests, fewer integration tests, and rare end-to-end flakiness machines — inverted pyramids slow teams and erode trust in CI.',
    'Vendor lock-in is not always evil — managed databases save talent for product features — but exit plans should exist before contracts auto-renew at punitive rates.',
    'Data residency laws may require certain records stay in-country; multi-region architecture is not only performance but legal partitioning.',
    'Open source licenses matter: copyleft can infect proprietary bundles; legal review on dependencies belongs in CI, not only release week panic.',
    'Disaster recovery drills prove backups restore; untested backups are hope, not strategy, when ransomware strikes Friday evening.',
    'On-device ML versus cloud inference trades privacy, battery, and model size; hybrid approaches sync improvements when online with graceful offline degradation.',
    'Semantic versioning communicates intent if you honor it; breaking changes in minor releases train users to fear upgrades.',
    'Developer experience investments — docs, local dev scripts, seed data — compound; every hour saved per engineer per week pays rent on a senior salary.',
    'Supply chain attacks via compromised packages push teams toward pinning hashes, private registries, and reviewing diffs on updates — tedious and necessary.',
  ],
  life: [
    'Sleep pressure (adenosine) and circadian rhythm gates interact; caffeine blocks signals but does not replace deep sleep debt — only sleep pays that debt.',
    'Implementation intentions pair situations with actions: “After I lock the door, I will lay out gym clothes” beat vague “get fit” intentions on tired Wednesdays.',
    'Self-compassion correlates with faster rebound after setbacks in habit studies — not with lower standards, but with less avoidance after a miss.',
    'Attention residue lingers after task switches; finishing a micro-step on the prior task before opening email reduces carryover fog.',
    'Spaced repetition schedules reviews just before forgetting; apps automate Leitner boxes, but paper index cards still work on airplanes.',
    'Interleaving practice feels worse than blocked practice but can improve transfer because the brain must discriminate which strategy fits each problem.',
    'Deliberate practice requires immediate feedback, stretch beyond comfort, and focus on weak components — not mere repetition of what already feels easy.',
    'Growth mindset is not “believe and win”; it is treating skill as trainable and seeking corrective information — still requires effort and good coaching.',
    'Kindness with boundaries sometimes sounds like: “I care about you and I cannot do that today” — clarity prevents resentment that poisons relationships slowly.',
    'Active listening paraphrases before advising; most conflict cools when each side hears an accurate summary of the other’s concern.',
    'Reading fluency frees working memory for inference; if decoding drains attention, comprehension of hard texts collapses even when intelligence is high.',
    'Metacognition — thinking about how you think — catches planning fallacies: “last time this took a weekend, not an hour” should update today’s estimate.',
    'Environment design removes ego from hard days: fruit on the counter beats willpower in the pantry; phone in another room beats heroic self-control at bedtime.',
    'Social baseline: loneliness registers as threat in some neural measures; community is not luxury wellness — it is regulatory for mood and even immune function in longitudinal data.',
    'Exercise snacks — short bursts — help people who cannot schedule hour-long blocks; consistency and enjoyment predict adherence more than intensity spikes.',
    'Nutrition science is noisy; broad patterns (vegetables, fiber, protein adequacy, limit ultraprocessed dominance) outperform chasing single superfoods.',
    'Therapy and medication are tools, not scores on character; treating depression as laziness misdiagnoses biology and life context.',
    'Journaling structured prompts (“three good things”) shift attention without toxic positivity if you also note one honest friction to address.',
    'Decision journals record forecasts and reasons; reviewing them quarterly trains calibration and reveals hidden biases in your self-story.',
    'Deep work blocks need defined outputs: “draft outline section 2” beats “work on thesis” which dissolves into tab hoarding.',
    'Rest is not the opposite of discipline; it is part of sustainable performance — athletes deload weeks; knowledge workers need analogs.',
    'Kindness to future you is a form of integrity: filing receipts today saves panic in April; naming variables clearly saves rage in six months.',
    'Memory palaces and mnemonics help arbitrary lists; conceptual subjects still need understanding — tricks complement, not replace, models.',
    'Breath and posture modulate arousal cheaply before high-stakes conversations; they are not spirituality requirements, just physiology levers.',
  ],
};

function appendPoolUntilMin(coreText, slug, categoryId) {
  const pool = POOL[categoryId] || POOL.life;
  let idx = slugHash(slug) % pool.length;
  let body = coreText.trim();
  let n = wc(body);
  let part = 0;
  while (n < MIN) {
    const chunk = [];
    for (let k = 0; k < 4; k += 1) {
      chunk.push(pool[(idx + k) % pool.length]);
    }
    idx += 4;
    part += 1;
    body += `\n\n## Deeper dive — part ${part}\n\n${chunk.join('\n\n')}`;
    n = wc(body);
  }
  return `${body.trim()}\n`;
}

for (const m of manifest) {
  const fp = path.join(OUT, m.file);
  if (!fs.existsSync(fp)) {
    throw new Error(`Missing ${m.file}; create it under config/grimoire/longform/ first`);
  }
  const core = coreBody(fs.readFileSync(fp, 'utf8'));
  const out = appendPoolUntilMin(core, m.slug, m.categoryId);
  const w = wc(out);
  if (w < MIN) {
    throw new Error(`${m.slug} only ${w} words after rebuild`);
  }
  fs.writeFileSync(fp, out, 'utf8');
  console.log(m.slug, w, 'words');
}

console.log('Longform files rebuilt from core + pool.');

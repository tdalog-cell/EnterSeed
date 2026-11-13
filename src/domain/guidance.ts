import { z } from 'zod';

const text = (max = 200) => z.string().trim().min(1).max(max);
export const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}, 'Use a valid calendar date');
export const optionalDay = z.union([daySchema, z.literal('')]);
export const money = z.number().finite().min(0).max(1e9);
export const profileSchema = z.object({
  businessName: text(), sector: text(), stage: z.enum(['idea', 'starting', 'operating', 'growing']),
  size: z.enum(['micro', 'small', 'medium']), location: text(), products: text(1000),
  goal: z.enum(['profit', 'cash', 'customers', 'registration', 'funding']), challenges: z.string().trim().max(2000),
  language: z.enum(['en', 'fil', 'ceb', 'hil'])
});
export type BusinessProfile = z.infer<typeof profileSchema>;
export const actionStatus = z.enum(['not_started', 'in_progress', 'completed']);
export const actionSchema = z.object({ title: text(), status: actionStatus, dismissed: z.boolean().default(false) });
export const reminderSchema = z.object({
  title: text(), date: daySchema, category: z.enum(['loan', 'permit', 'registration', 'supplier', 'follow_up', 'opportunity', 'custom']),
  completed: z.boolean().default(false), actionId: z.number().int().positive().nullable().default(null),
  opportunityId: z.number().int().positive().nullable().default(null), debtId: z.string().max(100).default('')
});
const officialUrl = z.string().url().max(2000).refine(v => new URL(v).protocol === 'https:', 'Use an HTTPS source URL');
export const opportunitySchema = z.object({
  name: text(), provider: text(), description: text(3000), sourceUrl: officialUrl,
  eligibility: text(3000), location: text(), sector: text(), stage: z.enum(['all', 'idea', 'starting', 'operating', 'growing']),
  deadline: optionalDay, procedure: text(3000), verifiedDate: optionalDay,
  verification: z.enum(['draft', 'reviewed', 'needs_review', 'expired']), published: z.boolean()
}).refine(v => !v.published || (v.verification === 'reviewed' && !!v.verifiedDate), 'Publishing requires a completed source review and review date');
export const supportStatuses = ['submitted', 'assigned', 'in_progress', 'awaiting_user', 'resolved', 'closed'] as const;
export const supportSchema = z.object({ title: text(), category: z.enum(['finance', 'registration', 'suppliers', 'marketing', 'technical', 'pilot_feedback', 'other']), message: text(5000) });
export const supportUpdateSchema = z.object({ status: z.enum(supportStatuses), assignee: z.number().int().positive().nullable(), followUp: optionalDay });
export const replySchema = z.object({ message: text(5000), internal: z.boolean().default(false) });
export const costingSchema = z.object({
  name: text(), materials: money, labor: money, packaging: money, transport: money, other: money, fixedFees: money,
  feePercent: z.number().min(0).max(99), units: z.number().int().min(1).max(1e7),
  target: z.number().min(0).max(1000), mode: z.enum(['margin', 'markup'])
}).refine(v => v.mode !== 'margin' || v.target + v.feePercent < 100, 'Margin plus selling fees must be below 100%');
export type Costing = z.infer<typeof costingSchema>;
export function calculateCosting(input: Costing) {
  const c = costingSchema.parse(input);
  const total = c.materials + c.labor + c.packaging + c.transport + c.other + c.fixedFees;
  const unitCost = total / c.units;
  const fee = c.feePercent / 100, target = c.target / 100;
  const price = c.mode === 'margin' ? unitCost / (1 - fee - target) : unitCost * (1 + target) / (1 - fee);
  const profit = price * (1 - fee) - unitCost;
  return { total, unitCost, price, profit, totalProfit: profit * c.units, margin: price ? profit / price * 100 : 0 };
}
export const quoteSchema = z.object({ supplier: text(), product: text(), price: money, minimum: z.number().int().min(1).max(1e7), delivery: money, charges: money, leadDays: z.number().int().min(0).max(3650), terms: text(1000) });
export const comparisonSchema = z.object({ name: text(), quantity: z.number().int().min(1).max(1e7), quotes: z.array(quoteSchema).min(2).max(3) });
export function compareQuotes(input: z.infer<typeof comparisonSchema>) {
  const c = comparisonSchema.parse(input);
  return c.quotes.map(q => {
    const quantity = Math.max(c.quantity, q.minimum);
    const total = quantity * q.price + q.delivery + q.charges;
    return { ...q, quantity, total, landedUnitCost: total / quantity, excess: quantity - c.quantity };
  });
}
export function manilaDay(now = new Date()) {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export function reminderState(r: { date: string; completed: boolean }, today = manilaDay()) {
  return r.completed ? 'completed' : r.date < today ? 'overdue' : r.date === today ? 'today' : 'upcoming';
}
export const actionTemplates = {
  costing: { title: 'Calculate product costs', reason: 'Check whether your selling price covers your costs.', tool: 'costing', effort: '15–30 min' },
  quotations: { title: 'Compare supplier quotations', reason: 'Compare total costs, lead times and payment terms.', tool: 'quotations', effort: '15–30 min' },
  marketing: { title: 'Prepare a marketing campaign', reason: 'Turn your offer into a draft for your customers.', tool: 'marketing', effort: '15–30 min' },
  finance: { title: 'Update your cash records', reason: 'Use current sales and expenses to understand your cash position.', tool: 'finance', effort: '10–20 min' },
  calendar: { title: 'Review upcoming payments', reason: 'Record confirmed dates and plan your next follow-ups.', tool: 'calendar', effort: '10–15 min' },
  efiling: { title: 'Prepare registration requirements', reason: 'Organize your information and confirm requirements with the relevant agency.', tool: 'efiling', effort: '20–30 min' },
  documents: { title: 'Draft your business plan', reason: 'Describe your customers, operations and funding needs.', tool: 'documents', effort: '30–60 min' },
  opportunities: { title: 'Explore reviewed opportunities', reason: 'Check potential support against the provider’s current requirements.', tool: 'opportunities', effort: '15–20 min' }
} as const;
export function recommend(profile: BusinessProfile) {
  const sets = { profit: ['costing', 'quotations', 'marketing'], cash: ['finance', 'calendar', 'costing'], customers: ['marketing', 'quotations', 'costing'], registration: ['efiling', 'documents', 'calendar'], funding: ['finance', 'documents', 'opportunities'] } as const;
  const keys: string[] = [...sets[profile.goal]];
  if (profile.stage === 'idea' && profile.goal !== 'registration') keys[2] = 'documents';
  return keys.map((key, index) => ({ key, ...actionTemplates[key as keyof typeof actionTemplates], priority: index + 1 }));
}

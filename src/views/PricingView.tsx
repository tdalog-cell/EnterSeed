import React, { useState } from 'react';
import { ArrowRight, Check, CircleHelp, Leaf, Sprout, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, Notice, PageHeader, Segmented, cx } from '../components/ui';

const PLANS = [
  {
    name: 'Community',
    desc: 'A place to start, get organized, and explore your next business step.',
    icon: Sprout,
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      'Supplier directory and local map',
      'Boss Narra local guidance',
      'Finance checkup and planning tools',
      'Business plan and feasibility drafts',
      'Government portal and readiness tools'
    ],
    highlight: false
  },
  {
    name: 'Pro MSME',
    desc: 'A proposed plan for businesses ready for more tailored support.',
    icon: Leaf,
    priceMonthly: 490,
    priceYearly: 4900,
    features: [
      'Everything in Community',
      'Expanded AI advisory access',
      'More financial planning support',
      'Supplier introduction assistance',
      'Guided feasibility preparation'
    ],
    highlight: true
  },
  {
    name: 'Cooperative',
    desc: 'A proposed plan for cooperatives and communities growing together.',
    icon: Users,
    priceMonthly: 1490,
    priceYearly: 14900,
    features: [
      'Everything in Pro MSME',
      'Shared member workspace',
      'Group purchasing coordination',
      'Supplier application assistance',
      'Community business insights'
    ],
    highlight: false
  }
];

const go = (page: string) => {
  window.location.hash = page;
};

export const PricingView: React.FC = () => {
  const { user } = useAuth();
  const [cadence, setCadence] = useState<'monthly' | 'yearly'>('monthly');
  const yearly = cadence === 'yearly';

  return (
    <div className="space-y-8 sm:space-y-10">
      <PageHeader
        eyebrow="Grow at your own pace"
        title="Your next step starts here."
        lead="Explore the current workspace for free. Paid plans are being prepared; you can ask about availability before making any commitment."
        actions={
          <Segmented
            label="Illustrative pricing period"
            value={cadence}
            onChange={setCadence}
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'yearly', label: 'Yearly · Save 17%' }
            ]}
          />
        }
      />

      <ul className="stagger-children grid gap-5 md:grid-cols-3 items-stretch">
        {PLANS.map((p) => {
          const monthly = yearly ? Math.round(p.priceYearly / 12) : p.priceMonthly;
          return (
            <li
              key={p.name}
              className={cx(
                'interactive-card relative flex flex-col rounded-2xl p-6 sm:p-7 border overflow-hidden',
                p.highlight ? 'bg-night text-white border-night shadow-lg shadow-brand/10' : 'bg-surface border-line'
              )}
            >
              {p.highlight && <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-brand/40 blur-3xl" aria-hidden="true" />}
              <div className="mb-5 flex items-center justify-between gap-2">
                <span className={cx('flex h-11 w-11 items-center justify-center rounded-xl', p.highlight ? 'bg-white/10 text-accent' : 'bg-brand-soft text-brand')}><p.icon className="w-5 h-5" strokeWidth={1.5} /></span>
                <span className={cx('text-[10px] uppercase tracking-[0.14em] font-semibold', p.highlight ? 'text-white/65' : 'text-muted')}>{p.priceMonthly === 0 ? 'Available now' : 'In development'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <h2 className={cx('text-lg font-bold', p.highlight ? 'text-white' : 'text-ink')}>{p.name}</h2>
              </div>
              <p className={cx('mt-1.5 text-sm leading-relaxed', p.highlight ? 'text-white/70' : 'text-muted')}>{p.desc}</p>

              <p className="mt-7 flex items-baseline gap-1" aria-live="polite" aria-atomic="true">
                <span className="text-4xl font-extrabold tracking-tight tnum">₱{monthly.toLocaleString('en-PH')}</span>
                <span className={cx('text-sm', p.highlight ? 'text-white/70' : 'text-muted')}>/ month</span>
              </p>
              <p className={cx('mt-1 h-5 text-[13px]', p.highlight ? 'text-white/70' : 'text-muted')}>
                {p.priceMonthly === 0 ? 'No payment details needed' : yearly ? `Proposed ₱${p.priceYearly.toLocaleString('en-PH')} / year` : 'Proposed pricing · not yet available'}
              </p>

              <div className={cx('mt-7 border-t pt-5', p.highlight ? 'border-white/15' : 'border-line')}>
                <p className={cx('text-xs font-semibold mb-4', p.highlight ? 'text-white/70' : 'text-muted')}>{p.priceMonthly === 0 ? 'Inside your workspace' : 'Planned capabilities'}</p>
              </div>
              <ul className="space-y-3 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className={cx('w-4 h-4 mt-0.5 shrink-0', p.highlight ? 'text-accent' : 'text-good')} />
                    <span className={p.highlight ? 'text-white/90' : 'text-ink'}>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                {p.priceMonthly === 0 ? (
                  <Button variant="secondary" size="lg" className="w-full" onClick={() => go(user ? 'dashboard' : 'register')}>
                    {user ? 'Go to workspace' : 'Start free'}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button variant={p.highlight ? 'accent' : 'secondary'} size="lg" className="w-full" onClick={() => go('about')}>
                    {p.highlight ? 'Ask about Pro' : 'Talk to us'}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Notice>Paid plans are a preview of possible future offerings. There is no checkout or automatic billing. Confirm final pricing, included features, and availability with support.</Notice>

      <section className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6"><CircleHelp className="w-5 h-5 text-brand" /><h2 className="text-lg font-bold text-ink">A few helpful answers</h2></div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div><h3 className="font-semibold text-sm text-ink">Can I try it before creating an account?</h3><p className="mt-2 text-sm leading-relaxed text-muted">Yes. Use the sample workspace from the sign-in screen. Demo changes stay in your browser and messages are not sent.</p></div>
          <div><h3 className="font-semibold text-sm text-ink">Does Enterseed provide loans or subsidies?</h3><p className="mt-2 text-sm leading-relaxed text-muted">Enterseed offers planning tools and reference links. Eligibility, funding, and approval are determined by the relevant provider.</p></div>
        </div>
      </section>
    </div>
  );
};

import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, PageHeader, Segmented, cx } from '../components/ui';

const PLANS = [
  {
    name: 'Community',
    desc: 'Guidance and public directories for new entrepreneurs in South Cotabato.',
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      'Reviewed supplier directory and map',
      'Boss Narra local guidance',
      'Anonymous 30-day readiness checkup',
      'Business plan outline generator',
      'Government e-filing portal directory'
    ],
    highlight: false
  },
  {
    name: 'Pro MSME',
    desc: 'Saved finance checkups and grounded AI consultations for growing businesses.',
    priceMonthly: 490,
    priceYearly: 4900,
    features: [
      'Everything in Community',
      'Boss Narra with Gemini',
      'Saved finance checkup and runway model',
      'Direct supplier introduction requests',
      'Feasibility study export with lender checklist',
      'Regional logistics subsidy matching'
    ],
    highlight: true
  },
  {
    name: 'Cooperative',
    desc: 'For agricultural cooperatives, artisan associations, and municipal business groups.',
    priceMonthly: 1490,
    priceYearly: 14900,
    features: [
      'Everything in Pro MSME',
      'Up to 10 member accounts',
      'Bulk supplier pricing tools',
      'Priority review for supplier applications',
      'Local economic data snapshots'
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
    <div className="space-y-8">
      <PageHeader
        title="Plans for local growth"
        lead="Start free. Upgrade when you want saved checkups, AI advisory, and direct supplier introductions."
        actions={
          <Segmented
            label="Billing"
            value={cadence}
            onChange={setCadence}
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'yearly', label: 'Yearly · 2 months free' }
            ]}
          />
        }
      />

      <ul className="grid gap-4 md:grid-cols-3 items-stretch">
        {PLANS.map((p) => {
          const monthly = yearly ? Math.round(p.priceYearly / 12) : p.priceMonthly;
          return (
            <li
              key={p.name}
              className={cx(
                'flex flex-col rounded-2xl p-6 border',
                p.highlight ? 'bg-night text-white border-night' : 'bg-surface border-line'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className={cx('text-lg font-bold', p.highlight ? 'text-white' : 'text-ink')}>{p.name}</h2>
                {p.highlight && <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-ink">Most popular</span>}
              </div>
              <p className={cx('mt-1.5 text-sm leading-relaxed', p.highlight ? 'text-white/70' : 'text-muted')}>{p.desc}</p>

              <p className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold tracking-tight tnum">₱{monthly.toLocaleString('en-PH')}</span>
                <span className={cx('text-sm', p.highlight ? 'text-white/70' : 'text-muted')}>/ month</span>
              </p>
              <p className={cx('mt-1 h-5 text-[13px]', p.highlight ? 'text-white/70' : 'text-muted')}>
                {yearly && p.priceYearly > 0 ? `₱${p.priceYearly.toLocaleString('en-PH')} billed yearly` : p.priceMonthly === 0 ? 'Free, always' : ''}
              </p>

              <ul className="mt-6 space-y-2.5 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className={cx('w-4 h-4 mt-0.5 shrink-0', p.highlight ? 'text-accent' : 'text-good')} />
                    <span className={p.highlight ? 'text-white/90' : 'text-ink'}>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                {p.priceMonthly === 0 ? (
                  <Button variant="secondary" className="w-full" onClick={() => go(user ? 'dashboard' : 'register')}>
                    {user ? 'Go to workspace' : 'Start free'}
                  </Button>
                ) : (
                  <Button variant={p.highlight ? 'accent' : 'secondary'} className="w-full" onClick={() => go('about')}>
                    {p.highlight ? 'Upgrade to Pro' : 'Contact us'}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-sm text-muted">
        MSME members in South Cotabato also qualify for a shipping subsidy. Estimate yours in the Marketing workspace.
      </p>
    </div>
  );
};

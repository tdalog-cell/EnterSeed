import React, { useId, useState } from 'react';
import { Panel, PanelHeader, formatPesos } from './ui';

const RATE = 0.25;
const CAP = 350;

/** Regional freight subsidy estimate: 25% of monthly courier spend, capped at ₱350. */
export const SubsidyEstimator: React.FC<{ initialSpend?: number }> = ({ initialSpend = 1200 }) => {
  const [spend, setSpend] = useState(initialSpend);
  const id = useId();
  const subsidy = Math.min(spend * RATE, CAP);
  const net = spend - subsidy;

  return (
    <Panel>
      <PanelHeader
        title="Shipping subsidy estimate"
        description="MSME members in South Cotabato can get 25% of monthly courier fees back, up to ₱350, on Koronadal, General Santos, and Davao routes."
      />
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <div className="flex items-baseline justify-between gap-4 mb-3">
            <label htmlFor={id} className="text-[13px] font-semibold text-ink">
              Monthly courier spend
            </label>
            <output htmlFor={id} className="text-lg font-bold text-ink tnum">
              {formatPesos(spend)}
            </output>
          </div>
          <input
            id={id}
            type="range"
            min="0"
            max="5000"
            step="100"
            value={spend}
            onChange={(e) => setSpend(Number(e.target.value))}
            className="w-full h-2 cursor-pointer"
          />
          <div className="mt-1.5 flex justify-between text-xs text-muted tnum">
            <span>₱0</span>
            <span>₱5,000</span>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-6 md:min-w-[280px] md:pl-6 md:border-l md:border-line">
          <div>
            <dt className="text-[13px] text-muted">Subsidy</dt>
            <dd className="mt-0.5 text-2xl font-bold text-good tnum">{formatPesos(subsidy)}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-muted">You pay</dt>
            <dd className="mt-0.5 text-2xl font-bold text-ink tnum">{formatPesos(net)}</dd>
          </div>
        </dl>
      </div>
    </Panel>
  );
};

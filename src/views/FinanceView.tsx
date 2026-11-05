import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/apiClient';
import { Trash2 } from 'lucide-react';
import {
  Button,
  CheckField,
  Field,
  Notice,
  PageHeader,
  Panel,
  PanelHeader,
  cx,
  formatPesos,
  inputClass
} from '../components/ui';

type TaxStanding = 'current' | 'needs-filing' | 'behind' | 'not-registered';

interface AssessmentForm {
  monthlyIncome: string;
  monthlyExpenses: string;
  cashOnHand: string;
  debtOutstanding: string;
  monthlyDebtPayment: string;
  otherAssets: string;
  otherLiabilities: string;
  taxStanding: TaxStanding;
  consent: boolean;
}

type AmountKey = Exclude<keyof AssessmentForm, 'taxStanding' | 'consent'>;

const EMPTY_FORM: AssessmentForm = {
  monthlyIncome: '',
  monthlyExpenses: '',
  cashOnHand: '',
  debtOutstanding: '',
  monthlyDebtPayment: '',
  otherAssets: '',
  otherLiabilities: '',
  taxStanding: 'current',
  consent: false
};

/** Grouped so related figures sit together: monthly flow first, then balances. */
const AMOUNT_GROUPS: Array<{ title: string; fields: Array<{ key: AmountKey; label: string; example: string }> }> = [
  {
    title: 'finance.groupMonthly',
    fields: [
      { key: 'monthlyIncome', label: 'finance.income', example: '85000' },
      { key: 'monthlyExpenses', label: 'finance.expenses', example: '52000' },
      { key: 'monthlyDebtPayment', label: 'finance.debtPayment', example: '5000' }
    ]
  },
  {
    title: 'finance.groupBalances',
    fields: [
      { key: 'cashOnHand', label: 'finance.cash', example: '150000' },
      { key: 'otherAssets', label: 'finance.otherAssets', example: '200000' },
      { key: 'debtOutstanding', label: 'finance.debt', example: '40000' },
      { key: 'otherLiabilities', label: 'finance.otherLiabilities', example: '10000' }
    ]
  }
];

export const FinanceView: React.FC = () => {
  const { t } = useLanguage();
  const { token } = useAuth();

  const [form, setForm] = useState<AssessmentForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [hasSavedAssessment, setHasSavedAssessment] = useState(false);

  const authHeaders = (extra: Record<string, string> = {}) => {
    const headers: Record<string, string> = { ...extra };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  useEffect(() => {
    const fetchSaved = async () => {
      try {
        const res = await apiFetch('/api/finance/assessment', { headers: authHeaders({ Accept: 'application/json' }) });
        if (res.ok) {
          const data = await res.json();
          if (data.assessment) {
            const a = data.assessment;
            setForm({
              monthlyIncome: String(a.monthlyIncome),
              monthlyExpenses: String(a.monthlyExpenses),
              cashOnHand: String(a.cashOnHand),
              debtOutstanding: String(a.debtOutstanding),
              monthlyDebtPayment: String(a.monthlyDebtPayment),
              otherAssets: String(a.otherAssets),
              otherLiabilities: String(a.otherLiabilities),
              taxStanding: a.taxStanding || 'current',
              consent: true
            });
            setHasSavedAssessment(true);
          }
        }
      } catch (err) {
        console.warn('Error fetching finance assessment:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSaved();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const setAmount = (key: AmountKey, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!form.consent) {
      setStatusMessage({ text: t('finance.consentRequired'), type: 'error' });
      return;
    }

    const payload: Record<string, unknown> = { taxStanding: form.taxStanding, consent: true };
    for (const group of AMOUNT_GROUPS) {
      for (const { key } of group.fields) {
        const raw = form[key].trim();
        if (!raw) {
          setStatusMessage({ text: t('finance.amountRequired'), type: 'error' });
          return;
        }
        const val = Number(raw);
        if (!Number.isSafeInteger(val) || val < 0 || val > 1_000_000_000) {
          setStatusMessage({ text: t('finance.amountInvalid'), type: 'error' });
          return;
        }
        payload[key] = val;
      }
    }

    setSaving(true);
    try {
      const res = await apiFetch('/api/finance/assessment', {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || t('finance.error'));
      }
      setHasSavedAssessment(true);
      setStatusMessage({ text: t('finance.saved'), type: 'success' });
    } catch (err: any) {
      setStatusMessage({ text: err.message || t('finance.error'), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setConfirmingDelete(false);
    setStatusMessage(null);
    setSaving(true);
    try {
      const res = await apiFetch('/api/finance/assessment', { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error();
      setForm(EMPTY_FORM);
      setHasSavedAssessment(false);
      setStatusMessage({ text: t('finance.deleted'), type: 'success' });
    } catch {
      setStatusMessage({ text: t('finance.error'), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Live estimates
  const n = (k: AmountKey) => Number(form[k]) || 0;
  const income = n('monthlyIncome');
  const expenses = n('monthlyExpenses');
  const cash = n('cashOnHand');
  const debt = n('debtOutstanding');
  const debtPayment = n('monthlyDebtPayment');

  const operatingProfit = income - expenses;
  const monthlyOutflows = expenses + debtPayment;
  const cashMonths = monthlyOutflows > 0 ? cash / monthlyOutflows : null;
  const totalAssets = cash + n('otherAssets');
  const totalLiabilities = debt + n('otherLiabilities');
  const estimatedEquity = totalAssets - totalLiabilities;
  const cashAfterDebt = operatingProfit - debtPayment;
  const hasFigures = income > 0 || expenses > 0 || cash > 0;

  const recommendations = [
    {
      title: t('finance.cashManagement'),
      body:
        operatingProfit <= 0
          ? t('finance.negativeCash')
          : cashMonths !== null && cashMonths < 1
          ? t('finance.lowBuffer')
          : cashMonths !== null
          ? t('finance.reserve', { months: cashMonths.toFixed(1) })
          : t('finance.positiveCash')
    },
    {
      title: t('finance.debtManagement'),
      body:
        debt === 0
          ? t('finance.noDebt')
          : operatingProfit > 0 && debtPayment > operatingProfit * 0.5
          ? t('finance.highDebt')
          : t('finance.debtReview')
    },
    {
      title: t('finance.taxCompliance'),
      body:
        form.taxStanding === 'current'
          ? t('finance.taxCurrent')
          : form.taxStanding === 'needs-filing'
          ? t('finance.taxDue')
          : form.taxStanding === 'behind'
          ? t('finance.taxBehind')
          : t('finance.taxNotRegistered')
    }
  ];

  const summaryRow = (label: string, value: number, tone?: 'good' | 'danger') => (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={cx('font-semibold tnum', tone === 'good' ? 'text-good' : tone === 'danger' ? 'text-danger' : 'text-ink')}>
        {formatPesos(value)}
      </dd>
    </div>
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader title={t('finance.title')} lead={t('finance.intro')} />

      {statusMessage && <Notice tone={statusMessage.type}>{statusMessage.text}</Notice>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] items-start">
        {/* Form */}
        <Panel aria-busy={loading}>
          <form onSubmit={handleSave} className="space-y-7">
            {AMOUNT_GROUPS.map((group) => (
              <fieldset key={group.title} className="min-w-0">
                <legend className="text-base font-bold text-ink mb-4">{t(group.title)}</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  {group.fields.map(({ key, label, example }) => (
                    <Field key={key} label={t(label)}>
                      {(id) => (
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">₱</span>
                          <input
                            id={id}
                            type="number"
                            inputMode="numeric"
                            min="0"
                            max="1000000000"
                            step="1"
                            required
                            disabled={loading}
                            value={form[key]}
                            onChange={(e) => setAmount(key, e.target.value)}
                            placeholder={Number(example).toLocaleString('en-PH')}
                            className={cx(inputClass, 'pl-8 tnum')}
                          />
                        </div>
                      )}
                    </Field>
                  ))}
                </div>
              </fieldset>
            ))}

            <Field label={t('finance.taxStanding')}>
              {(id) => (
                <select
                  id={id}
                  value={form.taxStanding}
                  disabled={loading}
                  onChange={(e) => setForm((prev) => ({ ...prev, taxStanding: e.target.value as TaxStanding }))}
                  className={inputClass}
                >
                  <option value="current">{t('finance.current')}</option>
                  <option value="needs-filing">{t('finance.needsFiling')}</option>
                  <option value="behind">{t('finance.behind')}</option>
                  <option value="not-registered">{t('finance.notRegistered')}</option>
                </select>
              )}
            </Field>

            <CheckField checked={form.consent} onChange={(consent) => setForm((prev) => ({ ...prev, consent }))}>
              {t('finance.consent')}
            </CheckField>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <Button type="submit" size="lg" disabled={saving || loading}>
                {saving ? t('finance.saving') : t('finance.save')}
              </Button>

              {hasSavedAssessment &&
                (confirmingDelete ? (
                  <div className="flex items-center gap-2" role="group" aria-label="Confirm delete">
                    <span className="text-[13px] text-muted">{t('finance.confirmDelete')}</span>
                    <Button variant="danger" size="sm" onClick={handleDelete} disabled={saving}>
                      {t('finance.confirmYes')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                      {t('finance.confirmNo')}
                    </Button>
                  </div>
                ) : (
                  <Button variant="danger" size="sm" onClick={() => setConfirmingDelete(true)} disabled={saving}>
                    <Trash2 />
                    {t('finance.delete')}
                  </Button>
                ))}
            </div>
          </form>
        </Panel>

        {/* Live summary */}
        <div className="space-y-6 lg:sticky lg:top-20">
          <Panel>
            <PanelHeader as="h2" title={t('finance.reportTitle')} />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div>
                <dt className="text-[13px] text-muted">{t('finance.operatingProfit')}</dt>
                <dd className={cx('mt-0.5 text-xl font-bold tnum', operatingProfit >= 0 ? 'text-good' : 'text-danger')}>
                  {formatPesos(operatingProfit)}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">{t('finance.cashBuffer')}</dt>
                <dd className="mt-0.5 text-xl font-bold tnum text-brand">
                  {cashMonths === null ? '—' : t('finance.monthsValue', { months: cashMonths.toFixed(1) })}
                </dd>
              </div>
            </dl>

            <h3 className="mt-6 text-[13px] font-semibold text-ink">{t('finance.reports')}</h3>
            <dl className="mt-1 divide-y divide-line">
              {summaryRow(t('finance.reportProfitLoss'), operatingProfit, operatingProfit >= 0 ? undefined : 'danger')}
              {summaryRow(t('finance.cashFlowAfterDebt'), cashAfterDebt, cashAfterDebt >= 0 ? undefined : 'danger')}
              {summaryRow(t('finance.totalAssets'), totalAssets)}
              {summaryRow(t('finance.totalLiabilities'), totalLiabilities)}
              {summaryRow(t('finance.estimatedEquity'), estimatedEquity, estimatedEquity >= 0 ? undefined : 'danger')}
            </dl>

            <p className="mt-4 text-xs leading-relaxed text-muted">{t('finance.estimateDisclaimer')}</p>
          </Panel>

          <Panel>
            <PanelHeader as="h2" title={t('finance.recommendations')} />
            {hasFigures ? (
              <dl className="space-y-4">
                {recommendations.map((r) => (
                  <div key={r.title}>
                    <dt className="text-sm font-semibold text-ink">{r.title}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-muted">{r.body}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted">{t('finance.empty')}</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  Wallet,
  CreditCard,
  FileCheck,
  TrendingUp,
  FileBarChart,
  Plus,
  Trash2,
  Edit2,
  Download,
  Upload,
  AlertTriangle,
  ArrowUpRight,
  ShieldAlert,
  Info,
  CheckSquare,
  Square,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import {
  Button,
  Field,
  Notice,
  PageHeader,
  Panel,
  PanelHeader,
  Segmented,
  Modal,
  cx,
  inputClass,
  textareaClass
} from '../components/ui';

type FinanceTab = 'cash' | 'debt' | 'tax' | 'investment' | 'reports';

interface CashTransaction {
  id: string;
  type: 'in' | 'out';
  category: string;
  description: string;
  amount: number;
  date: string; // ISO date 'YYYY-MM-DD'
}

interface DebtItem {
  id: string;
  lender: string;
  principal: number;
  monthlyPayment: number;
  dueDate: string;
  interestRate: string;
  notes: string;
}

interface InvestmentOption {
  name: string;
  cost: number;
  monthlyBenefit: number;
  usefulLifeMonths: number;
}

function formatDatePH(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export const FinanceView: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<FinanceTab>('cash');

  // Opening Cash Balance
  const [openingBalance, setOpeningBalance] = useState<number>(97500);

  // --- 1. CASH MANAGEMENT STATE ---
  const [transactions, setTransactions] = useState<CashTransaction[]>([
    { id: '1', type: 'in', category: 'Product Sales', description: 'Arabica & Robusta Wholesale to Koronadal Cafes', amount: 45000, date: '2026-11-01' },
    { id: '2', type: 'out', category: 'Raw Materials', description: 'Fresh Coffee Cherries from Mt. Matutum Farmers', amount: 18000, date: '2026-11-03' },
    { id: '3', type: 'out', category: 'Packaging', description: 'Degassing Valve Pouches from Polomolok Supplier', amount: 6500, date: '2026-11-05' },
    { id: '4', type: 'in', category: 'B2B Contract', description: 'Quarterly Hotel Supply Order in GenSan', amount: 32000, date: '2026-11-07' }
  ]);

  const [newTxType, setNewTxType] = useState<'in' | 'out'>('in');
  const [newTxCategory, setNewTxCategory] = useState('Product Sales');
  const [newTxDesc, setNewTxDesc] = useState('');
  const [newTxAmount, setNewTxAmount] = useState<string>('');

  // Editing Transaction Modal
  const [editingTx, setEditingTx] = useState<CashTransaction | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editType, setEditType] = useState<'in' | 'out'>('in');
  const [editDate, setEditDate] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 2. DEBT MANAGEMENT STATE ---
  const [debts, setDebts] = useState<DebtItem[]>([
    {
      id: 'd1',
      lender: 'SBCorp RISE UP Micro Credit',
      principal: 120000,
      monthlyPayment: 5200,
      dueDate: '15th of every month',
      interestRate: '0.5% monthly',
      notes: 'Collateral-free working capital loan'
    },
    {
      id: 'd2',
      lender: 'LandBank MSME Facility (Koronadal)',
      principal: 250000,
      monthlyPayment: 8500,
      dueDate: '28th of every month',
      interestRate: '6% per annum',
      notes: 'Equipment loan for commercial roasting machine'
    }
  ]);

  const [newDebtLender, setNewDebtLender] = useState('');
  const [newDebtPrincipal, setNewDebtPrincipal] = useState('');
  const [newDebtMonthly, setNewDebtMonthly] = useState('');
  const [newDebtDueDate, setNewDebtDueDate] = useState('');
  const [newDebtNotes, setNewDebtNotes] = useState('');

  // --- 3. TAX PREPARATION CHECKLIST STATE ---
  const [taxChecklist, setTaxChecklist] = useState<Record<string, boolean>>({
    booksUpdated: true,
    receiptsArchived: true,
    quarterlyReturnFiled: false,
    form2307Archived: true,
    bmbeExemptionVerified: true,
    barangayPermitRenewed: false
  });

  // --- 4. INVESTMENT PLANNING STATE ---
  const [investA, setInvestA] = useState<InvestmentOption>({
    name: 'Option A: High-Capacity Batch Roaster',
    cost: 180000,
    monthlyBenefit: 22000,
    usefulLifeMonths: 36
  });

  const [investB, setInvestB] = useState<InvestmentOption>({
    name: 'Option B: Semi-Automated Pouch Sealer',
    cost: 120000,
    monthlyBenefit: 14000,
    usefulLifeMonths: 24
  });

  // Calculations for Cash Management
  const totalCashIn = transactions.filter((t) => t.type === 'in').reduce((sum, t) => sum + t.amount, 0);
  const totalCashOut = transactions.filter((t) => t.type === 'out').reduce((sum, t) => sum + t.amount, 0);
  const netMonthlyCashFlow = totalCashIn - totalCashOut;
  const currentLiquidCash = openingBalance + netMonthlyCashFlow;
  const recommendedReserve = totalCashOut > 0 ? totalCashOut * 3 : 50000;

  // Calculations for Debt Management
  const totalDebtPrincipal = debts.reduce((sum, d) => sum + d.principal, 0);
  const totalMonthlyDebtPayments = debts.reduce((sum, d) => sum + d.monthlyPayment, 0);
  const debtCoverageRatio = totalMonthlyDebtPayments > 0 ? (totalCashIn - totalCashOut) / totalMonthlyDebtPayments : 2.5;

  // Add new cash transaction
  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newTxAmount.replace(/,/g, ''));
    if (!newTxDesc || isNaN(amt) || amt <= 0) return;

    const newTx: CashTransaction = {
      id: Date.now().toString(),
      type: newTxType,
      category: newTxCategory,
      description: newTxDesc,
      amount: amt,
      date: new Date().toISOString().split('T')[0]
    };

    setTransactions([newTx, ...transactions]);
    setNewTxDesc('');
    setNewTxAmount('');
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const handleStartEdit = (tx: CashTransaction) => {
    setEditingTx(tx);
    setEditDesc(tx.description);
    setEditAmount(tx.amount.toLocaleString('en-PH'));
    setEditCategory(tx.category);
    setEditType(tx.type);
    setEditDate(tx.date);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    const amt = parseFloat(editAmount.replace(/,/g, ''));
    if (isNaN(amt) || amt <= 0) return;

    setTransactions((prev) =>
      prev.map((t) =>
        t.id === editingTx.id
          ? {
              ...t,
              description: editDesc,
              amount: amt,
              category: editCategory,
              type: editType,
              date: editDate || t.date
            }
          : t
      )
    );
    setEditingTx(null);
  };

  // CSV Export
  const handleExportCsv = () => {
    const headers = ['Date', 'Type', 'Category', 'Description', 'Amount'];
    const rows = transactions.map((t) => [
      t.date,
      t.type === 'in' ? 'Cash-In' : 'Cash-Out',
      `"${t.category.replace(/"/g, '""')}"`,
      `"${t.description.replace(/"/g, '""')}"`,
      t.amount
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `enterseed-cashflow-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Import
  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      if (lines.length <= 1) return;

      const parsed: CashTransaction[] = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length >= 5) {
          const date = parts[0].replace(/"/g, '').trim();
          const typeStr = parts[1].replace(/"/g, '').toLowerCase().trim();
          const category = parts[2].replace(/"/g, '').trim();
          const description = parts[3].replace(/"/g, '').trim();
          const amount = parseFloat(parts[4].replace(/[^0-9.]/g, ''));
          if (!isNaN(amount) && amount > 0) {
            parsed.push({
              id: `${Date.now()}-${i}`,
              date: date || new Date().toISOString().split('T')[0],
              type: typeStr.includes('in') ? 'in' : 'out',
              category: category || 'General',
              description: description || 'Imported Transaction',
              amount
            });
          }
        }
      }

      if (parsed.length > 0) {
        setTransactions((prev) => [...parsed, ...prev]);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Add new debt entry
  const handleAddDebt = (e: React.FormEvent) => {
    e.preventDefault();
    const princ = parseFloat(newDebtPrincipal.replace(/,/g, ''));
    const mth = parseFloat(newDebtMonthly.replace(/,/g, ''));
    if (!newDebtLender || isNaN(princ)) return;

    const newItem: DebtItem = {
      id: Date.now().toString(),
      lender: newDebtLender,
      principal: princ,
      monthlyPayment: isNaN(mth) ? 0 : mth,
      dueDate: newDebtDueDate || 'End of month',
      interestRate: 'Standard Rate',
      notes: newDebtNotes
    };

    setDebts([...debts, newItem]);
    setNewDebtLender('');
    setNewDebtPrincipal('');
    setNewDebtMonthly('');
    setNewDebtDueDate('');
    setNewDebtNotes('');
  };

  const handleDeleteDebt = (id: string) => {
    setDebts((prev) => prev.filter((d) => d.id !== id));
  };

  const toggleChecklist = (key: string) => {
    setTaxChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Format number input with commas
  const handleAmountChange = (val: string) => {
    const raw = val.replace(/[^0-9]/g, '');
    if (!raw) {
      setNewTxAmount('');
      return;
    }
    const num = parseInt(raw, 10);
    setNewTxAmount(num.toLocaleString('en-PH'));
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Shortened full-width title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">Finance</h1>
        <p className="mt-1 text-sm text-muted max-w-3xl leading-relaxed">
          Record everyday business cash flow, track loans, complete statutory tax checklists, and review draft financial statements for {user?.business || 'Matutum Highlands Coffee Roasters'}.
        </p>
      </div>

      {/* Tabs on their own row below header (horizontally scrollable on mobile) */}
      <div className="border-b border-line pb-2 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          <Button
            variant={activeTab === 'cash' ? 'primary' : 'secondary'}
            size="md"
            className="min-h-[44px] shrink-0"
            onClick={() => setActiveTab('cash')}
          >
            <Wallet className="w-4 h-4 mr-1.5" />
            Cash Management
          </Button>
          <Button
            variant={activeTab === 'debt' ? 'primary' : 'secondary'}
            size="md"
            className="min-h-[44px] shrink-0"
            onClick={() => setActiveTab('debt')}
          >
            <CreditCard className="w-4 h-4 mr-1.5" />
            Debt Management
          </Button>
          <Button
            variant={activeTab === 'tax' ? 'primary' : 'secondary'}
            size="md"
            className="min-h-[44px] shrink-0"
            onClick={() => setActiveTab('tax')}
          >
            <FileCheck className="w-4 h-4 mr-1.5" />
            Tax Checklist
          </Button>
          <Button
            variant={activeTab === 'investment' ? 'primary' : 'secondary'}
            size="md"
            className="min-h-[44px] shrink-0"
            onClick={() => setActiveTab('investment')}
          >
            <TrendingUp className="w-4 h-4 mr-1.5" />
            Equipment ROI
          </Button>
          <Button
            variant={activeTab === 'reports' ? 'primary' : 'secondary'}
            size="md"
            className="min-h-[44px] shrink-0"
            onClick={() => setActiveTab('reports')}
          >
            <FileBarChart className="w-4 h-4 mr-1.5" />
            Financial Summaries
          </Button>
        </div>
      </div>

      {/* --- SUB-SECTION 1: CASH MANAGEMENT --- */}
      {activeTab === 'cash' && (
        <div className="space-y-6">
          {/* Top 3 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Panel className="bg-emerald-50/70 border-emerald-200">
              <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block">Total Recorded Cash-In</span>
              <p className="text-2xl font-extrabold text-emerald-950 mt-1">₱{totalCashIn.toLocaleString('en-PH')}</p>
              <p className="text-xs text-emerald-700 mt-0.5">Coffee wholesale & retail sales</p>
            </Panel>
            <Panel className="bg-rose-50/70 border-rose-200">
              <span className="text-xs font-semibold text-rose-800 uppercase tracking-wider block">Total Recorded Cash-Out</span>
              <p className="text-2xl font-extrabold text-rose-950 mt-1">₱{totalCashOut.toLocaleString('en-PH')}</p>
              <p className="text-xs text-rose-700 mt-0.5">Green bean sourcing & packaging</p>
            </Panel>
            <Panel className="bg-purple-50/70 border-purple-200">
              <span className="text-xs font-semibold text-purple-800 uppercase tracking-wider block">Net Cash Flow</span>
              <p className={cx('text-2xl font-extrabold mt-1', netMonthlyCashFlow >= 0 ? 'text-purple-950' : 'text-rose-700')}>
                {netMonthlyCashFlow >= 0 ? '+' : ''}₱{netMonthlyCashFlow.toLocaleString('en-PH')}
              </p>
              <p className="text-xs text-purple-700 mt-0.5">Cash-in minus cash-out</p>
            </Panel>
          </div>

          {/* Cash Flow Reconciliation Formula (Resolving Net Flow vs Liquid Cash confusion) */}
          <div className="p-4 rounded-xl bg-surface border border-line flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-brand bg-brand-soft px-2 py-0.5 rounded">
                  Cash Reconciliation
                </span>
                <span className="text-xs text-muted">How liquid cash is calculated</span>
              </div>
              <p className="text-sm font-semibold text-ink">
                Opening Balance (₱{openingBalance.toLocaleString('en-PH')}) + Net Cash Flow (₱{netMonthlyCashFlow.toLocaleString('en-PH')}) = <span className="text-emerald-700 font-bold">Current Liquid Cash: ₱{currentLiquidCash.toLocaleString('en-PH')}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs shrink-0">
              <span className="text-muted">Target 3-Month Reserve:</span>
              <span className="font-bold text-ink bg-sunken px-2.5 py-1 rounded-lg border border-line">
                ₱{recommendedReserve.toLocaleString('en-PH')}
              </span>
            </div>
          </div>

          {/* Monthly Trend Chart */}
          <Panel>
            <PanelHeader
              title="Recent Monthly Cash Flow Trend"
              description="Historical monthly comparison of cash-in versus cash-out (August to November 2026)."
            />
            <div className="pt-3 pb-1">
              <div className="grid grid-cols-4 gap-4 text-center">
                {[
                  { month: 'Aug', inAmt: 65000, outAmt: 22000 },
                  { month: 'Sep', inAmt: 72000, outAmt: 26000 },
                  { month: 'Oct', inAmt: 80000, outAmt: 29000 },
                  { month: 'Nov', inAmt: totalCashIn, outAmt: totalCashOut }
                ].map((item, idx) => {
                  const maxVal = 90000;
                  const inPct = Math.round((item.inAmt / maxVal) * 100);
                  const outPct = Math.round((item.outAmt / maxVal) * 100);
                  return (
                    <div key={idx} className="flex flex-col items-center">
                      <div className="h-28 w-full flex items-end justify-center gap-1.5 bg-sunken/40 rounded-lg p-2 border border-line/60">
                        {/* Cash-in bar */}
                        <div
                          className="w-4 bg-emerald-500 rounded-t transition-all hover:bg-emerald-600 relative group"
                          style={{ height: `${Math.max(12, inPct)}%` }}
                          title={`Cash In: ₱${item.inAmt.toLocaleString('en-PH')}`}
                        />
                        {/* Cash-out bar */}
                        <div
                          className="w-4 bg-rose-400 rounded-t transition-all hover:bg-rose-500 relative group"
                          style={{ height: `${Math.max(8, outPct)}%` }}
                          title={`Cash Out: ₱${item.outAmt.toLocaleString('en-PH')}`}
                        />
                      </div>
                      <span className="text-xs font-bold text-ink mt-2">{item.month}</span>
                      <span className="text-[11px] text-emerald-700 font-semibold">₱{(item.inAmt / 1000).toFixed(0)}k in</span>
                      <span className="text-[10px] text-rose-600">₱{(item.outAmt / 1000).toFixed(0)}k out</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-line text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Cash In (Revenue)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-rose-400 inline-block" /> Cash Out (Expenses)
                </span>
              </div>
            </div>
          </Panel>

          {/* Cash Transaction Entry & Log */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,4.5fr)_minmax(0,7.5fr)] gap-6 items-start">
            <Panel>
              <PanelHeader title="Record Cash Transaction" description="Add cash-in income or cash-out expense to update your ledger." />
              <form onSubmit={handleAddTransaction} className="space-y-4">
                <Field label="Transaction Type">
                  {(id) => (
                    <Segmented
                      label="Transaction Type"
                      value={newTxType}
                      onChange={(val) => setNewTxType(val as 'in' | 'out')}
                      options={[
                        { value: 'in', label: 'Cash-In (Income)' },
                        { value: 'out', label: 'Cash-Out (Expense)' }
                      ]}
                    />
                  )}
                </Field>

                <Field label="Category">
                  {(id) => (
                    <select id={id} value={newTxCategory} onChange={(e) => setNewTxCategory(e.target.value)} className={inputClass}>
                      {newTxType === 'in' ? (
                        <>
                          <option value="Product Sales">Product Sales / Retail</option>
                          <option value="B2B Wholesale">B2B Wholesale Order</option>
                          <option value="Government Grant">Government Grant / Subsidy</option>
                          <option value="Other Income">Other Revenue</option>
                        </>
                      ) : (
                        <>
                          <option value="Raw Materials">Raw Materials Sourcing (Coffee Cherries)</option>
                          <option value="Packaging">Packaging & Supplies</option>
                          <option value="Utilities & Rent">Utilities & Roasting Facility Rent</option>
                          <option value="Payroll & Staff">Payroll & Worker Wages</option>
                          <option value="Logistics">Logistics & Transportation</option>
                        </>
                      )}
                    </select>
                  )}
                </Field>

                <Field label="Description">
                  {(id) => (
                    <input
                      id={id}
                      type="text"
                      required
                      placeholder="e.g., Sold 50kg roasted beans to local cafe"
                      value={newTxDesc}
                      onChange={(e) => setNewTxDesc(e.target.value)}
                      className={inputClass}
                    />
                  )}
                </Field>

                <Field label="Amount (PHP)">
                  {(id) => (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-bold">₱</span>
                      <input
                        id={id}
                        type="text"
                        required
                        placeholder="e.g. 15,000"
                        value={newTxAmount}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        className={cx(inputClass, 'pl-7 font-semibold')}
                      />
                    </div>
                  )}
                </Field>

                <Button type="submit" variant="primary" size="lg" className="w-full">
                  <Plus className="w-4 h-4 mr-1.5" /> Record Entry
                </Button>
              </form>
            </Panel>

            {/* Transaction Table with Edit & CSV Export/Import */}
            <Panel>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-line gap-2">
                <div>
                  <h3 className="font-bold text-ink text-base">Recorded Cash Transactions Log</h3>
                  <p className="text-xs text-muted">Owner entries sorted by date. Click edit to adjust.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={handleExportCsv} title="Download CSV">
                    <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
                  </Button>
                  <label className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-line bg-surface hover:bg-brand-soft/40 cursor-pointer text-ink transition-colors">
                    <Upload className="w-3.5 h-3.5" /> Import CSV
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleImportCsv}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-sunken border-b border-line text-muted uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Category & Description</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-sunken/50 transition-colors">
                        <td className="py-2.5 px-3 text-muted whitespace-nowrap">{formatDatePH(tx.date)}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={cx(
                              'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                              tx.type === 'in' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            )}
                          >
                            {tx.type === 'in' ? '+ Cash-In' : '- Cash-Out'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <strong className="text-ink block">{tx.category}</strong>
                          <span className="text-muted">{tx.description}</span>
                        </td>
                        <td className={cx('py-2.5 px-3 text-right font-bold', tx.type === 'in' ? 'text-emerald-700' : 'text-rose-700')}>
                          {tx.type === 'in' ? '+' : '-'}₱{tx.amount.toLocaleString('en-PH')}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(tx)}
                            className="p-1 text-muted hover:text-brand rounded hover:bg-brand-soft mr-1 transition-colors"
                            aria-label="Edit entry"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="p-1 text-muted hover:text-danger rounded hover:bg-danger-soft transition-colors"
                            aria-label="Delete entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* --- SUB-SECTION 2: DEBT MANAGEMENT --- */}
      {activeTab === 'debt' && (
        <div className="space-y-6">
          <Notice tone="info" className="border-amber-300 bg-amber-50 text-amber-950">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 shrink-0 text-amber-700 mt-0.5" />
              <div>
                <strong className="text-sm block font-bold">Important Debt & Credit Disclaimer:</strong>
                <p className="text-xs mt-0.5 leading-relaxed">
                  No guarantee is made that borrowing is suitable or will be approved. Debt calculations and affordability metrics displayed are strictly illustrative estimates based on user-entered numbers.
                </p>
              </div>
            </div>
          </Notice>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Panel className="bg-slate-50 border-slate-200">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">Total Outstanding Principal</span>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">₱{totalDebtPrincipal.toLocaleString('en-PH')}</p>
              <p className="text-xs text-slate-600 mt-0.5">Across {debts.length} active credit facilities</p>
            </Panel>
            <Panel className="bg-blue-50/60 border-blue-200">
              <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider block">Total Monthly Amortization</span>
              <p className="text-2xl font-extrabold text-blue-950 mt-1">₱{totalMonthlyDebtPayments.toLocaleString('en-PH')}/mo</p>
              <p className="text-xs text-blue-700 mt-0.5">Mandatory recurring debt outflows</p>
            </Panel>
            <Panel className="bg-purple-50/60 border-purple-200">
              <span className="text-xs font-semibold text-purple-800 uppercase tracking-wider block">Debt Coverage Ratio</span>
              <p className="text-2xl font-extrabold text-purple-950 mt-1">{debtCoverageRatio > 0 ? `${debtCoverageRatio.toFixed(1)}x` : 'N/A'}</p>
              <p className="text-xs text-purple-700 mt-0.5">Ratio of Net Operating Profit to Debt Service</p>
            </Panel>
          </div>

          {/* Visual Affordability Illustration Bar */}
          <Panel>
            <PanelHeader
              title="Visual Debt Affordability Illustration"
              description="Visualizes how much of your monthly operating profit is consumed by debt payments."
            />
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs font-bold text-ink">
                <span>Monthly Debt Service vs Net Operating Cash Flow</span>
                <span>
                  ₱{totalMonthlyDebtPayments.toLocaleString('en-PH')} / ₱{Math.max(netMonthlyCashFlow, 1).toLocaleString('en-PH')}
                </span>
              </div>

              <div className="w-full h-4 bg-slate-200 rounded-full overflow-hidden flex">
                <div
                  className={cx(
                    'h-full transition-all duration-500',
                    debtCoverageRatio >= 2 ? 'bg-emerald-500' : debtCoverageRatio >= 1.2 ? 'bg-amber-500' : 'bg-rose-500'
                  )}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(10, netMonthlyCashFlow > 0 ? (totalMonthlyDebtPayments / netMonthlyCashFlow) * 100 : 100)
                    )}%`
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted">
                <span>Healthy Debt Burden (&lt;30% of profit)</span>
                <span>Moderate Risk (30-50%)</span>
                <span>High Risk (&gt;50%)</span>
              </div>
            </div>
          </Panel>

          {/* Debt Tracker & Add Form */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,4.5fr)_minmax(0,7.5fr)] gap-6 items-start">
            <Panel>
              <PanelHeader title="Track New Business Debt / Loan" description="Add institutional or cooperative borrowing obligations." />
              <form onSubmit={handleAddDebt} className="space-y-4">
                <Field label="Lending Institution / Creditor">
                  {(id) => (
                    <input
                      id={id}
                      type="text"
                      required
                      placeholder="e.g., SBCorp, LandBank, Koronadal Coop"
                      value={newDebtLender}
                      onChange={(e) => setNewDebtLender(e.target.value)}
                      className={inputClass}
                    />
                  )}
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Principal Balance (PHP)">
                    {(id) => (
                      <input
                        id={id}
                        type="number"
                        required
                        placeholder="100000"
                        value={newDebtPrincipal}
                        onChange={(e) => setNewDebtPrincipal(e.target.value)}
                        className={inputClass}
                      />
                    )}
                  </Field>

                  <Field label="Monthly Payment (PHP)">
                    {(id) => (
                      <input
                        id={id}
                        type="number"
                        placeholder="4500"
                        value={newDebtMonthly}
                        onChange={(e) => setNewDebtMonthly(e.target.value)}
                        className={inputClass}
                      />
                    )}
                  </Field>
                </div>

                <Field label="Payment Due Date Schedule">
                  {(id) => (
                    <input
                      id={id}
                      type="text"
                      placeholder="e.g., 15th of every month"
                      value={newDebtDueDate}
                      onChange={(e) => setNewDebtDueDate(e.target.value)}
                      className={inputClass}
                    />
                  )}
                </Field>

                <Field label="Notes / Collateral Details">
                  {(id) => (
                    <input
                      id={id}
                      type="text"
                      placeholder="e.g., Collateral-free micro financing"
                      value={newDebtNotes}
                      onChange={(e) => setNewDebtNotes(e.target.value)}
                      className={inputClass}
                    />
                  )}
                </Field>

                <Button type="submit" variant="primary" size="lg" className="w-full">
                  <Plus className="w-4 h-4 mr-1.5" /> Add Debt Item
                </Button>
              </form>
            </Panel>

            <Panel>
              <PanelHeader title="Active Business Debt Obligations" description="Monitored loans, microfinance, and due dates." />
              <div className="space-y-3">
                {debts.map((d) => (
                  <div key={d.id} className="p-4 rounded-xl border border-line bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {d.lender}
                        </span>
                        <span className="text-xs text-muted">Due: {d.dueDate}</span>
                      </div>
                      <h4 className="font-bold text-ink text-base">₱{d.principal.toLocaleString('en-PH')} Principal</h4>
                      <p className="text-xs text-muted">
                        Monthly Amortization: <strong className="text-ink">₱{d.monthlyPayment.toLocaleString('en-PH')}/mo</strong> ({d.interestRate})
                      </p>
                      {d.notes && <p className="text-xs text-muted italic">"{d.notes}"</p>}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteDebt(d.id)}
                      className="text-danger hover:bg-danger-soft shrink-0 self-start sm:self-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* --- SUB-SECTION 3: TAX CHECKLIST --- */}
      {activeTab === 'tax' && (
        <div className="space-y-6">
          <Notice tone="info" className="border-blue-300 bg-blue-50 text-blue-950">
            <div className="flex items-start gap-2.5">
              <Info className="w-5 h-5 shrink-0 text-blue-700 mt-0.5" />
              <div>
                <strong className="text-sm block font-bold">Informational & Checklist Guidance Only:</strong>
                <p className="text-xs mt-0.5 leading-relaxed">
                  This section provides a dynamic recordkeeping checklist and official government resource links. No automated tax calculations or unverified filing advice are offered. Please consult the BIR or a certified public accountant for official tax filings.
                </p>
              </div>
            </div>
          </Notice>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <Panel>
              <PanelHeader
                title="Dynamic MSME Tax Recordkeeping Checklist"
                description="Verify essential Philippine Bureau of Internal Revenue (BIR) statutory requirements."
              />

              <div className="space-y-3 pt-2">
                {[
                  {
                    key: 'booksUpdated',
                    title: 'Bound Books of Accounts Up-To-Date',
                    desc: 'General Journal, General Ledger, Cash Receipts, and Cash Disbursements updated monthly.'
                  },
                  {
                    key: 'receiptsArchived',
                    title: 'Official Invoices & Receipts Archived',
                    desc: 'Maintain printed and digital sales receipts with valid Authority to Print (ATP) registration.'
                  },
                  {
                    key: 'quarterlyReturnFiled',
                    title: 'Quarterly Income Tax Return (Form 1701Q)',
                    desc: 'Submitted quarterly via BIR eFPS or ORUS portal under the 8% TRAIN Law flat rate.'
                  },
                  {
                    key: 'form2307Archived',
                    title: 'Creditable Withholding Tax Certificates (Form 2307)',
                    desc: 'Collect 2307 certificates from corporate B2B clients to claim tax credits.'
                  },
                  {
                    key: 'bmbeExemptionVerified',
                    title: 'Barangay Micro-Business Enterprise (BMBE) Certificate',
                    desc: 'Verified active BMBE registration for income tax exemption on business operations under RA 9178.'
                  },
                  {
                    key: 'barangayPermitRenewed',
                    title: 'Annual Municipal Business Permit Clearance',
                    desc: 'Keep current year Mayor’s Permit and Barangay Clearance on physical display at business premises.'
                  }
                ].map((item) => {
                  const checked = Boolean(taxChecklist[item.key]);
                  return (
                    <div
                      key={item.key}
                      onClick={() => toggleChecklist(item.key)}
                      className={cx(
                        'p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3',
                        checked ? 'bg-emerald-50/50 border-emerald-300' : 'bg-surface border-line hover:border-brand/40'
                      )}
                    >
                      <button type="button" className="mt-0.5 text-brand shrink-0">
                        {checked ? <CheckSquare className="w-5 h-5 text-emerald-700" /> : <Square className="w-5 h-5 text-muted" />}
                      </button>
                      <div>
                        <h4 className={cx('text-sm font-bold', checked ? 'text-emerald-950 line-through' : 'text-ink')}>{item.title}</h4>
                        <p className="text-xs text-muted mt-0.5 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel>
              <PanelHeader
                title="Official Government Tax Guidance & Portals"
                description="Verified links to reviewed national government tax portals and statutory references."
              />

              <div className="space-y-3">
                {[
                  {
                    title: 'BIR ORUS (Online Registration & Update System)',
                    desc: 'Official BIR portal for TIN registration, updating tax types, and managing digital certificates.',
                    url: 'https://orus.bir.gov.ph/'
                  },
                  {
                    title: 'BIR Form 1701Q & 1701A Tax Calendar',
                    desc: 'Official Philippine tax deadlines, quarterly schedules, and interactive tax forms.',
                    url: 'https://www.bir.gov.ph/'
                  },
                  {
                    title: 'RA 10963 TRAIN Law 8% Flat Tax Regime Guide',
                    desc: 'Official DTI & BIR guidelines for electing the simplified 8% flat income tax rate for MSMEs.',
                    url: 'https://www.bir.gov.ph/index.php/train.html'
                  },
                  {
                    title: 'Virtual Pag-IBIG & SSS Employer Remittance',
                    desc: 'Statutory employee benefit remittance portals for small business employers in Region 12.',
                    url: 'https://www.pagibigfund.gov.ph/'
                  }
                ].map((res) => (
                  <a
                    key={res.url}
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 rounded-xl border border-line bg-surface hover:border-brand hover:bg-brand-soft/30 transition-all block group"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-ink text-sm group-hover:text-brand flex items-center gap-1.5">
                        {res.title}
                        <ArrowUpRight className="w-4 h-4 text-muted group-hover:text-brand" />
                      </h4>
                    </div>
                    <p className="text-xs text-muted mt-1 leading-relaxed">{res.desc}</p>
                    <span className="text-[11px] text-brand font-semibold mt-2 inline-block">Official Government Portal →</span>
                  </a>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* --- SUB-SECTION 4: INVESTMENT PLANNING --- */}
      {activeTab === 'investment' && (
        <div className="space-y-6">
          <Notice tone="info" className="border-purple-300 bg-purple-50 text-purple-950">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 shrink-0 text-purple-700 mt-0.5" />
              <div>
                <strong className="text-sm block font-bold">Educational Business Planning Disclaimer:</strong>
                <p className="text-xs mt-0.5 leading-relaxed">
                  This tool is for educational business planning purposes only and does not constitute personalized investment recommendations.
                </p>
              </div>
            </div>
          </Notice>

          <Panel>
            <PanelHeader
              title="Capital Investment Comparison Tool"
              description="Input proposed equipment or facility purchases to compare payback periods, monthly ROI, and financial assumptions."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start pt-2">
              <div className="p-5 rounded-2xl border border-line bg-surface space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <h3 className="font-bold text-ink text-base">Investment Option A</h3>
                  <span className="text-xs font-bold text-brand bg-brand-soft px-2.5 py-0.5 rounded-full">Option 1</span>
                </div>

                <Field label="Equipment / Purchase Name">
                  {(id) => (
                    <input
                      id={id}
                      type="text"
                      value={investA.name}
                      onChange={(e) => setInvestA({ ...investA, name: e.target.value })}
                      className={inputClass}
                    />
                  )}
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Total Capital Cost (PHP)">
                    {(id) => (
                      <input
                        id={id}
                        type="number"
                        value={investA.cost}
                        onChange={(e) => setInvestA({ ...investA, cost: Number(e.target.value) })}
                        className={inputClass}
                      />
                    )}
                  </Field>

                  <Field label="Est. Monthly Benefit (PHP)">
                    {(id) => (
                      <input
                        id={id}
                        type="number"
                        value={investA.monthlyBenefit}
                        onChange={(e) => setInvestA({ ...investA, monthlyBenefit: Number(e.target.value) })}
                        className={inputClass}
                      />
                    )}
                  </Field>
                </div>

                <div className="p-3.5 rounded-xl bg-sunken border border-line space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted">Payback Period:</span>
                    <strong className="text-ink">
                      {investA.monthlyBenefit > 0 ? `${(investA.cost / investA.monthlyBenefit).toFixed(1)} months` : 'N/A'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">3-Year Net Projected Benefit:</span>
                    <strong className="text-emerald-700">
                      ₱{(investA.monthlyBenefit * 36 - investA.cost).toLocaleString('en-PH')}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl border border-line bg-surface space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <h3 className="font-bold text-ink text-base">Investment Option B</h3>
                  <span className="text-xs font-bold text-indigo-800 bg-indigo-50 px-2.5 py-0.5 rounded-full">Option 2</span>
                </div>

                <Field label="Equipment / Purchase Name">
                  {(id) => (
                    <input
                      id={id}
                      type="text"
                      value={investB.name}
                      onChange={(e) => setInvestB({ ...investB, name: e.target.value })}
                      className={inputClass}
                    />
                  )}
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Total Capital Cost (PHP)">
                    {(id) => (
                      <input
                        id={id}
                        type="number"
                        value={investB.cost}
                        onChange={(e) => setInvestB({ ...investB, cost: Number(e.target.value) })}
                        className={inputClass}
                      />
                    )}
                  </Field>

                  <Field label="Est. Monthly Benefit (PHP)">
                    {(id) => (
                      <input
                        id={id}
                        type="number"
                        value={investB.monthlyBenefit}
                        onChange={(e) => setInvestB({ ...investB, monthlyBenefit: Number(e.target.value) })}
                        className={inputClass}
                      />
                    )}
                  </Field>
                </div>

                <div className="p-3.5 rounded-xl bg-sunken border border-line space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted">Payback Period:</span>
                    <strong className="text-ink">
                      {investB.monthlyBenefit > 0 ? `${(investB.cost / investB.monthlyBenefit).toFixed(1)} months` : 'N/A'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">3-Year Net Projected Benefit:</span>
                    <strong className="text-emerald-700">
                      ₱{(investB.monthlyBenefit * 36 - investB.cost).toLocaleString('en-PH')}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* --- SUB-SECTION 5: FINANCIAL REPORTS --- */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <Notice tone="info" className="border-rose-300 bg-rose-50 text-rose-950 font-bold uppercase tracking-wider text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
              <span>DRAFT SUMMARIES ONLY. NOT AUDITED OR CERTIFIED FINANCIAL STATEMENTS.</span>
            </div>
          </Notice>

          <Panel>
            <PanelHeader
              title="Draft Financial Statement Summaries"
              description="Generated directly from recorded cash management transactions and debt obligations."
            />

            <div className="p-6 rounded-2xl border-2 border-dashed border-line bg-surface relative overflow-hidden space-y-6">
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-5 select-none rotate-[-12deg]">
                <span className="text-6xl font-extrabold uppercase text-slate-900 tracking-widest text-center">
                  DRAFT ONLY · UNAUDITED
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-line gap-2">
                <div>
                  <h3 className="font-extrabold text-lg text-ink">
                    {user?.business || 'Matutum Highlands Coffee Roasters'} — Draft Profit & Loss
                  </h3>
                  <p className="text-xs text-muted">Reporting Period: Current Operating Month</p>
                </div>
                <span className="text-xs font-bold text-rose-800 bg-rose-100 border border-rose-300 px-3 py-1 rounded-full uppercase">
                  Draft Summary
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-line/60">
                  <span className="font-semibold text-ink">Gross Recorded Sales / Income:</span>
                  <strong className="text-emerald-700">₱{totalCashIn.toLocaleString('en-PH')}</strong>
                </div>
                <div className="flex justify-between py-1.5 border-b border-line/60">
                  <span className="text-muted">Operating Expenses (Raw Materials, Packaging, Utilities):</span>
                  <span className="text-rose-700">-₱{totalCashOut.toLocaleString('en-PH')}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-line font-bold text-sm">
                  <span className="text-ink">Net Operating Cash Flow:</span>
                  <span className={netMonthlyCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                    ₱{netMonthlyCashFlow.toLocaleString('en-PH')}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-line/60">
                  <span className="text-muted">Monthly Debt Obligations (Amortization):</span>
                  <span className="text-rose-700">-₱{totalMonthlyDebtPayments.toLocaleString('en-PH')}</span>
                </div>
                <div className="flex justify-between py-2.5 pt-3 border-t-2 border-slate-900 font-extrabold text-base">
                  <span className="text-ink">Net Retained Cash Flow After Debt:</span>
                  <span className={netMonthlyCashFlow - totalMonthlyDebtPayments >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                    ₱{(netMonthlyCashFlow - totalMonthlyDebtPayments).toLocaleString('en-PH')}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-line text-[11px] text-muted text-center italic">
                Notice: Draft summaries only. Not audited or certified financial statements. Prepared for internal MSME planning.
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editingTx && (
        <Modal
          open={Boolean(editingTx)}
          onClose={() => setEditingTx(null)}
          title="Edit Cash Transaction"
          size="md"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <Field label="Transaction Type">
              {(id) => (
                <Segmented
                  label="Type"
                  value={editType}
                  onChange={(val) => setEditType(val as 'in' | 'out')}
                  options={[
                    { value: 'in', label: 'Cash-In' },
                    { value: 'out', label: 'Cash-Out' }
                  ]}
                />
              )}
            </Field>

            <Field label="Category">
              {(id) => (
                <select id={id} value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className={inputClass}>
                  <option value="Product Sales">Product Sales / Retail</option>
                  <option value="B2B Wholesale">B2B Wholesale Order</option>
                  <option value="Raw Materials">Raw Materials Sourcing</option>
                  <option value="Packaging">Packaging & Supplies</option>
                  <option value="Utilities & Rent">Utilities & Rent</option>
                  <option value="Payroll & Staff">Payroll & Staff</option>
                  <option value="Logistics">Logistics & Transportation</option>
                </select>
              )}
            </Field>

            <Field label="Description">
              {(id) => (
                <input
                  id={id}
                  type="text"
                  required
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className={inputClass}
                />
              )}
            </Field>

            <Field label="Amount (PHP)">
              {(id) => (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-bold">₱</span>
                  <input
                    id={id}
                    type="text"
                    required
                    value={editAmount}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      setEditAmount(raw ? parseInt(raw, 10).toLocaleString('en-PH') : '');
                    }}
                    className={cx(inputClass, 'pl-7 font-semibold')}
                  />
                </div>
              )}
            </Field>

            <Field label="Date">
              {(id) => (
                <input
                  id={id}
                  type="date"
                  required
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className={inputClass}
                />
              )}
            </Field>

            <div className="flex justify-end gap-2 pt-3 border-t border-line">
              <Button type="button" variant="ghost" onClick={() => setEditingTx(null)}>
                Cancel
              </Button>
              <Button type="submit">
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

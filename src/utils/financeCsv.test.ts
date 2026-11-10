import { test, expect } from 'vitest';
import { createLedgerCsv, parseLedgerCsv, localDateInManila } from './financeCsv';

test('ledger export round trips punctuation, quotes, and multiline descriptions', () => {
  const rows = [{ date: '2026-11-10', type: 'out' as const, category: 'Stock, packaging', description: 'Purchased "large" bags\nwith handles', amount: 1200.50 }];
  expect(parseLedgerCsv(createLedgerCsv(rows))).toEqual(rows);
});

test('invalid financial rows fail the whole import instead of silently changing amounts', () => {
  expect(() => parseLedgerCsv('Date,Type,Category,Description,Amount\n2026-02-30,Cash-In,Sales,Sale,-100')).toThrow('Row 2');
  expect(() => parseLedgerCsv('Date,Type,Category,Description,Amount\n2026-11-10,unknown,Sales,Sale,100')).toThrow('Row 2');
});

test('export neutralizes spreadsheet formula cells', () => {
  expect(createLedgerCsv([{ date: '2026-11-10', type: 'in', category: '=1+1', description: 'Sale', amount: 100 }])).toContain('"\'=1+1"');
});

test('ledger dates use the Philippines day around midnight', () => {
  expect(localDateInManila(new Date('2026-11-09T17:00:00Z'))).toBe('2026-11-10');
});

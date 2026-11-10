export interface LedgerRow {
  date: string;
  type: 'in' | 'out';
  category: string;
  description: string;
  amount: number;
}

/** Parse quoted CSV, including embedded commas, escaped quotes, and line breaks. */
export function parseLedgerCsv(source: string): LedgerRow[] {
  const records: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  const text = source.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((value) => value.trim())) records.push(row);
      row = []; cell = '';
    } else cell += char;
  }
  if (quoted) throw new Error('A quoted field is unfinished. Check the CSV and try again.');
  row.push(cell);
  if (row.some((value) => value.trim())) records.push(row);
  const header = records.shift()?.map((value) => value.trim().toLowerCase());
  if (!header || header.join(',') !== 'date,type,category,description,amount') {
    throw new Error('Use these CSV columns: Date, Type, Category, Description, Amount. Export your ledger for a template.');
  }
  if (!records.length) throw new Error('This CSV has no transactions to import.');
  return records.map((values, index) => {
    const [date, type, category, description, rawAmount] = values.map((value) => value.trim());
    const amount = Number(rawAmount?.replace(/,/g, ''));
    const parsedDate = new Date(`${date}T12:00:00Z`);
    if (values.length !== 5 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date || !['cash-in', 'cash-out', 'in', 'out'].includes(type.toLowerCase()) || !category || !description || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
      throw new Error(`Row ${index + 2} is invalid. Use a valid date, Cash-In or Cash-Out, a category, description, and a positive amount.`);
    }
    return { date, type: type.toLowerCase().endsWith('in') ? 'in' : 'out', category, description, amount };
  });
}

export function createLedgerCsv(rows: LedgerRow[]): string {
  const quote = (value: string) => `"${(/^[=+@\-\t\r]/.test(value) ? "'" : '') + value.replace(/"/g, '""')}"`;
  return '\uFEFFDate,Type,Category,Description,Amount\r\n' + rows.map((row) => [row.date, row.type === 'in' ? 'Cash-In' : 'Cash-Out', quote(row.category), quote(row.description), row.amount].join(',')).join('\r\n');
}

export function localDateInManila(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

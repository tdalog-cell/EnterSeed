import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Download, Printer, FileText, Lock } from 'lucide-react';
import {
  Button,
  Field,
  PageHeader,
  Panel,
  PanelHeader,
  Segmented,
  escapeHtml,
  inputClass,
  textareaClass
} from '../components/ui';

type DocType = 'business-plan' | 'feasibility';

const CHECKLISTS = [
  {
    title: 'DTI business name (BNRS)',
    items: [
      'One valid government ID (PhilID, driver’s license, or passport)',
      'Proposed sole proprietorship business name',
      'Scope: barangay, city, regional, or national',
      'Registration fee, ₱200 to ₱2,000 depending on scope'
    ]
  },
  {
    title: 'BIR registration (Form 1901)',
    items: [
      'DTI certificate of registration',
      'Mayor’s permit or BPLO assessment',
      'Proof of business address (lease or land title)',
      'Books of accounts for stamping',
      'Authority to print (ATP) sales invoices'
    ]
  },
  {
    title: 'LGU mayor’s permit',
    items: [
      'Barangay business clearance',
      'Zoning and building inspection clearances',
      'Sanitary permit and staff health certificates',
      'Fire Safety Inspection Certificate (FSIC) from BFP'
    ]
  }
];

export const DocumentsView: React.FC = () => {
  const { user } = useAuth();

  const [docType, setDocType] = useState<DocType>('business-plan');
  const [businessName, setBusinessName] = useState(user?.business || 'South Cotabato Artisan Delights');
  const [description, setDescription] = useState('Production and retail packaging of high-altitude Arabica coffee and artisanal cacao treats.');
  const [location, setLocation] = useState('Tupi, South Cotabato');
  const [capital, setCapital] = useState('150000');
  const [generatedDoc, setGeneratedDoc] = useState<string | null>(null);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = escapeHtml(businessName);
    const desc = escapeHtml(description);
    const loc = escapeHtml(location);
    const formattedCapital = Number(capital || 0).toLocaleString('en-PH');
    const title = docType === 'business-plan' ? 'Business Plan Outline' : 'Feasibility Study Draft';
    const dateStr = new Date().toLocaleDateString('en-PH', { dateStyle: 'long' });
    const h2 = 'color:#4A1D8F;font-size:17px;margin:0 0 6px;padding-bottom:6px;border-bottom:1px solid #EADFEA;';
    const p = 'font-size:14px;line-height:1.65;margin:0;';
    const section = (heading: string, body: string) =>
      `<section style="margin-bottom:20px;"><h2 style="${h2}">${heading}</h2><p style="${p}">${body}</p></section>`;

    setGeneratedDoc(`
      <div style="font-family:'DM Sans',system-ui,sans-serif;color:#2B1C33;max-width:760px;margin:0 auto;">
        <header style="border-bottom:2px solid #4A1D8F;padding-bottom:14px;margin-bottom:20px;">
          <p style="margin:0;color:#B4461A;font-size:12px;font-weight:600;">Enterseed business tools · South Cotabato</p>
          <h1 style="color:#4A1D8F;margin:6px 0 4px;font-size:24px;line-height:1.25;">${title}: ${name}</h1>
          <p style="margin:0;font-size:13px;color:#6A5672;">${loc} · Prepared ${dateStr}</p>
        </header>
        <p style="background:#FFF0E4;border:1px solid #FBD5B5;padding:10px 14px;margin:0 0 22px;font-size:13px;border-radius:8px;">
          <strong>Working draft.</strong> Confirm current lender requirements with Land Bank or your financing partner, and replace every assumption with your own verified records.
        </p>
        ${section('1. Executive summary', `${name} is an MSME based in ${loc}, focused on ${desc}. Initial capital planning is approximately PHP ${formattedCapital}.`)}
        ${section('2. Business and product concept', `Core offering: ${desc}. The value proposition rests on sourcing from South Cotabato growers, good packaging standards, and direct commercial relationships.`)}
        ${section('3. Target market and competition', 'Local households, travellers on the Koronadal–General Santos highway, and institutional buyers in SOCCSKSARGEN. Competitors sit in commercial centres; the edge is authenticity and freshness.')}
        ${section('4. Location and operations', `Operational hub in ${loc}. Sourcing relies on reviewed regional packaging and agricultural suppliers, following municipal sanitation and DTI guidelines.`)}
        ${section('5. Startup costs and capitalization', `Initial capital estimate: <strong>PHP ${formattedCapital}</strong>, covering equipment, raw materials, permits, and a three-month operating reserve.`)}
        ${section('6. Financial assumptions and break-even', 'Cost-plus pricing. Target break-even within 6 to 9 months of steady operations, with monthly debt payments kept well below projected operating surplus.')}
        ${section('7. Risks and mitigation', 'Weather affecting farm yields and shipping delays across Mindanao. Mitigated through multiple suppliers and a conservative inventory buffer.')}
        <section style="background:#F1EAF8;border-radius:8px;padding:14px 16px;margin-top:22px;">
          <h2 style="color:#4A1D8F;margin:0;font-size:15px;">Before you meet your lender</h2>
          <ul style="margin:8px 0 0;padding-left:20px;font-size:13px;line-height:1.65;">
            <li>Confirm loan eligibility and the document checklist with your lending officer.</li>
            <li>Attach supplier quotations for planned equipment and packaging.</li>
            <li>Bring bank statements or ledgers that show sales history.</li>
          </ul>
        </section>
      </div>
    `);
  };

  const wrapDoc = (doc: string, title: string) =>
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body style="padding:32px;">${doc}</body></html>`;

  const handleDownload = () => {
    if (!generatedDoc) return;
    const blob = new Blob([wrapDoc(generatedDoc, `${businessName} outline`)], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'enterseed'}-outline.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!generatedDoc) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(wrapDoc(generatedDoc, `${businessName} outline`));
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Business documents"
        lead="Draft a business plan outline or feasibility study, then check the documents you will need for registration and financing."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start">
        <Panel>
          <form onSubmit={handleGenerate} className="space-y-4">
            <Segmented
              label="Document type"
              className="w-full"
              value={docType}
              onChange={setDocType}
              options={[
                { value: 'business-plan', label: 'Business plan' },
                { value: 'feasibility', label: 'Feasibility study' }
              ]}
            />
            <Field label="Business name">
              {(id) => <input id={id} type="text" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} />}
            </Field>
            <Field label="Products or services">
              {(id) => (
                <textarea id={id} rows={3} required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What you sell, to whom, and why it’s different" className={textareaClass} />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Field label="Municipality">
                {(id) => <input id={id} type="text" required value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} />}
              </Field>
              <Field label="Estimated capital">
                {(id) => (
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">₱</span>
                    <input id={id} type="number" inputMode="numeric" required min="0" value={capital} onChange={(e) => setCapital(e.target.value)} className={`${inputClass} pl-8 tnum`} />
                  </div>
                )}
              </Field>
            </div>
            <Button type="submit" size="lg" className="w-full">
              {generatedDoc ? 'Regenerate outline' : 'Generate outline'}
            </Button>
            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
              <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Generated on your device. Nothing you type here is sent to a server.
            </p>
          </form>
        </Panel>

        <Panel className="min-h-[420px] flex flex-col">
          <PanelHeader
            title="Preview"
            action={
              generatedDoc && (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={handleDownload}>
                    <Download />
                    Download
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handlePrint}>
                    <Printer />
                    Print or PDF
                  </Button>
                </div>
              )
            }
          />
          {generatedDoc ? (
            <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: generatedDoc }} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-line-strong px-6 py-12">
              <FileText className="w-8 h-8 text-line-strong" />
              <p className="mt-3 font-semibold text-ink">Your outline appears here</p>
              <p className="mt-1 text-sm text-muted max-w-xs">Fill in your business details and choose Generate outline.</p>
            </div>
          )}
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Registration document checklists"
          description="What to prepare when registering or applying for funding in Region 12. Requirements can change; confirm with each office."
        />
        <div className="grid gap-x-8 gap-y-6 md:grid-cols-3">
          {CHECKLISTS.map((c) => (
            <div key={c.title}>
              <h3 className="font-semibold text-ink">{c.title}</h3>
              <ul className="mt-2 space-y-1.5">
                {c.items.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-muted">
                    <span className="mt-2 w-1.5 h-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
};

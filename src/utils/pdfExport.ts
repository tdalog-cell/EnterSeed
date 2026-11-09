import { jsPDF } from 'jspdf';
import { GeneratedDocument } from '../services/apiClient';

export interface ConsolidatedFilingData {
  trackingNumber: string;
  businessName: string;
  businessType: string;
  municipality: string;
  applicantName: string;
  applicantEmail: string;
  // Section 1: BNRS
  bnrsScope: string;
  bnrsLineOfBusiness: string;
  bnrsDominantName: string;
  // Section 2: Barangay
  barangayName: string;
  barangayPurpose: string;
  propertyOwnership: string;
  // Section 3: Mayor's Permit / BPLO
  permitType: string;
  capitalInvestment: number;
  employeeCount: number;
  sanitaryCompliance: string;
  fireSafetyStatus: string;
  // Section 4: BIR Form 1901
  tinNumber: string;
  taxRegime: string;
  booksOfAccounts: string;
  atpStatus: string;
  // Section 5: Location & Zoning
  locationAddress: string;
  zoningClassification: string;
  locationSketchDesc: string;
  notes: string;
  submittedAt?: string;
}

/**
 * Strips HTML tags and decodes common entities to produce clean printable text.
 */
function cleanHtmlText(html: string): string[] {
  // Replace headings and paragraph breaks with distinctive delimiters
  const formatted = html
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n\n### $1\n\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '\n  • $1')
    .replace(/<tr[^>]*>(.*?)<\/tr>/gi, '\n$1')
    .replace(/<t[hd][^>]*>(.*?)<\/t[hd]>/gi, ' | $1 ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  return formatted
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Exports an AI Document Studio document strictly as a .pdf file.
 */
export function exportDocumentAsPdf(doc: GeneratedDocument): void {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 45;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - margin) {
      pdf.addPage();
      cursorY = margin;
      drawPageHeader();
    }
  };

  const drawPageHeader = () => {
    pdf.setFillColor(74, 29, 143); // brand purple
    pdf.rect(margin, cursorY, contentWidth, 3, 'F');
    cursorY += 12;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text('ENTERSEED MSME SUPPORT SUITE · SOUTH COTABATO', margin, cursorY);
    pdf.text(`REF: ENTERSEED-DOC-${doc.id}`, pageWidth - margin, cursorY, { align: 'right' });
    cursorY += 16;
  };

  // First page banner
  pdf.setFillColor(74, 29, 143);
  pdf.rect(0, 0, pageWidth, 6, 'F');

  drawPageHeader();

  // Document Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(30, 41, 59);
  const titleLines = pdf.splitTextToSize(doc.title, contentWidth);
  pdf.text(titleLines, margin, cursorY);
  cursorY += titleLines.length * 22 + 6;

  // Metadata Card
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(margin, cursorY, contentWidth, 54, 4, 4, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(74, 29, 143);
  pdf.text('ENTERPRISE PROFILE', margin + 12, cursorY + 16);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(51, 65, 85);
  pdf.text(`Business: ${doc.businessName}`, margin + 12, cursorY + 30);
  pdf.text(`Municipality: ${doc.municipality}, South Cotabato`, margin + 12, cursorY + 42);

  const formattedType = doc.docType.replace(/_/g, ' ').toUpperCase();
  pdf.text(`Category: ${formattedType}`, margin + 260, cursorY + 30);
  pdf.text(`Date Generated: ${new Date(doc.createdAt).toLocaleDateString('en-PH', { dateStyle: 'long' })}`, margin + 260, cursorY + 42);

  cursorY += 68;

  // Render Body Paragraphs
  const lines = cleanHtmlText(doc.contentHtml);

  for (const rawLine of lines) {
    if (rawLine.startsWith('### ')) {
      // Section Heading
      const headingText = rawLine.replace('### ', '');
      checkPageBreak(36);
      cursorY += 10;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(74, 29, 143);
      pdf.text(headingText, margin, cursorY);
      cursorY += 16;

      pdf.setDrawColor(226, 232, 240);
      pdf.line(margin, cursorY, margin + contentWidth, cursorY);
      cursorY += 10;
    } else if (rawLine.startsWith('|')) {
      // Table row
      checkPageBreak(18);
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(51, 65, 85);
      const rowLines = pdf.splitTextToSize(rawLine, contentWidth);
      pdf.text(rowLines, margin, cursorY);
      cursorY += rowLines.length * 11 + 2;
    } else {
      // Regular paragraph or bullet
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(51, 65, 85);
      const wrapped = pdf.splitTextToSize(rawLine, contentWidth);
      checkPageBreak(wrapped.length * 13 + 6);
      pdf.text(wrapped, margin, cursorY);
      cursorY += wrapped.length * 13 + 6;
    }
  }

  // Footer on all pages
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(148, 163, 184);
    pdf.line(margin, pageHeight - 32, pageWidth - margin, pageHeight - 32);
    pdf.text(
      'Enterseed MSME Document Draft · Independent Business Preparation Tool · South Cotabato',
      margin,
      pageHeight - 20
    );
    pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 20, { align: 'right' });
  }

  const sanitizedName = doc.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  pdf.save(`${sanitizedName}-${doc.docType}.pdf`);
}

/**
 * Exports the Consolidated All-in-One Registration Preparation Application strictly as a .pdf file.
 */
export function exportConsolidatedEfilingPdf(data: ConsolidatedFilingData): void {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - margin) {
      pdf.addPage();
      cursorY = margin;
      drawHeader();
    }
  };

  const drawHeader = () => {
    pdf.setFillColor(74, 29, 143);
    pdf.rect(margin, cursorY, contentWidth, 3, 'F');
    cursorY += 12;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text('ENTERSEED REGISTRATION ASSISTANT · SOUTH COTABATO MSME PREPARATION', margin, cursorY);
    pdf.text(`REF: ${data.trackingNumber}`, pageWidth - margin, cursorY, { align: 'right' });
    cursorY += 16;
  };

  // Header Banner
  pdf.setFillColor(74, 29, 143);
  pdf.rect(0, 0, pageWidth, 6, 'F');

  drawHeader();

  // Document Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(30, 41, 59);
  pdf.text('MSME STATUTORY REGISTRATION PREPARATION DOSSIER', margin, cursorY);
  cursorY += 18;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(100, 116, 139);
  pdf.text('Pre-Filing Preparation Dossier (For submission by owner via DTI BNRS, LGU BPLO, and BIR eServices)', margin, cursorY);
  cursorY += 20;

  // Applicant & Enterprise Box
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(203, 213, 225);
  pdf.roundedRect(margin, cursorY, contentWidth, 54, 4, 4, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(74, 29, 143);
  pdf.text('ENTERPRISE & APPLICANT INFORMATION', margin + 12, cursorY + 16);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(30, 41, 59);
  pdf.text(`Enterprise Name: ${data.businessName}`, margin + 12, cursorY + 30);
  pdf.text(`Entity Type: ${data.businessType}`, margin + 12, cursorY + 42);
  pdf.text(`Jurisdiction: ${data.municipality}, South Cotabato`, margin + 260, cursorY + 30);
  pdf.text(`Filing Date: ${data.submittedAt || new Date().toLocaleDateString('en-PH')}`, margin + 260, cursorY + 42);

  cursorY += 68;

  // Helper function to render a section
  const renderSection = (num: number, title: string, items: Array<{ label: string; value: string | number }>) => {
    checkPageBreak(90);
    pdf.setFillColor(241, 245, 249);
    pdf.rect(margin, cursorY, contentWidth, 20, 'F');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(74, 29, 143);
    pdf.text(`SECTION 0${num}: ${title.toUpperCase()}`, margin + 8, cursorY + 14);
    cursorY += 26;

    for (const item of items) {
      checkPageBreak(18);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(71, 85, 105);
      pdf.text(`${item.label}:`, margin + 8, cursorY);

      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(15, 23, 42);
      const valStr = String(item.value || 'N/A');
      const wrapped = pdf.splitTextToSize(valStr, contentWidth - 170);
      pdf.text(wrapped, margin + 165, cursorY);
      cursorY += Math.max(wrapped.length * 12, 14);
    }
    cursorY += 10;
  };

  // Section 1: BNRS
  renderSection(1, 'Business Name Registration (DTI-BNRS)', [
    { label: 'Proposed Business Name', value: data.businessName },
    { label: 'Territorial Scope', value: data.bnrsScope },
    { label: 'Primary Business Line', value: data.bnrsLineOfBusiness },
    { label: 'Dominant Name / Descriptor', value: data.bnrsDominantName }
  ]);

  // Section 2: Barangay Clearance
  renderSection(2, 'Barangay Commercial Clearance', [
    { label: 'Barangay Jurisdiction', value: `${data.barangayName}, ${data.municipality}` },
    { label: 'Purpose of Clearance', value: data.barangayPurpose },
    { label: 'Commercial Property Status', value: data.propertyOwnership }
  ]);

  // Section 3: Mayor's Permit
  renderSection(3, "Mayor's Permit / Municipal BPLO", [
    { label: 'Application Type', value: data.permitType },
    { label: 'Declared Initial Capital', value: `PHP ${Number(data.capitalInvestment).toLocaleString()}` },
    { label: 'Declared Employee Count', value: `${data.employeeCount} regular personnel` },
    { label: 'Sanitary Inspection Health Cards', value: data.sanitaryCompliance },
    { label: 'BFP Fire Safety (FSIC) Status', value: data.fireSafetyStatus }
  ]);

  // Section 4: BIR Form 1901
  renderSection(4, 'Bureau of Internal Revenue (Form 1901)', [
    { label: 'Taxpayer Identification Number', value: data.tinNumber },
    { label: 'Selected Tax Regime', value: data.taxRegime },
    { label: 'Books of Accounts Registry', value: data.booksOfAccounts },
    { label: 'Authority to Print (ATP) Invoices', value: data.atpStatus }
  ]);

  // Section 5: Location & Zoning
  renderSection(5, 'Location Sketch & Zoning Clearance', [
    { label: 'Physical Commercial Address', value: data.locationAddress },
    { label: 'Zoning Classification', value: data.zoningClassification },
    { label: 'Landmark / Location Sketch', value: data.locationSketchDesc },
    { label: 'Applicant Special Notes', value: data.notes || 'None declared' }
  ]);

  // Legal Affirmation Box
  checkPageBreak(70);
  pdf.setFillColor(254, 252, 232);
  pdf.setDrawColor(254, 240, 138);
  pdf.roundedRect(margin, cursorY, contentWidth, 48, 3, 3, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(133, 77, 14);
  pdf.text('MSME PREPARATION NOTICE & APPLICANT UNDERTAKING', margin + 10, cursorY + 14);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(113, 63, 18);
  const pledge =
    'This document is prepared using Enterseed as an independent support assistant for the business owner. Always confirm requirements directly with DTI, your LGU BPLO, and BIR before submission.';
  const pledgeLines = pdf.splitTextToSize(pledge, contentWidth - 20);
  pdf.text(pledgeLines, margin + 10, cursorY + 26);

  cursorY += 60;

  // Signatures
  checkPageBreak(50);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(30, 41, 59);
  pdf.line(margin + 20, cursorY + 24, margin + 200, cursorY + 24);
  pdf.text(data.applicantName || 'Authorized Business Owner', margin + 20, cursorY + 36);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.text('Signature of Business Owner / Applicant', margin + 20, cursorY + 46);

  pdf.line(pageWidth - margin - 200, cursorY + 24, pageWidth - margin - 20, cursorY + 24);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.text('Receiving Officer / Notary Stamp', pageWidth - margin - 200, cursorY + 36);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.text('Verification & Document Stamp', pageWidth - margin - 200, cursorY + 46);

  // Footer on all pages
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(148, 163, 184);
    pdf.line(margin, pageHeight - 28, pageWidth - margin, pageHeight - 28);
    pdf.text(
      `Enterseed Registration Preparation Dossier · Ref: ${data.trackingNumber} · Province of South Cotabato`,
      margin,
      pageHeight - 16
    );
    pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 16, { align: 'right' });
  }

  const sanitized = data.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  pdf.save(`efiling-${sanitized}-${data.trackingNumber}.pdf`);
}

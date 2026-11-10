export interface SubsidyInput {
  businessSector: string;
  annualSales: number;
  employeeCount: number;
  yearsOperating: number;
  municipality: string;
  needsMachinery?: boolean;
  isWomenOrYouthLed?: boolean;
  hasExportPotential?: boolean;
}

export interface SubsidyMatch {
  id: string;
  programName: string;
  agency: string;
  subsidyType: string;
  maxSupport: string;
  eligibilityScore: number;
  matchReasons: string[];
  localOffice: string;
  contactUrl: string;
}

export interface CreditInput {
  requestedAmount: number;
  monthlyGrossRevenue: number;
  creditTrackRecord: 'excellent' | 'good' | 'fair' | 'new_no_credit';
  hasCollateral?: boolean;
  purpose: 'working_capital' | 'equipment_purchase' | 'inventory_expansion' | 'facility_upgrade';
}

export interface CreditMatch {
  id: string;
  institution: string;
  programTitle: string;
  interestRate: string;
  maxLoanAmount: string;
  repaymentTerm: string;
  collateralRequired: string;
  matchScore: number;
  highlights: string[];
  contactPhone: string;
}

export function evaluateSubsidies(data: SubsidyInput): SubsidyMatch[] {
  const matches: SubsidyMatch[] = [];

  const isSetupEligibleSector = /food|agri|cacao|coffee|manufacturing|metal|craft|packaging|weaving|bamboo/i.test(data.businessSector);
  let setupScore = 55;
  const setupReasons: string[] = [];
  if (isSetupEligibleSector) {
    setupScore += 25;
    setupReasons.push(`Sector (${data.businessSector}) is prioritized under DOST regional manufacturing pillars.`);
  }
  if (data.needsMachinery) {
    setupScore += 15;
    setupReasons.push('Enterprise needs processing or packaging automation to increase productivity.');
  }
  if (data.yearsOperating >= 2) {
    setupScore += 10;
    setupReasons.push('Operating track record qualifies for technology transfer absorption.');
  }
  matches.push({
    id: 'dost-setup',
    programName: 'DOST Small Enterprise Technology Upgrading Program (SETUP)',
    agency: 'DOST Provincial Science & Technology Center - South Cotabato',
    subsidyType: 'Zero-Interest Equipment Loan & Technology Grant',
    maxSupport: 'Up to ₱5,000,000 (0% interest, 3-5 years repayment)',
    eligibilityScore: Math.min(98, setupScore),
    matchReasons: setupReasons.length ? setupReasons : ['Provides equipment upgrades for local processing businesses'],
    localOffice: 'DOST PSTC South Cotabato, Alunan Avenue, Koronadal City',
    contactUrl: 'https://region12.dost.gov.ph/'
  });

  let otopScore = 65;
  const otopReasons: string[] = [];
  if (data.annualSales < 3_000_000) {
    otopScore += 20;
    otopReasons.push('Classified as Micro/Small Enterprise eligible for 100% subsidized packaging assistance.');
  }
  if (data.hasExportPotential || /coffee|cacao|tnalak|weaving|banana|processed/i.test(data.businessSector)) {
    otopScore += 15;
    otopReasons.push('Product has proven market affinity within Region 12 trade expos and domestic trade fairs.');
  }
  matches.push({
    id: 'dti-otop',
    programName: 'DTI OTOP Next Gen (One Town, One Product)',
    agency: 'DTI South Cotabato Provincial Office',
    subsidyType: 'Full Grant (Design, Lab Testing & Standards)',
    maxSupport: '100% Free Packaging Design, Nutritional Testing & Barcode Accreditation',
    eligibilityScore: Math.min(99, otopScore),
    matchReasons: otopReasons,
    localOffice: 'DTI Negosyo Center, Provincial Capitol Compound, Koronadal City',
    contactUrl: 'https://www.dti.gov.ph/'
  });

  if (/agri|farm|coffee|cacao|crop|poultry|livestock|aquaculture/i.test(data.businessSector)) {
    matches.push({
      id: 'da-acpc-anyo',
      programName: 'DA Agri-Negosyo (ANYO) Financing Facility',
      agency: 'Department of Agriculture - Agricultural Credit Policy Council',
      subsidyType: 'Zero-Interest Credit Facility',
      maxSupport: 'Up to ₱300,000 micro-financing (0% interest, no collateral)',
      eligibilityScore: 92,
      matchReasons: [
        'Direct agricultural production / agri-processing profile',
        `Registered producer in ${data.municipality}, South Cotabato`
      ],
      localOffice: 'DA Regional Field Office 12, Prime Regional Government Center, Carpenter Hill, Koronadal',
      contactUrl: 'https://acpc.gov.ph/'
    });
  }

  matches.push({
    id: 'southcot-msmedc',
    programName: 'South Cotabato Provincial MSMEDC Local Development Fund',
    agency: 'Provincial Planning & Development Office / MSMEDC South Cotabato',
    subsidyType: 'Local Government Subsidy',
    maxSupport: 'Trade fair booths, market matching, municipal tax relief credits',
    eligibilityScore: 85,
    matchReasons: [
      `Registered business in ${data.municipality}, South Cotabato`,
      'Eligible under the Provincial Investment & Jobs Creation Ordinance'
    ],
    localOffice: 'Provincial Capitol, City of Koronadal, South Cotabato',
    contactUrl: 'https://southcotabato.gov.ph/services/'
  });

  return matches.sort((a, b) => b.eligibilityScore - a.eligibilityScore);
}

export function evaluateCredit(data: CreditInput): CreditMatch[] {
  const matches: CreditMatch[] = [];

  matches.push({
    id: 'sbcorp-riseup',
    institution: 'Small Business Corporation (SBCorp)',
    programTitle: 'RISE UP with SBCorp (Micro & Small Enterprise Loan)',
    interestRate: '1.0% to 1.25% monthly diminishing',
    maxLoanAmount: 'Up to ₱5,000,000',
    repaymentTerm: 'Up to 36 months with 6-month grace period',
    collateralRequired: data.requestedAmount <= 300_000 ? 'None (Clean loan)' : 'Post-dated checks / Simple guarantee',
    matchScore: data.requestedAmount <= 1_500_000 ? 96 : 84,
    highlights: [
      'Official lending arm of the Department of Trade and Industry (DTI)',
      'Simplified documentary checklist: DTI BNRS, Mayor\'s Permit, and 1-year bank history',
      'No collateral requirement for micro-tier amounts'
    ],
    contactPhone: '(083) 228-3142'
  });

  matches.push({
    id: 'landbank-koronadal',
    institution: 'Land Bank of the Philippines',
    programTitle: 'LandBank MSME & Agri-Lending Center',
    interestRate: '5.0% - 6.5% per annum',
    maxLoanAmount: 'Up to 80% of project expansion cost',
    repaymentTerm: '1 to 5 years (Term loan or revolving credit line)',
    collateralRequired: data.hasCollateral ? 'Real estate or chattel mortgage' : 'Credit Surety Fund / Co-maker',
    matchScore: data.hasCollateral && data.creditTrackRecord === 'excellent' ? 98 : 78,
    highlights: [
      'Lowest institutional interest rates in Region 12',
      'Dedicated South Cotabato lending center in Koronadal City',
      'Ideal for capital machinery, transport vehicles, and inventory'
    ],
    contactPhone: '(083) 228-2431'
  });

  matches.push({
    id: 'tupi-coop',
    institution: 'Tupi Community Multipurpose Cooperative (TCMC)',
    programTitle: 'Local Entrepreneur Micro-Credit Facility',
    interestRate: '1.2% monthly',
    maxLoanAmount: 'Up to ₱500,000',
    repaymentTerm: '6 to 24 months',
    collateralRequired: 'Cooperative membership / Chattel',
    matchScore: data.requestedAmount <= 500_000 ? 90 : 62,
    highlights: [
      'Fast-track local community credit appraisal (48-72 hours)',
      'Dedicated support for growers, weavers, and food vendors',
      'Flexible repayment matching harvest or retail turnover cycles'
    ],
    contactPhone: '+63 917 555 8821'
  });

  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

export function calculatePaybackPeriod(requestedAmount: number, monthlyRevenue: number): number {
  if (requestedAmount <= 0 || monthlyRevenue <= 0) return 12;
  const estimatedMonthlyFreeCashFlow = monthlyRevenue * 0.28;
  const months = Math.ceil(requestedAmount / estimatedMonthlyFreeCashFlow);
  return Math.max(3, Math.min(60, months));
}

export interface FinancialCheckupResult {
  healthScore: number;
  status: 'Strong' | 'Healthy' | 'Caution' | 'Vulnerable';
  monthlyNetCash: number;
  runwayMonths: number;
  debtServiceRatioPercent: number;
  actionItems: string[];
}

export function calculateFinancialHealth(
  monthlySales: number,
  monthlyExpenses: number,
  monthlyDebtPayment: number = 0,
  cashOnHand: number = 0
): FinancialCheckupResult {
  const sales = Math.max(0, monthlySales);
  const expenses = Math.max(0, monthlyExpenses);
  const debt = Math.max(0, monthlyDebtPayment);
  const cash = Math.max(0, cashOnHand);

  const monthlyNetCash = sales - expenses - debt;
  const totalOutflows = expenses + debt;
  const runwayMonths = totalOutflows > 0 ? Number((cash / totalOutflows).toFixed(1)) : 99;
  const margin = sales > 0 ? (sales - expenses) / sales : 0;
  const debtRatio = sales > 0 ? debt / sales : 0;
  const debtServiceRatioPercent = Math.round(debtRatio * 100);

  let score = 0;
  // Margin component (40 pts)
  if (margin >= 0.25) score += 40;
  else if (margin >= 0.15) score += 30;
  else if (margin > 0) score += 20;
  else if (margin === 0) score += 10;

  // Runway component (35 pts)
  if (runwayMonths >= 6) score += 35;
  else if (runwayMonths >= 3) score += 28;
  else if (runwayMonths >= 1.5) score += 20;
  else if (runwayMonths >= 1) score += 12;
  else score += 5;

  // Debt component (25 pts)
  if (debtRatio <= 0.10) score += 25;
  else if (debtRatio <= 0.25) score += 18;
  else if (debtRatio <= 0.40) score += 10;

  let status: FinancialCheckupResult['status'] = 'Vulnerable';
  if (score >= 80) status = 'Strong';
  else if (score >= 65) status = 'Healthy';
  else if (score >= 45) status = 'Caution';

  const actionItems: string[] = [];
  if (runwayMonths < 3) {
    const needed = Math.round(totalOutflows * 3);
    actionItems.push(`Build a 3-month cash buffer (approx. ₱${needed.toLocaleString()} target) before non-essential purchases.`);
  }
  if (monthlyNetCash < 0) {
    actionItems.push('Review unit production costs and supplier agreements to stop monthly cash loss.');
  } else if (margin < 0.18) {
    actionItems.push('Explore bulk buying with local South Cotabato suppliers to improve gross profit margins.');
  }
  if (debtRatio > 0.20) {
    actionItems.push('Debt payments consume over 20% of sales. Review repayment commitments and discuss available options with your lender.');
  }
  if (actionItems.length < 3) {
    actionItems.push('Include expected tax obligations in your cash-flow plan and verify the amounts with your accountant.');
  }
  if (actionItems.length < 3) {
    actionItems.push('Check eligibility for DOST SETUP or OTOP packaging subsidies to scale without high debt.');
  }

  return {
    healthScore: Math.min(100, Math.max(0, score)),
    status,
    monthlyNetCash,
    runwayMonths,
    debtServiceRatioPercent,
    actionItems: actionItems.slice(0, 3)
  };
}


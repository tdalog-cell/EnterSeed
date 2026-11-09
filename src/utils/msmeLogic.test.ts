import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSubsidies, evaluateCredit, calculatePaybackPeriod, calculateFinancialHealth } from './msmeLogic';

test('calculateFinancialHealth evaluates healthy business with runway and 3 clear next steps', () => {
  const result = calculateFinancialHealth(180_000, 110_000, 15_000, 250_000);
  assert.equal(result.status, 'Strong');
  assert.ok(result.healthScore >= 80, `Expected score >= 80, got ${result.healthScore}`);
  assert.equal(result.monthlyNetCash, 55_000);
  assert.equal(result.runwayMonths, 2.0);
  assert.equal(result.actionItems.length, 3);
});

test('calculateFinancialHealth detects vulnerable business with negative cash flow and short runway', () => {
  const result = calculateFinancialHealth(40_000, 50_000, 10_000, 15_000);
  assert.equal(result.status, 'Vulnerable');
  assert.ok(result.healthScore < 50, `Expected score < 50, got ${result.healthScore}`);
  assert.equal(result.monthlyNetCash, -20_000);
  assert.equal(result.actionItems.length, 3);
  assert.ok(result.actionItems.some(item => item.includes('stop monthly cash loss') || item.includes('buffer')));
});


test('evaluateSubsidies gives high priority to food and agri processing in DOST SETUP', () => {
  const matches = evaluateSubsidies({
    businessSector: 'Coffee Roasting and Processing',
    annualSales: 1_200_000,
    employeeCount: 4,
    yearsOperating: 3,
    municipality: 'Tupi',
    needsMachinery: true,
    hasExportPotential: true
  });

  assert.ok(matches.length >= 3, 'Should match multiple local programs');
  const setup = matches.find(m => m.id === 'dost-setup');
  assert.ok(setup, 'DOST SETUP must be matched');
  assert.ok(setup.eligibilityScore >= 90, 'Food processing with machinery needs should score >= 90 in SETUP');

  const otop = matches.find(m => m.id === 'dti-otop');
  assert.ok(otop, 'DTI OTOP must be matched');
  assert.ok(otop.eligibilityScore >= 80, 'Micro enterprise with export potential scores high in OTOP');
});

test('evaluateSubsidies includes DA ACPC ANYO for agricultural producers', () => {
  const matches = evaluateSubsidies({
    businessSector: 'Agri-Farm High Value Crops',
    annualSales: 450_000,
    employeeCount: 2,
    yearsOperating: 1,
    municipality: 'Surallah'
  });

  const daMatch = matches.find(m => m.id === 'da-acpc-anyo');
  assert.ok(daMatch, 'DA ACPC ANYO must be matched for agricultural producers');
  assert.equal(daMatch.subsidyType, 'Zero-Interest Credit Facility');
});

test('evaluateCredit recommends SBCorp RISE UP for micro capital without collateral', () => {
  const matches = evaluateCredit({
    requestedAmount: 250_000,
    monthlyGrossRevenue: 60_000,
    creditTrackRecord: 'good',
    hasCollateral: false,
    purpose: 'working_capital'
  });

  assert.ok(matches.length >= 2, 'Should match at least 2 credit institutions');
  const sbcorp = matches.find(m => m.id === 'sbcorp-riseup');
  assert.ok(sbcorp, 'SBCorp must be in matches');
  assert.equal(sbcorp.collateralRequired, 'None (Clean loan)');
  assert.ok(sbcorp.matchScore >= 90);
});

test('evaluateCredit prioritizes LandBank for larger collateralized expansion', () => {
  const matches = evaluateCredit({
    requestedAmount: 2_500_000,
    monthlyGrossRevenue: 400_000,
    creditTrackRecord: 'excellent',
    hasCollateral: true,
    purpose: 'equipment_purchase'
  });

  const landbank = matches.find(m => m.id === 'landbank-koronadal');
  assert.ok(landbank);
  assert.equal(landbank.matchScore, 98, 'Landbank should match top tier with collateral and excellent credit');
});

test('calculatePaybackPeriod computes realistic months bounded between 3 and 60', () => {
  assert.equal(calculatePaybackPeriod(0, 50000), 12);
  assert.equal(calculatePaybackPeriod(100000, 100000), 4);
  assert.equal(calculatePaybackPeriod(500000, 100000), 18);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCellText,
  parseDateString,
  formatDateSlash,
  isNumericPrice,
  formatPurchasePrice,
  calculateEndDateFromYears,
  extractWarrantyYears,
  formatWarrantyDisplay,
  formatWarrantyDateRange,
  splitWarrantyDateRange,
  calculateEquipmentUsageAge,
} from './dateUtils.ts';

test('formatCellText handles empty and placeholder values', () => {
  assert.equal(formatCellText(undefined), '-');
  assert.equal(formatCellText(''), '-');
  assert.equal(formatCellText('//'), '-');
  assert.equal(formatCellText('HAMILTON-C3'), 'HAMILTON-C3');
});

test('parseDateString normalizes ISO, slash, and Buddhist Era dates', () => {
  assert.equal(parseDateString('2024-01-15'), '2024-01-15');
  assert.equal(parseDateString('15/01/2024'), '2024-01-15');
  assert.equal(parseDateString('15/01/2567'), '2024-01-15');
  assert.equal(formatDateSlash('2024-01-15'), '15/01/2024');
});

test('isNumericPrice and formatPurchasePrice distinguish prices from company names and dates', () => {
  assert.equal(isNumericPrice('850,000.00'), true);
  assert.equal(isNumericPrice('75000'), true);
  assert.equal(isNumericPrice('บริษัท ฮามิลตัน จำกัด'), false);
  assert.equal(isNumericPrice('2015-01-05'), false);
  assert.equal(isNumericPrice('13/03/2015'), false);
  assert.equal(formatPurchasePrice('850000'), '850,000');
  assert.equal(formatPurchasePrice('75000'), '75,000');
  assert.equal(formatPurchasePrice('บริษัท เมดิคอล จำกัด'), '-');
  assert.equal(formatPurchasePrice('2015-01-05'), '-');
});

test('warranty calculation helpers compute end dates and display years', () => {
  assert.equal(calculateEndDateFromYears('2024-01-20', 2), '2026-01-20');
  assert.equal(extractWarrantyYears('2 ปี'), '2');
  assert.equal(
    formatWarrantyDisplay({
      warrantyStartDate: '2024-01-20',
      warrantyEndDate: '2026-01-20',
    }),
    '2 ปี'
  );
});

test('formatWarrantyDateRange and splitWarrantyDateRange preserve CSV warranty formats and do not fallback to purchaseDate when empty', () => {
  assert.deepEqual(splitWarrantyDateRange('17/6/2013-16/6/2014'), {
    rawStart: '17/6/2013',
    rawEnd: '16/6/2014',
  });
  assert.deepEqual(
    formatWarrantyDateRange({
      warrantyPeriod: '17/6/2013-16/6/2014',
      purchaseDate: '2013-06-17',
    }),
    {
      start: '17/6/2013',
      end: '16/6/2014',
      fullText: '17/6/2013-16/6/2014',
    }
  );
  assert.equal(
    formatWarrantyDateRange({
      warrantyPeriod: '',
      purchaseDate: '2015-03-13',
      installationDate: '2015-03-13',
    }),
    null
  );
  assert.deepEqual(
    formatWarrantyDateRange({
      warrantyPeriod: '2015-06-23',
    }),
    {
      start: '2015-06-23',
      end: '',
      fullText: '2015-06-23',
    }
  );
});

test('calculateEquipmentUsageAge computes years, months, and days from installationDate to current date', () => {
  const refDate = new Date(2026, 9, 24); // 2026-10-24
  assert.equal(calculateEquipmentUsageAge('2015-03-12', refDate), '11 ปี 7 เดือน 12 วัน');
  assert.equal(calculateEquipmentUsageAge('12/03/2015', refDate), '11 ปี 7 เดือน 12 วัน');
  assert.equal(calculateEquipmentUsageAge('16/06/2013', refDate), '13 ปี 4 เดือน 8 วัน');
  assert.equal(calculateEquipmentUsageAge('', refDate), '-');
  assert.equal(calculateEquipmentUsageAge('-', refDate), '-');
});


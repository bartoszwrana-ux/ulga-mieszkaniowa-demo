(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HousingCalculator = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  const expenseKeys = Object.freeze(['propertyAcquisition', 'cooperativeRight', 'landAcquisition', 'construction', 'adaptation', 'loanRepayment', 'additionalLoanRepayment', 'subsequentLoanRepayment', 'exchangePropertyValue']);
  const keys = Object.freeze(['saleAmount', 'sellingCosts', 'acquisitionCosts', 'improvements', 'depreciation', ...expenseKeys]);
  const MAX_CENTS = 99999999999999n;
  function parseMoney(raw, required = false) {
    if (typeof raw !== 'string') throw new Error('Wpisz kwotę cyframi.');
    const value = raw.trim();
    if (!value) {
      if (required) throw new Error('Wpisz cenę sprzedaży.');
      return 0n;
    }
    if (/^[-−]/.test(value)) throw new Error('Kwota nie może być ujemna.');
    let normalized;
    if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(value)) {
      normalized = value.replace(/,/g, '');
    } else if (/^(?:\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?:[,.]\d{1,2})?$/.test(value)) {
      normalized = value.replace(/[ \u00a0\u202f]/g, '').replace(',', '.');
    } else {
      throw new Error('Wpisz np. 2,000,000.00. Maksymalnie dwa miejsca po separatorze dziesiętnym.');
    }
    const parts = normalized.split('.');
    if (parts[0].replace(/^0+/, '').length > 12) throw new Error('Maksymalna kwota to 999,999,999,999.99 zł.');
    const cents = BigInt(parts[0]) * 100n + BigInt((parts[1] || '').padEnd(2, '0') || '0');
    if (cents > MAX_CENTS) throw new Error('Maksymalna kwota to 999,999,999,999.99 zł.');
    return cents;
  }
  function roundDiv(numerator, denominator) {
    if (numerator < 0n || denominator <= 0n) throw new RangeError('Expected nonnegative numerator and positive denominator');
    return (numerator * 2n + denominator) / (2n * denominator);
  }
  function taxFromIncome(cents) {
    const basePLN = roundDiv(cents, 100n);
    return roundDiv(basePLN * 19n, 100n);
  }
  function calculate(raw) {
    const amounts = {}, errors = {};
    for (const key of keys) {
      try { amounts[key] = parseMoney(raw[key] === undefined ? '' : raw[key], key === 'saleAmount'); }
      catch (error) { errors[key] = error.message; }
    }
    if (!errors.saleAmount && amounts.saleAmount === 0n) errors.saleAmount = 'Cena sprzedaży musi być większa od zera.';
    if (!errors.saleAmount && !errors.sellingCosts && amounts.sellingCosts >= amounts.saleAmount) errors.sellingCosts = 'Koszty sprzedaży muszą być niższe od ceny sprzedaży.';
    if (Object.keys(errors).length) return { ok: false, errors };
    const revenue = amounts.saleAmount - amounts.sellingCosts;
    const totalCosts = amounts.acquisitionCosts + amounts.improvements;
    const income = revenue - totalCosts + amounts.depreciation;
    const positiveIncome = income > 0n ? income : 0n;
    const plannedExpenses = expenseKeys.reduce((sum, key) => sum + amounts[key], 0n);
    const eligibleExpenses = plannedExpenses > revenue ? revenue : plannedExpenses;
    const taxExemptIncome = roundDiv(positiveIncome * eligibleExpenses, revenue);
    const taxBase = positiveIncome - taxExemptIncome;
    const roundedBasePLN = roundDiv(taxBase, 100n);
    const taxBeforeRounding = roundedBasePLN * 19n;
    const calculatedTaxPLN = roundDiv(taxBeforeRounding, 100n);
    const withoutReliefPLN = taxFromIncome(positiveIncome);
    return { ok: true, amounts, revenue, totalCosts, income, positiveIncome, plannedExpenses, eligibleExpenses,
      taxExemptIncome, taxBase, roundedBasePLN, taxBeforeRounding, calculatedTaxPLN, withoutReliefPLN,
      reliefPLN: withoutReliefPLN - calculatedTaxPLN, capped: plannedExpenses > revenue,
      coverageBasisPoints: roundDiv(eligibleExpenses * 10000n, revenue) };
  }
  function formatNumber(cents) {
    const negative = cents < 0n;
    const absolute = negative ? -cents : cents;
    const whole = (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${negative ? '−' : ''}${whole}.${(absolute % 100n).toString().padStart(2, '0')}`;
  }
  function formatCents(cents) { return formatNumber(cents) + ' zł'; }
  return Object.freeze({ keys, expenseKeys, parseMoney, roundDiv, calculate, formatCents, formatNumber, MAX_CENTS });
});

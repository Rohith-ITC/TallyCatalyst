import React from 'react';

const SummaryCards = ({ summary, currencyScale = 'auto' }) => {
  const formatCompactCurrency = (value = 0, overrideSuffix) => {
    const suffix = overrideSuffix ?? (value < 0 ? 'Dr' : value > 0 ? 'Cr' : '');
    const absValue = Math.abs(value);
    let formatted = '';
    let unit = '';
    
    // Use selected scale or auto-detect based on value
    if (currencyScale === 'crore' || (currencyScale === 'auto' && absValue >= 10000000)) {
      formatted = '₹' + (absValue / 10000000).toFixed(2);
      unit = ' Cr'; // Cr = Crore (Indian numbering)
    } else if (currencyScale === 'lakh' || (currencyScale === 'auto' && absValue >= 100000)) {
      formatted = '₹' + (absValue / 100000).toFixed(2);
      unit = ' L';
    } else if (currencyScale === 'thousand' || (currencyScale === 'auto' && absValue >= 1000)) {
      formatted = '₹' + (absValue / 1000).toFixed(2);
      unit = ' K';
    } else {
      // Full amount (no scaling)
      formatted = '₹' + absValue.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      unit = '';
    }
    
    if (!formatted) {
      formatted = '₹0.00';
    }
    // Format: show unit abbreviation and accounting suffix separately for clarity
    // Example: "₹19.02 Cr (Dr)" or "₹19.02 Cr (Cr)" to distinguish Crore unit from Dr/Cr suffix
    if (suffix) {
      return `${formatted}${unit} (${suffix})`;
    }
    return `${formatted}${unit}`;
  };

  const formatWithSuffix = (value) => {
    if (value < 0) {
      return formatCompactCurrency(value, 'Dr');
    }
    if (value > 0) {
      return formatCompactCurrency(value, 'Cr');
    }
    return formatCompactCurrency(0, '');
  };

  return (
    <div className="summary-cards-single">
      <div className="summary-tile">
        <h3>Total Due</h3>
        <div className="summary-value">{formatWithSuffix(summary.balance)}</div>
        <div className="summary-subtext">
          <span>Total Dr: {formatCompactCurrency(summary.totalDebit || 0, '')}</span>
          <span>Total Cr: {formatCompactCurrency(summary.totalCredit || 0, '')}</span>
        </div>
      </div>
      <div className="summary-tile">
        <h3>Overdue</h3>
        <div className="summary-value">{formatWithSuffix(summary.overDue)}</div>
        <div className="summary-overdue-percent-tile">
          {summary.overDuePercent.toFixed(1)}%
          <span className="summary-overdue-percent-label">Overdue %</span>
        </div>
      </div>
    </div>
  );
};

export default SummaryCards;


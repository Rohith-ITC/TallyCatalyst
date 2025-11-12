export const escapeForXML = (value) => {
  if (!value) return '';
  let escaped = value.toString();
  escaped = escaped
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped;
};

export const cleanAndEscapeForXML = (value) => {
  if (!value) return '';
  let cleaned = value.toString().trim();
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return cleaned;
};

export const formatCurrency = (value) => {
  if (!value && value !== 0) return '₹0.00';
  const num = parseFloat(value);
  if (Number.isNaN(num)) return value;
  const absValue = Math.abs(num);
  return (
    '₹' +
    absValue.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
};

export const formatCurrencyWithDrCr = (debit, credit) => {
  if (debit > 0) {
    return `${formatCurrency(debit)} Dr`;
  }
  if (credit > 0) {
    return `${formatCurrency(credit)} Cr`;
  }
  return '';
};

export const normalizeBillIdentifier = (value) => {
  if (!value && value !== 0) return '';
  return value.toString().trim().toUpperCase();
};

export const extractBillIdentifiers = (value) => {
  const identifiers = new Set();
  if (value === undefined || value === null) return [];

  const normalizedFull = normalizeBillIdentifier(value);
  if (normalizedFull) identifiers.add(normalizedFull);

  const patternMatches = value
    .toString()
    .match(/[A-Za-z0-9-]+(?:\/[A-Za-z0-9-]+)+/g);

  if (patternMatches) {
    patternMatches.forEach((match) => {
      const normalizedMatch = normalizeBillIdentifier(match);
      if (normalizedMatch) identifiers.add(normalizedMatch);
    });
  }

  return Array.from(identifiers);
};

export const getRowValueByColumnKeywords = (row, columns, keywords) => {
  if (!row || !columns || !keywords || keywords.length === 0) return '';
  const normalizedKeywords = keywords.map((keyword) =>
    keyword.replace(/\s+/g, '').toLowerCase()
  );

  for (let i = 0; i < columns.length; i += 1) {
    const col = columns[i];
    const nameNormalized = (col?.name || '').replace(/\s+/g, '').toLowerCase();
    const aliasNormalized = (col?.alias || '').replace(/\s+/g, '').toLowerCase();
    const matches = normalizedKeywords.some(
      (keyword) =>
        (nameNormalized && nameNormalized.includes(keyword)) ||
        (aliasNormalized && aliasNormalized.includes(keyword))
    );
    if (matches) {
      const value = row[i];
      if (value !== undefined && value !== null && value !== '') {
        return value.toString().trim();
      }
    }
  }

  return '';
};

export const candidateMatchesValue = (candidates, value) => {
  if (!candidates || candidates.length === 0) return false;
  const normalizedValue = normalizeBillIdentifier(value);
  if (!normalizedValue) return false;

  return candidates.some((candidate) => {
    if (!candidate) return false;
    return (
      normalizedValue === candidate ||
      normalizedValue.includes(candidate) ||
      candidate.includes(normalizedValue)
    );
  });
};

export const formatDateFromYYYYMMDD = (dateStr) => {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  const year = dateStr.substring(0, 4);
  const month = parseInt(dateStr.substring(4, 6), 10);
  const day = dateStr.substring(6, 8);
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const yearShort = year.substring(2);
  return `${day}-${monthNames[month - 1]}-${yearShort}`;
};

export const formatDateRange = (fromDate, toDate) => {
  const from = formatDateFromYYYYMMDD(String(fromDate));
  const to = formatDateFromYYYYMMDD(String(toDate));
  return `${from} to ${to}`;
};

export const parseXMLResponse = (xmlText) => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  const parserError = xmlDoc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new Error('Failed to parse XML response');
  }

  const rowDesc = xmlDoc.getElementsByTagName('ROWDESC')[0];
  const columnElements = rowDesc ? rowDesc.getElementsByTagName('COL') : [];
  const columns = Array.from(columnElements).map((col) => ({
    name: col.getElementsByTagName('NAME')[0]?.textContent || '',
    alias: col.getElementsByTagName('ALIAS')[0]?.textContent || '',
    type: col.getElementsByTagName('TYPE')[0]?.textContent || '',
  }));

  const resultData = xmlDoc.getElementsByTagName('RESULTDATA')[0];
  const rowElements = resultData ? resultData.getElementsByTagName('ROW') : [];
  const rows = Array.from(rowElements).map((row) => {
    const cols = row.getElementsByTagName('COL');
    return Array.from(cols).map((col) => col.textContent || '');
  });

  return { columns, rows };
};

export const parseDate = (dateStr) => {
  if (!dateStr || dateStr === '') return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const monthStr = parts[1];
  const yearStr = parts[2];

  const monthMap = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  };

  const month = monthMap[monthStr];
  if (month === undefined) return null;

  const year = 2000 + parseInt(yearStr, 10);

  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export const calculateDaysOverdue = (dueDateStr) => {
  if (!dueDateStr || dueDateStr === '') return null;
  
  let dueDate = parseDate(dueDateStr);
  
  // If parseDate returns null, try parsing as YYYYMMDD format
  if (!dueDate && dueDateStr.length === 8 && /^\d+$/.test(dueDateStr)) {
    const year = parseInt(dueDateStr.substring(0, 4), 10);
    const month = parseInt(dueDateStr.substring(4, 6), 10) - 1; // Month is 0-indexed
    const day = parseInt(dueDateStr.substring(6, 8), 10);
    dueDate = new Date(year, month, day);
    if (Number.isNaN(dueDate.getTime())) {
      return null;
    }
  }
  
  if (!dueDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDateOnly = new Date(dueDate);
  dueDateOnly.setHours(0, 0, 0, 0);

  const diffTime = today - dueDateOnly;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : null;
};

export const formatCompactCurrency = (value) => {
  if (!value || value === 0) return '₹0.00';
  const absValue = Math.abs(value);
  let formatted = '';
  let unit = '';
  if (absValue >= 10000000) {
    formatted = '₹' + (absValue / 10000000).toFixed(2);
    unit = ' Cr';
  } else if (absValue >= 100000) {
    formatted = '₹' + (absValue / 100000).toFixed(2);
    unit = ' L';
  } else if (absValue >= 1000) {
    formatted = '₹' + (absValue / 1000).toFixed(2);
    unit = ' K';
  } else {
    formatted = '₹' + absValue.toFixed(2);
  }
  const suffix = value < 0 ? ' Dr' : ' Cr';
  return formatted + unit + suffix;
};


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

  let year = parseInt(yearStr, 10);
  if (year < 100) {
    year = year < 30 ? 2000 + year : 1900 + year;
  }

  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};


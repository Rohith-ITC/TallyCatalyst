import * as XLSX from 'xlsx';

const formatIndianNumber = (value) => {
  if (value == null || value === '') return '';
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  const sign = num < 0 ? '-' : '';
  const absValue = Math.abs(num);
  const formatted = absValue.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${formatted}`;
};

const getColumnHeader = (column) => column.alias || column.name || '';

const filterAndSortRows = ({
  rows,
  columns,
  filters,
  sortConfig,
}) => {
  if (!rows || rows.length === 0) {
    return [];
  }

  const filteredRows = rows.filter((row) => {
    if (!filters) return true;
    return Object.entries(filters).every(([key, value]) => {
      if (value == null || value === '') return true;
      const columnIndex = Number(key);
      const cell = row[columnIndex] ?? '';
      const cellString = String(cell).toLowerCase();
      const filterValue = String(value).toLowerCase();
      return cellString.includes(filterValue);
    });
  });

  if (!sortConfig || sortConfig.column == null) {
    return filteredRows;
  }

  const columnIndex = sortConfig.column;
  const direction = sortConfig.direction === 'desc' ? -1 : 1;

  const sortedRows = [...filteredRows].sort((a, b) => {
    const aValue = a[columnIndex] ?? '';
    const bValue = b[columnIndex] ?? '';

    const aNum = parseFloat(aValue);
    const bNum = parseFloat(bValue);
    const aIsNum = !Number.isNaN(aNum);
    const bIsNum = !Number.isNaN(bNum);

    if (aIsNum && bIsNum) {
      if (aNum === bNum) return 0;
      return aNum > bNum ? direction : -direction;
    }

    const aStr = String(aValue).toLowerCase();
    const bStr = String(bValue).toLowerCase();

    if (aStr === bStr) return 0;
    return aStr > bStr ? direction : -direction;
  });

  return sortedRows;
};

export const exportReceivablesToExcel = ({
  rows,
  columns,
  filters,
  sortConfig,
  company,
}) => {
  if (!rows || rows.length === 0 || !columns || columns.length === 0) {
    return;
  }

  const relevantColumns = columns.filter(
    (col) =>
      col &&
      !String(col.name || '').toLowerCase().includes('openingbalance') &&
      !String(col.alias || '').toLowerCase().includes('opening balance') &&
      !String(col.name || '').toLowerCase().includes('billdate') &&
      !String(col.alias || '').toLowerCase().includes('bill date')
  );

  const columnIndices = columns
    .map((col, idx) => ({ col, idx }))
    .filter(({ col }) => relevantColumns.includes(col))
    .map(({ idx }) => idx);

  const cleanedRows = rows.map((row) =>
    columnIndices.map((idx) => row[idx] ?? '')
  );

  const processedRows = filterAndSortRows({
    rows: cleanedRows,
    columns: relevantColumns,
    filters,
    sortConfig,
  });

  const worksheetData = [
    relevantColumns.map(getColumnHeader),
    ...processedRows.map((row) =>
      row.map((value, idx) => {
        const columnName = (relevantColumns[idx]?.name || '').toLowerCase();
        if (
          columnName.includes('closingbalance') ||
          columnName.includes('openingbalance') ||
          columnName.includes('amount')
        ) {
          return formatIndianNumber(value);
        }
        return value;
      })
    ),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Receivables');

  const fileName = `${company?.company || 'Receivables'}_${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};


import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  calculateDaysOverdue,
  formatCurrency,
} from '../utils/helpers';
import { exportReceivablesToExcel } from '../utils/exportUtils';

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const ReceivablesTable = ({
  receivables,
  columns,
  viewMode,
  setViewMode,
  groupBy,
  setGroupBy,
  sortConfig,
  setSortConfig,
  filters,
  setFilters,
  dropdownOpen,
  setDropdownOpen,
  dropdownSearch,
  setDropdownSearch,
  expandedCustomers,
  setExpandedCustomers,
  openOptionsRow,
  setOpenOptionsRow,
  selectedAgingBucket,
  selectedSalesperson,
  enabledSalespersons,
  onBillRowClick,
  onFilterCustomer,
  onFilterSalesperson,
  onShowVoucherDetails,
  onShowLedgerVouchers,
  onShowLedgerOutstandings,
  company,
  getRowAgingBucket,
}) => {
  const toggleCustomerExpand = (customerName) => {
    const next = new Set(expandedCustomers);
    if (next.has(customerName)) {
      next.delete(customerName);
    } else {
      next.add(customerName);
    }
    setExpandedCustomers(next);
  };

  const isDropdownColumn = (columnIndex) => {
    if (!columns || columns.length === 0) return false;
    const col = columns[columnIndex];
    if (!col) return false;

    const colName = (col.name || '').toLowerCase();
    const colAlias = (col.alias || '').toLowerCase();

    return (
      colName.includes('ledgername') ||
      colName.includes('parent') ||
      colAlias.includes('ledger name') ||
      colName.includes('salesperson') ||
      colAlias.includes('salesperson') ||
      colName === 'drcr' ||
      colAlias.includes('dr/cr')
    );
  };

  const isRightAlignedColumn = (columnIndex) => {
    if (!columns || columns.length === 0) return false;
    const col = columns[columnIndex];
    if (!col) return false;

    const colName = (col.name || '').toLowerCase();
    const colAlias = (col.alias || '').toLowerCase();

    return (
      colName.includes('duedate') ||
      colAlias.includes('due date') ||
      colName.includes('closingbalance') ||
      colAlias.includes('closing balance')
    );
  };

  const isNumericCurrencyColumn = (columnIndex) => {
    if (!columns || columns.length === 0) return false;
    const col = columns[columnIndex];
    if (!col) return false;

    const colName = (col.name || '').toLowerCase();
    const colAlias = (col.alias || '').toLowerCase();

    return (
      colName.includes('closingbalance') ||
      colAlias.includes('closing balance') ||
      colName.includes('openingbalance') ||
      colAlias.includes('opening balance')
    );
  };

  const shouldDisplayColumn = (columnIndex) => {
    if (!columns || columns.length === 0) return false;
    const col = columns[columnIndex];
    if (!col) return false;

    const colName = (col.name || '').toLowerCase();
    const colAlias = (col.alias || '').toLowerCase();

    return !(
      colName.includes('openingbalance') ||
      colAlias.includes('opening balance') ||
      colName.includes('billdate') ||
      colAlias.includes('bill date')
    );
  };

  const getUniqueValuesForColumn = (columnIndex, dataSource = null) => {
    const data = dataSource || receivables;
    if (!data || data.length === 0) {
      return [];
    }
    if (!columns || columns.length === 0 || columnIndex >= columns.length || columnIndex < 0) {
      return [];
    }

    const uniqueValues = new Set();
    data.forEach((row) => {
      if (!Array.isArray(row)) return;
      if (row.length <= columnIndex) return;
      const value = row[columnIndex];
      if (value !== null && value !== undefined && value !== '') {
        const strValue = value.toString().trim();
        if (strValue !== '') {
          uniqueValues.add(strValue);
        }
      }
    });

    return Array.from(uniqueValues).sort();
  };

  const getFilteredDropdownOptions = (columnIndex, searchTerm = '', dataSource = null) => {
    // For SALESPERSON column, use enabledSalespersons if available, BUT only if dataSource is not provided
    // If dataSource is provided (customer detail view), use that to get customer-specific salespersons
    const salespersonIndex = columns.findIndex(
      (col) =>
        col.name.includes('SalesPerson') ||
        col.alias?.includes('SalesPerson') ||
        col.name.includes('Salesperson')
    );
    
    // If dataSource is provided (customer detail view), use it to get unique values from that customer's data
    if (dataSource && Array.isArray(dataSource) && dataSource.length > 0) {
      const allValues = getUniqueValuesForColumn(columnIndex, dataSource);
      if (!searchTerm) return allValues;
      const searchLower = searchTerm.toLowerCase();
      return allValues.filter((value) => value.toLowerCase().includes(searchLower));
    }
    
    // For SALESPERSON column in main view, use enabledSalespersons if available
    if (columnIndex === salespersonIndex && enabledSalespersons.size > 0) {
      const salespersonValues = Array.from(enabledSalespersons).sort();
      if (!searchTerm) return salespersonValues;
      const searchLower = searchTerm.toLowerCase();
      return salespersonValues.filter((value) => value.toLowerCase().includes(searchLower));
    }

    // For other columns, use filtered data if available (for LEDGERNAME, this will be filtered by salesperson)
    const allValues = getUniqueValuesForColumn(columnIndex, dataSource);
    if (!searchTerm) return allValues;
    const searchLower = searchTerm.toLowerCase();
    return allValues.filter((value) => value.toLowerCase().includes(searchLower));
  };

  const getAgingBucketForRow = (row) => {
    if (!columns || columns.length === 0) return null;

    const dueDateIndex = columns.findIndex(
      (col) => {
        const colName = (col?.name || '').toLowerCase();
        const colAlias = (col?.alias || '').toLowerCase();
        return colName.includes('duedate') || colAlias.includes('due date') || colAlias.includes('duedate');
      }
    );

    if (dueDateIndex === -1) return null;

    // Use the dynamic getRowAgingBucket function if available
    if (typeof getRowAgingBucket === 'function') {
      return getRowAgingBucket(row, dueDateIndex);
    }

    // Fallback to hardcoded buckets if getRowAgingBucket is not available
    const dueDateStr = row[dueDateIndex] || '';
    const dueDate = calculateDaysOverdue(dueDateStr);

    if (dueDate === null) return null;
    if (dueDate <= 30) return '0-30';
    if (dueDate <= 90) return '30-90';
    if (dueDate <= 180) return '90-180';
    if (dueDate <= 360) return '180-360';
    return '>360';
  };

  const getCustomerSummary = () => {
    if (!receivables || receivables.length === 0 || !columns || columns.length === 0) {
      return [];
    }

    const ledgerNameIndex = columns.findIndex(
      (col) =>
        col.name.includes('LedgerName') ||
        col.alias?.includes('Ledger Name') ||
        col.name.includes('Parent')
    );
    const closingBalanceIndex = columns.findIndex(
      (col) =>
        col.name.includes('ClosingBalance') ||
        col.name.includes('Closingbalance') ||
        col.alias?.includes('Closing Balance')
    );

    if (ledgerNameIndex === -1 || closingBalanceIndex === -1) {
      return [];
    }

    const customerMap = new Map();
    receivables.forEach((row, index) => {
      const customerName = row[ledgerNameIndex] || 'Unknown';
      const closingBalanceStr = row[closingBalanceIndex] || '0';
      const debitBalance = parseFloat(closingBalanceStr) || 0;

      if (!customerMap.has(customerName)) {
        customerMap.set(customerName, {
          customerName,
          totalBalance: 0,
          detailRows: [],
        });
      }

      const customer = customerMap.get(customerName);
      customer.totalBalance += debitBalance;
      customer.detailRows.push({ row, index });
    });

    return Array.from(customerMap.values()).sort((a, b) => b.totalBalance - a.totalBalance);
  };

  const getSalespersonSummary = () => {
    if (!receivables || receivables.length === 0 || !columns || columns.length === 0) {
      return [];
    }

    const salespersonIndex = columns.findIndex(
      (col) =>
        col.name.includes('SalesPerson') ||
        col.alias?.includes('SalesPerson') ||
        col.name.includes('Salesperson')
    );
    const closingBalanceIndex = columns.findIndex(
      (col) =>
        col.name.includes('ClosingBalance') ||
        col.name.includes('Closingbalance') ||
        col.alias?.includes('Closing Balance')
    );

    if (salespersonIndex === -1 || closingBalanceIndex === -1) {
      return [];
    }

    const salespersonMap = new Map();
    receivables.forEach((row, index) => {
      const salespersonName = row[salespersonIndex] || 'Unassigned';
      const closingBalanceStr = row[closingBalanceIndex] || '0';
      const debitBalance = parseFloat(closingBalanceStr) || 0;

      if (!salespersonMap.has(salespersonName)) {
        salespersonMap.set(salespersonName, {
          salespersonName,
          totalBalance: 0,
          detailRows: [],
        });
      }

      const salesperson = salespersonMap.get(salespersonName);
      salesperson.totalBalance += debitBalance;
      salesperson.detailRows.push({ row, index });
    });

    return Array.from(salespersonMap.values()).sort((a, b) => b.totalBalance - a.totalBalance);
  };

  const applySortAndFilter = (data) => {
    let filteredData = [...data];

    if (selectedAgingBucket) {
      filteredData = filteredData.filter((row) => getAgingBucketForRow(row) === selectedAgingBucket);
    }

    if (selectedSalesperson) {
      filteredData = filteredData.filter((row) => {
        const salespersonIndex = columns.findIndex(
          (col) =>
            col.name.includes('SalesPerson') ||
            col.alias?.includes('SalesPerson') ||
            col.name.includes('Salesperson')
        );
        if (salespersonIndex === -1) return true;
        const salespersonName = row[salespersonIndex] || 'Unassigned';
        return salespersonName === selectedSalesperson;
      });
    }

    if (enabledSalespersons.size > 0) {
      const salespersonIndex = columns.findIndex(
        (col) =>
          col.name.includes('SalesPerson') ||
          col.alias?.includes('SalesPerson') ||
          col.name.includes('Salesperson')
      );
      if (salespersonIndex !== -1) {
        filteredData = filteredData.filter((row) => {
          const salespersonName = row[salespersonIndex] || 'Unassigned';
          return enabledSalespersons.has(salespersonName);
        });
      }
    }

    if (Object.keys(filters).length > 0) {
      filteredData = filteredData.filter((row) => {
        return Object.entries(filters).every(([colIndex, filterValue]) => {
          if (colIndex === 'daysOverdue') {
            const dueDateIndex = columns.findIndex(
              (col) => {
                const colName = (col?.name || '').toLowerCase();
                const colAlias = (col?.alias || '').toLowerCase();
                return colName.includes('duedate') || colAlias.includes('due date') || colAlias.includes('duedate');
              }
            );
            if (dueDateIndex === -1) return false;

            const dueDateStr = row[dueDateIndex] || '';
            const daysOverdue = calculateDaysOverdue(dueDateStr);
            if (daysOverdue === null) return false;

            const evaluateExpression = (expression) => {
              const tokens = expression
                .replace(/\s+/g, '')
                .match(/[<>]=?|=|\d+(?:\.\d+)?/g);

              if (!tokens || tokens.length === 0) {
                return daysOverdue
                  .toString()
                  .toLowerCase()
                  .includes(expression.toLowerCase());
              }

              let currentOperator = '=';
              let expectation = null;
              let result = true;

              tokens.forEach((token) => {
                if (/[<>]=?|=/.test(token)) {
                  currentOperator = token;
                } else {
                  expectation = parseFloat(token);
                  if (!Number.isNaN(expectation)) {
                    switch (currentOperator) {
                      case '>':
                        result = result && daysOverdue > expectation;
                        break;
                      case '>=':
                        result = result && daysOverdue >= expectation;
                        break;
                      case '<':
                        result = result && daysOverdue < expectation;
                        break;
                      case '<=':
                        result = result && daysOverdue <= expectation;
                        break;
                      case '=':
                      default:
                        result = result && Math.abs(daysOverdue - expectation) < 0.01;
                        break;
                    }
                  }
                }
              });

              return result;
            };

            return evaluateExpression(filterValue);
          }

          const colIndexNum = parseInt(colIndex, 10);
          if (Number.isNaN(colIndexNum)) return true;

          if (isNumericCurrencyColumn(colIndexNum)) {
            const cellValue = row[colIndexNum] || '';
            let cellNum = parseFloat(cellValue);
            if (Number.isNaN(cellNum)) {
              const cleaned = cellValue.toString().replace(/[₹,]/g, '').trim();
              cellNum = parseFloat(cleaned);
            }
            if (Number.isNaN(cellNum)) return false;

            const filterStr = filterValue.trim();
            if (!filterStr) return true;

            let operator = '=';
            let filterNum = null;

            if (filterStr.startsWith('>=')) {
              operator = '>=';
              filterNum = parseFloat(filterStr.substring(2).trim());
            } else if (filterStr.startsWith('<=')) {
              operator = '<=';
              filterNum = parseFloat(filterStr.substring(2).trim());
            } else if (filterStr.startsWith('>')) {
              operator = '>';
              filterNum = parseFloat(filterStr.substring(1).trim());
            } else if (filterStr.startsWith('<')) {
              operator = '<';
              filterNum = parseFloat(filterStr.substring(1).trim());
            } else if (filterStr.startsWith('=')) {
              operator = '=';
              filterNum = parseFloat(filterStr.substring(1).trim());
            } else {
              filterNum = parseFloat(filterStr);
            }

            if (Number.isNaN(filterNum)) {
              const cellValueStr = cellValue.toString().toLowerCase();
              return cellValueStr.includes(filterValue.toLowerCase());
            }

            switch (operator) {
              case '>':
                return cellNum > filterNum;
              case '<':
                return cellNum < filterNum;
              case '>=':
                return cellNum >= filterNum;
              case '<=':
                return cellNum <= filterNum;
              case '=':
              default:
                return Math.abs(cellNum - filterNum) < 0.01;
            }
          }

          const cellValue = row[colIndexNum] || '';
          const cellValueStr = cellValue.toString().toLowerCase().trim();
          if (isDropdownColumn(colIndexNum)) {
            return cellValueStr === filterValue;
          }
          return cellValueStr.includes(filterValue);
        });
      });
    }

    if (sortConfig.column !== null) {
      filteredData.sort((a, b) => {
        if (sortConfig.column === 'daysOverdue') {
          const dueDateIndex = columns.findIndex(
            (col) => col.name.includes('DueDate') || col.alias?.includes('DueDate')
          );
          const aDueDateStr = dueDateIndex !== -1 ? a[dueDateIndex] : '';
          const bDueDateStr = dueDateIndex !== -1 ? b[dueDateIndex] : '';
          const aDaysOverdue = calculateDaysOverdue(aDueDateStr);
          const bDaysOverdue = calculateDaysOverdue(bDueDateStr);

          if (aDaysOverdue === null && bDaysOverdue === null) return 0;
          if (aDaysOverdue === null) return sortConfig.direction === 'asc' ? 1 : -1;
          if (bDaysOverdue === null) return sortConfig.direction === 'asc' ? -1 : 1;

          return sortConfig.direction === 'asc'
            ? aDaysOverdue - bDaysOverdue
            : bDaysOverdue - aDaysOverdue;
        }

        const aValue = a[sortConfig.column] || '';
        const bValue = b[sortConfig.column] || '';
        const col = columns[sortConfig.column];
        const isDateColumn =
          col &&
          ((col.name || '').toLowerCase().includes('date') ||
            (col.alias || '').toLowerCase().includes('date'));

        if (isDateColumn) {
          const aDate = new Date(aValue);
          const bDate = new Date(bValue);
          if (Number.isNaN(aDate) && Number.isNaN(bDate)) return 0;
          if (Number.isNaN(aDate)) return sortConfig.direction === 'asc' ? 1 : -1;
          if (Number.isNaN(bDate)) return sortConfig.direction === 'asc' ? -1 : 1;
          return sortConfig.direction === 'asc'
            ? aDate.getTime() - bDate.getTime()
            : bDate.getTime() - aDate.getTime();
        }

        const aNum = parseFloat(aValue);
        const bNum = parseFloat(bValue);
        const isNumeric = !Number.isNaN(aNum) && !Number.isNaN(bNum) && aValue !== '' && bValue !== '';

        if (isNumeric) {
          return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
        }

        const aStr = aValue.toString().toLowerCase();
        const bStr = bValue.toString().toLowerCase();
        return sortConfig.direction === 'asc'
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      });
    }

    return filteredData;
  };

  const calculateTableTotals = (data) => {
    if (!data || data.length === 0 || !columns || columns.length === 0) {
      return {
        customerCount: 0,
        salespersonCount: 0,
        billCount: 0,
        totalClosingBalance: 0,
      };
    }

    const ledgerNameIndex = columns.findIndex(
      (col) => col.name.includes('LedgerName') || col.name.includes('Parent') || col.alias?.includes('Ledger Name')
    );
    const salespersonIndex = columns.findIndex(
      (col) =>
        col.name.includes('SalesPerson') ||
        col.alias?.includes('SalesPerson') ||
        col.name.includes('Salesperson')
    );
    const closingBalanceIndex = columns.findIndex(
      (col) =>
        col.name.includes('ClosingBalance') ||
        col.name.includes('Closingbalance') ||
        col.alias?.includes('Closing Balance')
    );

    const uniqueCustomers = new Set();
    const uniqueSalespersons = new Set();
    let totalClosingBalance = 0;
    let netClosingBalance = 0;

    data.forEach((row) => {
      if (ledgerNameIndex !== -1) {
        const customerName = row[ledgerNameIndex] || '';
        if (customerName) uniqueCustomers.add(customerName);
      }
      if (salespersonIndex !== -1) {
        const salespersonName = row[salespersonIndex] || '';
        if (salespersonName) uniqueSalespersons.add(salespersonName);
      }
      if (closingBalanceIndex !== -1) {
        const closingBalanceStr = row[closingBalanceIndex] || '0';
        const closingBalance = parseFloat(closingBalanceStr) || 0;

        totalClosingBalance += Math.abs(closingBalance);

        const drCrIndex = columns.findIndex((col) => col.name === 'DrCr' || col.alias?.includes('Dr/Cr'));
        const drCr = drCrIndex !== -1 ? row[drCrIndex] : closingBalance >= 0 ? 'Cr' : 'Dr';

        netClosingBalance += drCr === 'Dr' ? -Math.abs(closingBalance) : Math.abs(closingBalance);
      }
    });

    return {
      customerCount: uniqueCustomers.size,
      salespersonCount: uniqueSalespersons.size,
      billCount: data.length,
      totalClosingBalance,
      netClosingBalance,
    };
  };

  const handleSort = (columnIndex) => {
    setSortConfig((prevConfig) => {
      if (prevConfig.column === columnIndex) {
        return {
          column: columnIndex,
          direction: prevConfig.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return {
        column: columnIndex,
        direction: 'asc',
      };
    });
  };

  const handleFilter = (columnIndex, value) => {
    setFilters((prevFilters) => {
      const newFilters = { ...prevFilters };
      if (value === '' || value === 'all') {
        delete newFilters[columnIndex];
      } else if (isNumericCurrencyColumn(columnIndex)) {
        newFilters[columnIndex] = value.trim();
      } else {
        newFilters[columnIndex] = value.toLowerCase();
      }
      return newFilters;
    });
  };

  const handleDropdownToggle = (columnIndex) => {
    setDropdownOpen((prev) => ({
      ...prev,
      [columnIndex]: !prev[columnIndex],
    }));
    if (!dropdownOpen[columnIndex]) {
      setDropdownSearch((prev) => ({
        ...prev,
        [columnIndex]: '',
      }));
    }
  };

  const handleDropdownSelect = (columnIndex, value) => {
    handleFilter(columnIndex, value);
    setDropdownOpen((prev) => ({
      ...prev,
      [columnIndex]: false,
    }));
    setDropdownSearch((prev) => ({
      ...prev,
      [columnIndex]: '',
    }));
  };

  const handleDropdownSearchChange = (columnIndex, value) => {
    setDropdownSearch((prev) => ({
      ...prev,
      [columnIndex]: value,
    }));
  };

  const handleClearAllFilters = () => {
    setFilters({});
    setDropdownSearch({});
    setDropdownOpen({});
    setSortConfig({ column: null, direction: 'asc' });
  };

  const handleClearFilter = (columnIndex) => {
    setFilters((prevFilters) => {
      const newFilters = { ...prevFilters };
      delete newFilters[columnIndex];
      return newFilters;
    });
    setDropdownSearch((prev) => {
      const newSearch = { ...prev };
      delete newSearch[columnIndex];
      return newSearch;
    });
    setDropdownOpen((prev) => {
      const newOpen = { ...prev };
      delete newOpen[columnIndex];
      return newOpen;
    });
  };

  const applyCustomerSortAndFilter = (data, customerName) => {
    const customerFilter = customerFilters[customerName] || {};
    const customerSort = customerSortConfig[customerName] || { column: null, direction: 'asc' };
    
    let filteredData = [...data];

    if (selectedAgingBucket) {
      filteredData = filteredData.filter((row) => getAgingBucketForRow(row) === selectedAgingBucket);
    }

    if (selectedSalesperson) {
      filteredData = filteredData.filter((row) => {
        const salespersonIndex = columns.findIndex(
          (col) =>
            col.name.includes('SalesPerson') ||
            col.alias?.includes('SalesPerson') ||
            col.name.includes('Salesperson')
        );
        if (salespersonIndex === -1) return true;
        const salespersonName = row[salespersonIndex] || 'Unassigned';
        return salespersonName === selectedSalesperson;
      });
    }

    if (enabledSalespersons.size > 0) {
      const salespersonIndex = columns.findIndex(
        (col) =>
          col.name.includes('SalesPerson') ||
          col.alias?.includes('SalesPerson') ||
          col.name.includes('Salesperson')
      );
      if (salespersonIndex !== -1) {
        filteredData = filteredData.filter((row) => {
          const salespersonName = row[salespersonIndex] || 'Unassigned';
          return enabledSalespersons.has(salespersonName);
        });
      }
    }

    if (Object.keys(customerFilter).length > 0) {
      filteredData = filteredData.filter((row) => {
        return Object.entries(customerFilter).every(([colIndex, filterValue]) => {
          if (colIndex === 'daysOverdue') {
            const dueDateIndex = columns.findIndex(
              (col) => {
                const colName = (col?.name || '').toLowerCase();
                const colAlias = (col?.alias || '').toLowerCase();
                return colName.includes('duedate') || colAlias.includes('due date') || colAlias.includes('duedate');
              }
            );
            if (dueDateIndex === -1) return false;

            const dueDateStr = row[dueDateIndex] || '';
            const daysOverdue = calculateDaysOverdue(dueDateStr);
            if (daysOverdue === null) return false;

            const evaluateExpression = (expression) => {
              const tokens = expression
                .replace(/\s+/g, '')
                .match(/[<>]=?|=|\d+(?:\.\d+)?/g);

              if (!tokens || tokens.length === 0) {
                return daysOverdue
                  .toString()
                  .toLowerCase()
                  .includes(expression.toLowerCase());
              }

              let currentOperator = '=';
              let expectation = null;
              let result = true;

              tokens.forEach((token) => {
                if (/[<>]=?|=/.test(token)) {
                  currentOperator = token;
                } else {
                  expectation = parseFloat(token);
                  if (!Number.isNaN(expectation)) {
                    switch (currentOperator) {
                      case '>':
                        result = result && daysOverdue > expectation;
                        break;
                      case '>=':
                        result = result && daysOverdue >= expectation;
                        break;
                      case '<':
                        result = result && daysOverdue < expectation;
                        break;
                      case '<=':
                        result = result && daysOverdue <= expectation;
                        break;
                      case '=':
                      default:
                        result = result && Math.abs(daysOverdue - expectation) < 0.01;
                        break;
                    }
                  }
                }
              });

              return result;
            };

            return evaluateExpression(filterValue);
          }

          const colIndexNum = parseInt(colIndex, 10);
          if (Number.isNaN(colIndexNum)) return true;

          if (isNumericCurrencyColumn(colIndexNum)) {
            const cellValue = row[colIndexNum] || '';
            let cellNum = parseFloat(cellValue);
            if (Number.isNaN(cellNum)) {
              const cleaned = cellValue.toString().replace(/[₹,]/g, '').trim();
              cellNum = parseFloat(cleaned);
            }
            if (Number.isNaN(cellNum)) return false;

            const filterStr = filterValue.trim();
            if (!filterStr) return true;

            let operator = '=';
            let filterNum = null;

            if (filterStr.startsWith('>=')) {
              operator = '>=';
              filterNum = parseFloat(filterStr.substring(2).trim());
            } else if (filterStr.startsWith('<=')) {
              operator = '<=';
              filterNum = parseFloat(filterStr.substring(2).trim());
            } else if (filterStr.startsWith('>')) {
              operator = '>';
              filterNum = parseFloat(filterStr.substring(1).trim());
            } else if (filterStr.startsWith('<')) {
              operator = '<';
              filterNum = parseFloat(filterStr.substring(1).trim());
            } else if (filterStr.startsWith('=')) {
              operator = '=';
              filterNum = parseFloat(filterStr.substring(1).trim());
            } else {
              filterNum = parseFloat(filterStr);
            }

            if (Number.isNaN(filterNum)) {
              const cellValueStr = cellValue.toString().toLowerCase();
              return cellValueStr.includes(filterValue.toLowerCase());
            }

            switch (operator) {
              case '>':
                return cellNum > filterNum;
              case '<':
                return cellNum < filterNum;
              case '>=':
                return cellNum >= filterNum;
              case '<=':
                return cellNum <= filterNum;
              case '=':
              default:
                return Math.abs(cellNum - filterNum) < 0.01;
            }
          }

          const cellValue = row[colIndexNum] || '';
          const cellValueStr = cellValue.toString().toLowerCase().trim();
          if (isDropdownColumn(colIndexNum)) {
            return cellValueStr === filterValue;
          }
          return cellValueStr.includes(filterValue);
        });
      });
    }

    if (customerSort.column !== null) {
      filteredData.sort((a, b) => {
        if (customerSort.column === 'daysOverdue') {
          const dueDateIndex = columns.findIndex(
            (col) => {
              const colName = (col?.name || '').toLowerCase();
              const colAlias = (col?.alias || '').toLowerCase();
              return colName.includes('duedate') || colAlias.includes('due date') || colAlias.includes('duedate');
            }
          );
          const aDueDateStr = dueDateIndex !== -1 ? a[dueDateIndex] : '';
          const bDueDateStr = dueDateIndex !== -1 ? b[dueDateIndex] : '';
          const aDaysOverdue = calculateDaysOverdue(aDueDateStr);
          const bDaysOverdue = calculateDaysOverdue(bDueDateStr);

          if (aDaysOverdue === null && bDaysOverdue === null) return 0;
          if (aDaysOverdue === null) return customerSort.direction === 'asc' ? 1 : -1;
          if (bDaysOverdue === null) return customerSort.direction === 'asc' ? -1 : 1;

          return customerSort.direction === 'asc'
            ? aDaysOverdue - bDaysOverdue
            : bDaysOverdue - aDaysOverdue;
        }

        const aValue = a[customerSort.column] || '';
        const bValue = b[customerSort.column] || '';
        const col = columns[customerSort.column];
        const isDateColumn =
          col &&
          ((col.name || '').toLowerCase().includes('date') ||
            (col.alias || '').toLowerCase().includes('date'));

        if (isDateColumn) {
          const aDate = new Date(aValue);
          const bDate = new Date(bValue);
          if (Number.isNaN(aDate) && Number.isNaN(bDate)) return 0;
          if (Number.isNaN(aDate)) return customerSort.direction === 'asc' ? 1 : -1;
          if (Number.isNaN(bDate)) return customerSort.direction === 'asc' ? -1 : 1;
          return customerSort.direction === 'asc'
            ? aDate.getTime() - bDate.getTime()
            : bDate.getTime() - aDate.getTime();
        }

        const aNum = parseFloat(aValue);
        const bNum = parseFloat(bValue);
        const isNumeric = !Number.isNaN(aNum) && !Number.isNaN(bNum) && aValue !== '' && bValue !== '';

        if (isNumeric) {
          return customerSort.direction === 'asc' ? aNum - bNum : bNum - aNum;
        }

        const aStr = aValue.toString().toLowerCase();
        const bStr = bValue.toString().toLowerCase();
        return customerSort.direction === 'asc'
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      });
    }

    return filteredData;
  };

  const renderHeaderCell = (col, index) => {
    if (!shouldDisplayColumn(index)) return null;
    const isDropdown = isDropdownColumn(index);
    const isRightAligned = isRightAlignedColumn(index);
    const dueDateColumn = isDueDateColumn(index);
    const drCrColumn = isDrCrColumn(index);
    const ledgerColumn = isLedgerColumn(index);
    const billNameColumn = isBillNameColumn(index);
    const headerStyle = {};

    if (dueDateColumn) {
      headerStyle.width = `${dueDateColumnWidth}px`;
      headerStyle.minWidth = `${dueDateColumnWidth}px`;
    } else if (drCrColumn) {
      headerStyle.width = `${drCrColumnWidth}px`;
      headerStyle.minWidth = `${drCrColumnWidth}px`;
    } else if (ledgerColumn) {
      headerStyle.minWidth = `${ledgerColumnMinWidth}px`;
    } else if (billNameColumn) {
      headerStyle.minWidth = `${billNameColumnMinWidth}px`;
    }

    return (
      <th
        key={index}
        className={`sortable-header ${isRightAligned ? 'text-right' : ''}`}
        style={headerStyle}
      >
        <div className="header-content">
          <span>{col.alias || col.name}</span>
          <button
            className={`sort-button ${sortConfig.column === index ? 'active' : ''}`}
            onClick={() => handleSort(index)}
          >
            <span className="sort-icons">
              <span className={sortConfig.column === index && sortConfig.direction === 'asc' ? 'active' : ''}>
                ▲
              </span>
              <span className={sortConfig.column === index && sortConfig.direction === 'desc' ? 'active' : ''}>
                ▼
              </span>
            </span>
          </button>
        </div>
        {!dueDateColumn && isDropdown ? (
          <div className="searchable-dropdown-container" onClick={(e) => e.stopPropagation()}>
            <div
              className="searchable-dropdown-input"
              onClick={() => handleDropdownToggle(index)}
            >
              <input
                type="text"
                className="dropdown-search-input"
                placeholder={filters[index] ? filters[index] : 'All'}
                value={dropdownOpen[index] ? dropdownSearch[index] || '' : filters[index] || ''}
                onChange={(e) => {
                  e.stopPropagation();
                  handleDropdownSearchChange(index, e.target.value);
                }}
                onFocus={() => {
                  if (!dropdownOpen[index]) {
                    setDropdownOpen((prev) => ({ ...prev, [index]: true }));
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!dropdownOpen[index]) {
                    setDropdownOpen((prev) => ({ ...prev, [index]: true }));
                  }
                }}
              />
              {filters[index] && !dropdownOpen[index] && (
                <span
                  className="filter-clear-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearFilter(index);
                  }}
                  title="Clear filter"
                >
                  ×
                </span>
              )}
              <span className="dropdown-arrow">{dropdownOpen[index] ? '▲' : '▼'}</span>
            </div>
            {dropdownOpen[index] && (
              <div className="dropdown-options">
                <div className="dropdown-option" onClick={() => handleDropdownSelect(index, 'all')}>
                  All
                </div>
                {(() => {
                  // Use filteredDetailedData for detailed view, receivables for summary view
                  // Note: filteredDetailedData is computed in useMemo, so it's available during render
                  let dataSource = receivables;
                  if (viewMode === 'detailed' && typeof filteredDetailedData !== 'undefined') {
                    dataSource = filteredDetailedData;
                  }
                  const options = getFilteredDropdownOptions(index, dropdownSearch[index] || '', dataSource);
                  if (options.length === 0) {
                    return (
                      <div className="dropdown-option" style={{ fontStyle: 'italic', color: '#999' }}>
                        No values found
                      </div>
                    );
                  }
                  return options.map((value, idx) => (
                    <div
                      key={idx}
                      className={`dropdown-option ${filters[index] === value.toLowerCase() ? 'selected' : ''}`}
                      onClick={() => handleDropdownSelect(index, value)}
                    >
                      {value}
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        ) : !dueDateColumn ? (
          <div className="column-filter-wrapper">
          <input
            type="text"
            className="column-filter"
            placeholder={
              isNumericCurrencyColumn(index)
                ? 'Filter (e.g., >1000, <5000, =10000)...'
                : 'Filter...'
            }
            value={filters[index] || ''}
            onChange={(e) => handleFilter(index, e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
            {filters[index] && (
              <span
                className="filter-clear-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearFilter(index);
                }}
                title="Clear filter"
              >
                ×
              </span>
            )}
          </div>
        ) : null}
      </th>
    );
  };

  const renderCustomerDetailHeaderCell = (col, index, customerName, customerDataRows = null) => {
    if (!shouldDisplayColumn(index)) return null;
    const isDropdown = isDropdownColumn(index);
    const isRightAligned = isRightAlignedColumn(index);
    const dueDateColumn = isDueDateColumn(index);
    const drCrColumn = isDrCrColumn(index);
    const ledgerColumn = isLedgerColumn(index);
    const billNameColumn = isBillNameColumn(index);
    const headerStyle = {};

    const customerFilter = customerFilters[customerName] || {};
    const customerSort = customerSortConfig[customerName] || { column: null, direction: 'asc' };
    const customerDropdownOpenState = customerDropdownOpen[customerName] || {};
    const customerDropdownSearchState = customerDropdownSearch[customerName] || {};
    
    // Use customer's data rows if provided, otherwise fallback to all receivables
    const dataSourceForDropdown = customerDataRows || receivables;

    if (dueDateColumn) {
      headerStyle.width = `${dueDateColumnWidth}px`;
      headerStyle.minWidth = `${dueDateColumnWidth}px`;
    } else if (drCrColumn) {
      headerStyle.width = `${drCrColumnWidth}px`;
      headerStyle.minWidth = `${drCrColumnWidth}px`;
    } else if (ledgerColumn) {
      headerStyle.minWidth = `${ledgerColumnMinWidth}px`;
    } else if (billNameColumn) {
      headerStyle.minWidth = `${billNameColumnMinWidth}px`;
    }

    return (
      <th
        key={index}
        className={`sortable-header ${isRightAligned ? 'text-right' : ''}`}
        style={headerStyle}
      >
        <div className="header-content">
          <span>{col.alias || col.name}</span>
          <button
            className={`sort-button ${customerSort.column === index ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setCustomerSortConfig((prev) => {
                const customerSortState = prev[customerName] || { column: null, direction: 'asc' };
                if (customerSortState.column === index) {
                  return {
                    ...prev,
                    [customerName]: {
                      column: index,
                      direction: customerSortState.direction === 'asc' ? 'desc' : 'asc',
                    },
                  };
                }
                return {
                  ...prev,
                  [customerName]: {
                    column: index,
                    direction: 'asc',
                  },
                };
              });
            }}
          >
            <span className="sort-icons">
              <span className={customerSort.column === index && customerSort.direction === 'asc' ? 'active' : ''}>
                ▲
              </span>
              <span className={customerSort.column === index && customerSort.direction === 'desc' ? 'active' : ''}>
                ▼
              </span>
            </span>
          </button>
        </div>
        {!dueDateColumn && isDropdown ? (
          <div className="searchable-dropdown-container" onClick={(e) => e.stopPropagation()}>
            <div
              className="searchable-dropdown-input"
              onClick={(e) => {
                e.stopPropagation();
                setCustomerDropdownOpen((prev) => {
                  const customerDropdownState = prev[customerName] || {};
                  return {
                    ...prev,
                    [customerName]: {
                      ...customerDropdownState,
                      [index]: !customerDropdownState[index],
                    },
                  };
                });
              }}
            >
              <input
                type="text"
                className="dropdown-search-input"
                placeholder={customerFilter[index] ? customerFilter[index] : 'All'}
                value={customerDropdownOpenState[index] ? customerDropdownSearchState[index] || '' : customerFilter[index] || ''}
                onChange={(e) => {
                  e.stopPropagation();
                  setCustomerDropdownSearch((prev) => {
                    const customerSearchState = prev[customerName] || {};
                    return {
                      ...prev,
                      [customerName]: {
                        ...customerSearchState,
                        [index]: e.target.value,
                      },
                    };
                  });
                }}
                onFocus={() => {
                  if (!customerDropdownOpenState[index]) {
                    setCustomerDropdownOpen((prev) => {
                      const customerDropdownState = prev[customerName] || {};
                      return {
                        ...prev,
                        [customerName]: {
                          ...customerDropdownState,
                          [index]: true,
                        },
                      };
                    });
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!customerDropdownOpenState[index]) {
                    setCustomerDropdownOpen((prev) => {
                      const customerDropdownState = prev[customerName] || {};
                      return {
                        ...prev,
                        [customerName]: {
                          ...customerDropdownState,
                          [index]: true,
                        },
                      };
                    });
                  }
                }}
              />
              {customerFilter[index] && !customerDropdownOpenState[index] && (
                <span
                  className="filter-clear-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCustomerFilters((prev) => {
                      const customerFilterState = prev[customerName] || {};
                      const newCustomerFilter = { ...customerFilterState };
                      delete newCustomerFilter[index];
                      return {
                        ...prev,
                        [customerName]: newCustomerFilter,
                      };
                    });
                  }}
                  title="Clear filter"
                >
                  ×
                </span>
              )}
              <span className="dropdown-arrow">{customerDropdownOpenState[index] ? '▲' : '▼'}</span>
            </div>
            {customerDropdownOpenState[index] && (
              <div className="dropdown-options">
                <div
                  className="dropdown-option"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCustomerFilters((prev) => {
                      const customerFilterState = prev[customerName] || {};
                      const newCustomerFilter = { ...customerFilterState };
                      delete newCustomerFilter[index];
                      return {
                        ...prev,
                        [customerName]: newCustomerFilter,
                      };
                    });
                    setCustomerDropdownOpen((prev) => {
                      const customerDropdownState = prev[customerName] || {};
                      return {
                        ...prev,
                        [customerName]: {
                          ...customerDropdownState,
                          [index]: false,
                        },
                      };
                    });
                  }}
                >
                  All
                </div>
                {(() => {
                  // For customer detail dropdowns, use the customer's detail rows (already filtered by salesperson)
                  // Use customerDataRows if provided (from summary view), otherwise use all receivables
                  const options = getFilteredDropdownOptions(index, customerDropdownSearchState[index] || '', dataSourceForDropdown);
                  if (options.length === 0) {
                    return (
                      <div className="dropdown-option" style={{ fontStyle: 'italic', color: '#999' }}>
                        No values found
                      </div>
                    );
                  }
                  return options.map((value, idx) => (
                    <div
                      key={idx}
                      className={`dropdown-option ${customerFilter[index] === value.toLowerCase() ? 'selected' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCustomerFilters((prev) => {
                          const customerFilterState = prev[customerName] || {};
                          return {
                            ...prev,
                            [customerName]: {
                              ...customerFilterState,
                              [index]: value.toLowerCase(),
                            },
                          };
                        });
                        setCustomerDropdownOpen((prev) => {
                          const customerDropdownState = prev[customerName] || {};
                          return {
                            ...prev,
                            [customerName]: {
                              ...customerDropdownState,
                              [index]: false,
                            },
                          };
                        });
                      }}
                    >
                      {value}
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        ) : !dueDateColumn ? (
          <div className="column-filter-wrapper">
            <input
              type="text"
              className="column-filter"
              placeholder={
                isNumericCurrencyColumn(index)
                  ? 'Filter (e.g., >1000, <5000, =10000)...'
                  : 'Filter...'
              }
              value={customerFilter[index] || ''}
              onChange={(e) => {
                setCustomerFilters((prev) => {
                  const customerFilterState = prev[customerName] || {};
                  const newCustomerFilter = { ...customerFilterState };
                  if (e.target.value === '' || e.target.value === 'all') {
                    delete newCustomerFilter[index];
                  } else if (isNumericCurrencyColumn(index)) {
                    newCustomerFilter[index] = e.target.value.trim();
                  } else {
                    newCustomerFilter[index] = e.target.value.toLowerCase();
                  }
                  return {
                    ...prev,
                    [customerName]: newCustomerFilter,
                  };
                });
              }}
              onClick={(e) => e.stopPropagation()}
            />
            {customerFilter[index] && (
              <span
                className="filter-clear-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setCustomerFilters((prev) => {
                    const customerFilterState = prev[customerName] || {};
                    const newCustomerFilter = { ...customerFilterState };
                    delete newCustomerFilter[index];
                    return {
                      ...prev,
                      [customerName]: newCustomerFilter,
                    };
                  });
                }}
                title="Clear filter"
              >
                ×
              </span>
            )}
          </div>
        ) : null}
      </th>
    );
  };

  const expandColumnWidth = 48;
  const dueDateColumnWidth = 110;
  const drCrColumnWidth = 70;
  const ledgerColumnMinWidth = 220;
  const billNameColumnMinWidth = 180;

  const isDueDateColumn = (columnIndex) => {
    if (!columns || columns.length === 0) return false;
    const col = columns[columnIndex];
    if (!col) return false;
    const colName = (col.name || '').toLowerCase();
    const colAlias = (col.alias || '').toLowerCase();
    return colName.includes('duedate') || colAlias.includes('due date');
  };

  const isDrCrColumn = (columnIndex) => {
    if (!columns || columns.length === 0) return false;
    const col = columns[columnIndex];
    if (!col) return false;

    const colName = (col.name || '').toLowerCase();
    const colAlias = (col.alias || '').toLowerCase();

    return colName === 'drcr' || colAlias.includes('dr/cr');
  };

  const isLedgerColumn = (columnIndex) => {
    if (!columns || columns.length === 0) return false;
    const col = columns[columnIndex];
    if (!col) return false;

    const colName = (col.name || '').toLowerCase();
    const colAlias = (col.alias || '').toLowerCase();

    return (
      colName.includes('ledgername') ||
      colAlias.includes('ledger name') ||
      colName.includes('parent')
    );
  };

  const isBillNameColumn = (columnIndex) => {
    if (!columns || columns.length === 0) return false;
    const col = columns[columnIndex];
    if (!col) return false;

    const colName = (col.name || '').toLowerCase();
    const colAlias = (col.alias || '').toLowerCase();

    return colName.includes('billname') || colAlias.includes('billname');
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const SUMMARY_PAGE_SIZE = 10;
  const [summaryPage, setSummaryPage] = useState(1);
  const [customerFilters, setCustomerFilters] = useState({});
  const [customerSortConfig, setCustomerSortConfig] = useState({});
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState({});
  const [customerDropdownSearch, setCustomerDropdownSearch] = useState({});

  useEffect(() => {
    setCurrentPage(1);
  }, [
    filters,
    sortConfig,
    selectedAgingBucket,
    selectedSalesperson,
    enabledSalespersons,
    receivables,
  ]);

  useEffect(() => {
    if (viewMode === 'summary') {
      setSummaryPage(1);
    }
  }, [groupBy, filters, selectedAgingBucket, selectedSalesperson, enabledSalespersons, receivables, viewMode]);

  const summaryData = useMemo(() => {
    const baseSummary = groupBy === 'Ledger' ? getCustomerSummary() : getSalespersonSummary();
    if (!columns || columns.length === 0) return baseSummary;

    const closingBalanceIndex = columns.findIndex(
      (col) =>
        col.name.includes('ClosingBalance') ||
        col.name.includes('Closingbalance') ||
        col.alias?.includes('Closing Balance')
    );
    const salespersonIndex = columns.findIndex(
      (col) =>
        col.name.includes('SalesPerson') ||
        col.alias?.includes('SalesPerson') ||
        col.name.includes('Salesperson')
    );
    const dueDateIndex = columns.findIndex(
      (col) => {
        const colName = (col?.name || '').toLowerCase();
        const colAlias = (col?.alias || '').toLowerCase();
        return colName.includes('duedate') || colAlias.includes('due date') || colAlias.includes('duedate');
      }
    );

    const resolveAgingBucket = (row) => {
      if (typeof getRowAgingBucket === 'function') {
        return getRowAgingBucket(row, dueDateIndex);
      }
      if (dueDateIndex === -1) return null;
      const dueDateStr = row[dueDateIndex] || '';
      const diff = calculateDaysOverdue(dueDateStr);
      if (diff === null) return null;
      // Fallback to hardcoded buckets if getRowAgingBucket is not available
      if (diff <= 30) return '0-30';
      if (diff <= 90) return '30-90';
      if (diff <= 180) return '90-180';
      if (diff <= 360) return '180-360';
      return '>360';
    };

    return baseSummary
      .map((item) => {
        const filteredRows = item.detailRows.filter((dr) => {
          const row = dr.row;

          if (selectedSalesperson && salespersonIndex !== -1) {
            const salespersonName = row[salespersonIndex] || 'Unassigned';
            if (salespersonName !== selectedSalesperson) return false;
          }

          if (enabledSalespersons.size > 0 && salespersonIndex !== -1) {
            const salespersonName = row[salespersonIndex] || 'Unassigned';
            if (!enabledSalespersons.has(salespersonName)) return false;
          }

          if (selectedAgingBucket) {
            const bucket = resolveAgingBucket(row);
            if (bucket !== selectedAgingBucket) return false;
          }

          return true;
        });

        const totalBalance = filteredRows.reduce((sum, dr) => {
          if (closingBalanceIndex === -1) return sum;
          const value = parseFloat(dr.row[closingBalanceIndex]) || 0;
          return sum + Math.abs(value);
        }, 0);

        return {
          ...item,
          detailRows: filteredRows,
          totalBalance,
        };
      })
      .filter((item) => item.detailRows.length > 0);
  }, [
    groupBy,
    getCustomerSummary,
    getSalespersonSummary,
    columns,
    selectedSalesperson,
    selectedAgingBucket,
    enabledSalespersons,
    getRowAgingBucket,
  ]);

  const totalSummaryPages = Math.max(1, Math.ceil(summaryData.length / SUMMARY_PAGE_SIZE));
  const currentSummaryPage = Math.min(Math.max(summaryPage, 1), totalSummaryPages);
  const pagedSummaryData = useMemo(
    () =>
      summaryData.slice(
        (currentSummaryPage - 1) * SUMMARY_PAGE_SIZE,
        currentSummaryPage * SUMMARY_PAGE_SIZE
      ),
    [summaryData, currentSummaryPage]
  );

  const filteredDetailedData = useMemo(() => applySortAndFilter(receivables), [
    receivables,
    filters,
    sortConfig,
    selectedAgingBucket,
    selectedSalesperson,
    enabledSalespersons,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredDetailedData.length / pageSize));
  const currentPageSafe = Math.min(Math.max(currentPage, 1), Math.max(totalPages, 1));
  const pageStartIndex = (currentPageSafe - 1) * pageSize;
  const currentPageRows = filteredDetailedData.slice(pageStartIndex, pageStartIndex + pageSize);
  const paginationDisabled = viewMode !== 'detailed';

  const handleExport = useCallback(() => {
    exportReceivablesToExcel({
      rows: filteredDetailedData,
      columns,
      filters,
      sortConfig,
      viewMode,
      groupBy,
      dropdownSearch,
      company,
      selectedAgingBucket,
      selectedSalesperson,
      enabledSalespersons,
    });
  }, [
    filteredDetailedData,
    columns,
    filters,
    sortConfig,
    viewMode,
    groupBy,
    dropdownSearch,
    company,
    selectedAgingBucket,
    selectedSalesperson,
    enabledSalespersons,
  ]);

  const renderSummaryView = () => {
    return (
      <>
      <table className="receivables-table">
        <thead>
          <tr>
            <th style={{ width: `${expandColumnWidth}px`, minWidth: `${expandColumnWidth}px` }} />
            <th>{groupBy === 'Ledger' ? 'Customer Name' : 'Salesperson Name'}</th>
            <th className="text-right">Total Balance</th>
            <th className="text-right">Bill Count</th>
          </tr>
        </thead>
        <tbody>
          {pagedSummaryData.map((item, idx) => {
            const itemName = groupBy === 'Ledger' ? item.customerName : item.salespersonName;
            const isExpanded = expandedCustomers.has(itemName);
            const dueDateIndex = columns.findIndex(
              (col) => {
                const colName = (col?.name || '').toLowerCase();
                const colAlias = (col?.alias || '').toLowerCase();
                return colName.includes('duedate') || colAlias.includes('due date') || colAlias.includes('duedate');
              }
            );

            return (
              <React.Fragment key={idx}>
                <tr className="customer-summary-row" onClick={() => toggleCustomerExpand(itemName)}>
                  <td className="expand-icon" style={{ width: expandColumnWidth }}>{isExpanded ? '▼' : '▶'}</td>
                  <td className="customer-name">{itemName}</td>
                  <td className="text-right currency-value">{formatCurrency(item.totalBalance)}</td>
                  <td className="text-right">{item.detailRows.length}</td>
                </tr>
                {isExpanded && (
                  <tr className="summary-details-row">
                    <td colSpan={4} className="details-container">
                      <div
                        style={{
                          marginLeft: `-${expandColumnWidth}px`,
                          width: `calc(100% + ${expandColumnWidth}px)`,
                        }}
                      >
                        <table className="nested-details-table">
                          <thead>
                            <tr>
                              <th
                                style={{
                                  width: `${expandColumnWidth}px`,
                                  minWidth: `${expandColumnWidth}px`,
                                }}
                              />
                              {columns.map((col, colIndex) => renderCustomerDetailHeaderCell(col, colIndex, itemName, item.detailRows.map((dr) => dr.row)))}
                              <th className="text-right sortable-header">
                                <div className="header-content">
                                  <span>Days Overdue</span>
                                  <button
                                    className={`sort-button ${(customerSortConfig[itemName] || {}).column === 'daysOverdue' ? 'active' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCustomerSortConfig((prev) => {
                                        const customerSortState = prev[itemName] || { column: null, direction: 'asc' };
                                        const newDirection =
                                          customerSortState.column === 'daysOverdue' && customerSortState.direction === 'asc' ? 'desc' : 'asc';
                                        return {
                                          ...prev,
                                          [itemName]: {
                                            column: 'daysOverdue',
                                            direction: newDirection,
                                          },
                                        };
                                      });
                                    }}
                                  >
                                    <span className="sort-icons">
                                      <span className={(customerSortConfig[itemName] || {}).column === 'daysOverdue' && (customerSortConfig[itemName] || {}).direction === 'asc' ? 'active' : ''}>
                                        ▲
                                      </span>
                                      <span className={(customerSortConfig[itemName] || {}).column === 'daysOverdue' && (customerSortConfig[itemName] || {}).direction === 'desc' ? 'active' : ''}>
                                        ▼
                                      </span>
                                    </span>
                                  </button>
                                </div>
                                <div className="column-filter-wrapper">
                                  <input
                                    type="text"
                                    className="column-filter"
                                    placeholder="Filter (e.g., >30, <60, >30<60)..."
                                    value={(customerFilters[itemName] || {}).daysOverdue || ''}
                                    onChange={(e) => {
                                      setCustomerFilters((prev) => {
                                        const customerFilterState = prev[itemName] || {};
                                        const newCustomerFilter = { ...customerFilterState };
                                        if (e.target.value === '') {
                                          delete newCustomerFilter.daysOverdue;
                                        } else {
                                          newCustomerFilter.daysOverdue = e.target.value.toLowerCase();
                                        }
                                        return {
                                          ...prev,
                                          [itemName]: newCustomerFilter,
                                        };
                                      });
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  {(customerFilters[itemName] || {}).daysOverdue && (
                                    <span
                                      className="filter-clear-icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCustomerFilters((prev) => {
                                          const customerFilterState = prev[itemName] || {};
                                          const newCustomerFilter = { ...customerFilterState };
                                          delete newCustomerFilter.daysOverdue;
                                          return {
                                            ...prev,
                                            [itemName]: newCustomerFilter,
                                          };
                                        });
                                      }}
                                      title="Clear filter"
                                    >
                                      ×
                                    </span>
                                  )}
                                </div>
                              </th>
                            </tr>
                          </thead>
                        <tbody>
                          {applyCustomerSortAndFilter(item.detailRows.map((dr) => dr.row), itemName).map((row, index) => {
                            const dueDateStr = dueDateIndex !== -1 ? row[dueDateIndex] : '';
                            const daysOverdue = calculateDaysOverdue(dueDateStr);
                            const uniqueRowIndex = `${idx}-${index}`;

                            return (
                              <tr
                                key={index}
                                className="bill-row-clickable"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onBillRowClick(row);
                                }}
                                style={{ cursor: 'pointer' }}
                              >
                                <td
                                  className="row-options-cell"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenOptionsRow((prev) =>
                                      prev === uniqueRowIndex ? null : uniqueRowIndex
                                    );
                                  }}
                                >
                                  <div
                                    className="row-options-icon"
                                    title="Options"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setOpenOptionsRow((prev) =>
                                        prev === uniqueRowIndex ? null : uniqueRowIndex
                                      );
                                    }}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                      <circle cx="8" cy="3" r="1.5" />
                                      <circle cx="8" cy="8" r="1.5" />
                                      <circle cx="8" cy="13" r="1.5" />
                                    </svg>
                                  </div>
                                  {openOptionsRow === uniqueRowIndex && (
                                    <div className="row-options-menu" onClick={(e) => e.stopPropagation()}>
                                      <div
                                        className="row-options-menu-item"
                                        onClick={() => {
                                          onFilterCustomer(row);
                                          setOpenOptionsRow(null);
                                        }}
                                      >
                                        Filter Customer
                                      </div>
                                      <div
                                        className="row-options-menu-item"
                                        onClick={() => {
                                          onFilterSalesperson(row);
                                          setOpenOptionsRow(null);
                                        }}
                                      >
                                        Filter Salesperson
                                      </div>
                                      <div
                                        className="row-options-menu-item"
                                        onClick={() => {
                                          onShowVoucherDetails(row);
                                          setOpenOptionsRow(null);
                                        }}
                                      >
                                        Show Voucher Details
                                      </div>
                                      <div
                                        className="row-options-menu-item"
                                        onClick={() => {
                                          onShowLedgerVouchers(row);
                                          setOpenOptionsRow(null);
                                        }}
                                      >
                                        Show Ledger Vouchers
                                      </div>
                                      <div
                                        className="row-options-menu-item"
                                        onClick={() => {
                                          onShowLedgerOutstandings(row);
                                          setOpenOptionsRow(null);
                                        }}
                                      >
                                        Show Ledger Outstandings
                                      </div>
                                    </div>
                                  )}
                                </td>
                                {row.map((cell, cellIndex) => {
                                  if (!shouldDisplayColumn(cellIndex)) return null;
                                  const col = columns[cellIndex];
                                  const isCurrency =
                                    col && (col.name.includes('Balance') || col.name.includes('balance'));
                                  const isRightAligned = isRightAlignedColumn(cellIndex);
                                  const dueDateColumn = isDueDateColumn(cellIndex);
                                  const drCrColumn = isDrCrColumn(cellIndex);
                                  const ledgerColumn = isLedgerColumn(cellIndex);
                                  const billNameColumn = isBillNameColumn(cellIndex);
                                  return (
                                    <td
                                      key={cellIndex}
                                      className={
                                        drCrColumn ? 'text-center' : isRightAligned ? 'text-right' : ''
                                      }
                                      style={{
                                        whiteSpace:
                                          isCurrency || dueDateColumn || drCrColumn
                                            ? 'nowrap'
                                            : 'normal',
                                        width: dueDateColumn
                                          ? `${dueDateColumnWidth}px`
                                          : drCrColumn
                                          ? `${drCrColumnWidth}px`
                                          : undefined,
                                        minWidth: dueDateColumn
                                          ? `${dueDateColumnWidth}px`
                                          : drCrColumn
                                          ? `${drCrColumnWidth}px`
                                          : ledgerColumn
                                          ? `${ledgerColumnMinWidth}px`
                                          : billNameColumn
                                          ? `${billNameColumnMinWidth}px`
                                          : undefined,
                                        flex: ledgerColumn || billNameColumn ? '1 0 auto' : undefined,
                                      }}
                                    >
                                      {isCurrency ? formatCurrency(cell) : cell}
                                    </td>
                                  );
                                })}
                                <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                                  {daysOverdue !== null && daysOverdue !== undefined ? `${daysOverdue} days` : '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
        <tfoot>
          {(() => {
            const allDetailRows = summaryData.flatMap((item) => item.detailRows.map((dr) => dr.row));
            const totals = calculateTableTotals(allDetailRows);
            return (
              <tr className="table-totals-row">
                <td
                  colSpan={4}
                  style={{ fontWeight: 'bold', backgroundColor: '#f7fafc', borderTop: '2px solid #e2e8f0' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '2rem' }}>
                      <span>
                        Customers: <strong>{totals.customerCount}</strong>
                      </span>
                      <span>
                        Salespersons: <strong>{totals.salespersonCount}</strong>
                      </span>
                      <span>
                        Bills: <strong>{totals.billCount}</strong>
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      Net Closing Balance: <strong>{formatCurrency(totals.netClosingBalance)}</strong>
                    </div>
                  </div>
                </td>
              </tr>
            );
          })()}
        </tfoot>
      </table>
      {summaryData.length > SUMMARY_PAGE_SIZE && (
        <div className="pagination-controls summary">
          <button
            type="button"
            onClick={() => setSummaryPage((prev) => Math.max(1, prev - 1))}
            disabled={currentSummaryPage === 1}
            className="pagination-button"
          >
            Prev
          </button>
          {(() => {
            const buttons = [];
            const maxVisible = 5;
            let start = Math.max(1, currentSummaryPage - Math.floor(maxVisible / 2));
            let end = start + maxVisible - 1;
            if (end > totalSummaryPages) {
              end = totalSummaryPages;
              start = Math.max(1, end - maxVisible + 1);
            }
            for (let page = start; page <= end; page += 1) {
              buttons.push(
                <button
                  key={page}
                  type="button"
                  onClick={() => setSummaryPage(page)}
                  className={`pagination-button ${page === currentSummaryPage ? 'active' : ''}`}
                >
                  {page}
                </button>
              );
            }
            if (end < totalSummaryPages) {
              buttons.push(
                <span key="bottom-more" className="pagination-ellipsis">
                  …
                </span>
              );
            }
            return buttons;
          })()}
          <button
            type="button"
            onClick={() => setSummaryPage((prev) => Math.min(totalSummaryPages, prev + 1))}
            disabled={currentSummaryPage === totalSummaryPages}
            className="pagination-button"
          >
            Next
          </button>
        </div>
      )}
      </>
    );
  };

  const renderDetailedView = () => {
    return (
      <>
        <table className="receivables-table">
        <thead>
          <tr>
            <th
              style={{
                width: `${expandColumnWidth}px`,
                minWidth: `${expandColumnWidth}px`,
                maxWidth: `${expandColumnWidth}px`,
                padding: '0.5rem',
              }}
            />
            {columns.map(renderHeaderCell)}
            <th className="text-right sortable-header">
              <div className="header-content">
                <span>Days Overdue</span>
                <button
                  className={`sort-button ${sortConfig.column === 'daysOverdue' ? 'active' : ''}`}
                  onClick={() => {
                    const newDirection =
                      sortConfig.column === 'daysOverdue' && sortConfig.direction === 'asc' ? 'desc' : 'asc';
                    setSortConfig({ column: 'daysOverdue', direction: newDirection });
                  }}
                >
                  <span className="sort-icons">
                    <span className={sortConfig.column === 'daysOverdue' && sortConfig.direction === 'asc' ? 'active' : ''}>
                      ▲
                    </span>
                    <span className={sortConfig.column === 'daysOverdue' && sortConfig.direction === 'desc' ? 'active' : ''}>
                      ▼
                    </span>
                  </span>
                </button>
              </div>
              <div className="column-filter-wrapper">
              <input
                type="text"
                className="column-filter"
                placeholder="Filter (e.g., >30, <60, >30<60)..."
                value={filters.daysOverdue || ''}
                onChange={(e) => {
                  setFilters((prevFilters) => {
                    const newFilters = { ...prevFilters };
                    if (e.target.value === '') {
                      delete newFilters.daysOverdue;
                    } else {
                      newFilters.daysOverdue = e.target.value.toLowerCase();
                    }
                    return newFilters;
                  });
                }}
                onClick={(e) => e.stopPropagation()}
              />
                {filters.daysOverdue && (
                  <span
                    className="filter-clear-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilters((prevFilters) => {
                        const newFilters = { ...prevFilters };
                        delete newFilters.daysOverdue;
                        return newFilters;
                      });
                    }}
                    title="Clear filter"
                  >
                    ×
                  </span>
                )}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {currentPageRows.map((row, rowIndex) => {
            const dueDateIndex = columns.findIndex(
              (col) => {
                const colName = (col?.name || '').toLowerCase();
                const colAlias = (col?.alias || '').toLowerCase();
                return colName.includes('duedate') || colAlias.includes('due date') || colAlias.includes('duedate');
              }
            );
            const dueDateStr = dueDateIndex !== -1 ? row[dueDateIndex] : '';
            const daysOverdue = calculateDaysOverdue(dueDateStr);

            return (
              <tr
                key={`${currentPageSafe}-${rowIndex}`}
                className="bill-row-clickable"
                onClick={() => onBillRowClick(row)}
                style={{ cursor: 'pointer' }}
              >
                <td
                  className="row-options-cell"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenOptionsRow((prev) =>
                      prev === `${currentPageSafe}-${rowIndex}` ? null : `${currentPageSafe}-${rowIndex}`
                    );
                  }}
                >
                  <div className="row-options-icon" title="Options">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <circle cx="8" cy="3" r="1.5" />
                      <circle cx="8" cy="8" r="1.5" />
                      <circle cx="8" cy="13" r="1.5" />
                    </svg>
                  </div>
                  {openOptionsRow === `${currentPageSafe}-${rowIndex}` && (
                    <div className="row-options-menu" onClick={(e) => e.stopPropagation()}>
                      <div
                        className="row-options-menu-item"
                        onClick={() => {
                          onFilterCustomer(row);
                          setOpenOptionsRow(null);
                        }}
                      >
                        Filter Customer
                      </div>
                      <div
                        className="row-options-menu-item"
                        onClick={() => {
                          onFilterSalesperson(row);
                          setOpenOptionsRow(null);
                        }}
                      >
                        Filter Salesperson
                      </div>
                      <div
                        className="row-options-menu-item"
                        onClick={() => {
                          onShowVoucherDetails(row);
                          setOpenOptionsRow(null);
                        }}
                      >
                        Show Voucher Details
                      </div>
                      <div
                        className="row-options-menu-item"
                        onClick={() => {
                          onShowLedgerVouchers(row);
                          setOpenOptionsRow(null);
                        }}
                      >
                        Show Ledger Vouchers
                      </div>
                      <div
                        className="row-options-menu-item"
                        onClick={() => {
                          onShowLedgerOutstandings(row);
                          setOpenOptionsRow(null);
                        }}
                      >
                        Show Ledger Outstandings
                      </div>
                    </div>
                  )}
                </td>
                {row.map((cell, cellIndex) => {
                  if (!shouldDisplayColumn(cellIndex)) return null;
                  const col = columns[cellIndex];
                  const isCurrency = col && (col.name.includes('Balance') || col.name.includes('balance'));
                  const isRightAligned = isRightAlignedColumn(cellIndex);
                  const dueDateColumn = isDueDateColumn(cellIndex);
                  const drCrColumn = isDrCrColumn(cellIndex);
                  const ledgerColumn = isLedgerColumn(cellIndex);
                  const billNameColumn = isBillNameColumn(cellIndex);
                  return (
                    <td
                      key={cellIndex}
                      className={drCrColumn ? 'text-center' : isRightAligned ? 'text-right' : ''}
                      style={{
                        whiteSpace:
                          isCurrency || dueDateColumn || drCrColumn ? 'nowrap' : 'normal',
                        width: dueDateColumn
                          ? `${dueDateColumnWidth}px`
                          : drCrColumn
                          ? `${drCrColumnWidth}px`
                          : undefined,
                        minWidth: dueDateColumn
                          ? `${dueDateColumnWidth}px`
                          : drCrColumn
                          ? `${drCrColumnWidth}px`
                          : ledgerColumn
                          ? `${ledgerColumnMinWidth}px`
                          : billNameColumn
                          ? `${billNameColumnMinWidth}px`
                          : undefined,
                        flex: ledgerColumn || billNameColumn ? '1 0 auto' : undefined,
                      }}
                    >
                      {isCurrency ? formatCurrency(cell) : cell}
                    </td>
                  );
                })}
                <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                  {daysOverdue !== null && daysOverdue !== undefined ? `${daysOverdue} days` : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          {(() => {
            const totals = calculateTableTotals(filteredDetailedData);
            const displayedColumnsCount = columns.filter((_, idx) => shouldDisplayColumn(idx)).length;
            const colSpan = 1 + displayedColumnsCount + 1;
            return (
              <tr className="table-totals-row">
                <td
                  colSpan={colSpan}
                  style={{ fontWeight: 'bold', backgroundColor: '#f7fafc', borderTop: '2px solid #e2e8f0' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '2rem' }}>
                      <span>
                        Customers: <strong>{totals.customerCount}</strong>
                      </span>
                      <span>
                        Salespersons: <strong>{totals.salespersonCount}</strong>
                      </span>
                      <span>
                        Bills: <strong>{totals.billCount}</strong>
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      Net Closing Balance: <strong>{formatCurrency(totals.netClosingBalance)}</strong>
                    </div>
                  </div>
                </td>
              </tr>
            );
          })()}
        </tfoot>
      </table>
      <div className="table-pagination">
        <div className="pagination-info">
          Showing {filteredDetailedData.length === 0 ? 0 : pageStartIndex + 1}-
          {Math.min(pageStartIndex + pageSize, filteredDetailedData.length)} of {filteredDetailedData.length}
        </div>
        <div className="pagination-controls">
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPageSafe === 1}
            className="pagination-button"
          >
            Prev
          </button>
          {(() => {
            const buttons = [];
            const maxVisible = 5;
            let start = Math.max(1, currentPageSafe - Math.floor(maxVisible / 2));
            let end = start + maxVisible - 1;
            if (end > totalPages) {
              end = totalPages;
              start = Math.max(1, end - maxVisible + 1);
            }
            for (let page = start; page <= end; page += 1) {
              buttons.push(
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`pagination-button ${page === currentPageSafe ? 'active' : ''}`}
                >
                  {page}
                </button>
              );
            }
            if (end < totalPages) {
              buttons.push(
                <span key="top-more" className="pagination-ellipsis">
                  …
                </span>
              );
            }
            return buttons;
          })()}
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPageSafe === totalPages}
            className="pagination-button"
          >
            Next
          </button>
          <select
            className="pagination-select"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} / page
              </option>
            ))}
          </select>
        </div>
      </div>
      </>
    );
  };

  const resolveAgingBucket = useCallback(
    (row, dueDateIndex) => {
      if (typeof getRowAgingBucket === 'function') {
        return getRowAgingBucket(row, dueDateIndex);
      }
      if (dueDateIndex === -1) return '0-30';
      const dueDateStr = row[dueDateIndex] || '';
      const diff = calculateDaysOverdue(dueDateStr);
      if (diff === null) return '0-30';
      if (diff <= 30) return '0-30';
      if (diff <= 90) return '30-90';
      if (diff <= 180) return '90-180';
      if (diff <= 360) return '180-360';
      return '>360';
    },
    [getRowAgingBucket]
  );

  return (
    <div className="table-container">
      <div className="table-view-controls">
        <div className="view-controls-left">
          <label className="group-by-label">Show by:</label>
          <select
            className="group-by-select"
            value={groupBy}
            onChange={(e) => {
              setGroupBy(e.target.value);
              setExpandedCustomers(new Set());
            }}
            disabled={viewMode === 'detailed'}
          >
            <option value="Ledger">Ledger</option>
            <option value="Salesperson">Salesperson</option>
          </select>
        </div>
        <div className="view-controls-right">
          {Object.keys(filters).length > 0 && (
            <button
              type="button"
              className="clear-filters-button"
              onClick={handleClearAllFilters}
              title="Clear all filters"
            >
              <span className="material-icons" style={{ fontSize: '18px', marginRight: '4px' }}>
                clear
              </span>
              Clear Filters
            </button>
          )}
          <button type="button" className="export-button" onClick={handleExport}>
            Export Excel
          </button>
          <button
            className={`view-toggle ${viewMode === 'summary' ? 'active' : ''}`}
            onClick={() => setViewMode('summary')}
          >
            Summary
          </button>
          <button
            className={`view-toggle ${viewMode === 'detailed' ? 'active' : ''}`}
            onClick={() => setViewMode('detailed')}
          >
            Detailed View
          </button>
          {viewMode === 'summary' && summaryData.length > SUMMARY_PAGE_SIZE ? (
            <div className="pagination-controls top">
              <button
                type="button"
                onClick={() => setSummaryPage((prev) => Math.max(1, prev - 1))}
                disabled={currentSummaryPage === 1}
                className="pagination-button"
              >
                Prev
              </button>
              {(() => {
                const buttons = [];
                const maxVisible = 5;
                let start = Math.max(1, currentSummaryPage - Math.floor(maxVisible / 2));
                let end = start + maxVisible - 1;
                if (end > totalSummaryPages) {
                  end = totalSummaryPages;
                  start = Math.max(1, end - maxVisible + 1);
                }
                for (let page = start; page <= end; page += 1) {
                  buttons.push(
                    <button
                      key={`summary-${page}`}
                      type="button"
                      onClick={() => setSummaryPage(page)}
                      className={`pagination-button ${page === currentSummaryPage ? 'active' : ''}`}
                    >
                      {page}
                    </button>
                  );
                }
                if (end < totalSummaryPages) {
                  buttons.push(
                    <span key="summary-more" className="pagination-ellipsis">
                      …
                    </span>
                  );
                }
                return buttons;
              })()}
              <button
                type="button"
                onClick={() => setSummaryPage((prev) => Math.min(totalSummaryPages, prev + 1))}
                disabled={currentSummaryPage === totalSummaryPages}
                className="pagination-button"
              >
                Next
              </button>
            </div>
          ) : null}
          {viewMode === 'detailed' && filteredDetailedData.length > 0 && (
            <div className="pagination-controls top">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPageSafe === 1}
                className="pagination-button"
              >
                Prev
              </button>
              {(() => {
                const buttons = [];
                const maxVisible = 5;
                let start = Math.max(1, currentPageSafe - Math.floor(maxVisible / 2));
                let end = start + maxVisible - 1;
                if (end > totalPages) {
                  end = totalPages;
                  start = Math.max(1, end - maxVisible + 1);
                }
                for (let page = start; page <= end; page += 1) {
                  buttons.push(
                    <button
                      key={`top-${page}`}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`pagination-button ${page === currentPageSafe ? 'active' : ''}`}
                    >
                      {page}
                    </button>
                  );
                }
                if (end < totalPages) {
                  buttons.push(
                    <span key="top-more" className="pagination-ellipsis">
                      …
                    </span>
                  );
                }
                return buttons;
              })()}
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPageSafe === totalPages}
                className="pagination-button"
              >
                Next
              </button>
              <select
                className="pagination-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={`top-size-${option}`} value={option}>
                    {option} / page
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
      {viewMode === 'summary' ? renderSummaryView() : renderDetailedView()}
    </div>
  );
};

export default ReceivablesTable;
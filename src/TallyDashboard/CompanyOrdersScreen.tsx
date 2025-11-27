import React, {useEffect, useMemo, useState, useCallback, useRef} from 'react';
import {apiService} from '../utils/receiptApiAdapter';
import type {Company, CompanyOrder} from '../utils/receiptApiTypes';
import {formatDateDisplay, formatDateForInput} from '../utils/dateUtils';
import {escapeForXML} from '../utils/receivablesHelpers';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  LabelList,
  ResponsiveContainer,
} from 'recharts';
import './CompanyOrdersScreen.css';

const formatNumber = (value: number): string =>
  value.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});

const formatLargeNumber = (value: number): string => {
  const absValue = Math.abs(value);
  if (absValue >= 10000000) {
    return `${(value / 10000000).toFixed(2)} Cr`;
  }
  if (absValue >= 100000) {
    return `${(value / 100000).toFixed(2)} L`;
  }
  return value.toFixed(2);
};

const formatCurrencyShort = (value: number): string => {
  const absValue = Math.abs(value);
  if (absValue >= 10000000) {
    return `₹${(value / 10000000).toFixed(2)} Cr`;
  }
  if (absValue >= 100000) {
    return `₹${(value / 100000).toFixed(2)} L`;
  }
  return `₹${value.toFixed(2)}`;
};

interface ChartValueLabelProps {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  value?: any; // Allow any value type from recharts
  formatter: (value: number) => string;
  fill?: string;
  [key: string]: any; // Allow additional props from recharts
}

const ChartValueLabel: React.FC<ChartValueLabelProps> = ({
  x = 0,
  y = 0,
  width = 0,
  value = 0,
  formatter,
  fill = '#0f172a',
}) => {
  if (value === null || value === undefined) return null;
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return null;
  return (
    <text
      x={Number(x) + Number(width) / 2}
      y={Number(y) - 6}
      textAnchor="middle"
      fill={fill}
      className="chart-value-label">
      {formatter(numericValue)}
    </text>
  );
};

interface BucketLabelProps {
  x?: number | string;
  width?: number | string;
  y?: number | string;
  value?: any; // Allow any value type from recharts
  [key: string]: any; // Allow additional props from recharts
}

const BucketLabel: React.FC<BucketLabelProps> = ({x = 0, width = 0, y = 0, value = '', payload}) => {
  // Position label at bottom of chart area, accounting for margins
  const chartBottom = 280; // Approximate bottom of chart area (300px height - 20px margin)
  
  return (
    <text
      x={Number(x) + Number(width) / 2}
      y={chartBottom}
      textAnchor="middle"
      fill="#475569"
      fontSize={11}
      fontWeight={500}
      className="chart-bucket-label">
      {value !== undefined && value !== null ? String(value) : ''}
    </text>
  );
};

const INITIAL_FILTERS = {
  date: '',
  orderNo: '',
  stockItem: '',
  customer: '',
  orderQty: '',
  pendingQty: '',
  rate: '',
  value: '',
  dueDate: '',
};

interface CompanyOrdersScreenProps {
  company: Company;
  onBack: () => void;
  onLogout?: () => void;
}

type ItemBatchInfo = {
  Stockitem: string;
  godown: string;
  Batchname: string;
  CLOSINGBALANCE: string;
  CLOSINGVALUE: string;
};

type DeliverySummaryRow = {
  key: string;
  stockItem: string;
  rate: string;
  discount: string;
  rateDisplay: string;
  unit: string;
  totalOrderQty: number;
  totalPendingQty: number;
  totalAvailableQty: number;
  totalValue: number;
  totalAllocatedQty: number;
  orders: CompanyOrder[];
};

export const CompanyOrdersScreen: React.FC<CompanyOrdersScreenProps> = ({company, onBack, onLogout}) => {
  const [orders, setOrders] = useState<CompanyOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deliveryQuantities, setDeliveryQuantities] = useState<Record<string, string>>({});
  const [batchDeliveryQuantities, setBatchDeliveryQuantities] = useState<Record<string, string>>({});
  const [deliveryDate, setDeliveryDate] = useState<string>(formatDateForInput(new Date()));
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showDeliveryModal, setShowDeliveryModal] = useState<boolean>(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [itemBatchBalances, setItemBatchBalances] = useState<Record<string, ItemBatchInfo[]>>({});
  const [itemBatchLoading, setItemBatchLoading] = useState(false);
  const [itemBatchError, setItemBatchError] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [showBatchSelectionModal, setShowBatchSelectionModal] = useState<boolean>(false);
  const [selectedOrderForBatch, setSelectedOrderForBatch] = useState<CompanyOrder | null>(null);
  const [selectedSummaryKey, setSelectedSummaryKey] = useState<string | null>(null);
  const [tempBatchDeliveryQuantities, setTempBatchDeliveryQuantities] = useState<Record<string, string>>({});
  const [tempAutoSelectedBatches, setTempAutoSelectedBatches] = useState<Record<string, boolean>>({});
  const [showZeroAvailabilityItems, setShowZeroAvailabilityItems] = useState(false);
  const [successDialogMessage, setSuccessDialogMessage] = useState<string | null>(null);
  const [saveElapsedSeconds, setSaveElapsedSeconds] = useState(0);
  const saveTimerRef = useRef<number | null>(null);
  const [autoSelectedBatches, setAutoSelectedBatches] = useState<Record<string, boolean>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [originalGroupBy, setOriginalGroupBy] = useState<'customer' | 'stockItem'>('customer');
  const [sectionVisibility, setSectionVisibility] = useState<{
    outstanding: boolean;
    cleared: boolean;
    negativePending: boolean;
  }>(() => {
    // Always use defaults on initial load - cleared orders should be off by default
    return {
      outstanding: true,
      cleared: false,
      negativePending: true,
    };
  });
  // Temporary state for config modal (changes only applied on save)
  const [tempSectionVisibility, setTempSectionVisibility] = useState<{
    outstanding: boolean;
    cleared: boolean;
    negativePending: boolean;
  }>(sectionVisibility);
  const [filters, setFilters] = useState({...INITIAL_FILTERS});
  const hasActiveFilters = useMemo(() => {
    return Boolean(
      filters.customer ||
        filters.stockItem ||
        filters.date ||
        filters.orderNo ||
        filters.orderQty ||
        filters.pendingQty ||
        filters.rate ||
        filters.value ||
        filters.dueDate,
    );
  }, [filters]);
  type SortField = 'date' | 'orderNo' | 'stockItem' | 'customer' | 'orderQty' | 'pendingQty' | 'rate' | 'value' | 'pendingValue' | 'dueDate';
  const [sortConfig, setSortConfig] = useState<{field: SortField; direction: 'asc' | 'desc'} | null>(null);
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary');
  const [groupBy, setGroupBy] = useState<'customer' | 'stockItem'>('customer');
  const [ageingBuckets, setAgeingBuckets] = useState<number[]>(() => {
    const saved = localStorage.getItem('companyOrdersAgeingBuckets');
    return saved ? JSON.parse(saved) : [0, 7, 15, 30, 60];
  });
  const [tempAgeingBuckets, setTempAgeingBuckets] = useState<number[]>([0, 7, 15, 30, 60]);
  const [batchXmlFormat, setBatchXmlFormat] = useState<'single' | 'separate'>(() => {
    const saved = localStorage.getItem('companyOrdersBatchXmlFormat');
    return saved === 'separate' ? 'separate' : 'single'; // Default to 'single'
  });
  const [tempBatchXmlFormat, setTempBatchXmlFormat] = useState<'single' | 'separate'>('single');
  const [allowNegativeStock, setAllowNegativeStock] = useState<boolean>(() => {
    const saved = localStorage.getItem('companyOrdersAllowNegativeStock');
    return saved === 'true';
  });
  const [tempAllowNegativeStock, setTempAllowNegativeStock] = useState<boolean>(allowNegativeStock);
  const [allowDeliveryExceedOrder, setAllowDeliveryExceedOrder] = useState<boolean>(() => {
    const saved = localStorage.getItem('companyOrdersAllowDeliveryExceedOrder');
    return saved === 'true';
  });
  const [tempAllowDeliveryExceedOrder, setTempAllowDeliveryExceedOrder] = useState<boolean>(allowDeliveryExceedOrder);
  const [configModalTab, setConfigModalTab] = useState<'sections' | 'controls'>('sections');

  const handleSort = (field: SortField) => {
    setSortConfig((prev) => {
      if (prev?.field === field) {
        if (prev.direction === 'asc') {
          return {field, direction: 'desc'};
        }
        return null;
      }
      return {field, direction: 'asc'};
    });
  };

  const getSortIndicator = (field: SortField): string => {
    if (sortConfig?.field !== field) return '↕';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const renderSortableHeader = (label: string, field: SortField, subLabel?: string) => (
    <button
      type="button"
      className={`sortable-header ${sortConfig?.field === field ? sortConfig.direction : ''}`}
      onClick={() => handleSort(field)}
    >
      <span>{label}</span>
      {subLabel && <span className="cell-subtext">{subLabel}</span>}
      <span className="sort-indicator">{getSortIndicator(field)}</span>
    </button>
  );

  const loadOrders = async (includeClearedOverride?: boolean) => {
    if (!company) return;
    setLoading(true);
    setError(null);
    try {
      // Use DLOrdAll if cleared orders are enabled, otherwise use DLOrdPending
      // Use override if provided, otherwise use current sectionVisibility.cleared
      const includeCleared = includeClearedOverride !== undefined 
        ? includeClearedOverride 
        : sectionVisibility.cleared;
      const companyName = company.company || company.conn_name;
      const data = await apiService.getCompanyOrders(
        company.tallyloc_id,
        companyName,
        company.guid,
        includeCleared,
      );
      setOrders(data);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load orders';
      setError(errorMessage);
      
      // Check if token expired
      if (errorMessage.includes('Session expired') || errorMessage.includes('token')) {
        if (onLogout) {
          alert('Session expired. Please login again.');
          onLogout();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.tallyloc_id, company?.guid, company?.company, company?.conn_name]);

  useEffect(() => {
    if (saving) {
      if (saveTimerRef.current !== null) {
        window.clearInterval(saveTimerRef.current);
      }
      setSaveElapsedSeconds(0);
      saveTimerRef.current = window.setInterval(() => {
        setSaveElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (saveTimerRef.current !== null) {
        window.clearInterval(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      setSaveElapsedSeconds(0);
    }

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearInterval(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [saving]);



  // Automatically set groupBy to 'stockItem' when a customer is selected and summary view is active
  useEffect(() => {
    if (viewMode === 'summary' && selectedCustomer && selectedCustomer !== 'all') {
      setGroupBy('stockItem');
    } else if (viewMode === 'summary' && (!selectedCustomer || selectedCustomer === 'all')) {
      setGroupBy(originalGroupBy);
    }
  }, [viewMode, selectedCustomer, originalGroupBy]);

  // Helper function to get unique key for an order
  const getOrderKey = (order: CompanyOrder): string => {
    return `${order.OrderNo || ''}-${order.StockItem || ''}-${order.Date || ''}`;
  };

  const buildBatchKey = (orderKey: string, godown: string, batchname: string): string => {
    return `${orderKey}::${godown || ''}::${batchname || ''}`;
  };

  // Helper function to check if order should show Qty button (if IsGodownOn or IsBatchesOn is "Yes")
  const shouldShowQtyButton = (order: CompanyOrder): boolean => {
    // Handle various formats: "Yes"/"No", "1"/"0", 1/0, true/false
    const normalizeValue = (value: string | undefined | null): boolean => {
      if (!value) return false;
      const str = String(value).trim().toLowerCase();
      return str === 'yes' || str === '1' || str === 'true' || parseFloat(str) === 1;
    };
    
    const isGodownOn = normalizeValue(order.IsGodownOn);
    const isBatchesOn = normalizeValue(order.IsBatchesOn);
    const result = isGodownOn || isBatchesOn;
    
    
    return result;
  };

  // Handle delivery quantity change
  const handleDeliveryQtyChange = (order: CompanyOrder, value: string) => {
    const key = getOrderKey(order);
    setDeliveryQuantities((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Handle batch delivery quantity change
  const handleBatchDeliveryQtyChange = (orderKey: string, godown: string, batchname: string, value: string, maxQty: number, order: CompanyOrder) => {
    const batchKey = buildBatchKey(orderKey, godown, batchname);
    
    // Validate: only allow numeric input
    if (value && !/^\d*\.?\d*$/.test(value)) {
      return; // Reject non-numeric input
    }
    
    let numericValue = parseFloat(value);
    
    // First check: don't exceed available balance per batch (unless negative stock is allowed)
    if (!allowNegativeStock && !isNaN(numericValue) && numericValue > maxQty) {
      numericValue = maxQty;
      value = maxQty.toString();
    }
    
    // Second check: don't exceed order's pending quantity (unless allowed)
    if (!allowDeliveryExceedOrder && !isNaN(numericValue) && order.PendingQty) {
      const pendingQtyMatch = order.PendingQty.match(/(-?\d+(?:\.\d+)?)/);
      if (pendingQtyMatch) {
        const orderPendingQty = parseFloat(pendingQtyMatch[1]);
        
        // Calculate total delivery qty excluding current batch
        const batchEntries = order.StockItem ? itemBatchBalances[order.StockItem] : undefined;
        let totalOtherBatches = 0;
        if (batchEntries) {
          batchEntries.forEach((entry) => {
            const otherBatchKey = buildBatchKey(orderKey, entry.godown || '', entry.Batchname || '');
            if (otherBatchKey !== batchKey) {
              const qtyStr = batchDeliveryQuantities[otherBatchKey]?.trim() || '';
              const qty = parseFloat(qtyStr);
              if (!isNaN(qty) && qty > 0) {
                totalOtherBatches += qty;
              }
            }
          });
        }
        
        // Check if total would exceed pending qty
        const maxAllowedForThisBatch = orderPendingQty - totalOtherBatches;
        if (maxAllowedForThisBatch < 0) {
          return; // Already exceeded, don't allow any more
        }
        
        if (numericValue > maxAllowedForThisBatch) {
          numericValue = maxAllowedForThisBatch;
          value = Math.max(0, maxAllowedForThisBatch).toFixed(2);
        }
      }
    }
    
    setAutoSelectedBatches((prev) => {
      if (!prev[batchKey]) return prev;
      const next = {...prev};
      delete next[batchKey];
      return next;
    });
    setBatchDeliveryQuantities((prev) => ({
      ...prev,
      [batchKey]: value,
    }));
  };

  const handleBatchAutoSelectToggle = (
    order: CompanyOrder,
    targetBatchKey: string,
    isChecked: boolean,
    batchesInfo: Array<{entry: ItemBatchInfo; availableBalance: number; batchKey: string}>,
  ) => {
    setAutoSelectedBatches((prev) => {
      const nextSelections = {...prev};
      if (isChecked) {
        nextSelections[targetBatchKey] = true;
      } else {
        delete nextSelections[targetBatchKey];
      }
      setBatchDeliveryQuantities((prevQuantities) =>
        computeAutoSelectionQuantities(order, nextSelections, batchesInfo, prevQuantities),
      );
      return nextSelections;
    });
  };

  // Distribute pending qty across batches sequentially (consume full balance of each batch until pending qty is filled)
  const distributePendingQtyAcrossBatches = (order: CompanyOrder, batchEntries?: Array<ItemBatchInfo>) => {
    const orderKey = getOrderKey(order);
    // Use provided batchEntries or fall back to state
    const entries = batchEntries || (order.StockItem ? itemBatchBalances[order.StockItem] : undefined);
    
    if (!entries || entries.length === 0) return;
    
    // Parse pending qty from order
    const pendingQty = parseNumericValue(order.PendingQty);
    if (pendingQty <= 0) return;
    
    // Parse closing balances for each batch and subtract allocations from other orders
    const orderLocation = order.Location?.trim() || '';
    const orderBatch = order.Batch?.trim() || '';
    const filteredEntries = entries.filter((entry) => {
      const entryLocation = entry.godown?.trim() || '';
      const entryBatch = entry.Batchname?.trim() || '';
      if (orderLocation && entryLocation !== orderLocation) return false;
      if (orderBatch && entryBatch !== orderBatch) return false;
      return true;
    });

    const batchesWithBalances = filteredEntries
      .map((entry) => {
        const totalBalance = parseNumericValue(entry.CLOSINGBALANCE);
        const allocatedElsewhere = getAllocatedQtyForBatch(
          order.StockItem,
          entry.godown || '',
          entry.Batchname || '',
          orderKey,
        );
        const batchKey = buildBatchKey(orderKey, entry.godown || '', entry.Batchname || '');
        const currentAllocated = batchDeliveryQuantities[batchKey]
          ? parseFloat(batchDeliveryQuantities[batchKey])
          : 0;
        const remainingBalance = Math.max(totalBalance - allocatedElsewhere, 0);
        const availableForThisOrder = Math.max(remainingBalance + (Number.isNaN(currentAllocated) ? 0 : currentAllocated), 0);
        return {
          entry,
          balance: availableForThisOrder,
        };
      })
      .filter((b) => b.balance > 0);
    
    if (batchesWithBalances.length === 0) return;
    
    // Sequentially consume batches until pending qty is filled
    const distributedQuantities: Record<string, string> = {};
    let remainingPendingQty = pendingQty;
    
    for (const { entry, balance } of batchesWithBalances) {
      if (remainingPendingQty <= 0) {
        // No more pending qty to distribute
        const batchKey = buildBatchKey(orderKey, entry.godown || '', entry.Batchname || '');
        distributedQuantities[batchKey] = '0';
        continue;
      }
      
      const batchKey = buildBatchKey(orderKey, entry.godown || '', entry.Batchname || '');
      
      if (remainingPendingQty >= balance) {
        // Use full balance of this batch
        distributedQuantities[batchKey] = balance.toFixed(2);
        remainingPendingQty -= balance;
      } else {
        // Use only the remaining pending qty (partial batch)
        distributedQuantities[batchKey] = remainingPendingQty.toFixed(2);
        remainingPendingQty = 0;
      }
    }
    
    // Update batch delivery quantities
    setBatchDeliveryQuantities((prev) => ({
      ...prev,
      ...distributedQuantities,
    }));
  };

  // Load batch balances for a specific stock item
  const loadItemBatchBalances = async (stockItemName: string, forceRefresh: boolean = false): Promise<Array<ItemBatchInfo> | undefined> => {
    if (!company || !stockItemName) return undefined;
    
    // Check if we already have batch data for this item (unless forcing refresh)
    if (!forceRefresh && itemBatchBalances[stockItemName]) {
      return itemBatchBalances[stockItemName]; // Already loaded
    }
    
    setItemBatchLoading(true);
    setItemBatchError(null);
    
    try {
      const companyName = company.company || company.conn_name;
      const batchData = await apiService.getItemBatchBalances(
        company.tallyloc_id,
        companyName,
        company.guid,
        stockItemName,
      );
      
      // Update batch balances for this stock item
      setItemBatchBalances((prev) => ({
        ...prev,
        [stockItemName]: batchData,
      }));
      
      return batchData;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load batch balances';
      setItemBatchError(errorMessage);
      console.error('Error loading batch balances:', err);
      
      // Check if token expired
      if (errorMessage.includes('Session expired') || errorMessage.includes('token')) {
        if (onLogout) {
          alert('Session expired. Please login again.');
          onLogout();
        }
      }
      return undefined;
    } finally {
      setItemBatchLoading(false);
    }
  };

  // Open batch selection modal
  const orderHasBatchAllocations = useCallback(
    (orderKey: string): boolean => {
      const prefix = `${orderKey}::`;
      return Object.entries(batchDeliveryQuantities).some(([key, value]) => {
        if (!key.startsWith(prefix)) return false;
        const qty = parseFloat((value || '').trim());
        return !Number.isNaN(qty) && qty > 0;
      });
    },
    [batchDeliveryQuantities],
  );

  const handleOpenBatchSelection = async (order: CompanyOrder) => {
    if (!order.StockItem) {
      setItemBatchError('Stock item is missing');
      return;
    }
    
    // Store current state in temp before opening modal
    setTempBatchDeliveryQuantities({...batchDeliveryQuantities});
    setTempAutoSelectedBatches({...autoSelectedBatches});
    
    // Check available quantity - if 0, show message and don't make API call
    const availableQty = parseNumericValue(order.AvailableQty);
    if (availableQty === 0) {
      setSelectedOrderForBatch(order);
      setItemBatchError('Available qty: 0');
      setItemBatchLoading(false);
      setShowBatchSelectionModal(true);
      return;
    }
    
    const orderKey = getOrderKey(order);
    setSelectedOrderForBatch(order);
    setItemBatchError(null);
    
    // Always fetch fresh batch balances when clicking Qty button
    const batchData = await loadItemBatchBalances(order.StockItem, true);
    
    // Open modal after loading
    setShowBatchSelectionModal(true);
    
    // Automatically distribute pending qty only if this order has no existing allocations
    const shouldAutoDistribute = !orderHasBatchAllocations(orderKey);
    if (shouldAutoDistribute && batchData && batchData.length > 0) {
      distributePendingQtyAcrossBatches(order, batchData);
    }
  };

  // Close batch selection modal
  // Clear all batch allocations for current order
  const handleClearBatchAllocations = () => {
    if (!selectedOrderForBatch) return;
    
    const orderKey = getOrderKey(selectedOrderForBatch);
    const batchEntries = selectedOrderForBatch.StockItem ? itemBatchBalances[selectedOrderForBatch.StockItem] : undefined;
    
    if (batchEntries) {
      // Clear all batch delivery quantities for this order
      setBatchDeliveryQuantities((prev) => {
        const next = {...prev};
        batchEntries.forEach((entry) => {
          const batchKey = buildBatchKey(orderKey, entry.godown || '', entry.Batchname || '');
          delete next[batchKey];
        });
        return next;
      });
      
      // Clear all auto-selected batches for this order
      setAutoSelectedBatches((prev) => {
        const next = {...prev};
        batchEntries.forEach((entry) => {
          const batchKey = buildBatchKey(orderKey, entry.godown || '', entry.Batchname || '');
          delete next[batchKey];
        });
        return next;
      });
    }
  };
  
  // Save batch selection changes
  const handleSaveBatchSelection = () => {
    // Changes are already in the actual state, just close modal
    setShowBatchSelectionModal(false);
    setSelectedOrderForBatch(null);
    setItemBatchError(null);
  };
  
  // Close batch selection modal without saving (discard changes)
  const handleCloseBatchSelection = () => {
    // Restore original state from temp
    setBatchDeliveryQuantities({...tempBatchDeliveryQuantities});
    setAutoSelectedBatches({...tempAutoSelectedBatches});
    
    setShowBatchSelectionModal(false);
    setSelectedOrderForBatch(null);
    setItemBatchError(null);
  };

  // Get total delivery qty from batch quantities for an order
  const getTotalBatchDeliveryQty = (order: CompanyOrder): number => {
    const orderKey = getOrderKey(order);
    const batchEntries = order.StockItem ? itemBatchBalances[order.StockItem] : undefined;
    if (!batchEntries || batchEntries.length === 0) return 0;
    
    let total = 0;
    batchEntries.forEach((entry) => {
      const batchKey = buildBatchKey(orderKey, entry.godown || '', entry.Batchname || '');
      const qtyStr = batchDeliveryQuantities[batchKey]?.trim() || '';
      const qty = parseFloat(qtyStr);
      if (!isNaN(qty) && qty > 0) {
        total += qty;
      }
    });
    return total;
  };

  const getOrderDeliveryQty = useCallback((order: CompanyOrder): number => {
    if (!order) return 0;
    const showQtyButton = shouldShowQtyButton(order);
    if (showQtyButton) {
      return getTotalBatchDeliveryQty(order);
    }
    const orderKey = getOrderKey(order);
    const deliveryQtyStr = deliveryQuantities[orderKey]?.trim() || '';
    const deliveryQty = deliveryQtyStr ? parseFloat(deliveryQtyStr) : 0;
    return Number.isNaN(deliveryQty) ? 0 : deliveryQty;
  }, [deliveryQuantities, getTotalBatchDeliveryQty, shouldShowQtyButton]);

  // Calculate Julian day number for a date
  const getJulianDay = (date: Date): number => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // Convert to Julian day number (days since January 1, 1900)
    const a = Math.floor((14 - month) / 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;
    const jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
    
    // Tally uses days since January 1, 1900 (Julian day 2415021)
    const tallyBase = 2415021;
    return jdn - tallyBase;
  };

  // Format date to YYYYMMDD for Tally
  const formatDateYYYYMMDD = (dateStr: string): string => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIndexMap = monthNames.reduce<Record<string, number>>((acc, name, idx) => {
    acc[name.toLowerCase()] = idx;
    return acc;
  }, {});

  const formatDateObjectForTally = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = monthNames[date.getMonth()];
    const year = String(date.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  };

  const parseDateStringValue = (dateStr?: string | null): Date | null => {
    if (!dateStr) return null;
    const trimmed = dateStr.trim();
    if (/^\d{8}$/.test(trimmed)) {
      const year = parseInt(trimmed.substring(0, 4), 10);
      const month = parseInt(trimmed.substring(4, 6), 10) - 1;
      const day = parseInt(trimmed.substring(6, 8), 10);
      return new Date(year, month, day);
    }
    const match = trimmed.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
    if (match) {
      const day = parseInt(match[1], 10);
      const monthIdx = monthIndexMap[match[2].toLowerCase()];
      const yearNum = parseInt(match[3], 10);
      const year = yearNum < 100 ? 2000 + yearNum : yearNum;
      if (!Number.isNaN(monthIdx)) {
        return new Date(year, monthIdx, day);
      }
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  // Build delivery note XML (single voucher combining all orders)
  const buildDeliveryNoteXML = (
    ordersByOrderNo: Record<string, Array<{order: CompanyOrder; deliveryQty: number}>>,
    deliveryDateStr: string,
    companyName: string,
  ): string => {
    const flattenedItems: Array<{order: CompanyOrder; deliveryQty: number; orderNo: string}> = [];

    Object.entries(ordersByOrderNo).forEach(([orderNo, items]) => {
      items.forEach((item) => {
        if (item.deliveryQty > 0) {
          flattenedItems.push({
            order: item.order,
            deliveryQty: item.deliveryQty,
            orderNo,
          });
        }
      });
    });

    if (flattenedItems.length === 0) return '';

    const referenceText = Object.keys(ordersByOrderNo).join(', ');
    const customer = flattenedItems[0].order.Customer || '';
    const escapedCustomer = escapeForXML(customer);
    const formattedDate = formatDateYYYYMMDD(deliveryDateStr);

    let totalAmount = 0;
    const inventoryEntries: string[] = [];

    // Group items by StockItem and Rate when batchXmlFormat is 'single'
    if (batchXmlFormat === 'single') {
      // Group by StockItem AND Rate (to create separate entries for different rates)
      const itemsByStockItemAndRate = new Map<string, Array<{
        order: CompanyOrder;
        deliveryQty: number;
        orderNo: string;
        orderKey: string;
        rateValue: number;
        discountValue: number;
        rateForXML: string;
        dueDateObj: Date;
        orderDueDateFormatted: string;
        julianDay: number;
      }>>();

      flattenedItems.forEach((item) => {
        const stockItem = item.order.StockItem || '';
        if (!stockItem) return;

        const rateValue = parseNumericValue(item.order.Rate);
        const discountValue = parseNumericValue(item.order.Discount);
        const rateForXML = item.order.Rate || '';
        const orderKey = getOrderKey(item.order);
        const dueDateObj = parseDateStringValue(item.order.DueDate)
          ?? parseDateStringValue(item.order.Date)
          ?? new Date(deliveryDateStr);
        const orderDueDateFormatted = formatDateObjectForTally(dueDateObj);
        const julianDay = getJulianDay(dueDateObj);

        // Create key combining StockItem, Rate, and Discount to group by rate
        const rateKey = `${stockItem}||${rateForXML}||${discountValue}`;

        if (!itemsByStockItemAndRate.has(rateKey)) {
          itemsByStockItemAndRate.set(rateKey, []);
        }
        itemsByStockItemAndRate.get(rateKey)!.push({
          order: item.order,
          deliveryQty: item.deliveryQty,
          orderNo: item.orderNo,
          orderKey,
          rateValue,
          discountValue,
          rateForXML,
          dueDateObj,
          orderDueDateFormatted,
          julianDay,
        });
      });

      // Process each StockItem+Rate group (each group gets its own ALLINVENTORYENTRIES.LIST)
      itemsByStockItemAndRate.forEach((items, rateKey) => {
        const [stockItem] = rateKey.split('||');
        const escapedStockItem = escapeForXML(stockItem);
        const firstItem = items[0];
        const rateForXML = firstItem.rateForXML;
        const showQtyButton = shouldShowQtyButton(firstItem.order);
        const batchEntries = itemBatchBalances[stockItem];

        if (showQtyButton && batchEntries && batchEntries.length > 0) {
          // Collect all batch allocations from all orders for this item+rate combination
          const allBatchAllocations: string[] = [];
          let totalDeliveryQty = 0;
          let totalAmountForItem = 0;

          items.forEach((item) => {
            const batchesWithQty: Array<{entry: ItemBatchInfo; qty: number; qtyStr: string; amount: number}> = [];
            batchEntries.forEach((entry) => {
              const batchKey = buildBatchKey(item.orderKey, entry.godown || '', entry.Batchname || '');
              const batchDeliveryQtyStr = batchDeliveryQuantities[batchKey]?.trim() || '';
              const batchDeliveryQty = parseFloat(batchDeliveryQtyStr);
              if (!isNaN(batchDeliveryQty) && batchDeliveryQty > 0) {
                const batchAmount = batchDeliveryQty * (item.rateValue * (100 - item.discountValue)) / 100;
                batchesWithQty.push({
                  entry,
                  qty: batchDeliveryQty,
                  qtyStr: ` ${batchDeliveryQty}`,
                  amount: batchAmount,
                });
              }
            });

            batchesWithQty.forEach((batch) => {
              const godownName = escapeForXML(batch.entry.godown || item.order.Location || 'Main Location');
              const batchName = escapeForXML(batch.entry.Batchname || 'Primary Batch');
              allBatchAllocations.push(`       <BATCHALLOCATIONS.LIST>
        <GODOWNNAME>${godownName}</GODOWNNAME>
        <BATCHNAME>${batchName}</BATCHNAME>
        <ORDERNO>${escapeForXML(item.orderNo)}</ORDERNO>
        <TRACKINGNUMBER>${escapeForXML(item.orderNo)}</TRACKINGNUMBER>
        <AMOUNT>${batch.amount.toFixed(2)}</AMOUNT>
        <ACTUALQTY>${batch.qtyStr}</ACTUALQTY>
        <BILLEDQTY>${batch.qtyStr}</BILLEDQTY>
        <ORDERDUEDATE JD="${item.julianDay}" P="${item.orderDueDateFormatted}">${item.orderDueDateFormatted}</ORDERDUEDATE>
       </BATCHALLOCATIONS.LIST>`);
              totalDeliveryQty += batch.qty;
              totalAmountForItem += batch.amount;
            });
          });

          if (allBatchAllocations.length > 0) {
            const totalDeliveryQtyStr = ` ${totalDeliveryQty}`;
            inventoryEntries.push(`      <ALLINVENTORYENTRIES.LIST>
       <STOCKITEMNAME>${escapedStockItem}</STOCKITEMNAME>
       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
       ${rateForXML ? `<RATE>${escapeForXML(rateForXML)}</RATE>` : ''}
       <AMOUNT>${totalAmountForItem.toFixed(2)}</AMOUNT>
       <ACTUALQTY>${totalDeliveryQtyStr}</ACTUALQTY>
       <BILLEDQTY>${totalDeliveryQtyStr}</BILLEDQTY>
${allBatchAllocations.join('\n')}
      </ALLINVENTORYENTRIES.LIST>`);
            totalAmount += totalAmountForItem;
          }
        } else {
          // Non-batch items: group by StockItem+Rate and sum quantities
          let totalDeliveryQty = 0;
          let totalAmountForItem = 0;
          const allBatchAllocations: string[] = [];

          items.forEach((item) => {
            const amount = item.deliveryQty * (item.rateValue * (100 - item.discountValue)) / 100;
            totalDeliveryQty += item.deliveryQty;
            totalAmountForItem += amount;

            const deliveryQtyStr = ` ${item.deliveryQty}`;
            const godownName = escapeForXML(item.order.Location || 'Main Location');
            const batchName = escapeForXML(item.order.Batch || 'Primary Batch');
            allBatchAllocations.push(`       <BATCHALLOCATIONS.LIST>
        <GODOWNNAME>${godownName}</GODOWNNAME>
        <BATCHNAME>${batchName}</BATCHNAME>
        <ORDERNO>${escapeForXML(item.orderNo)}</ORDERNO>
        <TRACKINGNUMBER>${escapeForXML(item.orderNo)}</TRACKINGNUMBER>
        <AMOUNT>${amount.toFixed(2)}</AMOUNT>
        <ACTUALQTY>${deliveryQtyStr}</ACTUALQTY>
        <BILLEDQTY>${deliveryQtyStr}</BILLEDQTY>
        <ORDERDUEDATE JD="${item.julianDay}" P="${item.orderDueDateFormatted}">${item.orderDueDateFormatted}</ORDERDUEDATE>
       </BATCHALLOCATIONS.LIST>`);
          });

          if (totalDeliveryQty > 0) {
            const totalDeliveryQtyStr = ` ${totalDeliveryQty}`;
            inventoryEntries.push(`      <ALLINVENTORYENTRIES.LIST>
       <STOCKITEMNAME>${escapedStockItem}</STOCKITEMNAME>
       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
       ${rateForXML ? `<RATE>${escapeForXML(rateForXML)}</RATE>` : ''}
       <AMOUNT>${totalAmountForItem.toFixed(2)}</AMOUNT>
       <ACTUALQTY>${totalDeliveryQtyStr}</ACTUALQTY>
       <BILLEDQTY>${totalDeliveryQtyStr}</BILLEDQTY>
${allBatchAllocations.join('\n')}
      </ALLINVENTORYENTRIES.LIST>`);
            totalAmount += totalAmountForItem;
          }
        }
      });
    } else {
      // Original logic for multiple entries format
      flattenedItems.forEach((item) => {
        const escapedStockItem = escapeForXML(item.order.StockItem || '');
        const currentOrderNo = item.orderNo;
        
        // Extract rate and calculate amount
        const rateValue = parseNumericValue(item.order.Rate);
        const discountValue = parseNumericValue(item.order.Discount);
        // Rate format: keep original format if it includes unit (e.g., "210.00/Nos"), otherwise use numeric value
        const rateForXML = item.order.Rate || '';
        // Calculate amount: deliveryQty * rate * (100 - discount) / 100
        const amount = item.deliveryQty * (rateValue * (100 - discountValue)) / 100;
        
        const showQtyButton = shouldShowQtyButton(item.order);
        const batchEntries = item.order.StockItem ? itemBatchBalances[item.order.StockItem] : undefined;
        const orderKey = getOrderKey(item.order);
        const dueDateObj = parseDateStringValue(item.order.DueDate)
          ?? parseDateStringValue(item.order.Date)
          ?? new Date(deliveryDateStr);
        const orderDueDateFormatted = formatDateObjectForTally(dueDateObj);
        const julianDay = getJulianDay(dueDateObj);

        if (showQtyButton && batchEntries && batchEntries.length > 0) {
          const batchesWithQty: Array<{entry: ItemBatchInfo; qty: number; qtyStr: string; amount: number}> = [];
          batchEntries.forEach((entry) => {
            const batchKey = buildBatchKey(orderKey, entry.godown || '', entry.Batchname || '');
            const batchDeliveryQtyStr = batchDeliveryQuantities[batchKey]?.trim() || '';
            const batchDeliveryQty = parseFloat(batchDeliveryQtyStr);
            if (!isNaN(batchDeliveryQty) && batchDeliveryQty > 0) {
              // Calculate amount for this batch: batchQty * rate * (100 - discount) / 100
              const batchAmount = batchDeliveryQty * (rateValue * (100 - discountValue)) / 100;
              batchesWithQty.push({
                entry,
                qty: batchDeliveryQty,
                qtyStr: ` ${batchDeliveryQty}`,
                amount: batchAmount,
              });
            }
          });

          if (batchesWithQty.length === 0) return;

          batchesWithQty.forEach((batch) => {
            const deliveryQtyStr = batch.qtyStr;
            const godownName = escapeForXML(batch.entry.godown || item.order.Location || 'Main Location');
            const batchName = escapeForXML(batch.entry.Batchname || 'Primary Batch');

            inventoryEntries.push(`      <ALLINVENTORYENTRIES.LIST>
       <STOCKITEMNAME>${escapedStockItem}</STOCKITEMNAME>
       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
       ${rateForXML ? `<RATE>${escapeForXML(rateForXML)}</RATE>` : ''}
       <AMOUNT>${batch.amount.toFixed(2)}</AMOUNT>
       <ACTUALQTY>${deliveryQtyStr}</ACTUALQTY>
       <BILLEDQTY>${deliveryQtyStr}</BILLEDQTY>
       <BATCHALLOCATIONS.LIST>
        <GODOWNNAME>${godownName}</GODOWNNAME>
        <BATCHNAME>${batchName}</BATCHNAME>
        <ORDERNO>${escapeForXML(currentOrderNo)}</ORDERNO>
        <TRACKINGNUMBER>${escapeForXML(currentOrderNo)}</TRACKINGNUMBER>
        <AMOUNT>${batch.amount.toFixed(2)}</AMOUNT>
        <ACTUALQTY>${deliveryQtyStr}</ACTUALQTY>
        <BILLEDQTY>${deliveryQtyStr}</BILLEDQTY>
        <ORDERDUEDATE JD="${julianDay}" P="${orderDueDateFormatted}">${orderDueDateFormatted}</ORDERDUEDATE>
       </BATCHALLOCATIONS.LIST>
      </ALLINVENTORYENTRIES.LIST>`);
            totalAmount += batch.amount;
          });
        } else {
          const deliveryQtyStr = ` ${item.deliveryQty}`;
          const godownName = escapeForXML(item.order.Location || 'Main Location');
          const batchName = escapeForXML(item.order.Batch || 'Primary Batch');

          inventoryEntries.push(`      <ALLINVENTORYENTRIES.LIST>
       <STOCKITEMNAME>${escapedStockItem}</STOCKITEMNAME>
       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
       ${rateForXML ? `<RATE>${escapeForXML(rateForXML)}</RATE>` : ''}
       <AMOUNT>${amount.toFixed(2)}</AMOUNT>
       <ACTUALQTY>${deliveryQtyStr}</ACTUALQTY>
       <BILLEDQTY>${deliveryQtyStr}</BILLEDQTY>
       <BATCHALLOCATIONS.LIST>
        <GODOWNNAME>${godownName}</GODOWNNAME>
        <BATCHNAME>${batchName}</BATCHNAME>
        <ORDERNO>${escapeForXML(currentOrderNo)}</ORDERNO>
        <TRACKINGNUMBER>${escapeForXML(currentOrderNo)}</TRACKINGNUMBER>
        <AMOUNT>${amount.toFixed(2)}</AMOUNT>
        <ACTUALQTY>${deliveryQtyStr}</ACTUALQTY>
        <BILLEDQTY>${deliveryQtyStr}</BILLEDQTY>
        <ORDERDUEDATE JD="${julianDay}" P="${orderDueDateFormatted}">${orderDueDateFormatted}</ORDERDUEDATE>
       </BATCHALLOCATIONS.LIST>
      </ALLINVENTORYENTRIES.LIST>`);
          totalAmount += amount;
        }
      });
    }

    const inventoryEntriesStr = inventoryEntries.join('\n');
    const ledgerAmount = -totalAmount;

    return `<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Import Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>Vouchers</REPORTNAME>
    <STATICVARIABLES>
     <SVCURRENTCOMPANY>${escapeForXML(companyName)}</SVCURRENTCOMPANY>
    </STATICVARIABLES>
   </REQUESTDESC>
   <REQUESTDATA>
    <TALLYMESSAGE>
     <VOUCHER>
      <DATE>${formattedDate}</DATE>
      <VOUCHERTYPENAME>Delivery Note</VOUCHERTYPENAME>
      <PARTYNAME>${escapedCustomer}</PARTYNAME>
      <PARTYLEDGERNAME>${escapedCustomer}</PARTYLEDGERNAME>
      <BASICBUYERNAME>${escapedCustomer}</BASICBUYERNAME>
      <REFERENCE>${escapeForXML(referenceText)}</REFERENCE>
${inventoryEntriesStr}
      <LEDGERENTRIES.LIST>
       <LEDGERNAME>${escapedCustomer}</LEDGERNAME>
       <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
       <AMOUNT>${ledgerAmount.toFixed(2)}</AMOUNT>
      </LEDGERENTRIES.LIST>
     </VOUCHER>
    </TALLYMESSAGE>
   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>`;
  };

  // Validate and save delivery notes
  const handleSaveDelivery = async () => {
    if (!deliveryDate) {
      setSaveError('Please select a delivery date');
      return;
    }

    if (!selectedCustomer || selectedCustomer === 'all') {
      setSaveError('Please select a customer');
      return;
    }

    // Get orders for selected customer only
    const customerOrders = filteredOrders.filter(order => order.Customer === selectedCustomer);

    // Group orders by OrderNo
    const ordersByOrderNo: Record<string, Array<{order: CompanyOrder; deliveryQty: number}>> = {};
    const validationErrors: string[] = [];
    
    customerOrders.forEach((order) => {
      const key = getOrderKey(order);
      
      // Check if order should use batch quantities (if IsGodownOn or IsBatchesOn is "Yes")
      const showQtyButton = shouldShowQtyButton(order);
      let deliveryQty = 0;
      let deliveryQtyStr = '';
      
      if (showQtyButton) {
        // Use batch quantities
        deliveryQty = getTotalBatchDeliveryQty(order);
        if (deliveryQty <= 0) return; // Skip orders without batch delivery quantity
      } else {
        // Use regular delivery qty
        deliveryQtyStr = deliveryQuantities[key]?.trim() || '';
        if (!deliveryQtyStr) return; // Skip orders without delivery quantity
        
        deliveryQty = parseFloat(deliveryQtyStr);
        if (isNaN(deliveryQty) || deliveryQty <= 0) {
          validationErrors.push(`Invalid delivery quantity for order ${order.OrderNo}, item ${order.StockItem}`);
          return;
        }
      }
      
      const pendingQty = parseNumericValue(order.PendingQty);
      if (!allowDeliveryExceedOrder) {
        if (pendingQty <= 0) {
          validationErrors.push(`Invalid pending quantity for order ${order.OrderNo}, item ${order.StockItem}`);
          return;
        }
        
        // Validate delivery qty <= pending qty
        if (deliveryQty > pendingQty) {
          validationErrors.push(`Delivery quantity (${deliveryQty}) cannot exceed pending quantity (${pendingQty}) for order ${order.OrderNo}, item ${order.StockItem}`);
          return;
        }
      }
      
      const orderNo = order.OrderNo || '';
      if (!orderNo) {
        validationErrors.push(`Order number is missing for item: ${order.StockItem}`);
        return;
      }
      
      if (!ordersByOrderNo[orderNo]) {
        ordersByOrderNo[orderNo] = [];
      }
      
      ordersByOrderNo[orderNo].push({order, deliveryQty});
    });

    if (validationErrors.length > 0) {
      setSaveError(validationErrors.join('\n'));
      return;
    }

    if (Object.keys(ordersByOrderNo).length === 0) {
      setSaveError('No valid delivery quantities entered. Please enter delivery quantities for at least one order.');
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      // Refresh orders from Tally to get latest quantities before posting
      // Call API directly to get fresh data for validation
      const refreshedOrders = await apiService.getCompanyOrders(
        company.tallyloc_id,
        company.company || company.conn_name,
        company.guid,
        sectionVisibility.cleared, // Use same config as main load
      );
      
      // Get refreshed orders for the selected customer
      const refreshedCustomerOrders = refreshedOrders.filter(order => order.Customer === selectedCustomer);
      
      // Helper to extract numeric value from quantity strings (e.g., "10 Nos")
      const parseQuantity = (qty?: string | null): number | null => {
        if (!qty) return null;
        const match = qty.match(/(-?\d+(?:\.\d+)?)/);
        if (!match) return null;
        const value = parseFloat(match[1]);
        return Number.isNaN(value) ? null : value;
      };

      // Validate delivery qty against latest pending qty and available qty from Tally
      let validationErrorType: 'pending' | 'available' | null = null;
      refreshedCustomerOrders.forEach((order) => {
        const orderKey = getOrderKey(order);
        
        // Check if order should use batch quantities (if IsGodownOn or IsBatchesOn is "Yes")
        const showQtyButton = shouldShowQtyButton(order);
        let deliveryQty = 0;
        
        if (showQtyButton) {
          // Use batch quantities
          deliveryQty = getTotalBatchDeliveryQty(order);
        } else {
          // Use regular delivery qty
          const deliveryQtyStr = deliveryQuantities[orderKey]?.trim();
          if (!deliveryQtyStr) return; // Skip orders without delivery quantity
          
          deliveryQty = parseFloat(deliveryQtyStr);
          if (isNaN(deliveryQty) || deliveryQty <= 0) return; // Skip invalid quantities
        }
        
        if (deliveryQty <= 0) return; // Skip if no delivery qty
        
        // Validate against pending qty
        const pendingQtyValue = parseQuantity(order.PendingQty);
        if (!allowDeliveryExceedOrder && pendingQtyValue !== null && deliveryQty > pendingQtyValue) {
          validationErrorType = 'pending';
          return; // Skip further checks if pending qty validation fails
        }
        
        // Validate against available qty
        const availableQtyValue = parseQuantity(order.AvailableQty);
        if (!allowNegativeStock && availableQtyValue !== null && deliveryQty > availableQtyValue) {
          validationErrorType = 'available';
        }
      });
      
      if (validationErrorType) {
        // Refresh the screen with fresh data from Tally
        await loadOrders();
        const errorMessage = validationErrorType === 'pending' 
          ? 'Delivery qty exceeds Pending Qty'
          : 'Delivery qty exceeds Available Qty';
        setSaveError(errorMessage);
        setSaving(false);
        return;
      }
      
      const companyName = company.company || company.conn_name;
      const deliveryXml = buildDeliveryNoteXML(ordersByOrderNo, deliveryDate, companyName);
      if (!deliveryXml) {
        setSaveError('No valid delivery lines to save');
        setSaving(false);
        return;
      }

      console.log('[Delivery] Sending delivery note to Tally', {
        tallyloc_id: company.tallyloc_id,
        company: companyName,
        customer: selectedCustomer,
        deliveryDate,
        ordersCount: Object.keys(ordersByOrderNo).length,
        xmlPayload: deliveryXml,
      });

      const tallyResponse = await apiService.getReceivablesData(
        company.tallyloc_id,
        company.company || company.conn_name,
        company.guid,
        deliveryXml,
      );

      console.log('[Delivery] Tally response received', tallyResponse);

      let tallyError: string | null = null;
      if (typeof tallyResponse === 'string') {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(tallyResponse, 'text/xml');
        
        // Check for ERRORS element first - only treat as error if value > 0
        const errorsElement = xmlDoc.querySelector('ERRORS');
        if (errorsElement) {
          const errorsValue = parseInt(errorsElement.textContent || '0', 10);
          if (!Number.isNaN(errorsValue) && errorsValue > 0) {
            tallyError = `Tally reported ${errorsValue} error(s)`;
          }
        }
        
        // Check for various error elements in Tally response (only if no ERRORS > 0)
        if (!tallyError) {
          const lineError = xmlDoc.querySelector('LINEERROR');
          const exceptions = xmlDoc.querySelector('EXCEPTIONS');
          const errorMsg = xmlDoc.querySelector('ERRORMSG');
          const error = xmlDoc.querySelector('ERROR');
          
          // Also check for errors in the body
          const bodyErrors = xmlDoc.querySelectorAll('BODY ERROR, BODY LINEERROR, BODY EXCEPTIONS, BODY ERRORMSG');
          
          if (lineError) {
            tallyError = lineError.textContent || 'Unknown Tally error';
          } else if (errorMsg) {
            tallyError = errorMsg.textContent || 'Unknown Tally error';
          } else if (error) {
            tallyError = error.textContent || 'Unknown Tally error';
          } else if (exceptions) {
            const exceptionValue = parseInt(exceptions.textContent || '0', 10);
            if (!Number.isNaN(exceptionValue) && exceptionValue > 0) {
              tallyError = exceptions.textContent || 'Tally exception occurred';
            }
          } else if (bodyErrors.length > 0) {
            // Check all error elements found in body
            bodyErrors.forEach((errEl) => {
              const errorText = errEl.textContent?.trim();
              // Only treat as error if it's not a numeric value of 0
              if (errorText && errorText.length > 0) {
                const numValue = parseInt(errorText, 10);
                if (Number.isNaN(numValue) || numValue > 0) {
                  tallyError = errorText;
                }
              }
            });
          }
        }
        
        // If no specific error element found, check if response contains error-like text
        // But avoid matching XML tags like <ERRORS>0</ERRORS>
        if (!tallyError) {
          // Try to extract error messages from common patterns
          // Avoid matching XML tags - look for actual error messages
          const errorPatterns = [
            /Ledger\s+['"]([^'"]+)['"]\s+does not exist[^<]*/i,
            /<LINEERROR[^>]*>([^<]+)<\/LINEERROR>/i,
            /<ERRORMSG[^>]*>([^<]+)<\/ERRORMSG>/i,
            /<ERROR[^>]*>([^<]+)<\/ERROR>/i,
            // Only match "does not exist" if it's not part of an XML tag
            /(?:^|[^<])does not exist[^<]*/i,
          ];
          
          for (const pattern of errorPatterns) {
            const match = tallyResponse.match(pattern);
            if (match) {
              // Extract the error message (group 1 if available, otherwise full match)
              const errorText = (match[1] || match[0]).trim();
              // Make sure it's not just an XML tag
              if (!errorText.startsWith('<') && !errorText.endsWith('>')) {
                tallyError = errorText;
                break;
              }
            }
          }
        }
        
        // If still no error found, check if response indicates success
        if (!tallyError) {
          const errorsValue = errorsElement ? parseInt(errorsElement.textContent || '0', 10) : null;
          const exceptionsElement = xmlDoc.querySelector('EXCEPTIONS');
          const exceptionsValue = exceptionsElement ? parseInt(exceptionsElement.textContent || '0', 10) : null;
          
        }
      }

      if (tallyError) {
        setSaveError(tallyError);
      } else {
        // Check for CREATED, ALTERED, DELETED to show appropriate success message
        let successMessage = 'Delivery posted successfully.';
        if (typeof tallyResponse === 'string') {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(tallyResponse, 'text/xml');
          
          const createdElement = xmlDoc.querySelector('CREATED');
          const alteredElement = xmlDoc.querySelector('ALTERED');
          const deletedElement = xmlDoc.querySelector('DELETED');
          
          const createdValue = createdElement ? parseInt(createdElement.textContent || '0', 10) : 0;
          const alteredValue = alteredElement ? parseInt(alteredElement.textContent || '0', 10) : 0;
          const deletedValue = deletedElement ? parseInt(deletedElement.textContent || '0', 10) : 0;
          
          const messages: string[] = [];
          
          if (createdValue > 0) {
            messages.push(`${createdValue} delivery note(s) created`);
          }
          if (alteredValue > 0) {
            messages.push(`${alteredValue} delivery note(s) altered`);
          }
          if (deletedValue > 0) {
            messages.push(`${deletedValue} delivery note(s) deleted`);
          }
          
          if (messages.length > 0) {
            successMessage = messages.join(', ') + '.';
          }
          
        }
        
        setDeliveryQuantities({});
        setBatchDeliveryQuantities({});
        closeDeliveryModal();
        setSuccessDialogMessage(successMessage);
        loadOrders().catch((loadErr) => {
          console.error('Failed to refresh orders after delivery post', loadErr);
        });
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to save delivery notes';
      setSaveError(errorMessage);
      
      // Check if token expired
      if (errorMessage.includes('Session expired') || errorMessage.includes('token')) {
        if (onLogout) {
          alert('Session expired. Please login again.');
          onLogout();
        }
      }
    } finally {
      setSaving(false);
    }
  };

  // Helper function to get adjusted pending qty (reduced by delivery qty for this order)
  const getAdjustedPendingQty = useCallback((order: CompanyOrder): string => {
    if (!order.PendingQty) {
      return '-';
    }

    const orderKey = getOrderKey(order);
    
    // Check if order should use batch quantities (if IsGodownOn or IsBatchesOn is "Yes")
    const showQtyButton = shouldShowQtyButton(order);
    let deliveryQty = 0;
    
    if (showQtyButton) {
      // Use batch quantities
      deliveryQty = getTotalBatchDeliveryQty(order);
    } else {
      // Use regular delivery qty
      const deliveryQtyStr = deliveryQuantities[orderKey]?.trim();
      if (!deliveryQtyStr) {
        return order.PendingQty;
      }
      deliveryQty = parseFloat(deliveryQtyStr);
    }
    
    if (deliveryQty <= 0) {
      return order.PendingQty;
    }

    try {
      const pendingMatch = order.PendingQty.match(/(-?\d+(?:\.\d+)?)/);
      
      if (pendingMatch && !isNaN(deliveryQty) && deliveryQty > 0) {
        const pending = parseFloat(pendingMatch[1]);
        const adjusted = pending - deliveryQty;
        
        // Extract unit (e.g., "Nos") from Pending Qty if present
        const unitMatch = order.PendingQty.match(/\s*([A-Za-z]+)$/);
        const unit = unitMatch ? unitMatch[1] : '';
        return `${adjusted}${unit ? ' ' + unit : ''}`;
      }
    } catch (e) {
      // If parsing fails, return original
    }
    return order.PendingQty;
  }, [deliveryQuantities, itemBatchBalances, batchDeliveryQuantities, getTotalBatchDeliveryQty, shouldShowQtyButton]);

  // Helper function to parse numeric value from string (e.g., "120.00/Nos" -> 120.00)
  const parseNumericValue = (value?: string | null): number => {
    if (!value) return 0;
    const match = value.match(/(-?\d+(?:\.\d+)?)/);
    if (!match) return 0;
    const num = parseFloat(match[1]);
    return isNaN(num) ? 0 : num;
  };

  const formatDuration = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const computeAutoSelectionQuantities = (
    order: CompanyOrder,
    selections: Record<string, boolean>,
    batchesInfo: Array<{entry: ItemBatchInfo; availableBalance: number; batchKey: string}>,
    prevQuantities: Record<string, string>,
  ): Record<string, string> => {
    const next = {...prevQuantities};
    const totalRequired = parseNumericValue(order.PendingQty);
    let remaining = totalRequired;

    const parseQty = (value?: string): number => {
      if (!value) return 0;
      const parsed = parseFloat(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    // First, assign selected batches up to their available balance
    batchesInfo.forEach(({batchKey, availableBalance}) => {
      if (!selections[batchKey]) {
        return;
      }
      const assign = Math.min(availableBalance, remaining);
      if (assign > 0) {
        next[batchKey] = assign.toFixed(2);
      } else {
        delete next[batchKey];
      }
      remaining = Math.max(remaining - assign, 0);
    });

    // Then, fill remaining quantity using previous allocations for unselected batches
    batchesInfo.forEach(({batchKey}) => {
      if (selections[batchKey]) {
        return;
      }
      const prevValue = parseQty(next[batchKey]);
      if (prevValue <= 0) {
        delete next[batchKey];
        return;
      }

      if (remaining <= 0) {
        delete next[batchKey];
        return;
      }

      const assign = Math.min(prevValue, remaining);
      if (assign > 0) {
        next[batchKey] = assign.toFixed(2);
        remaining = Math.max(remaining - assign, 0);
      } else {
        delete next[batchKey];
      }
    });

    return next;
  };

  const formatQuantityWithUnit = (value: number, unit?: string): string => {
    const formattedValue = value.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return unit ? `${formattedValue} ${unit}` : formattedValue;
  };

  // Helper function to extract unit from a quantity string (e.g., "10 Nos" -> "Nos")
  const extractUnit = (value?: string | null): string => {
    if (!value) return '';
    const unitMatch = value.match(/\s*([A-Za-z]+)$/);
    return unitMatch ? unitMatch[1] : '';
  };

  // Calculate overdue days (today - due date)
  const calculateOverdueDays = useCallback((dueDateStr?: string | null): number | null => {
    if (!dueDateStr) return null;
    try {
      const dueDate = new Date(dueDateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - dueDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch (e) {
      return null;
    }
  }, []);

  // Format rate with discount below
  const formatRateWithDiscount = useCallback((order: CompanyOrder): string => {
    const rate = order.Rate || '-';
    const discount = parseNumericValue(order.Discount);
    if (rate === '-' || discount === 0) {
      return rate;
    }
    return `${rate}\n${discount}%`;
  }, []);

  // Calculate value: OrderQty * Rate * (100 - discount) / 100
  const calculateValue = useCallback((order: CompanyOrder): number => {
    const orderQty = parseNumericValue(order.OrderQty);
    const rate = parseNumericValue(order.Rate);
    const discount = parseNumericValue(order.Discount);
    return orderQty * (rate * (100 - discount)) / 100;
  }, []);

  // Calculate pending value: PendingQty * Rate * (100 - discount) / 100
  const calculatePendingValue = useCallback((order: CompanyOrder): number => {
    const pendingQty = parseNumericValue(getAdjustedPendingQty(order));
    const rate = parseNumericValue(order.Rate);
    const discount = parseNumericValue(order.Discount);
    return pendingQty * (rate * (100 - discount)) / 100;
  }, [getAdjustedPendingQty]);

  // Calculate totals for a section
  const calculateSectionTotals = useCallback((orders: CompanyOrder[]) => {
    let totalOrderQty = 0;
    let totalPendingQty = 0;
    let totalValue = 0;
    let totalPendingValue = 0;
    let unit = '';

    orders.forEach((order) => {
      const orderQty = parseNumericValue(order.OrderQty);
      const pendingQty = parseNumericValue(getAdjustedPendingQty(order));
      const value = calculateValue(order);
      const pendingValue = calculatePendingValue(order);

      totalOrderQty += orderQty;
      totalPendingQty += pendingQty;
      totalValue += value;
      totalPendingValue += pendingValue;

      // Extract unit from first order that has one
      if (!unit && order.OrderQty) {
        unit = extractUnit(order.OrderQty);
      }
    });

    return {
      totalOrderQty: totalOrderQty.toFixed(2),
      totalPendingQty: totalPendingQty.toFixed(2),
      totalValue: totalValue.toFixed(2),
      totalPendingValue: totalPendingValue.toFixed(2),
      unit: unit,
    };
  }, [getAdjustedPendingQty, calculateValue, calculatePendingValue]);

  // Apply UI filters to orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Date filter
      if (filters.date) {
        const orderDate = order.Date ? formatDateDisplay(order.Date) : '';
        if (!orderDate.toLowerCase().includes(filters.date.toLowerCase())) {
          return false;
        }
      }

      // Order No filter
      if (filters.orderNo) {
        if (!(order.OrderNo || '').toLowerCase().includes(filters.orderNo.toLowerCase())) {
          return false;
        }
      }

      // Stock Item filter (exact match for dropdown)
      if (filters.stockItem) {
        if ((order.StockItem || '') !== filters.stockItem) {
          return false;
        }
      }

      // Customer filter (exact match for dropdown)
      if (filters.customer) {
        if ((order.Customer || '') !== filters.customer) {
          return false;
        }
      }

      // Order Qty filter
      if (filters.orderQty) {
        const orderQtyStr = (order.OrderQty || '').toLowerCase();
        if (!orderQtyStr.includes(filters.orderQty.toLowerCase())) {
          return false;
        }
      }

      // Pending Qty filter
      if (filters.pendingQty) {
        const pendingQtyStr = (order.PendingQty || '').toLowerCase();
        if (!pendingQtyStr.includes(filters.pendingQty.toLowerCase())) {
          return false;
        }
      }

      // Rate filter (rate/discount text)
      if (filters.rate) {
        const rateStr = `${order.Rate || ''} ${order.Discount || ''}`.toLowerCase();
        if (!rateStr.includes(filters.rate.toLowerCase())) {
          return false;
        }
      }

      // Value filter (computed numeric)
      if (filters.value) {
        const orderValue = calculateValue(order);
        const valueText = `${orderValue.toFixed(2)} ₹${orderValue.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`.toLowerCase();
        if (!valueText.includes(filters.value.toLowerCase())) {
          return false;
        }
      }

      // Due date / overdue filter
      if (filters.dueDate) {
        const dueDisplay = order.DueDate ? formatDateDisplay(order.DueDate) : '';
        const overdueDays = calculateOverdueDays(order.DueDate);
        const combinedDue = `${dueDisplay} ${overdueDays !== null ? overdueDays : ''}`.toLowerCase();
        if (!combinedDue.includes(filters.dueDate.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [orders, filters, calculateValue, calculateOverdueDays]);


  // Helper function to sort orders based on sortConfig
  const applySorting = useCallback((ordersToSort: CompanyOrder[]) => {
    if (!sortConfig) return ordersToSort;

    const getFieldValue = (order: CompanyOrder, field: SortField): number | string => {
      switch (field) {
        case 'date':
          return order.Date ? new Date(order.Date).getTime() : 0;
        case 'orderNo':
          return (order.OrderNo || '').toLowerCase();
        case 'stockItem':
          return (order.StockItem || '').toLowerCase();
        case 'customer':
          return (order.Customer || '').toLowerCase();
        case 'orderQty':
          return parseNumericValue(order.OrderQty);
        case 'pendingQty':
          return parseNumericValue(getAdjustedPendingQty(order));
        case 'rate':
          return parseNumericValue(order.Rate);
        case 'value':
          return calculateValue(order);
        case 'pendingValue':
          return calculatePendingValue(order);
        case 'dueDate':
          return order.DueDate ? new Date(order.DueDate).getTime() : 0;
        default:
          return '';
      }
    };

    const sorted = [...ordersToSort].sort((a, b) => {
      const valueA = getFieldValue(a, sortConfig.field);
      const valueB = getFieldValue(b, sortConfig.field);

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        if (valueA === valueB) return 0;
        return valueA > valueB ? 1 : -1;
      }

      return String(valueA).localeCompare(String(valueB), undefined, {sensitivity: 'base'});
    });

    return sortConfig.direction === 'asc' ? sorted : sorted.reverse();
  }, [sortConfig, calculateValue, getAdjustedPendingQty]);

  // Separate orders with negative pending qty
  const ordersWithNegativePending = useMemo(() => {
    const filtered = filteredOrders.filter((order) => {
      if (!order.PendingQty) return false;
      try {
        const pendingMatch = order.PendingQty.match(/(-?\d+(?:\.\d+)?)/);
        if (pendingMatch) {
          const pending = parseFloat(pendingMatch[1]);
          return pending < 0;
        }
      } catch (e) {
        // Ignore parsing errors
      }
      return false;
    });
    return applySorting(filtered);
  }, [filteredOrders, applySorting]);

  const deliveryOrdersForSelectedCustomer = useMemo(() => {
    if (!selectedCustomer || selectedCustomer === 'all') return [];
    return filteredOrders.filter(order => {
      if (order.Customer !== selectedCustomer) return false;
      if (!order.PendingQty) return true;
      try {
        const pendingMatch = order.PendingQty.match(/(-?\d+(?:\.\d+)?)/);
        if (pendingMatch) {
          const pending = parseFloat(pendingMatch[1]);
          return pending >= 0;
        }
      } catch (e) {
        return true;
      }
      return true;
    });
  }, [filteredOrders, selectedCustomer]);

  const getAllocatedQtyForBatch = useCallback(
    (stockItem?: string | null, godown?: string | null, batchName?: string | null, excludeOrderKey?: string): number => {
      if (!stockItem) return 0;
      let total = 0;

      deliveryOrdersForSelectedCustomer.forEach((order) => {
        if ((order.StockItem || '') !== stockItem) {
          return;
        }
        const orderKey = getOrderKey(order);
        if (excludeOrderKey && orderKey === excludeOrderKey) {
          return;
        }
        const allocationKey = buildBatchKey(orderKey, godown || '', batchName || '');
        const qtyStr = batchDeliveryQuantities[allocationKey]?.trim();
        if (!qtyStr) {
          return;
        }
        const qty = parseFloat(qtyStr);
        if (!Number.isNaN(qty) && qty > 0) {
          total += qty;
        }
      });

      return total;
    },
    [deliveryOrdersForSelectedCustomer, batchDeliveryQuantities],
  );

  // Get remaining available qty for a stock item after accounting for all delivery quantities
  const getRemainingAvailableQty = useCallback((order: CompanyOrder): number => {
    if (!order.StockItem) return 0;
    
    const originalAvailableQty = parseNumericValue(order.AvailableQty);
    if (originalAvailableQty <= 0) return 0;
    
    // Calculate total delivery quantity for this stock item across all orders in delivery modal
    let totalDeliveryQty = 0;
    
    deliveryOrdersForSelectedCustomer.forEach((deliveryOrder) => {
      if (deliveryOrder.StockItem !== order.StockItem) return;
      
      const showQtyButton = shouldShowQtyButton(deliveryOrder);
      if (showQtyButton) {
        // For batch items, use batch quantities
        totalDeliveryQty += getTotalBatchDeliveryQty(deliveryOrder);
      } else {
        // For non-batch items, use regular delivery quantities
        const orderKey = getOrderKey(deliveryOrder);
        const deliveryQtyStr = deliveryQuantities[orderKey]?.trim() || '';
        const deliveryQty = parseFloat(deliveryQtyStr);
        if (!isNaN(deliveryQty) && deliveryQty > 0) {
          totalDeliveryQty += deliveryQty;
        }
      }
    });
    
    const remaining = Math.max(originalAvailableQty - totalDeliveryQty, 0);
    return remaining;
  }, [deliveryOrdersForSelectedCustomer, deliveryQuantities, batchDeliveryQuantities, itemBatchBalances, getTotalBatchDeliveryQty, shouldShowQtyButton]);

  const deliverySummaryRows = useMemo<DeliverySummaryRow[]>(() => {
    if (!deliveryOrdersForSelectedCustomer.length) return [];

    const grouped = new Map<string, DeliverySummaryRow>();

    deliveryOrdersForSelectedCustomer.forEach((order) => {
      const stockItem = order.StockItem || 'Unnamed Item';
      const unit = extractUnit(order.OrderQty) || extractUnit(order.PendingQty) || '';
      // Group only by stockItem and unit, not by rate
      const key = `${stockItem}||${unit}`;

      if (!grouped.has(key)) {
        // Track unique rates for display
        const uniqueRates = new Set<string>();
        uniqueRates.add(formatRateWithDiscount(order));
        
        grouped.set(key, {
          key,
          stockItem,
          rate: order.Rate || '-',
          discount: order.Discount || '',
          rateDisplay: formatRateWithDiscount(order),
          unit,
          totalOrderQty: 0,
          totalPendingQty: 0,
          totalAvailableQty: 0,
          totalValue: 0,
        totalAllocatedQty: 0,
          orders: [],
          // Store unique rates set for later use
          _uniqueRates: uniqueRates,
        } as DeliverySummaryRow & { _uniqueRates?: Set<string> });
      }

      const group = grouped.get(key)!;
      const orderQty = parseNumericValue(order.OrderQty);
      const pendingQty = parseNumericValue(order.PendingQty);
      const availableQty = parseNumericValue(order.AvailableQty);
      const value = calculateValue(order);
    const orderKey = getOrderKey(order);
    const allocatedQty = getOrderDeliveryQty(order);

      group.totalOrderQty += orderQty;
      group.totalPendingQty += pendingQty;
      group.totalAvailableQty += availableQty;
      group.totalValue += value;
    group.totalAllocatedQty += allocatedQty;
      group.orders.push(order);
      
      // Track unique rates
      const groupWithRates = group as DeliverySummaryRow & { _uniqueRates?: Set<string> };
      if (groupWithRates._uniqueRates) {
        groupWithRates._uniqueRates.add(formatRateWithDiscount(order));
        // Update rateDisplay if multiple rates exist
        if (groupWithRates._uniqueRates.size > 1) {
          group.rateDisplay = 'Multiple rates';
        }
      }
    });

    // Clean up the temporary _uniqueRates property before returning
    const rows = Array.from(grouped.values()).map(row => {
      const { _uniqueRates, ...cleanRow } = row as DeliverySummaryRow & { _uniqueRates?: Set<string> };
      return cleanRow;
    });

    return rows.sort((a, b) => {
      return a.stockItem.localeCompare(b.stockItem);
    });
  }, [deliveryOrdersForSelectedCustomer, calculateValue, formatRateWithDiscount, getOrderDeliveryQty]);

  const visibleDeliverySummaryRows = useMemo(() => {
    if (showZeroAvailabilityItems) {
      return deliverySummaryRows;
    }
    return deliverySummaryRows.filter((row) => row.totalAvailableQty > 0);
  }, [deliverySummaryRows, showZeroAvailabilityItems]);

  useEffect(() => {
    if (!visibleDeliverySummaryRows.length) {
      setSelectedSummaryKey(null);
      return;
    }
    if (!selectedSummaryKey || !visibleDeliverySummaryRows.some((row) => row.key === selectedSummaryKey)) {
      setSelectedSummaryKey(visibleDeliverySummaryRows[0].key);
    }
  }, [visibleDeliverySummaryRows, selectedSummaryKey]);

  const selectedSummaryGroup = useMemo(
    () => visibleDeliverySummaryRows.find((row) => row.key === selectedSummaryKey) || null,
    [visibleDeliverySummaryRows, selectedSummaryKey],
  );

  const summaryAggregates = useMemo(() => {
    if (!visibleDeliverySummaryRows.length) {
      return {
        orderQty: 0,
        pendingQty: 0,
        value: 0,
        allocatedQty: 0,
        availableQty: 0,
        ordersCount: 0,
        unit: '',
      };
    }

    return visibleDeliverySummaryRows.reduce(
      (acc, row) => ({
        orderQty: acc.orderQty + row.totalOrderQty,
        pendingQty: acc.pendingQty + row.totalPendingQty,
        value: acc.value + row.totalValue,
        allocatedQty: acc.allocatedQty + row.totalAllocatedQty,
        availableQty: acc.availableQty + row.totalAvailableQty,
        ordersCount: acc.ordersCount + row.orders.length,
        unit: acc.unit || row.unit,
      }),
      {
        orderQty: 0,
        pendingQty: 0,
        value: 0,
        allocatedQty: 0,
        availableQty: 0,
        ordersCount: 0,
        unit: visibleDeliverySummaryRows[0]?.unit || '',
      },
    );
  }, [visibleDeliverySummaryRows]);

  const totalSummaryOrderQty = summaryAggregates.orderQty;
  const totalSummaryPendingQty = summaryAggregates.pendingQty;
  const totalSummaryValue = summaryAggregates.value;
  const totalSummaryAllocatedQty = summaryAggregates.allocatedQty;
  const totalSummaryAvailableQty = summaryAggregates.availableQty;
  const totalSummaryOrdersCount = summaryAggregates.ordersCount;
  const summaryUnit = summaryAggregates.unit;

  const closeDeliveryModal = useCallback(() => {
    setShowDeliveryModal(false);
    setSaveError(null);
    setViewMode('summary');
    setGroupBy('customer');
  }, []);

  const handleSummaryRowClick = useCallback(
    (name: string) => {
      if (!name || name === '-') return;
      if (groupBy === 'customer') {
        setOriginalGroupBy('customer'); // Store current groupBy before filtering
        setFilters({...filters, customer: name});
        setSelectedCustomer(name);
      } else if (groupBy === 'stockItem') {
        setOriginalGroupBy('stockItem'); // Store current groupBy before filtering
        setFilters({...filters, stockItem: name});
      }
    },
    [groupBy, filters],
  );

  const selectedGroupOrders = selectedSummaryGroup?.orders ?? [];

  // Removed automatic batch balance fetching when delivery modal opens
  // Batch balances are now fetched only when user clicks the "Qty" button for a specific item
  // This prevents 502 proxy errors when opening the delivery modal

  // Orders with zero pending qty (cleared orders)
  const clearedOrders = useMemo(() => {
    const filtered = filteredOrders.filter((order) => {
      if (!order.PendingQty) return false;
      try {
        const pendingMatch = order.PendingQty.match(/(-?\d+(?:\.\d+)?)/);
        if (pendingMatch) {
          const pending = parseFloat(pendingMatch[1]);
          return pending === 0;
        }
      } catch (e) {
        // Ignore parsing errors
      }
      return false;
    });
    return applySorting(filtered);
  }, [filteredOrders, applySorting]);

  // Regular orders (positive pending qty only - outstanding orders)
  const regularOrders = useMemo(() => {
    const filtered = filteredOrders.filter((order) => {
      if (!order.PendingQty) return false; // Exclude orders without pending qty
      try {
        const pendingMatch = order.PendingQty.match(/(-?\d+(?:\.\d+)?)/);
        if (pendingMatch) {
          const pending = parseFloat(pendingMatch[1]);
          return pending > 0; // Only positive pending qty
        }
      } catch (e) {
        // Exclude if parsing fails
      }
      return false;
    });
    return applySorting(filtered);
  }, [filteredOrders, applySorting]);


  // Check if we have any orders to display
  const hasOrdersToDisplay = regularOrders.length > 0 || clearedOrders.length > 0 || ordersWithNegativePending.length > 0;

  // Save section visibility to localStorage when it changes (but don't load from it on mount)
  useEffect(() => {
    localStorage.setItem('companyOrdersSectionVisibility', JSON.stringify(sectionVisibility));
  }, [sectionVisibility]);

  // Get unique stock items and customers from all orders (not just filtered)
  const uniqueStockItems = useMemo(() => {
    const items = new Set<string>();
    orders.forEach((order) => {
      if (order.StockItem && order.StockItem.trim()) {
        items.add(order.StockItem);
      }
    });
    return Array.from(items).sort();
  }, [orders]);

  const uniqueCustomers = useMemo(() => {
    const customers = new Set<string>();
    orders.forEach((order) => {
      if (order.Customer && order.Customer.trim()) {
        customers.add(order.Customer);
      }
    });
    return Array.from(customers).sort();
  }, [orders]);

  
  // Calculate totals for each section using useMemo
  const outstandingTotals = useMemo(() => calculateSectionTotals(regularOrders), [regularOrders, calculateSectionTotals]);
  const clearedTotals = useMemo(() => calculateSectionTotals(clearedOrders), [clearedOrders, calculateSectionTotals]);
  const negativePendingTotals = useMemo(() => calculateSectionTotals(ordersWithNegativePending), [ordersWithNegativePending, calculateSectionTotals]);

  // Calculate summary data grouped by Customer or StockItem
  const summaryData = useMemo(() => {
    if (viewMode !== 'summary') return { outstanding: [], cleared: [], negativePending: [] };

    const groupOrders = (orders: CompanyOrder[]) => {
    const grouped = new Map<string, {
      key: string;
      name: string;
      orderQty: number;
      pendingQty: number;
      value: number;
      pendingValue: number;
      unit: string;
    }>();

      orders.forEach((order) => {
        const groupKey = groupBy === 'customer' ? order.Customer || '-' : order.StockItem || '-';
        const groupName = groupBy === 'customer' ? order.Customer || '-' : order.StockItem || '-';
        
        if (!grouped.has(groupKey)) {
          grouped.set(groupKey, {
            key: groupKey,
            name: groupName,
            orderQty: 0,
            pendingQty: 0,
            value: 0,
            pendingValue: 0,
            unit: extractUnit(order.OrderQty),
          });
        }

        const group = grouped.get(groupKey)!;
        const orderQty = parseNumericValue(order.OrderQty);
        const pendingQty = parseNumericValue(getAdjustedPendingQty(order));
        const value = calculateValue(order);
        const pendingValue = calculatePendingValue(order);

        group.orderQty += orderQty;
        group.pendingQty += pendingQty;
        group.value += value;
        group.pendingValue += pendingValue;
      });

      const groupedArray = Array.from(grouped.values());
      
      // Apply sorting if sortConfig is set
      if (sortConfig) {
        const getGroupFieldValue = (group: typeof groupedArray[0], field: SortField): number | string => {
          switch (field) {
            case 'stockItem':
            case 'customer':
              return group.name.toLowerCase();
            case 'orderQty':
              return group.orderQty;
            case 'pendingQty':
              return group.pendingQty;
            case 'rate':
              return group.orderQty > 0 ? group.value / group.orderQty : 0;
            case 'value':
              return group.value;
            case 'pendingValue':
              return group.pendingValue;
            default:
              return group.name.toLowerCase();
          }
        };
        
        return groupedArray.sort((a, b) => {
          const valueA = getGroupFieldValue(a, sortConfig.field);
          const valueB = getGroupFieldValue(b, sortConfig.field);
          
          if (typeof valueA === 'number' && typeof valueB === 'number') {
            const result = valueA - valueB;
            return sortConfig.direction === 'asc' ? result : -result;
          }
          
          const result = String(valueA).localeCompare(String(valueB), undefined, {sensitivity: 'base'});
          return sortConfig.direction === 'asc' ? result : -result;
        });
      }
      
      return groupedArray.sort((a, b) => a.name.localeCompare(b.name));
    };

    return {
      outstanding: groupOrders(regularOrders),
      cleared: groupOrders(clearedOrders),
      negativePending: groupOrders(ordersWithNegativePending),
    };
  }, [viewMode, groupBy, regularOrders, clearedOrders, ordersWithNegativePending, getAdjustedPendingQty, calculateValue, calculatePendingValue, sortConfig]);

  const INITIAL_DELIVERY_TOTALS = {
    totalOrderQty: '0.00',
    totalPendingQty: '0.00',
    totalValue: '0.00',
    totalDeliveryQty: '0.00',
    unit: '',
  };

  const computeDeliveryTotals = useCallback(
    (ordersToProcess: CompanyOrder[]) => {
      if (!ordersToProcess.length) {
        return INITIAL_DELIVERY_TOTALS;
      }

      let totalOrderQty = 0;
      let totalPendingQty = 0;
      let totalValue = 0;
      let totalDeliveryQty = 0;
      let unit = '';

      ordersToProcess.forEach((order) => {
        const orderQty = parseNumericValue(order.OrderQty);
        const pendingQty = parseNumericValue(getAdjustedPendingQty(order));
        const value = calculateValue(order);
        const deliveryQty = getOrderDeliveryQty(order);

        if (!isNaN(deliveryQty) && deliveryQty > 0) {
          totalDeliveryQty += deliveryQty;
        }

        totalOrderQty += orderQty;
        totalPendingQty += pendingQty;
        totalValue += value;

        if (!unit && order.OrderQty) {
          unit = extractUnit(order.OrderQty);
        }
      });

      return {
        totalOrderQty: totalOrderQty.toFixed(2),
        totalPendingQty: totalPendingQty.toFixed(2),
        totalValue: totalValue.toFixed(2),
        totalDeliveryQty: totalDeliveryQty.toFixed(2),
        unit,
      };
    },
    [getAdjustedPendingQty, calculateValue, getOrderDeliveryQty],
  );

  const selectedGroupTotals = useMemo(() => {
    if (!selectedSummaryGroup) {
      return INITIAL_DELIVERY_TOTALS;
    }
    return computeDeliveryTotals(selectedSummaryGroup.orders);
  }, [selectedSummaryGroup, computeDeliveryTotals]);

  // Calculate order summary values
  const orderSummary = useMemo(() => {
    let totalOrderQty = 0;
    let totalOrderValue = 0;
    let totalPendingQty = 0;
    let totalPendingValue = 0;

    filteredOrders.forEach((order) => {
      const orderQty = parseNumericValue(order.OrderQty);
      const pendingQty = parseNumericValue(order.PendingQty);
      const rate = parseNumericValue(order.Rate);
      const discount = parseNumericValue(order.Discount);

      // Calculate opening value: OrderQty * (Rate * (100 - discount)) / 100
      const openingValue = orderQty * (rate * (100 - discount)) / 100;
      
      // Calculate pending value: PendingQty * (Rate * (100 - discount)) / 100
      const pendingValue = pendingQty * (rate * (100 - discount)) / 100;

      totalOrderQty += orderQty;
      totalOrderValue += openingValue;
      totalPendingQty += pendingQty;
      totalPendingValue += pendingValue;
    });

    return {
      totalOrderQty,
      totalOrderValue,
      totalPendingQty,
      totalPendingValue,
    };
  }, [filteredOrders]);

  // Calculate order ageing data based on configured buckets
  const orderAgeingData = useMemo(() => {
    const buckets = [...ageingBuckets].sort((a, b) => a - b);
    const bucketLabels: string[] = [];
    const bucketData: { bucket: string; qty: number; value: number }[] = [];

    // Create bucket labels based on user requirement: 0, 7, 15, 30, >60
    // Buckets represent: 0 days, 7 days, 15 days, 30 days, >60 days
    for (let i = 0; i < buckets.length; i++) {
      if (i === buckets.length - 1) {
        bucketLabels.push(`>${buckets[i]} days`);
      } else {
        bucketLabels.push(`${buckets[i]} days`);
      }
    }

    // Initialize bucket data
    bucketLabels.forEach(label => {
      bucketData.push({ bucket: label, qty: 0, value: 0 });
    });

    // Calculate ageing for each order based on Due Date
    filteredOrders.forEach((order) => {
      if (!order.DueDate) return;

      const overdueDays = calculateOverdueDays(order.DueDate);
      if (overdueDays === null || overdueDays < 0) return;

      const pendingQty = parseNumericValue(order.PendingQty);
      const rate = parseNumericValue(order.Rate);
      const discount = parseNumericValue(order.Discount);
      const pendingValue = pendingQty * (rate * (100 - discount)) / 100;

      // Determine which bucket this order falls into
      // Buckets: [0, 7, 15, 30, 60] means:
      // - 0 days: overdueDays == 0
      // - 7 days: overdueDays > 0 && overdueDays <= 7
      // - 15 days: overdueDays > 7 && overdueDays <= 15
      // - 30 days: overdueDays > 15 && overdueDays <= 30
      // - >60 days: overdueDays > 30 (or >60 if last bucket is 60)
      let bucketIndex = buckets.length - 1; // Default to last bucket (>max days)
      
      if (overdueDays <= buckets[0]) {
        bucketIndex = 0; // 0 days bucket
      } else {
        for (let i = 1; i < buckets.length; i++) {
          const prevBucket = buckets[i - 1];
          const currBucket = buckets[i];
          if (overdueDays > prevBucket && overdueDays <= currBucket) {
            bucketIndex = i;
            break;
          }
        }
        // If overdueDays > last bucket, it stays in the last bucket (>max days)
      }

      bucketData[bucketIndex].qty += pendingQty;
      bucketData[bucketIndex].value += pendingValue;
    });

    return bucketData;
  }, [filteredOrders, ageingBuckets, calculateOverdueDays]);

  const ageingChartData = useMemo(() => {
    return orderAgeingData.map((bucket) => ({
      bucket: bucket.bucket,
      qty: Number(bucket.qty.toFixed(2)),
      value: Number(bucket.value.toFixed(2)),
      qtyLabel: formatLargeNumber(bucket.qty),
      valueLabel: formatCurrencyShort(bucket.value),
    }));
  }, [orderAgeingData]);

  const pendingQtyPercent =
    orderSummary.totalOrderQty > 0
      ? (orderSummary.totalPendingQty / orderSummary.totalOrderQty) * 100
      : 0;
  const pendingValuePercent =
    orderSummary.totalOrderValue > 0
      ? (orderSummary.totalPendingValue / orderSummary.totalOrderValue) * 100
      : 0;

  return (
    <div className="company-orders-container">
      <header className="company-orders-header">
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>
        <div className="header-info">
          <h1 className="header-title">Company Orders</h1>
          <p className="header-subtitle">
            <strong>{company.company || company.conn_name}</strong>
          </p>
        </div>
        <div className="header-actions">
          <button className="refresh-button" onClick={() => loadOrders()} disabled={loading}>
            {loading ? 'Loading…' : 'Reload'}
          </button>
        </div>
      </header>

      {/* Summary Cards Section */}
      <section className="summary-cards-section">
        {/* First Card: Order/Pending Summary Table */}
        <div className="summary-table-card">
          <h3 className="chart-title">Order Summary</h3>
          <table className="summary-table">
            <thead>
              <tr>
                <th></th>
                <th>Qty</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Order</strong></td>
                <td>{orderSummary.totalOrderQty.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>₹{orderSummary.totalOrderValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td><strong>Pending</strong></td>
                <td>{orderSummary.totalPendingQty.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>₹{orderSummary.totalPendingValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td><strong>Pending %</strong></td>
                <td>{pendingQtyPercent.toFixed(2)}%</td>
                <td>{pendingValuePercent.toFixed(2)}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Second Card: Order Ageing Chart */}
        <div className="ageing-chart-card">
          <h3 className="chart-title">Order Ageing</h3>
          <div className="ageing-chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ageingChartData}
                margin={{top: 30, right: 20, left: 10, bottom: 60}}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="bucket" 
                  tick={{fill: '#475569', fontSize: 11, fontWeight: 500}}
                  height={50}
                  interval={0}
                />
                <YAxis
                  yAxisId="left"
                  tickFormatter={(value) => formatLargeNumber(Number(value))}
                  stroke="#6366f1"
                  width={60}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={(value) => formatLargeNumber(Number(value))}
                  stroke="#22c55e"
                  width={60}
                />
                <RechartsTooltip
                  cursor={{fill: 'rgba(15,23,42,0.05)'}}
                  content={({payload}) => {
                    if (!payload || !payload.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="chart-tooltip">
                        <strong>{data.bucket}</strong>
                        <span>Qty: {formatNumber(data.qty)}</span>
                        <span>Value: ₹{formatNumber(data.value)}</span>
                      </div>
                    );
                  }}
                />
                <Legend verticalAlign="bottom" height={24} />
                <Bar yAxisId="left" dataKey="qty" fill="#6366f1" name="Qty">
                  <LabelList
                    dataKey="qty"
                    position="top"
                    content={(props) => (
                      <ChartValueLabel {...props} formatter={formatLargeNumber} fill="#312e81" />
                    )}
                  />
                </Bar>
                <Bar yAxisId="right" dataKey="value" fill="#22c55e" name="Value">
                  <LabelList
                    dataKey="value"
                    position="top"
                    content={(props) => (
                      <ChartValueLabel {...props} formatter={formatCurrencyShort} fill="#166534" />
                    )}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>


      <section className="orders-toolbar">
        <div className="toolbar-left">
          <div className="customer-select-group">
            <label htmlFor="select-customer" className="customer-select-label">Customer:</label>
            <select
              id="select-customer"
              className="customer-select"
              value={selectedCustomer}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedCustomer(value);
                if (value && value !== 'all') {
                  setFilters({...filters, customer: value});
                } else {
                  setFilters({...filters, customer: ''});
                }
              }}>
              <option value="all">All Customers</option>
              {uniqueCustomers.map((customer) => (
                <option key={customer} value={customer}>
                  {customer}
                </option>
              ))}
            </select>
          </div>
          <div className="view-controls">
            <button 
              className={`toggle-button ${viewMode === 'summary' ? 'active' : ''}`}
              onClick={() => setViewMode(viewMode === 'summary' ? 'detailed' : 'summary')}
              title={viewMode === 'summary' ? 'Switch to Detailed View' : 'Switch to Summary View'}>
              {viewMode === 'summary' ? 'Detailed' : 'Summary'}
            </button>
            {viewMode === 'summary' && (
              <select
                className="group-by-select"
                value={groupBy}
                onChange={(e) => {
                  const newGroupBy = e.target.value as 'customer' | 'stockItem';
                  setGroupBy(newGroupBy);
                  setOriginalGroupBy(newGroupBy); // Update original when manually changed
                }}
                title="Group by">
                <option value="customer">by Customer</option>
                <option value="stockItem">by StockItem</option>
              </select>
            )}
          </div>
          <button 
            className="config-button" 
            onClick={() => {
              // Initialize temp state with current visibility when opening modal
              setTempSectionVisibility(sectionVisibility);
              setTempAgeingBuckets(ageingBuckets);
              setTempBatchXmlFormat(batchXmlFormat);
              setTempAllowNegativeStock(allowNegativeStock);
              setTempAllowDeliveryExceedOrder(allowDeliveryExceedOrder);
              setConfigModalTab('sections');
              setShowConfigModal(true);
            }}
            title="Configure Sections">
            ⚙️ Config
          </button>
          <button
            className="delivery-button-top"
            onClick={() => setShowDeliveryModal(true)}
            disabled={!selectedCustomer || selectedCustomer === 'all' || loading}>
            {!selectedCustomer || selectedCustomer === 'all' ? 'Select Customer' : 'Delivery'}
          </button>
          <button
            className={`toggle-button ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            title={showFilters ? 'Hide Filters' : 'Show Filters'}>
            {showFilters ? '🔽 Hide Filters' : '🔼 Show Filters'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!hasActiveFilters) return;
              setFilters({...INITIAL_FILTERS});
              setSelectedCustomer('all');
            }}
            className="clear-filters-button"
            title="Clear all active filters"
            disabled={!hasActiveFilters}>
            ✖ Clear Filters
          </button>
        </div>
        <span className="orders-count">{filteredOrders.length.toLocaleString('en-IN')} records</span>
      </section>

      {showFilters && (
        <section className="filters-section">
          <div className="filter-row">
          <div className="filter-group">
            <label htmlFor="filter-date" className="filter-label">Date</label>
            <input
              id="filter-date"
              type="text"
              className="filter-input"
              placeholder="Filter by date..."
              value={filters.date}
              onChange={(e) => setFilters({...filters, date: e.target.value})}
            />
          </div>
          <div className="filter-group">
            <label htmlFor="filter-order-no" className="filter-label">Order No</label>
            <input
              id="filter-order-no"
              type="text"
              className="filter-input"
              placeholder="Filter by order no..."
              value={filters.orderNo}
              onChange={(e) => setFilters({...filters, orderNo: e.target.value})}
            />
          </div>
          <div className="filter-group">
            <label htmlFor="filter-stock-item" className="filter-label">Stock Item</label>
            <select
              id="filter-stock-item"
              className="filter-select"
              value={filters.stockItem || 'all'}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'all' || value === 'clear') {
                  setFilters({...filters, stockItem: ''});
                } else {
                  setFilters({...filters, stockItem: value});
                }
              }}>
              <option value="all">All Stock Items</option>
              {uniqueStockItems.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
              {filters.stockItem && filters.stockItem !== 'all' && (
                <option value="clear">-- Clear Selection --</option>
              )}
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="filter-customer" className="filter-label">Customer</label>
            <select
              id="filter-customer"
              className="filter-select"
              value={filters.customer || 'all'}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'all' || value === 'clear') {
                  setFilters({...filters, customer: ''});
                } else {
                  setFilters({...filters, customer: value});
                }
              }}>
              <option value="all">All Customers</option>
              {uniqueCustomers.map((customer) => (
                <option key={customer} value={customer}>
                  {customer}
                </option>
              ))}
              {filters.customer && filters.customer !== 'all' && (
                <option value="clear">-- Clear Selection --</option>
              )}
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="filter-order-qty" className="filter-label">Order Qty</label>
            <input
              id="filter-order-qty"
              type="text"
              className="filter-input"
              placeholder="Filter by order qty..."
              value={filters.orderQty}
              onChange={(e) => setFilters({...filters, orderQty: e.target.value})}
            />
          </div>
          <div className="filter-group">
            <label htmlFor="filter-pending-qty" className="filter-label">Pending Qty</label>
            <input
              id="filter-pending-qty"
              type="text"
              className="filter-input"
              placeholder="Filter by pending qty..."
              value={filters.pendingQty}
              onChange={(e) => setFilters({...filters, pendingQty: e.target.value})}
            />
          </div>
        </div>
        <div className="filter-row">
          <div className="filter-group">
            <label htmlFor="filter-rate" className="filter-label">Rate (disc%)</label>
            <input
              id="filter-rate"
              type="text"
              className="filter-input"
              placeholder="Filter by rate..."
              value={filters.rate}
              onChange={(e) => setFilters({...filters, rate: e.target.value})}
            />
          </div>
          <div className="filter-group">
            <label htmlFor="filter-value" className="filter-label">Value</label>
            <input
              id="filter-value"
              type="text"
              className="filter-input"
              placeholder="Filter by value..."
              value={filters.value}
              onChange={(e) => setFilters({...filters, value: e.target.value})}
            />
          </div>
          <div className="filter-group">
            <label htmlFor="filter-due-date" className="filter-label">Due Date / Overdue</label>
            <input
              id="filter-due-date"
              type="text"
              className="filter-input"
              placeholder="Filter by due date or overdue..."
              value={filters.dueDate}
              onChange={(e) => setFilters({...filters, dueDate: e.target.value})}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (!hasActiveFilters) return;
              setFilters({...INITIAL_FILTERS});
            }}
            className="clear-filters-button"
            disabled={!hasActiveFilters}>
            Clear Filters
          </button>
        </div>
        </section>
      )}

      <section className="orders-table-wrapper">
        {error && (
          <div className="orders-error">
            <p>{error}</p>
            <button onClick={() => loadOrders()} className="refresh-button">
              Retry
            </button>
          </div>
        )}

        {!error && loading && (
          <div className="orders-loading">
            <div className="spinner" />
            <p>Fetching orders…</p>
          </div>
        )}

        {!error && !loading && !hasOrdersToDisplay && (
          <div className="orders-empty">
            <p>No orders found.</p>
          </div>
        )}

        {!error && !loading && sectionVisibility.outstanding && (viewMode === 'detailed' ? regularOrders.length > 0 : summaryData.outstanding.length > 0) && (
          <>
            <h3 className="section-title">Sales Orders Outstanding</h3>
            <table className={`orders-table ${viewMode === 'summary' ? 'summary-view' : 'detailed-view'}`}>
              <thead>
                <tr>
                  {viewMode === 'detailed' && <th>{renderSortableHeader('Date', 'date')}</th>}
                  {viewMode === 'detailed' && <th>{renderSortableHeader('Order No', 'orderNo')}</th>}
                  {viewMode === 'summary' && groupBy === 'stockItem' && <th>{renderSortableHeader('Stock Item', 'stockItem')}</th>}
                  {viewMode === 'summary' && groupBy === 'customer' && <th>{renderSortableHeader('Customer', 'customer')}</th>}
                  {viewMode === 'detailed' && <th>{renderSortableHeader('Stock Item', 'stockItem')}</th>}
                  {viewMode === 'detailed' && <th>{renderSortableHeader('Customer', 'customer')}</th>}
                  <th>{renderSortableHeader('Order Qty', 'orderQty')}</th>
                  <th>{renderSortableHeader('Rate', 'rate', '(disc%)')}</th>
                  <th>{renderSortableHeader('Order Value', 'value')}</th>
                  <th>{renderSortableHeader('Pending Qty', 'pendingQty')}</th>
                  <th>{renderSortableHeader('Pending Value', 'pendingValue')}</th>
                  {viewMode === 'detailed' && (
                    <th>{renderSortableHeader('Due Date', 'dueDate', '(overdue)')}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {viewMode === 'detailed' ? (
                  regularOrders.map((order, index) => {
                    const orderKey = getOrderKey(order);
                    const adjustedPendingQty = getAdjustedPendingQty(order);
                    const overdueDays = calculateOverdueDays(order.DueDate);
                    const value = calculateValue(order);
                    const pendingValue = calculatePendingValue(order);
                    const rateWithDiscount = formatRateWithDiscount(order);
                    
                    return (
                      <tr key={`${orderKey}-${index}`}>
                        <td>{order.Date ? formatDateDisplay(order.Date) : '-'}</td>
                        <td>
                          <div>{order.OrderNo || '-'}</div>
                          {order.Batch && <div className="cell-subtext">Batch: {order.Batch}</div>}
                        </td>
                        <td>
                          <div>{order.StockItem || '-'}</div>
                          {order.Location && <div className="cell-subtext">Location: {order.Location}</div>}
                        </td>
                        <td>{order.Customer || '-'}</td>
                        <td>{order.OrderQty || '-'}</td>
                        <td>
                          {rateWithDiscount.split('\n').map((line, i) => (
                            <div key={i}>{line}</div>
                          ))}
                        </td>
                        <td>₹{value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>{adjustedPendingQty}</td>
                        <td>₹{pendingValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>
                          <div>{order.DueDate ? formatDateDisplay(order.DueDate) : '-'}</div>
                          {overdueDays !== null && overdueDays > 0 && (
                            <div className="cell-subtext">({overdueDays} days)</div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  summaryData.outstanding.map((group, index) => {
                    const avgRate = group.orderQty > 0 ? group.value / group.orderQty : 0;
                    return (
                      <tr
                        key={`summary-${group.key}-${index}`}
                        className="summary-clickable-row"
                        onClick={() => handleSummaryRowClick(group.name)}>
                        <td>{group.name}</td>
                        <td>{`${group.orderQty.toFixed(2)}${group.unit ? ' ' + group.unit : ''}`}</td>
                        <td>{avgRate > 0 ? avgRate.toFixed(2) : '-'}</td>
                        <td>₹{group.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>{`${group.pendingQty.toFixed(2)}${group.unit ? ' ' + group.unit : ''}`}</td>
                        <td>₹{group.pendingValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="table-total-row">
                  <td colSpan={viewMode === 'detailed' ? 4 : 1}><strong>Total</strong></td>
                  <td><strong>{`${outstandingTotals.totalOrderQty}${outstandingTotals.unit ? ' ' + outstandingTotals.unit : ''}`}</strong></td>
                  <td>-</td>
                  <td><strong>₹{parseFloat(outstandingTotals.totalValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                  <td><strong>{`${outstandingTotals.totalPendingQty}${outstandingTotals.unit ? ' ' + outstandingTotals.unit : ''}`}</strong></td>
                  <td><strong>₹{parseFloat(outstandingTotals.totalPendingValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                  {viewMode === 'detailed' && <td>-</td>}
                </tr>
              </tfoot>
            </table>
          </>
        )}

        {!error && !loading && sectionVisibility.cleared && (viewMode === 'detailed' ? clearedOrders.length > 0 : summaryData.cleared.length > 0) && (
          <div className="cleared-orders-section">
            <h3 className="section-title">Sales Orders Cleared</h3>
            <table className={`orders-table ${viewMode === 'summary' ? 'summary-view' : 'detailed-view'}`}>
              <thead>
                <tr>
                  {viewMode === 'detailed' && <th>{renderSortableHeader('Date', 'date')}</th>}
                  {viewMode === 'detailed' && <th>{renderSortableHeader('Order No', 'orderNo')}</th>}
                  {viewMode === 'summary' && groupBy === 'stockItem' && <th>{renderSortableHeader('Stock Item', 'stockItem')}</th>}
                  {viewMode === 'summary' && groupBy === 'customer' && <th>{renderSortableHeader('Customer', 'customer')}</th>}
                  {viewMode === 'detailed' && <th>{renderSortableHeader('Stock Item', 'stockItem')}</th>}
                  {viewMode === 'detailed' && <th>{renderSortableHeader('Customer', 'customer')}</th>}
                  <th>{renderSortableHeader('Order Qty', 'orderQty')}</th>
                  <th>{renderSortableHeader('Rate', 'rate', '(disc%)')}</th>
                  <th>{renderSortableHeader('Order Value', 'value')}</th>
                  <th>{renderSortableHeader('Pending Qty', 'pendingQty')}</th>
                  <th>{renderSortableHeader('Pending Value', 'pendingValue')}</th>
                  {viewMode === 'detailed' && (
                    <th>{renderSortableHeader('Due Date', 'dueDate', '(overdue)')}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {viewMode === 'detailed' ? (
                  clearedOrders.map((order, index) => {
                    const orderKey = getOrderKey(order);
                    const adjustedPendingQty = getAdjustedPendingQty(order);
                    const overdueDays = calculateOverdueDays(order.DueDate);
                    const value = calculateValue(order);
                    const pendingValue = calculatePendingValue(order);
                    const rateWithDiscount = formatRateWithDiscount(order);
                    
                    return (
                      <tr key={`${orderKey}-${index}`}>
                        <td>{order.Date ? formatDateDisplay(order.Date) : '-'}</td>
                        <td>
                          <div>{order.OrderNo || '-'}</div>
                          {order.Batch && <div className="cell-subtext">Batch: {order.Batch}</div>}
                        </td>
                        <td>
                          <div>{order.StockItem || '-'}</div>
                          {order.Location && <div className="cell-subtext">Location: {order.Location}</div>}
                        </td>
                        <td>{order.Customer || '-'}</td>
                        <td>{order.OrderQty || '-'}</td>
                        <td>
                          {rateWithDiscount.split('\n').map((line, i) => (
                            <div key={i}>{line}</div>
                          ))}
                        </td>
                        <td>₹{value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>{adjustedPendingQty}</td>
                        <td>₹{pendingValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>
                          <div>{order.DueDate ? formatDateDisplay(order.DueDate) : '-'}</div>
                          {overdueDays !== null && overdueDays > 0 && (
                            <div className="cell-subtext">({overdueDays} days)</div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  summaryData.cleared.map((group, index) => {
                    const avgRate = group.orderQty > 0 ? group.value / group.orderQty : 0;
                    return (
                      <tr
                        key={`summary-${group.key}-${index}`}
                        className="summary-clickable-row"
                        onClick={() => handleSummaryRowClick(group.name)}>
                        <td>{group.name}</td>
                        <td>{`${group.orderQty.toFixed(2)}${group.unit ? ' ' + group.unit : ''}`}</td>
                        <td>{avgRate > 0 ? avgRate.toFixed(2) : '-'}</td>
                        <td>₹{group.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>{`${group.pendingQty.toFixed(2)}${group.unit ? ' ' + group.unit : ''}`}</td>
                        <td>₹{group.pendingValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="table-total-row">
                  <td colSpan={viewMode === 'detailed' ? 4 : 1}><strong>Total</strong></td>
                  <td><strong>{`${clearedTotals.totalOrderQty}${clearedTotals.unit ? ' ' + clearedTotals.unit : ''}`}</strong></td>
                  <td>-</td>
                  <td><strong>₹{parseFloat(clearedTotals.totalValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                  <td><strong>{`${clearedTotals.totalPendingQty}${clearedTotals.unit ? ' ' + clearedTotals.unit : ''}`}</strong></td>
                  <td><strong>₹{parseFloat(clearedTotals.totalPendingValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                  {viewMode === 'detailed' && <td>-</td>}
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {!error && !loading && sectionVisibility.negativePending && (viewMode === 'detailed' ? ordersWithNegativePending.length > 0 : summaryData.negativePending.length > 0) && (
          <div className="negative-pending-section">
            <h3 className="section-title">Goods delivered by Orders not received</h3>
            <table className={`orders-table ${viewMode === 'summary' ? 'summary-view' : 'detailed-view'}`}>
              <thead>
                <tr>
                  {viewMode === 'detailed' && <th>{renderSortableHeader('Date', 'date')}</th>}
                  {viewMode === 'detailed' && <th>{renderSortableHeader('Order No', 'orderNo')}</th>}
                  {viewMode === 'summary' && groupBy === 'stockItem' && <th>{renderSortableHeader('Stock Item', 'stockItem')}</th>}
                  {viewMode === 'summary' && groupBy === 'customer' && <th>{renderSortableHeader('Customer', 'customer')}</th>}
                  {viewMode === 'detailed' && <th>{renderSortableHeader('Stock Item', 'stockItem')}</th>}
                  {viewMode === 'detailed' && <th>{renderSortableHeader('Customer', 'customer')}</th>}
                  <th>{renderSortableHeader('Order Qty', 'orderQty')}</th>
                  <th>{renderSortableHeader('Rate', 'rate', '(disc%)')}</th>
                  <th>{renderSortableHeader('Order Value', 'value')}</th>
                  <th>{renderSortableHeader('Pending Qty', 'pendingQty')}</th>
                  <th>{renderSortableHeader('Pending Value', 'pendingValue')}</th>
                  {viewMode === 'detailed' && (
                    <th>{renderSortableHeader('Due Date', 'dueDate', '(overdue)')}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {viewMode === 'detailed' ? (
                  ordersWithNegativePending.map((order, index) => {
                    const orderKey = getOrderKey(order);
                    const adjustedPendingQty = getAdjustedPendingQty(order);
                    const overdueDays = calculateOverdueDays(order.DueDate);
                    const value = calculateValue(order);
                    const pendingValue = calculatePendingValue(order);
                    const rateWithDiscount = formatRateWithDiscount(order);
                    
                    return (
                      <tr key={`${orderKey}-${index}`}>
                        <td>{order.Date ? formatDateDisplay(order.Date) : '-'}</td>
                        <td>
                          <div>{order.OrderNo || '-'}</div>
                          {order.Batch && <div className="cell-subtext">Batch: {order.Batch}</div>}
                        </td>
                        <td>
                          <div>{order.StockItem || '-'}</div>
                          {order.Location && <div className="cell-subtext">Location: {order.Location}</div>}
                        </td>
                        <td>{order.Customer || '-'}</td>
                        <td>{order.OrderQty || '-'}</td>
                        <td>
                          {rateWithDiscount.split('\n').map((line, i) => (
                            <div key={i}>{line}</div>
                          ))}
                        </td>
                        <td>₹{value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>{adjustedPendingQty}</td>
                        <td>₹{pendingValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>
                          <div>{order.DueDate ? formatDateDisplay(order.DueDate) : '-'}</div>
                          {overdueDays !== null && overdueDays > 0 && (
                            <div className="cell-subtext">({overdueDays} days)</div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  summaryData.negativePending.map((group, index) => {
                    const avgRate = group.orderQty > 0 ? group.value / group.orderQty : 0;
                    return (
                      <tr
                        key={`summary-${group.key}-${index}`}
                        className="summary-clickable-row"
                        onClick={() => handleSummaryRowClick(group.name)}>
                        <td>{group.name}</td>
                        <td>{`${group.orderQty.toFixed(2)}${group.unit ? ' ' + group.unit : ''}`}</td>
                        <td>{avgRate > 0 ? avgRate.toFixed(2) : '-'}</td>
                        <td>₹{group.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>{`${group.pendingQty.toFixed(2)}${group.unit ? ' ' + group.unit : ''}`}</td>
                        <td>₹{group.pendingValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="table-total-row">
                  <td colSpan={viewMode === 'detailed' ? 4 : 1}><strong>Total</strong></td>
                  <td><strong>{`${negativePendingTotals.totalOrderQty}${negativePendingTotals.unit ? ' ' + negativePendingTotals.unit : ''}`}</strong></td>
                  <td>-</td>
                  <td><strong>₹{parseFloat(negativePendingTotals.totalValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                  <td><strong>{`${negativePendingTotals.totalPendingQty}${negativePendingTotals.unit ? ' ' + negativePendingTotals.unit : ''}`}</strong></td>
                  <td><strong>₹{parseFloat(negativePendingTotals.totalPendingValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                  {viewMode === 'detailed' && <td>-</td>}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Delivery Modal */}
      {showDeliveryModal && selectedCustomer && selectedCustomer !== 'all' && (
        <div className="modal-overlay" onClick={closeDeliveryModal}>
          <div className="delivery-modal-overlay-content" onClick={(e) => e.stopPropagation()}>
            <div className="delivery-modal-header">
              <h2>Update Delivery - {selectedCustomer}</h2>
              <div className="delivery-header-actions">
                <button
                  type="button"
                  className={`zero-availability-toggle ${showZeroAvailabilityItems ? 'active' : ''}`}
                  onClick={() => setShowZeroAvailabilityItems((prev) => !prev)}
                  title={showZeroAvailabilityItems ? 'Click to hide 0 balance items' : 'Click to show 0 balance items'}>
                  {showZeroAvailabilityItems ? 'Hide 0 Qty Items' : 'Show 0 Qty Items'}
                </button>
                <button
                  className="close-modal-button"
                    onClick={closeDeliveryModal}>
                  ✕
                </button>
              </div>
            </div>
            <div className="delivery-modal-body">
              {saveError && (
                <div className="save-error-message">
                  <p>{saveError}</p>
                  <button onClick={() => setSaveError(null)} className="close-error-button">✕</button>
                </div>
              )}

              {itemBatchError && (
                <div className="batch-error-message">
                    {itemBatchError}
                </div>
              )}
              {itemBatchLoading && (
                <div className="batch-loading-message">Fetching latest stock availability…</div>
              )}

              <div className="delivery-summary-section">
              {deliverySummaryRows.length === 0 ? (
                  <div className="delivery-summary-empty">No pending items for this customer.</div>
              ) : visibleDeliverySummaryRows.length === 0 ? (
                <div className="delivery-summary-empty">
                  All pending items currently have 0 available quantity. Use "Show 0 Qty Items" to view them.
                </div>
              ) : (
                  <div className="delivery-summary-table-wrapper">
                    <div className="delivery-summary-table-content">
                      <table className="delivery-summary-table">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th className="text-right">Orders</th>
                            <th className="text-right">Order Qty</th>
                            <th className="text-right">Rate</th>
                            <th className="text-right">Order Value</th>
                            <th className="text-right">Pending Qty</th>
                            <th className="text-right">Allocated Qty</th>
                            <th className="text-right">Available Qty</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                        {visibleDeliverySummaryRows.map((row) => {
                          const isSelected = row.key === selectedSummaryKey;
                          
                          return (
                            <React.Fragment key={row.key}>
                              <tr
                                className={`delivery-summary-row${isSelected ? ' selected' : ''}`}
                                onClick={() => setSelectedSummaryKey(isSelected ? null : row.key)}
                              >
                                <td>
                                  <div className="summary-item-name">{row.stockItem}</div>
                                </td>
                                <td className="text-right">{row.orders.length}</td>
                                <td className="text-right">{formatQuantityWithUnit(row.totalOrderQty, row.unit)}</td>
                                <td className="text-right">
                                  {row.rateDisplay.split('\n').map((line, i) => (
                                    <div key={i}>{line}</div>
                                  ))}
                                </td>
                                <td className="text-right">₹{row.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="text-right">{formatQuantityWithUnit(row.totalPendingQty, row.unit)}</td>
                                <td className="text-right">{formatQuantityWithUnit(row.totalAllocatedQty, row.unit)}</td>
                                <td className="text-right">{formatQuantityWithUnit(row.totalAvailableQty, row.unit)}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="summary-select-button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedSummaryKey(isSelected ? null : row.key);
                                    }}
                                  >
                                    {isSelected ? 'Hide' : 'Show'}
                                  </button>
                                </td>
                              </tr>
                              {isSelected && selectedGroupOrders.length > 0 && (
                                <tr>
                                  <td colSpan={9} style={{ padding: 0, borderTop: 'none' }}>
                                    <div className="delivery-orders-expanded">
                                      <div className="delivery-orders-expanded-header">
                                        <h4>Orders for {row.stockItem}</h4>
                                      </div>
                                      <div className="delivery-items-table-wrapper">
                                        <table className="delivery-items-table">
                                          <thead>
                                            <tr>
                                              <th>Order Date</th>
                                              <th>Order No</th>
                                              <th>Order Qty</th>
                                              <th>
                                                <div>Rate</div>
                                                <div className="cell-subtext">(disc%)</div>
                                              </th>
                                              <th>Order Value</th>
                                              <th>Pending Qty</th>
                                              <th>
                                                <div>Due Date</div>
                                                <div className="cell-subtext">(overdue)</div>
                                              </th>
                                              <th>Available Qty</th>
                                              <th>Delivery Qty</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {selectedGroupOrders.map((order, index) => {
                                              const orderKey = getOrderKey(order);
                                              const deliveryQty = deliveryQuantities[orderKey] || '';
                                              const adjustedPendingQty = getAdjustedPendingQty(order);
                                              const overdueDays = calculateOverdueDays(order.DueDate);
                                              const value = calculateValue(order);
                                              const rateWithDiscount = formatRateWithDiscount(order);
                                              const showQtyButton = shouldShowQtyButton(order);

                                              return (
                                                <tr key={`${orderKey}-${index}`}>
                                                  <td>{order.Date ? formatDateDisplay(order.Date) : '-'}</td>
                                              <td>
                                                <div>{order.OrderNo || '-'}</div>
                                                {order.Batch && <div className="cell-subtext">Batch: {order.Batch}</div>}
                                                {order.Location && <div className="cell-subtext">Location: {order.Location}</div>}
                                              </td>
                                                  <td>{order.OrderQty || '-'}</td>
                                                  <td>
                                                    {rateWithDiscount.split('\n').map((line, i) => (
                                                      <div key={i}>{line}</div>
                                                    ))}
                                                  </td>
                                                  <td>₹{value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                  <td>{adjustedPendingQty}</td>
                                                  <td>
                                                    <div>{order.DueDate ? formatDateDisplay(order.DueDate) : '-'}</div>
                                                    {overdueDays !== null && overdueDays > 0 && (
                                                      <div className="cell-subtext">({overdueDays} days)</div>
                                                    )}
                                                  </td>
                                                  <td className={(() => {
                                                    const remainingQty = getRemainingAvailableQty(order);
                                                    return remainingQty === 0 ? 'available-qty-zero' : '';
                                                  })()}>
                                                    {(() => {
                                                      const remainingQty = getRemainingAvailableQty(order);
                                                      const unit = extractUnit(order.AvailableQty);
                                                      if (remainingQty <= 0) {
                                                        return `0${unit ? ' ' + unit : ''}`;
                                                      }
                                                      return `${remainingQty.toFixed(2)}${unit ? ' ' + unit : ''}`;
                                                    })()}
                                                  </td>
                                                  <td>
                                                    {showQtyButton ? (
                                                      <button
                                                        type="button"
                                                        className="batch-qty-button"
                                                        onClick={() => handleOpenBatchSelection(order)}
                                                        disabled={saving}
                                                      >
                                                        Qty
                                                        {(() => {
                                                          const totalBatchQty = getTotalBatchDeliveryQty(order);
                                                          return totalBatchQty > 0 ? ` (${totalBatchQty})` : '';
                                                        })()}
                                                      </button>
                                                    ) : (
                                                      <input
                                                        type="text"
                                                        className="delivery-qty-input-modal"
                                                        value={deliveryQty}
                                                        onChange={(e) => handleDeliveryQtyChange(order, e.target.value)}
                                                        placeholder="Enter qty"
                                                        disabled={saving}
                                                      />
                                                    )}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                          {selectedGroupOrders.length > 1 && (
                                            <tfoot>
                                              <tr className="delivery-modal-total-row">
                                                <td colSpan={3}><strong>Total</strong></td>
                                                <td><strong>{`${selectedGroupTotals.totalOrderQty}${selectedGroupTotals.unit ? ' ' + selectedGroupTotals.unit : ''}`}</strong></td>
                                                <td>-</td>
                                                <td><strong>₹{Number(selectedGroupTotals.totalValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                                                <td><strong>{`${selectedGroupTotals.totalPendingQty}${selectedGroupTotals.unit ? ' ' + selectedGroupTotals.unit : ''}`}</strong></td>
                                                <td>-</td>
                                                <td>-</td>
                                                <td><strong>{`${selectedGroupTotals.totalDeliveryQty}${selectedGroupTotals.unit ? ' ' + selectedGroupTotals.unit : ''}`}</strong></td>
                                              </tr>
                                            </tfoot>
                                          )}
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                        </tbody>
                      </table>
                    </div>
                    <table className="delivery-summary-table">
                      <tfoot className="delivery-summary-totals">
                        <tr>
                          <td>Totals</td>
                          <td className="text-right">{totalSummaryOrdersCount}</td>
                          <td className="text-right">{formatQuantityWithUnit(totalSummaryOrderQty, summaryUnit)}</td>
                          <td className="text-right text-emphasis">-</td>
                          <td className="text-right">₹{totalSummaryValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="text-right">{formatQuantityWithUnit(totalSummaryPendingQty, summaryUnit)}</td>
                          <td className="text-right">{formatQuantityWithUnit(totalSummaryAllocatedQty, summaryUnit)}</td>
                          <td className="text-right">{formatQuantityWithUnit(totalSummaryAvailableQty, summaryUnit)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
            <div className="delivery-modal-actions">
              <button
                className="cancel-button"
                onClick={closeDeliveryModal}
                disabled={saving}>
                Cancel
              </button>
              <div className="delivery-date-group-modal">
                <label htmlFor="delivery-date-modal" className="delivery-date-label-modal">Delivery Date:</label>
                <input
                  id="delivery-date-modal"
                  type="date"
                  className="delivery-date-input-modal"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  disabled={saving}
                />
              </div>
              <button
                className="save-order-button"
                onClick={handleSaveDelivery}
                disabled={saving || loading}>
                {saving ? `Saving… (${formatDuration(saveElapsedSeconds)})` : 'Save'}
              </button>
              {saving && (
                <span className="save-timer">Elapsed: {formatDuration(saveElapsedSeconds)}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Batch Selection Modal */}
      {showBatchSelectionModal && selectedOrderForBatch && (
        <div className="modal-overlay" onClick={handleCloseBatchSelection}>
          <div className="batch-selection-modal" onClick={(e) => e.stopPropagation()}>
            <div className="batch-selection-modal-header">
              <div className="batch-header-content">
                <h2>Select Batch Quantities</h2>
                <div className="batch-order-info-compact">
                  <span><strong>Order:</strong> {selectedOrderForBatch.OrderNo || '-'}</span>
                  <span className="separator">|</span>
                  <span><strong>Item:</strong> {selectedOrderForBatch.StockItem || '-'}</span>
                  <span className="separator">|</span>
                  <span><strong>Pending:</strong> {selectedOrderForBatch.PendingQty || '-'}</span>
                </div>
              </div>
              <div className="batch-header-actions">
                <button
                  className="clear-batch-button"
                  onClick={handleClearBatchAllocations}
                  disabled={saving}
                  title="Clear all batch allocations"
                >
                  Clear
                </button>
                <button
                  className="save-batch-button"
                  onClick={handleSaveBatchSelection}
                  disabled={saving}
                >
                  Save
                </button>
                <button
                  className="close-modal-button"
                  onClick={handleCloseBatchSelection}
                  disabled={saving}
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="batch-selection-modal-body">
              {(() => {
                const orderKey = getOrderKey(selectedOrderForBatch);
                const batchEntries = selectedOrderForBatch.StockItem ? itemBatchBalances[selectedOrderForBatch.StockItem] : undefined;
                
                if (itemBatchLoading) {
                  return (
                    <div className="batch-selection-loading">
                      <div className="spinner"></div>
                      <p>Loading batch data...</p>
                    </div>
                  );
                }
                
                if (itemBatchError) {
                  // Check if error is about available qty being 0
                  if (itemBatchError === 'Available qty: 0') {
                    return (
                      <div className="batch-selection-error">
                        <p>Available qty: 0</p>
                      </div>
                    );
                  }
                  return (
                    <div className="batch-selection-error">
                      <p>Error loading batch data: {itemBatchError}</p>
                    </div>
                  );
                }
                
                if (!batchEntries || batchEntries.length === 0) {
                  return (
                    <div className="batch-selection-empty">
                      <p>No batch data available for this item.</p>
                    </div>
                  );
                }
                
                // Filter batches by Location and Batch if specified
                const orderLocation = selectedOrderForBatch.Location?.trim() || '';
                const orderBatch = selectedOrderForBatch.Batch?.trim() || '';
                
                const filteredBatchEntries = batchEntries.filter((entry) => {
                  const entryLocation = entry.godown?.trim() || '';
                  const entryBatch = entry.Batchname?.trim() || '';
                  
                  if (orderLocation && entryLocation !== orderLocation) {
                    return false;
                  }
                  
                  if (orderBatch && entryBatch !== orderBatch) {
                    return false;
                  }
                  
                  return true;
                });
                
                // Check if filtering by Location/Batch resulted in no matches
                if (filteredBatchEntries.length === 0) {
                  const filterCriteria: string[] = [];
                  if (orderLocation) filterCriteria.push(`Location: ${orderLocation}`);
                  if (orderBatch) filterCriteria.push(`Batch: ${orderBatch}`);
                  const criteriaText = filterCriteria.length > 0 ? ` matching ${filterCriteria.join(' and ')}` : '';
                  return (
                    <div className="batch-selection-empty">
                      <p>No batches found{criteriaText} for this item.</p>
                    </div>
                  );
                }
                
                // Compute available balance per batch after accounting for allocations in other orders
                const batchesWithBalance = filteredBatchEntries
                  .map((entry) => {
                    const totalBalance = parseNumericValue(entry.CLOSINGBALANCE);
                    const allocatedElsewhere = getAllocatedQtyForBatch(
                      selectedOrderForBatch.StockItem,
                      entry.godown || '',
                      entry.Batchname || '',
                      orderKey,
                    );
                    const batchKey = buildBatchKey(orderKey, entry.godown || '', entry.Batchname || '');
                    const currentAllocatedRaw = parseFloat((batchDeliveryQuantities[batchKey] || '').trim());
                    const currentAllocated = Number.isNaN(currentAllocatedRaw) ? 0 : currentAllocatedRaw;
                    const availableBalance = Math.max(totalBalance - allocatedElsewhere, 0);
                    return {
                      entry,
                      availableBalance,
                      currentAllocated,
                      batchKey,
                    };
                  })
                  .filter(({ availableBalance, currentAllocated }) => availableBalance > 0 || currentAllocated > 0);
                
                if (batchesWithBalance.length === 0) {
                  return (
                    <div className="batch-selection-empty">
                      <p>No batches with available balance for this item.</p>
                    </div>
                  );
                }
                
                return (
                  <div className="batch-selection-table-wrapper">
                    <table className="batch-selection-table">
                      <thead>
                        <tr>
                          <th className="batch-select-column">Use</th>
                          <th>Godown</th>
                          <th>Batch Name</th>
                          <th>Closing Balance</th>
                          <th>Delivery Qty</th>
                          <th>Net Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchesWithBalance.map((batchInfo, batchIndex) => {
                          const { entry, availableBalance, batchKey } = batchInfo;
                          const batchDeliveryQty = batchDeliveryQuantities[batchKey] || '';
                          const entryUnit = extractUnit(entry.CLOSINGBALANCE);
                          const closingDisplay = formatQuantityWithUnit(availableBalance, entryUnit);
                          const deliveryQtyValue = batchDeliveryQty ? parseFloat(batchDeliveryQty) : 0;
                          const validDeliveryQty = Number.isNaN(deliveryQtyValue) ? 0 : deliveryQtyValue;
                          const netBalance = Math.max(availableBalance - validDeliveryQty, 0);
                          const netDisplay = formatQuantityWithUnit(netBalance, entryUnit);
                          const isSelected = !!autoSelectedBatches[batchKey];
                          return (
                            <tr key={`${entry.godown}-${entry.Batchname}-${batchIndex}`}>
                              <td className="batch-select-cell">
                                <input
                                  type="checkbox"
                                  className="batch-select-checkbox"
                                  checked={isSelected}
                                  onChange={(e) =>
                                    handleBatchAutoSelectToggle(
                                      selectedOrderForBatch,
                                      batchKey,
                                      e.target.checked,
                                      batchesWithBalance,
                                    )
                                  }
                                  disabled={saving}
                                />
                              </td>
                              <td>{entry.godown || 'Unknown godown'}</td>
                              <td>{entry.Batchname || 'No batch'}</td>
                              <td className="text-right">{closingDisplay}</td>
                              <td>
                                <input
                                  type="text"
                                  className="batch-delivery-qty-input-modal"
                                  value={batchDeliveryQty}
                                  onChange={(e) => handleBatchDeliveryQtyChange(orderKey, entry.godown, entry.Batchname, e.target.value, availableBalance, selectedOrderForBatch)}
                                  placeholder="Enter qty"
                                  disabled={saving}
                                  title={`Max: ${availableBalance.toFixed(2)} | Pending: ${selectedOrderForBatch.PendingQty || '-'}`}
                                />
                              </td>
                              <td className="text-right">{netDisplay}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="batch-selection-total-row">
                          <td colSpan={4} style={{textAlign: 'left'}}><strong>Total Delivery Qty:</strong></td>
                          <td style={{textAlign: 'center'}}>
                            <strong>{getTotalBatchDeliveryQty(selectedOrderForBatch)}</strong>
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Config Modal */}
      {showConfigModal && (
        <div className="modal-overlay" onClick={() => {
          // Reset temp state if user clicks outside
          setTempSectionVisibility(sectionVisibility);
          setTempAgeingBuckets(ageingBuckets);
          setTempBatchXmlFormat(batchXmlFormat);
          setTempAllowNegativeStock(allowNegativeStock);
          setTempAllowDeliveryExceedOrder(allowDeliveryExceedOrder);
          setConfigModalTab('sections');
          setShowConfigModal(false);
        }}>
          <div className="config-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="config-modal-header">
              <h2>Section Visibility Configuration</h2>
              <button
                className="close-modal-button"
                onClick={() => {
                  // Reset temp state if user clicks X
                  setTempSectionVisibility(sectionVisibility);
                  setTempAgeingBuckets(ageingBuckets);
                  setTempBatchXmlFormat(batchXmlFormat);
                  setTempAllowNegativeStock(allowNegativeStock);
                setTempAllowDeliveryExceedOrder(allowDeliveryExceedOrder);
                  setConfigModalTab('sections');
                  setShowConfigModal(false);
                }}>
                ✕
              </button>
            </div>
            <div className="config-modal-body">
              <div className="config-tabs">
                <button
                  type="button"
                  className={`config-tab ${configModalTab === 'sections' ? 'active' : ''}`}
                  onClick={() => setConfigModalTab('sections')}
                >
                  Sections
                </button>
                <button
                  type="button"
                  className={`config-tab ${configModalTab === 'controls' ? 'active' : ''}`}
                  onClick={() => setConfigModalTab('controls')}
                >
                  Controls
                </button>
              </div>
              {configModalTab === 'sections' ? (
                <>
                  <div className="config-option">
                    <label className="config-checkbox-label">
                      <input
                        type="checkbox"
                        checked={tempSectionVisibility.outstanding}
                        onChange={(e) => setTempSectionVisibility({
                          ...tempSectionVisibility,
                          outstanding: e.target.checked,
                        })}
                      />
                      <span>Sales Orders Outstanding</span>
                    </label>
                  </div>
                  <div className="config-option">
                    <label className="config-checkbox-label">
                      <input
                        type="checkbox"
                        checked={tempSectionVisibility.cleared}
                        onChange={(e) => setTempSectionVisibility({
                          ...tempSectionVisibility,
                          cleared: e.target.checked,
                        })}
                      />
                      <span>Sales Orders Cleared</span>
                      <span className="config-hint">(Requires reload from Tally when enabled)</span>
                    </label>
                  </div>
                  <div className="config-option">
                    <label className="config-checkbox-label">
                      <input
                        type="checkbox"
                        checked={tempSectionVisibility.negativePending}
                        onChange={(e) => setTempSectionVisibility({
                          ...tempSectionVisibility,
                          negativePending: e.target.checked,
                        })}
                      />
                      <span>Goods delivered by Orders not received</span>
                    </label>
                  </div>
                  
                  <div className="config-option">
                    <label className="config-label">Order Ageing Buckets (days, comma-separated):</label>
                    <input
                      type="text"
                      className="config-input"
                      value={tempAgeingBuckets.join(', ')}
                      onChange={(e) => {
                        const value = e.target.value;
                        const buckets = value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n >= 0);
                        if (buckets.length > 0) {
                          setTempAgeingBuckets(buckets);
                        }
                      }}
                      placeholder="0, 7, 15, 30, 60"
                    />
                    <span className="config-hint">Enter bucket values (e.g., 0, 7, 15, 30, 60)</span>
                  </div>

                  <div className="config-option">
                    <label className="config-label">Batch XML Format:</label>
                    <div className="config-radio-group">
                      <label className="config-radio-label">
                        <input
                          type="radio"
                          name="batchXmlFormat"
                          value="single"
                          checked={tempBatchXmlFormat === 'single'}
                          onChange={() => setTempBatchXmlFormat('single')}
                        />
                        <span>Single entry with multiple batch allocations (Default)</span>
                      </label>
                      <label className="config-radio-label">
                        <input
                          type="radio"
                          name="batchXmlFormat"
                          value="separate"
                          checked={tempBatchXmlFormat === 'separate'}
                          onChange={() => setTempBatchXmlFormat('separate')}
                        />
                        <span>Separate entry for each batch</span>
                      </label>
                    </div>
                    <span className="config-hint">Choose how batches are structured in the delivery note XML</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="config-option">
                    <label className="config-label">Allow negative stock?</label>
                    <div className="config-radio-group config-radio-group-inline">
                      <label className="config-radio-label">
                        <input
                          type="radio"
                          name="allowNegativeStock"
                          value="yes"
                          checked={tempAllowNegativeStock === true}
                          onChange={() => setTempAllowNegativeStock(true)}
                        />
                        <span>Yes</span>
                      </label>
                      <label className="config-radio-label">
                        <input
                          type="radio"
                          name="allowNegativeStock"
                          value="no"
                          checked={tempAllowNegativeStock === false}
                          onChange={() => setTempAllowNegativeStock(false)}
                        />
                        <span>No</span>
                      </label>
                    </div>
                    <span className="config-hint">When enabled, delivery quantities may exceed available stock balances during Update Delivery.</span>
                  </div>
                  <div className="config-option">
                    <label className="config-label">Allow delivery Qty exceeding Order Qty?</label>
                    <div className="config-radio-group config-radio-group-inline">
                      <label className="config-radio-label">
                        <input
                          type="radio"
                          name="allowDeliveryExceedOrder"
                          value="yes"
                          checked={tempAllowDeliveryExceedOrder === true}
                          onChange={() => setTempAllowDeliveryExceedOrder(true)}
                        />
                        <span>Yes</span>
                      </label>
                      <label className="config-radio-label">
                        <input
                          type="radio"
                          name="allowDeliveryExceedOrder"
                          value="no"
                          checked={tempAllowDeliveryExceedOrder === false}
                          onChange={() => setTempAllowDeliveryExceedOrder(false)}
                        />
                        <span>No</span>
                      </label>
                    </div>
                    <span className="config-hint">Enable this when you need to dispatch quantities beyond the original order (or pending) amount.</span>
                  </div>
                </>
              )}
            </div>
            <div className="config-modal-actions">
              <button
                className="cancel-config-button"
                onClick={() => {
                  // Reset temp state and close
                  setTempSectionVisibility(sectionVisibility);
                  setTempAgeingBuckets(ageingBuckets);
                  setTempBatchXmlFormat(batchXmlFormat);
                  setTempAllowNegativeStock(allowNegativeStock);
                  setTempAllowDeliveryExceedOrder(allowDeliveryExceedOrder);
                  setConfigModalTab('sections');
                  setShowConfigModal(false);
                }}>
                Cancel
              </button>
              <button
                className="save-config-button"
                onClick={async () => {
                  const wasClearedEnabled = sectionVisibility.cleared;
                  const isClearedEnabled = tempSectionVisibility.cleared;
                  
                  // Apply the visibility changes
                  setSectionVisibility(tempSectionVisibility);
                  // Apply ageing buckets
                  setAgeingBuckets(tempAgeingBuckets);
                  localStorage.setItem('companyOrdersAgeingBuckets', JSON.stringify(tempAgeingBuckets));
                  // Apply batch XML format
                  setBatchXmlFormat(tempBatchXmlFormat);
                  localStorage.setItem('companyOrdersBatchXmlFormat', tempBatchXmlFormat);
                  // Apply negative stock control
                  setAllowNegativeStock(tempAllowNegativeStock);
                  localStorage.setItem('companyOrdersAllowNegativeStock', tempAllowNegativeStock ? 'true' : 'false');
                  // Apply delivery > order control
                  setAllowDeliveryExceedOrder(tempAllowDeliveryExceedOrder);
                  localStorage.setItem('companyOrdersAllowDeliveryExceedOrder', tempAllowDeliveryExceedOrder ? 'true' : 'false');
                  
                  // Only reload from Tally if enabling cleared orders (not when disabling)
                  if (!wasClearedEnabled && isClearedEnabled) {
                    // Enabling cleared orders - need to reload with DLOrdAll
                    // Pass the new value directly since state update is async
                    await loadOrders(true);
                  }
                  // If disabling cleared orders, just hide the section (no reload needed)
                  
                  setShowConfigModal(false);
                  setConfigModalTab('sections');
                }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {successDialogMessage && (
        <div className="modal-overlay" onClick={() => setSuccessDialogMessage(null)}>
          <div className="message-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Delivery Posted</h3>
            <p>{successDialogMessage}</p>
            <div className="message-dialog-actions">
              <button
                className="save-order-button"
                type="button"
                onClick={() => setSuccessDialogMessage(null)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyOrdersScreen;


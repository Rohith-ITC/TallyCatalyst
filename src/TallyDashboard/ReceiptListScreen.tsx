import React, {useState, useEffect, useMemo, useCallback, useRef} from 'react';
import {apiService} from '../utils/receiptApiAdapter';
import type {Company, ReceiptVoucher} from '../utils/receiptApiTypes';
import {splitDateRangeIntoChunks, formatDateForInput, formatDateDisplay} from '../utils/dateUtils';
import {exportReceiptsToExcel} from '../utils/receiptExportUtils';
import {importReceiptsFromExcel} from '../utils/receiptImportUtils';
import {useIsMobile} from './MobileViewConfig';
import './ReceiptListScreen.css';

interface ReceiptListScreenProps {
  company: Company;
  onBack: () => void;
}

const ITEMS_PER_PAGE = 20;

export const ReceiptListScreen: React.FC<ReceiptListScreenProps> = ({
  company,
  onBack,
}) => {
  const isMobile = useIsMobile();
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  // Date ranges for different operations
  const [cacheFromDate, setCacheFromDate] = useState(formatDateForInput(firstDayOfMonth));
  const [cacheToDate, setCacheToDate] = useState(formatDateForInput(today));
  const [ledgerFromDate, setLedgerFromDate] = useState(formatDateForInput(firstDayOfMonth));
  const [ledgerToDate, setLedgerToDate] = useState(formatDateForInput(today));
  
  const [ledgerName, setLedgerName] = useState('');
  const [allReceipts, setAllReceipts] = useState<ReceiptVoucher[]>([]); // All receipts from Tally (for cache)
  const [ledgerReceipts, setLedgerReceipts] = useState<ReceiptVoucher[]>([]); // Receipts from selected ledger
  const [cacheReceipts, setCacheReceipts] = useState<ReceiptVoucher[]>([]); // Receipts from cache (full history)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalChunks, setTotalChunks] = useState(0);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [chunksProcessed, setChunksProcessed] = useState(0);
  
  // Filter states
  const [filters, setFilters] = useState({
    date: '',
    voucherNo: '',
    customer: '',
    amount: '',
    narration: '',
    periodFrom: '',
    periodTo: '',
  });

  // State for expanded receipts and their matches with matching words
  interface ReceiptMatch {
    receipt: ReceiptVoucher;
    matchingWords: string[];
  }
  
  interface ExpandedReceiptState {
    matches: ReceiptMatch[];
    isLoading: boolean;
    progress?: number; // Progress percentage (0-100)
  }
  
  const [expandedReceipts, setExpandedReceipts] = useState<{
    [key: string]: ExpandedReceiptState;
  }>({});
  
  const [findAllMode, setFindAllMode] = useState(false);
  const [findAllProgress, setFindAllProgress] = useState(0);
  const [findAllLoading, setFindAllLoading] = useState(false);
  const findAllCancelRef = useRef(false);
  
  // Cache state
  const [useCache, setUseCache] = useState(false);
  const [cacheMetadata, setCacheMetadata] = useState<{
    company?: string;
    exportDate?: string;
    fromDate?: string;
    toDate?: string;
    totalReceipts?: number;
    fileCount?: number;
    fileNames?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Excluded strings state - load from localStorage or use defaults
  const defaultExcludedStrings = [
    'UPI',
    'UPI SETTLEMENT',
    'PAYMENT FROM PHONE',
    'payment',
    'TPT',
    'IMPS',
    'CNRB',
    'FT',
    'ESCROW',
    'RAZORPAY SOFTWARE PVT LTD',
    '50200101395703',
    'NEFT CR',
    'SBIN',
    'REQPAY',
    'BILL',
  ];
  
  const [excludedStrings, setExcludedStrings] = useState<string[]>(() => {
    const saved = localStorage.getItem('excludedStrings');
    return saved ? JSON.parse(saved) : defaultExcludedStrings;
  });
  
  const [showExcludedStringsConfig, setShowExcludedStringsConfig] = useState(false);
  const [newExcludedString, setNewExcludedString] = useState('');
  
  // Slice days settings - load from localStorage or use defaults
  const [cacheSliceDays, setCacheSliceDays] = useState<number>(() => {
    const saved = localStorage.getItem('cacheSliceDays');
    return saved ? parseInt(saved, 10) : 5;
  });
  const [ledgerSliceDays, setLedgerSliceDays] = useState<number>(() => {
    const saved = localStorage.getItem('ledgerSliceDays');
    return saved ? parseInt(saved, 10) : 5;
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Fetch all receipts from Tally (for cache download/load)
  const fetchAllReceipts = async () => {
    if (!cacheFromDate || !cacheToDate) {
      alert('Please select both from and to dates for cache period');
      return;
    }

    const from = new Date(cacheFromDate);
    const to = new Date(cacheToDate);

    if (from > to) {
      alert('From date cannot be greater than To date');
      return;
    }

    setLoading(true);
    setError(null);
    setAllReceipts([]);
    setCurrentPage(1);
    setCurrentChunk(0);
    setChunksProcessed(0);

    try {
      // Split date range into chunks using configured slice days
      const chunks = splitDateRangeIntoChunks(from, to, cacheSliceDays);
      setTotalChunks(chunks.length);

      if (chunks.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch receipts for all chunks
      const receipts: ReceiptVoucher[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        setCurrentChunk(i + 1);

        try {
          const chunkReceipts = await apiService.getReceiptVouchers(
            company.tallyloc_id,
            company.company || company.conn_name,
            company.guid,
            chunk.from.toISOString().split('T')[0],
            chunk.to.toISOString().split('T')[0],
          );

          receipts.push(...chunkReceipts);
          setChunksProcessed(i + 1);
        } catch (chunkError: any) {
          console.error(`Error fetching chunk ${i + 1}:`, chunkError);
          // Continue with other chunks even if one fails
        }
      }

      // Sort receipts by date (newest first)
      receipts.sort((a, b) => {
        const dateA = a.Dates ? new Date(a.Dates).getTime() : 0;
        const dateB = b.Dates ? new Date(b.Dates).getTime() : 0;
        return dateB - dateA;
      });

      setAllReceipts(receipts);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch receipts');
      console.error('Fetch receipts error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch receipts for selected ledger from Tally
  const fetchLedgerReceipts = async () => {
    if (!ledgerName || !ledgerName.trim()) {
      alert('Please enter a ledger name');
      return;
    }

    if (!ledgerFromDate || !ledgerToDate) {
      alert('Please select both from and to dates for ledger period');
      return;
    }

    const from = new Date(ledgerFromDate);
    const to = new Date(ledgerToDate);

    if (from > to) {
      alert('From date cannot be greater than To date');
      return;
    }

    setLoading(true);
    setError(null);
    setLedgerReceipts([]);
    setCurrentPage(1);
    setCurrentChunk(0);
    setChunksProcessed(0);
    // Reset filters when new search is performed
    setFilters({date: '', voucherNo: '', customer: '', amount: '', narration: '', periodFrom: '', periodTo: ''});
    // Clear expanded receipts
    setExpandedReceipts({});
    // Reset find all mode
    setFindAllMode(false);
    setFindAllProgress(0);
    setFindAllLoading(false);

    try {
      // Split date range into chunks using configured slice days
      const chunks = splitDateRangeIntoChunks(from, to, ledgerSliceDays);
      setTotalChunks(chunks.length);

      if (chunks.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch receipts for all chunks
      const receipts: ReceiptVoucher[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        setCurrentChunk(i + 1);

        try {
          const chunkReceipts = await apiService.getReceiptsForLedger(
            company.tallyloc_id,
            company.company || company.conn_name,
            company.guid,
            ledgerName.trim(),
            chunk.from.toISOString().split('T')[0],
            chunk.to.toISOString().split('T')[0],
          );

          receipts.push(...chunkReceipts);
          setChunksProcessed(i + 1);
        } catch (chunkError: any) {
          console.error(`Error fetching chunk ${i + 1}:`, chunkError);
          // Continue with other chunks even if one fails
        }
      }

      // Sort receipts by date (newest first)
      receipts.sort((a, b) => {
        const dateA = a.Dates ? new Date(a.Dates).getTime() : 0;
        const dateB = b.Dates ? new Date(b.Dates).getTime() : 0;
        return dateB - dateA;
      });

      setLedgerReceipts(receipts);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch ledger receipts');
      console.error('Fetch ledger receipts error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get unique customers from ledger receipts
  const uniqueCustomers = useMemo(() => {
    const customers = new Set<string>();
    ledgerReceipts.forEach((receipt) => {
      if (receipt.Customer && receipt.Customer.trim()) {
        customers.add(receipt.Customer);
      }
    });
    return Array.from(customers).sort();
  }, [ledgerReceipts]);

  // Helper function to check if a date string falls within a period
  const isDateInPeriod = useCallback((dateStr: string, periodFrom: string, periodTo: string): boolean => {
    if (!periodFrom && !periodTo) return true; // No period filter
    if (!dateStr) return false;
    
    try {
      const receiptDate = new Date(dateStr);
      if (isNaN(receiptDate.getTime())) return false;
      
      if (periodFrom) {
        const fromDate = new Date(periodFrom);
        if (receiptDate < fromDate) return false;
      }
      
      if (periodTo) {
        const toDate = new Date(periodTo);
        toDate.setHours(23, 59, 59, 999); // Include the entire end date
        if (receiptDate > toDate) return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }, []);

  // Filter ledger receipts based on filter inputs (including period filter)
  // After Find All, only show receipts that have matches
  const filteredReceipts = useMemo(() => {
    let filtered = ledgerReceipts.filter((receipt) => {
      const dateMatch = !filters.date || 
        (receipt.Dates && receipt.Dates.toLowerCase().includes(filters.date.toLowerCase())) ||
        (receipt.Dates && formatDateDisplay(receipt.Dates).toLowerCase().includes(filters.date.toLowerCase()));
      
      const voucherNoMatch = !filters.voucherNo || 
        (receipt.InvNo && receipt.InvNo.toLowerCase().includes(filters.voucherNo.toLowerCase()));
      
      // Customer filter: empty string or "all" means show all, otherwise exact match
      const customerMatch = !filters.customer || 
        filters.customer === 'all' ||
        (receipt.Customer && receipt.Customer === filters.customer);
      
      const amountMatch = !filters.amount || 
        (receipt.Amount && formatAmount(receipt.Amount).includes(filters.amount));
      
      const narrationMatch = !filters.narration || 
        (receipt.Narration && receipt.Narration.toLowerCase().includes(filters.narration.toLowerCase()));
      
      // Period filter: filter by date range
      const periodMatch = isDateInPeriod(receipt.Dates || '', filters.periodFrom, filters.periodTo);
      
      return dateMatch && voucherNoMatch && customerMatch && amountMatch && narrationMatch && periodMatch;
    });
    
    // After Find All completes, only show receipts that have matches
    if (findAllMode && Object.keys(expandedReceipts).length > 0) {
      filtered = filtered.filter((receipt) => {
        const receiptKey = receipt.MasterID || `${receipt.Dates}-${receipt.InvNo}`;
        const expandedState = expandedReceipts[receiptKey];
        // Only include if it has matches (not just loading state)
        return expandedState && expandedState.matches && expandedState.matches.length > 0;
      });
    }
    
    return filtered;
  }, [ledgerReceipts, filters, findAllMode, expandedReceipts, isDateInPeriod]);

  // Calculate receipts count before Find All filtering (for display purposes)
  const receiptsBeforeFindAll = useMemo(() => {
    return ledgerReceipts.filter((receipt) => {
      const dateMatch = !filters.date || 
        (receipt.Dates && receipt.Dates.toLowerCase().includes(filters.date.toLowerCase())) ||
        (receipt.Dates && formatDateDisplay(receipt.Dates).toLowerCase().includes(filters.date.toLowerCase()));
      
      const voucherNoMatch = !filters.voucherNo || 
        (receipt.InvNo && receipt.InvNo.toLowerCase().includes(filters.voucherNo.toLowerCase()));
      
      // Customer filter: empty string or "all" means show all, otherwise exact match
      const customerMatch = !filters.customer || 
        filters.customer === 'all' ||
        (receipt.Customer && receipt.Customer === filters.customer);
      
      const amountMatch = !filters.amount || 
        (receipt.Amount && formatAmount(receipt.Amount).includes(filters.amount));
      
      const narrationMatch = !filters.narration || 
        (receipt.Narration && receipt.Narration.toLowerCase().includes(filters.narration.toLowerCase()));
      
      // Period filter: filter by date range
      const periodMatch = isDateInPeriod(receipt.Dates || '', filters.periodFrom, filters.periodTo);
      
      return dateMatch && voucherNoMatch && customerMatch && amountMatch && narrationMatch && periodMatch;
    });
  }, [ledgerReceipts, filters, isDateInPeriod]);

  // Pagination calculations (on filtered receipts)
  const totalPages = Math.ceil(filteredReceipts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentReceipts = filteredReceipts.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.date, filters.voucherNo, filters.customer, filters.amount, filters.narration]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const formatAmount = (amount: string | undefined): string => {
    if (!amount) return '0.00';
    const num = parseFloat(amount);
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Save excluded strings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('excludedStrings', JSON.stringify(excludedStrings));
  }, [excludedStrings]);
  
  // Handler functions for excluded strings management
  const handleAddExcludedString = () => {
    const trimmed = newExcludedString.trim();
    if (trimmed && !excludedStrings.includes(trimmed)) {
      setExcludedStrings([...excludedStrings, trimmed]);
      setNewExcludedString('');
      
      // Auto-rerun Find All if it was already running or if there are expanded receipts
      const shouldRerunFindAll = findAllMode || Object.keys(expandedReceipts).length > 0;
      if (shouldRerunFindAll && filteredReceipts.length > 0) {
        // Use setTimeout to ensure state update is processed first
        setTimeout(() => {
          handleFindAll(true); // Pass true to skip cancel check
        }, 100);
      }
    }
  };
  
  const handleRemoveExcludedString = (str: string) => {
    setExcludedStrings(excludedStrings.filter(s => s !== str));
  };
  
  const handleResetExcludedStrings = () => {
    if (window.confirm('Reset to default excluded strings?')) {
      setExcludedStrings(defaultExcludedStrings);
    }
  };
  
  // Handler to add a word to excluded strings when clicked
  const handleExcludeWord = (word: string) => {
    const trimmed = word.trim();
    if (trimmed && !excludedStrings.includes(trimmed)) {
      setExcludedStrings([...excludedStrings, trimmed]);
      // Show a brief notification
      const notification = document.createElement('div');
      notification.textContent = `"${trimmed}" added to excluded strings`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #28a745;
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-size: 14px;
        font-weight: 600;
        animation: slideIn 0.3s ease-out;
      `;
      document.body.appendChild(notification);
      setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 300);
      }, 2000);
      
      // Auto-rerun Find All if it was already running or if there are expanded receipts
      const shouldRerunFindAll = findAllMode || Object.keys(expandedReceipts).length > 0;
      if (shouldRerunFindAll && filteredReceipts.length > 0) {
        // Use setTimeout to ensure state update is processed first
        setTimeout(() => {
          handleFindAll(true); // Pass true to skip cancel check
        }, 100);
      }
    } else if (trimmed && excludedStrings.includes(trimmed)) {
      // Word is already excluded
      const notification = document.createElement('div');
      notification.textContent = `"${trimmed}" is already excluded`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #ffc107;
        color: #333;
        padding: 12px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-size: 14px;
        font-weight: 600;
        animation: slideIn 0.3s ease-out;
      `;
      document.body.appendChild(notification);
      setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 300);
      }, 2000);
    }
  };

  // Helper function to extract segments (without common exclusion for counting)
  const extractSegmentsBasic = useCallback((narration: string): string[] => {
    if (!narration) return [];
    const parts = narration.split('-').map(part => part.trim()).filter(part => part.length > 0);
    
    // Only filter out exclusion list
    return parts.filter(part => {
      const partLower = part.toLowerCase();
      return !excludedStrings.some(excluded => 
        partLower === excluded.toLowerCase()
      );
    });
  }, [excludedStrings]);

  // Get receipts to use for searching - use cache receipts but exclude receipts from selected ledger
  // This allows finding matches across the entire cache history, excluding the ledger being analyzed
  const receiptsForSearch = useMemo(() => {
    if (!ledgerName || ledgerReceipts.length === 0) {
      return cacheReceipts; // If no ledger selected, search all cache
    }
    
    // Create a set of MasterIDs from ledger receipts for fast lookup
    const ledgerMasterIds = new Set(
      ledgerReceipts
        .map(r => r.MasterID)
        .filter(id => id !== undefined && id !== '')
    );
    
    // Also create a set of date+voucher combinations for receipts without MasterID
    const ledgerKeys = new Set(
      ledgerReceipts
        .map(r => r.MasterID || `${r.Dates}-${r.InvNo}`)
        .filter(key => key !== '-')
    );
    
    // Filter out receipts that match the selected ledger
    return cacheReceipts.filter(receipt => {
      const receiptKey = receipt.MasterID || `${receipt.Dates}-${receipt.InvNo}`;
      return !ledgerKeys.has(receiptKey);
    });
  }, [cacheReceipts, ledgerReceipts, ledgerName]);

  // Memoize common segments calculation - only recalculate when receipts change
  const commonSegments = useMemo(() => {
    const segmentCounts = new Map<string, number>();
    const receiptsToUse = receiptsForSearch;
    
    receiptsToUse.forEach((receipt) => {
      if (receipt.Narration) {
        // Extract segments without excluding common ones
        // Only exclude static exclusion list
        const segments = extractSegmentsBasic(receipt.Narration);
        const uniqueSegments = new Set(segments.map(s => s.toLowerCase()));
        uniqueSegments.forEach(segment => {
          segmentCounts.set(segment, (segmentCounts.get(segment) || 0) + 1);
        });
      }
    });
    
    // Find segments that appear in more than 20 receipts
    const common = new Set<string>();
    segmentCounts.forEach((count, segment) => {
      if (count > 20) {
        common.add(segment);
      }
    });
    
    return common;
  }, [receiptsForSearch, extractSegmentsBasic]);

  // Extract words between "-" characters from narration
  // Excludes certain common strings that shouldn't be used for matching
  // Also excludes segments that appear in more than 20 receipts
  const extractWordsBetweenDashes = useCallback((narration: string, excludeCommon: boolean = false): string[] => {
    if (!narration) return [];
    // Split by "-" and filter out empty strings and trim whitespace
    const parts = narration.split('-').map(part => part.trim()).filter(part => part.length > 0);
    
    // Filter out excluded strings (case-insensitive) and common segments
    const filteredParts = parts.filter(part => {
      const partLower = part.toLowerCase();
      
      // Check against exclusion list
      const isExcluded = excludedStrings.some(excluded => 
        partLower === excluded.toLowerCase()
      );
      
      if (isExcluded) return false;
      
      // Check against common segments (appear in >20 receipts)
      if (excludeCommon && commonSegments.has(partLower)) {
        return false;
      }
      
      return true;
    });
    
    return filteredParts;
  }, [commonSegments, excludedStrings]);

  // Handle Excel cache file upload (single or multiple files)
  const handleLoadCache = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Validate all files are Excel files
    const invalidFiles = Array.from(files).filter(
      file => !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')
    );
    
    if (invalidFiles.length > 0) {
      alert(`Please select only Excel files (.xlsx or .xls).\nInvalid files: ${invalidFiles.map(f => f.name).join(', ')}`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fileArray = Array.from(files);
      const results = await Promise.all(
        fileArray.map(file => importReceiptsFromExcel(file))
      );

      // Merge all receipts from all files
      const allReceipts: ReceiptVoucher[] = [];
      const allMetadata: Array<{company?: string; exportDate?: string; fromDate?: string; toDate?: string; totalReceipts?: number; fileName?: string}> = [];
      
      results.forEach((result, index) => {
        allReceipts.push(...result.receipts);
        allMetadata.push({
          ...result.metadata,
          fileName: fileArray[index].name,
        });
      });

      // Remove duplicate receipts based on MasterID or combination of Dates + InvNo
      const uniqueReceipts = allReceipts.filter((receipt, index, self) => {
        const key = receipt.MasterID || `${receipt.Dates}-${receipt.InvNo}`;
        return index === self.findIndex(r => (r.MasterID || `${r.Dates}-${r.InvNo}`) === key);
      });

      // Combine metadata
      const combinedMetadata = {
        company: allMetadata[0]?.company || 'Multiple Files',
        exportDate: allMetadata.map(m => m.exportDate).filter(Boolean).join(', '),
        fromDate: allMetadata.map(m => m.fromDate).filter(Boolean).sort()[0] || '',
        toDate: allMetadata.map(m => m.toDate).filter(Boolean).sort().reverse()[0] || '',
        totalReceipts: uniqueReceipts.length,
        fileCount: fileArray.length,
        fileNames: fileArray.map(f => f.name).join(', '),
      };

      setCacheReceipts(uniqueReceipts);
      setCacheMetadata(combinedMetadata);
      setUseCache(true);
      setCurrentPage(1);
      setFilters({date: '', voucherNo: '', customer: '', amount: '', narration: '', periodFrom: '', periodTo: ''});
      setExpandedReceipts({});
      setFindAllMode(false);
      setFindAllProgress(0);
      setFindAllLoading(false);
      
      // Update cache date range from combined metadata if available
      if (combinedMetadata.fromDate) {
        setCacheFromDate(combinedMetadata.fromDate);
      }
      if (combinedMetadata.toDate) {
        setCacheToDate(combinedMetadata.toDate);
      }

      // Show success message
      alert(`Successfully loaded ${fileArray.length} file(s)!\n\nTotal unique receipts: ${uniqueReceipts.length}\nFiles: ${fileArray.map(f => f.name).join(', ')}`);
    } catch (err: any) {
      setError(err.message || 'Failed to load cache file(s)');
      console.error('Load cache error:', err);
      alert(`Error loading cache files: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadCache = () => {
    // Use allReceipts if available (from Tally), otherwise use cacheReceipts (from loaded Excel)
    const receiptsToExport = allReceipts.length > 0 ? allReceipts : cacheReceipts;
    
    if (receiptsToExport.length === 0) {
      alert('No receipts to download. Please fetch receipts from Tally or load cache first.');
      return;
    }

    // Use appropriate date range
    const exportFromDate = allReceipts.length > 0 
      ? cacheFromDate 
      : (cacheMetadata?.fromDate || cacheFromDate);
    const exportToDate = allReceipts.length > 0 
      ? cacheToDate 
      : (cacheMetadata?.toDate || cacheToDate);

    exportReceiptsToExcel({
      receipts: receiptsToExport,
      company,
      fromDate: exportFromDate,
      toDate: exportToDate,
    });
  };

  const handleClearCache = () => {
    setUseCache(false);
    setCacheMetadata(null);
    setCacheReceipts([]);
    setCurrentPage(1);
    setFilters({date: '', voucherNo: '', customer: '', amount: '', narration: '', periodFrom: '', periodTo: ''});
    setExpandedReceipts({});
    setFindAllMode(false);
    setFindAllProgress(0);
    setFindAllLoading(false);
  };

  // Find matching receipts based on full strings between dashes
  // Searches through ALL receipts (not just filtered ones) to find matches
  // Matches must be exact (case-insensitive) - full string between dashes must match
  // Excludes segments that appear in more than 20 receipts
  // Optimized with useCallback, Sets for O(1) lookup, and early returns
  const findMatchingReceipts = useCallback((currentReceipt: ReceiptVoucher): ReceiptMatch[] => {
    if (!currentReceipt.Narration) return [];
    
    // Extract segments excluding common ones (appear in >20 receipts)
    const searchSegments = extractWordsBetweenDashes(currentReceipt.Narration, true);
    if (searchSegments.length === 0) return [];

    // Create a Set for faster O(1) lookup (case-insensitive)
    const searchSegmentsLower = new Set(searchSegments.map(s => s.toLowerCase().trim()));

    const matches: ReceiptMatch[] = [];
    const currentMasterID = currentReceipt.MasterID;
    
    // Search through all receipts (use receiptsForSearch which includes cache)
    // Using for loop for better performance than forEach
    for (let i = 0; i < receiptsForSearch.length; i++) {
      const receipt = receiptsForSearch[i];
      
      // Skip the current receipt itself
      if (receipt.MasterID === currentMasterID) continue;
      
      if (!receipt.Narration) continue;
      
      // Extract full strings between dashes from this receipt's narration
      // Also exclude common segments
      const receiptSegments = extractWordsBetweenDashes(receipt.Narration, true);
      
      // Find which segments matched exactly (case-insensitive)
      const matchingWords: string[] = [];
      const matchedLower = new Set<string>(); // Track matched segments to avoid duplicates
      
      for (let j = 0; j < receiptSegments.length; j++) {
        const receiptSegment = receiptSegments[j];
        const receiptLower = receiptSegment.toLowerCase().trim();
        
        // Check if this segment matches any search segment (O(1) lookup)
        if (searchSegmentsLower.has(receiptLower)) {
          // Avoid duplicate matches
          if (!matchedLower.has(receiptLower)) {
            matchedLower.add(receiptLower);
            matchingWords.push(receiptSegment);
          }
        }
      }
      
      if (matchingWords.length > 0) {
        matches.push({
          receipt,
          matchingWords,
        });
      }
    }

    return matches;
  }, [receiptsForSearch, extractWordsBetweenDashes]);

  // Highlight matching words in text and make them clickable to exclude
  const highlightMatchingWords = (text: string, matchingWords: string[]): React.ReactNode => {
    if (!text || matchingWords.length === 0) return text;
    
    // Create a map of original words (case-sensitive) to their lowercase versions
    // This helps us find the original case of the word when clicked
    const wordMap = new Map<string, string>();
    matchingWords.forEach(word => {
      wordMap.set(word.toLowerCase(), word);
    });
    
    // Create a regex pattern that matches any of the matching words (case-insensitive)
    // Escape special regex characters in the words
    const escapedWords = matchingWords.map(word => 
      word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    const pattern = new RegExp(`(${escapedWords.join('|')})`, 'gi');
    
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const matches: Array<{index: number; length: number; text: string; originalWord: string}> = [];
    
    // Find all matches first
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Find the original word (with original case) from the matchingWords array
      const originalWord = wordMap.get(match[0].toLowerCase()) || match[0];
      matches.push({
        index: match.index,
        length: match[0].length,
        text: match[0],
        originalWord: originalWord,
      });
      
      // Prevent infinite loop if the regex matches empty string
      if (match[0].length === 0) {
        pattern.lastIndex++;
      }
    }
    
    // Build the highlighted text
    matches.forEach((matchInfo, idx) => {
      // Add text before the match
      if (matchInfo.index > lastIndex) {
        parts.push(text.substring(lastIndex, matchInfo.index));
      }
      
      // Add the highlighted match as clickable
      parts.push(
        <mark
          key={`highlight-${idx}-${matchInfo.index}`}
          className="highlighted-word clickable-highlight"
          onClick={(e) => {
            e.stopPropagation();
            handleExcludeWord(matchInfo.originalWord);
          }}
          title={`Click to exclude "${matchInfo.originalWord}" from matching`}>
          {matchInfo.text}
        </mark>
      );
      
      lastIndex = matchInfo.index + matchInfo.length;
    });
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return parts.length > 0 ? <>{parts}</> : text;
  };

  // Handle find matches button click with async chunked processing to prevent UI blocking
  const handleFindMatches = (receipt: ReceiptVoucher) => {
    const receiptKey = receipt.MasterID || `${receipt.Dates}-${receipt.InvNo}`;
    const currentState = expandedReceipts[receiptKey];
    
    // If already expanded and loaded, collapse it
    if (currentState && !currentState.isLoading) {
      const newExpanded = {...expandedReceipts};
      delete newExpanded[receiptKey];
      setExpandedReceipts(newExpanded);
      return;
    }
    
    // Show loading state immediately
    setExpandedReceipts({
      ...expandedReceipts,
      [receiptKey]: { matches: [], isLoading: true },
    });
    
    // Process asynchronously in chunks to prevent UI blocking
    // For large datasets, process in batches
    if (!receipt.Narration) {
      setExpandedReceipts(prev => ({
        ...prev,
        [receiptKey]: { matches: [], isLoading: false },
      }));
      return;
    }
    
    const searchSegments = extractWordsBetweenDashes(receipt.Narration, true);
    if (searchSegments.length === 0) {
      setExpandedReceipts(prev => ({
        ...prev,
        [receiptKey]: { matches: [], isLoading: false },
      }));
      return;
    }
    
    const searchSegmentsLower = new Set(searchSegments.map(s => s.toLowerCase().trim()));
    const matches: ReceiptMatch[] = [];
    const currentMasterID = receipt.MasterID;
    const CHUNK_SIZE = 100; // Process 100 receipts at a time
    let currentIndex = 0;
    
    const processChunk = () => {
      const receiptsToProcess = receiptsForSearch;
      const endIndex = Math.min(currentIndex + CHUNK_SIZE, receiptsToProcess.length);
      
      for (let i = currentIndex; i < endIndex; i++) {
        const receiptItem = receiptsToProcess[i];
        
        if (receiptItem.MasterID === currentMasterID) continue;
        if (!receiptItem.Narration) continue;
        
        const receiptSegments = extractWordsBetweenDashes(receiptItem.Narration, true);
        const matchingWords: string[] = [];
        const matchedLower = new Set<string>();
        
        for (let j = 0; j < receiptSegments.length; j++) {
          const receiptSegment = receiptSegments[j];
          const receiptLower = receiptSegment.toLowerCase().trim();
          
          if (searchSegmentsLower.has(receiptLower)) {
            if (!matchedLower.has(receiptLower)) {
              matchedLower.add(receiptLower);
              matchingWords.push(receiptSegment);
            }
          }
        }
        
        if (matchingWords.length > 0) {
          matches.push({
            receipt: receiptItem,
            matchingWords,
          });
        }
      }
      
      currentIndex = endIndex;
      
      // Update UI with current progress
      const progress = Math.round((currentIndex / receiptsToProcess.length) * 100);
      setExpandedReceipts(prev => ({
        ...prev,
        [receiptKey]: { 
          matches: [...matches], 
          isLoading: currentIndex < receiptsToProcess.length,
          progress,
        },
      }));
      
      // Continue processing if there are more receipts
      if (currentIndex < receiptsToProcess.length) {
        requestAnimationFrame(() => {
          setTimeout(processChunk, 0);
        });
      }
    };
    
    // Start processing
    requestAnimationFrame(() => {
      setTimeout(processChunk, 0);
    });
  };

  // Handle Find All button - find matches for all receipts
  const handleFindAll = useCallback((skipCancelCheck: boolean = false) => {
    console.log('handleFindAll called, findAllLoading:', findAllLoading, 'filteredReceipts.length:', filteredReceipts.length);
    
    if (!skipCancelCheck && findAllLoading) {
      // Cancel if already running
      console.log('Cancelling Find All...');
      findAllCancelRef.current = true;
      setFindAllLoading(false);
      setFindAllProgress(0);
      setFindAllMode(false);
      return;
    }

    if (filteredReceipts.length === 0) {
      if (!skipCancelCheck) {
        alert('No receipts to process. Please search for receipts first.');
      }
      return;
    }

    findAllCancelRef.current = false;
    setFindAllLoading(true);
    setFindAllProgress(0);
    setFindAllMode(true);
    
    // Clear existing expanded receipts
    setExpandedReceipts({});
    
    // Process all filtered receipts
    const receiptsToProcess = [...filteredReceipts]; // Create a copy
    const results: { [key: string]: ExpandedReceiptState } = {};
    let processedCount = 0;
    const CHUNK_SIZE = 10; // Process 10 receipts per chunk for Find All
    
    const processChunk = (startIndex: number) => {
      console.log('processChunk called with startIndex:', startIndex, 'total:', receiptsToProcess.length);
      
      // Check if we should stop
      if (findAllCancelRef.current) {
        console.log('Cancelled, stopping...');
        setFindAllLoading(false);
        setFindAllProgress(0);
        setFindAllMode(false);
        return;
      }
      
      if (startIndex >= receiptsToProcess.length) {
        console.log('Finished processing all receipts');
        setFindAllLoading(false);
        setFindAllProgress(100);
        setExpandedReceipts(results);
        // Keep findAllMode true so filtering continues to work
        // setFindAllMode(false);
        return;
      }
      
      const endIndex = Math.min(startIndex + CHUNK_SIZE, receiptsToProcess.length);
      console.log(`Processing chunk ${startIndex} to ${endIndex - 1}`);
      
      // Process chunk of receipts
      for (let i = startIndex; i < endIndex; i++) {
        if (findAllCancelRef.current) break;
        
        const receipt = receiptsToProcess[i];
        const receiptKey = receipt.MasterID || `${receipt.Dates}-${receipt.InvNo}`;
        
        // Find matches for this receipt
        const matches = findMatchingReceipts(receipt);
        
        // Only add if there are matches
        if (matches.length > 0) {
          results[receiptKey] = {
            matches,
            isLoading: false,
          };
          console.log(`Found ${matches.length} matches for receipt ${receiptKey}`);
        }
        
        processedCount++;
      }
      
      const progress = Math.round((processedCount / receiptsToProcess.length) * 100);
      setFindAllProgress(progress);
      console.log(`Progress: ${progress}% (${processedCount}/${receiptsToProcess.length})`);
      
      // Update results incrementally
      setExpandedReceipts({...results});
      
      // Process next chunk
      if (!findAllCancelRef.current) {
        requestAnimationFrame(() => {
          setTimeout(() => processChunk(endIndex), 0);
        });
      } else {
        setFindAllLoading(false);
        setFindAllProgress(0);
        setFindAllMode(false);
      }
    };
    
    // Start processing
    console.log('Starting Find All processing...', 'Total receipts to process:', receiptsToProcess.length);
    
    // Use a small delay to ensure state is updated
    setTimeout(() => {
      console.log('Starting processChunk(0)...');
      processChunk(0);
    }, 100);
  }, [findAllLoading, filteredReceipts, findMatchingReceipts]);

  return (
    <div className="receipt-list-container">
      <div className="receipt-list-content">
        {/* Header Section */}
        <div className="receipt-header-section">
          <h1 className="receipt-main-title">
            <span className="material-icons" style={{ fontSize: isMobile ? '24px' : '32px', color: '#3b82f6' }}>
              search
            </span>
            Receipt Find Party
          </h1>
          <p className="receipt-subtitle">
            Find and match receipts by comparing narration text across your receipt history
          </p>
          <div className="receipt-header-actions">
            <button
              onClick={() => setShowHelp(true)}
              className="header-action-button"
              title="View help and instructions">
              <span>❓</span>
              <span>Help</span>
            </button>
            <button
              onClick={() => setShowExcludedStringsConfig(true)}
              className="header-action-button"
              title="Configure excluded strings for matching">
              <span>⚙️</span>
              <span>Excluded Strings</span>
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="header-action-button"
              title="Configure settings">
              <span>⚙️</span>
              <span>Settings</span>
            </button>
          </div>
        </div>
        {/* Section 1: Get All Receipts from Tally, Download, and Load Cache */}
        <div className="date-filter-section" style={{marginBottom: isMobile ? '16px' : '20px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px'}}>
            <span className="material-icons" style={{fontSize: '28px', color: '#10b981'}}>download</span>
            <h3 style={{margin: 0, fontSize: isMobile ? '16px' : '18px', fontWeight: 600, color: '#1e293b'}}>Get All Receipts from Tally (for Cache)</h3>
          </div>
          <div className="date-inputs">
            <div className="date-input-group">
              <label htmlFor="cacheFromDate" className="date-label">From Date</label>
              <input
                id="cacheFromDate"
                type="date"
                className="date-input"
                value={cacheFromDate}
                onChange={(e) => setCacheFromDate(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="date-input-group">
              <label htmlFor="cacheToDate" className="date-label">To Date</label>
              <input
                id="cacheToDate"
                type="date"
                className="date-input"
                value={cacheToDate}
                onChange={(e) => setCacheToDate(e.target.value)}
                disabled={loading}
              />
            </div>
            <button
              onClick={fetchAllReceipts}
              className="search-button"
              disabled={loading}
              title="Fetch all receipts from Tally for the selected period">
              {loading ? 'Loading...' : 'Get All Receipts'}
            </button>
            <button
              onClick={handleDownloadCache}
              className="download-button"
              disabled={allReceipts.length === 0 || loading}
              title="Download receipts to Excel file">
              📥 Download Cache
            </button>
            <div style={{display: 'flex', gap: '8px', alignItems: 'flex-end'}}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleLoadCache}
                multiple
                style={{display: 'none'}}
                id="cache-file-input"
              />
              <label
                htmlFor="cache-file-input"
                className="load-cache-button"
                title="Load receipts from Excel cache file(s) - You can select multiple files">
                📂 Load Cache
              </label>
              {useCache && (
                <button
                  onClick={handleClearCache}
                  className="clear-cache-button"
                  title="Clear cache">
                  ✕ Clear Cache
                </button>
              )}
            </div>
          </div>
          {allReceipts.length > 0 && (
            <div style={{marginTop: '10px', fontSize: '14px', color: '#666'}}>
              Fetched <strong>{allReceipts.length}</strong> receipts from Tally. Click "Download Cache" to save to Excel, then "Load Cache" to load it.
            </div>
          )}
          {useCache && cacheReceipts.length > 0 && (
            <div style={{marginTop: '10px', fontSize: '14px', color: '#28a745', fontWeight: '600'}}>
              Cache loaded: <strong>{cacheReceipts.length}</strong> receipts available for matching.
            </div>
          )}
        </div>

        {/* Section 2: Get Ledger Receipts (for matching) */}
        <div className="date-filter-section" style={{marginBottom: isMobile ? '16px' : '20px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px'}}>
            <span className="material-icons" style={{fontSize: '28px', color: '#3b82f6'}}>search</span>
            <h3 style={{margin: 0, fontSize: isMobile ? '16px' : '18px', fontWeight: 600, color: '#1e293b'}}>Get Ledger Receipts (for Matching)</h3>
          </div>
          <div className="date-inputs">
            <div className="date-input-group">
              <label htmlFor="ledgerName" className="date-label">Ledger Name</label>
              <input
                id="ledgerName"
                type="text"
                className="date-input"
                value={ledgerName}
                onChange={(e) => setLedgerName(e.target.value)}
                placeholder="Enter ledger name"
                disabled={loading}
                style={{minWidth: '200px'}}
              />
            </div>
            <div className="date-input-group">
              <label htmlFor="ledgerFromDate" className="date-label">From Date</label>
              <input
                id="ledgerFromDate"
                type="date"
                className="date-input"
                value={ledgerFromDate}
                onChange={(e) => setLedgerFromDate(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="date-input-group">
              <label htmlFor="ledgerToDate" className="date-label">To Date</label>
              <input
                id="ledgerToDate"
                type="date"
                className="date-input"
                value={ledgerToDate}
                onChange={(e) => setLedgerToDate(e.target.value)}
                disabled={loading}
              />
            </div>
            <button
              onClick={fetchLedgerReceipts}
              className="search-button"
              disabled={loading || !ledgerName.trim()}
              title={!ledgerName.trim() ? 'Please enter a ledger name' : ''}>
              {loading ? 'Loading...' : 'Search Ledger Receipts'}
            </button>
          </div>
          <div style={{marginTop: isMobile ? '8px' : '10px', fontSize: isMobile ? '11px' : '12px', color: '#666', fontStyle: 'italic', lineHeight: '1.4'}}>
            Note: Ledger receipts will be displayed in the table below. Use "Find" or "Find All" to match against the loaded cache (excluding receipts from the selected ledger).
          </div>
        </div>

        {useCache && cacheMetadata && (
          <div className="cache-info" style={{
            marginTop: '12px',
            padding: '12px',
            backgroundColor: '#e7f3ff',
            border: '1px solid #b3d9ff',
            borderRadius: '6px',
            fontSize: '14px'
          }}>
            <strong>Using Cache:</strong> {cacheMetadata.company || 'Unknown'}
            {cacheMetadata.fileCount && cacheMetadata.fileCount > 1 && (
              <> ({cacheMetadata.fileCount} files)</>
            )}
            {' | '}
            Period: {cacheMetadata.fromDate || 'N/A'} to {cacheMetadata.toDate || 'N/A'} | 
            Export Date: {cacheMetadata.exportDate || 'N/A'} | 
            Total Receipts: {cacheMetadata.totalReceipts || cacheReceipts.length}
            {cacheMetadata.fileNames && (
              <>
                <br />
                <span style={{fontSize: '12px', color: '#666'}}>
                  <strong>Files:</strong> {cacheMetadata.fileNames}
                </span>
              </>
            )}
            <br />
            <span style={{fontSize: '12px', color: '#666'}}>
              Find and Find All operations will search from the cached Excel file(s) instead of Tally.
            </span>
          </div>
        )}

        {loading && totalChunks > 0 && (
          <div className="loading-progress">
            <p>
              Fetching receipts... Chunk {currentChunk} of {totalChunks}
            </p>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${(chunksProcessed / totalChunks) * 100}%`,
                }}></div>
            </div>
          </div>
        )}

        {error && (
          <div className="error-message">
            <p>{error}</p>
          </div>
        )}

        {!loading && ledgerReceipts.length === 0 && !error && (
          <div className="empty-state">
            <p>No ledger receipts found. Enter a ledger name, select a date range, and click "Fetch Ledger Receipts".</p>
          </div>
        )}

        {!loading && ledgerReceipts.length > 0 && (
          <>
            <div className="receipts-summary">
              <div style={{display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', flexWrap: 'wrap', gap: isMobile ? '12px' : '12px'}}>
                <div style={{display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '8px' : '12px', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto'}}>
                  <p style={{margin: 0, fontSize: isMobile ? '13px' : '14px', lineHeight: '1.4'}}>
                    Total Receipts: <strong>{ledgerReceipts.length}</strong>
                    {receiptsBeforeFindAll.length !== ledgerReceipts.length && (
                      <> | Filtered: <strong>{receiptsBeforeFindAll.length}</strong></>
                    )}
                    {findAllMode && Object.keys(expandedReceipts).length > 0 && (
                      <> | With Matches: <strong>{filteredReceipts.length}</strong></>
                    )}
                    {!findAllMode && filteredReceipts.length !== ledgerReceipts.length && filteredReceipts.length === receiptsBeforeFindAll.length && (
                      <> | Showing: <strong>{filteredReceipts.length}</strong></>
                    )}
                    {!isMobile && (
                      <> | Showing{' '}
                      {filteredReceipts.length > 0 ? startIndex + 1 : 0} - {Math.min(endIndex, filteredReceipts.length)} of{' '}
                      {filteredReceipts.length}</>
                    )}
                  </p>
                  {totalPages > 1 && (
                    <div className="pagination" style={{margin: 0, padding: 0, background: 'transparent', boxShadow: 'none', width: isMobile ? '100%' : 'auto'}}>
                      <button
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="pagination-button"
                        style={{width: isMobile ? '100%' : 'auto'}}>
                        Previous
                      </button>
                      <span className="pagination-info" style={{textAlign: isMobile ? 'center' : 'left', width: isMobile ? '100%' : 'auto'}}>
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="pagination-button"
                        style={{width: isMobile ? '100%' : 'auto'}}>
                        Next
                      </button>
                    </div>
                  )}
                </div>
                <div style={{display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '8px' : '12px', alignItems: 'stretch', width: isMobile ? '100%' : 'auto'}}>
                  <button
                    onClick={() => handleFindAll()}
                    className="find-all-button"
                    disabled={findAllLoading || filteredReceipts.length === 0}
                    style={{width: isMobile ? '100%' : 'auto'}}>
                    {findAllLoading ? `Finding All... (${findAllProgress}%)` : findAllMode ? 'Find All (Active)' : 'Find All'}
                  </button>
                  {findAllMode && Object.keys(expandedReceipts).length > 0 && (
                    <button
                      onClick={() => {
                        setFindAllMode(false);
                        setExpandedReceipts({});
                      }}
                      className="clear-find-all-button"
                      title="Show all receipts"
                      style={{width: isMobile ? '100%' : 'auto'}}>
                      Show All Receipts
                    </button>
                  )}
                </div>
              </div>
              {findAllLoading && (
                <div style={{marginTop: '12px'}}>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{width: `${findAllProgress}%`}}>
                    </div>
                  </div>
                </div>
              )}
            </div>


            {filteredReceipts.length === 0 && ledgerReceipts.length > 0 && (
              <div className="no-results">
                <p>No receipts match the current filters.</p>
              </div>
            )}

            <div className="filters-section">
              <div className="filter-row">
                <div className="filter-group">
                  <label htmlFor="filter-period-from" className="filter-label">Period From</label>
                  <input
                    id="filter-period-from"
                    type="date"
                    className="filter-input"
                    value={filters.periodFrom}
                    onChange={(e) => setFilters({...filters, periodFrom: e.target.value})}
                  />
                </div>
                <div className="filter-group">
                  <label htmlFor="filter-period-to" className="filter-label">Period To</label>
                  <input
                    id="filter-period-to"
                    type="date"
                    className="filter-input"
                    value={filters.periodTo}
                    onChange={(e) => setFilters({...filters, periodTo: e.target.value})}
                  />
                </div>
                <div className="filter-group">
                  <label htmlFor="filter-customer" className="filter-label">Customer</label>
                  <select
                    id="filter-customer"
                    className="filter-select"
                    value={filters.customer}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'clear') {
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
                  <label htmlFor="filter-voucher" className="filter-label">Voucher No</label>
                  <input
                    id="filter-voucher"
                    type="text"
                    className="filter-input"
                    placeholder="Filter by voucher no..."
                    value={filters.voucherNo}
                    onChange={(e) => setFilters({...filters, voucherNo: e.target.value})}
                  />
                </div>
                <div className="filter-group">
                  <label htmlFor="filter-amount" className="filter-label">Amount</label>
                  <input
                    id="filter-amount"
                    type="text"
                    className="filter-input"
                    placeholder="Filter by amount..."
                    value={filters.amount}
                    onChange={(e) => setFilters({...filters, amount: e.target.value})}
                  />
                </div>
                <div className="filter-group">
                  <label htmlFor="filter-narration" className="filter-label">Narration</label>
                  <input
                    id="filter-narration"
                    type="text"
                    className="filter-input"
                    placeholder="Filter by narration..."
                    value={filters.narration}
                    onChange={(e) => setFilters({...filters, narration: e.target.value})}
                  />
                </div>
                {(filters.date || filters.voucherNo || filters.customer || filters.amount || filters.narration || filters.periodFrom || filters.periodTo) && (
                  <button
                    onClick={() => setFilters({date: '', voucherNo: '', customer: '', amount: '', narration: '', periodFrom: '', periodTo: ''})}
                    className="clear-filters-button">
                    Clear Filters
                  </button>
                )}
              </div>
              <div style={{marginTop: isMobile ? '8px' : '8px', fontSize: isMobile ? '11px' : '12px', color: '#666', fontStyle: 'italic', lineHeight: '1.4'}}>
                Note: Period filter applies to displayed receipts only. Find/Find All searches through the entire cache (excluding receipts from the selected ledger).
              </div>
            </div>

            {filteredReceipts.length > 0 && (
              <div className="receipts-table-container">
                <table className="receipts-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Voucher No</th>
                      <th>Customer</th>
                      <th>Bank</th>
                      <th>Amount</th>
                      <th>Narration</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                <tbody>
                  {currentReceipts.map((receipt, index) => {
                    const receiptKey = receipt.MasterID || `${receipt.Dates}-${receipt.InvNo}`;
                    const receiptState = expandedReceipts[receiptKey];
                    const isExpanded = receiptState !== undefined;
                    const matches = receiptState?.matches || [];
                    const isLoading = receiptState?.isLoading || false;
                    
                    // Check if this receipt is from ledger receipts (searched results)
                    const isLedgerReceipt = ledgerReceipts.some(lr => {
                      const lrKey = lr.MasterID || `${lr.Dates}-${lr.InvNo}`;
                      return lrKey === receiptKey;
                    });
                    
                    return (
                      <React.Fragment key={`${receipt.MasterID}-${index}`}>
                        <tr className={isLedgerReceipt ? 'ledger-receipt-row' : ''}>
                          <td>
                            {receipt.Dates
                              ? formatDateDisplay(receipt.Dates)
                              : '-'}
                          </td>
                          <td>{receipt.InvNo || '-'}</td>
                          <td>{receipt.Customer || '-'}</td>
                          <td>{receipt.Bank || '-'}</td>
                          <td className="amount-cell">
                            {formatAmount(receipt.Amount)}
                          </td>
                          <td className="narration-cell narration-wrap">
                            {receipt.Narration || '-'}
                          </td>
                          <td className="actions-cell">
                            <button
                              onClick={() => handleFindMatches(receipt)}
                              className="find-matches-button"
                              title="Find matching receipts"
                              disabled={isLoading}>
                              {isLoading ? '⏳' : isExpanded && matches.length > 0 ? '▼ Hide' : '▶ Find'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="matches-container">
                              <div className="matches-header">
                                <strong>
                                  {isLoading 
                                    ? `Searching for matches... (${receiptState?.progress || 0}%)` 
                                    : `Matching Receipts (${matches.length}):`}
                                </strong>
                              </div>
                              {isLoading ? (
                                <div className="no-matches">
                                  <div className="spinner" style={{margin: '20px auto', width: '30px', height: '30px'}}></div>
                                  <p>Processing receipts... {receiptState?.progress || 0}%</p>
                                  {receiptState?.progress !== undefined && (
                                    <div className="progress-bar" style={{marginTop: '12px', width: '100%', maxWidth: '400px', margin: '12px auto 0'}}>
                                      <div 
                                        className="progress-fill" 
                                        style={{width: `${receiptState.progress}%`}}>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : matches.length > 0 ? (
                                <div className="matches-table-wrapper">
                                  <table className="matches-table">
                                    <thead>
                                      <tr>
                                        <th>Date</th>
                                        <th>Voucher No</th>
                                        <th>Customer</th>
                                        <th>Bank</th>
                                        <th>Amount</th>
                                        <th>Narration</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {matches.map((match, matchIndex) => (
                                        <tr key={`match-${match.receipt.MasterID}-${matchIndex}`}>
                                          <td>
                                            {match.receipt.Dates
                                              ? formatDateDisplay(match.receipt.Dates)
                                              : '-'}
                                          </td>
                                          <td>{match.receipt.InvNo || '-'}</td>
                                          <td>{match.receipt.Customer || '-'}</td>
                                          <td>{match.receipt.Bank || '-'}</td>
                                          <td className="amount-cell">
                                            {formatAmount(match.receipt.Amount)}
                                          </td>
                                          <td className="narration-cell narration-wrap">
                                            {match.receipt.Narration
                                              ? highlightMatchingWords(match.receipt.Narration, match.matchingWords)
                                              : '-'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="no-matches">
                                  <p>No matching receipts found.</p>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}

            {filteredReceipts.length > 0 && totalPages > 1 && (
              <div className="pagination" style={{flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '8px' : '16px'}}>
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="pagination-button"
                  style={{width: isMobile ? '100%' : 'auto'}}>
                  Previous
                </button>
                <span className="pagination-info" style={{textAlign: isMobile ? 'center' : 'left'}}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="pagination-button"
                  style={{width: isMobile ? '100%' : 'auto'}}>
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '500px'}}>
            <div className="modal-header">
              <h2>Settings</h2>
              <button
                className="modal-close-button"
                onClick={() => setShowSettings(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div style={{marginBottom: '20px'}}>
                <label htmlFor="cacheSliceDays" style={{display: 'block', marginBottom: '8px', fontWeight: '600'}}>
                  Cache Slice Days (for Get All Receipts):
                </label>
                <input
                  id="cacheSliceDays"
                  type="number"
                  min="1"
                  max="30"
                  value={cacheSliceDays}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    if (!isNaN(value) && value >= 1 && value <= 30) {
                      setCacheSliceDays(value);
                      localStorage.setItem('cacheSliceDays', value.toString());
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                  }}
                />
                <p style={{marginTop: '4px', fontSize: '12px', color: '#666'}}>
                  Number of days per chunk when fetching all receipts from Tally (default: 5)
                </p>
              </div>
              
              <div style={{marginBottom: '20px'}}>
                <label htmlFor="ledgerSliceDays" style={{display: 'block', marginBottom: '8px', fontWeight: '600'}}>
                  Ledger Slice Days (for Get Ledger Receipts):
                </label>
                <input
                  id="ledgerSliceDays"
                  type="number"
                  min="1"
                  max="30"
                  value={ledgerSliceDays}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    if (!isNaN(value) && value >= 1 && value <= 30) {
                      setLedgerSliceDays(value);
                      localStorage.setItem('ledgerSliceDays', value.toString());
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                  }}
                />
                <p style={{marginTop: '4px', fontSize: '12px', color: '#666'}}>
                  Number of days per chunk when fetching ledger receipts from Tally (default: 5)
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="close-modal-button"
                onClick={() => setShowSettings(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto'}}>
            <div className="modal-header">
              <h2>Help - How to Use This Tool</h2>
              <button
                className="modal-close-button"
                onClick={() => setShowHelp(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body" style={{lineHeight: '1.6'}}>
              <div style={{marginBottom: '24px'}}>
                <h3 style={{color: '#333', marginBottom: '12px', fontSize: '18px'}}>What This Tool Does</h3>
                <p style={{color: '#555', marginBottom: '12px'}}>
                  This tool helps you find matching receipts from Tally. You can:
                </p>
                <ul style={{color: '#555', paddingLeft: '20px', marginBottom: '12px'}}>
                  <li>Download all receipts from Tally and save them as a cache file</li>
                  <li>Load the cache file to search through receipts quickly</li>
                  <li>Get receipts for a specific customer/ledger</li>
                  <li>Find matching receipts by comparing narration text</li>
                </ul>
              </div>

              <div style={{marginBottom: '24px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px'}}>
                <h3 style={{color: '#333', marginBottom: '12px', fontSize: '18px'}}>Step 1: Build Your Cache (Option 1)</h3>
                <p style={{color: '#555', marginBottom: '12px'}}>
                  <strong>This is like creating a library of all your receipts.</strong>
                </p>
                <ol style={{color: '#555', paddingLeft: '20px', marginBottom: '12px'}}>
                  <li style={{marginBottom: '8px'}}>
                    <strong>Select dates:</strong> Choose the "From Date" and "To Date" for the period you want to download
                  </li>
                  <li style={{marginBottom: '8px'}}>
                    <strong>Click "Get All Receipts":</strong> This will fetch all receipts from Tally for your selected period
                  </li>
                  <li style={{marginBottom: '8px'}}>
                    <strong>Click "Download Cache":</strong> This saves all the receipts to an Excel file on your computer
                  </li>
                  <li style={{marginBottom: '8px'}}>
                    <strong>Click "Load Cache":</strong> Select the Excel file you just downloaded (or any previous cache file) to load it into the tool
                  </li>
                </ol>
                <p style={{color: '#666', fontSize: '14px', fontStyle: 'italic', marginTop: '12px'}}>
                  💡 <strong>Tip:</strong> You only need to do this once. After that, you can reuse the same cache file for faster searching!
                </p>
              </div>

              <div style={{marginBottom: '24px', padding: '15px', backgroundColor: '#fff9e6', borderRadius: '8px'}}>
                <h3 style={{color: '#333', marginBottom: '12px', fontSize: '18px'}}>Step 2: Search for a Specific Customer (Option 2)</h3>
                <p style={{color: '#555', marginBottom: '12px'}}>
                  <strong>This is like asking: "Show me all receipts for this customer."</strong>
                </p>
                <ol style={{color: '#555', paddingLeft: '20px', marginBottom: '12px'}}>
                  <li style={{marginBottom: '8px'}}>
                    <strong>Enter Ledger Name:</strong> Type the exact name of the customer/ledger (e.g., "Suspense Account")
                  </li>
                  <li style={{marginBottom: '8px'}}>
                    <strong>Select dates:</strong> Choose the "From Date" and "To Date" for the period you want to search
                  </li>
                  <li style={{marginBottom: '8px'}}>
                    <strong>Click "Search Ledger Receipts":</strong> This will show all receipts for that customer in the table below
                  </li>
                </ol>
              </div>

              <div style={{marginBottom: '24px', padding: '15px', backgroundColor: '#e7f3ff', borderRadius: '8px'}}>
                <h3 style={{color: '#333', marginBottom: '12px', fontSize: '18px'}}>Step 3: Find Matching Receipts</h3>
                <p style={{color: '#555', marginBottom: '12px'}}>
                  <strong>This finds other receipts that might be related to the ones you're looking at.</strong>
                </p>
                <ol style={{color: '#555', paddingLeft: '20px', marginBottom: '12px'}}>
                  <li style={{marginBottom: '8px'}}>
                    <strong>Click "Find" button:</strong> On any receipt row, click "Find" to search for matching receipts in your cache
                  </li>
                  <li style={{marginBottom: '8px'}}>
                    <strong>Or click "Find All":</strong> This searches for matches for ALL receipts in the table at once
                  </li>
                  <li style={{marginBottom: '8px'}}>
                    <strong>View matches:</strong> Matching receipts will appear below each receipt, with highlighted matching words
                  </li>
                </ol>
                <p style={{color: '#666', fontSize: '14px', marginTop: '12px'}}>
                  <strong>How matching works:</strong> The tool looks for words between dashes (-) in the narration field. 
                  For example, if a narration says "NEFT CR-ICIC0000393-BANK", it will match other receipts with the same text between dashes.
                </p>
              </div>

              <div style={{marginBottom: '24px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '8px'}}>
                <h3 style={{color: '#333', marginBottom: '12px', fontSize: '18px'}}>Filters</h3>
                <p style={{color: '#555', marginBottom: '12px'}}>
                  Use the filter boxes to narrow down the receipts shown in the table:
                </p>
                <ul style={{color: '#555', paddingLeft: '20px', marginBottom: '12px'}}>
                  <li><strong>Period From/To:</strong> Filter by date range</li>
                  <li><strong>Customer:</strong> Filter by customer name</li>
                  <li><strong>Date:</strong> Search for specific dates</li>
                  <li><strong>Voucher No:</strong> Search by voucher number</li>
                  <li><strong>Amount:</strong> Filter by amount</li>
                  <li><strong>Narration:</strong> Search in narration text</li>
                </ul>
              </div>

              <div style={{marginBottom: '24px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px'}}>
                <h3 style={{color: '#333', marginBottom: '12px', fontSize: '18px'}}>Settings & Configuration</h3>
                <ul style={{color: '#555', paddingLeft: '20px', marginBottom: '12px'}}>
                  <li style={{marginBottom: '8px'}}>
                    <strong>⚙️ Settings:</strong> Configure how many days to fetch at a time (slice days). 
                    Smaller numbers = more requests but faster per request. Larger numbers = fewer requests but slower per request.
                  </li>
                  <li style={{marginBottom: '8px'}}>
                    <strong>⚙️ Excluded Strings:</strong> Add words that should be ignored when finding matches. 
                    For example, if "UPI" appears in many receipts, you can exclude it so it doesn't create false matches.
                  </li>
                </ul>
              </div>

              <div style={{marginBottom: '24px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '8px', border: '1px solid #ffc107'}}>
                <h3 style={{color: '#333', marginBottom: '12px', fontSize: '18px'}}>Quick Tips</h3>
                <ul style={{color: '#555', paddingLeft: '20px', marginBottom: '12px'}}>
                  <li>Always load your cache first before searching for matches</li>
                  <li>Click on highlighted words in matches to exclude them from future searches</li>
                  <li>Use "Find All" to process all receipts at once - it shows a progress bar</li>
                  <li>After "Find All", only receipts with matches are shown. Click "Show All Receipts" to see everything again</li>
                  <li>You can load multiple cache files - they will be combined automatically</li>
                </ul>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="close-modal-button"
                onClick={() => setShowHelp(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excluded Strings Configuration Modal */}
      {showExcludedStringsConfig && (
        <div className="modal-overlay" onClick={() => setShowExcludedStringsConfig(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Excluded Strings Configuration</h2>
              <button
                className="modal-close-button"
                onClick={() => setShowExcludedStringsConfig(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p style={{marginBottom: '16px', color: '#666', fontSize: '14px'}}>
                These strings will be excluded from matching when searching for receipts.
                Matching is case-insensitive.
              </p>
              
              <div className="excluded-strings-input-section">
                <input
                  type="text"
                  className="excluded-string-input"
                  placeholder="Enter string to exclude..."
                  value={newExcludedString}
                  onChange={(e) => setNewExcludedString(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddExcludedString();
                    }
                  }}
                />
                <button
                  onClick={handleAddExcludedString}
                  className="add-excluded-button"
                  disabled={!newExcludedString.trim()}>
                  Add
                </button>
              </div>
              
              <div className="excluded-strings-list">
                {excludedStrings.length === 0 ? (
                  <p style={{color: '#999', fontStyle: 'italic', textAlign: 'center', padding: '20px'}}>
                    No excluded strings. Add some above.
                  </p>
                ) : (
                  excludedStrings.map((str, index) => (
                    <div key={index} className="excluded-string-item">
                      <span className="excluded-string-text">{str}</span>
                      <button
                        onClick={() => handleRemoveExcludedString(str)}
                        className="remove-excluded-button"
                        title="Remove">
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
              
              <div className="modal-footer">
                <button
                  onClick={handleResetExcludedStrings}
                  className="reset-excluded-button">
                  Reset to Defaults
                </button>
                <button
                  onClick={() => setShowExcludedStringsConfig(false)}
                  className="close-modal-button">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiptListScreen;


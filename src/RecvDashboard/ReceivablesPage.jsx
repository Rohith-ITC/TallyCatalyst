import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import SummaryCards from './components/SummaryCards';
import AgingChart from './components/AgingChart';
import SalespersonChart from './components/SalespersonChart';
import SalespersonConfigPanel from './components/SalespersonConfigPanel';
import BillDrilldownModal from './components/BillDrilldownModal';
import VoucherDetailsModal from './components/VoucherDetailsModal';
import LedgerOutstandingsModal from './components/LedgerOutstandingsModal';
import ReceivablesTable from './components/ReceivablesTable';
import './ReceivablesPage.css';
import { getApiUrl } from '../config';
import { getCompanyConfigValue, clearCompanyConfigCache } from '../utils/companyConfigUtils';
import {
  escapeForXML,
  cleanAndEscapeForXML,
  formatCurrency,
  parseXMLResponse,
  normalizeBillIdentifier,
  extractBillIdentifiers,
  getRowValueByColumnKeywords,
  calculateDaysOverdue,
} from './utils/helpers';

const withTimestamp = (url) =>
  `${url}${url.includes('?') ? '&' : '?'}ts=${Date.now()}`;

const getTallyDataUrl = () => withTimestamp(getApiUrl('/api/tally/tallydata'));
const getLedgerVouchersUrl = () =>
  withTimestamp(getApiUrl('/api/tally/led_statbillrep'));

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

const getReceivablesMemoryCache = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  if (!window.__receivablesCache) {
    window.__receivablesCache = new Map();
  }
  return window.__receivablesCache;
};

const buildReceivablesCacheKey = (company, formula) => {
  if (!company?.tallyloc_id || !company?.guid) return null;
  const formulaKey = (formula && formula.trim()) || 'default';
  return `receivables_${company.tallyloc_id}_${company.guid}_${formulaKey}`;
};

const readReceivablesCache = (company, formula) => {
  const cacheKey = buildReceivablesCacheKey(company, formula);
  if (!cacheKey) return null;

  const memoryCache = getReceivablesMemoryCache();
  if (memoryCache && memoryCache.has(cacheKey)) {
    const cachedEntry = memoryCache.get(cacheKey);
    if (cachedEntry && Date.now() - cachedEntry.timestamp <= CACHE_TTL_MS) {
      return cachedEntry;
    }
    memoryCache.delete(cacheKey);
  }

  const cached = sessionStorage.getItem(cacheKey);
  if (!cached) return null;

  try {
    const parsed = JSON.parse(cached);
    if (!parsed || typeof parsed !== 'object') {
      sessionStorage.removeItem(cacheKey);
      return null;
    }

    const { timestamp, columns, rows } = parsed;
    if (!timestamp || !Array.isArray(columns) || !Array.isArray(rows)) {
      sessionStorage.removeItem(cacheKey);
      return null;
    }

    if (Date.now() - timestamp > CACHE_TTL_MS) {
      sessionStorage.removeItem(cacheKey);
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('⚠️ Failed to parse cached receivables data:', error);
    sessionStorage.removeItem(cacheKey);
    return null;
  }
};

const writeReceivablesCache = (company, formula, data) => {
  const cacheKey = buildReceivablesCacheKey(company, formula);
  if (!cacheKey) return;
  const payload = {
    ...data,
    timestamp: Date.now(),
  };

  const memoryCache = getReceivablesMemoryCache();
  if (memoryCache) {
    memoryCache.set(cacheKey, payload);
  }

  try {
    sessionStorage.setItem(
      cacheKey,
      JSON.stringify(payload)
    );
  } catch (error) {
    console.warn('⚠️ Unable to persist receivables cache:', error);
  }
};

//const DEFAULT_SALESPERSON_FORMULA = '$$VCHBILLITCSalesPerson';

const getAuthToken = () => {
  const token = sessionStorage.getItem('token');
  if (!token) {
    throw new Error('No authentication token found');
  }
  return token;
};

const buildReceivablesRequestXml = (formula, company) => {
  const sanitized = (formula && formula.trim()) || '';
  const escapedFormula = escapeForXML(sanitized);

  return `<ENVELOPE>
	<HEADER>
		<VERSION>1</VERSION>
		<TALLYREQUEST>Export</TALLYREQUEST>
		<TYPE>Data</TYPE>
		<ID>ODBC Report</ID>
	</HEADER>
	<BODY>
		<DESC>		
			<STATICVARIABLES>
				<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                <GROUPNAME>$$GroupSundryDebtors</GROUPNAME>
                <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>
			</STATICVARIABLES>	
            <TDL>
            <TDLMESSAGE>
            <REPORT NAME="ODBC Report" ISMODIFY="Yes" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
                <Add>Variable : GroupName</Add>
                <Set>GroupName : $$GroupSundryDebtors</Set>
            </REPORT>
            <OBJECT NAME="Bill" ISMODIFY="Yes" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
            ${
              escapedFormula
                ? `<LOCALFORMULA>TCSalesPerson : ${escapedFormula}</LOCALFORMULA>`
                : ''
            }
           </OBJECT>
            </TDLMESSAGE>
            </TDL>
			<SQLREQUEST TYPE="Prepare" METHOD="SQLPrepare">
				select 
					$Parent as LedgerName, 
                    $TCSalesPerson as SalesPerson, 
                    $Name as BillName, 
					$$String:$BillDate:UniversalDate as BillDate, 
                    $$String:@@CreditPeriod:UniversalDate as DueDate,
					$Openingbalance as OpeningBalance, 
					$Closingbalance as ClosingBalance
				from GroupBills
			</SQLREQUEST>
		</DESC>
	</BODY>
</ENVELOPE>`;
};

// Default ageing buckets configuration
const DEFAULT_AGING_BUCKETS = [
  { label: '0-30', maxDays: 30, color: '#68d391' },
  { label: '30-90', maxDays: 90, color: '#f6ad55' },
  { label: '90-180', maxDays: 180, color: '#ed8936' },
  { label: '180-360', maxDays: 360, color: '#dd6b20' },
  { label: '>360', maxDays: null, color: '#f56565' }, // null means no max (infinity)
];

const ReceivablesPage = ({ company, onBack }) => {
  const canGoBack = typeof onBack === 'function';
  const handleBack = canGoBack ? onBack : () => {};
  const [receivables, setReceivables] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [viewMode, setViewMode] = useState('summary');
  const [groupBy, setGroupBy] = useState('Ledger');

  const [sortConfig, setSortConfig] = useState({ column: null, direction: 'asc' });
  const [filters, setFilters] = useState({});
  const [dropdownOpen, setDropdownOpen] = useState({});
  const [dropdownSearch, setDropdownSearch] = useState({});

  const [selectedAgingBucket, setSelectedAgingBucket] = useState(null);
  const [selectedSalesperson, setSelectedSalesperson] = useState(null);

  const [showSalespersonConfig, setShowSalespersonConfig] = useState(false);
  const [enabledSalespersons, setEnabledSalespersons] = useState(new Set());
  const salespersonsInitializedRef = useRef(false);

  const [expandedCustomers, setExpandedCustomers] = useState(new Set());
  const [openOptionsRow, setOpenOptionsRow] = useState(null);

  const [drilldownData, setDrilldownData] = useState(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownError, setDrilldownError] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [showDrilldown, setShowDrilldown] = useState(false);

  const abortControllerRef = useRef(null);

  const [voucherDetailsData, setVoucherDetailsData] = useState(null);
  const [voucherDetailsLoading, setVoucherDetailsLoading] = useState(false);
  const [voucherDetailsError, setVoucherDetailsError] = useState(null);
  const [showVoucherDetails, setShowVoucherDetails] = useState(false);

  const [ledgerOutstandingsData, setLedgerOutstandingsData] = useState(null);
  const [ledgerOutstandingsLoading, setLedgerOutstandingsLoading] = useState(false);
  const [ledgerOutstandingsError, setLedgerOutstandingsError] = useState(null);
  const [showLedgerOutstandings, setShowLedgerOutstandings] = useState(false);
  const [selectedLedgerOutstanding, setSelectedLedgerOutstanding] = useState(null);
  const [salespersonFormula, setSalespersonFormula] = useState('');
  const [configFormula, setConfigFormula] = useState(null); // Formula from company configuration
  const [currencyScale, setCurrencyScale] = useState('auto'); // 'auto', 'crore', 'lakh', 'thousand', 'full'
  const [showSettings, setShowSettings] = useState(false);
  const [agingBucketsConfig, setAgingBucketsConfig] = useState([...DEFAULT_AGING_BUCKETS]);

  const fetchReceivables = useCallback(async ({ forceRefresh = false } = {}) => {
    if (!company) return;
    try {
      if (!forceRefresh) {
        const cached = readReceivablesCache(company, salespersonFormula);
        if (cached) {
          setColumns(cached.columns);
          setReceivables(cached.rows);
          setError(null);
          setLoading(false);
          return;
        }
      }

      setLoading(true);
      setError(null);

      const companyName = cleanAndEscapeForXML(company.company);
      const token = getAuthToken();
      const response = await fetch(getTallyDataUrl(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/xml',
          'x-tallyloc-id': company.tallyloc_id.toString(),
          'x-company': companyName,
          'x-guid': company.guid,
        },
        body: buildReceivablesRequestXml(salespersonFormula, companyName),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const xmlText = await response.text();
      const parsed = parseXml(xmlText);

      const closingBalanceIndex = parsed.columns.findIndex(
        (col) =>
          col.name.includes('ClosingBalance') ||
          col.name.includes('Closingbalance') ||
          col.alias?.includes('Closing Balance')
      );

      const transformedRows = parsed.rows.map((row) => {
        const newRow = [...row];
        if (closingBalanceIndex !== -1) {
          const closingBalance = parseFloat(row[closingBalanceIndex]) || 0;
          newRow[closingBalanceIndex] = Math.abs(closingBalance).toString();
          const drCr = closingBalance < 0 ? 'Dr' : 'Cr';
          newRow.splice(closingBalanceIndex + 1, 0, drCr);
        }
        return newRow;
      });

      const transformedColumns = [...parsed.columns];
      if (closingBalanceIndex !== -1) {
        transformedColumns.splice(closingBalanceIndex + 1, 0, {
          name: 'DrCr',
          alias: 'Dr/Cr',
          type: 'VarChar',
        });
      }

      setColumns(transformedColumns);
      setReceivables(transformedRows);
      writeReceivablesCache(company, salespersonFormula, {
        columns: transformedColumns,
        rows: transformedRows,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [company, salespersonFormula]);

  // Fetch company configuration for sales person formula
  useEffect(() => {
    const loadCompanyConfig = async () => {
      if (!company || !company.tallyloc_id || !company.guid) {
        setConfigFormula(null);
        return;
      }

      try {
        const formula = await getCompanyConfigValue('recvdash_salesprsn', company.tallyloc_id, company.guid);
        setConfigFormula(formula);
        console.log('✅ Receivables Dashboard - Loaded sales person formula from config:', formula);
        
        // Use config formula directly
        setSalespersonFormula(formula || '');
      } catch (error) {
        console.error('Error loading company config for receivables:', error);
        setConfigFormula(null);
        setSalespersonFormula('');
      }
    };

    loadCompanyConfig();
    // Clear cache when company changes
    if (company && company.tallyloc_id && company.guid) {
      clearCompanyConfigCache(company.tallyloc_id, company.guid);
    }
  }, [company?.tallyloc_id, company?.guid]);


  useEffect(() => {
    fetchReceivables();
    // Reset initialization and enabled salespersons when company changes
    salespersonsInitializedRef.current = false;
    setEnabledSalespersons(new Set());
  }, [fetchReceivables]);

  // Initialize enabledSalespersons with all salespersons by default when receivables are first loaded
  useEffect(() => {
    if (receivables.length > 0 && columns.length > 0 && !salespersonsInitializedRef.current) {
      const salespersonIndex = columns.findIndex(
        (col) =>
          col.name.includes('SalesPerson') ||
          col.alias?.includes('SalesPerson') ||
          col.name.includes('Salesperson')
      );
      if (salespersonIndex !== -1) {
        const uniqueSalespersons = new Set();
        receivables.forEach((row) => {
          const salespersonName = row[salespersonIndex] || 'Unassigned';
          uniqueSalespersons.add(salespersonName);
        });
        if (uniqueSalespersons.size > 0) {
          setEnabledSalespersons(uniqueSalespersons);
          salespersonsInitializedRef.current = true;
        }
      }
    }
  }, [receivables, columns]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.searchable-dropdown-container')) {
        setDropdownOpen({});
      }
      if (
        !event.target.closest('.row-options-cell') &&
        !event.target.closest('.row-options-menu')
      ) {
        setOpenOptionsRow(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const parseXml = (xmlText) => {
    try {
      return parseXMLResponse(xmlText);
    } catch (err) {
      throw new Error(`Failed to parse XML response: ${err.message}`);
    }
  };

  const convertDateToYYYYMMDD = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames.indexOf(parts[1]) + 1;
    let year = parseInt(parts[2], 10);
    if (year < 100) {
      year = year < 30 ? 2000 + year : 1900 + year;
    }
    return `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
  };

  const getDefaultDateRange = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const currentDay = String(today.getDate()).padStart(2, '0');
    const toDate = `${currentYear}${currentMonth}${currentDay}`;

    const dateMatch = company.company.match(/from\s+(\d{1,2}-[A-Za-z]{3}-\d{2,4})/i);
    let fromDate = `${currentYear}0401`;
    if (dateMatch && dateMatch[1]) {
      const converted = convertDateToYYYYMMDD(dateMatch[1]);
      if (converted) {
        fromDate = converted;
      }
    }

    return { fromDate, toDate };
  };

  const fetchBillDrilldown = async (ledgerName, billName, salesperson) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setShowDrilldown(true);
    setDrilldownLoading(true);
    setDrilldownError(null);
    setSelectedBill({ ledgerName, billName, salesperson });

    try {
      const companyName = cleanAndEscapeForXML(company.company);
      const escapedLedgerName = escapeForXML(ledgerName);
      const escapedBillName = escapeForXML(billName);

      let booksFromDate = '1-Apr-00';
      const dateMatch = company.company.match(/from\s+(\d{1,2}-[A-Za-z]{3}-\d{2,4})/i);
      if (dateMatch && dateMatch[1]) {
        booksFromDate = dateMatch[1];
      }

      const drilldownXML = `<ENVELOPE>
	<HEADER>
		<VERSION>1</VERSION>
		<TALLYREQUEST>Export</TALLYREQUEST>
		<TYPE>Data</TYPE>
		<ID>ODBC Report</ID>
	</HEADER>
	<BODY>
		<DESC>		
			<STATICVARIABLES>
				<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
			</STATICVARIABLES>	
            <TDL>
            <TDLMESSAGE>
            <COLLECTION NAME="TC Ledger Receivables" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
                <TYPE>Bills</TYPE>
                <CHILDOF>&quot;${escapedLedgerName}&quot;</CHILDOF>
                <NATIVEMETHOD>Name</NATIVEMETHOD>
                <FILTERS>TCBillNameFilt</FILTERS>
            </COLLECTION>
            <COLLECTION NAME="TCLR LedEntries" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
                <COLLECTIONS>TCLR LedEntriesOB, TCLR LedEntriesVch</COLLECTIONS>
            </COLLECTION>
            <COLLECTION NAME="TCLR LedEntriesOB" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
                <TYPE>Bills</TYPE>
                <CHILDOF>&quot;${escapedLedgerName}&quot;</CHILDOF>
                <NATIVEMETHOD>Parent, BillDate, Name</NATIVEMETHOD>
                <FILTERS>TCOBLines, TCBillNameFilt</FILTERS>
                <METHOD>VoucherTypeName : &quot;Opening Balance&quot;</METHOD>
                <METHOD>LedBillAmount  : $ClosingBalance</METHOD>
                <METHOD>Date   : $BillDate</METHOD>
                <METHOD>Object  : &quot;Ledger&quot;</METHOD>
                <METHOD>MasterID  : $MasterID:Ledger:$Parent</METHOD>
            </COLLECTION>
            <COLLECTION NAME="TCLR LedEntriesVch" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
                <SOURCECOLLECTION>TC Ledger Receivables</SOURCECOLLECTION>
                <WALK>LedgerEntries</WALK>
                <NATIVEMETHOD>MasterID, Date, VoucherTypeName, Narration</NATIVEMETHOD>
                <METHOD>Name : $$Owner:$Name</METHOD>
                <METHOD>Parent : $$Owner:$Parent</METHOD>
                <METHOD>Object : &quot;Voucher&quot;</METHOD>
                <METHOD>LedBillAmount : $$GetVchBillAmt:($$Owner:$Name):($$Owner:$Parent):No</METHOD>
            </COLLECTION>
            <SYSTEM TYPE="Formulae" NAME="TCBillsOfGroupName" ISMODIFY="No" ISFIXED="No" ISINTERNAL="No">$$IsLedOfGrp:$Parent:##GroupName   </SYSTEM>
            <SYSTEM TYPE="Formulae" NAME="TCBillNameFilt" ISMODIFY="No" ISFIXED="No" ISINTERNAL="No">$Name=&quot;${escapedBillName}&quot;   </SYSTEM>
            <SYSTEM TYPE="Formulae" NAME="TCOBLines" ISMODIFY="No" ISFIXED="No" ISINTERNAL="No">$BillDate &lt; $$Date:&quot;${booksFromDate}&quot;   
            </SYSTEM>
            </TDLMESSAGE>
            </TDL>
			<SQLREQUEST TYPE="Prepare" METHOD="SQLPrepare">
				select 
                    $MASTERID as MasterID,
                    $Name as BillName,
                    $$String:$Date:UniversalDate as Date,
                    $VoucherTypeName as VchType,
                    $Narration as Narration,
                    $LedBillAmount as Amount,
                    $ClosingBalance:Ledger:$Parent as 'Customer Balance'
				from TCLRLedEntries
			</SQLREQUEST>
		</DESC>
	</BODY>
</ENVELOPE>`;

      const token = getAuthToken();
      const response = await fetch(getTallyDataUrl(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/xml',
          'x-tallyloc-id': company.tallyloc_id.toString(),
          'x-company': companyName,
          'x-guid': company.guid,
        },
        body: drilldownXML,
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const xmlText = await response.text();
      const parsed = parseXml(xmlText);
      setDrilldownData(parsed);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setDrilldownError(err.message);
      }
    } finally {
      setDrilldownLoading(false);
      abortControllerRef.current = null;
    }
  };

  const fetchVoucherDetails = async (masterId) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setShowVoucherDetails(true);
    setVoucherDetailsLoading(true);
    setVoucherDetailsError(null);

    try {
      const companyName = cleanAndEscapeForXML(company.company);
      const escapedMasterId = escapeForXML(masterId.toString());

      const voucherXML = `<ENVELOPE>
	<HEADER>
		<VERSION>1</VERSION>
		<TALLYREQUEST>Export</TALLYREQUEST>
		<TYPE>Data</TYPE>
		<ID>CP_Vouchers</ID>
	</HEADER>
	<BODY>
		<DESC>
			<STATICVARIABLES>
				<EXPORTFLAG>YES</EXPORTFLAG>
				<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
				<SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
			</STATICVARIABLES>
			<TDL>
				<TDLMESSAGE>
					<REPORT NAME="CP_Vouchers">
						<FORMS>CP_Vouchers</FORMS>
						<KEEPXMLCASE>Yes</KEEPXMLCASE>
						<OBJECTS>VOUCHER : $$Sprintf:@@VchMasterId:${escapedMasterId}</OBJECTS>
					</REPORT>
					<FORM NAME="CP_Vouchers">
						<TOPPARTS>CP_Vouchers</TOPPARTS>
					</FORM>
					<PART NAME="CP_Vouchers">
						<TOPLINES>CP_Vouchers</TOPLINES>
						<SCROLLED>Vertical</SCROLLED>
					</PART>
					<LINE NAME="CP_Vouchers" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
						<XMLTAG>"VOUCHERS"</XMLTAG>
						<LEFTFIELDS>CP_Temp1, CP_Temp2, CP_Temp3, CP_Temp4, CP_Temp5, CP_Temp6, CP_Temp7</LEFTFIELDS>
						<LOCAL>Field : CP_Temp1 : Set as :$MASTERID</LOCAL>
						<LOCAL>Field : CP_Temp2 : Set as :$DATE</LOCAL>
						<LOCAL>Field : CP_Temp3 : Set as :$VOUCHERTYPENAME</LOCAL>
						<LOCAL>Field : CP_Temp4 : Set as :$VOUCHERNUMBER</LOCAL>
						<LOCAL>Field : CP_Temp5 : Set as : $$IfDr:$$FNBillAllocTotal:@@AllocBillName</LOCAL>
						<LOCAL>Field : CP_Temp6 : Set as : $$IfCr:$$FNBillAllocTotal:@@AllocBillName</LOCAL>
						<LOCAL>Field : CP_Temp7 : Set as : $NARRATION</LOCAL>
						<LOCAL>Field : CP_Temp1  : XMLTag : "MASTERID"</LOCAL>
						<LOCAL>Field : CP_Temp2  : XMLTag : "DATE"</LOCAL>
						<LOCAL>Field : CP_Temp3  : XMLTag : "VOUCHERTYPE"</LOCAL>
						<LOCAL>Field : CP_Temp4  : XMLTag : "VOUCHERNUMBER"</LOCAL>
						<LOCAL>Field : CP_Temp5  : XMLTag : "DEBITAMT"</LOCAL>
						<LOCAL>Field : CP_Temp6  : XMLTag : "CREDITAMT"</LOCAL>
						<LOCAL>Field : CP_Temp7  : XMLTag : "NARRATION"</LOCAL>
						<Explode>CP_Ledgers : Yes</Explode>
					</LINE>
					<PART NAME="CP_Ledgers" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
						<TOPLINES>TCFA Ledgers</TOPLINES>
						<REPEAT>TCFA Ledgers : ALLLEDGERENTRIES</REPEAT>
					</PART>
					<LINE NAME="TCFA Ledgers" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
						<XMLTAG>"ALLLEDGERENTRIES"</XMLTAG>
						<LEFTFIELDS>CP_Temp1, CP_Temp2, CP_Temp3</LEFTFIELDS>
						<LOCAL>Field : CP_Temp1 : Set as :$LEDGERNAME</LOCAL>
						<LOCAL>Field : CP_Temp2 : Set as : $$IfDr:$AMOUNT</LOCAL>
						<LOCAL>Field : CP_Temp3 : Set as : $$IfCr:$AMOUNT</LOCAL>
						<LOCAL>Field : CP_Temp1  : XMLTag : "LEDGERNAME"</LOCAL>
						<LOCAL>Field : CP_Temp2  : XMLTag : "DEBITAMT"</LOCAL>
						<LOCAL>Field : CP_Temp3  : XMLTag : "CREDITAMT"</LOCAL>
						<EXPLODE>TCFA BILLALLOC</EXPLODE>
						<EXPLODE>TCFA Inventory</EXPLODE>
					</LINE>
					<PART NAME="TCFA BILLALLOC" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
						<TOPLINES>TCFA BILLALLOC</TOPLINES>
						<REPEAT>TCFA BILLALLOC : BILLALLOCATIONS</REPEAT>
					</PART>
					<LINE NAME="TCFA BILLALLOC" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
						<XMLTAG>"BILLALLOCATIONS"</XMLTAG>
						<LEFTFIELDS>CP_Temp1, CP_Temp2, CP_Temp3</LEFTFIELDS>
						<LOCAL>Field : CP_Temp1 : Set as :$NAME</LOCAL>
						<LOCAL>Field : CP_Temp2 : Set as : $$IfDr:$AMOUNT</LOCAL>
						<LOCAL>Field : CP_Temp3 : Set as : $$IfCr:$AMOUNT</LOCAL>
						<LOCAL>Field : CP_Temp1  : XMLTag : "BILLNAME"</LOCAL>
						<LOCAL>Field : CP_Temp2  : XMLTag : "DEBITAMT"</LOCAL>
						<LOCAL>Field : CP_Temp3  : XMLTag : "CREDITAMT"</LOCAL>
					</LINE>
					<PART NAME="TCFA Inventory" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
						<TOPLINES>TCFA Inventory</TOPLINES>
						<REPEAT>TCFA Inventory : INVENTORYALLOCATIONS</REPEAT>
					</PART>
					<LINE NAME="TCFA Inventory" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
						<XMLTAG>"INVENTORYALLOCATIONS"</XMLTAG>
						<LEFTFIELDS>CP_Temp1, CP_Temp2, CP_Temp3, CP_Temp4, CP_Temp5</LEFTFIELDS>
						<LOCAL>Field : CP_Temp1 : Set as :$STOCKITEMNAME</LOCAL>
						<LOCAL>Field : CP_Temp2 : Set as : $BILLEDQTY</LOCAL>
						<LOCAL>Field : CP_Temp3 : Set as : $RATE</LOCAL>
						<LOCAL>Field : CP_Temp4 : Set as : $DISCOUNT</LOCAL>
						<LOCAL>Field : CP_Temp5 : Set as : $AMOUNT</LOCAL>
						<LOCAL>Field : CP_Temp1  : XMLTag : "STOCKITEMNAME"</LOCAL>
						<LOCAL>Field : CP_Temp2  : XMLTag : "BILLEQTY"</LOCAL>
						<LOCAL>Field : CP_Temp3  : XMLTag : "RATE"</LOCAL>
						<LOCAL>Field : CP_Temp4  : XMLTag : "DISCOUNT"</LOCAL>
						<LOCAL>Field : CP_Temp5  : XMLTag : "AMOUNT"</LOCAL>
					</LINE>
					<FIELD NAME="CP_Temp1"></FIELD>
					<FIELD NAME="CP_Temp2"></FIELD>
					<FIELD NAME="CP_Temp3"></FIELD>
					<FIELD NAME="CP_Temp4"></FIELD>
					<FIELD NAME="CP_Temp5"></FIELD>
					<FIELD NAME="CP_Temp6"></FIELD>
					<FIELD NAME="CP_Temp7"></FIELD>
					<FIELD NAME="CP_Temp8"></FIELD>
				</TDLMESSAGE>
			</TDL>
		</DESC>
	</BODY>
</ENVELOPE>`;

      const token = getAuthToken();
      const response = await fetch(getTallyDataUrl(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/xml',
          'x-tallyloc-id': company.tallyloc_id.toString(),
          'x-company': companyName,
          'x-guid': company.guid,
        },
        body: voucherXML,
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const xmlText = await response.text();
      // Parse XML directly since it's a different structure
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      
      // Convert XML to object structure
      const vouchers = xmlDoc.querySelector('VOUCHERS');
      if (!vouchers) {
        throw new Error('No voucher data found in response');
      }

      // Group siblings with same tag name into arrays
      const groupSiblings = (node) => {
        const result = {};
        const children = Array.from(node.childNodes).filter((n) => n.nodeType === 1);
        const tagGroups = {};
        
        children.forEach((child) => {
          const tagName = child.tagName;
          if (!tagGroups[tagName]) {
            tagGroups[tagName] = [];
          }
          tagGroups[tagName].push(child);
        });
        
        Object.keys(tagGroups).forEach((tagName) => {
          const nodes = tagGroups[tagName];
          const isArrayType = tagName === 'ALLLEDGERENTRIES' || tagName === 'BILLALLOCATIONS' || tagName === 'INVENTORYALLOCATIONS';
          
          if (nodes.length > 1 || isArrayType) {
            // Array
            result[tagName] = nodes.map((node) => {
              const childElements = Array.from(node.children).filter((n) => n.nodeType === 1);
              if (childElements.length > 0) {
                return groupSiblings(node);
              } else {
                return node.textContent?.trim() || '';
              }
            });
          } else {
            // Single value
            const node = nodes[0];
            const childElements = Array.from(node.children).filter((n) => n.nodeType === 1);
            if (childElements.length > 0) {
              result[tagName] = groupSiblings(node);
            } else {
              result[tagName] = node.textContent?.trim() || '';
            }
          }
        });
        
        return result;
      };

      const voucherObj = groupSiblings(vouchers);
      setVoucherDetailsData({ VOUCHERS: voucherObj });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setVoucherDetailsError(err.message);
      }
    } finally {
      setVoucherDetailsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleBillRowClick = (row) => {
    const ledgerNameIndex = columns.findIndex(
      (col) =>
        col.name.includes('LedgerName') ||
        col.name.includes('Parent') ||
        col.alias?.includes('Ledger Name')
    );
    const billNameIndex = columns.findIndex((col) => col.name.includes('BillName') || col.alias?.includes('BillName'));
    const salespersonIndex = columns.findIndex((col) => col.name.includes('SalesPerson') || col.alias?.includes('SalesPerson'));

    if (ledgerNameIndex === -1 || billNameIndex === -1) return;

    const ledgerName = row[ledgerNameIndex] || '';
    const billName = row[billNameIndex] || '';
    const salesperson = salespersonIndex !== -1 ? row[salespersonIndex] || 'Unassigned' : 'Unassigned';

    if (ledgerName && billName) {
      fetchBillDrilldown(ledgerName, billName, salesperson);
    }
  };

  const handleVoucherRowClick = (masterId) => {
    if (masterId) {
      fetchVoucherDetails(masterId);
    }
  };

  const buildLedgerVoucherLoader = (ledgerName, fromDate, toDate) => async () => {
    const companyName = cleanAndEscapeForXML(company.company);
    const requestBody = {
      tallyloc_id: company.tallyloc_id,
      company: companyName,
      guid: company.guid,
      reporttype: 'Ledger Vouchers',
      ledgername: ledgerName,
      fromdate: parseInt(fromDate, 10),
      todate: parseInt(toDate, 10),
    };

    const token = getAuthToken();
    const response = await fetch(getLedgerVouchersUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    return response.json();
  };

  const fetchLedgerOutstandings = async (row, options = {}) => {
    const { initialTab = 'outstandings' } = options;
    try {
      const ledgerName = getRowValueByColumnKeywords(row, columns, ['ledgername', 'parent', 'ledger']);
      if (!ledgerName) {
        setLedgerOutstandingsError('Ledger name is empty');
        return;
      }
      const billNameValue = getRowValueByColumnKeywords(row, columns, ['billname', 'bill no', 'billnumber']);
      const billRefValue = getRowValueByColumnKeywords(row, columns, ['refno', 'reference', 'ref number', 'billref']);
      const identifierSet = new Set();
      extractBillIdentifiers(billNameValue).forEach((id) => identifierSet.add(id));
      extractBillIdentifiers(billRefValue).forEach((id) => identifierSet.add(id));

      const { fromDate, toDate } = getDefaultDateRange();

      setSelectedLedgerOutstanding({
        ledgerName,
        fromDate,
        toDate,
        billIdentifiers: Array.from(identifierSet),
        initialTab,
        onLoadLedgerVouchers: () => buildLedgerVoucherLoader(ledgerName, fromDate, toDate)(),
      });

      setShowLedgerOutstandings(true);
      setLedgerOutstandingsLoading(true);
      setLedgerOutstandingsError(null);
      setLedgerOutstandingsData(null);

      const companyName = cleanAndEscapeForXML(company.company);
      const requestBody = {
        tallyloc_id: company.tallyloc_id,
        company: companyName,
        guid: company.guid,
        reporttype: 'Bill wise O/s',
        ledgername: ledgerName,
        fromdate: parseInt(fromDate, 10),
        todate: parseInt(toDate, 10),
      };

      const token = getAuthToken();
      const response = await fetch(getLedgerVouchersUrl(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const outstandingData = await response.json();
      setLedgerOutstandingsData(outstandingData);
    } catch (err) {
      setLedgerOutstandingsError(err.message);
    } finally {
      setLedgerOutstandingsLoading(false);
    }
  };

  const fetchLedgerVouchersFromRow = (row) => fetchLedgerOutstandings(row, { initialTab: 'vouchers' });

  const closeLedgerOutstandings = () => {
    setLedgerOutstandingsData(null);
    setSelectedLedgerOutstanding(null);
    setLedgerOutstandingsError(null);
    setLedgerOutstandingsLoading(false);
    setShowLedgerOutstandings(false);
  };

  const closeDrilldown = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setDrilldownData(null);
    setSelectedBill(null);
    setDrilldownError(null);
    setDrilldownLoading(false);
    setShowDrilldown(false);
  };

  const getRowAgingBucket = (row, dueDateIndex) => {
    if (dueDateIndex === -1) return agingBucketsConfig[0]?.label || '0-30';
    const dueDateStr = row[dueDateIndex] || '';
    const diff = calculateDaysOverdue(dueDateStr);
    if (diff === null) return agingBucketsConfig[0]?.label || '0-30';
    
    // Find the appropriate bucket based on days overdue
    for (let i = 0; i < agingBucketsConfig.length; i++) {
      const bucket = agingBucketsConfig[i];
      if (bucket.maxDays === null) {
        // Last bucket with no max (infinity)
        return bucket.label;
      }
      if (diff <= bucket.maxDays) {
        return bucket.label;
      }
    }
    
    // Fallback to first bucket
    return agingBucketsConfig[0]?.label || '0-30';
  };

  const matchesSelectedAgingBucket = (row, dueDateIndex, bucket) => {
    if (!bucket) return true;
    return getRowAgingBucket(row, dueDateIndex) === bucket;
  };

  const salespersonTotals = useMemo(() => {
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
    let dueDateIndex = columns.findIndex(
      (col) => 
        col.name?.toLowerCase().includes('duedate') || 
        col.alias?.toLowerCase().includes('duedate') ||
        col.name?.toLowerCase().includes('due date') ||
        col.alias?.toLowerCase().includes('due date')
    );
    
    // Fallback: If not found by name, try to find by position (SQL query order: LedgerName, SalesPerson, BillName, BillDate, DueDate, OpeningBalance, ClosingBalance)
    // DueDate should be at index 4 (0-indexed)
    if (dueDateIndex === -1 && columns.length > 4) {
      // Check if column at index 4 looks like a date column
      const candidateCol = columns[4];
      if (candidateCol && (candidateCol.name?.toLowerCase().includes('date') || candidateCol.alias?.toLowerCase().includes('date'))) {
        dueDateIndex = 4;
      }
    }

    if (salespersonIndex === -1 || closingBalanceIndex === -1) {
      return [];
    }

    let filteredReceivables = receivables;
    if (selectedAgingBucket) {
      filteredReceivables = receivables.filter((row) =>
        matchesSelectedAgingBucket(row, dueDateIndex, selectedAgingBucket)
      );
    }

    // Filter by enabled salespersons
    // If size === 0, none are selected (show nothing)
    // If size > 0, only show selected salespersons
    // Filter by enabled salespersons
    // If size === 0, none are selected (show nothing)
    // If size > 0, only show selected salespersons
    if (enabledSalespersons.size > 0 && salespersonIndex !== -1) {
      filteredReceivables = filteredReceivables.filter((row) => {
        const salespersonName = row[salespersonIndex] || 'Unassigned';
        return enabledSalespersons.has(salespersonName);
      });
    } else if (enabledSalespersons.size === 0 && salespersonIndex !== -1) {
      // None selected - show nothing
      filteredReceivables = [];
    } else if (enabledSalespersons.size === 0 && salespersonIndex !== -1) {
      // None selected - show nothing
      filteredReceivables = [];
    }

    const salespersonMap = new Map();
    filteredReceivables.forEach((row) => {
      const salespersonName = row[salespersonIndex] || 'Unassigned';
      const closingBalanceStr = row[closingBalanceIndex] || '0';
      const debitBalance = parseFloat(closingBalanceStr) || 0;

      if (!salespersonMap.has(salespersonName)) {
        salespersonMap.set(salespersonName, { name: salespersonName, value: 0, billCount: 0 });
      }

      const entry = salespersonMap.get(salespersonName);
      entry.value += debitBalance;
      entry.billCount += 1;
    });

    return Array.from(salespersonMap.values()).sort((a, b) => b.value - a.value);
  }, [receivables, columns, selectedAgingBucket, enabledSalespersons]);

  const agingBuckets = useMemo(() => {
    if (!receivables || receivables.length === 0 || !columns || columns.length === 0) {
      return [];
    }

    const closingBalanceIndex = columns.findIndex(
      (col) =>
        col.name.includes('ClosingBalance') ||
        col.name.includes('Closingbalance') ||
        col.alias?.includes('Closing Balance')
    );
    const drCrIndex = columns.findIndex((col) => col.name === 'DrCr' || col.alias?.includes('Dr/Cr'));
    let dueDateIndex = columns.findIndex(
      (col) => 
        col.name?.toLowerCase().includes('duedate') || 
        col.alias?.toLowerCase().includes('duedate') ||
        col.name?.toLowerCase().includes('due date') ||
        col.alias?.toLowerCase().includes('due date')
    );
    
    // Fallback: If not found by name, try to find by position (SQL query order: LedgerName, SalesPerson, BillName, BillDate, DueDate, OpeningBalance, ClosingBalance)
    // DueDate should be at index 4 (0-indexed)
    if (dueDateIndex === -1 && columns.length > 4) {
      // Check if column at index 4 looks like a date column
      const candidateCol = columns[4];
      if (candidateCol && (candidateCol.name?.toLowerCase().includes('date') || candidateCol.alias?.toLowerCase().includes('date'))) {
        dueDateIndex = 4;
      }
    }
    
    const salespersonIndex = columns.findIndex(
      (col) =>
        col.name.includes('SalesPerson') ||
        col.alias?.includes('SalesPerson') ||
        col.name.includes('Salesperson')
    );

    if (closingBalanceIndex === -1 || drCrIndex === -1) {
      return [];
    }

    let filteredReceivables = receivables;
    if (selectedSalesperson && salespersonIndex !== -1) {
      filteredReceivables = filteredReceivables.filter((row) => {
        const salespersonName = row[salespersonIndex] || 'Unassigned';
        return salespersonName === selectedSalesperson;
      });
    }

    // Filter by enabled salespersons
    // If size === 0, none are selected (show nothing)
    // If size > 0, only show selected salespersons
    if (enabledSalespersons.size > 0 && salespersonIndex !== -1) {
      filteredReceivables = filteredReceivables.filter((row) => {
        const salespersonName = row[salespersonIndex] || 'Unassigned';
        return enabledSalespersons.has(salespersonName);
      });
    } else if (enabledSalespersons.size === 0 && salespersonIndex !== -1) {
      // None selected - show nothing
      filteredReceivables = [];
    }

    // Initialize buckets from config
    const buckets = {};
    agingBucketsConfig.forEach((bucket) => {
      buckets[bucket.label] = 0;
    });

    filteredReceivables.forEach((row) => {
      const closingBalanceStr = row[closingBalanceIndex] || '0';
      const closingBalance = Math.abs(parseFloat(closingBalanceStr) || 0);
      if (closingBalance <= 0) return;

      const bucketKey = getRowAgingBucket(row, dueDateIndex);
      if (buckets.hasOwnProperty(bucketKey)) {
      buckets[bucketKey] += closingBalance;
      }
    });

    return Object.keys(buckets).map((key) => ({
      name: key,
      value: buckets[key],
    }));
  }, [receivables, columns, selectedSalesperson, enabledSalespersons, agingBucketsConfig]);

  const summary = useMemo(() => {
    if (!receivables || receivables.length === 0 || !columns || columns.length === 0) {
      return {
        balance: 0,
        withinDue: 0,
        overDue: 0,
        overDuePercent: 0,
      };
    }

    const closingBalanceIndex = columns.findIndex(
      (col) =>
        col.name.includes('ClosingBalance') ||
        col.name.includes('Closingbalance') ||
        col.alias?.includes('Closing Balance')
    );
    const drCrIndex = columns.findIndex((col) => col.name === 'DrCr' || col.alias?.includes('Dr/Cr'));
    let dueDateIndex = columns.findIndex(
      (col) => 
        col.name?.toLowerCase().includes('duedate') || 
        col.alias?.toLowerCase().includes('duedate') ||
        col.name?.toLowerCase().includes('due date') ||
        col.alias?.toLowerCase().includes('due date')
    );
    
    // Fallback: If not found by name, try to find by position (SQL query order: LedgerName, SalesPerson, BillName, BillDate, DueDate, OpeningBalance, ClosingBalance)
    // DueDate should be at index 4 (0-indexed)
    if (dueDateIndex === -1 && columns.length > 4) {
      // Check if column at index 4 looks like a date column
      const candidateCol = columns[4];
      if (candidateCol && (candidateCol.name?.toLowerCase().includes('date') || candidateCol.alias?.toLowerCase().includes('date'))) {
        dueDateIndex = 4;
      }
    }
    
    const salespersonIndex = columns.findIndex(
      (col) =>
        col.name.includes('SalesPerson') ||
        col.alias?.includes('SalesPerson') ||
        col.name.includes('Salesperson')
    );

    // Debug: Log column names and dueDateIndex
    console.log('Column finding debug:', {
      dueDateIndex,
      columns: columns.map((c, i) => ({ index: i, name: c.name, alias: c.alias })),
    });

    if (closingBalanceIndex === -1 || drCrIndex === -1) {
      return {
        balance: 0,
        withinDue: 0,
        overDue: 0,
        overDuePercent: 0,
      };
    }

    let filteredReceivables = receivables;
    if (selectedSalesperson && salespersonIndex !== -1) {
      filteredReceivables = filteredReceivables.filter((row) => {
        const salespersonName = row[salespersonIndex] || 'Unassigned';
        return salespersonName === selectedSalesperson;
      });
    }
    if (selectedAgingBucket) {
      filteredReceivables = filteredReceivables.filter((row) =>
        matchesSelectedAgingBucket(row, dueDateIndex, selectedAgingBucket)
      );
    }

    // Filter by enabled salespersons
    // If size === 0, none are selected (show nothing)
    // If size > 0, only show selected salespersons
    if (enabledSalespersons.size > 0 && salespersonIndex !== -1) {
      filteredReceivables = filteredReceivables.filter((row) => {
        const salespersonName = row[salespersonIndex] || 'Unassigned';
        return enabledSalespersons.has(salespersonName);
      });
    } else if (enabledSalespersons.size === 0 && salespersonIndex !== -1) {
      // None selected - show nothing
      filteredReceivables = [];
    }

    let netBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    let overdueDebitTotal = 0;
    let netWithinDueTotal = 0;
    let netOverDueTotal = 0;
    let overdueCount = 0;
    let withinDueCount = 0;

    filteredReceivables.forEach((row, rowIndex) => {
      const drCr = row[drCrIndex] || '';
      const closingBalanceStr = row[closingBalanceIndex] || '0';
      const closingBalance = parseFloat(closingBalanceStr) || 0;
      if (Number.isNaN(closingBalance)) {
        return;
      }

      const signedClosingBalance = drCr === 'Dr' ? -closingBalance : closingBalance;
      netBalance += signedClosingBalance;

      if (drCr === 'Dr') {
        totalDebit += closingBalance;
      } else if (drCr === 'Cr') {
        totalCredit += closingBalance;
      }

      const assignToWithin = () => {
        netWithinDueTotal += signedClosingBalance;
        withinDueCount++;
      };
      const assignToOverdue = () => {
        netOverDueTotal += signedClosingBalance;
        overdueCount++;
        if (drCr === 'Dr') {
          overdueDebitTotal += closingBalance;
        }
      };

      if (dueDateIndex !== -1) {
        const dueDateStr = row[dueDateIndex] || '';
        const diff = calculateDaysOverdue(dueDateStr);
        // Debug: Log first few date values and calculations
        if (rowIndex < 3) {
          console.log('DueDate check:', { dueDateStr, diff, signedClosingBalance, drCr });
        }
        if (diff === null || diff <= 0) {
          assignToWithin();
        } else {
          assignToOverdue();
        }
      } else {
        // DueDate column not found - assign to within due
        assignToWithin();
      }
    });

    const overDuePercent = totalDebit > 0 ? (overdueDebitTotal / totalDebit) * 100 : 0;

    // Debug: Log overdue calculation summary
    console.log('Overdue calculation summary:', {
      dueDateIndex,
      totalRows: filteredReceivables.length,
      overdueCount,
      withinDueCount,
      netOverDueTotal,
      overdueDebitTotal,
      overDuePercent,
      totalDebit,
    });

    return {
      balance: netBalance,
      totalDebit,
      totalCredit,
      withinDue: netWithinDueTotal,
      overDue: netOverDueTotal,
      overDuePercent,
    };
  }, [receivables, columns, selectedSalesperson, selectedAgingBucket, enabledSalespersons]);

  const handleFilterCustomer = (row) => {
    const ledgerNameIndex = columns.findIndex(
      (col) =>
        col.name.includes('LedgerName') ||
        col.name.includes('Parent') ||
        col.alias?.includes('Ledger Name')
    );
    if (ledgerNameIndex === -1) return;
    const ledgerName = row[ledgerNameIndex] || '';
    if (ledgerName) {
      handleFilter(ledgerNameIndex, ledgerName);
      setOpenOptionsRow(null);
    }
  };

  const handleFilter = (columnIndex, value) => {
    setFilters((prevFilters) => {
      const newFilters = { ...prevFilters };
      if (value === '' || value === 'all') {
        delete newFilters[columnIndex];
      } else {
        newFilters[columnIndex] = value.toLowerCase();
      }
      return newFilters;
    });
  };

  const handleFilterSalesperson = (row) => {
    const salespersonIndex = columns.findIndex(
      (col) =>
        col.name.includes('SalesPerson') ||
        col.alias?.includes('SalesPerson') ||
        col.name.includes('Salesperson')
    );
    if (salespersonIndex === -1) return;
    const salesperson = row[salespersonIndex] || '';
    if (salesperson) {
      handleFilter(salespersonIndex, salesperson);
      setOpenOptionsRow(null);
    }
  };

  if (!company) {
    return (
      <div className="receivables-page">
        <div className="empty-state">
          <p>Please select a company to view receivables.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="receivables-page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading receivables data...</p>
        </div>
      </div>
    );
  }

  // Don't return early on error - show header and error message

  return (
    <div className="receivables-page">
      <div className="page-header">
        <div className="page-header-left">
          {canGoBack && (
            <button onClick={handleBack} className="back-button">
          ← Back to Companies
        </button>
          )}
          <div className="page-header-titles">
        <h1>Customer Receivables</h1>
            <p className="subtitle">{company?.company || ''}</p>
          </div>
        </div>
        <div className="page-header-actions">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="settings-button"
            title="Settings"
            style={{
              padding: '8px 12px',
              fontSize: '14px',
              fontWeight: '500',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: showSettings ? '#3b82f6' : '#fff',
              color: showSettings ? '#fff' : '#374151',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>settings</span>
            <span>Settings</span>
          </button>
          <button
            onClick={() => fetchReceivables({ forceRefresh: true })}
            className="refresh-button"
            title="Reload receivables data"
          >
            <span className="material-icons">refresh</span>
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {showSettings && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onClick={() => setShowSettings(false)}
            >
              <div
                style={{
                  backgroundColor: '#fff',
                  borderRadius: '8px',
                  padding: '24px',
                  maxWidth: '600px',
                  width: '90%',
                  maxHeight: '90vh',
                  overflow: 'auto',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>Settings</h2>
                  <button
                    onClick={() => setShowSettings(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      color: '#6b7280',
                    }}
                  >
                    <span className="material-icons">close</span>
                  </button>
                </div>

                {/* Currency Scale Section */}
                <div style={{ marginBottom: '32px' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#374151' }}>Currency Scale</h3>
                  <select
                    value={currencyScale}
                    onChange={(e) => setCurrencyScale(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      fontSize: '14px',
                      fontWeight: '400',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      backgroundColor: '#fff',
                      color: '#374151',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      width: '100%',
                    }}
                  >
                    <option value="auto">Auto</option>
                    <option value="crore">Crore</option>
                    <option value="lakh">Lakh</option>
                    <option value="thousand">Thousand</option>
                    <option value="full">Full</option>
                  </select>
                </div>

                {/* Ageing Buckets Section */}
                <div>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#374151' }}>Ageing Buckets</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {agingBucketsConfig.map((bucket, index) => (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'center',
                          padding: '12px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          backgroundColor: '#f9fafb',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500', color: '#6b7280' }}>
                            Label
                          </label>
                          <input
                            type="text"
                            value={bucket.label}
                            onChange={(e) => {
                              const newConfig = [...agingBucketsConfig];
                              newConfig[index].label = e.target.value;
                              setAgingBucketsConfig(newConfig);
                            }}
                            style={{
                              padding: '6px 8px',
                              fontSize: '14px',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              width: '100%',
                            }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500', color: '#6b7280' }}>
                            Max Days {bucket.maxDays === null ? '(No limit)' : ''}
                          </label>
                          <input
                            type="number"
                            value={bucket.maxDays === null ? '' : bucket.maxDays}
                            onChange={(e) => {
                              const newConfig = [...agingBucketsConfig];
                              newConfig[index].maxDays = e.target.value === '' ? null : parseInt(e.target.value, 10);
                              setAgingBucketsConfig(newConfig);
                            }}
                            placeholder="No limit"
                            style={{
                              padding: '6px 8px',
                              fontSize: '14px',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              width: '100%',
                            }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500', color: '#6b7280' }}>
                            Color
                          </label>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                              type="color"
                              value={bucket.color}
                              onChange={(e) => {
                                const newConfig = [...agingBucketsConfig];
                                newConfig[index].color = e.target.value;
                                setAgingBucketsConfig(newConfig);
                              }}
                              style={{
                                width: '40px',
                                height: '36px',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                cursor: 'pointer',
                              }}
                            />
                            <input
                              type="text"
                              value={bucket.color}
                              onChange={(e) => {
                                const newConfig = [...agingBucketsConfig];
                                newConfig[index].color = e.target.value;
                                setAgingBucketsConfig(newConfig);
                              }}
                              style={{
                                padding: '6px 8px',
                                fontSize: '14px',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                flex: 1,
                              }}
                            />
                          </div>
                        </div>
                        {agingBucketsConfig.length > 1 && (
                          <button
                            onClick={() => {
                              const newConfig = agingBucketsConfig.filter((_, i) => i !== index);
                              setAgingBucketsConfig(newConfig);
                            }}
                            style={{
                              padding: '8px',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#ef4444',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            title="Remove bucket"
                          >
                            <span className="material-icons" style={{ fontSize: '20px' }}>delete</span>
                          </button>
                        )}
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => {
                          setAgingBucketsConfig([
                            ...agingBucketsConfig,
                            { label: '', maxDays: null, color: '#60a5fa' },
                          ]);
                        }}
                        style={{
                          padding: '8px 12px',
                          fontSize: '14px',
                          fontWeight: '500',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          backgroundColor: '#fff',
                          color: '#374151',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          justifyContent: 'center',
                          flex: 1,
                        }}
                      >
                        <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
                        Add Bucket
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('Are you sure you want to reset ageing buckets to default configuration?')) {
                            setAgingBucketsConfig([...DEFAULT_AGING_BUCKETS]);
                          }
                        }}
                        style={{
                          padding: '8px 12px',
                          fontSize: '14px',
                          fontWeight: '500',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          backgroundColor: '#fff',
                          color: '#374151',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          justifyContent: 'center',
                          flex: 1,
                        }}
                        title="Reset to default ageing buckets"
                      >
                        <span className="material-icons" style={{ fontSize: '18px' }}>restore</span>
                        Reset to Defaults
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

      <div className="receivables-content">
          {error ? (
            <div className="error-container" style={{ padding: '24px', margin: '24px', backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px' }}>
              <h2 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: '600', color: '#dc2626' }}>Error loading receivables</h2>
              <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#991b1b' }}>{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  fetchReceivables({ forceRefresh: true });
                }}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: '500',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: '#dc2626',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          ) : receivables.length === 0 ? (
        <div className="empty-state">
          <p>No receivables data found</p>
        </div>
      ) : (
            <>
          <div className="receivables-summary-layout">
            <SummaryCards summary={summary} currencyScale={currencyScale} />
            <div className="summary-charts-wrapper">
              <div className="summary-chart-card aging-chart-card">
                <div className="summary-chart-card-header">
                  <h2>Ageing Overview</h2>
                </div>
                <AgingChart
                  data={agingBuckets}
                  selectedBucket={selectedAgingBucket}
                  onBucketClick={setSelectedAgingBucket}
                  currencyScale={currencyScale}
                  colors={agingBucketsConfig.reduce((acc, bucket) => {
                    acc[bucket.label] = bucket.color;
                    return acc;
                  }, {})}
                />
              </div>
              <div className="summary-chart-card salesperson-chart-card">
                <div className="summary-chart-card-header">
                  <h2>Salesperson Totals</h2>
                  <button
                    onClick={() => setShowSalespersonConfig(!showSalespersonConfig)}
                    className="salesperson-config-button"
                  >
                    {showSalespersonConfig ? 'Hide Config' : 'Configure Salespersons'}
                  </button>
                </div>
                {showSalespersonConfig && (
                  <SalespersonConfigPanel
                    receivables={receivables}
                    columns={columns}
                    enabledSalespersons={enabledSalespersons}
                    onEnabledSalespersonsChange={setEnabledSalespersons}
                  />
                )}
                <div className="salesperson-chart-container">
                  <SalespersonChart
                    data={salespersonTotals}
                    selectedSalesperson={selectedSalesperson}
                    onSalespersonClick={setSelectedSalesperson}
                  />
                </div>
              </div>
            </div>
          </div>

          {(selectedAgingBucket || selectedSalesperson) && (
            <div className="chart-filters-indicator">
              <div className="active-filters">
                {selectedAgingBucket && (
                  <span className="filter-badge">
                    Aging: {selectedAgingBucket}
                    <button onClick={() => setSelectedAgingBucket(null)} className="filter-remove">
                      ×
                    </button>
                  </span>
                )}
                {selectedSalesperson && (
                  <span className="filter-badge">
                    Salesperson: {selectedSalesperson}
                    <button onClick={() => setSelectedSalesperson(null)} className="filter-remove">
                      ×
                    </button>
                  </span>
                )}
              </div>
              <button
                className="clear-filters-button"
                onClick={() => {
                  setSelectedAgingBucket(null);
                  setSelectedSalesperson(null);
                }}
              >
                Clear All Filters
              </button>
            </div>
          )}

          <ReceivablesTable
            receivables={receivables}
            columns={columns}
            viewMode={viewMode}
            setViewMode={setViewMode}
            groupBy={groupBy}
            setGroupBy={setGroupBy}
            sortConfig={sortConfig}
            setSortConfig={setSortConfig}
            filters={filters}
            setFilters={setFilters}
            dropdownOpen={dropdownOpen}
            setDropdownOpen={setDropdownOpen}
            dropdownSearch={dropdownSearch}
            setDropdownSearch={setDropdownSearch}
            expandedCustomers={expandedCustomers}
            setExpandedCustomers={setExpandedCustomers}
            openOptionsRow={openOptionsRow}
            setOpenOptionsRow={setOpenOptionsRow}
            selectedAgingBucket={selectedAgingBucket}
            selectedSalesperson={selectedSalesperson}
            enabledSalespersons={enabledSalespersons}
            onBillRowClick={handleBillRowClick}
            onFilterCustomer={handleFilterCustomer}
            onFilterSalesperson={handleFilterSalesperson}
            onShowVoucherDetails={handleBillRowClick}
            onShowLedgerVouchers={fetchLedgerVouchersFromRow}
            onShowLedgerOutstandings={fetchLedgerOutstandings}
            company={company}
            getRowAgingBucket={getRowAgingBucket}
          />
            </>
      )}
      </div>

      {showDrilldown && (
        <BillDrilldownModal
          data={drilldownData}
          loading={drilldownLoading}
          error={drilldownError}
          selectedBill={selectedBill}
          onClose={closeDrilldown}
          onRowClick={handleVoucherRowClick}
        />
      )}

      {showVoucherDetails && (
        <VoucherDetailsModal
          voucherData={voucherDetailsData}
          loading={voucherDetailsLoading}
          error={voucherDetailsError}
          onClose={() => {
            if (abortControllerRef.current) {
              abortControllerRef.current.abort();
              abortControllerRef.current = null;
            }
            setVoucherDetailsData(null);
            setVoucherDetailsError(null);
            setVoucherDetailsLoading(false);
            setShowVoucherDetails(false);
          }}
        />
      )}

      {showLedgerOutstandings && (
        <LedgerOutstandingsModal
          data={ledgerOutstandingsData}
          loading={ledgerOutstandingsLoading}
          error={ledgerOutstandingsError}
          selectedLedger={selectedLedgerOutstanding}
          company={company}
          onClose={closeLedgerOutstandings}
        />
      )}
    </div>
  );
};

export default ReceivablesPage;


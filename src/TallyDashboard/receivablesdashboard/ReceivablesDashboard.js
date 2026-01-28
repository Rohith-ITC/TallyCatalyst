import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { IconButton, Menu, MenuItem } from '@mui/material';
import { getApiUrl } from '../../config';
import {
  formatCurrency,
  calculateDaysOverdue,
  parseDate,
} from '../../RecvDashboard/utils/helpers';
import { getCompanyConfigValue, clearCompanyConfigCache } from '../../utils/companyConfigUtils';
import { hybridCache } from '../../utils/hybridCache';
import BarChart from '../salesdashboard/components/BarChart';
import PieChart from '../salesdashboard/components/PieChart';
import TreeMap from '../salesdashboard/components/TreeMap';
import LineChart from '../salesdashboard/components/LineChart';
import {
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import ChartCard from '../salesdashboard/components/ChartCard';

const getAuthToken = () => {
  const token = sessionStorage.getItem('token');
  if (!token) {
    throw new Error('No authentication token found');
  }
  return token;
};

const RECEIVABLES_ENDPOINT = '/api/tally/bills/billsoutstanding';

const ReceivablesDashboard = ({ company }) => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  const containerRef = useRef(null);
  const headerRef = useRef(null);
  const [headerLeft, setHeaderLeft] = useState(0);
  const [headerWidth, setHeaderWidth] = useState('100%');

  const [receivables, setReceivables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [salespersonFormula, setSalespersonFormula] = useState('');
  const [salespersonTotals, setSalespersonTotals] = useState([]);
  const [salespersonField, setSalespersonField] = useState(null);
  const [fullscreenCard, setFullscreenCard] = useState(null); // 'ageing' | 'salesperson' | 'overdue' | null
  const [cardMenuAnchors, setCardMenuAnchors] = useState({}); // { ageing: element, salesperson: element, overdue: element }
  const [ageingChartType, setAgeingChartType] = useState('bar'); // 'bar' | 'pie' | 'treemap' | 'line'
  const [salespersonChartType, setSalespersonChartType] = useState('treemap');

  // Memoized handlers for opening menus to prevent event handling issues
  const handleOpenAgeingMenu = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    setCardMenuAnchors((prev) => ({
      ...prev,
      ageing: target,
    }));
  }, []);

  const handleOpenSalespersonMenu = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    setCardMenuAnchors((prev) => ({
      ...prev,
      salesperson: target,
    }));
  }, []);

  const handleOpenOverdueMenu = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    setCardMenuAnchors((prev) => ({
      ...prev,
      overdue: target,
    }));
  }, []);

  const handleOpenFullscreenMenu = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    if (fullscreenCard) {
      setCardMenuAnchors((prev) => ({
        ...prev,
        [fullscreenCard]: target,
      }));
    }
  }, [fullscreenCard]);

  const handleCloseAgeingMenu = useCallback(() => {
    setCardMenuAnchors((prev) => ({ ...prev, ageing: null }));
  }, []);

  const handleCloseSalespersonMenu = useCallback(() => {
    setCardMenuAnchors((prev) => ({ ...prev, salesperson: null }));
  }, []);

  const handleCloseOverdueMenu = useCallback(() => {
    setCardMenuAnchors((prev) => ({ ...prev, overdue: null }));
  }, []);

  // Keep header aligned with container (same pattern as SalesDashboard)
  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return;
      const width = window.innerWidth;
      setIsMobile(width <= 768);
      setWindowWidth(width);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const updateHeaderPosition = () => {
      if (containerRef.current && headerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        setHeaderLeft(containerRect.left);
        setHeaderWidth(`${containerRect.width}px`);
      }
    };

    updateHeaderPosition();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateHeaderPosition);
      window.addEventListener('scroll', updateHeaderPosition);
      const interval = setInterval(updateHeaderPosition, 100);

      return () => {
        window.removeEventListener('resize', updateHeaderPosition);
        window.removeEventListener('scroll', updateHeaderPosition);
        clearInterval(interval);
      };
    }

    return undefined;
  }, [isMobile, windowWidth]);

  const fetchReceivables = async () => {
    if (!company || !company.tallyloc_id || !company.guid || !company.company) {
      setError('No company selected');
      setReceivables([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = getAuthToken();

      const payload = {
        tallyloc_id: company.tallyloc_id,
        company: company.company,
        guid: company.guid,
      };

      const response = await fetch(getApiUrl(RECEIVABLES_ENDPOINT), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let message = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorBody = await response.json();
          if (errorBody && errorBody.message) {
            message = errorBody.message;
          }
        } catch {
          // ignore JSON parse error
        }
        throw new Error(message);
      }

      const data = await response.json();
      const rows = Array.isArray(data?.data) ? data.data : [];
      setReceivables(rows);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || 'Failed to load receivables');
      setReceivables([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadCompanyConfig = async () => {
      if (!company || !company.tallyloc_id || !company.guid) {
        setSalespersonFormula('');
        return;
      }

      try {
        const formula = await getCompanyConfigValue(
          'recvdash_salesprsn',
          company.tallyloc_id,
          company.guid
        );
        setSalespersonFormula(formula || '');
        // Optional: mirror SalesDashboard logging
        // console.log('✅ Receivables Dashboard - Loaded sales person formula from config:', formula);
      } catch (cfgError) {
        console.error('Error loading company config for receivables dashboard:', cfgError);
        setSalespersonFormula('');
      }
    };

    loadCompanyConfig();

    if (company && company.tallyloc_id && company.guid) {
      clearCompanyConfigCache(company.tallyloc_id, company.guid);
    }
  }, [company?.tallyloc_id, company?.guid]);

  useEffect(() => {
    fetchReceivables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.tallyloc_id, company?.guid]);

  const parseNumber = (value) => {
    const num = typeof value === 'number' ? value : parseFloat(value);
    return Number.isFinite(num) ? num : 0;
  };

  const now = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const {
    totalOutstanding,
    withinDueAmount,
    overdueAmount,
    overduePercent,
    ageingBuckets,
    upcomingOverdue,
  } = useMemo(() => {
    if (!Array.isArray(receivables) || receivables.length === 0) {
      return {
        totalOutstanding: 0,
        withinDueAmount: 0,
        overdueAmount: 0,
        overduePercent: 0,
        ageingBuckets: [],
        upcomingOverdue: [],
      };
    }

    let total = 0;
    let overdue = 0;

    const salespersonMap = new Map();

    // Ageing buckets based on days overdue
    const bucketDefs = [
      { key: '0-30', label: '0-30 days', min: 0, max: 30 },
      { key: '31-60', label: '31-60 days', min: 31, max: 60 },
      { key: '61-90', label: '61-90 days', min: 61, max: 90 },
      { key: '91-180', label: '91-180 days', min: 91, max: 180 },
      { key: '>180', label: '>180 days', min: 181, max: Infinity },
    ];
    const bucketTotals = bucketDefs.reduce((acc, b) => {
      acc[b.key] = 0;
      return acc;
    }, {});

    const upcoming = [];

    receivables.forEach((row) => {
      const debitCls = parseNumber(row.DEBITCLSBAL ?? row.DEBITOPENBAL);
      const creditCls = parseNumber(row.CREDITCLSBAL ?? row.CREDITOPENBAL);
      const amount = debitCls - creditCls;

      if (!amount) {
        return;
      }

      total += amount;

      const overDaysRaw =
        row.OVERDUEDAYS !== undefined && row.OVERDUEDAYS !== null
          ? parseNumber(row.OVERDUEDAYS)
          : null;

      const dueDateStr = row.DUEON || row.DUEDATE || row.DueDate;

      let daysOverdue = null;
      if (overDaysRaw !== null && !Number.isNaN(overDaysRaw)) {
        daysOverdue = overDaysRaw;
      } else if (dueDateStr) {
        const diff = calculateDaysOverdue(dueDateStr);
        daysOverdue = diff !== null ? diff : 0;
      }

      if (daysOverdue !== null && daysOverdue > 0) {
        overdue += amount;
      }

      const effectiveOverdue = daysOverdue !== null ? Math.max(daysOverdue, 0) : 0;
      const bucket = bucketDefs.find(
        (b) => effectiveOverdue >= b.min && effectiveOverdue <= b.max
      );
      if (bucket) {
        bucketTotals[bucket.key] += amount;
      }

      if (dueDateStr) {
        const d = parseDate(dueDateStr);
        if (d && !Number.isNaN(d.getTime())) {
          const dueDateOnly = new Date(d);
          dueDateOnly.setHours(0, 0, 0, 0);
          const diffMs = dueDateOnly - now;
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays <= 7) {
            upcoming.push({
              ...row,
              amount,
              daysUntilDue: diffDays,
            });
          }
        }
      }

      // Note: salesperson totals are computed separately from cached sales data,
      // not from receivables rows, to mirror SalesDashboard behaviour.
    });

    const withinDue = total - overdue;
    const overduePct = total > 0 ? (overdue / total) * 100 : 0;

    const ageing = bucketDefs.map((b) => ({
      key: b.key,
      label: b.label,
      amount: bucketTotals[b.key] || 0,
    }));

    const upcomingSorted = upcoming.sort(
      (a, b) => a.daysUntilDue - b.daysUntilDue
    );

    return {
      totalOutstanding: total,
      withinDueAmount: withinDue,
      overdueAmount: overdue,
      overduePercent: overduePct,
      ageingBuckets: ageing,
      upcomingOverdue: upcomingSorted,
    };
  }, [receivables, now]);

  const ageingChartData = useMemo(
    () =>
      (ageingBuckets || []).map((b) => ({
        label: b.label,
        value: Math.abs(b.amount || 0),
      })),
    [ageingBuckets]
  );

  // Extract salesperson from a sales voucher using the same pattern as SalesDashboard
  const extractSalespersonFromVoucher = useCallback(
    (voucher) => {
      const getFormulaFieldValue = () => {
        if (!salespersonFormula) return null;

        const tokenMatch = salespersonFormula.match(/([A-Za-z0-9_]+)$/);
        const token = tokenMatch ? tokenMatch[1] : null;
        if (!token) return null;

        const possibleKeys = [token, token.toLowerCase(), token.toUpperCase()];
        const voucherKeys = Object.keys(voucher || {});
        const matchingKey = voucherKeys.find(
          (k) => k.toLowerCase() === token.toLowerCase()
        );

        const keyToUse =
          matchingKey ||
          possibleKeys.find((k) => voucher && voucher[k] !== undefined);
        if (!keyToUse) return null;

        const val = voucher[keyToUse];
        if (val === undefined || val === null || val === '') return null;
        return String(val).trim();
      };

      const formulaSalesperson = getFormulaFieldValue();

  return (
        formulaSalesperson ||
        voucher.salesprsn ||
        voucher.SalesPrsn ||
        voucher.SALESPRSN ||
        voucher.salesperson ||
        voucher.SalesPerson ||
        voucher.salespersonname ||
        voucher.SalesPersonName ||
        voucher.sales_person ||
        voucher.SALES_PERSON ||
        voucher.sales_person_name ||
        voucher.SALES_PERSON_NAME ||
        voucher.salespersonname ||
        voucher.SALESPERSONNAME ||
        null
      );
    },
    [salespersonFormula]
  );

  // Load salesperson totals from cached sales data (same source as SalesDashboard)
  useEffect(() => {
    const loadSalespersonTotals = async () => {
      if (!company || !company.tallyloc_id || !company.guid) {
        setSalespersonTotals([]);
        setSalespersonField(null);
        return;
      }

      try {
        const companyInfo = {
          guid: company.guid,
          tallyloc_id: company.tallyloc_id,
        };

        const completeCache = await hybridCache.getCompleteSalesData(
          companyInfo
        );
        const vouchers =
          completeCache?.data?.vouchers &&
          Array.isArray(completeCache.data.vouchers)
            ? completeCache.data.vouchers
            : [];

        if (!vouchers.length || !Array.isArray(receivables) || receivables.length === 0) {
          setSalespersonTotals([]);
          setSalespersonField(null);
          return;
        }

        // Build a mapping from ledger/customer name -> salesperson using cached sales data
        const ledgerToSalesperson = new Map();
        const normalizeName = (value) =>
          value && typeof value === 'string'
            ? value.trim().toUpperCase()
            : value
            ? String(value).trim().toUpperCase()
            : '';

        vouchers.forEach((voucher) => {
          const sp = extractSalespersonFromVoucher(voucher);
          const ledgerName =
            voucher.partyledgername || voucher.party || voucher.LEDGERNAME;

          if (!sp || !ledgerName) return;

          const key = normalizeName(ledgerName);
          if (!key) return;

          if (!ledgerToSalesperson.has(key)) {
            ledgerToSalesperson.set(key, sp);
          }
        });

        const map = new Map();

        // Now aggregate receivables closing balances by mapped salesperson,
        // mirroring the old ReceivablesPage logic for values.
        receivables.forEach((row) => {
          const ledgerName =
            row.LEDGERNAME || row.LedgerName || row.ledgername || null;
          if (!ledgerName) return;

          const key = normalizeName(ledgerName);
          if (!key) return;

          const sp = ledgerToSalesperson.get(key) || 'Unassigned';

          const debitCls = parseNumber(row.DEBITCLSBAL ?? row.DEBITOPENBAL);
          const creditCls = parseNumber(row.CREDITCLSBAL ?? row.CREDITOPENBAL);
          const amount = debitCls - creditCls;
          if (!amount) return;

          if (!map.has(sp)) {
            map.set(sp, { name: sp, value: 0, billCount: 0 });
          }

          const entry = map.get(sp);
          entry.value += amount;
          entry.billCount += 1;
        });

        const list = Array.from(map.values()).sort(
          (a, b) => b.value - a.value
        );

        setSalespersonTotals(list);
        setSalespersonField(list.length > 0 ? 'receivables_by_sales' : null);
      } catch (e) {
        console.error(
          'Error loading salesperson totals from sales cache:',
          e
        );
        setSalespersonTotals([]);
        setSalespersonField(null);
      }
    };

    loadSalespersonTotals();
  }, [company?.guid, company?.tallyloc_id, extractSalespersonFromVoucher, parseNumber, receivables]);

  const formatLastUpdated = () => {
    if (!lastUpdated) return '';
    return lastUpdated.toLocaleString();
  };

  return (
    <>
      <style>
        {`
          #receivables-dashboard-header {
            position: fixed !important;
            top: 0 !important;
            z-index: 1000 !important;
            box-sizing: border-box !important;
          }
          #receivables-dashboard-header-spacer {
            height: 64px;
            width: 100%;
            flex-shrink: 0;
          }
          @media (max-width: 768px) {
            #receivables-dashboard-header-spacer {
              height: 72px;
            }
          }
        `}
      </style>
      <div
        id="receivables-dashboard-container"
        ref={containerRef}
        style={{
          background: 'transparent',
      minHeight: '100vh',
          padding: isMobile ? '12px' : '0px',
          width: isMobile ? '100vw' : '80vw',
          margin: 0,
          display: 'block',
          overflowX: 'hidden',
        }}
      >
        {/* Header */}
        <div
          id="receivables-dashboard-header"
          ref={headerRef}
          style={{
            padding: isMobile ? '16px 20px' : '12px 20px',
            borderBottom: 'none',
            background: '#0b1736',
            borderRadius: isMobile ? '0' : '12px',
            position: 'fixed',
            top: 0,
            left: `${headerLeft}px`,
            width: headerWidth,
            zIndex: 1000,
            marginBottom: 0,
            boxShadow:
              '0 2px 4px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.07)',
            border: 'none',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            boxSizing: 'border-box',
          }}
        >
          {/* Left: Title */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
        borderRadius: '8px',
                background: '#1e3a8a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span
                className="material-icons"
                style={{ color: 'white', fontSize: '20px' }}
              >
                account_balance
              </span>
            </div>
            <div>
              <h1
                style={{
                  margin: 0,
                  color: 'white',
                  fontSize: isMobile ? '18px' : '20px',
                  fontWeight: 700,
                  lineHeight: '1.2',
                  fontFamily: 'sans-serif',
                }}
              >
                Receivables Dashboard
        </h1>
              {company?.company && (
                <div
                  style={{
                    marginTop: '2px',
                    fontSize: '12px',
                    color: '#e5e7eb',
                    opacity: 0.9,
                  }}
                >
                  {company.company}
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
              flex: 1,
            }}
          >
            {lastUpdated && (
              <div
                style={{
                  color: '#e5e7eb',
                  fontSize: '12px',
                  opacity: 0.8,
                  whiteSpace: 'nowrap',
                }}
              >
                Last updated: {formatLastUpdated()}
              </div>
            )}
            <button
              type="button"
              onClick={fetchReceivables}
              disabled={loading}
              style={{
                background: loading ? '#4b5563' : '#10b981',
                color: 'white',
        borderRadius: '8px',
                padding: '6px 12px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span className="material-icons" style={{ fontSize: '18px' }}>
                refresh
              </span>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Spacer so content doesn't hide under fixed header */}
        <div id="receivables-dashboard-header-spacer" />

        {/* Main content */}
        <div
          style={{
            padding: isMobile ? '12px' : '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {error && (
            <div
              style={{
                background: '#fef2f2',
                borderRadius: '12px',
                border: '1px solid #fecaca',
                padding: '12px 16px',
                color: '#b91c1c',
          fontSize: '14px',
              }}
            >
              {error}
            </div>
          )}

          {/* KPI cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: isMobile ? '12px' : '16px',
              marginBottom: '0',
              marginTop: isMobile ? '8px' : '12px',
            }}
          >
            {/* Total Receivables */}
            <div
              style={{
                background: '#1e40af',
                borderRadius: '10px',
                padding: isMobile ? '12px' : '16px',
                border: 'none',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
              }}
            >
              {/* Background Area Chart */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '50%',
                  opacity: 0.6,
                  pointerEvents: 'none',
                  overflow: 'hidden',
                  borderRadius: '0 0 10px 10px',
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={[
                      { value: 10 },
                      { value: 30 },
                      { value: 20 },
                      { value: 40 },
                      { value: 25 },
                      { value: 35 },
                    ]}
                    margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#bfdbfe" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#bfdbfe" stopOpacity={0.3} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="none"
                      fill="url(#totalGradient)"
                      fillOpacity={1}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Content */}
              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <p
                  style={{
                    margin: '0 0 6px 0',
                    fontSize: isMobile ? '9px' : '10px',
                    fontWeight: '600',
                    color: '#e0e7ff',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    lineHeight: '1.2',
                  }}
                >
                  TOTAL RECEIVABLES
                </p>
                <p
                  style={{
                    margin: '0 0 auto 0',
                    fontSize: isMobile ? '16px' : '20px',
                    fontWeight: '700',
                    color: '#ffffff',
                    lineHeight: '1.2',
                    letterSpacing: '-0.02em',
                    whiteSpace: 'nowrap',
                    overflow: 'visible',
                  }}
                >
                  {formatCurrency(totalOutstanding)}
                </p>

                {/* Icon in bottom right */}
                <div
                  style={{
                    width: isMobile ? '32px' : '36px',
                    height: isMobile ? '32px' : '36px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '8px',
                    alignSelf: 'flex-end',
                  }}
                >
                  <span
                    className="material-icons"
                    style={{
                      fontSize: isMobile ? '16px' : '18px',
                      color: '#ffffff',
                    }}
                  >
                    account_balance_wallet
                  </span>
                </div>
              </div>
            </div>

            {/* Within Due */}
            <div
              style={{
                background: '#1e40af',
                borderRadius: '10px',
                padding: isMobile ? '12px' : '16px',
                border: 'none',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
              }}
            >
              {/* Background Area Chart */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '50%',
                  opacity: 0.3,
                  pointerEvents: 'none',
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={[
                      { value: 15 },
                      { value: 25 },
                      { value: 18 },
                      { value: 32 },
                      { value: 28 },
                      { value: 38 },
                    ]}
                    margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="withinDueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#93c5fd" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#93c5fd" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="none"
                      fill="url(#withinDueGradient)"
                      fillOpacity={1}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Content */}
              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <p
                  style={{
                    margin: '0 0 6px 0',
                    fontSize: isMobile ? '9px' : '10px',
                    fontWeight: '600',
                    color: '#e0e7ff',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    lineHeight: '1.2',
                  }}
                >
                  WITHIN DUE
                </p>
                <p
                  style={{
                    margin: '0 0 auto 0',
                    fontSize: isMobile ? '16px' : '20px',
                    fontWeight: '700',
                    color: '#ffffff',
                    lineHeight: '1.2',
                    letterSpacing: '-0.02em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                >
                  {formatCurrency(withinDueAmount)}
                </p>

                {/* Icon in bottom right */}
                <div
                  style={{
                    width: isMobile ? '32px' : '36px',
                    height: isMobile ? '32px' : '36px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '8px',
                    alignSelf: 'flex-end',
                  }}
                >
                  <span
                    className="material-icons"
                    style={{
                      fontSize: isMobile ? '16px' : '18px',
                      color: '#ffffff',
                    }}
                  >
                    schedule
                  </span>
                </div>
              </div>
            </div>

            {/* Overdue */}
            <div
              style={{
                background: overdueAmount > 0 ? '#dc2626' : '#047857',
                borderRadius: '10px',
                padding: isMobile ? '12px' : '16px',
                border: 'none',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
              }}
            >
              {/* Background Area Chart */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '50%',
                  opacity: 0.3,
                  pointerEvents: 'none',
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={[
                      { value: 20 },
                      { value: 35 },
                      { value: 28 },
                      { value: 42 },
                      { value: 38 },
                      { value: 45 },
                    ]}
                    margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="overdueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor={overdueAmount > 0 ? '#fca5a5' : '#6ee7b7'}
                          stopOpacity={0.6}
                        />
                        <stop
                          offset="100%"
                          stopColor={overdueAmount > 0 ? '#fca5a5' : '#6ee7b7'}
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="none"
                      fill="url(#overdueGradient)"
                      fillOpacity={1}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Content */}
              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    margin: '0 0 6px 0',
                    fontSize: isMobile ? '9px' : '10px',
                    fontWeight: '600',
                    color: '#fef3c7',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    lineHeight: '1.2',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>OVERDUE</span>
                  <span>{overduePercent.toFixed(1)}%</span>
                </div>
                <p
                  style={{
                    margin: '0 0 auto 0',
                    fontSize: isMobile ? '16px' : '20px',
                    fontWeight: '700',
                    color: '#ffffff',
                    lineHeight: '1.2',
                    letterSpacing: '-0.02em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                >
                  {formatCurrency(overdueAmount)}
                </p>

                {/* Icon in bottom right */}
                <div
                  style={{
                    width: isMobile ? '32px' : '36px',
                    height: isMobile ? '32px' : '36px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '8px',
                    alignSelf: 'flex-end',
                  }}
                >
                  <span
                    className="material-icons"
                    style={{
                      fontSize: isMobile ? '16px' : '18px',
                      color: '#ffffff',
                    }}
                  >
                    warning_amber
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Ageing + Salesperson + Overdue row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
              gap: '16px',
            }}
          >
            {/* Ageing buckets - configurable chart type (Bar/Pie/Treemap/Line) */}
            {ageingChartType === 'bar' && (
              <ChartCard isMobile={isMobile}>
                <BarChart
                  data={ageingChartData}
                  formatValue={(v) => formatCurrency(v)}
                  customHeader={
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <h2
                        style={{
                          margin: 0,
                          fontSize: '15px',
                          fontWeight: 600,
                          color: '#111827',
                        }}
                      >
                        Ageing Buckets
                      </h2>
                      <IconButton
                        size="small"
                        onClick={handleOpenAgeingMenu}
                        style={{
                          padding: 4,
            color: '#64748b',
                        }}
                        title="Options"
                      >
                        <span
                          className="material-icons"
                          style={{ fontSize: '20px' }}
                        >
                          more_vert
                        </span>
                      </IconButton>
                    </div>
                  }
                />
              </ChartCard>
            )}
            {ageingChartType === 'pie' && (
              <ChartCard isMobile={isMobile}>
                <PieChart
                  data={ageingChartData}
                  formatValue={(v) => formatCurrency(v)}
                  customHeader={
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <h2
                        style={{
                          margin: 0,
                          fontSize: '15px',
                          fontWeight: 600,
                          color: '#111827',
                        }}
                      >
                        Ageing Buckets
                      </h2>
                      <IconButton
                        size="small"
                        onClick={handleOpenAgeingMenu}
                        style={{
                          padding: 4,
                          color: '#64748b',
                        }}
                        title="Options"
                      >
                        <span
                          className="material-icons"
                          style={{ fontSize: '20px' }}
                        >
                          more_vert
                        </span>
                      </IconButton>
                    </div>
                  }
                />
              </ChartCard>
            )}
            {ageingChartType === 'treemap' && (
              <ChartCard isMobile={isMobile}>
                <TreeMap
                  data={ageingChartData}
                  formatValue={(v) => formatCurrency(v)}
                  customHeader={
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <h2
                        style={{
                          margin: 0,
                          fontSize: '15px',
                          fontWeight: 600,
                          color: '#111827',
                        }}
                      >
                        Ageing Buckets
                      </h2>
                      <IconButton
                        size="small"
                        onClick={handleOpenAgeingMenu}
                        style={{
                          padding: 4,
                          color: '#64748b',
                        }}
                        title="Options"
                      >
                        <span
                          className="material-icons"
                          style={{ fontSize: '20px' }}
                        >
                          more_vert
                        </span>
                      </IconButton>
                    </div>
                  }
                />
              </ChartCard>
            )}
            {ageingChartType === 'line' && (
              <ChartCard isMobile={isMobile}>
                <LineChart
                  data={ageingChartData}
                  formatValue={(v) => formatCurrency(v)}
                  customHeader={
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <h2
                        style={{
                          margin: 0,
                          fontSize: '15px',
                          fontWeight: 600,
                          color: '#111827',
                        }}
                      >
                        Ageing Buckets
                      </h2>
                      <IconButton
                        size="small"
                        onClick={handleOpenAgeingMenu}
                        style={{
                          padding: 4,
                          color: '#64748b',
                        }}
                        title="Options"
                      >
                        <span
                          className="material-icons"
                          style={{ fontSize: '20px' }}
                        >
                          more_vert
                        </span>
                      </IconButton>
                    </div>
                  }
                />
              </ChartCard>
            )}

            {/* Salesperson totals - configurable chart type, or message if not available */}
            <div>
              {!salespersonField ? (
                <div
                  style={{
                    background: 'white',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px',
                    }}
                  >
                    <h2
                      style={{
                        margin: 0,
                        fontSize: '15px',
                        fontWeight: 600,
                        color: '#111827',
                      }}
                    >
                      Salesperson Totals
                    </h2>
                    <IconButton
                      size="small"
                      disabled
                      style={{
                        padding: 4,
                        color: '#cbd5f5',
                      }}
                      title="Options"
                    >
                      <span
                        className="material-icons"
                        style={{ fontSize: '20px' }}
                      >
                        more_vert
                      </span>
                    </IconButton>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      color: '#6b7280',
                      textAlign: 'center',
                    }}
                  >
                    Salesperson information is not available in the API
                    response.
                  </div>
                </div>
              ) : salespersonTotals.length === 0 ? (
                <div
                  style={{
                    background: 'white',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px',
                    }}
                  >
                    <h2
                      style={{
                        margin: 0,
                        fontSize: '15px',
                        fontWeight: 600,
                        color: '#111827',
                      }}
                    >
                      Salesperson Totals
                    </h2>
                    <IconButton
                      size="small"
                      disabled
                      style={{
                        padding: 4,
                        color: '#cbd5f5',
                      }}
                      title="Options"
                    >
                      <span
                        className="material-icons"
                        style={{ fontSize: '20px' }}
                      >
                        more_vert
                      </span>
                    </IconButton>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      color: '#6b7280',
                      textAlign: 'center',
                    }}
                  >
                    No receivables for any salesperson.
                  </div>
                </div>
              ) : (
                <>
                  {salespersonChartType === 'bar' && (
                    <ChartCard isMobile={isMobile}>
                      <BarChart
                        data={salespersonTotals.map((sp) => ({
                          label: sp.name,
                          value: Math.abs(sp.value || 0),
                        }))}
                        formatValue={(v) => formatCurrency(v)}
                        customHeader={
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <h2
                              style={{
                                margin: 0,
                                fontSize: '15px',
                                fontWeight: 600,
                                color: '#111827',
                              }}
                            >
                              Salesperson Totals
                            </h2>
                            <IconButton
                              size="small"
                              onClick={handleOpenSalespersonMenu}
                              style={{
                                padding: 4,
                                color: '#64748b',
                              }}
                              title="Options"
                            >
                              <span
                                className="material-icons"
                                style={{ fontSize: '20px' }}
                              >
                                more_vert
                              </span>
                            </IconButton>
                          </div>
                        }
                      />
                    </ChartCard>
                  )}
                  {salespersonChartType === 'pie' && (
                    <ChartCard isMobile={isMobile}>
                      <PieChart
                        data={salespersonTotals.map((sp) => ({
                          label: sp.name,
                          value: Math.abs(sp.value || 0),
                        }))}
                        formatValue={(v) => formatCurrency(v)}
                        customHeader={
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <h2
                              style={{
                                margin: 0,
                                fontSize: '15px',
                                fontWeight: 600,
                                color: '#111827',
                              }}
                            >
                              Salesperson Totals
                            </h2>
                            <IconButton
                              size="small"
                              onClick={handleOpenSalespersonMenu}
                              style={{
                                padding: 4,
                                color: '#64748b',
                              }}
                              title="Options"
                            >
                              <span
                                className="material-icons"
                                style={{ fontSize: '20px' }}
                              >
                                more_vert
                              </span>
                            </IconButton>
                          </div>
                        }
                      />
                    </ChartCard>
                  )}
                  {salespersonChartType === 'treemap' && (
                    <ChartCard isMobile={isMobile}>
                      <TreeMap
                        data={salespersonTotals.map((sp) => ({
                          label: sp.name,
                          value: Math.abs(sp.value || 0),
                        }))}
                        formatValue={(v) => formatCurrency(v)}
                        customHeader={
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <h2
                              style={{
                                margin: 0,
                                fontSize: '15px',
                                fontWeight: 600,
                                color: '#111827',
                              }}
                            >
                              Salesperson Totals
                            </h2>
                            <IconButton
                              size="small"
                              onClick={handleOpenSalespersonMenu}
                              style={{
                                padding: 4,
                                color: '#64748b',
                              }}
                              title="Options"
                            >
                              <span
                                className="material-icons"
                                style={{ fontSize: '20px' }}
                              >
                                more_vert
                              </span>
                            </IconButton>
                          </div>
                        }
                      />
                    </ChartCard>
                  )}
                  {salespersonChartType === 'line' && (
                    <ChartCard isMobile={isMobile}>
                      <LineChart
                        data={salespersonTotals.map((sp) => ({
                          label: sp.name,
                          value: Math.abs(sp.value || 0),
                        }))}
                        formatValue={(v) => formatCurrency(v)}
                        customHeader={
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <h2
                              style={{
                                margin: 0,
                                fontSize: '15px',
                                fontWeight: 600,
                                color: '#111827',
                              }}
                            >
                              Salesperson Totals
                            </h2>
                            <IconButton
                              size="small"
                              onClick={handleOpenSalespersonMenu}
                              style={{
                                padding: 4,
                                color: '#64748b',
                              }}
                              title="Options"
                            >
                              <span
                                className="material-icons"
                                style={{ fontSize: '20px' }}
                              >
                                more_vert
                              </span>
                            </IconButton>
                          </div>
                        }
                      />
                    </ChartCard>
                  )}
                </>
              )}
            </div>

            {/* Overdue in next 7 days */}
            <div
              style={{
                background: 'white',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
                padding: '16px 18px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#111827',
                  }}
                >
                  Overdue in Next 7 Days
                </h2>
                <IconButton
                  size="small"
                  onClick={handleOpenOverdueMenu}
                  style={{
                    padding: 4,
                    color: '#64748b',
                  }}
                  title="Options"
                >
                  <span
                    className="material-icons"
                    style={{ fontSize: '20px' }}
                  >
                    more_vert
                  </span>
                </IconButton>
                <div
                  style={{
            fontSize: '12px',
                    color: '#6b7280',
                  }}
                >
                  {upcomingOverdue.length} bills
                </div>
              </div>
              {upcomingOverdue.length === 0 ? (
                <div
                  style={{
                    padding: '16px 0',
                    fontSize: '13px',
                    color: '#6b7280',
                    textAlign: 'center',
                  }}
                >
                  No bills becoming overdue in the next 7 days.
                </div>
              ) : (
                <div
                  style={{
                    overflowX: 'auto',
                    marginTop: '8px',
                  }}
                >
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
            fontSize: '12px',
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          textAlign: 'left',
                          backgroundColor: '#f9fafb',
                          borderBottom: '1px solid #e5e7eb',
                        }}
                      >
                        <th style={{ padding: '8px 6px', minWidth: '160px' }}>
                          Customer
                        </th>
                        <th style={{ padding: '8px 6px', minWidth: '120px' }}>
                          Bill No
                        </th>
                        <th style={{ padding: '8px 6px', minWidth: '100px' }}>
                          Due On
                        </th>
                        <th style={{ padding: '8px 6px', minWidth: '80px' }}>
                          In (Days)
                        </th>
                        <th
                          style={{
                            padding: '8px 6px',
                            minWidth: '120px',
                            textAlign: 'right',
                          }}
                        >
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcomingOverdue.map((row, idx) => (
                        <tr
                          key={`${row.LEDGERNAME || row.REFNO || idx}-${idx}`}
                          style={{
                            borderBottom: '1px solid #f3f4f6',
                            backgroundColor:
                              idx % 2 === 0 ? 'white' : '#fafafa',
                          }}
                        >
                          <td style={{ padding: '8px 6px' }}>
                            {row.LEDGERNAME || '-'}
                          </td>
                          <td style={{ padding: '8px 6px' }}>
                            {row.REFNO || '-'}
                          </td>
                          <td style={{ padding: '8px 6px' }}>
                            {row.DUEON || row.DUEDATE || '-'}
                          </td>
                          <td style={{ padding: '8px 6px' }}>
                            {row.daysUntilDue}
                          </td>
                          <td
                            style={{
                              padding: '8px 6px',
                              textAlign: 'right',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatCurrency(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
        )}
      </div>
    </div>

          {/* Fullscreen overlay for cards */}
          {fullscreenCard && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                zIndex: 1500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onClick={() => setFullscreenCard(null)}
            >
              <div
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  maxWidth: '1200px',
                  width: '90vw',
                  maxHeight: '80vh',
                  padding: '20px 24px',
                  boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
                  overflow: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: '18px',
                      fontWeight: 600,
                      color: '#111827',
                    }}
                  >
                    {fullscreenCard === 'ageing' && 'Ageing Buckets'}
                    {fullscreenCard === 'salesperson' && 'Salesperson Totals'}
                    {fullscreenCard === 'overdue' && 'Overdue in Next 7 Days'}
                  </h2>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* Chart type selector for ageing and salesperson in fullscreen */}
                    {(fullscreenCard === 'ageing' || fullscreenCard === 'salesperson') && (
                      <IconButton
                        size="small"
                        onClick={handleOpenFullscreenMenu}
                        style={{
                          padding: 4,
                          color: '#64748b',
                        }}
                        title="Options"
                      >
                        <span
                          className="material-icons"
                          style={{ fontSize: '20px' }}
                        >
                          more_vert
                        </span>
                      </IconButton>
                    )}
                    <button
                      type="button"
                      onClick={() => setFullscreenCard(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span
                        className="material-icons"
                        style={{ fontSize: '22px', color: '#4b5563' }}
                      >
                        close
                      </span>
                    </button>
                  </div>
                </div>

                {fullscreenCard === 'ageing' && (
                  <div style={{ marginTop: '8px', height: '70vh' }}>
                    {ageingChartType === 'bar' && (
                      <BarChart
                        data={ageingChartData}
                        formatValue={(v) => formatCurrency(v)}
                      />
                    )}
                    {ageingChartType === 'pie' && (
                      <PieChart
                        data={ageingChartData}
                        formatValue={(v) => formatCurrency(v)}
                      />
                    )}
                    {ageingChartType === 'treemap' && (
                      <TreeMap
                        data={ageingChartData}
                        formatValue={(v) => formatCurrency(v)}
                      />
                    )}
                    {ageingChartType === 'line' && (
                      <LineChart
                        data={ageingChartData}
                        formatValue={(v) => formatCurrency(v)}
                      />
                    )}
                  </div>
                )}

                {fullscreenCard === 'salesperson' && (
                  <div style={{ marginTop: '8px', height: '70vh' }}>
                    {!salespersonField || salespersonTotals.length === 0 ? (
                      <div
                        style={{
                          padding: '24px 0',
                          fontSize: '14px',
                          color: '#6b7280',
                          textAlign: 'center',
                        }}
                      >
                        {!salespersonField
                          ? 'Salesperson information is not available in the API response.'
                          : 'No receivables for any salesperson.'}
                      </div>
                    ) : (
                      <>
                        {salespersonChartType === 'bar' && (
                          <BarChart
                            data={salespersonTotals.map((sp) => ({
                              label: sp.name,
                              value: Math.abs(sp.value || 0),
                            }))}
                            formatValue={(v) => formatCurrency(v)}
                          />
                        )}
                        {salespersonChartType === 'pie' && (
                          <PieChart
                            data={salespersonTotals.map((sp) => ({
                              label: sp.name,
                              value: Math.abs(sp.value || 0),
                            }))}
                            formatValue={(v) => formatCurrency(v)}
                          />
                        )}
                        {salespersonChartType === 'treemap' && (
                          <TreeMap
                            data={salespersonTotals.map((sp) => ({
                              label: sp.name,
                              value: Math.abs(sp.value || 0),
                            }))}
                            formatValue={(v) => formatCurrency(v)}
                          />
                        )}
                        {salespersonChartType === 'line' && (
                          <LineChart
                            data={salespersonTotals.map((sp) => ({
                              label: sp.name,
                              value: Math.abs(sp.value || 0),
                            }))}
                            formatValue={(v) => formatCurrency(v)}
                          />
                        )}
                      </>
                    )}
                  </div>
                )}

                {fullscreenCard === 'overdue' && (
                  <div style={{ marginTop: '8px' }}>
                    {upcomingOverdue.length === 0 ? (
                      <div
                        style={{
                          padding: '24px 0',
                          fontSize: '14px',
                          color: '#6b7280',
                          textAlign: 'center',
                        }}
                      >
                        No bills becoming overdue in the next 7 days.
                      </div>
                    ) : (
                      <div
                        style={{
                          overflowX: 'auto',
                          marginTop: '8px',
                        }}
                      >
                        <table
                          style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '13px',
                          }}
                        >
                          <thead>
                            <tr
                              style={{
                                textAlign: 'left',
                                backgroundColor: '#f9fafb',
                                borderBottom: '1px solid #e5e7eb',
                              }}
                            >
                              <th
                                style={{ padding: '8px 6px', minWidth: '200px' }}
                              >
                                Customer
                              </th>
                              <th
                                style={{ padding: '8px 6px', minWidth: '140px' }}
                              >
                                Bill No
                              </th>
                              <th
                                style={{ padding: '8px 6px', minWidth: '120px' }}
                              >
                                Due On
                              </th>
                              <th
                                style={{ padding: '8px 6px', minWidth: '100px' }}
                              >
                                In (Days)
                              </th>
                              <th
                                style={{
                                  padding: '8px 6px',
                                  minWidth: '140px',
                                  textAlign: 'right',
                                }}
                              >
                                Amount
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {upcomingOverdue.map((row, idx) => (
                              <tr
                                key={`${row.LEDGERNAME || row.REFNO || idx}-${idx}`}
                                style={{
                                  borderBottom: '1px solid #f3f4f6',
                                  backgroundColor:
                                    idx % 2 === 0 ? 'white' : '#fafafa',
                                }}
                              >
                                <td style={{ padding: '8px 6px' }}>
                                  {row.LEDGERNAME || '-'}
                                </td>
                                <td style={{ padding: '8px 6px' }}>
                                  {row.REFNO || '-'}
                                </td>
                                <td style={{ padding: '8px 6px' }}>
                                  {row.DUEON || row.DUEDATE || '-'}
                                </td>
                                <td style={{ padding: '8px 6px' }}>
                                  {row.daysUntilDue}
                                </td>
                                <td
                                  style={{
                                    padding: '8px 6px',
                                    textAlign: 'right',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {formatCurrency(row.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Options menus for each card (currently only Fullscreen) */}
          <Menu
            anchorEl={cardMenuAnchors.ageing}
            open={Boolean(cardMenuAnchors.ageing)}
            onClose={handleCloseAgeingMenu}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            slotProps={{
              root: {
                style: { zIndex: 1600 }
              }
            }}
          >
            <MenuItem
              onClick={(e) => {
                e.stopPropagation();
                handleCloseAgeingMenu();
                setFullscreenCard('ageing');
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span
                  className="material-icons"
                  style={{ fontSize: '18px', color: '#64748b' }}
                >
                  fullscreen
                </span>
                <span style={{ fontSize: '14px', color: '#374151' }}>
                  Fullscreen
                </span>
              </div>
            </MenuItem>
            <MenuItem
              onClick={(e) => {
                e.stopPropagation();
              }}
              style={{ cursor: 'default', padding: '8px 16px' }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#64748b',
                    marginBottom: '4px',
                  }}
                >
                  Chart Type
                </label>
                <select
                  value={ageingChartType}
                  onChange={(e) => {
                    setAgeingChartType(e.target.value);
                    handleCloseAgeingMenu();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '12px',
                    background: 'white',
                    color: '#374151',
                    width: '100%',
                    cursor: 'pointer',
                  }}
                >
                  <option value="bar">Bar</option>
                  <option value="pie">Pie</option>
                  <option value="treemap">Tree Map</option>
                  <option value="line">Line</option>
                </select>
              </div>
            </MenuItem>
          </Menu>

          <Menu
            anchorEl={cardMenuAnchors.salesperson}
            open={Boolean(cardMenuAnchors.salesperson)}
            onClose={handleCloseSalespersonMenu}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            slotProps={{
              root: {
                style: { zIndex: 1600 }
              }
            }}
          >
            <MenuItem
              onClick={(e) => {
                e.stopPropagation();
                handleCloseSalespersonMenu();
                setFullscreenCard('salesperson');
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span
                  className="material-icons"
                  style={{ fontSize: '18px', color: '#64748b' }}
                >
                  fullscreen
                </span>
                <span style={{ fontSize: '14px', color: '#374151' }}>
                  Fullscreen
                </span>
              </div>
            </MenuItem>
            <MenuItem
              onClick={(e) => {
                e.stopPropagation();
              }}
              style={{ cursor: 'default', padding: '8px 16px' }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  minWidth: '150px',
                }}
              >
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#64748b',
                    marginBottom: '4px',
                  }}
                >
                  Chart Type
                </label>
                <select
                  value={salespersonChartType}
                  onChange={(e) => {
                    setSalespersonChartType(e.target.value);
                    handleCloseSalespersonMenu();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '12px',
                    background: 'white',
                    color: '#374151',
                    width: '100%',
                    cursor: 'pointer',
                  }}
                >
                  <option value="bar">Bar</option>
                  <option value="pie">Pie</option>
                  <option value="treemap">Tree Map</option>
                  <option value="line">Line</option>
                </select>
              </div>
            </MenuItem>
          </Menu>

          <Menu
            anchorEl={cardMenuAnchors.overdue}
            open={Boolean(cardMenuAnchors.overdue)}
            onClose={handleCloseOverdueMenu}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            slotProps={{
              root: {
                style: { zIndex: 1600 }
              }
            }}
          >
            <MenuItem
              onClick={(e) => {
                e.stopPropagation();
                handleCloseOverdueMenu();
                setFullscreenCard('overdue');
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span
                  className="material-icons"
                  style={{ fontSize: '18px', color: '#64748b' }}
                >
                  fullscreen
                </span>
                <span style={{ fontSize: '14px', color: '#374151' }}>
                  Fullscreen
                </span>
              </div>
            </MenuItem>
          </Menu>
      </div>
    </div>
    </>
  );
};

export default ReceivablesDashboard;


// API Adapter to bridge TypeScript API service interface to existing JavaScript API structure
// This provides the same interface as the TypeScript apiService but uses existing apiUtils.js patterns

import { getApiUrl } from '../config';

// Helper to get token from sessionStorage (matching existing project pattern)
const getToken = () => {
  return sessionStorage.getItem('token');
};

// Helper to remove token (for logout)
const removeToken = () => {
  sessionStorage.removeItem('token');
};

// Format date for Tally (dd-mmm-yy format, e.g., "01-Apr-25")
const formatDateForTally = (dateStr) => {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  const year = String(date.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
};

// Efficient HTML entity decoder
const decodeHtmlEntities = (() => {
  const textarea = document.createElement('textarea');
  return (str) => {
    if (!str || !str.includes('&')) return str;
    textarea.innerHTML = str;
    return textarea.value;
  };
})();

// Escape XML special characters
const escapeXml = (str) => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

// API Service class matching TypeScript interface
class ApiService {
  async getReceiptVouchers(tallylocId, company, guid, fromDate, toDate) {
    try {
      const token = getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const svFromDate = formatDateForTally(fromDate);
      const svToDate = formatDateForTally(toDate);

      const xmlBody = `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>ODBC Report</ID>
  </HEADER>
  <BODY>
    <DESC>
      <TDL>
        <TDLMESSAGE>
          <REPORT NAME="ODBC Report" ISMODIFY="Yes" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
            <Add>Variable : SVFromDate, SVToDate</Add>
            <Set>SVFromdate : "${svFromDate}"</Set>
            <Set>SVTodate : "${svToDate}"</Set>
          </REPORT>
            <OBJECT NAME="Voucher" ISMODIFY="Yes" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
                <LOCALFORMULA>DLRcptParty : $AllLedgerEntries[1,@@DLRPLedgerCondition].LedgerName</LOCALFORMULA>
                <LOCALFORMULA>DLRcptBank : $AllLedgerEntries[1,@@DLRPBankCondition].LedgerName</LOCALFORMULA>
            </OBJECT>
          
          <COLLECTION NAME="DLITC_Vch Coll" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
            <TYPE>Vouchers:VoucherType</TYPE>
            <CHILDOF>$$VchTypeReceipt</CHILDOF>
            <BELONGSTO>Yes</BELONGSTO>
            <NATIVEMETHOD>*.*</NATIVEMETHOD>
            <METHOD>Amount : $AllLedgerEntries[1].Amount</METHOD>
          </COLLECTION>
        <SYSTEM TYPE="Formulae" NAME="DLRPLedgerCondition" ISMODIFY="No" ISFIXED="No" ISINTERNAL="No">NOT $$IsDr:$Amount   </SYSTEM>
        <SYSTEM TYPE="Formulae" NAME="DLRPBankCondition" ISMODIFY="No" ISFIXED="No" ISINTERNAL="No"> $$IsDr:$Amount   </SYSTEM>
        </TDLMESSAGE>
      </TDL>
      
      <SQLREQUEST TYPE="Prepare" METHOD="SQLPrepare">
        select 
          $MasterID as MasterID, 
          $Date as Dates, 
          $voucherNumber as InvNo, 
          $VoucherTypeName as VoucherType,
          $DLRcptParty as Customer, 
          $DLRcptBank as Bank, 
          $Amount as Amount ,
          $Narration as Narration
        from DLITC_VchColl
      </SQLREQUEST>
      
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;

      const response = await fetch(getApiUrl('/api/tally/tallydata'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/xml',
          'x-tallyloc-id': tallylocId.toString(),
          'x-company': company,
          'x-guid': guid,
        },
        body: xmlBody,
      });

      if (!response.ok) {
        if (response.status === 401) {
          removeToken();
          throw new Error('Session expired. Please login again.');
        }
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch receipts: ${response.statusText}. ${errorText}`,
        );
      }

      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

      // Parse XML response - Tally returns data in ROW/COL structure
      const vouchers = [];
      
      // Get column aliases from RESULTDESC
      const receiptColumnOrder = [];
      xmlDoc.querySelectorAll('RESULTDESC COL').forEach((colNode) => {
        const aliasNode = colNode.querySelector('ALIAS');
        if (aliasNode) {
          receiptColumnOrder.push((aliasNode.textContent || '').trim());
        }
      });

      // Parse ROW data
      const rowNodes = xmlDoc.querySelectorAll('RESULTDATA ROW');
      rowNodes.forEach((rowNode) => {
        const colNodes = rowNode.querySelectorAll('COL');
        const voucher = {};
        
        colNodes.forEach((colNode, index) => {
          const alias = receiptColumnOrder[index];
          let value = colNode.textContent?.trim() || '';
          
          // Decode HTML entities efficiently (only if needed)
          value = decodeHtmlEntities(value);
          
          // Map aliases to voucher properties
          if (alias === 'MasterId') voucher.MasterID = value;
          if (alias === 'Dates') {
            // Convert YYYYMMDD format to readable date
            if (value && value.length === 8 && /^\d+$/.test(value)) {
              const year = value.substring(0, 4);
              const month = value.substring(4, 6);
              const day = value.substring(6, 8);
              voucher.Dates = `${year}-${month}-${day}`;
            } else {
              voucher.Dates = value;
            }
          }
          if (alias === 'InvNo') voucher.InvNo = value;
          if (alias === 'Voucher Type') voucher.VoucherType = value;
          if (alias === 'Customer') voucher.Customer = value;
          if (alias === 'Bank') voucher.Bank = value;
          if (alias === 'Amount') voucher.Amount = value;
          if (alias === 'Narration') voucher.Narration = value;
        });
        
        if (Object.keys(voucher).length > 0) {
          vouchers.push(voucher);
        }
      });

      return vouchers;
    } catch (error) {
      console.error('Get receipt vouchers error:', error);
      throw error;
    }
  }

  async getReceiptsForLedger(tallylocId, company, guid, ledgerName, fromDate, toDate) {
    try {
      const token = getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const svFromDate = formatDateForTally(fromDate);
      const svToDate = formatDateForTally(toDate);
      const escapedLedgerName = escapeXml(ledgerName);

      const xmlBody = `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>ODBC Report</ID>
  </HEADER>
  <BODY>
    <DESC>
        <TDL>  <TDLMESSAGE>
            <REPORT NAME="ODBC Report" ISMODIFY="Yes" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
            <Add>Variable : SVFromDate, SVToDate</Add>
            <Set>SVFromdate : "${svFromDate}"</Set>
            <Set>SVTodate : "${svToDate}"</Set>
          </REPORT>
        <OBJECT NAME="Voucher" ISMODIFY="Yes" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
            <LOCALFORMULA>DLRcptParty : $AllLedgerEntries[1,@@DLRPLedgerCondition].LedgerName</LOCALFORMULA>
        </OBJECT>
        <COLLECTION NAME="DL VchColl" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
            <TYPE>Vouchers : Ledger</TYPE>
            <CHILDOF>"${escapedLedgerName}"</CHILDOF>
            <FILTERS>DLVchRcptFilt</FILTERS>
            <NATIVEMETHOD>Date, VoucherTypeName, VoucherNumber, Narration, MasterID, LedgerEntries.*</NATIVEMETHOD>
        </COLLECTION>
        <SYSTEM TYPE="Formulae" NAME="DLRPLedgerCondition" ISMODIFY="No" ISFIXED="No" ISINTERNAL="No">NOT $$IsDr:$Amount   </SYSTEM>
        <SYSTEM TYPE="Formulae" NAME="DLVchRcptFilt" ISMODIFY="No" ISFIXED="No" ISINTERNAL="No">NOT $$IsDr:$Amount   </SYSTEM>
        </TDLMESSAGE>
        </TDL>
      <SQLREQUEST TYPE="Prepare" METHOD="SQLPrepare">
        select 
          $MasterID as MasterID, 
          $Date as Dates, 
          $voucherNumber as InvNo, 
          $VoucherTypeName as VoucherType,
          $DLRcptParty as Customer, 
          $DLRcptBank as Bank, 
          $Amount as Amount ,
          $Narration as Narration
        from DLVchColl
      </SQLREQUEST>
      
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;

      const response = await fetch(getApiUrl('/api/tally/tallydata'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/xml',
          'x-tallyloc-id': tallylocId.toString(),
          'x-company': company,
          'x-guid': guid,
        },
        body: xmlBody,
      });

      if (!response.ok) {
        if (response.status === 401) {
          removeToken();
          throw new Error('Session expired. Please login again.');
        }
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch ledger receipts: ${response.statusText}. ${errorText}`,
        );
      }

      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

      // Parse XML response
      const vouchers = [];
      
      // Get column aliases from RESULTDESC
      const colNodes = xmlDoc.querySelectorAll('RESULTDESC COL');
      const columnOrder = [];
      colNodes.forEach((colNode) => {
        const aliasNode = colNode.querySelector('ALIAS');
        if (aliasNode) {
          columnOrder.push(aliasNode.textContent?.trim() || '');
        }
      });

      // Parse ROW data
      const rowNodes = xmlDoc.querySelectorAll('RESULTDATA ROW');
      rowNodes.forEach((rowNode) => {
        const colNodes = rowNode.querySelectorAll('COL');
        const voucher = {};
        
        colNodes.forEach((colNode, index) => {
          const alias = columnOrder[index];
          let value = colNode.textContent?.trim() || '';
          
          // Decode HTML entities efficiently (only if needed)
          value = decodeHtmlEntities(value);
          
          // Map aliases to voucher properties
          if (alias === 'MasterId') voucher.MasterID = value;
          if (alias === 'Dates') {
            // Convert YYYYMMDD format to readable date
            if (value && value.length === 8 && /^\d+$/.test(value)) {
              const year = value.substring(0, 4);
              const month = value.substring(4, 6);
              const day = value.substring(6, 8);
              voucher.Dates = `${year}-${month}-${day}`;
            } else {
              voucher.Dates = value;
            }
          }
          if (alias === 'InvNo') voucher.InvNo = value;
          if (alias === 'Voucher Type') voucher.VoucherType = value;
          if (alias === 'Customer') voucher.Customer = value;
          if (alias === 'Bank') voucher.Bank = value;
          if (alias === 'Amount') voucher.Amount = value;
          if (alias === 'Narration') voucher.Narration = value;
        });
        
        if (Object.keys(voucher).length > 0) {
          vouchers.push(voucher);
        }
      });

      return vouchers;
    } catch (error) {
      console.error('Get ledger receipts error:', error);
      throw error;
    }
  }

  async getCompanyOrders(tallylocId, company, guid, includeCleared = false) {
    try {
      const token = getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const currentDate = formatDateForTally();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIndexMap = monthNames.reduce((acc, name, idx) => {
        acc[name.toLowerCase()] = idx;
        return acc;
      }, {});

      const normalizeDateValue = (value) => {
        if (!value) return value;
        const trimmed = value.trim();
        if (/^\d{8}$/.test(trimmed)) {
          const year = trimmed.substring(0, 4);
          const month = trimmed.substring(4, 6);
          const day = trimmed.substring(6, 8);
          return `${year}-${month}-${day}`;
        }
        const match = trimmed.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
        if (match) {
          const day = match[1].padStart(2, '0');
          const monthIdx = monthIndexMap[match[2].toLowerCase()];
          const yearNum = parseInt(match[3], 10);
          const year = (yearNum < 100 ? 2000 + yearNum : yearNum).toString();
          const month = String(monthIdx + 1).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        const parsed = new Date(trimmed);
        if (!Number.isNaN(parsed.getTime())) {
          const year = parsed.getFullYear();
          const month = String(parsed.getMonth() + 1).padStart(2, '0');
          const day = String(parsed.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        return trimmed;
      };

      const xmlBody = `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>ODBC Report</ID>
  </HEADER>
  <BODY>
    <DESC>
        <TDL>  <TDLMESSAGE>
        <COLLECTION NAME="DL OrdAll" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
            <COLLECTIONS>DL OrdPending, DL OrdCleared</COLLECTIONS>
        </COLLECTION>
        <COLLECTION NAME="DL OrdPending" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
            <TYPE>Sales Orders</TYPE>
            <NATIVEMETHOD>*.*</NATIVEMETHOD>
			<METHOD>DLOrdItemClosing : $ClosingBalance:StockItem:$Parent</METHOD>
        </COLLECTION>
        <COLLECTION NAME="DL OrdCleared" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
            <TYPE>Sales Orders</TYPE>
            <CLEARED>Yes</CLEARED>
            <NATIVEMETHOD>*.*</NATIVEMETHOD>
			<METHOD>DLOrdItemClosing : $ClosingBalance:StockItem:$Parent</METHOD>
        </COLLECTION>
        </TDLMESSAGE>
        </TDL>
      <SQLREQUEST TYPE="Prepare" METHOD="SQLPrepare">
        select 
          $Date as Date, 
          $$Name as OrdNo, 
          $Parent as StockItem,
          $$IsMultiGodownOn as "IsGodownOn", 
          $IsBatchWiseOn:StockItem:$Parent as "IsBatchesOn",
		  if $$IsSysName:$GodownName then "" else $GodownName as 'Location',
		  if $$IsSysName:$BatchName then "" else $BatchName as 'Batch',
          $TrackLedger as Customer, 
          $OpeningBalance as 'Order Qty', 
          $ClosingBalance as 'Pending Qty',
          $$DueDateByDate:$OrderDueDate as 'Due Date',
          $$Number:$Rate as 'Rate',
          $Discount as 'Discount',
		  $SOTotal:StockItem:$Parent as "Total Pending Orders",
		  $DLOrdItemClosing as 'Available'
        from ${includeCleared ? 'DLOrdAll' : 'DLOrdPending'}
      </SQLREQUEST>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVFROMDATE>${currentDate}</SVFROMDATE>
        <SVTODATE>${currentDate}</SVTODATE>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;

      const response = await fetch(getApiUrl('/api/tally/tallydata'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/xml',
          'x-tallyloc-id': tallylocId.toString(),
          'x-company': company,
          'x-guid': guid,
        },
        body: xmlBody,
      });

      if (!response.ok) {
        if (response.status === 401) {
          removeToken();
          throw new Error('Session expired. Please login again.');
        }
        const errorText = await response.text();
        throw new Error(`Failed to fetch company orders: ${response.statusText}. ${errorText}`);
      }

      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

      const decodeHtmlEntities = (() => {
        const textarea = document.createElement('textarea');
        return (str) => {
          if (!str || !str.includes('&')) return str;
          textarea.innerHTML = str;
          return textarea.value;
        };
      })();

      const normalizeAlias = (alias) => {
        const decoded = decodeHtmlEntities(alias || '');
        return decoded.replace(/^['"]+|['"]+$/g, '').trim();
      };

      // eslint-disable-next-line no-control-regex
      const sanitizeValue = (value) =>
        decodeHtmlEntities(value).replace(/[\u0000-\u001F\u007F]/g, '').trim();

      const colNodes = xmlDoc.querySelectorAll('RESULTDESC COL');
      const columnOrder = [];
      colNodes.forEach((colNode) => {
        const aliasNode = colNode.querySelector('ALIAS');
        if (aliasNode) {
          columnOrder.push(normalizeAlias(aliasNode.textContent || ''));
        }
      });

      const rowNodes = xmlDoc.querySelectorAll('RESULTDATA ROW');
      const orders = [];
      rowNodes.forEach((rowNode, rowIndex) => {
        const colNodes = rowNode.querySelectorAll('COL');
        const order = {};

        colNodes.forEach((colNode, index) => {
          const aliasKey = columnOrder[index] || '';
          const normalizedAlias = aliasKey.replace(/\s+/g, '').toLowerCase();
          const value = sanitizeValue(colNode.textContent || '');

          switch (normalizedAlias) {
            case 'date':
              order.Date = normalizeDateValue(value);
              break;
            case 'ordno':
              order.OrderNo = value;
              break;
            case 'stockitem':
              order.StockItem = value;
              break;
            case 'customer':
              order.Customer = value;
              break;
            case 'orderqty':
              order.OrderQty = value;
              break;
            case 'pendingqty':
              order.PendingQty = value;
              break;
            case 'location':
              order.Location = value;
              break;
            case 'batch':
              order.Batch = value;
              break;
            case 'duedate':
              order.DueDate = normalizeDateValue(value);
              break;
            case 'totalpendingorders':
              order.TotalPendingOrders = value;
              break;
            case 'available':
              order.AvailableQty = value;
              break;
            case 'rate':
              order.Rate = value;
              break;
            case 'discount':
              order.Discount = value;
              break;
            case 'isgodownon':
              order.IsGodownOn = value;
              break;
            case 'isbatcheson':
              order.IsBatchesOn = value;
              break;
            default:
              break;
          }
        });

        if (Object.keys(order).length > 0) {
          orders.push(order);
        }
      });

      return orders;
    } catch (error) {
      console.error('Get company orders error:', error);
      throw error;
    }
  }

  async getItemBatchBalances(tallylocId, company, guid, stockItemName) {
    try {
      const token = getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const body = JSON.stringify({
        tallyloc_id: tallylocId,
        company,
        guid,
        stockitemname: stockItemName,
      });

      const response = await fetch(getApiUrl('/api/tally/itemwise-batchwise-bal'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body,
      });

      if (!response.ok) {
        if (response.status === 401) {
          removeToken();
          throw new Error('Session expired. Please login again.');
        }
        const errorText = await response.text();
        throw new Error(`Failed to fetch batch balances: ${response.statusText}. ${errorText}`);
      }

      const json = await response.json();
      return json?.batchData ?? [];
    } catch (error) {
      console.error('getItemBatchBalances error:', error);
      throw error;
    }
  }

  async getReceivablesData(tallylocId, company, guid, xmlBody) {
    try {
      const token = getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const companyName = company;

      const response = await fetch(getApiUrl('/api/tally/tallydata'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/xml',
          'x-tallyloc-id': tallylocId.toString(),
          'x-company': companyName,
          'x-guid': guid,
        },
        body: xmlBody,
      });

      if (!response.ok) {
        if (response.status === 401) {
          removeToken();
          throw new Error('Session expired. Please login again.');
        }
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      return await response.text();
    } catch (error) {
      console.error('Get receivables data error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const apiService = new ApiService();


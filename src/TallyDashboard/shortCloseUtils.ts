import { apiService } from '../utils/receiptApiAdapter';
import { escapeForXML } from '../utils/receivablesHelpers';
import type { Company, CompanyOrder } from '../utils/receiptApiTypes';

interface ShortCloseForm {
  preCloseQty: string;
  reason: string;
  closedOn: string;
}

interface Voucher {
  VchType: string;
  MasterId: string;
  VchNo: string;
}

interface ShortCloseSubmitParams {
  selectedOrder: CompanyOrder;
  vouchers: Voucher[];
  form: ShortCloseForm;
  company: Company;
  onSuccess: () => Promise<void>;
  onSuccessMessage: (message: string) => void;
  onError: (error: string) => void;
  setSubmitting: (submitting: boolean) => void;
}

export const submitShortClose = async (params: ShortCloseSubmitParams): Promise<void> => {
  const {
    selectedOrder,
    vouchers,
    form,
    company,
    onSuccess,
    onSuccessMessage,
    onError,
    setSubmitting,
  } = params;

  console.log('🚀 submitShortClose called');
  console.log('selectedOrder:', selectedOrder);
  console.log('vouchers:', vouchers);

  if (!selectedOrder) {
    console.error('❌ No selectedOrder');
    return;
  }

  try {
    console.log('✅ Starting short close submit process...');

    // Find the sales order voucher
    const salesOrderVoucher = vouchers.find((v) => v.VchType === 'Sales Order' || v.VchType === 'CP_SalesOrder');
    console.log('📋 Found sales order voucher:', salesOrderVoucher);

    if (!salesOrderVoucher || !salesOrderVoucher.MasterId) {
      console.error('❌ Sales Order voucher not found');
      alert('Sales Order voucher not found. Please ensure vouchers are loaded.');
      return;
    }

    const tallylocId = sessionStorage.getItem('tallyloc_id');
    const companyName = sessionStorage.getItem('company') || company.company || company.conn_name;
    const guid = sessionStorage.getItem('guid') || company.guid;

    if (!tallylocId || !companyName || !guid) {
      throw new Error('Missing required session data');
    }

    // Fetch the full sales order voucher XML with FETCHLIST
    const fetchXmlRequest = `<ENVELOPE>
    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>EXPORT</TALLYREQUEST>
        <TYPE>Object</TYPE>
        <SUBTYPE>VOUCHER</SUBTYPE>
        <ID TYPE="Name">ID:${salesOrderVoucher.MasterId}</ID>
    </HEADER>
    <BODY>
        <DESC>
            <STATICVARIABLES>
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                <SVCURRENTCOMPANY>${escapeForXML(companyName)}</SVCURRENTCOMPANY>
            </STATICVARIABLES>
            <FETCHLIST>
                <FETCH>Date</FETCH>
                <FETCH>VoucherTypeName</FETCH>
                <FETCH>VoucherNumber</FETCH>
                <FETCH>AllInventoryEntries</FETCH>
            </FETCHLIST>
        </DESC>
    </BODY>
</ENVELOPE>`;

    setSubmitting(true);
    const xmlText = await apiService.getReceivablesData(
      parseInt(tallylocId),
      companyName,
      guid,
      fetchXmlRequest
    );

    // Clean XML: Remove invalid character references
    let cleanXmlText = xmlText.replace(/&#([0-9]+);/g, (match, num) => {
      const code = parseInt(num, 10);
      if (code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 55295) || (code >= 57344 && code <= 65533)) {
        return match;
      }
      console.warn(`Removing invalid XML character reference: ${match}`);
      return '';
    });

    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(cleanXmlText, 'text/xml');

    // Check for parsing errors
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      console.error('XML Parse Error:', parserError.textContent);
      console.error('Original XML (first 1000 chars):', xmlText.substring(0, 1000));
      throw new Error('Failed to parse XML response: ' + parserError.textContent);
    }

    // Find the voucher element
    const dataElement = xmlDoc.querySelector('DATA');
    const tallyMessageElement = dataElement ? dataElement.querySelector('TALLYMESSAGE') : xmlDoc.querySelector('TALLYMESSAGE');
    let voucherElement: Element | null = tallyMessageElement ? tallyMessageElement.querySelector('VOUCHER') : null;

    if (!voucherElement) {
      const allVouchers = xmlDoc.querySelectorAll('VOUCHER');
      let foundVoucher: Element | null = null;
      for (let i = 0; i < allVouchers.length; i++) {
        const v = allVouchers[i];
        if (v.getAttribute('ID')) {
          foundVoucher = v;
          break;
        }
      }
      if (!foundVoucher) {
        throw new Error('VOUCHER element not found in XML response');
      }
      console.warn('⚠️ Using fallback voucher element (found by ID attribute)');
      voucherElement = foundVoucher;
    }

    const voucherId = voucherElement.getAttribute('ID') || '';
    const voucherReqName = voucherElement.getAttribute('REQNAME') || '';
    console.log('📋 Voucher element found - ID:', voucherId, 'REQNAME:', voucherReqName);

    // Extract voucher date and number
    const voucherDateElement = voucherElement.querySelector('DATE');
    const voucherNumberElement = voucherElement.querySelector('VOUCHERNUMBER');

    let voucherDate = '';
    if (voucherDateElement && voucherDateElement.textContent) {
      const dateStr = voucherDateElement.textContent.trim();
      if (/^\d{8}$/.test(dateStr)) {
        voucherDate = dateStr;
      } else {
        try {
          let date: Date;
          if (dateStr.includes('-')) {
            date = new Date(dateStr);
          } else if (dateStr.length === 8) {
            const year = parseInt(dateStr.substring(0, 4));
            const month = parseInt(dateStr.substring(4, 6)) - 1;
            const day = parseInt(dateStr.substring(6, 8));
            date = new Date(year, month, day);
          } else {
            date = new Date(dateStr);
          }

          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            voucherDate = `${year}${month}${day}`;
          } else {
            voucherDate = dateStr;
          }
        } catch (e) {
          voucherDate = dateStr;
        }
      }
    }

    const voucherNumber = voucherNumberElement?.textContent || salesOrderVoucher.VchNo || '';

    // Use XPath to find inventory entries
    const stockItemName = (selectedOrder.StockItem || '').trim();
    console.log('🔍 Submitting short close - Searching for stock item:', stockItemName);

    const evaluateXPath = (xpath: string, resultType: number = XPathResult.ORDERED_NODE_ITERATOR_TYPE): any => {
      try {
        return xmlDoc.evaluate(xpath, xmlDoc, null, resultType, null);
      } catch (err) {
        console.error(`❌ XPath evaluation failed for ${xpath}:`, err);
        return null;
      }
    };

    const invListXPath = '/ENVELOPE/BODY/DATA/TALLYMESSAGE/VOUCHER/ALLINVENTORYENTRIES.LIST';
    const invListResult = evaluateXPath(invListXPath, XPathResult.ORDERED_NODE_ITERATOR_TYPE);

    let targetInventoryEntry: Element | null = null;
    const availableItems: string[] = [];
    let index = 0;

    if (invListResult) {
      let invEntry = invListResult.iterateNext();
      while (invEntry) {
        index++;
        const stockItemXPath = `/ENVELOPE/BODY/DATA/TALLYMESSAGE/VOUCHER/ALLINVENTORYENTRIES.LIST[${index}]/STOCKITEMNAME`;
        const stockItemResult = evaluateXPath(stockItemXPath, XPathResult.FIRST_ORDERED_NODE_TYPE);
        const foundStockItemName = stockItemResult?.singleNodeValue?.textContent?.trim() || '';

        console.log(`🔍 Entry ${index}: Found stock item "${foundStockItemName}"`);
        availableItems.push(`"${foundStockItemName}"`);

        if (foundStockItemName === stockItemName) {
          targetInventoryEntry = invEntry as Element;
          console.log(`✅ Found matching stock item "${stockItemName}" at entry ${index}`);
          break;
        }

        invEntry = invListResult.iterateNext();
      }
    }

    // Fallback to querySelector
    if (!targetInventoryEntry) {
      console.log('⚠️ XPath method failed, trying querySelector fallback...');
      const inventoryEntries = voucherElement.querySelectorAll('ALLINVENTORYENTRIES.LIST');
      console.log('🔍 Total inventory entries found (querySelector):', inventoryEntries.length);

      for (let i = 0; i < inventoryEntries.length; i++) {
        const entry = inventoryEntries[i];
        const stockItemNameElement = entry.querySelector('STOCKITEMNAME');
        const foundStockItemName = stockItemNameElement?.textContent?.trim() || '';
        console.log(`🔍 Entry ${i + 1} (querySelector): Found stock item "${foundStockItemName}"`);

        if (!availableItems.includes(`"${foundStockItemName}"`)) {
          availableItems.push(`"${foundStockItemName}"`);
        }

        if (stockItemNameElement && foundStockItemName === stockItemName) {
          targetInventoryEntry = entry;
          console.log(`✅ Found matching stock item "${stockItemName}" at entry ${i + 1} (querySelector)`);
          break;
        }
      }
    }

    if (!targetInventoryEntry) {
      console.error('❌ Available stock items in voucher:', availableItems);
      throw new Error(`Stock item "${stockItemName}" not found in the sales order voucher. Available items: ${availableItems.length > 0 ? availableItems.join(', ') : 'none found'}`);
    }

    // Find the index of the target inventory entry in the original voucher
    // Use getElementsByTagName because querySelector treats dots as CSS class selectors
    const allInventoryEntries = Array.from(voucherElement.getElementsByTagName('ALLINVENTORYENTRIES.LIST'));
    let targetEntryIndex = -1;
    for (let i = 0; i < allInventoryEntries.length; i++) {
      if (allInventoryEntries[i] === targetInventoryEntry) {
        targetEntryIndex = i;
        break;
      }
    }
    
    if (targetEntryIndex === -1) {
      // Fallback: find by stock item name
      for (let i = 0; i < allInventoryEntries.length; i++) {
        const entry = allInventoryEntries[i];
        const stockItemNameElement = entry.querySelector('STOCKITEMNAME');
        const foundStockItemName = stockItemNameElement?.textContent?.trim() || '';
        if (foundStockItemName === stockItemName) {
          targetEntryIndex = i;
          break;
        }
      }
    }

    console.log(`📋 Found target inventory entry at index ${targetEntryIndex} in original voucher`);

    // Clone the voucher element to preserve original DOM structure
    // This ensures we don't lose any content during modification
    const voucherElementClone = voucherElement.cloneNode(true) as Element;
    
    // Find the corresponding inventory entry in the cloned voucher using the same index
    // Use getElementsByTagName because querySelector treats dots as CSS class selectors
    const clonedInventoryEntries = Array.from(voucherElementClone.getElementsByTagName('ALLINVENTORYENTRIES.LIST'));
    let clonedTargetInventoryEntry: Element | null = null;
    
    console.log(`📋 Cloned voucher has ${clonedInventoryEntries.length} inventory entries`);
    
    if (targetEntryIndex >= 0 && targetEntryIndex < clonedInventoryEntries.length) {
      clonedTargetInventoryEntry = clonedInventoryEntries[targetEntryIndex] as Element;
      console.log(`✅ Found cloned inventory entry at index ${targetEntryIndex}`);
    } else {
      // Fallback: search by stock item name in cloned voucher
      console.warn('⚠️ Index-based lookup failed, using name-based search in clone');
      for (let i = 0; i < clonedInventoryEntries.length; i++) {
        const entry = clonedInventoryEntries[i];
        const stockItemNameElement = entry.querySelector('STOCKITEMNAME');
        const foundStockItemName = stockItemNameElement?.textContent?.trim() || '';
        console.log(`🔍 Checking cloned entry ${i}: "${foundStockItemName}"`);
        if (foundStockItemName === stockItemName) {
          clonedTargetInventoryEntry = entry;
          console.log(`✅ Found cloned inventory entry at index ${i} by name match`);
          break;
        }
      }
    }
    
    if (!clonedTargetInventoryEntry) {
      console.error(`❌ Could not find cloned inventory entry. Searched ${clonedInventoryEntries.length} entries. Target index: ${targetEntryIndex}`);
      console.error(`❌ Available stock items in cloned voucher:`, clonedInventoryEntries.map((entry, idx) => {
        const stockItemNameElement = entry.querySelector('STOCKITEMNAME');
        return `Entry ${idx}: "${stockItemNameElement?.textContent?.trim() || 'NO NAME'}"`;
      }));
      throw new Error(`Could not find cloned inventory entry for stock item "${stockItemName}"`);
    }

    // Find BATCHALLOCATIONS.LIST in the cloned element
    let batchAllocationsList: Element | null = clonedTargetInventoryEntry.querySelector('BATCHALLOCATIONS.LIST');

    if (!batchAllocationsList) {
      const batchElements = clonedTargetInventoryEntry.getElementsByTagName('BATCHALLOCATIONS.LIST');
      if (batchElements.length > 0) {
        batchAllocationsList = batchElements[0] as Element;
        console.log('✅ Found BATCHALLOCATIONS.LIST using getElementsByTagName');
      }
    }

    if (!batchAllocationsList) {
      const allBatchLists = clonedTargetInventoryEntry.querySelectorAll('BATCHALLOCATIONS.LIST');
      if (allBatchLists.length > 0) {
        batchAllocationsList = allBatchLists[0] as Element;
        console.log('✅ Found BATCHALLOCATIONS.LIST using querySelectorAll (descendants)');
      }
    }

    if (!batchAllocationsList) {
      console.log('⚠️ BATCHALLOCATIONS.LIST not found - creating it...');
      batchAllocationsList = xmlDoc.createElement('BATCHALLOCATIONS.LIST');
      const ratedetailsList = clonedTargetInventoryEntry.querySelector('RATEDETAILS.LIST');
      if (ratedetailsList && ratedetailsList.parentElement === clonedTargetInventoryEntry) {
        clonedTargetInventoryEntry.insertBefore(batchAllocationsList, ratedetailsList);
        console.log('✅ Created BATCHALLOCATIONS.LIST before RATEDETAILS.LIST');
      } else {
        clonedTargetInventoryEntry.appendChild(batchAllocationsList);
        console.log('✅ Created BATCHALLOCATIONS.LIST at the end');
      }
    }

    // Format date for Tally ORDERPRECLOSUREDATE in D-Mm-YY format (e.g., "1-Apr-25")
    const formatDateForPreCloseDate = (dateStr: string): string => {
      const date = new Date(dateStr);
      const day = date.getDate(); // Day without leading zero (1-31)
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getMonth()]; // Month abbreviation
      const year = String(date.getFullYear()).slice(-2); // 2-digit year
      return `${day}-${month}-${year}`;
    };

    // Format date for Tally (general purpose, YYYYMMDD format)
    const formatDateForTally = (dateStr: string): string => {
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}${month}${day}`;
    };

    // Remove existing tags
    const existingPrecloseDate = batchAllocationsList.querySelector('ORDERPRECLOSUREDATE');
    const existingPrecloseQty = batchAllocationsList.querySelector('ORDERPRECLOSUREQTY');
    const existingPrecloseReason = batchAllocationsList.querySelector('ORDERCLOSUREREASON');

    // Get existing pre-close qty value before removing
    let existingPreCloseQtyValue = '0';
    if (existingPrecloseQty && existingPrecloseQty.textContent) {
      const existingValue = existingPrecloseQty.textContent.trim();
      // Extract numeric value from existing qty (e.g., "10 Nos" -> "10")
      const numericMatch = existingValue.match(/(-?\d+(?:\.\d+)?)/);
      if (numericMatch) {
        existingPreCloseQtyValue = numericMatch[1];
        console.log(`📋 Found existing ORDERPRECLOSUREQTY: "${existingValue}" (numeric: ${existingPreCloseQtyValue})`);
      }
    }

    if (existingPrecloseDate) {
      batchAllocationsList.removeChild(existingPrecloseDate);
    }
    if (existingPrecloseQty) {
      batchAllocationsList.removeChild(existingPrecloseQty);
    }
    if (existingPrecloseReason) {
      batchAllocationsList.removeChild(existingPrecloseReason);
    }

    // Create new elements
    const precloseDateElement = xmlDoc.createElement('ORDERPRECLOSUREDATE');
    precloseDateElement.textContent = formatDateForPreCloseDate(form.closedOn);

    const precloseQtyElement = xmlDoc.createElement('ORDERPRECLOSUREQTY');
    const userEnteredQty = (form.preCloseQty || '').trim();
    
    // Extract numeric value from user-entered qty
    let userEnteredNumeric = '0';
    if (userEnteredQty) {
      const numericMatch = userEnteredQty.match(/(-?\d+(?:\.\d+)?)/);
      if (numericMatch) {
        userEnteredNumeric = numericMatch[1];
      }
    }
    
    // Add existing pre-close qty to user-entered qty
    const existingNumeric = parseFloat(existingPreCloseQtyValue) || 0;
    const userNumeric = parseFloat(userEnteredNumeric) || 0;
    const totalPreCloseQty = existingNumeric + userNumeric;
    
    // Extract unit from user-entered qty if present, otherwise use empty string
    const unitMatch = userEnteredQty.match(/\s*([A-Za-z]+)$/);
    const unit = unitMatch ? unitMatch[1] : '';
    const preCloseQtyValue = `${totalPreCloseQty}${unit ? ' ' + unit : ''}`;
    
    console.log(`📋 Calculating ORDERPRECLOSUREQTY:`);
    console.log(`  - Existing value: ${existingPreCloseQtyValue} (numeric: ${existingNumeric})`);
    console.log(`  - User entered: ${userEnteredQty} (numeric: ${userNumeric})`);
    console.log(`  - Total: ${preCloseQtyValue} (numeric: ${totalPreCloseQty})`);
    
    if (!preCloseQtyValue || totalPreCloseQty === 0) {
      console.warn('⚠️ ORDERPRECLOSUREQTY is empty or zero!');
    }
    precloseQtyElement.textContent = preCloseQtyValue;

    const precloseReasonElement = xmlDoc.createElement('ORDERCLOSUREREASON');
    precloseReasonElement.textContent = (form.reason || '').trim();

    // Insert tags in correct order
    const indentNoElement = batchAllocationsList.querySelector('INDENTNO');
    const trackingNumberElement = batchAllocationsList.querySelector('TRACKINGNUMBER');
    const orderNoElement = batchAllocationsList.querySelector('ORDERNO');
    const billedQtyElement = batchAllocationsList.querySelector('BILLEDQTY');
    const orderDueDateElement = batchAllocationsList.querySelector('ORDERDUEDATE');

    // Update INDENTNO if it contains "Not Applicable" (without the &#4; prefix)
    if (indentNoElement) {
      const indentText = indentNoElement.textContent || '';
      if (indentText.trim() === 'Not Applicable' || (indentText.includes('Not Applicable') && !indentText.includes('&#4;'))) {
        indentNoElement.textContent = '&#4; Not Applicable';
        console.log('✅ Updated INDENTNO to include &#4; prefix');
      }
    }

    // Update TRACKINGNUMBER if it contains "Not Applicable" (without the &#4; prefix)
    if (trackingNumberElement) {
      const trackingText = trackingNumberElement.textContent || '';
      if (trackingText.trim() === 'Not Applicable' || (trackingText.includes('Not Applicable') && !trackingText.includes('&#4;'))) {
        trackingNumberElement.textContent = '&#4; Not Applicable';
        console.log('✅ Updated TRACKINGNUMBER to include &#4; prefix');
      }
    }

    // Update BATCHNAME if it contains "Any" (without the &#4; prefix)
    const batchNameElement = batchAllocationsList.querySelector('BATCHNAME');
    if (batchNameElement) {
      const batchNameText = batchNameElement.textContent || '';
      const trimmedBatchName = batchNameText.trim();
      // Check if the value is "Any" (case-insensitive) and doesn't already have the &#4; prefix
      if (trimmedBatchName.toLowerCase() === 'any' && !batchNameText.includes('&#4;')) {
        batchNameElement.textContent = '&#4; Any';
        console.log('✅ Updated BATCHNAME to include &#4; prefix for "Any"');
      }
    }

    // Update GODOWNNAME if it contains "Any" (without the &#4; prefix)
    const godownNameElement = batchAllocationsList.querySelector('GODOWNNAME');
    if (godownNameElement) {
      const godownNameText = godownNameElement.textContent || '';
      const trimmedGodownName = godownNameText.trim();
      // Check if the value is "Any" (case-insensitive) and doesn't already have the &#4; prefix
      if (trimmedGodownName.toLowerCase() === 'any' && !godownNameText.includes('&#4;')) {
        godownNameElement.textContent = '&#4; Any';
        console.log('✅ Updated GODOWNNAME to include &#4; prefix for "Any"');
      }
    }

    // 1. Insert ORDERPRECLOSUREDATE as first child
    if (batchAllocationsList.firstChild) {
      batchAllocationsList.insertBefore(precloseDateElement, batchAllocationsList.firstChild);
    } else {
      batchAllocationsList.appendChild(precloseDateElement);
    }

    // 2. Insert ORDERCLOSUREREASON after INDENTNO, before ORDERNO
    if (indentNoElement && indentNoElement.nextSibling) {
      batchAllocationsList.insertBefore(precloseReasonElement, indentNoElement.nextSibling);
    } else if (orderNoElement) {
      batchAllocationsList.insertBefore(precloseReasonElement, orderNoElement);
    } else {
      if (indentNoElement) {
        batchAllocationsList.insertBefore(precloseReasonElement, indentNoElement.nextSibling);
      } else {
        batchAllocationsList.appendChild(precloseReasonElement);
      }
    }

    // 3. Insert ORDERPRECLOSUREQTY after BILLEDQTY, before ORDERDUEDATE
    if (billedQtyElement && billedQtyElement.nextSibling) {
      batchAllocationsList.insertBefore(precloseQtyElement, billedQtyElement.nextSibling);
    } else if (orderDueDateElement) {
      batchAllocationsList.insertBefore(precloseQtyElement, orderDueDateElement);
    } else {
      if (billedQtyElement) {
        batchAllocationsList.insertBefore(precloseQtyElement, billedQtyElement.nextSibling);
      } else {
        batchAllocationsList.appendChild(precloseQtyElement);
      }
    }

    // Serialize the modified cloned voucher from DOM
    // Serialize all child nodes individually to ensure all content is preserved
    const serializer = new XMLSerializer();
    let voucherInnerXml = '';
    
    // Serialize all child nodes (elements, text nodes, etc.) to preserve all content
    const childNodes = Array.from(voucherElementClone.childNodes);
    for (let i = 0; i < childNodes.length; i++) {
      const node = childNodes[i];
      if (node.nodeType === 1) {
        // Element node - serialize it
        voucherInnerXml += serializer.serializeToString(node as Element);
      } else if (node.nodeType === 3) {
        // Text node - preserve whitespace and content
        const textContent = node.textContent || '';
        voucherInnerXml += textContent;
      } else if (node.nodeType === 4) {
        // CDATA node - preserve as is
        voucherInnerXml += `<![CDATA[${(node as CDATASection).data}]]>`;
      }
    }
    
    // If serialization failed or is too short, fallback to full element serialization
    if (!voucherInnerXml || voucherInnerXml.trim().length < 100) {
      console.warn('⚠️ Child node serialization produced short result, using full element serialization');
      const voucherFullXml = serializer.serializeToString(voucherElementClone);
      voucherInnerXml = voucherFullXml.replace(/^<VOUCHER[^>]*>/i, '').replace(/<\/VOUCHER>$/i, '');
    }
    
    console.log(`📋 Serialized voucher inner XML length: ${voucherInnerXml.length} characters`);

    // Construct VOUCHER opening tag with NAME attribute using MasterId
    let voucherOpeningTag = '<VOUCHER';
    voucherOpeningTag += ` NAME="ID:${salesOrderVoucher.MasterId}"`;
    voucherOpeningTag += ' ACTION="Alter">';

    const voucherXmlString = voucherOpeningTag + voucherInnerXml + '</VOUCHER>';

    // Extract COMPANY TALLYMESSAGE blocks using DOM
    let companyTallyMessages = '';
    const allTallyMessages = xmlDoc.querySelectorAll('TALLYMESSAGE');
    
    for (let i = 0; i < allTallyMessages.length; i++) {
      const msg = allTallyMessages[i];
      // Check if it contains COMPANY info
      // Use getElementsByTagName because querySelector with dots in tag names can be tricky
      const hasCompany = msg.getElementsByTagName('COMPANY').length > 0;
      const hasRemote = msg.getElementsByTagName('REMOTECMPINFO.LIST').length > 0;
      
      if (hasCompany && hasRemote) {
         // Ensure namespace if missing
         if (!msg.hasAttribute('xmlns:UDF')) {
           msg.setAttribute('xmlns:UDF', 'TallyUDF');
         }
         companyTallyMessages += '\n    ' + serializer.serializeToString(msg);
      }
    }

    // Create import XML
    let importXml = `<ENVELOPE>
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
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     ${voucherXmlString}
    </TALLYMESSAGE>${companyTallyMessages}
   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>`;

    // Fix INDENTNO and TRACKINGNUMBER to ensure they have &#4; prefix for "Not Applicable"
    // Handle both cases: escaped (&amp;#4;) and unescaped (&#4;), and also plain "Not Applicable"
    importXml = importXml.replace(
      /<INDENTNO>((?:&amp;#4;|&#4;)?\s*Not Applicable)<\/INDENTNO>/gi,
      '<INDENTNO>&#4; Not Applicable</INDENTNO>'
    );
    importXml = importXml.replace(
      /<TRACKINGNUMBER>((?:&amp;#4;|&#4;)?\s*Not Applicable)<\/TRACKINGNUMBER>/gi,
      '<TRACKINGNUMBER>&#4; Not Applicable</TRACKINGNUMBER>'
    );
    
    // Fix BATCHNAME and GODOWNNAME to ensure they have &#4; prefix for "Any"
    // Handle both cases: escaped (&amp;#4;) and unescaped (&#4;), and also plain "Any" (case-insensitive)
    importXml = importXml.replace(
      /<BATCHNAME>((?:&amp;#4;|&#4;)?\s*Any)<\/BATCHNAME>/gi,
      '<BATCHNAME>&#4; Any</BATCHNAME>'
    );
    importXml = importXml.replace(
      /<GODOWNNAME>((?:&amp;#4;|&#4;)?\s*Any)<\/GODOWNNAME>/gi,
      '<GODOWNNAME>&#4; Any</GODOWNNAME>'
    );
    
    console.log('✅ Fixed INDENTNO and TRACKINGNUMBER elements to include &#4; prefix');
    console.log('✅ Fixed BATCHNAME and GODOWNNAME elements to include &#4; prefix for "Any"');

    // Log XML
    console.error('═══════════════════════════════════════════════════════');
    console.error('🚨 SHORT CLOSE XML BEING POSTED TO TALLY 🚨');
    console.error('═══════════════════════════════════════════════════════');
    console.error(importXml);
    console.error('═══════════════════════════════════════════════════════');

    // Post XML to Tally
    const response = await apiService.getReceivablesData(
      parseInt(tallylocId),
      companyName,
      guid,
      importXml
    );

    console.log('📥 Tally Response:', response);

    // Check response
    const responseParser = new DOMParser();
    const responseDoc = responseParser.parseFromString(response, 'text/xml');
    
    // Check for XML parsing errors
    const responseParserError = responseDoc.querySelector('parsererror');
    if (responseParserError) {
      console.error('❌ XML Parse Error in Tally response:', responseParserError.textContent);
      throw new Error(`Failed to parse Tally response: ${responseParserError.textContent}`);
    }

    // Check for RESPONSE element (Tally's standard response format)
    const responseElement = responseDoc.querySelector('RESPONSE');
    let success = false;
    let successMessage = '';
    
    if (responseElement) {
      const altered = parseInt(responseElement.querySelector('ALTERED')?.textContent || '0', 10);
      const created = parseInt(responseElement.querySelector('CREATED')?.textContent || '0', 10);
      const errors = parseInt(responseElement.querySelector('ERRORS')?.textContent || '0', 10);
      const exceptions = parseInt(responseElement.querySelector('EXCEPTIONS')?.textContent || '0', 10);
      
      console.log('📊 Tally Response:', {
        ALTERED: altered,
        CREATED: created,
        ERRORS: errors,
        EXCEPTIONS: exceptions
      });
      
      if (errors === 0 && exceptions === 0 && (altered > 0 || created > 0)) {
        success = true;
        if (altered > 0) {
          successMessage = `Voucher altered successfully! (${altered} voucher${altered > 1 ? 's' : ''} altered)`;
        } else if (created > 0) {
          successMessage = `Voucher created successfully! (${created} voucher${created > 1 ? 's' : ''} created)`;
        }
      } else if (errors > 0 || exceptions > 0) {
        // Extract error details if available
        const errorDesc = responseElement.querySelector('ERRORDESC');
        const exceptionDesc = responseElement.querySelector('EXCEPTIONDESC');
        let errorMsg = '';
        if (errorDesc) {
          errorMsg = errorDesc.textContent?.trim() || '';
        } else if (exceptionDesc) {
          errorMsg = exceptionDesc.textContent?.trim() || '';
        }
        if (!errorMsg) {
          errorMsg = errors > 0 ? `Tally returned ${errors} error(s)` : `Tally returned ${exceptions} exception(s)`;
        }
        throw new Error(`Failed to submit short close: ${errorMsg}`);
      }
    }
    
    // Fallback: Check for IMPORTRESULT element (alternative format)
    if (!success) {
      const importResult = responseDoc.querySelector('IMPORTRESULT');
      const importSuccess = importResult?.getAttribute('STATUS') === 'Success';
      
      if (importSuccess) {
        success = true;
        successMessage = 'Short close submitted successfully!';
      } else {
        // Try to extract detailed error message from Tally response
        let errorMsg = 'Unknown error occurred';
        
        if (importResult) {
          // Check textContent first
          errorMsg = importResult.textContent?.trim() || '';
          
          // If empty, check for error attributes or child elements
          if (!errorMsg) {
            const status = importResult.getAttribute('STATUS');
            const errorCode = importResult.getAttribute('ERRORCODE');
            const errorDesc = importResult.querySelector('ERRORDESC');
            
            if (errorDesc) {
              errorMsg = errorDesc.textContent?.trim() || '';
            }
            
            if (!errorMsg && status) {
              errorMsg = `Status: ${status}`;
            }
            
            if (!errorMsg && errorCode) {
              errorMsg = `Error Code: ${errorCode}`;
            }
          }
        } else {
          // No IMPORTRESULT found - check for other error indicators
          const errorElement = responseDoc.querySelector('ERROR') || responseDoc.querySelector('MESSAGE');
          if (errorElement) {
            errorMsg = errorElement.textContent?.trim() || errorElement.getAttribute('DESC') || 'Tally returned an error';
          } else {
            // Log the full response for debugging
            console.error('❌ Full Tally Response:', response);
            errorMsg = 'Tally returned an unexpected response format. Check console for details.';
          }
        }
        
        throw new Error(`Failed to submit short close: ${errorMsg}`);
      }
    }
    
    if (success) {
      onSuccessMessage(successMessage);
      await onSuccess();
    }
  } catch (err: any) {
    console.error('❌ Error submitting short close:', err);
    onError(err.message || 'Unknown error');
  } finally {
    setSubmitting(false);
  }
};


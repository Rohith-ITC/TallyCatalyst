import React, { useState, useRef, useEffect } from 'react';

const ChatBot = ({ salesData, metrics }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      type: 'bot',
      text: 'Hi! I can help you analyze your sales data. Ask me anything about your revenue, orders, customers, products, or trends.',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationContext, setConversationContext] = useState({
    lastTopic: null,
    lastDataType: null,
    lastCount: null
  });
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Universal AI Query Engine - handles ANY query dynamically
  const universalQueryEngine = (query, salesData) => {
    if (!salesData || salesData.length === 0) {
      return "No data available to analyze.";
    }

    const lowerQuery = query.toLowerCase();
    
    // Dynamic column detection
    const sampleRecord = salesData[0];
    const numericColumns = Object.keys(sampleRecord).filter(key => 
      typeof sampleRecord[key] === 'number' && !key.includes('id')
    );
    const textColumns = Object.keys(sampleRecord).filter(key => 
      typeof sampleRecord[key] === 'string' && key !== 'cp_date' && key !== 'date'
    );
    const dateColumns = ['cp_date', 'date'];
    
    // Detect operation type
    const operations = {
      aggregate: ['total', 'sum', 'overall', 'all'],
      average: ['average', 'avg', 'mean'],
      count: ['count', 'number', 'how many'],
      top: ['top', 'highest', 'best', 'maximum', 'max'],
      bottom: ['bottom', 'lowest', 'worst', 'minimum', 'min'],
      breakdown: ['breakdown', 'wise', 'by', 'split', 'group'],
      compare: ['vs', 'versus', 'compare', 'comparison']
    };
    
    let operation = 'list';
    for (const [op, keywords] of Object.entries(operations)) {
      if (keywords.some(kw => lowerQuery.includes(kw))) {
        operation = op;
        break;
      }
    }
    
    // Detect grouping dimension dynamically
    let groupByColumn = null;
    const groupKeywords = {
      'month': ['month', 'monthly'],
      'customer': ['customer', 'client', 'party'],
      'item': ['item', 'product', 'goods'],
      'category': ['category', 'stock group', 'group'],
      'region': ['region', 'location', 'area'],
      'cp_date': ['date', 'day', 'daily']
    };
    
    for (const [col, keywords] of Object.entries(groupKeywords)) {
      if (keywords.some(kw => lowerQuery.includes(kw))) {
        groupByColumn = col;
        break;
      }
    }
    
    // Detect metric to measure
    let metricColumn = 'amount';
    if (lowerQuery.includes('quantity') || lowerQuery.includes('units') || lowerQuery.includes('qty')) {
      metricColumn = 'quantity';
    } else if (lowerQuery.includes('order') || lowerQuery.includes('transaction')) {
      metricColumn = 'masterid';
    }
    
    // Extract limit
    const limitMatch = query.match(/\b(\d+)\b/);
    const limit = limitMatch ? parseInt(limitMatch[1]) : 10;
    
    // Detect time filters
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                       'july', 'august', 'september', 'october', 'november', 'december'];
    const monthFilter = monthNames.find(m => lowerQuery.includes(m));
    const yearMatch = query.match(/(20\d{2})/);
    const yearFilter = yearMatch ? yearMatch[1] : null;
    
    // Detect specific entity filters
    let filteredData = [...salesData];
    const entityFilters = {};
    
    for (const col of textColumns) {
      const uniqueValues = [...new Set(salesData.map(s => s[col]))];
      const foundValue = uniqueValues.find(val => 
        val && lowerQuery.includes(val.toLowerCase())
      );
      if (foundValue) {
        entityFilters[col] = foundValue;
        filteredData = filteredData.filter(s => s[col] === foundValue);
      }
    }
    
    // Apply time filters
    if (monthFilter || yearFilter) {
      filteredData = filteredData.filter(sale => {
        const date = new Date(sale.cp_date || sale.date);
        const month = date.getMonth();
        const year = date.getFullYear().toString();
        
        if (monthFilter && yearFilter) {
          return monthNames[month] === monthFilter && year === yearFilter;
        } else if (monthFilter) {
          return monthNames[month] === monthFilter;
        } else if (yearFilter) {
          return year === yearFilter;
        }
        return true;
      });
    }
    
    // Execute operation
    if (operation === 'breakdown' && groupByColumn) {
      return generateBreakdown(filteredData, groupByColumn, metricColumn, entityFilters);
    } else if (operation === 'top' || operation === 'bottom') {
      return generateRanking(filteredData, groupByColumn, metricColumn, limit, operation === 'bottom', entityFilters);
    } else if (operation === 'aggregate') {
      return generateAggregate(filteredData, metricColumn, entityFilters);
    } else if (operation === 'average') {
      return generateAverage(filteredData, metricColumn, groupByColumn, entityFilters);
    } else if (operation === 'count') {
      return generateCount(filteredData, groupByColumn, entityFilters);
    } else if (operation === 'compare') {
      return generateComparison(salesData, query, metricColumn);
    } else {
      return generateSmartSummary(filteredData, entityFilters);
    }
  };
  
  // Generate breakdown by dimension
  const generateBreakdown = (data, groupBy, metric, filters) => {
    if (groupBy === 'month') {
      const monthly = data.reduce((acc, sale) => {
        const date = new Date(sale.cp_date || sale.date);
        const key = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        if (!acc[key]) acc[key] = { revenue: 0, quantity: 0, orders: new Set(), transactions: 0 };
        acc[key].revenue += sale.amount;
        acc[key].quantity += sale.quantity;
        acc[key].orders.add(sale.masterid);
        acc[key].transactions += 1;
        return acc;
      }, {});
      
      let response = `**📅 Month-wise Breakdown:**\n\n`;
      Object.entries(monthly).sort((a, b) => new Date(a[0]) - new Date(b[0])).forEach(([month, stats]) => {
        response += `**${month}:**\n`;
        response += `• Revenue: ₹${stats.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
        response += `• Orders: ${stats.orders.size}\n`;
        response += `• Quantity: ${stats.quantity.toLocaleString('en-IN')} units\n`;
        response += `• Transactions: ${stats.transactions}\n\n`;
      });
      return response;
    }
    
    const grouped = data.reduce((acc, sale) => {
      const key = sale[groupBy] || 'Unknown';
      if (!acc[key]) acc[key] = { revenue: 0, quantity: 0, orders: new Set(), transactions: 0 };
      acc[key].revenue += sale.amount;
      acc[key].quantity += sale.quantity;
      acc[key].orders.add(sale.masterid);
      acc[key].transactions += 1;
      return acc;
    }, {});
    
    let response = `**📊 Breakdown by ${groupBy}:**\n\n`;
    Object.entries(grouped).sort((a, b) => b[1].revenue - a[1].revenue).forEach(([name, stats]) => {
      response += `**${name}:**\n`;
      response += `• Revenue: ₹${stats.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
      response += `• Orders: ${stats.orders.size}\n`;
      response += `• Quantity: ${stats.quantity.toLocaleString('en-IN')} units\n\n`;
    });
    return response;
  };
  
  // Generate ranking (top/bottom)
  const generateRanking = (data, groupBy, metric, limit, isBottom, filters) => {
    if (!groupBy) {
      // Show top transactions
      const sorted = [...data].sort((a, b) => isBottom ? a.amount - b.amount : b.amount - a.amount).slice(0, limit);
      let response = `**${isBottom ? 'Bottom' : 'Top'} ${limit} Transactions:**\n\n`;
      sorted.forEach((item, i) => {
        response += `${i + 1}. **${item.customer}** - ${item.item} - ₹${item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
      });
      return response;
    }
    
    if (groupBy === 'month') {
      const monthly = data.reduce((acc, sale) => {
        const key = new Date(sale.cp_date || sale.date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        acc[key] = (acc[key] || 0) + (metric === 'quantity' ? sale.quantity : sale.amount);
        return acc;
      }, {});
      
      const sorted = Object.entries(monthly).sort((a, b) => isBottom ? a[1] - b[1] : b[1] - a[1]).slice(0, limit);
      let response = `**${isBottom ? 'Bottom' : 'Top'} ${limit} Months by ${metric === 'quantity' ? 'Quantity' : 'Revenue'}:**\n\n`;
      sorted.forEach(([month, value], i) => {
        const prefix = metric === 'quantity' ? '' : '₹';
        const suffix = metric === 'quantity' ? ' units' : '';
        response += `${i + 1}. **${month}** - ${prefix}${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}${suffix}\n`;
      });
      return response;
    }
    
    const grouped = data.reduce((acc, sale) => {
      const key = sale[groupBy] || 'Unknown';
      if (metric === 'masterid') {
        if (!acc[key]) acc[key] = new Set();
        acc[key].add(sale.masterid);
      } else {
        acc[key] = (acc[key] || 0) + (metric === 'quantity' ? sale.quantity : sale.amount);
      }
      return acc;
    }, {});
    
    const items = Object.entries(grouped).map(([key, value]) => ({
      label: key,
      value: metric === 'masterid' ? value.size : value
    }));
    
    const sorted = items.sort((a, b) => isBottom ? a.value - b.value : b.value - a.value).slice(0, limit);
    let response = `**${isBottom ? 'Bottom' : 'Top'} ${limit} ${groupBy} by ${metric === 'quantity' ? 'Quantity' : metric === 'masterid' ? 'Orders' : 'Revenue'}:**\n\n`;
    sorted.forEach((item, i) => {
      const prefix = metric === 'quantity' || metric === 'masterid' ? '' : '₹';
      const suffix = metric === 'quantity' ? ' units' : metric === 'masterid' ? ' orders' : '';
      response += `${i + 1}. **${item.label}** - ${prefix}${item.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}${suffix}\n`;
    });
    return response;
  };
  
  // Generate aggregate
  const generateAggregate = (data, metric, filters) => {
    const totalRevenue = data.reduce((sum, s) => sum + s.amount, 0);
    const totalQuantity = data.reduce((sum, s) => sum + s.quantity, 0);
    const uniqueOrders = new Set(data.map(s => s.masterid)).size;
    const uniqueCustomers = new Set(data.map(s => s.customer)).size;
    
    let response = `**📊 Aggregate Analysis:**\n\n`;
    if (Object.keys(filters).length > 0) {
      response += `**Filters Applied:** ${Object.entries(filters).map(([k, v]) => `${k}=${v}`).join(', ')}\n\n`;
    }
    response += `• Total Revenue: ₹${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
    response += `• Total Quantity: ${totalQuantity.toLocaleString('en-IN')} units\n`;
    response += `• Total Orders: ${uniqueOrders}\n`;
    response += `• Total Transactions: ${data.length}\n`;
    response += `• Unique Customers: ${uniqueCustomers}\n`;
    return response;
  };
  
  // Generate average
  const generateAverage = (data, metric, groupBy, filters) => {
    const avgRevenue = data.reduce((sum, s) => sum + s.amount, 0) / data.length;
    const avgQuantity = data.reduce((sum, s) => sum + s.quantity, 0) / data.length;
    
    let response = `**📊 Average Analysis:**\n\n`;
    response += `• Average Revenue per Transaction: ₹${avgRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
    response += `• Average Quantity per Transaction: ${avgQuantity.toLocaleString('en-IN', { minimumFractionDigits: 2 })} units\n`;
    return response;
  };
  
  // Generate count
  const generateCount = (data, groupBy, filters) => {
    if (groupBy) {
      const unique = new Set(data.map(s => s[groupBy])).size;
      return `**Count of unique ${groupBy}:** ${unique}`;
    }
    return `**Total transactions:** ${data.length}`;
  };
  
  // Generate comparison
  const generateComparison = (data, query, metric) => {
    const lowerQuery = query.toLowerCase();
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                       'july', 'august', 'september', 'october', 'november', 'december'];
    
    const periods = monthNames.filter(m => lowerQuery.includes(m));
    if (periods.length >= 2) {
      const period1Data = data.filter(s => {
        const month = new Date(s.cp_date || s.date).getMonth();
        return monthNames[month] === periods[0];
      });
      const period2Data = data.filter(s => {
        const month = new Date(s.cp_date || s.date).getMonth();
        return monthNames[month] === periods[1];
      });
      
      const p1Rev = period1Data.reduce((sum, s) => sum + s.amount, 0);
      const p2Rev = period2Data.reduce((sum, s) => sum + s.amount, 0);
      const growth = ((p2Rev - p1Rev) / p1Rev * 100).toFixed(2);
      
      return `**${periods[0].toUpperCase()} vs ${periods[1].toUpperCase()} Comparison:**\n\n` +
             `**${periods[0].charAt(0).toUpperCase() + periods[0].slice(1)}:**\n` +
             `• Revenue: ₹${p1Rev.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
             `• Transactions: ${period1Data.length}\n\n` +
             `**${periods[1].charAt(0).toUpperCase() + periods[1].slice(1)}:**\n` +
             `• Revenue: ₹${p2Rev.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
             `• Transactions: ${period2Data.length}\n\n` +
             `**Growth:** ${growth}% ${growth > 0 ? '📈' : '📉'}`;
    }
    return "Please specify two periods to compare (e.g., 'april vs may')";
  };
  
  // Generate smart summary
  const generateSmartSummary = (data, filters) => {
    const totalRevenue = data.reduce((sum, s) => sum + s.amount, 0);
    const totalQuantity = data.reduce((sum, s) => sum + s.quantity, 0);
    const uniqueOrders = new Set(data.map(s => s.masterid)).size;
    
    let response = `**📊 Summary:**\n\n`;
    if (Object.keys(filters).length > 0) {
      response += `**For:** ${Object.values(filters).join(', ')}\n\n`;
    }
    response += `• Revenue: ₹${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
    response += `• Quantity: ${totalQuantity.toLocaleString('en-IN')} units\n`;
    response += `• Orders: ${uniqueOrders}\n`;
    response += `• Transactions: ${data.length}\n`;
    return response;
  };

  // Helper function to get top N items
  const getTopN = (data, count = 3, by = 'amount') => {
    const sorted = [...data].sort((a, b) => b[by] - a[by]).slice(0, count);
    return sorted;
  };

  // Helper function to format top N response
  const formatTopNResponse = (items, type, count, format = 'list') => {
    if (items.length === 0) return `No ${type} found.`;
    
    // Always use readable list format instead of markdown tables
    let response = `**Top ${count} ${type}:**\n\n`;
    items.forEach((item, index) => {
      const value = item.amount || item.value || item.revenue || item.quantity || 0;
      const prefix = type.includes('quantity') ? '' : '₹';
      const suffix = type.includes('quantity') ? ' units' : '';
      
      if (type.includes('transaction')) {
        response += `${index + 1}. **${item.customer || item.label}** - ${item.item} - ${prefix}${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}${suffix}\n`;
      } else {
        response += `${index + 1}. **${item.label || item.customer || item.item || item.name}** - ${prefix}${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}\n`;
      }
    });
    
    return response;
  };

  // Helper functions to extract names from queries with fuzzy matching
  const extractCustomerName = (query, salesData) => {
    const customers = Array.from(new Set(salesData.map(s => s.customer)));
    
    // Clean the query to extract potential customer name
    const cleanQuery = query.toLowerCase()
      .replace(/month wise sales for the customer|month wise|sales for|customer|how much|what|analysis|revenue|sales/i, '')
      .replace(/[-]/g, ' ')
      .trim();
    
    // Try exact match first
    let foundCustomer = customers.find(customer => 
      query.toLowerCase().includes(customer.toLowerCase())
    );
    
    if (foundCustomer) return foundCustomer;
    
    // Try partial match with cleaned query
    foundCustomer = customers.find(customer => 
      customer.toLowerCase().includes(cleanQuery) ||
      cleanQuery.includes(customer.toLowerCase())
    );
    
    if (foundCustomer) return foundCustomer;
    
    // Try word-by-word matching
    const queryWords = cleanQuery.split(/\s+/).filter(word => word.length > 2);
    foundCustomer = customers.find(customer => {
      const customerWords = customer.toLowerCase().split(/\s+/);
      return queryWords.some(queryWord => 
        customerWords.some(customerWord => 
          customerWord.includes(queryWord) || queryWord.includes(customerWord)
        )
      );
    });
    
    return foundCustomer;
  };

  const extractItemName = (query, salesData) => {
    const items = Array.from(new Set(salesData.map(s => s.item)));
    // Look for item names that appear in the query
    const foundItem = items.find(item => 
      query.toLowerCase().includes(item.toLowerCase()) ||
      item.toLowerCase().includes(query.toLowerCase().replace(/sales|revenue|product|item|how much|what|analysis/i, '').trim())
    );
    return foundItem;
  };

  const extractGroupName = (query, salesData) => {
    const groups = Array.from(new Set(salesData.map(s => s.category)));
    // Look for group names that appear in the query
    const foundGroup = groups.find(group => 
      query.toLowerCase().includes(group.toLowerCase()) ||
      group.toLowerCase().includes(query.toLowerCase().replace(/sales|revenue|stock group|category|group|how much|what|analysis/i, '').trim())
    );
    return foundGroup;
  };

  const extractRegionName = (query, salesData) => {
    const regions = Array.from(new Set(salesData.map(s => s.region)));
    // Look for region names that appear in the query
    const foundRegion = regions.find(region => 
      query.toLowerCase().includes(region.toLowerCase()) ||
      region.toLowerCase().includes(query.toLowerCase().replace(/sales|revenue|region|area|how much|what|analysis/i, '').trim())
    );
    return foundRegion;
  };

  // Parse complex queries
  const parseComplexQuery = (query, lowerQuery) => {
    const countMatch = query.match(/\d+/);
    const count = countMatch ? parseInt(countMatch[0]) : 3;
    
    // Check for month/year filters
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                       'july', 'august', 'september', 'october', 'november', 'december'];
    const foundMonth = monthNames.find(month => lowerQuery.includes(month));
    const yearMatch = query.match(/(20\d{2})/);
    const foundYear = yearMatch ? yearMatch[0] : null;
    
    // Filter data based on date criteria
    let filteredData = salesData;
    if (foundMonth || foundYear) {
      const monthIndex = foundMonth ? monthNames.indexOf(foundMonth) : null;
      filteredData = salesData.filter(sale => {
        const saleDate = new Date(sale.cp_date || sale.date);
        const saleMonth = saleDate.getMonth();
        const saleYear = saleDate.getFullYear().toString();
        
        if (foundMonth && foundYear) {
          return saleMonth === monthIndex && saleYear === foundYear;
        } else if (foundMonth) {
          return saleMonth === monthIndex;
        } else if (foundYear) {
          return saleYear === foundYear;
        }
        return true;
      });
    }
    
    // Determine query type
    if (lowerQuery.includes('customer') && lowerQuery.includes('transaction')) {
      // Top customer transactions (individual transactions, not aggregated)
      const topTransactions = getTopN(filteredData, count, 'amount');
      return formatTopNResponse(topTransactions, 'customer transactions', count, 'list');
    } else if (lowerQuery.includes('customer') && !lowerQuery.includes('transaction')) {
      // Top customers by aggregated sales
      const customers = filteredData.reduce((acc, sale) => {
        acc[sale.customer] = (acc[sale.customer] || 0) + sale.amount;
        return acc;
      }, {});
      const topCustomers = getTopN(
        Object.entries(customers).map(([label, amount]) => ({ label, amount })),
        count,
        'amount'
      );
      return formatTopNResponse(topCustomers, 'customers by revenue', count, 'list');
    } else if (lowerQuery.includes('product') || lowerQuery.includes('item')) {
      const products = filteredData.reduce((acc, sale) => {
        acc[sale.item] = (acc[sale.item] || 0) + sale.amount;
        return acc;
      }, {});
      const topProducts = getTopN(
        Object.entries(products).map(([label, amount]) => ({ label, amount })),
        count,
        'amount'
      );
      return formatTopNResponse(topProducts, 'products by revenue', count, 'list');
    } else if (lowerQuery.includes('transaction')) {
      // Default to transactions if transaction is mentioned
      const topTransactions = getTopN(filteredData, count, 'amount');
      return formatTopNResponse(topTransactions, 'transactions', count, 'list');
    }
    
    return null;
  };

  // Data validation and debugging helper
  const validateAndDebugData = (query, customerName = null) => {
    const debugInfo = {
      totalRecords: salesData.length,
      uniqueCustomers: Array.from(new Set(salesData.map(s => s.customer))).length,
      dateRange: {
        start: new Date(Math.min(...salesData.map(s => new Date(s.cp_date || s.date)))).toLocaleDateString('en-IN'),
        end: new Date(Math.max(...salesData.map(s => new Date(s.cp_date || s.date)))).toLocaleDateString('en-IN')
      },
      topCustomers: Array.from(new Set(salesData.map(s => s.customer)))
        .map(customer => {
          const customerSales = salesData.filter(s => s.customer === customer);
          return {
            name: customer,
            revenue: customerSales.reduce((sum, s) => sum + s.amount, 0),
            transactions: customerSales.length
          };
        })
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5),
      customerData: customerName ? salesData.filter(s => 
        s.customer.toLowerCase().includes(customerName.toLowerCase())
      ) : null
    };
    
    console.log('🔍 ChatBot Debug Info:', debugInfo);
    return debugInfo;
  };

  // Month names constant for use across functions
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                     'july', 'august', 'september', 'october', 'november', 'december'];

  // Advanced AI-like query processor with comprehensive analysis
  const intelligentQueryProcessor = (query) => {
    const lowerQuery = query.toLowerCase();
    
    // Enhanced query analysis with more sophisticated parsing
    const queryAnalysis = {
      intent: null,
      entities: {
        customer: null,
        product: null,
        stockGroup: null,
        region: null,
        date: null,
        count: null,
        metric: null,
        comparison: null,
        periods: []
      },
      modifiers: {
        monthWise: false,
        topN: false,
        total: false,
        average: false,
        specific: false,
        comparison: false,
        vs: false,
        breakdown: false
      },
      context: {
        previousQuery: conversationContext.lastTopic,
        previousDataType: conversationContext.lastDataType
      }
    };
    
    // Advanced intent detection with comparison support
    if (lowerQuery.includes('vs') || lowerQuery.includes('versus') || lowerQuery.includes('compare') || lowerQuery.includes('comparison')) {
      queryAnalysis.intent = 'comparison';
      queryAnalysis.modifiers.comparison = true;
      queryAnalysis.modifiers.vs = true;
    } else if (lowerQuery.includes('what is') || lowerQuery.includes('show me') || lowerQuery.includes('tell me')) {
      queryAnalysis.intent = 'information';
    } else if (lowerQuery.includes('top') || lowerQuery.includes('best') || lowerQuery.includes('highest') || lowerQuery.includes('nett')) {
      queryAnalysis.intent = 'ranking';
    } else if (lowerQuery.includes('how much') || lowerQuery.includes('total')) {
      queryAnalysis.intent = 'calculation';
    } else if (lowerQuery.includes('month') || lowerQuery.includes('period') || lowerQuery.includes('wise') || lowerQuery.includes('breakdown')) {
      queryAnalysis.intent = 'temporal_analysis';
      queryAnalysis.modifiers.breakdown = true;
    } else if (lowerQuery.includes('not') || lowerQuery.includes('instead') || lowerQuery.includes('but')) {
      queryAnalysis.intent = 'clarification';
    } else {
      queryAnalysis.intent = 'general';
    }
    
    // Enhanced period detection for comparisons
    
    // Detect multiple periods for comparison
    const foundMonths = monthNames.filter(month => lowerQuery.includes(month));
    const yearMatches = query.match(/(20\d{2})/g);
    const foundYears = yearMatches ? yearMatches : [];
    
    if (foundMonths.length > 0 || foundYears.length > 0) {
      queryAnalysis.entities.periods = foundMonths.map(month => ({
        month: month,
        year: foundYears[0] || new Date().getFullYear()
      }));
      
      if (foundYears.length > 1) {
        queryAnalysis.entities.periods.forEach((period, index) => {
          if (foundYears[index]) {
            period.year = foundYears[index];
          }
        });
      }
    }
    
    // Entity extraction with fuzzy matching
    const allCustomers = Array.from(new Set(salesData.map(s => s.customer)));
    const allProducts = Array.from(new Set(salesData.map(s => s.item)));
    const allStockGroups = Array.from(new Set(salesData.map(s => s.category)));
    const allRegions = Array.from(new Set(salesData.map(s => s.region)));
    
    // Extract customer name
    for (const customer of allCustomers) {
      if (lowerQuery.includes(customer.toLowerCase()) || 
          customer.toLowerCase().includes(lowerQuery.replace(/what|is|the|sales|value|for|show|me|tell/i, '').trim())) {
        queryAnalysis.entities.customer = customer;
        break;
      }
    }
    
    // Extract product name with better matching
    for (const product of allProducts) {
      const productLower = product.toLowerCase();
      // Check for exact match or partial match
      if (lowerQuery.includes(productLower) || 
          (productLower.includes(lowerQuery.replace(/top|customers|sales|for|the|item|product/i, '').trim()))) {
        queryAnalysis.entities.product = product;
        break;
      }
    }
    
    // Extract stock group
    for (const group of allStockGroups) {
      if (lowerQuery.includes(group.toLowerCase())) {
        queryAnalysis.entities.stockGroup = group;
        break;
      }
    }
    
    // Extract region
    for (const region of allRegions) {
      if (lowerQuery.includes(region.toLowerCase())) {
        queryAnalysis.entities.region = region;
        break;
      }
    }
    
    // Extract count
    const countMatch = query.match(/\d+/);
    if (countMatch) {
      queryAnalysis.entities.count = parseInt(countMatch[0]);
    }
    
    // Extract date information (using monthNames from above)
    const foundMonth = monthNames.find(month => lowerQuery.includes(month));
    const singleYearMatch = query.match(/(20\d{2})/);
    
    if (foundMonth || singleYearMatch) {
      queryAnalysis.entities.date = {
        month: foundMonth,
        year: singleYearMatch ? singleYearMatch[0] : null
      };
    }
    
    // Extract metric - comprehensive column detection
    if (lowerQuery.includes('revenue') || lowerQuery.includes('sales') || lowerQuery.includes('amount')) {
      queryAnalysis.entities.metric = 'revenue';
    } else if (lowerQuery.includes('orders') || lowerQuery.includes('order')) {
      queryAnalysis.entities.metric = 'orders';
    } else if (lowerQuery.includes('quantity') || lowerQuery.includes('units')) {
      queryAnalysis.entities.metric = 'quantity';
    } else if (lowerQuery.includes('customers') || lowerQuery.includes('customer')) {
      queryAnalysis.entities.metric = 'customers';
    } else if (lowerQuery.includes('masterid') || lowerQuery.includes('master id') || lowerQuery.includes('transaction id')) {
      queryAnalysis.entities.metric = 'masterid';
    } else if (lowerQuery.includes('cp_date') || lowerQuery.includes('cp date') || lowerQuery.includes('transaction date')) {
      queryAnalysis.entities.metric = 'cp_date';
    } else if (lowerQuery.includes('item') || lowerQuery.includes('product')) {
      queryAnalysis.entities.metric = 'item';
    } else if (lowerQuery.includes('category') || lowerQuery.includes('stock group') || lowerQuery.includes('stockgroup')) {
      queryAnalysis.entities.metric = 'category';
    } else if (lowerQuery.includes('region') || lowerQuery.includes('location')) {
      queryAnalysis.entities.metric = 'region';
    } else if (lowerQuery.includes('issales') || lowerQuery.includes('is sales')) {
      queryAnalysis.entities.metric = 'issales';
    }
    
    // Detect modifiers
    queryAnalysis.modifiers.monthWise = lowerQuery.includes('month') || lowerQuery.includes('wise');
    queryAnalysis.modifiers.topN = lowerQuery.includes('top') && queryAnalysis.entities.count;
    queryAnalysis.modifiers.total = lowerQuery.includes('total') || lowerQuery.includes('sum');
    queryAnalysis.modifiers.average = lowerQuery.includes('average') || lowerQuery.includes('avg');
    queryAnalysis.modifiers.specific = queryAnalysis.entities.customer || queryAnalysis.entities.product;
    
    console.log('🧠 Query Analysis:', queryAnalysis);
    
    // Generate intelligent response based on analysis
    return generateIntelligentResponse(queryAnalysis, query);
  };

  // Generate intelligent response based on query analysis
  const generateIntelligentResponse = (analysis, originalQuery) => {
    const { intent, entities, modifiers } = analysis;
    const lowerQuery = originalQuery.toLowerCase();
    
    // Handle specific customer queries
    if (entities.customer) {
      const customerSales = salesData.filter(s => s.customer === entities.customer);
      
      if (customerSales.length === 0) {
        return `I couldn't find any sales data for "${entities.customer}". Available customers include: ${Array.from(new Set(salesData.map(s => s.customer))).slice(0, 5).join(', ')}...`;
      }
      
      if (modifiers.monthWise) {
        // Call the month-wise breakdown function
        const customerSales = salesData.filter(s => s.customer === entities.customer);
        
        if (customerSales.length === 0) {
          return `No data found for customer "${entities.customer}". Available customers include: ${Array.from(new Set(salesData.map(s => s.customer))).slice(0, 5).join(', ')}...`;
        }
        
        // Calculate overall metrics
        const totalRevenue = customerSales.reduce((sum, s) => sum + s.amount, 0);
        const totalOrders = new Set(customerSales.map(s => s.masterid)).size;
        const totalQuantity = customerSales.reduce((sum, s) => sum + s.quantity, 0);
        
        // Month-wise breakdown
        const monthWiseData = customerSales.reduce((acc, sale) => {
          const date = new Date(sale.cp_date || sale.date);
          const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const monthName = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
          
          if (!acc[monthYear]) {
            acc[monthYear] = {
              monthName,
              revenue: 0,
              orders: new Set(),
              quantity: 0,
              transactions: 0
            };
          }
          
          acc[monthYear].revenue += sale.amount;
          acc[monthYear].orders.add(sale.masterid);
          acc[monthYear].quantity += sale.quantity;
          acc[monthYear].transactions += 1;
          
          return acc;
        }, {});
        
        // Sort months chronologically
        const sortedMonths = Object.entries(monthWiseData).sort(([a], [b]) => a.localeCompare(b));
        
        let response = `Customer "${entities.customer}" Analysis:\n\n`;
        response += `**Overall Performance:**\n`;
        response += `• Total Revenue: ₹${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
        response += `• Total Orders: ${totalOrders}\n`;
        response += `• Total Quantity: ${totalQuantity.toLocaleString('en-IN')} units\n`;
        response += `• Total Transactions: ${customerSales.length}\n\n`;
        
        response += `**Month-wise Breakdown:**\n`;
        response += `| Month | Revenue | Orders | Quantity | Transactions |\n`;
        response += `|-------|---------|--------|----------|-------------|\n`;
        
        sortedMonths.forEach(([monthKey, data]) => {
          response += `| ${data.monthName} | ₹${data.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} | ${data.orders.size} | ${data.quantity.toLocaleString('en-IN')} | ${data.transactions} |\n`;
        });
        
        return response;
      }
      
      const customerRevenue = customerSales.reduce((sum, s) => sum + s.amount, 0);
      const customerOrders = new Set(customerSales.map(s => s.masterid)).size;
      const customerQuantity = customerSales.reduce((sum, s) => sum + s.quantity, 0);
      
      if (intent === 'information' || intent === 'calculation') {
        return `**${entities.customer} Sales Information:**\n\n• **Total Revenue:** ₹${customerRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n• **Total Orders:** ${customerOrders}\n• **Total Quantity:** ${customerQuantity.toLocaleString('en-IN')} units\n• **Total Transactions:** ${customerSales.length}\n\nAsk for "month wise sales for ${entities.customer}" to see detailed breakdown by month.`;
      }
    }
    
    // Handle specific product queries
    if (entities.product) {
      const productSales = salesData.filter(s => s.item === entities.product);
      
      if (productSales.length === 0) {
        return `No sales data found for "${entities.product}". Available products include: ${Array.from(new Set(salesData.map(s => s.item))).slice(0, 5).join(', ')}...`;
      }
      
      // Check if user wants customer breakdown for this product
      if (lowerQuery.includes('customer') || lowerQuery.includes('customers')) {
        // Calculate customer sales for this specific product
        const customerProductSales = productSales.reduce((acc, sale) => {
          acc[sale.customer] = (acc[sale.customer] || 0) + sale.amount;
          return acc;
        }, {});
        
        const topCustomers = Object.entries(customerProductSales)
          .sort((a, b) => b[1] - a[1])
          .slice(0, entities.count || 5);
        
        let response = `**Top ${entities.count || 5} Customers for ${entities.product}:**\n\n`;
        response += `| # | Customer | Revenue |\n`;
        response += `|---|----------|----------|\n`;
        topCustomers.forEach(([customer, revenue], index) => {
          response += `| ${index + 1} | ${customer} | ₹${revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} |\n`;
        });
        
        const totalRevenue = productSales.reduce((sum, s) => sum + s.amount, 0);
        const totalOrders = new Set(productSales.map(s => s.masterid)).size;
        const totalQuantity = productSales.reduce((sum, s) => sum + s.quantity, 0);
        
        response += `\n**${entities.product} Summary:**\n`;
        response += `• Total Revenue: ₹${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
        response += `• Total Orders: ${totalOrders}\n`;
        response += `• Total Quantity Sold: ${totalQuantity.toLocaleString('en-IN')} units\n`;
        response += `• Total Transactions: ${productSales.length}`;
        
        return response;
      }
      
      // Default product information
      const productRevenue = productSales.reduce((sum, s) => sum + s.amount, 0);
      const productOrders = new Set(productSales.map(s => s.masterid)).size;
      const productQuantity = productSales.reduce((sum, s) => sum + s.quantity, 0);
      
      return `**${entities.product} Sales Information:**\n\n• **Total Revenue:** ₹${productRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n• **Total Orders:** ${productOrders}\n• **Total Quantity Sold:** ${productQuantity.toLocaleString('en-IN')} units\n• **Total Transactions:** ${productSales.length}\n\nAsk for "top 5 customers for ${entities.product}" to see customer breakdown!`;
    }
    
    // Handle ranking queries
    if (intent === 'ranking') {
      // Handle "best sales date top 3 in the month of april" - show top dates by revenue
      if (lowerQuery.includes('best sales date') && lowerQuery.includes('month') && entities.periods && entities.periods.length === 1) {
        const period = entities.periods[0];
        const periodData = salesData.filter(sale => {
          const date = new Date(sale.cp_date || sale.date);
          const month = date.getMonth() + 1;
          const year = date.getFullYear();
          const monthIndex = monthNames.indexOf(period.month) + 1;
          return month === monthIndex && year === parseInt(period.year);
        });
        
        if (periodData.length === 0) {
          return `No sales data found for ${period.month.charAt(0).toUpperCase() + period.month.slice(1)} ${period.year}. Available data ranges from ${new Date(Math.min(...salesData.map(s => new Date(s.cp_date || s.date)))).toLocaleDateString('en-IN')} to ${new Date(Math.max(...salesData.map(s => new Date(s.cp_date || s.date)))).toLocaleDateString('en-IN')}.`;
        }
        
        // Calculate sales by date
        const dateSales = periodData.reduce((acc, sale) => {
          const date = new Date(sale.cp_date || sale.date);
          const dateKey = date.toLocaleDateString('en-IN');
          acc[dateKey] = (acc[dateKey] || 0) + sale.amount;
          return acc;
        }, {});
        
        const count = entities.count || 3;
        const topDates = Object.entries(dateSales)
          .sort((a, b) => b[1] - a[1])
          .slice(0, count);
        
        let response = `**Top ${count} Sales Dates - ${period.month.charAt(0).toUpperCase() + period.month.slice(1)} ${period.year}:**\n\n`;
        response += `| # | Date | Total Revenue |\n`;
        response += `|---|------|---------------|\n`;
        topDates.forEach(([date, revenue], index) => {
          response += `| ${index + 1} | ${date} | ₹${revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} |\n`;
        });
        
        const totalRevenue = periodData.reduce((sum, sale) => sum + sale.amount, 0);
        response += `\n**Total Revenue for ${period.month.charAt(0).toUpperCase() + period.month.slice(1)} ${period.year}: ₹${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}**`;
        
        return response;
      }
      
      // Handle "top sales in the month of april" - should be aggregated customer sales for that month
      if (lowerQuery.includes('sales') && lowerQuery.includes('month') && entities.periods && entities.periods.length === 1) {
        const period = entities.periods[0];
        const periodData = salesData.filter(sale => {
          const date = new Date(sale.cp_date || sale.date);
          const month = date.getMonth() + 1;
          const year = date.getFullYear();
          const monthIndex = monthNames.indexOf(period.month) + 1;
          return month === monthIndex && year === parseInt(period.year);
        });
        
        if (periodData.length === 0) {
          return `No sales data found for ${period.month.charAt(0).toUpperCase() + period.month.slice(1)} ${period.year}. Available data ranges from ${new Date(Math.min(...salesData.map(s => new Date(s.cp_date || s.date)))).toLocaleDateString('en-IN')} to ${new Date(Math.max(...salesData.map(s => new Date(s.cp_date || s.date)))).toLocaleDateString('en-IN')}.`;
        }
        
        // Calculate top customers for the period (aggregated, not individual transactions)
        const periodCustomers = periodData.reduce((acc, sale) => {
          acc[sale.customer] = (acc[sale.customer] || 0) + sale.amount;
          return acc;
        }, {});
        
        const count = entities.count || 5;
        const topCustomers = Object.entries(periodCustomers)
          .sort((a, b) => b[1] - a[1])
          .slice(0, count);
        
        let response = `**Top ${count} Sales - ${period.month.charAt(0).toUpperCase() + period.month.slice(1)} ${period.year} (Customer-wise):**\n\n`;
        response += `| # | Customer | Total Revenue |\n`;
        response += `|---|----------|---------------|\n`;
        topCustomers.forEach(([customer, revenue], index) => {
          response += `| ${index + 1} | ${customer} | ₹${revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} |\n`;
        });
        
        const totalRevenue = periodData.reduce((sum, sale) => sum + sale.amount, 0);
        response += `\n**Total Revenue for ${period.month.charAt(0).toUpperCase() + period.month.slice(1)} ${period.year}: ₹${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}**`;
        
        return response;
      }
      
      // Handle "top sales" - should be transaction-wise, not item-wise
      if (lowerQuery.includes('sales') && !lowerQuery.includes('customer') && !lowerQuery.includes('product') && !lowerQuery.includes('item') && !lowerQuery.includes('month')) {
        const count = entities.count || 5; // Default to top 5 if no count specified
        const topTransactions = getTopN(salesData, count, 'amount');
        
        let response = `**Top ${count} Sales (Transaction-wise):**\n\n`;
        response += `| # | Customer | Item | Amount | Date |\n`;
        response += `|---|----------|------|--------|------|\n`;
        
        topTransactions.forEach((transaction, index) => {
          const date = new Date(transaction.cp_date || transaction.date);
          response += `| ${index + 1} | ${transaction.customer} | ${transaction.item} | ₹${transaction.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} | ${date.toLocaleDateString('en-IN')} |\n`;
        });
        
        return response;
      }
      
      // Handle "top items by quantity" queries
      if (lowerQuery.includes('items') && lowerQuery.includes('quantity')) {
        const itemQuantities = salesData.reduce((acc, sale) => {
          acc[sale.item] = (acc[sale.item] || 0) + sale.quantity;
          return acc;
        }, {});
        
        const count = entities.count || 5;
        const topItemsByQuantity = Object.entries(itemQuantities)
          .sort((a, b) => b[1] - a[1])
          .slice(0, count);
        
        let response = `**Top ${count} Items by Quantity Sold:**\n\n`;
        response += `| # | Item | Quantity |\n`;
        response += `|---|------|----------|\n`;
        topItemsByQuantity.forEach(([item, quantity], index) => {
          response += `| ${index + 1} | ${item} | ${quantity.toLocaleString('en-IN')} units |\n`;
        });
        
        return response;
      }
      
      // Handle "top items by revenue" queries
      if (lowerQuery.includes('items') && (lowerQuery.includes('revenue') || lowerQuery.includes('sales'))) {
        const itemRevenues = salesData.reduce((acc, sale) => {
          acc[sale.item] = (acc[sale.item] || 0) + sale.amount;
          return acc;
        }, {});
        
        const count = entities.count || 5;
        const topItemsByRevenue = Object.entries(itemRevenues)
          .sort((a, b) => b[1] - a[1])
          .slice(0, count);
        
        let response = `**Top ${count} Items by Revenue:**\n\n`;
        response += `| # | Item | Revenue |\n`;
        response += `|---|------|----------|\n`;
        topItemsByRevenue.forEach(([item, revenue], index) => {
          response += `| ${index + 1} | ${item} | ₹${revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} |\n`;
        });
        
        return response;
      }
      
      // Handle customer ranking
      if (entities.count && (entities.metric === 'customers' || lowerQuery.includes('customer'))) {
        const customers = salesData.reduce((acc, sale) => {
          acc[sale.customer] = (acc[sale.customer] || 0) + sale.amount;
          return acc;
        }, {});
        const topCustomers = getTopN(
          Object.entries(customers).map(([label, amount]) => ({ label, amount })),
          entities.count,
          'amount'
        );
        return formatTopNResponse(topCustomers, 'customers by revenue', entities.count, 'list');
      }
    }
    
    // Handle comparison queries (april vs may, etc.)
    if (intent === 'comparison' && entities.periods && entities.periods.length >= 2) {
      const period1 = entities.periods[0];
      const period2 = entities.periods[1];
      
      // Filter data for each period
      const period1Data = salesData.filter(sale => {
        const date = new Date(sale.cp_date || sale.date);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const monthIndex = monthNames.indexOf(period1.month) + 1;
        return month === monthIndex && year === parseInt(period1.year);
      });
      
      const period2Data = salesData.filter(sale => {
        const date = new Date(sale.cp_date || sale.date);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const monthIndex = monthNames.indexOf(period2.month) + 1;
        return month === monthIndex && year === parseInt(period2.year);
      });
      
      // Calculate top customers for each period
      const period1Customers = period1Data.reduce((acc, sale) => {
        acc[sale.customer] = (acc[sale.customer] || 0) + sale.amount;
        return acc;
      }, {});
      
      const period2Customers = period2Data.reduce((acc, sale) => {
        acc[sale.customer] = (acc[sale.customer] || 0) + sale.amount;
        return acc;
      }, {});
      
      // Get top 5 customers for each period
      const topPeriod1Customers = Object.entries(period1Customers)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      const topPeriod2Customers = Object.entries(period2Customers)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      let response = `**${period1.month.charAt(0).toUpperCase() + period1.month.slice(1)} ${period1.year} vs ${period2.month.charAt(0).toUpperCase() + period2.month.slice(1)} ${period2.year} - Top Customer Sales Comparison:**\n\n`;
      
      response += `**${period1.month.charAt(0).toUpperCase() + period1.month.slice(1)} ${period1.year} Top Customers:**\n`;
      response += `| # | Customer | Revenue |\n`;
      response += `|---|----------|----------|\n`;
      topPeriod1Customers.forEach(([customer, revenue], index) => {
        response += `| ${index + 1} | ${customer} | ₹${revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} |\n`;
      });
      
      response += `\n**${period2.month.charAt(0).toUpperCase() + period2.month.slice(1)} ${period2.year} Top Customers:**\n`;
      response += `| # | Customer | Revenue |\n`;
      response += `|---|----------|----------|\n`;
      topPeriod2Customers.forEach(([customer, revenue], index) => {
        response += `| ${index + 1} | ${customer} | ₹${revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} |\n`;
      });
      
      // Calculate totals for comparison
      const period1Total = period1Data.reduce((sum, sale) => sum + sale.amount, 0);
      const period2Total = period2Data.reduce((sum, sale) => sum + sale.amount, 0);
      const growth = ((period2Total - period1Total) / period1Total * 100).toFixed(2);
      
      response += `\n**Summary:**\n`;
      response += `• ${period1.month.charAt(0).toUpperCase() + period1.month.slice(1)} ${period1.year} Total: ₹${period1Total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
      response += `• ${period2.month.charAt(0).toUpperCase() + period2.month.slice(1)} ${period2.year} Total: ₹${period2Total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
      response += `• Growth: ${growth}%\n`;
      
      return response;
    }
    
    // Handle single period queries with "top customer sales"
    if (intent === 'temporal_analysis' && entities.periods && entities.periods.length === 1) {
      const period = entities.periods[0];
      const periodData = salesData.filter(sale => {
        const date = new Date(sale.cp_date || sale.date);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const monthIndex = monthNames.indexOf(period.month) + 1;
        return month === monthIndex && year === parseInt(period.year);
      });
      
      if (periodData.length === 0) {
        return `No sales data found for ${period.month.charAt(0).toUpperCase() + period.month.slice(1)} ${period.year}. Available data ranges from ${new Date(Math.min(...salesData.map(s => new Date(s.cp_date || s.date)))).toLocaleDateString('en-IN')} to ${new Date(Math.max(...salesData.map(s => new Date(s.cp_date || s.date)))).toLocaleDateString('en-IN')}.`;
      }
      
      // Calculate top customers for the period (aggregated, not individual transactions)
      const periodCustomers = periodData.reduce((acc, sale) => {
        acc[sale.customer] = (acc[sale.customer] || 0) + sale.amount;
        return acc;
      }, {});
      
      const topCustomers = Object.entries(periodCustomers)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      
      let response = `**Top Customer Sales - ${period.month.charAt(0).toUpperCase() + period.month.slice(1)} ${period.year}:**\n\n`;
      response += `| # | Customer | Total Revenue |\n`;
      response += `|---|----------|---------------|\n`;
      topCustomers.forEach(([customer, revenue], index) => {
        response += `| ${index + 1} | ${customer} | ₹${revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} |\n`;
      });
      
      const totalRevenue = periodData.reduce((sum, sale) => sum + sale.amount, 0);
      response += `\n**Total Revenue for ${period.month.charAt(0).toUpperCase() + period.month.slice(1)} ${period.year}: ₹${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}**`;
      
      return response;
    }
    
    // Handle clarification queries (follow-up questions)
    if (intent === 'clarification') {
      // Check conversation context for previous query
      if (conversationContext.lastTopic === 'sales' || conversationContext.lastDataType === 'transaction') {
        if (lowerQuery.includes('not') && lowerQuery.includes('item')) {
          // User wants transaction-wise, not item-wise
          const count = entities.count || 5;
          const topTransactions = getTopN(salesData, count, 'amount');
          
          let response = `**Top ${count} Sales (Transaction-wise):**\n\n`;
          response += `| # | Customer | Item | Amount | Date |\n`;
          response += `|---|----------|------|--------|------|\n`;
          
          topTransactions.forEach((transaction, index) => {
            const date = new Date(transaction.cp_date || transaction.date);
            response += `| ${index + 1} | ${transaction.customer} | ${transaction.item} | ₹${transaction.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} | ${date.toLocaleDateString('en-IN')} |\n`;
          });
          
          return response;
        }
      }
      
      // Generic clarification response
      return `I understand you want a different view. Could you please clarify:\n\n• For transaction-wise top sales: "top 5 sales transactions"\n• For customer-wise top sales: "top 5 customers by sales"\n• For product-wise top sales: "top 5 products by sales"\n• For period comparisons: "april vs may top customer sales"\n\nWhat specific data would you like to see?`;
    }
    
    // Handle general information queries
    if (intent === 'information' && !entities.customer && !entities.product) {
      if (lowerQuery.includes('revenue') || lowerQuery.includes('sales')) {
        return `**Overall Sales Information:**\n\n• **Total Revenue:** ₹${metrics.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n• **Total Orders:** ${metrics.totalOrders}\n• **Total Quantity:** ${metrics.totalQuantity.toLocaleString('en-IN')} units\n• **Unique Customers:** ${metrics.uniqueCustomers}\n• **Average Order Value:** ₹${metrics.avgOrderValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n\n**Date Range:** ${new Date(Math.min(...salesData.map(s => new Date(s.cp_date || s.date)))).toLocaleDateString('en-IN')} to ${new Date(Math.max(...salesData.map(s => new Date(s.cp_date || s.date)))).toLocaleDateString('en-IN')}`;
      }
    }
    
    // Fallback to original logic
    return null;
  };

  // Analyze query and generate response based on sales data
  const analyzeQuery = (query) => {
    const lowerQuery = query.toLowerCase();
    let newContext = { ...conversationContext };
    
    // Try intelligent processing first
    const intelligentResponse = intelligentQueryProcessor(query);
    if (intelligentResponse) {
      return intelligentResponse;
    }
    
    // Debug data for complex queries
    if (lowerQuery.includes('customer') && lowerQuery.includes('month')) {
      const customerName = extractCustomerName(query, salesData);
      validateAndDebugData(query, customerName);
    }

    // Handle complex queries first
    if (lowerQuery.includes('top') && /\d+/.test(query)) {
      const complexResponse = parseComplexQuery(query, lowerQuery);
      if (complexResponse) {
        return complexResponse;
      }
    }

    // Handle follow-up "top N" requests based on context
    if ((lowerQuery.includes('top') && /\d+/.test(query)) || 
        (lowerQuery.includes('need') && /\d+/.test(query)) ||
        (lowerQuery.includes('show') && /\d+/.test(query))) {
      
      const countMatch = query.match(/\d+/);
      const count = countMatch ? parseInt(countMatch[0]) : 3;
      
      if (conversationContext.lastTopic && conversationContext.lastDataType) {
        newContext.lastCount = count;
        
        switch (conversationContext.lastDataType) {
          case 'stockgroup':
            const stockGroups = salesData.reduce((acc, sale) => {
              acc[sale.category] = (acc[sale.category] || 0) + sale.amount;
              return acc;
            }, {});
            const topStockGroups = getTopN(
              Object.entries(stockGroups).map(([label, amount]) => ({ label, amount })),
              count,
              'amount'
            );
            return formatTopNResponse(topStockGroups, 'stock groups by revenue', count, 'list');
            
          case 'customer':
            const customers = salesData.reduce((acc, sale) => {
              acc[sale.customer] = (acc[sale.customer] || 0) + sale.amount;
              return acc;
            }, {});
            const topCustomers = getTopN(
              Object.entries(customers).map(([label, amount]) => ({ label, amount })),
              count,
              'amount'
            );
            return formatTopNResponse(topCustomers, 'customers by revenue', count, 'list');
            
          case 'product':
          case 'item':
            const products = salesData.reduce((acc, sale) => {
              acc[sale.item] = (acc[sale.item] || 0) + sale.amount;
              return acc;
            }, {});
            const topProducts = getTopN(
              Object.entries(products).map(([label, amount]) => ({ label, amount })),
              count,
              'amount'
            );
            return formatTopNResponse(topProducts, 'products by revenue', count, 'list');
            
          case 'transaction':
            const topTransactions = getTopN(salesData, count, 'amount');
            return formatTopNResponse(topTransactions, 'transactions', count, 'list');
            
          case 'masterid':
            const topTransactionsById = getTopN(salesData, count, 'amount');
            return formatTopNResponse(topTransactionsById, 'transactions by ID', count, 'list');
            
          case 'cp_date':
            // Group by date and show top sales dates
            const dateSales = salesData.reduce((acc, sale) => {
              const date = new Date(sale.cp_date || sale.date);
              const dateKey = date.toLocaleDateString('en-IN');
              acc[dateKey] = (acc[dateKey] || 0) + sale.amount;
              return acc;
            }, {});
            const topDates = getTopN(
              Object.entries(dateSales).map(([label, amount]) => ({ label, amount })),
              count,
              'amount'
            );
            return formatTopNResponse(topDates, 'sales dates by revenue', count, 'list');
            
          case 'issales':
            // Filter by issales = true and show top sales
            const salesOnly = salesData.filter(sale => sale.issales === true);
            const topSalesOnly = getTopN(salesOnly, count, 'amount');
            return formatTopNResponse(topSalesOnly, 'sales transactions (issales=true)', count, 'list');
        }
      }
    }

    // Direct column analysis queries
    if (lowerQuery.includes('masterid') || lowerQuery.includes('transaction id')) {
      if (lowerQuery.includes('total') || lowerQuery.includes('count') || lowerQuery.includes('how many')) {
        const uniqueTransactions = new Set(salesData.map(s => s.masterid)).size;
        return `Total unique transactions (masterid): ${uniqueTransactions.toLocaleString('en-IN')}`;
      }
      if (lowerQuery.includes('top') || lowerQuery.includes('highest')) {
        const count = parseInt(query.match(/\d+/)?.[0]) || 5;
        const topTransactions = getTopN(salesData, count, 'amount');
        return formatTopNResponse(topTransactions, 'transactions by ID', count, 'list');
      }
    }
    
    if (lowerQuery.includes('issales') || lowerQuery.includes('is sales')) {
      const salesOnly = salesData.filter(sale => sale.issales === true);
      const nonSales = salesData.filter(sale => sale.issales === false);
      
      if (lowerQuery.includes('total') || lowerQuery.includes('count')) {
        return `Sales transactions (issales=true): ${salesOnly.length}\nNon-sales transactions (issales=false): ${nonSales.length}`;
      }
      if (lowerQuery.includes('revenue')) {
        const salesRevenue = salesOnly.reduce((sum, s) => sum + s.amount, 0);
        const nonSalesRevenue = nonSales.reduce((sum, s) => sum + s.amount, 0);
        return `Sales revenue (issales=true): ₹${salesRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\nNon-sales revenue (issales=false): ₹${nonSalesRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      }
    }
    
    if (lowerQuery.includes('cp_date') || lowerQuery.includes('transaction date') || lowerQuery.includes('date')) {
      if (lowerQuery.includes('range') || lowerQuery.includes('period')) {
        const dates = salesData.map(s => new Date(s.cp_date || s.date)).sort((a, b) => a - b);
        const startDate = dates[0].toLocaleDateString('en-IN');
        const endDate = dates[dates.length - 1].toLocaleDateString('en-IN');
        return `Date range: ${startDate} to ${endDate}`;
      }
      if (lowerQuery.includes('top') || lowerQuery.includes('best')) {
        const count = parseInt(query.match(/\d+/)?.[0]) || 5;
        const dateSales = salesData.reduce((acc, sale) => {
          const date = new Date(sale.cp_date || sale.date);
          const dateKey = date.toLocaleDateString('en-IN');
          acc[dateKey] = (acc[dateKey] || 0) + sale.amount;
          return acc;
        }, {});
        const topDates = getTopN(
          Object.entries(dateSales).map(([label, amount]) => ({ label, amount })),
          count,
          'amount'
        );
        return formatTopNResponse(topDates, 'sales dates by revenue', count, 'list');
      }
    }

    // Month-wise sales analysis
    if (lowerQuery.includes('month wise') || lowerQuery.includes('monthly') || lowerQuery.includes('month wise sales')) {
      const monthlySales = salesData.reduce((acc, sale) => {
        const date = new Date(sale.cp_date || sale.date);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        
        if (!acc[monthYear]) {
          acc[monthYear] = {
            month: monthName,
            revenue: 0,
            orders: new Set(),
            quantity: 0,
            transactions: 0
          };
        }
        
        acc[monthYear].revenue += sale.amount;
        acc[monthYear].orders.add(sale.masterid);
        acc[monthYear].quantity += sale.quantity;
        acc[monthYear].transactions += 1;
        
        return acc;
      }, {});
      
      const monthlyData = Object.values(monthlySales).sort((a, b) => {
        const aDate = new Date(a.month);
        const bDate = new Date(b.month);
        return aDate - bDate;
      });
      
      let response = `**📅 Month-wise Sales Breakdown:**\n\n`;
      monthlyData.forEach(month => {
        response += `**${month.month}:**\n`;
        response += `• Revenue: ₹${month.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
        response += `• Orders: ${month.orders.size}\n`;
        response += `• Quantity: ${month.quantity.toLocaleString('en-IN')} units\n`;
        response += `• Transactions: ${month.transactions}\n\n`;
      });
      
      return response;
    }

    // Revenue related queries
    if (lowerQuery.includes('revenue') || lowerQuery.includes('sales') || lowerQuery.includes('income')) {
      if (lowerQuery.includes('total') || lowerQuery.includes('how much')) {
        return `Total revenue is ₹${metrics.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. This is calculated from ${salesData.length} transactions.`;
      }
      if (lowerQuery.includes('average') || lowerQuery.includes('avg')) {
        return `Average order value is ₹${metrics.avgOrderValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. This is based on ${metrics.totalOrders} total orders.`;
      }
      if (lowerQuery.includes('highest') || lowerQuery.includes('top') || lowerQuery.includes('best')) {
        const topSale = [...salesData].sort((a, b) => b.amount - a.amount)[0];
        newContext = { lastTopic: 'transaction', lastDataType: 'transaction', lastCount: 1 };
        setConversationContext(newContext);
        return `The highest single transaction was ₹${topSale.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} from customer "${topSale.customer}" for item "${topSale.item}".`;
      }
    }

    // Orders related queries
    if (lowerQuery.includes('order') && !lowerQuery.includes('average')) {
      if (lowerQuery.includes('total') || lowerQuery.includes('how many') || lowerQuery.includes('number')) {
        return `There are ${metrics.totalOrders} total orders. These orders generated ₹${metrics.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in revenue.`;
      }
    }

    // Customer related queries
    if (lowerQuery.includes('customer')) {
      if (lowerQuery.includes('total') || lowerQuery.includes('how many') || lowerQuery.includes('number') || lowerQuery.includes('unique')) {
        return `You have ${metrics.uniqueCustomers} unique customers who have made purchases. Total revenue from all customers is ₹${metrics.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;
      }
      if (lowerQuery.includes('top') || lowerQuery.includes('best') || lowerQuery.includes('biggest')) {
        const customerRevenue = salesData.reduce((acc, sale) => {
          acc[sale.customer] = (acc[sale.customer] || 0) + sale.amount;
          return acc;
        }, {});
        
        if (lowerQuery.includes('top') && /\d+/.test(query)) {
          const countMatch = query.match(/\d+/);
          const count = countMatch ? parseInt(countMatch[0]) : 3;
          newContext = { lastTopic: 'customer', lastDataType: 'customer', lastCount: count };
          setConversationContext(newContext);
          
          const topCustomers = getTopN(
            Object.entries(customerRevenue).map(([label, amount]) => ({ label, amount })),
            count,
            'amount'
          );
          return formatTopNResponse(topCustomers, 'customers by revenue', count, 'list');
        } else {
          const topCustomer = Object.entries(customerRevenue).sort((a, b) => b[1] - a[1])[0];
          newContext = { lastTopic: 'customer', lastDataType: 'customer', lastCount: 1 };
          setConversationContext(newContext);
          return `Top customer is "${topCustomer[0]}" with ₹${topCustomer[1].toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in total revenue. Ask me for "top 3 customers" to see more!`;
        }
      }
    }

    // Product/Item related queries
    if (lowerQuery.includes('product') || lowerQuery.includes('item')) {
      if (lowerQuery.includes('top') || lowerQuery.includes('best') || lowerQuery.includes('popular')) {
        const itemRevenue = salesData.reduce((acc, sale) => {
          acc[sale.item] = (acc[sale.item] || 0) + sale.amount;
          return acc;
        }, {});
        
        if (lowerQuery.includes('top') && /\d+/.test(query)) {
          const countMatch = query.match(/\d+/);
          const count = countMatch ? parseInt(countMatch[0]) : 3;
          newContext = { lastTopic: 'product', lastDataType: 'product', lastCount: count };
          setConversationContext(newContext);
          
          const topProducts = getTopN(
            Object.entries(itemRevenue).map(([label, amount]) => ({ label, amount })),
            count,
            'amount'
          );
          return formatTopNResponse(topProducts, 'products by revenue', count, 'list');
        } else {
          const topItem = Object.entries(itemRevenue).sort((a, b) => b[1] - a[1])[0];
          newContext = { lastTopic: 'product', lastDataType: 'product', lastCount: 1 };
          setConversationContext(newContext);
          return `Top selling item is "${topItem[0]}" with ₹${topItem[1].toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in revenue. Ask me for "top 3 products" to see more!`;
        }
      }
      if (lowerQuery.includes('how many') || lowerQuery.includes('total') || lowerQuery.includes('number')) {
        const uniqueItems = new Set(salesData.map(s => s.item)).size;
        return `You have ${uniqueItems} unique items in your sales data with total quantity sold of ${metrics.totalQuantity.toLocaleString('en-IN')}.`;
      }
    }

    // Quantity related queries
    if (lowerQuery.includes('quantity') || lowerQuery.includes('units') || lowerQuery.includes('pieces')) {
      return `Total quantity sold is ${metrics.totalQuantity.toLocaleString('en-IN')} units across ${metrics.totalOrders} orders. This averages to ${(metrics.totalQuantity / metrics.totalOrders).toFixed(2)} units per order.`;
    }

    // Stock Group related queries
    if (lowerQuery.includes('stock group') || lowerQuery.includes('category') || lowerQuery.includes('group')) {
      const stockGroups = salesData.reduce((acc, sale) => {
        acc[sale.category] = (acc[sale.category] || 0) + sale.amount;
        return acc;
      }, {});
      const numGroups = Object.keys(stockGroups).length;
      
      if (lowerQuery.includes('top') && /\d+/.test(query)) {
        const countMatch = query.match(/\d+/);
        const count = countMatch ? parseInt(countMatch[0]) : 3;
        newContext = { lastTopic: 'stockgroup', lastDataType: 'stockgroup', lastCount: count };
        setConversationContext(newContext);
        
        const topStockGroups = getTopN(
          Object.entries(stockGroups).map(([label, amount]) => ({ label, amount })),
          count,
          'amount'
        );
        return formatTopNResponse(topStockGroups, 'stock groups by revenue', count, 'list');
      } else {
        const topStockGroup = Object.entries(stockGroups).sort((a, b) => b[1] - a[1])[0];
        newContext = { lastTopic: 'stockgroup', lastDataType: 'stockgroup', lastCount: 1 };
        setConversationContext(newContext);
        return `You have ${numGroups} stock groups. The top performing stock group is "${topStockGroup[0]}" with ₹${topStockGroup[1].toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in revenue. Ask me for "top 3" or "top 5" to see more!`;
      }
    }

    // Region related queries
    if (lowerQuery.includes('region') || lowerQuery.includes('area') || lowerQuery.includes('location')) {
      const regions = salesData.reduce((acc, sale) => {
        acc[sale.region] = (acc[sale.region] || 0) + sale.amount;
        return acc;
      }, {});
      const topRegion = Object.entries(regions).sort((a, b) => b[1] - a[1])[0];
      const numRegions = Object.keys(regions).length;
      return `Sales are distributed across ${numRegions} regions. The top performing region is "${topRegion[0]}" with ₹${topRegion[1].toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in revenue.`;
    }

    // Date/Time related queries - Enhanced with specific month/year handling
    if (lowerQuery.includes('when') || lowerQuery.includes('date') || lowerQuery.includes('period') || 
        lowerQuery.includes('month') || lowerQuery.includes('april') || lowerQuery.includes('may') || 
        lowerQuery.includes('june') || lowerQuery.includes('july') || lowerQuery.includes('august') ||
        lowerQuery.includes('september') || lowerQuery.includes('october') || lowerQuery.includes('november') ||
        lowerQuery.includes('december') || lowerQuery.includes('january') || lowerQuery.includes('february') ||
        lowerQuery.includes('march') || lowerQuery.includes('2024') || lowerQuery.includes('2025') ||
        lowerQuery.includes('2023') || lowerQuery.includes('2022')) {
      
      // Check for specific month queries
      const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                         'july', 'august', 'september', 'october', 'november', 'december'];
      
      const foundMonth = monthNames.find(month => lowerQuery.includes(month));
      const yearMatch = query.match(/(20\d{2})/);
      const foundYear = yearMatch ? yearMatch[0] : null;
      
      if (foundMonth || foundYear) {
        // Filter sales data for specific month/year
        const monthIndex = foundMonth ? monthNames.indexOf(foundMonth) : null;
        const filteredSales = salesData.filter(sale => {
          const saleDate = new Date(sale.cp_date || sale.date);
          const saleMonth = saleDate.getMonth();
          const saleYear = saleDate.getFullYear().toString();
          
          if (foundMonth && foundYear) {
            return saleMonth === monthIndex && saleYear === foundYear;
          } else if (foundMonth) {
            return saleMonth === monthIndex;
          } else if (foundYear) {
            return saleYear === foundYear;
          }
          return false;
        });
        
        if (filteredSales.length === 0) {
          const period = foundMonth && foundYear ? `${foundMonth} ${foundYear}` :
                        foundMonth ? foundMonth : foundYear;
          return `No sales data found for ${period}. The available data spans from ${new Date(Math.min(...salesData.map(s => new Date(s.cp_date || s.date)))).toLocaleDateString('en-IN')} to ${new Date(Math.max(...salesData.map(s => new Date(s.cp_date || s.date)))).toLocaleDateString('en-IN')}.`;
        }
        
        // Calculate metrics for filtered period
        const periodRevenue = filteredSales.reduce((sum, sale) => sum + sale.amount, 0);
        const periodOrders = new Set(filteredSales.map(s => s.masterid)).size;
        const periodQuantity = filteredSales.reduce((sum, sale) => sum + sale.quantity, 0);
        const periodCustomers = new Set(filteredSales.map(s => s.customer)).size;
        
        const period = foundMonth && foundYear ? `${foundMonth} ${foundYear}` :
                      foundMonth ? foundMonth : foundYear;
        
        return `Sales data for ${period}:\n\n• Total Revenue: ₹${periodRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n• Total Orders: ${periodOrders}\n• Total Quantity: ${periodQuantity.toLocaleString('en-IN')} units\n• Unique Customers: ${periodCustomers}\n• Transactions: ${filteredSales.length}`;
      }
      
      // General date range query
      const dates = salesData.map(s => new Date(s.cp_date || s.date)).sort((a, b) => a - b);
      const startDate = dates[0];
      const endDate = dates[dates.length - 1];
      const months = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24 * 30));
      return `The data spans from ${startDate.toLocaleDateString('en-IN')} to ${endDate.toLocaleDateString('en-IN')} (approximately ${months} months). During this period, you generated ₹${metrics.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in revenue.`;
    }

    // Comparison queries
    if (lowerQuery.includes('compare') || lowerQuery.includes('vs') || lowerQuery.includes('versus')) {
      return `I can help you compare data! Please be more specific. For example: "Compare revenue by stock group" or "Which customer has more orders - [customer name] vs [customer name]?"`;
    }

    // Growth/Trend queries
    if (lowerQuery.includes('trend') || lowerQuery.includes('growth') || lowerQuery.includes('increasing') || lowerQuery.includes('decreasing')) {
      const sortedSales = [...salesData].sort((a, b) => new Date(a.cp_date || a.date) - new Date(b.cp_date || b.date));
      const firstHalf = sortedSales.slice(0, Math.floor(sortedSales.length / 2));
      const secondHalf = sortedSales.slice(Math.floor(sortedSales.length / 2));
      const firstHalfRevenue = firstHalf.reduce((sum, s) => sum + s.amount, 0);
      const secondHalfRevenue = secondHalf.reduce((sum, s) => sum + s.amount, 0);
      const growth = ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue * 100).toFixed(2);
      const trend = growth > 0 ? 'increasing' : 'decreasing';
      return `Comparing the first half of your data period to the second half, revenue is ${trend} by ${Math.abs(growth)}%. First half: ₹${firstHalfRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}, Second half: ₹${secondHalfRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`;
    }

    // Summary/Overview queries
    if (lowerQuery.includes('summary') || lowerQuery.includes('overview') || lowerQuery.includes('tell me about')) {
      return `Here's your sales summary:\n\n• Total Revenue: ₹${metrics.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n• Total Orders: ${metrics.totalOrders}\n• Unique Customers: ${metrics.uniqueCustomers}\n• Total Quantity: ${metrics.totalQuantity.toLocaleString('en-IN')} units\n• Average Order Value: ₹${metrics.avgOrderValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n\nYour data spans ${salesData.length} transactions.`;
    }

  // Advanced customer analysis with month-wise breakdown
  const analyzeCustomerWithMonthBreakdown = (customerName, salesData) => {
    const customerSales = salesData.filter(s => 
      s.customer.toLowerCase().includes(customerName.toLowerCase())
    );
    
    if (customerSales.length === 0) {
      return `No data found for customer "${customerName}". Available customers include: ${Array.from(new Set(salesData.map(s => s.customer))).slice(0, 5).join(', ')}...`;
    }
    
    // Calculate overall metrics
    const totalRevenue = customerSales.reduce((sum, s) => sum + s.amount, 0);
    const totalOrders = new Set(customerSales.map(s => s.masterid)).size;
    const totalQuantity = customerSales.reduce((sum, s) => sum + s.quantity, 0);
    
    // Month-wise breakdown
    const monthWiseData = customerSales.reduce((acc, sale) => {
      const date = new Date(sale.cp_date || sale.date);
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      
      if (!acc[monthYear]) {
        acc[monthYear] = {
          monthName,
          revenue: 0,
          orders: new Set(),
          quantity: 0,
          transactions: 0
        };
      }
      
      acc[monthYear].revenue += sale.amount;
      acc[monthYear].orders.add(sale.masterid);
      acc[monthYear].quantity += sale.quantity;
      acc[monthYear].transactions += 1;
      
      return acc;
    }, {});
    
    // Sort months chronologically
    const sortedMonths = Object.entries(monthWiseData).sort(([a], [b]) => a.localeCompare(b));
    
    let response = `Customer "${customerName}" Analysis:\n\n`;
    response += `**Overall Performance:**\n`;
    response += `• Total Revenue: ₹${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
    response += `• Total Orders: ${totalOrders}\n`;
    response += `• Total Quantity: ${totalQuantity.toLocaleString('en-IN')} units\n`;
    response += `• Total Transactions: ${customerSales.length}\n\n`;
    
    response += `**Month-wise Breakdown:**\n`;
    response += `| Month | Revenue | Orders | Quantity | Transactions |\n`;
    response += `|-------|---------|--------|----------|-------------|\n`;
    
    sortedMonths.forEach(([monthKey, data]) => {
      response += `| ${data.monthName} | ₹${data.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} | ${data.orders.size} | ${data.quantity.toLocaleString('en-IN')} | ${data.transactions} |\n`;
    });
    
    return response;
  };

  // Smart analysis for any column/field queries
  const analyzeColumnData = (query, lowerQuery) => {
    // Check for specific customer queries with month-wise breakdown
    if (lowerQuery.includes('customer') && (lowerQuery.includes('month') || lowerQuery.includes('wise'))) {
      const customerName = extractCustomerName(query, salesData);
      if (customerName) {
        return analyzeCustomerWithMonthBreakdown(customerName, salesData);
      }
    }
    
    // General month-wise sales analysis (for any entity or overall)
    if ((lowerQuery.includes('month') || lowerQuery.includes('wise')) && !lowerQuery.includes('customer') && !lowerQuery.includes('product') && !lowerQuery.includes('item')) {
      const monthlySales = salesData.reduce((acc, sale) => {
        const date = new Date(sale.cp_date || sale.date);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        
        if (!acc[monthYear]) {
          acc[monthYear] = {
            month: monthName,
            revenue: 0,
            orders: new Set(),
            quantity: 0,
            transactions: 0
          };
        }
        
        acc[monthYear].revenue += sale.amount;
        acc[monthYear].orders.add(sale.masterid);
        acc[monthYear].quantity += sale.quantity;
        acc[monthYear].transactions += 1;
        
        return acc;
      }, {});
      
      const monthlyData = Object.values(monthlySales).sort((a, b) => {
        const aDate = new Date(a.month);
        const bDate = new Date(b.month);
        return aDate - bDate;
      });
      
      let response = `**📅 Month-wise Sales Breakdown:**\n\n`;
      monthlyData.forEach(month => {
        response += `**${month.month}:**\n`;
        response += `• Revenue: ₹${month.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
        response += `• Orders: ${month.orders.size}\n`;
        response += `• Quantity: ${month.quantity.toLocaleString('en-IN')} units\n`;
        response += `• Transactions: ${month.transactions}\n\n`;
      });
      
      return response;
    }
    
    // Check for specific customer queries
    if (lowerQuery.includes('customer') && !lowerQuery.includes('top') && !lowerQuery.includes('how many')) {
      const customerName = extractCustomerName(query, salesData);
      if (customerName) {
        const customerSales = salesData.filter(s => 
          s.customer.toLowerCase().includes(customerName.toLowerCase())
        );
        if (customerSales.length > 0) {
          const customerRevenue = customerSales.reduce((sum, s) => sum + s.amount, 0);
          const customerOrders = new Set(customerSales.map(s => s.masterid)).size;
          const customerQuantity = customerSales.reduce((sum, s) => sum + s.quantity, 0);
          return `Customer "${customerName}" analysis:\n\n• Total Revenue: ₹${customerRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n• Total Orders: ${customerOrders}\n• Total Quantity: ${customerQuantity.toLocaleString('en-IN')} units\n• Transactions: ${customerSales.length}\n\nAsk for "month wise sales for [customer name]" to see detailed breakdown!`;
        } else {
          return `No data found for customer "${customerName}". Available customers include: ${Array.from(new Set(salesData.map(s => s.customer))).slice(0, 5).join(', ')}...`;
        }
      }
    }

      // Check for specific product/item queries
      if ((lowerQuery.includes('product') || lowerQuery.includes('item')) && !lowerQuery.includes('top') && !lowerQuery.includes('how many')) {
        const itemName = extractItemName(query, salesData);
        if (itemName) {
          const itemSales = salesData.filter(s => 
            s.item.toLowerCase().includes(itemName.toLowerCase())
          );
          if (itemSales.length > 0) {
            const itemRevenue = itemSales.reduce((sum, s) => sum + s.amount, 0);
            const itemOrders = new Set(itemSales.map(s => s.masterid)).size;
            const itemQuantity = itemSales.reduce((sum, s) => sum + s.quantity, 0);
            return `Product "${itemName}" analysis:\n\n• Total Revenue: ₹${itemRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n• Total Orders: ${itemOrders}\n• Total Quantity Sold: ${itemQuantity.toLocaleString('en-IN')} units\n• Transactions: ${itemSales.length}`;
          } else {
            return `No data found for product "${itemName}". Available products include: ${Array.from(new Set(salesData.map(s => s.item))).slice(0, 5).join(', ')}...`;
          }
        }
      }

      // Check for specific stock group queries
      if ((lowerQuery.includes('stock group') || lowerQuery.includes('category')) && !lowerQuery.includes('top') && !lowerQuery.includes('how many')) {
        const groupName = extractGroupName(query, salesData);
        if (groupName) {
          const groupSales = salesData.filter(s => 
            s.category.toLowerCase().includes(groupName.toLowerCase())
          );
          if (groupSales.length > 0) {
            const groupRevenue = groupSales.reduce((sum, s) => sum + s.amount, 0);
            const groupOrders = new Set(groupSales.map(s => s.masterid)).size;
            const groupQuantity = groupSales.reduce((sum, s) => sum + s.quantity, 0);
            return `Stock Group "${groupName}" analysis:\n\n• Total Revenue: ₹${groupRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n• Total Orders: ${groupOrders}\n• Total Quantity: ${groupQuantity.toLocaleString('en-IN')} units\n• Transactions: ${groupSales.length}`;
          } else {
            return `No data found for stock group "${groupName}". Available stock groups include: ${Array.from(new Set(salesData.map(s => s.category))).slice(0, 5).join(', ')}...`;
          }
        }
      }

      // Check for specific region queries
      if (lowerQuery.includes('region') && !lowerQuery.includes('top') && !lowerQuery.includes('how many')) {
        const regionName = extractRegionName(query, salesData);
        if (regionName) {
          const regionSales = salesData.filter(s => 
            s.region.toLowerCase().includes(regionName.toLowerCase())
          );
          if (regionSales.length > 0) {
            const regionRevenue = regionSales.reduce((sum, s) => sum + s.amount, 0);
            const regionOrders = new Set(regionSales.map(s => s.masterid)).size;
            const regionQuantity = regionSales.reduce((sum, s) => sum + s.quantity, 0);
            return `Region "${regionName}" analysis:\n\n• Total Revenue: ₹${regionRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n• Total Orders: ${regionOrders}\n• Total Quantity: ${regionQuantity.toLocaleString('en-IN')} units\n• Transactions: ${regionSales.length}`;
          } else {
            return `No data found for region "${regionName}". Available regions include: ${Array.from(new Set(salesData.map(s => s.region))).join(', ')}`;
          }
        }
      }

      return null;
    };

    // Try smart column analysis
    const smartResponse = analyzeColumnData(query, lowerQuery);
    if (smartResponse) {
      return smartResponse;
    }

    // Debug queries - show actual top customers
    if (lowerQuery.includes('debug') || lowerQuery.includes('show actual') || lowerQuery.includes('real data')) {
      const debugInfo = validateAndDebugData(query);
      let response = `**Actual Data Debug Info:**\n\n`;
      response += `• Total Records: ${debugInfo.totalRecords}\n`;
      response += `• Unique Customers: ${debugInfo.uniqueCustomers}\n`;
      response += `• Date Range: ${debugInfo.dateRange.start} to ${debugInfo.dateRange.end}\n\n`;
      response += `**Top 5 Customers (Actual):**\n`;
      response += `| Customer | Revenue | Transactions |\n`;
      response += `|----------|---------|-------------|\n`;
      debugInfo.topCustomers.forEach(customer => {
        response += `| ${customer.name} | ₹${customer.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} | ${customer.transactions} |\n`;
      });
      return response;
    }

    // Help queries
    if (lowerQuery.includes('help') || lowerQuery.includes('what can you') || lowerQuery.includes('how to')) {
      // Get available columns from sales data
      const availableColumns = salesData.length > 0 ? Object.keys(salesData[0]) : [];
      
      let response = `I can help you analyze your sales data! Here are the **available columns** you can ask about:\n\n`;
      
      response += `**📊 Available Data Columns:**\n`;
      response += `• **customer** - Customer names\n`;
      response += `• **item** - Product/item names\n`;
      response += `• **amount** - Revenue/sales amounts\n`;
      response += `• **quantity** - Quantities sold\n`;
      response += `• **category** - Stock groups/categories\n`;
      response += `• **region** - Sales regions\n`;
      response += `• **masterid** - Transaction IDs\n`;
      response += `• **cp_date** - Transaction dates\n`;
      response += `• **issales** - Sales flag\n\n`;
      
      // Show actual data sample if available
      if (availableColumns.length > 0) {
        response += `**📋 Your Data Structure:**\n`;
        response += `Your dataset contains **${salesData.length}** records with these columns:\n`;
        availableColumns.forEach((col, index) => {
          response += `${index + 1}. **${col}**\n`;
        });
        response += `\n`;
      }
      
      response += `**🎯 Query Examples by Column:**\n`;
      response += `• **Customer:** "top 5 customers", "Vijay Steel Tube Co. sales"\n`;
      response += `• **Item:** "top 10 items by quantity", "K2 NEWFIX 20KG sales"\n`;
      response += `• **Amount:** "total revenue", "highest amount transactions"\n`;
      response += `• **Quantity:** "top items by quantity", "total units sold"\n`;
      response += `• **Category:** "top stock groups", "Hindustan group sales"\n`;
      response += `• **Region:** "sales by region", "Mumbai sales"\n`;
      response += `• **Date:** "april sales", "best sales dates", "april vs may"\n`;
      response += `• **Master ID:** "transaction details", "order analysis"\n\n`;
      
      response += `**📅 Time-based Queries:**\n`;
      response += `• "april sales", "2024 sales", "april vs may"\n`;
      response += `• "month wise sales for customer name"\n`;
      response += `• "best sales dates in april"\n\n`;
      
      response += `**🔍 Complex Queries:**\n`;
      response += `• "top 5 customers for K2 NEWFIX 20KG"\n`;
      response += `• "april vs may top customer sales"\n`;
      response += `• "month wise sales for Vijay Steel Tube Co."\n\n`;
      
      response += `**🛠️ Debug Commands:**\n`;
      response += `• "debug" - Show system information\n`;
      response += `• "show actual data" - Display real data statistics\n\n`;
      
      response += `**💡 Tips:**\n`;
      response += `• Be specific about columns (customer, item, amount, etc.)\n`;
      response += `• Use "top N" for rankings (top 5, top 10)\n`;
      response += `• Include time periods (april, 2024, month wise)\n`;
      response += `• Ask for comparisons (vs, compare, april vs may)\n\n`;
      
      response += `Just ask me anything using these columns!`;
      
      return response;
    }

    // Enhanced fallback with better suggestions
    return `I'm not sure I understood that. I can help you analyze:\n\n• **Customer Analysis:** "Vijay Steel Tube Co. sales", "top 5 customers"\n• **Product Analysis:** "K2 product sales", "top 10 products"\n• **Period Analysis:** "April sales", "2024 sales", "april vs may"\n• **Comparison Analysis:** "april vs may top customer sales"\n• **Transaction Analysis:** "top 5 sales transactions"\n• **Overall Metrics:** "total revenue", "how many orders"\n• **Month-wise Breakdown:** "month wise sales for customer name"\n\n**Examples of complex queries I can handle:**\n• "april vs may top customer sales"\n• "month wise sales for Vijay Steel Tube Co."\n• "top 10 sales transactions"\n• "april 2024 sales breakdown"\n\nType "help" for more options!`;
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage = {
      type: 'user',
      text: inputValue,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    const currentQuery = inputValue;
    setInputValue('');

    // Show typing indicator
    setIsTyping(true);

    try {
      // Prepare data to send to LLM
      const payload = {
        query: currentQuery,
        salesData: salesData,
        metrics: metrics,
        conversationContext: conversationContext,
        messages: messages.map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.text
        }))
      };

      console.log('🤖 Sending request to LLM at http://127.0.0.1:11434/api/chat');
      console.log('📊 Data being sent:', {
        query: currentQuery,
        salesDataLength: salesData?.length || 0,
        metrics: metrics,
        conversationContext: conversationContext
      });

      // Build system prompt with data - include full salesData as requested
      let salesDataStr = 'No data available';
      if (salesData && salesData.length > 0) {
        // Include full salesData as JSON string
        try {
          salesDataStr = JSON.stringify(salesData);
          console.log(`📊 Sales data size: ${salesDataStr.length} characters (${salesData.length} records)`);
        } catch (e) {
          console.error('Error stringifying salesData:', e);
          salesDataStr = `${salesData.length} records available`;
        }
      }

      // Detect currency from the actual data values and structure
      // Check if data contains currency indicators or analyze amount patterns
      let detectedCurrency = null;
      let currencyName = null;
      let currencySymbol = null;
      
      if (salesData && salesData.length > 0) {
        // Sample some data to analyze
        const sampleSize = Math.min(10, salesData.length);
        const sampleData = salesData.slice(0, sampleSize);
        
        // FIRST: Check the "country" field in salesData - this is the most reliable indicator
        // API data structure shows country="India" or "INDIA" for Indian Rupees
        let countryFound = null;
        for (const record of sampleData) {
          if (record.country) {
            const countryLower = String(record.country).toLowerCase();
            if (countryLower.includes('india')) {
              countryFound = 'India';
              break;
            } else if (countryLower.includes('usa') || countryLower.includes('united states')) {
              countryFound = 'USA';
              break;
            }
          }
        }
        
        // If country field indicates India, use ₹ (most reliable)
        if (countryFound === 'India') {
          detectedCurrency = '₹';
          currencyName = 'Indian Rupees';
          currencySymbol = '₹';
          console.log(`💰 Detected currency from country field: ${currencySymbol} (${currencyName})`);
        } else if (countryFound === 'USA') {
          detectedCurrency = '$';
          currencyName = 'US Dollars';
          currencySymbol = '$';
          console.log(`💰 Detected currency from country field: ${currencySymbol} (${currencyName})`);
        } else {
          // Fallback: Check for explicit currency indicators in data (if any field contains currency info)
          const dataStr = JSON.stringify(sampleData).toLowerCase();
          
          // Look for currency indicators in the data
          if (dataStr.includes('rupee') || dataStr.includes('inr') || dataStr.includes('₹')) {
            detectedCurrency = '₹';
            currencyName = 'Indian Rupees';
            currencySymbol = '₹';
          } else if (dataStr.includes('dollar') || dataStr.includes('usd') || dataStr.includes('$')) {
            detectedCurrency = '$';
            currencyName = 'US Dollars';
            currencySymbol = '$';
          } else {
            // Since Tally is Indian accounting software, default strongly to ₹
            // The app's formatCurrency function also uses ₹ (see SalesDashboard.js line 2151)
            detectedCurrency = '₹';
            currencyName = 'Indian Rupees';
            currencySymbol = '₹';
            console.log(`💰 Defaulting to ₹ (Tally is Indian software, app uses ₹ format)`);
          }
        }
        
        console.log(`💰 Final detected currency: ${currencySymbol} (${currencyName})`);
        console.log(`📊 Sample analysis - Avg amount: ${sampleData.reduce((sum, s) => sum + (s.amount || 0), 0) / sampleData.length}, Max: ${Math.max(...sampleData.map(s => s.amount || 0))}`);
      } else {
        // Default fallback - Tally is Indian software, so default to ₹
        detectedCurrency = '₹';
        currencyName = 'Indian Rupees';
        currencySymbol = '₹';
        console.log(`💰 No data available, defaulting to ₹ (Tally is Indian software)`);
      }

      const systemPrompt = `You are a helpful AI assistant analyzing sales data from Tally (Indian accounting software). You have access to complete sales data, metrics, and conversation context.

⚠️ CRITICAL CURRENCY REQUIREMENT - READ CAREFULLY:
The data comes from Tally, which is Indian accounting software. ALL amounts in the data are in ${currencyName} (${currencySymbol}).

DETECTED CURRENCY FROM DATA ANALYSIS: ${currencySymbol} (${currencyName})
- This was determined by checking the "country" field in the data (which shows "India"/"INDIA")
- The application uses ${currencySymbol} for all currency formatting
- Tally software is Indian accounting software that uses ${currencySymbol}

KEY FACTS ABOUT THE DATA:
1. The API returns amounts as plain numbers (e.g., "385.00", "2,300.00") WITHOUT currency symbols
2. The "country" field in the data is "India" or "INDIA" - this confirms ${currencySymbol} currency
3. Tally software is used primarily in India and uses ${currencyName}
4. The application's currency formatting function uses ${currencySymbol} (${currencyName})

CURRENCY RULES - STRICTLY ENFORCE:
- You MUST use ₹ (Indian Rupee symbol) for ALL monetary values
- NEVER use $ (dollar sign) or "dollars" or "USD" - these are WRONG
- NEVER use any currency other than ₹
- ALL amounts must be prefixed with ₹ symbol
- When mentioning currency in text, say "rupees" or "₹", NEVER "dollars" or "$"

📊 DATA FIELD EXPLANATIONS:
- "amount": The sales/revenue amount for each transaction (use this as the primary value)
- "profit": The profit amount for each transaction (if you mention profit, clearly label it as "profit")
- "quantity": The number of units sold
- "country": The country field (typically "India" or "INDIA") - confirms ₹ currency
- When showing values, be clear: "Amount: ₹X, Profit: ₹Y" NOT "₹X (₹Y)"
- NEVER use confusing formats like "₹2000 (₹31697)" - instead say "Amount: ₹2,000, Profit: ₹31,697" or just show the amount if profit isn't relevant

FORMATTING RULES:
- Indian Rupees (₹): Use Indian numbering (₹1,00,000 for one lakh, ₹10,00,000 for ten lakhs)
- Always format numbers with appropriate commas using Indian numbering system
- When showing multiple values, use clear labels: "Revenue: ₹X, Profit: ₹Y"

⚠️ RESPONSE STYLE REQUIREMENTS - USER-FRIENDLY & CONCISE:
- Answer ONLY what is asked - do not provide unnecessary background or explanations
- Be EXTREMELY direct and to the point - NO long stories, NO verbose introductions, NO rambling
- STOP immediately after answering the question - do not continue with unrelated topics
- If you don't understand the question, ask for clarification - DO NOT generate unrelated content
- Use NATURAL, BUSINESS-FRIENDLY language - write as if talking to a business owner, NOT a developer
- NEVER show technical details like: IDs, GST numbers, pincodes, JSON formats, raw data structures, or technical identifiers
- Format responses in a clean, readable way that common users can understand
- Use simple, conversational language - avoid technical jargon
- Keep responses SHORT - typically 1-3 sentences or a simple list
- If asked "What is total sales?", answer: "Total sales: ₹X" (NOT "Based on my comprehensive analysis of your sales data, I can tell you that the total sales amount comes to approximately ₹X...")
- Do not add context, explanations, or stories unless specifically requested
- NEVER generate content about unrelated topics (academic papers, research studies, SQLAlchemy, Python, etc.) - ONLY answer questions about the sales data
- If the question is unclear or seems unrelated to sales data, simply say "I can help you analyze your sales data. Could you clarify your question?"

📊 TABLE FORMAT FOR STRUCTURED DATA:
- When showing lists (top customers, top products, regional sales, etc.), ALWAYS use TABLE format
- Tables should be simple and clean with clear column headers
- Use markdown table format: | Column 1 | Column 2 | Column 3 |
- For "top 5 customers" questions, show: Customer Name | Revenue | Orders (or similar relevant columns)
- Keep tables concise - only show essential information
- NEVER write paragraph-style descriptions for lists - ALWAYS use table format
- Example format for top customers:
  | Customer | Revenue | Orders |
  |----------|---------|--------|
  | Customer A | ₹2,300 | 3 |
  | Customer B | ₹1,900 | 2 |

WHAT TO AVOID (Technical/Developer Language):
- ❌ "Customer A with ID: 206, GST No.: 29ABCDE1234F1ZR, Pincode: 560061"
- ❌ "{category: "Other", item: "Item D", quantity: 1, amount: 230, region: "Karnataka"}"
- ❌ "Total Profit: ₹52,806.76 for December 3rd to ACCEPTED_JSON"
- ❌ Showing any technical identifiers, codes, or raw data structures

WHAT TO USE (User-Friendly Language):
- ✅ "Customer A - ₹2,300"
- ✅ "Karnataka: Item D, 1 unit, ₹230"
- ✅ "Total profit: ₹52,806.76"
- ✅ Simple, natural business language

EXAMPLES:
GOOD: "Total sales: ₹3,850"
BAD: "Based on the comprehensive analysis of your sales data, I can tell you that the total sales amount comes to approximately $3,850..."

GOOD: "Top 5 customers in November 2025:
| Customer | Revenue | Orders |
|----------|---------|--------|
| Customer A | ₹2,300 | 3 |
| Customer B | ₹1,900 | 2 |
| Customer C | ₹1,500 | 1 |
| Customer D | ₹1,200 | 2 |
| Customer E | ₹800 | 1 |"

BAD: "1. Customer A with ID: 206, GST No.: 29ABCDE1234F1ZR, Pincode: 560061"

BAD: "- Customer A with revenue of ₹83,076.42 in total profit and orders placed on December 1st and March 3rd. Customer B generating a steady stream since their first recorded sale..."

GOOD: "Regional sales:
- Karnataka: ₹5,200
- Maharashtra: ₹3,100"
BAD: "{category: "Other", item: "Item D", quantity: 1, amount: 230, region: "Karnataka"}"

CRITICAL - STOP GENERATING UNRELATED CONTENT:
- If asked "top 5 customers", answer with ONLY a TABLE showing the list - do NOT write paragraphs or verbose descriptions
- Use TABLE format for any list: top customers, top products, regional sales, etc.
- If the question seems unclear or contains multiple unrelated parts, answer ONLY the sales data question and ignore the rest
- NEVER generate content about: SQLAlchemy, Python code, academic research, educational studies, or any topic unrelated to sales data
- If you see unrelated content in the question, IGNORE it and answer ONLY the sales data part
- STOP immediately after providing the answer - do not continue with explanations, examples, or other topics
- Maximum response length: Keep responses under 200 words. If the answer is a table or simple list, it should be much shorter
- If the user's question contains unrelated text (like academic papers, research questions, etc.), extract ONLY the sales data question and answer that
- Example: If user asks "top 5 customers" followed by unrelated text, answer ONLY a table with "Top 5 customers" and STOP
- NEVER write paragraph-style descriptions for lists - ALWAYS use table format for structured data

GOOD: "Top 5 customers:
1. Customer A - ₹2,300
2. Customer B - ₹1,900
3. Customer C - ₹1,500
4. Customer D - ₹1,200
5. Customer E - ₹800"
BAD: "1. Customer A and Bharathi (9)
2. D-Link Technologies Pvt. Ltd.
3. How many different types of items were sold? What is the total revenue from each customer, summed over all regions for a given period in FY 2024 was Rs. 15 lakh; how can I retrieve this information using SQLAlchemy..."

CRITICAL: If the question is unclear or seems unrelated to sales data, respond with: "I can help you analyze your sales data. Could you clarify your question?" DO NOT generate long, rambling responses about unrelated topics.

COMPLETE SALES DATA (${salesData?.length || 0} records):
${salesDataStr}

METRICS:
${JSON.stringify(metrics, null, 2)}

CONVERSATION CONTEXT:
${JSON.stringify(conversationContext, null, 2)}

Analyze the user's query and provide a CONCISE, USER-FRIENDLY answer based on the data above. 

CRITICAL REMINDERS:
1. Use ₹ for ALL monetary values - NEVER use $ or dollars
2. Answer ONLY what is asked - be EXTREMELY concise and direct (typically 1-3 sentences or a simple list)
3. STOP immediately after answering - do not continue with unrelated topics
4. If the question is unclear or unrelated to sales data, say: "I can help you analyze your sales data. Could you clarify your question?"
5. Do not add unnecessary explanations or stories
6. The currency is ALWAYS ₹ (Indian Rupees) - the country field confirms this
7. Use NATURAL, BUSINESS-FRIENDLY language - write for business users, NOT developers
8. NEVER show technical details: IDs, GST numbers, pincodes, JSON formats, or raw data structures
9. Format responses in a clean, readable way that common users can easily understand
10. NEVER generate content about unrelated topics (academic research, SQLAlchemy, Python, etc.) - ONLY answer questions about the sales data provided`;

      // Build conversation history
      const conversationHistory = payload.messages.slice(-10); // Last 10 messages for context
      
      // Send to LLM at 127.0.0.1:11434
      const llmUrl = 'http://127.0.0.1:11434/api/chat';
      
      // Try to detect available model, fallback to common models
      const modelsToTry = ['llama2', 'llama3', 'mistral', 'phi', 'gemma'];
      let requestBody = {
        model: modelsToTry[0], // Start with first model
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          ...conversationHistory,
          {
            role: 'user',
            content: currentQuery
          }
        ],
        stream: false
      };

      console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(llmUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📥 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ LLM API error response:', errorText);
        
        // If model not found, try to list available models
        if (response.status === 404 || errorText.includes('model') || errorText.includes('not found')) {
          console.log('🔍 Attempting to list available models...');
          try {
            const modelsResponse = await fetch('http://127.0.0.1:11434/api/tags');
            if (modelsResponse.ok) {
              const modelsData = await modelsResponse.json();
              console.log('📋 Available models:', modelsData);
              if (modelsData.models && modelsData.models.length > 0) {
                const firstModel = modelsData.models[0].name;
                console.log(`🔄 Retrying with model: ${firstModel}`);
                // Retry with first available model
                requestBody.model = firstModel;
                const retryResponse = await fetch(llmUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(requestBody)
                });
                if (retryResponse.ok) {
                  const retryData = await retryResponse.json();
                  // Process retry response (will be handled below)
                  const data = retryData;
                  let responseText = '';
                  
                  if (data.message && data.message.content) {
                    responseText = data.message.content;
                  } else if (data.response) {
                    responseText = data.response;
                  } else if (typeof data === 'string') {
                    responseText = data;
                  } else {
                    throw new Error('Unexpected LLM response format');
                  }

                  // Aggressively correct currency in retry response to match detected currency
                  const hasRupeeSymbolRetry = responseText.includes('₹');
                  const hasDollarSymbolRetry = responseText.includes('$');
                  
                  if (detectedCurrency === '₹' && hasDollarSymbolRetry) {
                    console.log('⚠️ Currency correction in retry: Data is in ₹ but LLM used $. Correcting all $ to ₹...');
                    // Replace $ symbols with ₹ (handle various formats)
                    responseText = responseText.replace(/\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g, '₹$1');
                    responseText = responseText.replace(/\$(\d+)/g, '₹$1');
                    responseText = responseText.replace(/\$\s*(\d)/g, '₹$1');
                    // Replace dollar text with rupee/₹
                    responseText = responseText.replace(/(\d+)\s*dollars?/gi, '$1 rupees');
                    responseText = responseText.replace(/dollars?\s*(\d+)/gi, '₹$1');
                    responseText = responseText.replace(/\bdollars?\b/gi, 'rupees');
                    // Replace USD with INR or ₹
                    responseText = responseText.replace(/\bUSD\b/gi, 'INR');
                    responseText = responseText.replace(/\bUS\s*Dollars?\b/gi, 'Indian Rupees');
                  } else if (detectedCurrency === '$' && hasRupeeSymbolRetry) {
                    console.log('⚠️ Currency correction in retry: Data is in $ but LLM used ₹. Correcting all ₹ to $...');
                    // Replace ₹ symbols with $ (handle various formats)
                    responseText = responseText.replace(/₹(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g, '$$1');
                    responseText = responseText.replace(/₹(\d+)/g, '$$1');
                    responseText = responseText.replace(/₹\s*(\d)/g, '$$1');
                    // Replace rupee text with dollar
                    responseText = responseText.replace(/(\d+)\s*rupees?/gi, '$1 dollars');
                    responseText = responseText.replace(/rupees?\s*(\d+)/gi, '$$1');
                    responseText = responseText.replace(/\brupees?\b/gi, 'dollars');
                    // Replace INR with USD
                    responseText = responseText.replace(/\bINR\b/gi, 'USD');
                    responseText = responseText.replace(/\bIndian\s*Rupees?\b/gi, 'US Dollars');
                  }

                  // Clean up confusing currency formats in retry response
                  const currencyRegexRetry = detectedCurrency === '₹' ? '₹' : '\\$';
                  
                  // Handle formats with commas
                  responseText = responseText.replace(new RegExp(`${currencyRegexRetry}(\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})?)\\s*\\(${currencyRegexRetry}(\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})?)\\)`, 'g'), (match, p1, p2) => {
                    const num1 = parseFloat(p1.replace(/,/g, ''));
                    const num2 = parseFloat(p2.replace(/,/g, ''));
                    if (num2 > num1 * 1.5) {
                      return `${detectedCurrency}${p1} (Profit: ${detectedCurrency}${p2})`;
                    } else {
                      return `${detectedCurrency}${p1}`;
                    }
                  });
                  
                  // Handle cases without commas
                  responseText = responseText.replace(new RegExp(`${currencyRegexRetry}(\\d+)\\s*\\(${currencyRegexRetry}(\\d+)\\)`, 'g'), (match, p1, p2) => {
                    const num1 = parseFloat(p1);
                    const num2 = parseFloat(p2);
                    const formatted1 = detectedCurrency === '₹' 
                      ? parseInt(p1).toLocaleString('en-IN') 
                      : parseInt(p1).toLocaleString('en-US');
                    const formatted2 = detectedCurrency === '₹' 
                      ? parseInt(p2).toLocaleString('en-IN') 
                      : parseInt(p2).toLocaleString('en-US');
                    if (num2 > num1 * 1.5) {
                      return `${detectedCurrency}${formatted1} (Profit: ${detectedCurrency}${formatted2})`;
                    } else {
                      return `${detectedCurrency}${formatted1}`;
                    }
                  });

                  // Post-process to remove unrelated content and ensure concise responses (retry)
                  const unrelatedKeywordsRetry = ['sqlalchemy', 'python', 'academic', 'research paper', 'study', 'abstract', 'methodology', 'literature review', 'peer-reviewed', 'scholarly', 'university', 'phd', 'dissertation', 'thesis'];
                  const responseLowerRetry = responseText.toLowerCase();
                  const hasUnrelatedContentRetry = unrelatedKeywordsRetry.some(keyword => responseLowerRetry.includes(keyword));
                  
                  if (hasUnrelatedContentRetry) {
                    console.log('⚠️ Detected unrelated content in retry response, truncating...');
                    let truncateIndexRetry = responseText.length;
                    for (const keyword of unrelatedKeywordsRetry) {
                      const index = responseLowerRetry.indexOf(keyword);
                      if (index !== -1 && index < truncateIndexRetry) {
                        truncateIndexRetry = index;
                      }
                    }
                    const truncatedRetry = responseText.substring(0, truncateIndexRetry);
                    const lastSentenceEndRetry = Math.max(
                      truncatedRetry.lastIndexOf('.'),
                      truncatedRetry.lastIndexOf('\n'),
                      truncatedRetry.lastIndexOf('!'),
                      truncatedRetry.lastIndexOf('?')
                    );
                    if (lastSentenceEndRetry > 50) {
                      responseText = truncatedRetry.substring(0, lastSentenceEndRetry + 1).trim();
                      console.log('✅ Truncated retry response to remove unrelated content');
                    }
                  }
                  
                  // Enforce maximum length (200 words) for retry response
                  const wordsRetry = responseText.split(/\s+/);
                  if (wordsRetry.length > 200) {
                    console.log('⚠️ Retry response too long, truncating to 200 words...');
                    responseText = wordsRetry.slice(0, 200).join(' ') + '...';
                  }

                  const botMessage = {
                    type: 'bot',
                    text: responseText,
                    timestamp: new Date()
                  };
                  setMessages(prev => [...prev, botMessage]);
                  setIsTyping(false);
                  
                  // Update conversation context
                  const lowerQuery = currentQuery.toLowerCase();
                  if (lowerQuery.includes('sales') && !lowerQuery.includes('customer') && !lowerQuery.includes('product') && !lowerQuery.includes('item')) {
                    setConversationContext(prev => ({
                      ...prev,
                      lastTopic: 'sales',
                      lastDataType: 'transaction'
                    }));
                  } else if (lowerQuery.includes('customer')) {
                    setConversationContext(prev => ({
                      ...prev,
                      lastTopic: 'customer',
                      lastDataType: 'customer'
                    }));
                  } else if (lowerQuery.includes('product') || lowerQuery.includes('item')) {
                    setConversationContext(prev => ({
                      ...prev,
                      lastTopic: 'product',
                      lastDataType: 'product'
                    }));
                  }
                  return; // Exit early on successful retry
                }
              }
            }
          } catch (modelError) {
            console.error('Error fetching available models:', modelError);
          }
        }
        
        throw new Error(`LLM API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ LLM response data:', data);
      
      let responseText = '';
      
      // Handle different Ollama response formats
      if (data.message && data.message.content) {
        responseText = data.message.content;
      } else if (data.response) {
        responseText = data.response;
      } else if (typeof data === 'string') {
        responseText = data;
      } else {
        console.warn('⚠️ Unexpected LLM response format:', data);
        throw new Error('Unexpected LLM response format');
      }

      console.log('💬 LLM response text:', responseText);

      // Aggressively correct currency to match detected currency from data
      // This is a safety net - the LLM should already be using the correct currency from data analysis
      const hasRupeeSymbol = responseText.includes('₹');
      const hasDollarSymbol = responseText.includes('$');
      
      // If detected currency is ₹, aggressively replace ALL $ with ₹ (even if ₹ also appears)
      if (detectedCurrency === '₹' && hasDollarSymbol) {
        console.log('⚠️ Currency correction: Data is in ₹ but LLM used $. Correcting all $ to ₹...');
        // Replace $ symbols with ₹ (handle various formats)
        responseText = responseText.replace(/\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g, '₹$1');
        responseText = responseText.replace(/\$(\d+)/g, '₹$1');
        responseText = responseText.replace(/\$\s*(\d)/g, '₹$1');
        // Replace dollar text with rupee/₹
        responseText = responseText.replace(/(\d+)\s*dollars?/gi, '$1 rupees');
        responseText = responseText.replace(/dollars?\s*(\d+)/gi, '₹$1');
        responseText = responseText.replace(/\bdollars?\b/gi, 'rupees');
        // Replace USD with INR or ₹
        responseText = responseText.replace(/\bUSD\b/gi, 'INR');
        responseText = responseText.replace(/\bUS\s*Dollars?\b/gi, 'Indian Rupees');
      } else if (detectedCurrency === '$' && hasRupeeSymbol) {
        console.log('⚠️ Currency correction: Data is in $ but LLM used ₹. Correcting all ₹ to $...');
        // Replace ₹ symbols with $ (handle various formats)
        responseText = responseText.replace(/₹(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g, '$$1');
        responseText = responseText.replace(/₹(\d+)/g, '$$1');
        responseText = responseText.replace(/₹\s*(\d)/g, '$$1');
        // Replace rupee text with dollar
        responseText = responseText.replace(/(\d+)\s*rupees?/gi, '$1 dollars');
        responseText = responseText.replace(/rupees?\s*(\d+)/gi, '$$1');
        responseText = responseText.replace(/\brupees?\b/gi, 'dollars');
        // Replace INR with USD
        responseText = responseText.replace(/\bINR\b/gi, 'USD');
        responseText = responseText.replace(/\bIndian\s*Rupees?\b/gi, 'US Dollars');
      } else {
        // LLM is using the correct currency
        console.log(`✅ Currency check: LLM response uses ${hasRupeeSymbol ? '₹' : ''}${hasDollarSymbol ? '$' : ''} (detected: ${detectedCurrency})`);
      }

      // Clean up confusing currency formats like "₹2000 (₹31697)" or "$2000 ($31697)"
      // Replace patterns like "currencyX (currencyY)" with clearer formats
      const currencyRegex = detectedCurrency === '₹' ? '₹' : '\\$';
      const currencyNameForLabel = detectedCurrency === '₹' ? 'rupees' : 'dollars';
      
      // Handle formats with commas
      responseText = responseText.replace(new RegExp(`${currencyRegex}(\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})?)\\s*\\(${currencyRegex}(\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})?)\\)`, 'g'), (match, p1, p2) => {
        const num1 = parseFloat(p1.replace(/,/g, ''));
        const num2 = parseFloat(p2.replace(/,/g, ''));
        if (num2 > num1 * 1.5) {
          // Likely showing amount and profit - make it clearer
          return `${detectedCurrency}${p1} (Profit: ${detectedCurrency}${p2})`;
        } else {
          // Unclear what the second number is - just show the first
          return `${detectedCurrency}${p1}`;
        }
      });
      
      // Also handle cases without commas
      responseText = responseText.replace(new RegExp(`${currencyRegex}(\\d+)\\s*\\(${currencyRegex}(\\d+)\\)`, 'g'), (match, p1, p2) => {
        const num1 = parseFloat(p1);
        const num2 = parseFloat(p2);
        const formatted1 = detectedCurrency === '₹' 
          ? parseInt(p1).toLocaleString('en-IN') 
          : parseInt(p1).toLocaleString('en-US');
        const formatted2 = detectedCurrency === '₹' 
          ? parseInt(p2).toLocaleString('en-IN') 
          : parseInt(p2).toLocaleString('en-US');
        if (num2 > num1 * 1.5) {
          return `${detectedCurrency}${formatted1} (Profit: ${detectedCurrency}${formatted2})`;
        } else {
          return `${detectedCurrency}${formatted1}`;
        }
      });

      // Post-process to remove unrelated content and ensure concise responses
      // Check for unrelated topics and truncate if found
      const unrelatedKeywords = ['sqlalchemy', 'python', 'academic', 'research paper', 'study', 'abstract', 'methodology', 'literature review', 'peer-reviewed', 'scholarly', 'university', 'phd', 'dissertation', 'thesis'];
      const responseLower = responseText.toLowerCase();
      const hasUnrelatedContent = unrelatedKeywords.some(keyword => responseLower.includes(keyword));
      
      if (hasUnrelatedContent) {
        console.log('⚠️ Detected unrelated content in response, truncating...');
        // Find the first occurrence of unrelated content and truncate there
        let truncateIndex = responseText.length;
        for (const keyword of unrelatedKeywords) {
          const index = responseLower.indexOf(keyword);
          if (index !== -1 && index < truncateIndex) {
            truncateIndex = index;
          }
        }
        // Truncate at the last sentence before unrelated content
        const truncated = responseText.substring(0, truncateIndex);
        const lastSentenceEnd = Math.max(
          truncated.lastIndexOf('.'),
          truncated.lastIndexOf('\n'),
          truncated.lastIndexOf('!'),
          truncated.lastIndexOf('?')
        );
        if (lastSentenceEnd > 50) { // Only truncate if we have enough content
          responseText = truncated.substring(0, lastSentenceEnd + 1).trim();
          console.log('✅ Truncated response to remove unrelated content');
        }
      }
      
      // Enforce maximum length (200 words)
      const words = responseText.split(/\s+/);
      if (words.length > 200) {
        console.log('⚠️ Response too long, truncating to 200 words...');
        responseText = words.slice(0, 200).join(' ') + '...';
      }

      console.log('💬 Final response text:', responseText);

      const botMessage = {
        type: 'bot',
        text: responseText,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
      
      // Update conversation context based on the query
      const lowerQuery = currentQuery.toLowerCase();
      if (lowerQuery.includes('sales') && !lowerQuery.includes('customer') && !lowerQuery.includes('product') && !lowerQuery.includes('item')) {
        setConversationContext(prev => ({
          ...prev,
          lastTopic: 'sales',
          lastDataType: 'transaction'
        }));
      } else if (lowerQuery.includes('customer')) {
        setConversationContext(prev => ({
          ...prev,
          lastTopic: 'customer',
          lastDataType: 'customer'
        }));
      } else if (lowerQuery.includes('product') || lowerQuery.includes('item')) {
        setConversationContext(prev => ({
          ...prev,
          lastTopic: 'product',
          lastDataType: 'product'
        }));
      }
    } catch (error) {
      console.error('❌ Error calling LLM:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Show error to user
      const errorMessage = {
        type: 'bot',
        text: `⚠️ LLM Error: ${error.message}\n\nFalling back to local processing...`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      // Fallback to local processing if LLM fails
      let response;
      try {
        response = universalQueryEngine(currentQuery, salesData);
      } catch (fallbackError) {
        console.error('❌ Fallback error:', fallbackError);
        response = analyzeQuery(currentQuery);
      }
      
      const botMessage = {
        type: 'bot',
        text: response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #F27020 0%, #000000 100%)',
            border: 'none',
            boxShadow: '0 4px 12px rgba(242, 112, 32, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            transition: 'all 0.3s ease',
            color: 'white'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(242, 112, 32, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(242, 112, 32, 0.4)';
          }}
        >
          <span className="material-icons" style={{ fontSize: '32px' }}>smart_toy</span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '400px',
          height: '600px',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000,
          overflow: 'hidden'
        }}>
          {/* Chat Header */}
          <div style={{
            background: 'linear-gradient(135deg, #F27020 0%, #000000 100%)',
            color: 'white',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="material-icons" style={{ fontSize: '28px' }}>smart_toy</span>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>Sales Assistant</div>
                <div style={{ fontSize: '12px', opacity: 0.9 }}>Ask me about your data</div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span className="material-icons">close</span>
            </button>
          </div>

          {/* Messages Container */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            background: '#f8fafc'
          }}>
            {messages.map((message, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: message.type === 'user' ? 'flex-end' : 'flex-start',
                  gap: '4px'
                }}
              >
                <div style={{
                  maxWidth: '80%',
                  padding: '12px 16px',
                  borderRadius: message.type === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: message.type === 'user' 
                    ? 'linear-gradient(135deg, #F27020 0%, #e85d0f 100%)'
                    : 'white',
                  color: message.type === 'user' ? 'white' : '#1e293b',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {message.text}
                </div>
                <span style={{
                  fontSize: '11px',
                  color: '#94a3b8',
                  paddingLeft: message.type === 'user' ? '0' : '8px',
                  paddingRight: message.type === 'user' ? '8px' : '0'
                }}>
                  {formatTime(message.timestamp)}
                </span>
              </div>
            ))}
            
            {isTyping && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '4px'
              }}>
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '16px 16px 16px 4px',
                  background: 'white',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  display: 'flex',
                  gap: '4px'
                }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#94a3b8',
                    animation: 'bounce 1.4s infinite ease-in-out both',
                    animationDelay: '-0.32s'
                  }}></span>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#94a3b8',
                    animation: 'bounce 1.4s infinite ease-in-out both',
                    animationDelay: '-0.16s'
                  }}></span>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#94a3b8',
                    animation: 'bounce 1.4s infinite ease-in-out both'
                  }}></span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div style={{
            padding: '16px 20px',
            borderTop: '1px solid #e2e8f0',
            background: 'white'
          }}>
            <div style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-end'
            }}>
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about your sales..."
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  resize: 'none',
                  minHeight: '44px',
                  maxHeight: '120px',
                  fontFamily: 'inherit',
                  outline: 'none'
                }}
                rows={1}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim()}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  background: inputValue.trim() 
                    ? 'linear-gradient(135deg, #F27020 0%, #000000 100%)'
                    : '#e2e8f0',
                  color: 'white',
                  cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '44px',
                  transition: 'all 0.2s ease'
                }}
              >
                <span className="material-icons">send</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bounce Animation for Typing Indicator */}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-8px); }
        }
      `}</style>
    </>
  );
};

export default ChatBot;
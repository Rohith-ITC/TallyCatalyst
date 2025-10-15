// Module configuration with sequence and permissions
export const MODULE_SEQUENCE = [
    {
        key             : 'main_menu',
        id              : 'main',
        label           : 'Main Menu',
        icon            : 'home',
        alwaysVisible   : true,
        permissions     : {}
    },
    
    {
      key               : 'place_order',
      id                : 'order',
      label             : 'Place Order',
      icon              : 'shopping_cart',
      permissions       : {
        save_optional         : 'save_optional',
        show_payterms         : 'show_payterms',
        show_delvterms        : 'show_delvterms',
        show_rateamt_Column   : 'show_rateamt_Column',
        edit_rate             : 'edit_rate',
        show_disc_Column      : 'show_disc_Column',
        edit_discount         : 'edit_discount',
        show_clsstck_Column   : 'show_ClsStck_Column',
        show_clsstck_yesno    : 'show_ClsStck_yesno',
        show_godownbrkup      : 'show_godownbrkup',
        show_multicobrkup     : 'show_multicobrkup',
        show_itemdesc         : 'show_itemdesc',
        show_itemshasqty      : 'show_itemshasqty',
        def_qty               : 'def_qty',
        show_batches          : 'show_batches',
        show_pricelvl         : 'show_pricelvl',
        def_orderduedays      : 'def_orderduedays',
        show_ordduedate       : 'show_ordduedate',
        show_ordershare       : 'show_ordershare',
        show_creditdayslimit  : 'show_creditdayslimit',
        ctrl_creditdayslimit  : 'ctrl_creditdayslimit'
      }

    },
    {
      key           : 'ecommerce_place_order',
      id            : 'ecommerce',
      label         : 'E-Commerce Place Order',
      icon          : 'storefront',
      permissions   : {
        save_optional         : 'save_optional',
        show_payterms         : 'show_payterms',
        show_delvterms        : 'show_delvterms',
        show_rateamt_Column   : 'show_rateamt_Column',
        edit_rate             : 'edit_rate',
        show_disc_Column      : 'show_disc_Column',
        edit_discount         : 'edit_discount',
        show_clsstck_Column   : 'show_ClsStck_Column',
        show_clsstck_yesno    : 'show_ClsStck_yesno',
        show_godownbrkup      : 'show_godownbrkup',
        show_multicobrkup     : 'show_multicobrkup',
        show_itemdesc         : 'show_itemdesc',
        show_itemshasqty      : 'show_itemshasqty',
        show_image            : 'show_image',
        def_qty               : 'def_qty',
        show_batches          : 'show_batches',
        show_pricelvl         : 'show_pricelvl',
        def_orderduedays      : 'def_orderduedays',
        show_ordduedate       : 'show_ordduedate',
        show_ordershare       : 'show_ordershare',
        show_creditdayslimit  : 'show_creditdayslimit',
        ctrl_creditdayslimit  : 'ctrl_creditdayslimit'

        //edit_rate           : 'edit_rate',
        //edit_discount       : 'edit_discount',
        //show_closing_stock  : 'show_ClsStck_Column',
        //show_available_stock: 'show_ClsStck'
      }
    },
    {
      key               : 'sales_dashboard',
      id                : 'sales_dashboard',
      label             : 'Sales Dashboard',
      icon              : 'analytics'/*,
      permissions       : {
        view            : 'view_sales_dashboard',
        export          : 'export_sales_dashboard'
      }*/
    },
    {
      key               : 'ledger_book',
      id                : 'ledger',
      label             : 'Ledger Book',
      icon              : 'menu_book',
      hasSubModules     : true,
      useDropdownFilter : true,
      subModules: [
        {
          key           : 'ledger_voucher',
          id            : 'ledgerwise',
          label         : 'Ledger Vouchers',
          icon          : 'assessment',
          permissions   : {
            view        : 'view_ledgerwise',
            export      : 'export_ledgerwise',
            print       : 'print_ledgerwise'
          }
        },
        {
          key           : 'bill_wise_report',
          id            : 'billwise', 
          label         : 'Bill wise O/s',
          icon          : 'receipt',
          permissions   : {
            view        : 'view_billwise',
            export      : 'export_billwise',
            print       : 'print_billwise'
          }
        }
      ],
      permissions: {}
    }
    
  ];
  
// Permission checking functions
export const hasModuleAccess = (moduleKey, userModules) => {
  return userModules.some(userModule => userModule.module_name === moduleKey);
};
  
  export const hasAnySubModuleAccess = (moduleKey, userModules) => {
    const module = MODULE_SEQUENCE.find(m => m.key === moduleKey);
    if (!module || !module.hasSubModules) return false;
    
    return module.subModules.some(subModule => 
      userModules.some(userModule => userModule.module_name === subModule.key)
    );
  };
  
  export const hasSubModuleAccess = (subModuleKey, userModules) => {
    return userModules.some(userModule => userModule.module_name === subModuleKey);
  };
  
  export const hasPermission = (moduleKey, permissionKey, userModules) => {
    const userModule = userModules.find(m => m.module_name === moduleKey);
    if (!userModule) return false;
    
    return userModule.permissions?.some(perm => 
      perm.permission_key === permissionKey && perm.granted
    );
  };

  // Get permission value (for permissions that have values like def_qty)
  export const getPermissionValue = (moduleKey, permissionKey, userModules) => {
    const userModule = userModules.find(m => m.module_name === moduleKey);
    if (!userModule) return null;
    
    const permission = userModule.permissions?.find(perm => 
      perm.permission_key === permissionKey && perm.granted
    );
    
    return permission?.permission_value || null;
  };
  
  export const hasSubModulePermission = (subModuleKey, permissionKey, userModules) => {
    const userModule = userModules.find(m => m.module_name === subModuleKey);
    if (!userModule) return false;
    
    return userModule.permissions?.some(perm => 
      perm.permission_key === permissionKey && perm.granted
    );
  };
  
  // Get modules in sequence order
  export const getModulesInSequence = () => MODULE_SEQUENCE;
  
// Get user modules from session storage
export const getUserModules = () => {
  const userAccess = JSON.parse(sessionStorage.getItem('userAccessPermissions') || '{}');
  return userAccess.data?.modules || [];
};

// Get dropdown filter options for a module (when useDropdownFilter is true)
export const getDropdownFilterOptions = (moduleKey, userModules) => {
  const module = MODULE_SEQUENCE.find(m => m.key === moduleKey);
  
  if (!module || !module.useDropdownFilter || !module.hasSubModules) {
    return [];
  }
  
  // Return only the sub-modules that the user has access to
  return module.subModules.filter(subModule => 
    hasSubModuleAccess(subModule.key, userModules)
  );
};

// Check if a module should use dropdown filter instead of sub-menu
export const shouldUseDropdownFilter = (moduleKey) => {
  const module = MODULE_SEQUENCE.find(m => m.key === moduleKey);
  return module?.useDropdownFilter === true;
};

// Check if a module should always be visible without permission validation
export const isAlwaysVisible = (moduleKey) => {
  const module = MODULE_SEQUENCE.find(m => m.key === moduleKey);
  return module?.alwaysVisible === true;
};
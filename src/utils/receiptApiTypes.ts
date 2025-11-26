// TypeScript type definitions for receipt API

export interface Company {
  tallyloc_id: number;
  conn_name: string;
  company: string;
  guid: string;
  address?: string;
  pincode?: string;
  statename?: string;
  countryname?: string;
  email?: string;
  phonenumber?: string;
  mobilenumbers?: string;
  gstinno?: string;
  startingfrom?: string;
  booksfrom?: string;
  shared_email?: string;
  status?: string;
  access_type?: string;
  createdAt?: string;
}

export interface ReceiptVoucher {
  MasterID?: string;
  Dates?: string;
  InvNo?: string;
  VoucherType?: string;
  Customer?: string;
  Bank?: string;
  Amount?: string;
  Narration?: string;
}

export interface CompanyOrder {
  Date?: string;
  DueDate?: string;
  OrderNo?: string;
  StockItem?: string;
  Customer?: string;
  OrderQty?: string;
  PendingQty?: string;
  AvailableQty?: string;
  TotalPendingOrders?: string;
  Location?: string;
  Batch?: string;
  Rate?: string;
  Discount?: string;
  IsGodownOn?: string;
  IsBatchesOn?: string;
}


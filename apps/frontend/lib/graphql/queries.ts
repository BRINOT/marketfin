import { gql } from '@apollo/client';

// Dashboard KPIs
export const GET_DASHBOARD_KPIS = gql`
  query GetDashboardKPIs {
    getDashboardKPIs {
      today {
        revenue
        profit
        orders
      }
      thisMonth {
        revenue
        profit
        orders
      }
      lastMonth {
        revenue
        profit
        orders
      }
      growth {
        revenue
        profit
        orders
      }
    }
  }
`;

// Profit Report
export const GET_PROFIT_REPORT = gql`
  query GetProfitReport($filters: ProfitFiltersInput!) {
    getProfitReport(filters: $filters) {
      totalRevenue
      totalFees
      totalShipping
      totalTaxes
      totalCost
      netProfit
      profitMargin
      totalOrders
      items {
        label
        revenue
        profit
        margin
        orders
        fees
        taxes
        shipping
        productCost
      }
    }
  }
`;

// Integrations
export const GET_INTEGRATIONS = gql`
  query GetIntegrations {
    getIntegrations {
      id
      marketplace
      status
      sellerId
      lastSyncAt
      syncError
      createdAt
      updatedAt
    }
  }
`;

export const GET_INTEGRATION_STATUS = gql`
  query GetIntegrationStatus($marketplace: Marketplace!) {
    getIntegrationStatus(marketplace: $marketplace) {
      id
      marketplace
      status
      sellerId
      lastSyncAt
      syncError
    }
  }
`;

// Orders
export const GET_ORDERS = gql`
  query GetOrders($filters: OrderFiltersInput) {
    getOrders(filters: $filters) {
      orders {
        id
        marketplace
        marketplaceOrderId
        status
        orderDate
        totalAmount
        fees
        shippingCost
        taxes
        productCost
        netProfit
        profitMargin
        customerName
        trackingCode
        items {
          id
          sku
          name
          quantity
          unitPrice
          unitCost
          totalPrice
        }
        refunds {
          id
          refundDate
          amount
          reason
          status
        }
        createdAt
      }
      total
      page
      limit
      totalPages
    }
  }
`;

export const GET_ORDER = gql`
  query GetOrder($id: String!) {
    getOrder(id: $id) {
      id
      marketplace
      marketplaceOrderId
      status
      orderDate
      totalAmount
      fees
      shippingCost
      taxes
      productCost
      netProfit
      profitMargin
      customerName
      trackingCode
      items {
        id
        sku
        name
        quantity
        unitPrice
        unitCost
        totalPrice
      }
      refunds {
        id
        refundDate
        amount
        reason
        status
      }
      createdAt
    }
  }
`;

export const GET_ORDER_STATS = gql`
  query GetOrderStats {
    getOrderStats {
      totalOrders
      pendingOrders
      shippedOrders
      deliveredOrders
      cancelledOrders
    }
  }
`;

// Products
export const GET_PRODUCTS = gql`
  query GetProducts($filters: ProductFiltersInput) {
    getProducts(filters: $filters) {
      products {
        id
        sku
        name
        description
        costPrice
        salePrice
        stock
        weight
        isActive
        marketplaceProducts {
          id
          marketplace
          externalId
          listingUrl
          lastSyncAt
        }
        createdAt
        updatedAt
      }
      total
      page
      limit
      totalPages
    }
  }
`;

export const GET_PRODUCT = gql`
  query GetProduct($id: String!) {
    getProduct(id: $id) {
      id
      sku
      name
      description
      costPrice
      salePrice
      stock
      weight
      isActive
      marketplaceProducts {
        id
        marketplace
        externalId
        listingUrl
        lastSyncAt
      }
      createdAt
      updatedAt
    }
  }
`;

// User
export const GET_ME = gql`
  query GetMe {
    me {
      id
      email
      firstName
      lastName
      role
      tenantId
      isActive
      lastLoginAt
      createdAt
    }
  }
`;

import { gql } from '@apollo/client';

// Integration mutations
export const CONNECT_MARKETPLACE = gql`
  mutation ConnectMarketplace($marketplace: Marketplace!) {
    connectMarketplace(marketplace: $marketplace) {
      authUrl
      state
    }
  }
`;

export const DISCONNECT_MARKETPLACE = gql`
  mutation DisconnectMarketplace($marketplace: Marketplace!) {
    disconnectMarketplace(marketplace: $marketplace)
  }
`;

export const SYNC_ORDERS = gql`
  mutation SyncOrders($marketplace: Marketplace!, $startDate: DateTime!, $endDate: DateTime!) {
    syncOrders(marketplace: $marketplace, startDate: $startDate, endDate: $endDate) {
      success
      ordersImported
      errors
    }
  }
`;

// Order mutations
export const UPDATE_ORDER_STATUS = gql`
  mutation UpdateOrderStatus($id: String!, $status: OrderStatus!) {
    updateOrderStatus(id: $id, status: $status) {
      id
      status
    }
  }
`;

export const CREATE_REFUND = gql`
  mutation CreateRefund($orderId: String!, $amount: Float!, $reason: String) {
    createRefund(orderId: $orderId, amount: $amount, reason: $reason) {
      id
      refunds {
        id
        refundDate
        amount
        reason
        status
      }
    }
  }
`;

// Product mutations
export const CREATE_PRODUCT = gql`
  mutation CreateProduct($input: CreateProductInputType!) {
    createProduct(input: $input) {
      id
      sku
      name
      costPrice
      salePrice
      stock
    }
  }
`;

export const UPDATE_PRODUCT = gql`
  mutation UpdateProduct($id: String!, $input: UpdateProductInputType!) {
    updateProduct(id: $id, input: $input) {
      id
      sku
      name
      costPrice
      salePrice
      stock
      isActive
    }
  }
`;

export const DELETE_PRODUCT = gql`
  mutation DeleteProduct($id: String!) {
    deleteProduct(id: $id)
  }
`;

export const LINK_PRODUCT_TO_MARKETPLACE = gql`
  mutation LinkProductToMarketplace(
    $productId: String!
    $marketplace: Marketplace!
    $externalId: String!
    $listingUrl: String
  ) {
    linkProductToMarketplace(
      productId: $productId
      marketplace: $marketplace
      externalId: $externalId
      listingUrl: $listingUrl
    ) {
      id
      marketplaceProducts {
        id
        marketplace
        externalId
        listingUrl
      }
    }
  }
`;

export const BULK_IMPORT_PRODUCTS = gql`
  mutation BulkImportProducts($products: [CreateProductInputType!]!) {
    bulkImportProducts(products: $products) {
      imported
      errors
    }
  }
`;

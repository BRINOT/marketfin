import {
  Resolver,
  Query,
  Mutation,
  Args,
  ObjectType,
  Field,
  ID,
  Float,
  Int,
  InputType,
  registerEnumType,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { OrderService, PaginatedOrders } from './order.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { OrderStatus, Marketplace } from '@prisma/client';

// Register enums
registerEnumType(OrderStatus, {
  name: 'OrderStatus',
  description: 'Order status',
});

// Types
@ObjectType()
class OrderItemType {
  @Field(() => ID)
  id: string;

  @Field()
  sku: string;

  @Field()
  name: string;

  @Field(() => Int)
  quantity: number;

  @Field(() => Float)
  unitPrice: number;

  @Field(() => Float)
  unitCost: number;

  @Field(() => Float)
  totalPrice: number;
}

@ObjectType()
class RefundType {
  @Field(() => ID)
  id: string;

  @Field()
  refundDate: Date;

  @Field(() => Float)
  amount: number;

  @Field({ nullable: true })
  reason?: string;

  @Field()
  status: string;
}

@ObjectType()
class OrderType {
  @Field(() => ID)
  id: string;

  @Field(() => Marketplace)
  marketplace: Marketplace;

  @Field()
  marketplaceOrderId: string;

  @Field(() => OrderStatus)
  status: OrderStatus;

  @Field()
  orderDate: Date;

  @Field(() => Float)
  totalAmount: number;

  @Field(() => Float)
  fees: number;

  @Field(() => Float)
  shippingCost: number;

  @Field(() => Float)
  taxes: number;

  @Field(() => Float)
  productCost: number;

  @Field(() => Float)
  netProfit: number;

  @Field(() => Float)
  profitMargin: number;

  @Field({ nullable: true })
  customerName?: string;

  @Field({ nullable: true })
  trackingCode?: string;

  @Field(() => [OrderItemType])
  items: OrderItemType[];

  @Field(() => [RefundType])
  refunds: RefundType[];

  @Field()
  createdAt: Date;
}

@ObjectType()
class PaginatedOrdersType {
  @Field(() => [OrderType])
  orders: OrderType[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  totalPages: number;
}

@ObjectType()
class OrderStatsType {
  @Field(() => Int)
  totalOrders: number;

  @Field(() => Int)
  pendingOrders: number;

  @Field(() => Int)
  shippedOrders: number;

  @Field(() => Int)
  deliveredOrders: number;

  @Field(() => Int)
  cancelledOrders: number;
}

// Inputs
@InputType()
class OrderFiltersInput {
  @Field({ nullable: true })
  startDate?: Date;

  @Field({ nullable: true })
  endDate?: Date;

  @Field(() => [OrderStatus], { nullable: true })
  status?: OrderStatus[];

  @Field(() => [Marketplace], { nullable: true })
  marketplace?: Marketplace[];

  @Field({ nullable: true })
  search?: string;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  page?: number;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  limit?: number;
}

@Resolver(() => OrderType)
export class OrderResolver {
  constructor(private orderService: OrderService) {}

  @Query(() => PaginatedOrdersType, { name: 'getOrders' })
  @UseGuards(AuthGuard)
  async getOrders(
    @Args('filters', { nullable: true }) filters: OrderFiltersInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedOrders> {
    const result = await this.orderService.getOrders({
      tenantId: user.tenantId,
      ...filters,
    });

    return {
      orders: result.orders.map((order) => ({
        ...order,
        totalAmount: order.totalAmount.toNumber(),
        fees: order.fees.toNumber(),
        shippingCost: order.shippingCost.toNumber(),
        taxes: order.taxes.toNumber(),
        productCost: order.productCost.toNumber(),
        netProfit: order.netProfit.toNumber(),
        profitMargin: order.profitMargin.toNumber(),
        items: (order as any).items?.map((item: any) => ({
          ...item,
          unitPrice: item.unitPrice.toNumber(),
          unitCost: item.unitCost.toNumber(),
          totalPrice: item.totalPrice.toNumber(),
        })) || [],
        refunds: (order as any).refunds?.map((refund: any) => ({
          ...refund,
          amount: refund.amount.toNumber(),
        })) || [],
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  @Query(() => OrderType, { name: 'getOrder' })
  @UseGuards(AuthGuard)
  async getOrder(
    @Args('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrderType> {
    const order = await this.orderService.getOrderById(id, user.tenantId);

    return {
      ...order,
      totalAmount: order.totalAmount.toNumber(),
      fees: order.fees.toNumber(),
      shippingCost: order.shippingCost.toNumber(),
      taxes: order.taxes.toNumber(),
      productCost: order.productCost.toNumber(),
      netProfit: order.netProfit.toNumber(),
      profitMargin: order.profitMargin.toNumber(),
      items: (order as any).items?.map((item: any) => ({
        ...item,
        unitPrice: item.unitPrice.toNumber(),
        unitCost: item.unitCost.toNumber(),
        totalPrice: item.totalPrice.toNumber(),
      })) || [],
      refunds: (order as any).refunds?.map((refund: any) => ({
        ...refund,
        amount: refund.amount.toNumber(),
      })) || [],
    };
  }

  @Query(() => OrderStatsType, { name: 'getOrderStats' })
  @UseGuards(AuthGuard)
  async getOrderStats(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrderStatsType> {
    return this.orderService.getOrderStats(user.tenantId);
  }

  @Mutation(() => OrderType, { name: 'updateOrderStatus' })
  @UseGuards(AuthGuard)
  async updateOrderStatus(
    @Args('id') id: string,
    @Args('status', { type: () => OrderStatus }) status: OrderStatus,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrderType> {
    const order = await this.orderService.updateOrderStatus(id, user.tenantId, status);

    return {
      ...order,
      totalAmount: order.totalAmount.toNumber(),
      fees: order.fees.toNumber(),
      shippingCost: order.shippingCost.toNumber(),
      taxes: order.taxes.toNumber(),
      productCost: order.productCost.toNumber(),
      netProfit: order.netProfit.toNumber(),
      profitMargin: order.profitMargin.toNumber(),
      items: [],
      refunds: [],
    };
  }

  @Mutation(() => OrderType, { name: 'createRefund' })
  @UseGuards(AuthGuard)
  async createRefund(
    @Args('orderId') orderId: string,
    @Args('amount', { type: () => Float }) amount: number,
    @Args('reason', { nullable: true }) reason: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrderType> {
    const order = await this.orderService.createRefund(
      orderId,
      user.tenantId,
      amount,
      reason,
    );

    return {
      ...order,
      totalAmount: order.totalAmount.toNumber(),
      fees: order.fees.toNumber(),
      shippingCost: order.shippingCost.toNumber(),
      taxes: order.taxes.toNumber(),
      productCost: order.productCost.toNumber(),
      netProfit: order.netProfit.toNumber(),
      profitMargin: order.profitMargin.toNumber(),
      items: (order as any).items?.map((item: any) => ({
        ...item,
        unitPrice: item.unitPrice.toNumber(),
        unitCost: item.unitCost.toNumber(),
        totalPrice: item.totalPrice.toNumber(),
      })) || [],
      refunds: (order as any).refunds?.map((refund: any) => ({
        ...refund,
        amount: refund.amount.toNumber(),
      })) || [],
    };
  }
}

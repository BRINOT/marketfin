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
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ProductService, CreateProductInput, UpdateProductInput } from './product.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { Marketplace, UserRole } from '@prisma/client';

// Types
@ObjectType()
class MarketplaceProductType {
  @Field(() => ID)
  id: string;

  @Field(() => Marketplace)
  marketplace: Marketplace;

  @Field()
  externalId: string;

  @Field({ nullable: true })
  listingUrl?: string;

  @Field({ nullable: true })
  lastSyncAt?: Date;
}

@ObjectType()
class ProductType {
  @Field(() => ID)
  id: string;

  @Field()
  sku: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Float)
  costPrice: number;

  @Field(() => Float)
  salePrice: number;

  @Field(() => Int)
  stock: number;

  @Field(() => Float, { nullable: true })
  weight?: number;

  @Field()
  isActive: boolean;

  @Field(() => [MarketplaceProductType])
  marketplaceProducts: MarketplaceProductType[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
class PaginatedProductsType {
  @Field(() => [ProductType])
  products: ProductType[];

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
class BulkImportResultType {
  @Field(() => Int)
  imported: number;

  @Field(() => [String])
  errors: string[];
}

// Inputs
@InputType()
class CreateProductInputType {
  @Field()
  sku: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Float)
  costPrice: number;

  @Field(() => Float)
  salePrice: number;

  @Field(() => Int, { nullable: true })
  stock?: number;

  @Field(() => Float, { nullable: true })
  weight?: number;
}

@InputType()
class UpdateProductInputType {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Float, { nullable: true })
  costPrice?: number;

  @Field(() => Float, { nullable: true })
  salePrice?: number;

  @Field(() => Int, { nullable: true })
  stock?: number;

  @Field(() => Float, { nullable: true })
  weight?: number;

  @Field({ nullable: true })
  isActive?: boolean;
}

@InputType()
class ProductFiltersInput {
  @Field({ nullable: true })
  search?: string;

  @Field({ nullable: true })
  isActive?: boolean;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  page?: number;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  limit?: number;
}

@Resolver(() => ProductType)
export class ProductResolver {
  constructor(private productService: ProductService) {}

  @Query(() => PaginatedProductsType, { name: 'getProducts' })
  @UseGuards(AuthGuard)
  async getProducts(
    @Args('filters', { nullable: true }) filters: ProductFiltersInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedProductsType> {
    const result = await this.productService.getProducts({
      tenantId: user.tenantId,
      ...filters,
    });

    return {
      products: result.products.map((product) => ({
        ...product,
        costPrice: product.costPrice.toNumber(),
        salePrice: product.salePrice.toNumber(),
        weight: product.weight?.toNumber(),
        marketplaceProducts: (product as any).marketplaceProducts || [],
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  @Query(() => ProductType, { name: 'getProduct' })
  @UseGuards(AuthGuard)
  async getProduct(
    @Args('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProductType> {
    const product = await this.productService.getProductById(id, user.tenantId);

    return {
      ...product,
      costPrice: product.costPrice.toNumber(),
      salePrice: product.salePrice.toNumber(),
      weight: product.weight?.toNumber(),
      marketplaceProducts: (product as any).marketplaceProducts || [],
    };
  }

  @Mutation(() => ProductType, { name: 'createProduct' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async createProduct(
    @Args('input') input: CreateProductInputType,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProductType> {
    const product = await this.productService.createProduct(user.tenantId, input);

    return {
      ...product,
      costPrice: product.costPrice.toNumber(),
      salePrice: product.salePrice.toNumber(),
      weight: product.weight?.toNumber(),
      marketplaceProducts: [],
    };
  }

  @Mutation(() => ProductType, { name: 'updateProduct' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async updateProduct(
    @Args('id') id: string,
    @Args('input') input: UpdateProductInputType,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProductType> {
    const product = await this.productService.updateProduct(id, user.tenantId, input);

    return {
      ...product,
      costPrice: product.costPrice.toNumber(),
      salePrice: product.salePrice.toNumber(),
      weight: product.weight?.toNumber(),
      marketplaceProducts: [],
    };
  }

  @Mutation(() => Boolean, { name: 'deleteProduct' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteProduct(
    @Args('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<boolean> {
    return this.productService.deleteProduct(id, user.tenantId);
  }

  @Mutation(() => ProductType, { name: 'linkProductToMarketplace' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async linkProductToMarketplace(
    @Args('productId') productId: string,
    @Args('marketplace', { type: () => Marketplace }) marketplace: Marketplace,
    @Args('externalId') externalId: string,
    @Args('listingUrl', { nullable: true }) listingUrl: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProductType> {
    const product = await this.productService.linkToMarketplace(
      productId,
      user.tenantId,
      marketplace,
      externalId,
      listingUrl,
    );

    return {
      ...product,
      costPrice: product.costPrice.toNumber(),
      salePrice: product.salePrice.toNumber(),
      weight: product.weight?.toNumber(),
      marketplaceProducts: (product as any).marketplaceProducts || [],
    };
  }

  @Mutation(() => BulkImportResultType, { name: 'bulkImportProducts' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async bulkImportProducts(
    @Args('products', { type: () => [CreateProductInputType] }) products: CreateProductInputType[],
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BulkImportResultType> {
    return this.productService.bulkImport(user.tenantId, products);
  }
}

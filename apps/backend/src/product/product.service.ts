import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Product, Marketplace, Prisma } from '@prisma/client';

export interface CreateProductInput {
  sku: string;
  name: string;
  description?: string;
  costPrice: number;
  salePrice: number;
  stock?: number;
  weight?: number;
  dimensions?: { length: number; width: number; height: number };
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  costPrice?: number;
  salePrice?: number;
  stock?: number;
  weight?: number;
  dimensions?: { length: number; width: number; height: number };
  isActive?: boolean;
}

export interface ProductFilters {
  tenantId: string;
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new product
   */
  async createProduct(tenantId: string, input: CreateProductInput): Promise<Product> {
    // Check if SKU already exists
    const existing = await this.prisma.product.findUnique({
      where: {
        tenantId_sku: {
          tenantId,
          sku: input.sku,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Product with SKU ${input.sku} already exists`);
    }

    return this.prisma.product.create({
      data: {
        tenantId,
        sku: input.sku,
        name: input.name,
        description: input.description,
        costPrice: input.costPrice,
        salePrice: input.salePrice,
        stock: input.stock || 0,
        weight: input.weight,
        dimensions: input.dimensions,
      },
    });
  }

  /**
   * Update a product
   */
  async updateProduct(
    id: string,
    tenantId: string,
    input: UpdateProductInput,
  ): Promise<Product> {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.product.update({
      where: { id },
      data: input,
    });
  }

  /**
   * Delete a product
   */
  async deleteProduct(id: string, tenantId: string): Promise<boolean> {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.prisma.product.delete({ where: { id } });
    return true;
  }

  /**
   * Get product by ID
   */
  async getProductById(id: string, tenantId: string): Promise<Product> {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        marketplaceProducts: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  /**
   * Get product by SKU
   */
  async getProductBySku(sku: string, tenantId: string): Promise<Product | null> {
    return this.prisma.product.findUnique({
      where: {
        tenantId_sku: {
          tenantId,
          sku,
        },
      },
      include: {
        marketplaceProducts: true,
      },
    });
  }

  /**
   * Get products with filters
   */
  async getProducts(filters: ProductFilters): Promise<{
    products: Product[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { tenantId, search, isActive, page = 1, limit = 20 } = filters;

    const where: Prisma.ProductWhereInput = {
      tenantId,
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { sku: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          marketplaceProducts: true,
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Link product to marketplace
   */
  async linkToMarketplace(
    productId: string,
    tenantId: string,
    marketplace: Marketplace,
    externalId: string,
    listingUrl?: string,
  ): Promise<Product> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.prisma.marketplaceProduct.upsert({
      where: {
        productId_marketplace: {
          productId,
          marketplace,
        },
      },
      update: {
        externalId,
        listingUrl,
        lastSyncAt: new Date(),
      },
      create: {
        productId,
        marketplace,
        externalId,
        listingUrl,
      },
    });

    return this.getProductById(productId, tenantId);
  }

  /**
   * Update stock
   */
  async updateStock(
    id: string,
    tenantId: string,
    quantity: number,
    operation: 'set' | 'increment' | 'decrement',
  ): Promise<Product> {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    let newStock: number;

    switch (operation) {
      case 'set':
        newStock = quantity;
        break;
      case 'increment':
        newStock = product.stock + quantity;
        break;
      case 'decrement':
        newStock = Math.max(0, product.stock - quantity);
        break;
    }

    return this.prisma.product.update({
      where: { id },
      data: { stock: newStock },
    });
  }

  /**
   * Bulk import products
   */
  async bulkImport(
    tenantId: string,
    products: CreateProductInput[],
  ): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];

    for (const product of products) {
      try {
        await this.createProduct(tenantId, product);
        imported++;
      } catch (error) {
        errors.push(
          `SKU ${product.sku}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    return { imported, errors };
  }
}

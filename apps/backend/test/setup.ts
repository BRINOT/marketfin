import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

beforeAll(async () => {
  // Connect to test database
  await prisma.$connect();
});

afterAll(async () => {
  // Disconnect from test database
  await prisma.$disconnect();
});

// Global test utilities
global.prisma = prisma;

// Mock Clerk authentication for tests
jest.mock('@clerk/clerk-sdk-node', () => ({
  clerkClient: {
    users: {
      getUser: jest.fn().mockResolvedValue({
        id: 'test-user-id',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
      }),
    },
  },
  verifyToken: jest.fn().mockResolvedValue({
    sub: 'test-user-id',
    azp: 'test-app',
  }),
}));

/**
 * Test Fixtures for Qlik Apps
 */

export const singleApp = {
  id: 'app-123',
  name: 'Sales Dashboard',
  description: 'Monthly sales overview',
  resourceType: 'app',
  ownerId: 'user-1',
  spaceId: 'space-1',
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-06-01T15:30:00.000Z',
};

export const appsList = {
  data: [
    singleApp,
    {
      id: 'app-456',
      name: 'HR Analytics',
      description: 'Employee metrics',
      resourceType: 'app',
      ownerId: 'user-2',
      spaceId: 'space-2',
      createdAt: '2024-02-20T09:00:00.000Z',
      updatedAt: '2024-05-15T11:00:00.000Z',
    },
    {
      id: 'app-789',
      name: 'Finance Report',
      description: 'Quarterly finance data',
      resourceType: 'app',
      ownerId: 'user-1',
      spaceId: 'space-1',
      createdAt: '2024-03-10T14:00:00.000Z',
      updatedAt: '2024-06-10T09:30:00.000Z',
    },
  ],
  links: {
    self: { href: '/api/v1/items?resourceType=app' },
  },
};

export const appMetadata = {
  id: 'app-123',
  attributes: {
    name: 'Sales Dashboard',
    description: 'Monthly sales overview',
    lastReloadTime: '2024-06-01T08:00:00.000Z',
  },
  createdDate: '2024-01-15T10:00:00.000Z',
  modifiedDate: '2024-06-01T15:30:00.000Z',
};

export const appSheets = [
  { id: 'sheet-1', title: 'Overview', description: 'Main dashboard' },
  { id: 'sheet-2', title: 'Details', description: 'Detailed breakdown' },
  { id: 'sheet-3', title: 'Trends', description: 'Time series analysis' },
];

export const appFields = [
  { name: 'Sales', type: 'measure' },
  { name: 'Date', type: 'dimension' },
  { name: 'Region', type: 'dimension' },
  { name: 'Product', type: 'dimension' },
  { name: 'Quantity', type: 'measure' },
];

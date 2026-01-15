/**
 * Test Fixtures for Qlik Spaces
 */

export const personalSpace = {
  id: 'space-personal',
  name: 'Personal',
  type: 'personal',
  ownerId: 'user-1',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

export const sharedSpace = {
  id: 'space-shared',
  name: 'Sales Team',
  type: 'shared',
  ownerId: 'user-1',
  createdAt: '2024-02-01T00:00:00.000Z',
  updatedAt: '2024-05-15T00:00:00.000Z',
};

export const managedSpace = {
  id: 'space-managed',
  name: 'Production',
  type: 'managed',
  ownerId: 'admin-1',
  createdAt: '2024-01-15T00:00:00.000Z',
  updatedAt: '2024-06-01T00:00:00.000Z',
};

export const spacesList = {
  data: [personalSpace, sharedSpace, managedSpace],
  links: {
    self: { href: '/api/v1/spaces' },
  },
};

export const emptySpacesList = {
  data: [],
  links: {
    self: { href: '/api/v1/spaces' },
  },
};

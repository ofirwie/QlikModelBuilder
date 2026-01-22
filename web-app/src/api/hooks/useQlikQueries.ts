/**
 * TanStack Query hooks for Qlik Cloud API
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { qlikClient } from '../clients'

// Query keys
export const qlikKeys = {
  all: ['qlik'] as const,
  tenant: () => [...qlikKeys.all, 'tenant'] as const,
  spaces: () => [...qlikKeys.all, 'spaces'] as const,
  space: (id: string) => [...qlikKeys.spaces(), id] as const,
  apps: (spaceId?: string) => [...qlikKeys.all, 'apps', { spaceId }] as const,
  connections: () => [...qlikKeys.all, 'connections'] as const,
}

/**
 * Test Qlik Cloud connection
 */
export function useTestConnection() {
  return useQuery({
    queryKey: qlikKeys.tenant(),
    queryFn: () => qlikClient.testConnection(),
    retry: 1,
    staleTime: 30 * 1000, // 30 seconds
  })
}

/**
 * Get tenant info
 */
export function useTenantInfo() {
  return useQuery({
    queryKey: qlikKeys.tenant(),
    queryFn: () => qlikClient.getTenantInfo(),
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * List all spaces
 */
export function useSpaces() {
  return useQuery({
    queryKey: qlikKeys.spaces(),
    queryFn: () => qlikClient.listSpaces(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

/**
 * Get single space
 */
export function useSpace(spaceId: string) {
  return useQuery({
    queryKey: qlikKeys.space(spaceId),
    queryFn: () => qlikClient.getSpace(spaceId),
    enabled: !!spaceId,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * List apps (optionally filtered by space)
 */
export function useApps(spaceId?: string) {
  return useQuery({
    queryKey: qlikKeys.apps(spaceId),
    queryFn: () => qlikClient.listApps(spaceId),
    staleTime: 2 * 60 * 1000,
  })
}

/**
 * List data connections
 */
export function useConnections() {
  return useQuery({
    queryKey: qlikKeys.connections(),
    queryFn: () => qlikClient.listConnections(),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Create app mutation
 */
export function useCreateApp() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ name, spaceId }: { name: string; spaceId: string }) =>
      qlikClient.createApp(name, spaceId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: qlikKeys.apps(variables.spaceId) })
    },
  })
}

/**
 * Reload app mutation
 */
export function useReloadApp() {
  return useMutation({
    mutationFn: (appId: string) => qlikClient.reloadApp(appId),
  })
}

/**
 * Set app script mutation
 */
export function useSetAppScript() {
  return useMutation({
    mutationFn: ({ appId, script }: { appId: string; script: string }) =>
      qlikClient.setAppScript(appId, script),
  })
}

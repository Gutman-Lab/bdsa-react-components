/**
 * ProtocolManager - Main component for managing stain and region protocols
 *
 * This is the primary entry point for protocol management functionality.
 * It provides a complete interface for viewing, creating, editing, and managing
 * protocols used in BDSA schema compliance.
 *
 * The component includes:
 * - ProtocolProvider: Context provider for protocol state management
 * - ProtocolsTab: Main UI component for protocol management
 * - ProtocolCard: Individual protocol display
 * - ProtocolList: Grid view of protocols
 * - ProtocolModal: Create/edit modal for protocols
 *
 * @example
 * ```tsx
 * import { ProtocolProvider, ProtocolsTab } from 'bdsa-react-components';
 *
 * function App() {
 *   return (
 *     <ProtocolProvider>
 *       <ProtocolsTab />
 *     </ProtocolProvider>
 *   );
 * }
 * ```
 */
export { ProtocolsTab as ProtocolManager } from './ProtocolsTab';
export { default } from './ProtocolsTab';
export { ProtocolProvider, useProtocols } from './ProtocolContext';
export { ProtocolCard } from './ProtocolCard';
export { ProtocolList } from './ProtocolList';
export { ProtocolModal } from './ProtocolModal';
export { ProtocolsTab } from './ProtocolsTab';
export { LocalStorageProtocolStorage, InMemoryProtocolStorage, defaultStorage, generateProtocolId, } from './storage/protocolStorage';
export { DsaSyncAdapter, NoOpDsaSyncAdapter } from './adapters/DsaSyncAdapter';
export type { Protocol, ProtocolType, ProtocolStorage, DsaSyncAdapter as DsaSyncAdapterType, SchemaValidator, ProtocolContextValue, ProtocolProviderProps, ProtocolCardProps, ProtocolListProps, ProtocolModalProps, ProtocolsTabProps, } from './ProtocolManager.types';
//# sourceMappingURL=ProtocolManager.d.ts.map
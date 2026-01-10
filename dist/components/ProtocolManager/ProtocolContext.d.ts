import { ProtocolContextValue, ProtocolProviderProps } from './ProtocolManager.types';

/**
 * Protocol Context - Single source of truth for all protocols
 *
 * State Shape:
 * {
 *   protocols: [
 *     { id, type: 'stain'|'region', name, ...otherFields },
 *     ...
 *   ],
 *   loading: boolean,
 *   error: string|null
 * }
 */
declare const ProtocolContext: import('react').Context<ProtocolContextValue | null>;
/**
 * ProtocolProvider - Wrap your app with this to provide protocol state
 *
 * @param {ProtocolProviderProps} props
 */
export declare function ProtocolProvider({ children, storage }: ProtocolProviderProps): import("react/jsx-runtime").JSX.Element;
/**
 * useProtocols - The ONE hook you need for protocol management!
 *
 * @returns {ProtocolContextValue} Protocol state and actions
 *
 * @example
 * function MyComponent() {
 *   const { protocols, stainProtocols, addProtocol, loading } = useProtocols();
 *
 *   if (loading) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       {stainProtocols.map(p => <div key={p.id}>{p.name}</div>)}
 *       <button onClick={() => addProtocol({ type: 'stain', name: 'H&E', id: '...' })}>
 *         Add Protocol
 *       </button>
 *     </div>
 *   );
 * }
 */
export declare function useProtocols(): ProtocolContextValue;
export default ProtocolContext;
//# sourceMappingURL=ProtocolContext.d.ts.map
import type { Protocol } from '../ProtocolManager.types'

/** Build a case block2region map (block ID → region protocol id) from a block protocol. */
export function blockProtocolToBlock2RegionMap(protocol: Protocol): Record<string, string> {
    const map: Record<string, string> = {}
    for (const slot of protocol.slots ?? []) {
        const blockId = slot.blockId?.trim()
        const regionProtocolId = slot.regionProtocolId?.trim()
        if (blockId && regionProtocolId) {
            map[blockId] = regionProtocolId
        }
    }
    return map
}

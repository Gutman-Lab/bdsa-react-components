import React from 'react'
import type { Item } from './FolderBrowser.types'
import { hasLargeImage, isAIModel } from '../../utils/itemUtils'

export interface RenderItemNodeParams {
    item: Item
    depth: number
    isSelected: boolean
    onItemSelect: (item: Item) => void
    renderItem?: (item: Item, depth: number) => React.ReactNode
}

export function renderItemNodeContent({
    item,
    depth,
    isSelected,
    onItemSelect,
    renderItem,
}: RenderItemNodeParams): React.ReactNode {
    if (renderItem) {
        return renderItem(item, depth)
    }

    // Check item type based on metadata
    const itemIsAIModel = isAIModel(item)
    const itemHasLargeImage = hasLargeImage(item)

    // Determine icon and label based on item type
    let icon = '📄'
    let label = 'Item'

    if (itemIsAIModel) {
        icon = '🤖'
        label = 'AI Model'
    } else if (itemHasLargeImage) {
        icon = '🖼️'
        label = 'Image'
    }

    return (
        <div className="bdsa-folder-browser__item">
            <div
                className={`bdsa-folder-browser__resource-item ${isSelected ? 'selected' : ''}`}
                onClick={() => onItemSelect(item)}
                onDoubleClick={() => onItemSelect(item)}
                data-resource-id={item._id}
            >
                <span className="bdsa-folder-browser__resource-icon">{icon}</span>
                <span className="bdsa-folder-browser__resource-name">{item.name}</span>
                <span className="bdsa-folder-browser__resource-type">{label}</span>
            </div>
        </div>
    )
}


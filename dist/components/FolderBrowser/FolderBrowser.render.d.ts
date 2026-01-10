import { default as React } from 'react';
import { Item } from './FolderBrowser.types';

export interface RenderItemNodeParams {
    item: Item;
    depth: number;
    isSelected: boolean;
    onItemSelect: (item: Item) => void;
    renderItem?: (item: Item, depth: number) => React.ReactNode;
}
export declare function renderItemNodeContent({ item, depth, isSelected, onItemSelect, renderItem, }: RenderItemNodeParams): React.ReactNode;
//# sourceMappingURL=FolderBrowser.render.d.ts.map
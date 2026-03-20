export interface Collection {
  _id: string
  name: string
  public?: boolean
  [key: string]: unknown
}

export interface FolderItem {
  _id: string
  name: string
  public?: boolean
  [key: string]: unknown
}

export interface Item {
  _id: string
  name: string
  [key: string]: unknown
}

export interface NodeChildren {
  folders: FolderItem[]
  items: Item[]
}

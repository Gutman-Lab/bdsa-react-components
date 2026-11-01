/**
 * Schema Validator - Loads and validates protocols against Pitt BDSA split schemas
 */

import bundledStainSchema from '../schemas/stain-metadata.json'
import bundledRegionSchema from '../schemas/region-metadata.json'
import type { Protocol, SchemaValidator as ISchemaValidator } from '../ProtocolManager.types'

/** Public paths for hosted copies in `dist/schemas/` */
export const SCHEMA_PATHS = {
    clinical: '/schemas/clinical-metadata.json',
    region: '/schemas/region-metadata.json',
    stain: '/schemas/stain-metadata.json',
    slide: '/schemas/slide-level-metadata.json',
} as const

interface StainTypeDefinition {
    title?: string
    properties?: Record<string, SchemaPropertyDef>
    required?: string[]
}

interface SchemaPropertyDef {
    enum?: string[]
    pattern?: string
    title?: string
}

interface RegionSchemaDefinition {
    regions?: {
        properties?: Record<string, RegionTypeDefinition>
    }
    hemisphere?: { enum?: string[] }
    sliceOrientation?: { enum?: string[] }
    damage?: {
        items?: { enum?: string[] }
    }
}

interface RegionTypeDefinition {
    title?: string
    items?: {
        enum?: string[]
    }
}

type SchemaDocument = {
    properties?: Record<string, unknown>
}

export type LoadSchemasOptions = {
    /** When true (and no inline data), use npm-bundled Pitt stain + region schemas. */
    useDefault?: boolean
    /** Optional URLs for stain/region when not using bundled defaults. */
    stainSchemaUrl?: string
    regionSchemaUrl?: string
}

export const BDSA_SCHEMA_DEFAULT_OPTIONS = { useDefault: true } as const satisfies LoadSchemasOptions

function extractStainTypes(stainDoc: SchemaDocument): Record<string, StainTypeDefinition> {
    const props = stainDoc.properties
    return (
        (props?.bdsa_stain_id as { items?: { properties?: Record<string, StainTypeDefinition> } })
            ?.items?.properties ?? {}
    )
}

function extractRegionProperties(regionDoc: SchemaDocument): RegionSchemaDefinition {
    const props = regionDoc.properties
    return (
        (props?.bdsa_region_ids as { properties?: RegionSchemaDefinition })?.properties ?? {}
    )
}

async function fetchSchemaDocument(url: string): Promise<SchemaDocument> {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Schema not found at ${url}`)
    }
    return response.json() as Promise<SchemaDocument>
}

export class SchemaValidator implements ISchemaValidator {
    private stainSchema: Record<string, StainTypeDefinition> | null = null
    private regionSchema: RegionSchemaDefinition | null = null
    public loaded: boolean = false

    async loadSchemas(
        schemaUrl?: string,
        schemaData?: SchemaDocument,
        options?: LoadSchemasOptions,
    ): Promise<boolean> {
        try {
            let stainDoc: SchemaDocument
            let regionDoc: SchemaDocument

            if (schemaData) {
                stainDoc = schemaData
                regionDoc = schemaData
            } else if (options?.useDefault ?? (!schemaUrl && !options?.stainSchemaUrl)) {
                stainDoc = bundledStainSchema as SchemaDocument
                regionDoc = bundledRegionSchema as SchemaDocument
            } else {
                const stainUrl = options?.stainSchemaUrl ?? schemaUrl ?? SCHEMA_PATHS.stain
                const regionUrl = options?.regionSchemaUrl ?? SCHEMA_PATHS.region
                stainDoc = await fetchSchemaDocument(stainUrl)
                regionDoc = await fetchSchemaDocument(regionUrl)
            }

            this.stainSchema = extractStainTypes(stainDoc)
            this.regionSchema = extractRegionProperties(regionDoc)
            this.loaded = true

            console.log('BDSA Pitt schemas loaded', {
                stainTypes: Object.keys(this.stainSchema || {}),
                regionTypes: Object.keys(this.regionSchema?.regions?.properties || {}),
            })
            return true
        } catch (error) {
            console.warn('Error loading BDSA schemas, using fallback options:', error)
            this.loaded = true
            return true
        }
    }

    getStainTypeOptions(): Array<{ value: string; label: string }> {
        if (!this.stainSchema || Object.keys(this.stainSchema).length === 0) {
            return [{ value: 'ignore', label: 'IGNORE' }]
        }
        return Object.keys(this.stainSchema).map((key) => ({
            value: key,
            label: this.stainSchema![key].title || key,
        }))
    }

    getStainTypeDefinition(stainType: string): StainTypeDefinition | null {
        if (!this.stainSchema?.[stainType]) return null
        return this.stainSchema[stainType]
    }

    getStainTypeProperties(stainType: string): Record<string, SchemaPropertyDef> {
        return this.getStainTypeDefinition(stainType)?.properties || {}
    }

    getStainTypeRequiredFields(stainType: string): string[] {
        return this.getStainTypeDefinition(stainType)?.required || []
    }

    getAntibodyOptions(stainType: string): string[] {
        return this.getStainTypeProperties(stainType).antibody?.enum || []
    }

    getTechniqueOptions(stainType: string): string[] {
        return this.getStainTypeProperties(stainType).technique?.enum || []
    }

    getPhosphoSpecificOptions(stainType: string): string[] {
        return this.getStainTypeProperties(stainType)['phospho-specific']?.enum || []
    }

    getChemistryOptions(stainType: string): string[] {
        return this.getStainTypeProperties(stainType).chemistry?.enum || []
    }

    getChromogenOptions(stainType: string): string[] {
        return this.getStainTypeProperties(stainType).chromogen?.enum || []
    }

    getDilutionPattern(stainType: string): string | null {
        return this.getStainTypeProperties(stainType).dilution?.pattern || null
    }

    getVendorPattern(stainType: string): string | null {
        return this.getStainTypeProperties(stainType).vendor?.pattern || null
    }

    getRegionTypeOptions(): Array<{ value: string; label: string }> {
        if (!this.regionSchema?.regions?.properties) {
            return [{ value: 'ignore', label: 'IGNORE' }]
        }
        return Object.keys(this.regionSchema.regions.properties).map((key) => ({
            value: key,
            label: this.regionSchema!.regions!.properties![key].title || key,
        }))
    }

    getRegionTypeDefinition(regionType: string): RegionTypeDefinition | null {
        if (!this.regionSchema?.regions?.properties?.[regionType]) return null
        return this.regionSchema.regions.properties[regionType]
    }

    getLandmarkOptions(regionType: string): string[] {
        return this.getRegionTypeDefinition(regionType)?.items?.enum || []
    }

    getHemisphereOptions(): string[] {
        return this.regionSchema?.hemisphere?.enum || ['left', 'right', 'bilateral']
    }

    getSliceOrientationOptions(): string[] {
        return this.regionSchema?.sliceOrientation?.enum || ['axial', 'coronal', 'sagittal']
    }

    getDamageOptions(): string[] {
        return this.regionSchema?.damage?.items?.enum || []
    }

    private schemaFieldToFormField(field: string): string {
        if (field === 'phospho-specific') return 'phosphoSpecific'
        return field
    }

    validateStainProtocol(data: Partial<Protocol>): Record<string, string> {
        const errors: Record<string, string> = {}

        if (!data.name?.trim()) errors.name = 'Protocol name is required'
        if (!data.stainType) errors.stainType = 'Stain type is required'

        if (data.stainType && this.stainSchema?.[data.stainType]) {
            const stainDef = this.stainSchema[data.stainType]
            const properties = stainDef.properties || {}

            for (const field of stainDef.required || []) {
                const formField = this.schemaFieldToFormField(field)
                if (!data[formField as keyof Protocol]) {
                    errors[formField] = `${properties[field]?.title || field} is required for ${data.stainType}`
                }
            }

            if (data.dilution && properties.dilution?.pattern) {
                const pattern = new RegExp(properties.dilution.pattern)
                if (!pattern.test(data.dilution)) {
                    errors.dilution = `Dilution must match pattern: ${properties.dilution.pattern}`
                }
            }

            if (data.vendor && properties.vendor?.pattern) {
                const pattern = new RegExp(properties.vendor.pattern)
                if (!pattern.test(data.vendor)) {
                    errors.vendor = `Vendor must match pattern: ${properties.vendor.pattern}`
                }
            }

            const enumChecks: Array<{
                dataKey: keyof Protocol
                propKey: string
            }> = [
                { dataKey: 'antibody', propKey: 'antibody' },
                { dataKey: 'technique', propKey: 'technique' },
                { dataKey: 'phosphoSpecific', propKey: 'phospho-specific' },
                { dataKey: 'chromogen', propKey: 'chromogen' },
            ]

            for (const { dataKey, propKey } of enumChecks) {
                const value = data[dataKey] as string | undefined
                const allowed = properties[propKey]?.enum
                if (value && allowed && !allowed.includes(value)) {
                    errors[dataKey as string] = `Must be one of: ${allowed.join(', ')}`
                }
            }

            const chemistry = (data as Record<string, unknown>).chemistry as string | undefined
            if (chemistry && properties.chemistry?.enum && !properties.chemistry.enum.includes(chemistry)) {
                errors.chemistry = `Chemistry must be one of: ${properties.chemistry.enum.join(', ')}`
            }
        }

        return errors
    }

    validateRegionProtocol(data: Partial<Protocol>): Record<string, string> {
        const errors: Record<string, string> = {}

        if (!data.name?.trim()) errors.name = 'Protocol name is required'
        if (!data.regionType) errors.regionType = 'Region type is required'

        if (data.regionType && this.regionSchema?.regions?.properties?.[data.regionType]) {
            const regionDef = this.regionSchema.regions.properties[data.regionType]

            if (data.landmarks && Array.isArray(data.landmarks) && regionDef.items?.enum) {
                const invalid = data.landmarks.filter((l) => !regionDef.items!.enum!.includes(l))
                if (invalid.length > 0) {
                    errors.landmarks = `Invalid landmarks: ${invalid.join(', ')}`
                }
            }
        }

        if (data.hemisphere && this.regionSchema?.hemisphere?.enum) {
            if (!this.regionSchema.hemisphere.enum.includes(data.hemisphere)) {
                errors.hemisphere = `Hemisphere must be one of: ${this.regionSchema.hemisphere.enum.join(', ')}`
            }
        }

        if (data.sliceOrientation && this.regionSchema?.sliceOrientation?.enum) {
            if (!this.regionSchema.sliceOrientation.enum.includes(data.sliceOrientation)) {
                errors.sliceOrientation = `Slice orientation must be one of: ${this.regionSchema.sliceOrientation.enum.join(', ')}`
            }
        }

        if (data.damage && Array.isArray(data.damage) && this.regionSchema?.damage?.items?.enum) {
            const invalid = data.damage.filter((d) => !this.regionSchema!.damage!.items!.enum!.includes(d))
            if (invalid.length > 0) {
                errors.damage = `Invalid damage types: ${invalid.join(', ')}`
            }
        }

        return errors
    }

    validateBlockProtocol(
        data: Partial<Protocol>,
        regionProtocolIds: string[],
    ): Record<string, string> {
        const errors: Record<string, string> = {}

        if (!data.name?.trim()) {
            errors.name = 'Protocol name is required'
        }

        const slots = data.slots ?? []
        if (slots.length === 0) {
            errors.slots = 'Add at least one block → region mapping'
            return errors
        }

        const seenBlockIds = new Set<string>()
        for (let i = 0; i < slots.length; i++) {
            const slot = slots[i]
            const blockId = slot.blockId?.trim()
            const regionProtocolId = slot.regionProtocolId?.trim()

            if (!blockId) {
                errors[`slots.${i}.blockId`] = 'Block ID is required'
            } else if (seenBlockIds.has(blockId)) {
                errors[`slots.${i}.blockId`] = 'Duplicate block ID'
            } else {
                seenBlockIds.add(blockId)
            }

            if (!regionProtocolId) {
                errors[`slots.${i}.regionProtocolId`] = 'Region protocol is required'
            } else if (!regionProtocolIds.includes(regionProtocolId)) {
                errors[`slots.${i}.regionProtocolId`] = 'Unknown region protocol'
            }
        }

        return errors
    }

    isLoaded(): boolean {
        return this.loaded
    }

    getStainSchema(): Record<string, StainTypeDefinition> | null {
        return this.stainSchema
    }

    getRegionSchema(): RegionSchemaDefinition | null {
        return this.regionSchema
    }
}

export function createSchemaValidator(): SchemaValidator {
    return new SchemaValidator()
}

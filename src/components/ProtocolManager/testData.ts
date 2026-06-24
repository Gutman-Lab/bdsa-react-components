/**
 * Sample protocols aligned with Pitt BDSA stain/region schemas (Storybook & tests).
 */

import type { Protocol } from './ProtocolManager.types';

export const sampleStainProtocols: Protocol[] = [
    {
        id: 'stain_he_1',
        type: 'stain',
        name: 'H&E',
        description: 'Standard hematoxylin and eosin',
        stainType: 'HE',
        chemistry: 'dye binding',
        dilution: '1:1',
        vendor: 'Leica',
    },
    {
        id: 'stain_biel_1',
        type: 'stain',
        name: 'Bielschowsky',
        description: 'Silver impregnation for neurofibrillary pathology',
        stainType: 'Bielschowsky',
        chemistry: 'silver impregnation',
    },
    {
        id: 'stain_tdp43_1',
        type: 'stain',
        name: 'TDP-43 IHC',
        description: 'TDP-43 immunohistochemistry',
        stainType: 'TDP-43',
        antibody: 'pS409/410',
        phosphoSpecific: 'yes',
        chromogen: 'DAB (Brown)',
        dilution: '1:1000',
        vendor: 'Proteintech',
    },
    {
        id: 'stain_abeta_1',
        type: 'stain',
        name: 'Amyloid beta',
        description: 'Amyloid beta IHC (4G8)',
        stainType: 'aBeta',
        antibody: '4G8',
        phosphoSpecific: 'no',
        chromogen: 'DAB (Brown)',
        dilution: '1:1000',
        vendor: 'BioLegend',
    },
    {
        id: 'stain_tau_1',
        type: 'stain',
        name: 'Tau AT8',
        description: 'Phospho-tau IHC',
        stainType: 'Tau',
        antibody: 'AT8',
        phosphoSpecific: 'yes',
        chromogen: 'DAB (Brown)',
        dilution: '1:2000',
    },
    {
        id: 'stain_asyn_1',
        type: 'stain',
        name: 'Alpha synuclein',
        description: 'Lewy body pathology',
        stainType: 'aSyn',
        antibody: '5G4',
        phosphoSpecific: 'yes',
        chromogen: 'DAB (Brown)',
        dilution: '1:500',
    },
    {
        id: 'stain_gfap_1',
        type: 'stain',
        name: 'GFAP',
        description: 'Astrocyte marker',
        stainType: 'GFAP',
        antibody: 'GA5',
        chromogen: 'DAB (Brown)',
        dilution: '1:500',
    },
    {
        id: 'stain_iba1_1',
        type: 'stain',
        name: 'Iba1',
        description: 'Microglia marker',
        stainType: 'Iba1',
        antibody: 'EPR16588',
        chromogen: 'DAB (Brown)',
        dilution: '1:1000',
    },
];

export const sampleRegionProtocols: Protocol[] = [
    {
        id: 'region_hippocampus_1',
        type: 'region',
        name: 'Hippocampus — full',
        description: 'Hippocampus with dentate gyrus',
        regionType: 'Hippocampus',
        landmarks: ['CA1-4 with dentate gyrus', 'Parahippocampal gyrus'],
        hemisphere: 'left',
        sliceOrientation: 'coronal',
    },
    {
        id: 'region_midbrain_1',
        type: 'region',
        name: 'Midbrain',
        description: 'Midbrain landmarks',
        regionType: 'Midbrain',
        landmarks: ['Substantia nigra', 'Red nucleus'],
        hemisphere: 'right',
        sliceOrientation: 'coronal',
    },
    {
        id: 'region_pons_1',
        type: 'region',
        name: 'Pons',
        description: 'Pontine section',
        regionType: 'Pons',
        landmarks: ['Locus coeruleus', 'Pontine base / fibers'],
        hemisphere: 'bilateral',
        sliceOrientation: 'axial',
    },
    {
        id: 'region_acg_1',
        type: 'region',
        name: 'Anterior cingulate',
        description: 'Anterior cingulate cortex',
        regionType: 'Ant_Cingulate',
        landmarks: ['Corpus callosum', 'Superior frontal'],
        hemisphere: 'left',
        sliceOrientation: 'coronal',
    },
];

/** Block templates referencing region protocol ids from sampleRegionProtocols */
export const sampleBlockProtocols: Protocol[] = [
    {
        id: 'block_autopsy_std',
        type: 'block',
        name: 'Standard autopsy blocks',
        description: 'Common block set for brainstem and hippocampus',
        slots: [
            { blockId: 'MB-01', regionProtocolId: 'region_midbrain_1' },
            { blockId: 'HIPP-L', regionProtocolId: 'region_hippocampus_1' },
            { blockId: 'PONS-01', regionProtocolId: 'region_pons_1' },
        ],
    },
];

export const sampleProtocols: Protocol[] = [
    ...sampleStainProtocols,
    ...sampleRegionProtocols,
    ...sampleBlockProtocols,
];

export const minimalTestProtocols: Protocol[] = [
    {
        id: 'test_stain_he',
        type: 'stain',
        name: 'Test H&E',
        description: 'Minimal H&E example',
        stainType: 'HE',
        chemistry: 'dye binding',
    },
    {
        id: 'test_region_hipp',
        type: 'region',
        name: 'Test Hippocampus',
        description: 'Minimal region example',
        regionType: 'Hippocampus',
        landmarks: ['CA1-4 with dentate gyrus'],
        hemisphere: 'left',
        sliceOrientation: 'coronal',
    },
];

export function createTestProtocol(overrides: Partial<Protocol>): Protocol {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    const id = `test_${timestamp}_${randomStr}`;

    return {
        id,
        type: 'stain',
        name: 'Test Protocol',
        ...overrides,
    };
}

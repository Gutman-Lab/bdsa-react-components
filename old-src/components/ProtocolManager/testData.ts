/**
 * Test Data for Protocol Components
 * 
 * This file contains sample protocol data for testing, Storybook stories, and development.
 * Based on real-world BDSA protocol structures.
 */

import type { Protocol } from './ProtocolManager.types';

/**
 * Sample stain protocols
 */
export const sampleStainProtocols: Protocol[] = [
    {
        id: 'stain_tdp43_1',
        type: 'stain',
        name: 'TDP-43 IHC',
        description: 'TDP-43 immunohistochemistry for detecting TDP-43 proteinopathy',
        stainType: 'TDP-43',
        antibody: 'TDP-43 (C-terminal)',
        technique: 'IHC',
        phosphoSpecific: 'pS409/410',
        dilution: '1:1000',
        vendor: 'Proteintech',
        chromogen: 'DAB (brown)',
    },
    {
        id: 'stain_asyn_1',
        type: 'stain',
        name: 'Alpha Synuclein IHC',
        description: 'Alpha synuclein immunohistochemistry for Lewy body pathology',
        stainType: 'aSyn',
        antibody: 'Alpha Synuclein (phospho S129)',
        technique: 'IHC',
        dilution: '1:500',
        vendor: 'Abcam',
        chromogen: 'DAB (brown)',
    },
    {
        id: 'stain_tau_1',
        type: 'stain',
        name: 'Tau IHC',
        description: 'Tau immunohistochemistry for neurofibrillary tangles',
        stainType: 'Tau',
        antibody: 'Tau (phospho S396)',
        technique: 'IHC',
        phosphoSpecific: 'pS396',
        dilution: '1:2000',
        vendor: 'Cell Signaling',
        chromogen: 'DAB (brown)',
    },
    {
        id: 'stain_abeta_1',
        type: 'stain',
        name: 'Amyloid Beta IHC',
        description: 'Amyloid beta immunohistochemistry for amyloid plaques',
        stainType: 'aBeta',
        antibody: 'Amyloid Beta (4G8)',
        technique: 'IHC',
        dilution: '1:1000',
        vendor: 'BioLegend',
        chromogen: 'DAB (brown)',
    },
    {
        id: 'stain_gfap_1',
        type: 'stain',
        name: 'GFAP IHC',
        description: 'Glial fibrillary acidic protein for astrocyte detection',
        stainType: 'GFAP',
        antibody: 'GFAP',
        technique: 'IHC',
        dilution: '1:500',
        vendor: 'Dako',
        chromogen: 'DAB (brown)',
    },
    {
        id: 'stain_iba1_1',
        type: 'stain',
        name: 'IBA1 IHC',
        description: 'Ionized calcium binding adapter molecule 1 for microglia',
        stainType: 'IBA1',
        antibody: 'IBA1',
        technique: 'IHC',
        dilution: '1:1000',
        vendor: 'Wako',
        chromogen: 'DAB (brown)',
    },
    {
        id: 'stain_neun_1',
        type: 'stain',
        name: 'NeuN IHC',
        description: 'Neuronal nuclei marker for neuron identification',
        stainType: 'NeuN',
        antibody: 'NeuN',
        technique: 'IHC',
        dilution: '1:500',
        vendor: 'Millipore',
        chromogen: 'DAB (brown)',
    },
    {
        id: 'stain_he_1',
        type: 'stain',
        name: 'H&E',
        description: 'Hematoxylin and Eosin standard histology stain',
        stainType: 'HE',
        technique: 'Histology',
    },
    {
        id: 'stain_silver_1',
        type: 'stain',
        name: 'Silver Stain',
        description: 'Silver staining for neurofibrillary tangles and neuritic plaques',
        stainType: 'Silver',
        technique: 'Histology',
    },
];

/**
 * Sample region protocols
 */
export const sampleRegionProtocols: Protocol[] = [
    {
        id: 'region_hippocampus_1',
        type: 'region',
        name: 'Hippocampus - Full',
        description: 'Complete hippocampus including all subfields',
        regionType: 'hippocampus',
        landmarks: ['CA1', 'CA2', 'CA3', 'CA4', 'DG', 'Subiculum'],
        hemisphere: 'left',
        sliceOrientation: 'coronal',
        sliceThickness: 5,
    },
    {
        id: 'region_hippocampus_2',
        type: 'region',
        name: 'Hippocampus - CA1 Only',
        description: 'CA1 subfield of hippocampus',
        regionType: 'hippocampus',
        landmarks: ['CA1'],
        hemisphere: 'right',
        sliceOrientation: 'coronal',
        sliceThickness: 5,
    },
    {
        id: 'region_cortex_1',
        type: 'region',
        name: 'Frontal Cortex',
        description: 'Frontal cortex region',
        regionType: 'cortex',
        landmarks: ['Brodmann Area 9', 'Brodmann Area 46'],
        hemisphere: 'left',
        sliceOrientation: 'coronal',
        sliceThickness: 6,
    },
    {
        id: 'region_cortex_2',
        type: 'region',
        name: 'Temporal Cortex',
        description: 'Temporal cortex including superior temporal gyrus',
        regionType: 'cortex',
        landmarks: ['Superior Temporal Gyrus', 'Middle Temporal Gyrus'],
        hemisphere: 'right',
        sliceOrientation: 'axial',
        sliceThickness: 5,
    },
    {
        id: 'region_brainstem_1',
        type: 'region',
        name: 'Substantia Nigra',
        description: 'Substantia nigra pars compacta and pars reticulata',
        regionType: 'brainstem',
        landmarks: ['SNpc', 'SNpr'],
        hemisphere: 'unknown',
        sliceOrientation: 'coronal',
        sliceThickness: 4,
    },
    {
        id: 'region_cerebellum_1',
        type: 'region',
        name: 'Cerebellar Cortex',
        description: 'Cerebellar cortex including molecular and granular layers',
        regionType: 'cerebellum',
        landmarks: ['Molecular Layer', 'Granular Layer', 'Purkinje Layer'],
        hemisphere: 'unknown',
        sliceOrientation: 'sagittal',
        sliceThickness: 5,
    },
];

/**
 * All sample protocols (stain + region)
 */
export const sampleProtocols: Protocol[] = [
    ...sampleStainProtocols,
    ...sampleRegionProtocols,
];

/**
 * Minimal test protocols for quick testing
 */
export const minimalTestProtocols: Protocol[] = [
    {
        id: 'test_stain_1',
        type: 'stain',
        name: 'Test H&E',
        description: 'Test hematoxylin and eosin stain',
        stainType: 'HE',
        technique: 'Histology',
    },
    {
        id: 'test_region_1',
        type: 'region',
        name: 'Test Hippocampus',
        description: 'Test hippocampus region',
        regionType: 'hippocampus',
        landmarks: ['CA1'],
        hemisphere: 'left',
        sliceOrientation: 'coronal',
        sliceThickness: 5,
    },
];

/**
 * Helper function to create a protocol with auto-generated ID
 */
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





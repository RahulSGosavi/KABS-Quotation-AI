
import { CabinetLine, ProjectInfo } from '../types';

export const DEMO_LINES: CabinetLine[] = [
    {
        id: 'line_choice',
        name: '1951 Choice',
        tier: 'Budget',
        description: 'Standard value series. Entry level.',
        finish: 'Standard Stain',
        multiplier: 1.0,
        finishPremium: 0,
        shippingFactor: 0.05,
        rates: {
            basePerFoot: 180,
            wallPerFoot: 140,
            tallPerUnit: 650,
            accessoryPerFoot: 50
        },
        availableOptions: {
            doorStyles: ['Shaker', 'Slab', 'Recessed Panel'],
            woodSpecies: ['Oak', 'Birch', 'Laminate'],
            finishes: ['Natural', 'Golden', 'Espresso', 'White Melamine'],
            constructions: ['Particle Board', 'Plywood Ends']
        }
    },
    {
        id: 'line_prime',
        name: '1951 Prime',
        tier: 'Mid-Range',
        description: 'Selected hardwoods, upgraded construction.',
        finish: 'Painted White',
        multiplier: 1.45,
        finishPremium: 0.10,
        shippingFactor: 0.06,
        rates: {
            basePerFoot: 240,
            wallPerFoot: 190,
            tallPerUnit: 850,
            accessoryPerFoot: 70
        },
        availableOptions: {
            doorStyles: ['Princeton', 'Richmond', 'Cambridge', 'Oxford'],
            woodSpecies: ['Maple', 'Cherry', 'MDF'],
            finishes: ['White Paint', 'Grey Paint', 'Navy Paint', 'Coffee Stain'],
            constructions: ['All Plywood', 'Soft Close Hinges']
        }
    },
    {
        id: 'line_elite',
        name: '1951 Elite',
        tier: 'Premium',
        description: 'Top-tier custom finishes and construction. Belcourt Series.',
        finish: 'Custom Paint',
        multiplier: 2.1,
        finishPremium: 0.0, // Finish included in Elite Painted
        shippingFactor: 0.08,
        rates: {
            basePerFoot: 450,
            wallPerFoot: 380,
            tallPerUnit: 1400,
            accessoryPerFoot: 120
        },
        availableOptions: {
            doorStyles: ['Belcourt', 'Charleston', 'Savannah', 'Newport'],
            woodSpecies: ['Select Maple', 'Quarter Sawn Oak', 'Walnut'],
            finishes: ['Custom Paint Match', 'Heirloom Glaze', 'Distressed'],
            constructions: ['3/4" Plywood', 'Dovetail Drawers', 'Blumotion']
        }
    },
    {
        id: 'line_premium',
        name: '1951 Premium',
        tier: 'Premium',
        description: 'Exotic woods and full custom sizing.',
        finish: 'Heirloom',
        multiplier: 3.5,
        finishPremium: 0.25,
        shippingFactor: 0.10,
        rates: {
            basePerFoot: 600,
            wallPerFoot: 500,
            tallPerUnit: 2000,
            accessoryPerFoot: 200
        },
        availableOptions: {
            doorStyles: ['Inset Shaker', 'Beaded Inset', 'Raised Panel', 'Louvered'],
            woodSpecies: ['Mahogany', 'Teak', 'Rift White Oak'],
            finishes: ['High Gloss', 'Cerused', 'Wire Brushed'],
            constructions: ['1" Solid Frames', 'Walnut Interiors']
        }
    }
];

// Map generic AI terms to SKUs and Prices for 1951 Cabinetry
export const PRICING_DB: Record<string, Record<string, { sku: string; price: number }>> = {
    'line_choice': {
        // Base Cabinets
        'B30': { sku: 'B30', price: 210.00 },
        'B15': { sku: 'B15', price: 150.00 },
        'B18': { sku: 'B18', price: 165.00 },
        'B24': { sku: 'B24', price: 180.00 },
        'B36': { sku: 'B36', price: 240.00 },
        'SB36': { sku: 'SB36', price: 250.00 },
        'W3030': { sku: 'W3030', price: 180.00 },
        'W1530': { sku: 'W1530', price: 120.00 },
        'W1830': { sku: 'W1830', price: 140.00 },
        'U2484': { sku: 'U2484', price: 550.00 },
        'RR96': { sku: 'RR96', price: 550.00 }, // 1951 Refrigerator Return code
        'BF': { sku: 'BF3', price: 65.00 }, 
        'WF': { sku: 'WF3', price: 55.00 },
        'TK': { sku: 'TK8', price: 45.00 },
        'CM': { sku: 'CM8', price: 120.00 }
    },
    'line_elite': {
         // Elite is higher price point
        'B30': { sku: 'B30', price: 420.00 },
        'B15': { sku: 'B15', price: 300.00 },
        'B18': { sku: 'B18', price: 330.00 },
        'B24': { sku: 'B24', price: 360.00 },
        'B36': { sku: 'B36', price: 480.00 },
        'SB36': { sku: 'SB36', price: 500.00 },
        'PB36': { sku: 'PB36', price: 580.00 }, // Pantry Base
        'PB36-1TD': { sku: 'PB36-1TD', price: 650.00 }, // Pantry Base with Top Drawer
        'W3030': { sku: 'W3030', price: 360.00 },
        'W1530': { sku: 'W1530', price: 240.00 },
        'W1830': { sku: 'W1830', price: 280.00 },
        'U2484': { sku: 'U2484', price: 1100.00 },
        'RR96': { sku: 'RR96', price: 1200.00 },
        'BF': { sku: 'BF3', price: 130.00 }, 
        'WF': { sku: 'WF3', price: 110.00 },
        'TK': { sku: 'TK8', price: 90.00 },
        'CM': { sku: 'CM8', price: 240.00 }
    }
};

export const MOCK_PROJECT_DEFAULTS: ProjectInfo = {
    dealerName: "Elite Building Solutions",
    dealerAddress: "950 Charles St #100, Longwood, FL 32750",
    dealerPhone: "407-331-1858",
    dealerEmail: "orders@elitebuilding.com",
    clientName: "Client Name",
    projectName: "Project Ref",
    address: "Project Address",
    email: "email@example.com",
    phone: "555-0123",
    date: new Date().toLocaleDateString(),
    manufacturerName: "1951 Cabinetry",
    specs: {
        doorStyle: "Belcourt",
        woodSpecies: "Paint Grade",
        stainColor: "White",
        glaze: "None",
        drawerBox: "Dovetail",
        hinges: "Soft Close",
        poNumber: "PO-12345",
        soNumber: "SO-98765"
    },
    taxRate: 0.07,
    dealerServices: [
        { id: 'srv_install', name: 'Installation Labor', type: 'per_cabinet', value: 65.00, isTaxable: false },
        { id: 'srv_delivery', name: 'Local Delivery', type: 'flat', value: 250.00, isTaxable: false }
    ]
};

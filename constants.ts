import { CabinetLine, CabinetType, CatalogItem, Project } from './types';

// 1. Cabinet Lines (The "Price Sheet Versions")
export const CABINET_LINES: CabinetLine[] = [
    {
        id: 'line_builder',
        name: 'Builder Select',
        description: 'Standard particle board, melamine finish.',
        tier: 'Budget',
        finish: 'White Melamine',
        multiplier: 1.0,
        finishPremium: 0,
        shippingFactor: 0.05
    },
    {
        id: 'line_classic',
        name: 'Classic Shaker',
        description: 'Plywood construction, painted finish.',
        tier: 'Mid-Range',
        finish: 'Painted White',
        multiplier: 1.65, // 65% markup from base
        finishPremium: 0.10, // 10% paint charge
        shippingFactor: 0.07
    },
    {
        id: 'line_artisan',
        name: 'Artisan Custom',
        description: 'Solid wood, custom stains, full overlay.',
        tier: 'Premium',
        finish: 'Custom Stain',
        multiplier: 2.8, // 180% markup
        finishPremium: 0.25, // 25% custom finish
        shippingFactor: 0.10
    }
];

// 2. Master Catalog (The "Deterministic Source of Truth")
// In a real app, this comes from Postgres/Redis
export const MASTER_CATALOG: CatalogItem[] = [
    // Base Cabinets
    { sku: 'B15', description: 'Base Cabinet 15" Wide 1 Drawer 1 Door', type: CabinetType.BASE, basePrice: 220, width: 15, depth: 24, height: 34.5, availableLines: ['line_builder', 'line_classic', 'line_artisan'] },
    { sku: 'B18', description: 'Base Cabinet 18" Wide 1 Drawer 1 Door', type: CabinetType.BASE, basePrice: 245, width: 18, depth: 24, height: 34.5, availableLines: ['line_builder', 'line_classic', 'line_artisan'] },
    { sku: 'B24', description: 'Base Cabinet 24" Wide 1 Drawer 2 Doors', type: CabinetType.BASE, basePrice: 290, width: 24, depth: 24, height: 34.5, availableLines: ['line_builder', 'line_classic', 'line_artisan'] },
    { sku: 'SB36', description: 'Sink Base 36" Wide', type: CabinetType.BASE, basePrice: 310, width: 36, depth: 24, height: 34.5, availableLines: ['line_builder', 'line_classic', 'line_artisan'] },
    { sku: 'DB18', description: 'Drawer Base 18" 3 Drawers', type: CabinetType.BASE, basePrice: 410, width: 18, depth: 24, height: 34.5, availableLines: ['line_classic', 'line_artisan'] }, // Not in builder
    
    // Wall Cabinets
    { sku: 'W1530', description: 'Wall Cabinet 15" Wide 30" High', type: CabinetType.WALL, basePrice: 180, width: 15, depth: 12, height: 30, availableLines: ['line_builder', 'line_classic', 'line_artisan'] },
    { sku: 'W1830', description: 'Wall Cabinet 18" Wide 30" High', type: CabinetType.WALL, basePrice: 200, width: 18, depth: 12, height: 30, availableLines: ['line_builder', 'line_classic', 'line_artisan'] },
    { sku: 'W3030', description: 'Wall Cabinet 30" Wide 30" High', type: CabinetType.WALL, basePrice: 280, width: 30, depth: 12, height: 30, availableLines: ['line_builder', 'line_classic', 'line_artisan'] },
    { sku: 'WDC2430', description: 'Wall Diagonal Corner 24" Wide', type: CabinetType.WALL, basePrice: 450, width: 24, depth: 12, height: 30, availableLines: ['line_builder', 'line_classic', 'line_artisan'] },

    // Tall
    { sku: 'U2484', description: 'Utility Cabinet 24"x84"', type: CabinetType.TALL, basePrice: 650, width: 24, depth: 24, height: 84, availableLines: ['line_builder', 'line_classic', 'line_artisan'] },

    // Accessories
    { sku: 'TK8', description: 'Toe Kick 8ft', type: CabinetType.ACCESSORY, basePrice: 45, width: 96, depth: 0.25, height: 4.5, availableLines: ['line_builder', 'line_classic', 'line_artisan'] },
    { sku: 'CM8', description: 'Crown Molding 8ft', type: CabinetType.ACCESSORY, basePrice: 120, width: 96, depth: 2, height: 3, availableLines: ['line_classic', 'line_artisan'] },
];

export const MOCK_PROJECTS: Project[] = [
    { id: '1', name: 'Smith Kitchen Reno', clientName: 'Alice Smith', address: '123 Maple Dr', createdAt: new Date('2023-10-01'), updatedAt: new Date(), status: 'Draft' },
    { id: '2', name: 'Downtown Loft', clientName: 'Urban Developers LLC', address: '500 Main St #4B', createdAt: new Date('2023-09-15'), updatedAt: new Date(), status: 'Quoted' },
];

import { CabinetLine } from '../types';

export const DEMO_LINES: CabinetLine[] = [
    {
        id: 'line_builder',
        name: 'Builder Series',
        tier: 'Budget',
        description: 'Standard particle board, melamine finish. Cost-effective.',
        finish: 'White Melamine',
        multiplier: 1.0,
        finishPremium: 0,
        shippingFactor: 0.05
    }
];

// Map generic AI terms to SKUs and Prices
// Deterministic Mock Pricing Database - Keys updated to match Normalized Codes
export const PRICING_DB: Record<string, Record<string, { sku: string; price: number }>> = {
    'line_builder': {
        'B30': { sku: 'B30', price: 210.00 },
        'B15': { sku: 'B15', price: 150.00 },
        'B18': { sku: 'B18', price: 165.00 },
        'B24': { sku: 'B24', price: 180.00 },
        'B36': { sku: 'B36', price: 240.00 },
        'SB36': { sku: 'SB36', price: 250.00 },
        'SB33': { sku: 'SB33', price: 235.00 },
        'DB18': { sku: 'DB18', price: 340.00 },
        'DB24': { sku: 'DB24', price: 380.00 },
        'W3030': { sku: 'W3030', price: 180.00 },
        'W1530': { sku: 'W1530', price: 120.00 },
        'W1830': { sku: 'W1830', price: 140.00 },
        'W3924': { sku: 'W3924', price: 220.00 },
        'BBC42': { sku: 'BBC42', price: 420.00 },
        'LS36': { sku: 'LS36', price: 480.00 },
        'U2484': { sku: 'U2484', price: 550.00 },
        'T2484': { sku: 'T2484', price: 550.00 },
        'REP': { sku: 'REP', price: 120.00 },
        'DWR': { sku: 'DWR', price: 60.00 },
        'GEN': { sku: 'GEN', price: 150.00 }
    }
};

export const MOCK_PROJECT_DEFAULTS = {
    dealerName: "KABS DEALER INC.",
    dealerAddress: "123 Design District, San Francisco, CA 94103",
    dealerPhone: "(555) 123-4567",
    clientName: "Jane Doe",
    projectName: "Sunnyvale Kitchen Remodel",
    address: "450 Enterprise Way, Sunnyvale, CA",
    date: new Date().toLocaleDateString(),
    manufacturerName: "Builder Series"
};

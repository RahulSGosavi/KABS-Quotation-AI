
import { CABINET_LINES, MASTER_CATALOG } from '../constants';
import { QuoteItem, CabinetLine, BOMItem } from '../types';

/**
 * Normalizes SKU strings to find matches in the catalog.
 * STRICT RULES:
 * - .1 .2 .3 -> Remove
 * - BUTT, ET, AO, 1TD, 2TD, 24 DP -> Option (Remove from Base Code)
 * - L / R -> Orientation (Remove from Base Code)
 */
export const normalizeSku = (input: string): string => {
    if (!input) return "";

    let s = input.toUpperCase().trim();

    // 1. Remove Quantity/Tag suffixes like .1 .2 .3
    s = s.replace(/\.[0-9]+$/, ''); 
    s = s.replace(/\.[0-9]+\s/, ' ');

    // 2. Remove Specific Options defined in rules
    // Handle "X 24 DP" and "24 DP"
    s = s.replace(/\s*X\s*24\s*DP/g, '');
    s = s.replace(/\s*24\s*DP/g, '');
    
    const optionsToRemove = ['BUTT', 'ET', 'AO', '1TD', '2TD', '3TD', '4DXROT', 'ROT', 'VAL', 'TK', 'CM'];
    optionsToRemove.forEach(opt => {
        // Remove if standalone or dot-separated
        s = s.replace(new RegExp(`\\.?${opt}\\.?`, 'g'), '');
    });

    // 3. Remove L/R orientation at the very end
    if (s.endsWith('L') || s.endsWith('R')) {
        // Simple logic: strip last char if L or R
        s = s.slice(0, -1);
    }

    // 4. Clean up non-alphanumeric (dots, spaces left over)
    s = s.replace(/[^A-Z0-9]/g, '');
    
    return s;
};

/**
 * Robust Matching Logic: Sorting and Matching against Pricing Sheets
 * 1. Exact Normalized Match
 * 2. Exact Raw SKU Match
 * 3. Variant Check (L/R)
 * 4. Fuzzy Prefix Sort (Find closest SKU that starts with the base code)
 */
export const findCatalogMatch = (
    item: { sku?: string; description?: string; rawCode?: string },
    pricingDB: Record<string, { sku: string; price: number }>
): { match: { sku: string; price: number } | null; matchType: 'exact' | 'variant' | 'fuzzy' | null } => {
    const rawSku = item.rawCode || item.sku || "";
    const normalizedKey = normalizeSku(rawSku || item.description || "");
    
    // 1. Exact Normalized Key
    if (pricingDB[normalizedKey]) {
        return { match: pricingDB[normalizedKey], matchType: 'exact' };
    }

    // 2. Exact Raw SKU (Cleaned)
    const cleanRaw = rawSku.toUpperCase().trim();
    if (cleanRaw && pricingDB[cleanRaw]) {
        return { match: pricingDB[cleanRaw], matchType: 'exact' };
    }

    // 3. Orientation Variants
    const variants = ['L', 'R', ' L', ' R'];
    for (const v of variants) {
        if (pricingDB[normalizedKey + v]) {
            return { match: pricingDB[normalizedKey + v], matchType: 'variant' };
        }
    }

    // 4. Fuzzy / Prefix Sort Match
    // Get all keys, filter by prefix matching normalized key
    const dbKeys = Object.keys(pricingDB);
    const candidates = dbKeys.filter(k => k.startsWith(normalizedKey));
    
    if (candidates.length > 0) {
        // Sort by length ascending (closest match to base code first)
        // e.g. B15, B15L, B15-Left
        candidates.sort((a, b) => a.length - b.length);

        for (const key of candidates) {
            const suffix = key.slice(normalizedKey.length);
            
            // Ensure suffix implies a variant (starts with letter or separator), not a different number
            // Allowed: "B15L", "B15-L", "B15 Left"
            // Disallowed: "B150" (suffix '0'), "B152" (suffix '2')
            if (suffix.length === 0) continue; // Should have been exact match
            if (/^\d/.test(suffix)) continue; // Starts with digit, likely different SKU (e.g. B15 matching B150)

            return { match: pricingDB[key], matchType: 'fuzzy' };
        }
    }

    return { match: null, matchType: null };
};

/**
 * Provides a relevant estimate price based on the SKU prefix if an exact match isn't found.
 */
export const getSmartEstimate = (sku: string, tier: string): number => {
    const s = sku.toUpperCase();
    let base = 150;

    if (s.startsWith('B')) base = 220; // Base
    else if (s.startsWith('W')) base = 180; // Wall
    else if (s.startsWith('SB') || s.startsWith('SINK')) base = 280; // Sink Base
    else if (s.startsWith('DB') || s.startsWith('DRAWER')) base = 350; // Drawer Base
    else if (s.startsWith('U') || s.startsWith('TALL')) base = 600; // Tall
    else if (s.startsWith('P') || s.startsWith('PANEL')) base = 120; // Panel
    else if (s.startsWith('LS') || s.startsWith('BBC') || s.startsWith('WDC')) base = 450; // Corner

    const multiplier = tier === 'Premium' ? 2.5 : tier === 'Mid-Range' ? 1.6 : 1.0;
    return Math.round(base * multiplier);
};

/**
 * Validates the AI-generated BOM against the Manufacturer's Pricing DB.
 * Implements strict "Found vs Estimate" logic.
 */
export const validateBOMAgainstCatalog = (
    bomCandidates: BOMItem[],
    pricingDB: Record<string, { sku: string; price: number }>,
    tier: string = 'Mid-Range'
): BOMItem[] => {
    return bomCandidates.map(item => {
        // Use the new robust matching logic
        const { match } = findCatalogMatch(item, pricingDB);
        
        const normalizedKey = normalizeSku(item.rawCode || item.sku || item.description || "");
        
        let status = "estimate";
        let finalPrice = 0;

        if (match) {
            status = 'verified';
            finalPrice = match.price;
        } else {
            // STEP 6: Estimate Handling
            finalPrice = getSmartEstimate(normalizedKey, tier);
            status = 'estimate'; // Explicitly label as estimate
        }

        return {
            ...item,
            sku: match ? match.sku : normalizedKey, // Use matched SKU if found, otherwise normalized key
            normalizedCode: normalizedKey,
            verificationStatus: status,
            unitPrice: finalPrice,
            totalPrice: finalPrice * item.quantity,
            description: item.description
        };
    });
};

export const validateSku = (sku: string, lineId: string): { isValid: boolean; catalogItem?: any; message?: string } => {
    const item = MASTER_CATALOG.find(i => i.sku.toUpperCase() === sku.toUpperCase());
    if (!item) return { isValid: false, message: 'SKU not found in Master Catalog' };
    if (!item.availableLines.includes(lineId)) return { isValid: false, message: `SKU not in Line ${lineId}` };
    return { isValid: true, catalogItem: item };
};

export const calculateItemPrice = (
    sku: string, 
    lineId: string, 
    quantity: number,
    options: string[] = []
): { unitPrice: number; totalPrice: number; isValid: boolean; description: string; validationMessage?: string } => {
    const line = CABINET_LINES.find(l => l.id === lineId);
    if (!line) throw new Error("Invalid Line ID");
    const validation = validateSku(sku, lineId);
    if (!validation.isValid || !validation.catalogItem) {
        return { unitPrice: 0, totalPrice: 0, isValid: false, description: validation.message || 'Error', validationMessage: validation.message };
    }
    const item = validation.catalogItem;
    let adjustedUnitPrice = item.basePrice * line.multiplier * (1 + line.finishPremium) + (options.length * 25);
    return {
        unitPrice: Math.round(adjustedUnitPrice * 100) / 100,
        totalPrice: Math.round(adjustedUnitPrice * quantity * 100) / 100,
        isValid: true,
        description: item.description
    };
};

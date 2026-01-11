import { CABINET_LINES, MASTER_CATALOG } from '../constants';
import { QuoteItem, CabinetLine, BOMItem, CabinetDimensions, CabinetType, CatalogItem } from '../types';

/**
 * Normalizes SKU strings to strictly follow NKBA naming conventions (e.g. B30, W3030).
 * This acts as the bridge between raw drawing text and the Pricing Database.
 * 
 * NKBA RULES:
 * - Base: B[Width] (e.g., B30)
 * - Wall: W[Width][Height] (e.g., W3030)
 * - Tall: U[Width][Height] (e.g., U1884)
 * - Sink: SB[Width]
 * - Drawer: DB[Width]
 */
export const normalizeSku = (input: string): string => {
    if (!input) return "";

    let s = input.toUpperCase().trim();

    // 1. Clean common delimiters and dimension markers
    s = s.replace(/["']|INCH|IN/g, ''); // Remove inch markers
    s = s.replace(/[\.\-\,\_]/g, ' '); // Replace separators with space
    
    // 2. Map Verbose Types to NKBA Prefixes
    const typeMap: [RegExp, string][] = [
        // Specific Types first
        [/\b(SINK BASE|SB|SINK)\b/g, 'SB'],
        [/\b(DRAWER BASE|DB|DRAWER BANK|DRAWERS|DRAWER)\b/g, 'DB'],
        [/\b(LAZY SUSAN|LS|CORNER BASE|CB)\b/g, 'LS'],
        [/\b(BLIND CORNER|BC|BBC)\b/g, 'BBC'],
        [/\b(WALL DIAGONAL|WDC|DIAGONAL CORNER|DC)\b/g, 'WDC'],
        [/\b(UTILITY|TALL|PANTRY|OVEN CABINET|OVEN)\b/g, 'U'],
        [/\b(REFRIGERATOR RETURN|REF RETURN|RR)\b/g, 'RR'],
        
        // Fillers & Accessories
        [/\b(BASE FILLER|BF)\b/g, 'BF'],
        [/\b(WALL FILLER|WF)\b/g, 'WF'],
        [/\b(TALL FILLER|TF)\b/g, 'TF'],
        [/\b(TOE KICK|TK)\b/g, 'TK'],
        [/\b(CROWN MOLDING|CROWN|CM)\b/g, 'CM'],
        [/\b(SCRIBE|SM)\b/g, 'SM'],
        [/\b(QUARTER ROUND|QR)\b/g, 'QR'],
        [/\b(DISHWASHER PANEL|DWP)\b/g, 'DWP'],
        [/\b(REFRIGERATOR PANEL|FRIDGE PANEL|REP)\b/g, 'REP'],
        
        // Generic Types (Last to avoid overwriting specifics)
        [/\b(BASE CABINET|BASE)\b/g, 'B'],
        [/\b(WALL CABINET|WALL|UPPER)\b/g, 'W'],
        [/\b(VANITY)\b/g, 'V'],
    ];

    typeMap.forEach(([regex, prefix]) => {
        s = s.replace(regex, prefix);
    });

    // 3. Handle Reversed Syntax: "30 B" -> "B 30"
    // Matches "30" followed by "B" or other prefix
    const numPrefixMatch = s.match(/^(\d{2,3})\s*([A-Z]{1,3})\b/);
    if (numPrefixMatch) {
        // Swap to Prefix Number
        s = s.replace(numPrefixMatch[0], `${numPrefixMatch[2]}${numPrefixMatch[1]}`);
    }

    // 4. Remove Noise (1951 or Drawing specifics)
    s = s.replace(/\b(BUTT|L|R|HINGE|LEFT|RIGHT|STD)\b/g, ''); 
    
    // 5. Remove Depth Info (Implicit in NKBA standard codes unless non-standard)
    // Matches "X 24 D", "24 DP", "24 DEPTH"
    s = s.replace(/\s*[X]?\s*\d{1,2}\.?\d*\s*(D|DP|DEPTH)\b/g, '');

    // 6. Final Cleanup: Remove spaces and non-alphanumeric chars
    // "B 30" -> "B30"
    s = s.replace(/[^A-Z0-9]/g, '');
    
    return s;
};

/**
 * Parses a standard cabinet code into physical dimensions and type.
 */
export const parseCabinetDimensions = (rawCode: string): CabinetDimensions | null => {
    const code = normalizeSku(rawCode);
    if (!code) return null;

    // 1. Wall Cabinets (W + Width + Height) e.g. W3030
    const wallMatch = code.match(/^(W|WC|WDC|WBC)(\d{2})(\d{2})?$/);
    if (wallMatch) {
        return {
            type: CabinetType.WALL,
            width: parseInt(wallMatch[2]),
            height: wallMatch[3] ? parseInt(wallMatch[3]) : 30, 
            depth: 12,
            code
        };
    }

    // 2. Base Cabinets (B + Width) e.g. B18, PB36
    const baseMatch = code.match(/^(B|SB|DB|BBC|LS|BC|PB)(\d{2})/); // Added PB
    if (baseMatch) {
        return {
            type: CabinetType.BASE,
            width: parseInt(baseMatch[2]),
            height: 34.5,
            depth: 24,
            code
        };
    }

    // 3. Tall Cabinets (U/T/RR + Width + Height) e.g. U1884, RR96
    const tallMatch = code.match(/^(U|T|TP|RR)(\d{2,3})(\d{2})?/); // RR96 might not have width in name clearly or is 96 high
    if (tallMatch) {
        // RR96 usually means Ref Return 96 High. Width might be implied.
        // If code is RR96, group 2 is 96.
        if (tallMatch[1] === 'RR') {
             return {
                type: CabinetType.TALL,
                width: 3, // 3" panel usually
                height: parseInt(tallMatch[2]),
                depth: 24,
                code
            };
        }
        return {
            type: CabinetType.TALL,
            width: parseInt(tallMatch[2]),
            height: tallMatch[3] ? parseInt(tallMatch[3]) : 84,
            depth: 24,
            code
        };
    }

    // 4. Panels/Fillers/Accessories (Standard Prefixes)
    if (code.startsWith('WF') || code.startsWith('BF') || code.startsWith('TK') || code.startsWith('CM') || code.startsWith('REP') || code.startsWith('DWR') || code.startsWith('DWP')) {
        const numMatch = code.match(/\d+/);
        const width = numMatch ? parseInt(numMatch[0]) : 3; // Default 3" for fillers/panels if no number
        const isWall = code.startsWith('W');
        return {
            type: CabinetType.ACCESSORY,
            width: width, 
            height: isWall ? 30 : 34.5,
            depth: 0,
            code
        };
    }

    // 5. Vanity Fallback
    if (code.startsWith('V') || code.startsWith('VSB')) {
         const numMatch = code.match(/\d+/);
         if (numMatch) {
             return {
                 type: CabinetType.VANITY,
                 width: parseInt(numMatch[0]),
                 height: 34.5,
                 depth: 21,
                 code
             }
         }
    }
    
    // 6. Hardware (Heuristic)
    if (code.includes('HINGE') || code.includes('GLIDE') || code.includes('PULL') || code.includes('KNOB') || code.includes('CONN') || code.includes('SCREW')) {
        return {
            type: CabinetType.HARDWARE,
            width: 0, height: 0, depth: 0, code
        }
    }

    // 8. Generic Fallback: Extract ANY number as width
    const genericNum = code.match(/(\d+)/);
    if (genericNum) {
         return {
            type: CabinetType.ACCESSORY,
            width: parseInt(genericNum[1]),
            height: 0,
            depth: 0,
            code
         };
    }

    return {
        type: CabinetType.UNKNOWN,
        width: 0,
        height: 0,
        depth: 0,
        code
    };
};

/**
 * Attempts to find a matching SKU in the DB by looking for the nearest numeric size.
 * e.g. Input: B17 -> Finds B18 (closest larger) or B15 (closest smaller).
 */
const findNearestSizeMatch = (
    normalizedKey: string,
    pricingDB: Record<string, { sku: string; price: number }>
): { sku: string; price: number; matchType: string } | null => {
    
    // Extract Prefix and Number (e.g. B and 17)
    const match = normalizedKey.match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;

    const prefix = match[1];
    const targetSize = parseInt(match[2]);

    let bestMatch: string | null = null;
    let minDiff = Number.MAX_VALUE;

    // Iterate DB keys to find same prefix
    Object.keys(pricingDB).forEach(key => {
        const dbMatch = key.match(/^([A-Z]+)(\d+)$/);
        if (dbMatch && dbMatch[1] === prefix) {
            const dbSize = parseInt(dbMatch[2]);
            const diff = Math.abs(dbSize - targetSize);
            
            // Priority: Exact > Closest.
            // If diff is same (e.g. 17 is between 16 and 18), prefer larger (18) to be safe on price.
            if (diff < minDiff || (diff === minDiff && dbSize > targetSize)) {
                minDiff = diff;
                bestMatch = key;
            }
        }
    });

    if (bestMatch && minDiff <= 6) { // Only match if within 6 inches to prevent B12 matching B99
        return { ...pricingDB[bestMatch], matchType: 'nearest_size' };
    }

    return null;
};

/**
 * SMART CATALOG MATCHER
 */
export const findBestCatalogMatch = (
    normalizedKey: string,
    rawCode: string,
    pricingDB: Record<string, { sku: string; price: number }>
): { sku: string; price: number; matchType: string } | null => {
    
    // 1. Direct Match (Normalized)
    if (pricingDB[normalizedKey]) {
        return { ...pricingDB[normalizedKey], matchType: 'exact_norm' };
    }

    // 2. Direct Match (Raw)
    if (pricingDB[rawCode]) {
        return { ...pricingDB[rawCode], matchType: 'exact_raw' };
    }

    // 3. Category Fallback (e.g. BF3 -> BF)
    // Try stripping numbers to find a generic category price
    const categoryKey = normalizedKey.replace(/\d+/g, '');
    if (categoryKey && pricingDB[categoryKey]) {
        return { ...pricingDB[categoryKey], matchType: 'category_fallback' };
    }

    // 4. Nearest Size Match (e.g. B17 -> B18)
    const sizeMatch = findNearestSizeMatch(normalizedKey, pricingDB);
    if (sizeMatch) return sizeMatch;

    // 5. Fuzzy Match / Fallback Logic (Substring)
    const dbKeys = Object.keys(pricingDB);
    for (const key of dbKeys) {
        if (normalizedKey.startsWith(key) && Math.abs(normalizedKey.length - key.length) < 3) {
             return { ...pricingDB[key], matchType: 'fuzzy_start' };
        }
    }

    return null;
}

/**
 * Validates the AI-generated BOM using Manufacturer Pricing Guide.
 * STRICT: Unit Price must come from the Pricing Guide.
 */
export const validateBOMAgainstCatalog = (
    bomCandidates: BOMItem[],
    pricingDB: Record<string, { sku: string; price: number }>, // Exact match DB
    activeLine?: CabinetLine // Line config for Multiplier
): BOMItem[] => {
    // Fallback if no line provided
    const defaultRates: CabinetLine = activeLine || {
        id: 'default',
        name: 'Standard',
        tier: 'Mid-Range',
        description: '',
        finish: '',
        multiplier: 1, // Default multiplier
        finishPremium: 0,
        shippingFactor: 0.05
    };

    return bomCandidates.map(item => {
        // STEP 1: Normalize to NKBA Standards first
        const normalizedKey = normalizeSku(item.rawCode || item.sku || item.description || "");
        const rawCode = item.rawCode || "";

        // STEP 2: Find best match in Manufacturer DB using NKBA key
        const match = findBestCatalogMatch(normalizedKey, rawCode, pricingDB);
        
        if (match) {
             // For Generic/Category matches, we might want to keep the ORIGINAL dimensions if possible, 
             // but use the Generic price.
             // e.g. Input BF3 (3"), Matched BF ($50). We want description to still say "3 inch".
             
             let dims = parseCabinetDimensions(match.sku);
             // If we matched a category (e.g. BF) but had specific input (BF3), try to re-parse input for dimensions
             if (match.matchType === 'category_fallback') {
                 const originalDims = parseCabinetDimensions(normalizedKey);
                 if (originalDims && originalDims.width > 0) {
                     dims = originalDims;
                 }
             }

             // APPLY MULTIPLIER: Catalog Price * Line Multiplier
             const finalUnitPrice = match.price * defaultRates.multiplier;

             return {
                ...item,
                sku: match.sku, // Use the official catalog SKU or Category Code
                normalizedCode: normalizedKey,
                verificationStatus: 'verified',
                unitPrice: finalUnitPrice,
                totalPrice: finalUnitPrice * item.quantity,
                description: item.description || match.sku,
                dimensions: dims || undefined,
                verificationProof: {
                    manufacturer: defaultRates.name,
                    catalogSource: "Manufacturer Pricing Guide",
                    matchType: match.matchType as any,
                    matchedCode: match.sku,
                    isQuoted: true,
                    pricingMethod: 'unit',
                    calculationDetails: `Unit Price $${match.price} x Multiplier ${defaultRates.multiplier}`
                }
            };
        }

        // NO MATCH FOUND - DO NOT GUESS SIZE PRICE.
        // Return 0 price and mark for review.
        return {
            ...item,
            sku: normalizedKey || item.sku,
            normalizedCode: normalizedKey,
            verificationStatus: 'missing',
            unitPrice: 0,
            totalPrice: 0,
            description: item.description || "Unknown Item - No Catalog Match",
        };
    });
};

/**
 * Calculates item price using the full pricing logic (Smart Match, Category Fallback, Nearest Size).
 * Must be called with the specific line's pricing DB.
 */
export const calculateItemPrice = (
    rawSku: string, 
    pricingDB: Record<string, { sku: string; price: number }>,
    lineConfig: CabinetLine
): { unitPrice: number; isValid: boolean; description: string; validationMessage?: string } => {
    
    // Normalize input to NKBA before lookup
    const normalizedKey = normalizeSku(rawSku);
    
    // Use the smart matcher to find best price
    const match = findBestCatalogMatch(normalizedKey, rawSku, pricingDB);

    if (match) {
        // Calculate with multiplier
        const unitPrice = match.price * lineConfig.multiplier;
        
        let desc = match.sku;
        if (match.matchType === 'category_fallback') desc += " (Category Match)";
        if (match.matchType === 'nearest_size') desc += " (Nearest Size)";

        return {
            unitPrice: unitPrice,
            isValid: true,
            description: desc,
            validationMessage: undefined
        };
    }

    return {
        unitPrice: 0,
        isValid: false, 
        description: "Unknown Item",
        validationMessage: "Item not found in catalog" 
    };
};
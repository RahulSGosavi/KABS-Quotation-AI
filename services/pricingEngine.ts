
import { CABINET_LINES, MASTER_CATALOG } from '../constants';
import { QuoteItem, CabinetLine, BOMItem, CabinetDimensions, CabinetType, CatalogItem } from '../types';

/**
 * Normalizes SKU strings to find matches in the catalog.
 */
export const normalizeSku = (input: string): string => {
    if (!input) return "";

    let s = input.toUpperCase().trim();

    // 0. Pre-process Full Words
    s = s.replace(/\bBASE\b/g, 'B');
    s = s.replace(/\bWALL\b/g, 'W');
    s = s.replace(/\bTALL\b/g, 'T');
    s = s.replace(/\bVANITY\b/g, 'V');
    s = s.replace(/\bDRAWER\b/g, 'DB');
    s = s.replace(/\bSINK\b/g, 'SB');

    // 1. Remove " X 24 DP" and similar depth modifications
    s = s.replace(/\s*X\s*\d+\s*DP/g, ''); 
    s = s.replace(/\s*\d+\s*DP/g, '');

    // 2. Remove Quantity/Tag suffixes
    s = s.replace(/[-.]\d+$/, ''); 

    // 3. Remove Orientation
    s = s.replace(/-\d+[LR]$/, ''); 
    s = s.replace(/-\d+$/, ''); 
    s = s.replace(/[- ]?[LR]$/, ''); 

    // 4. Handle embedded configuration patterns
    s = s.replace(/\d+D\d+B/, ''); 

    // 5. Remove Specific Options
    const optionsToRemove = ['BUTT', 'ET', 'AO', '1TD', '2TD', '3TD', '4DXROT', 'ROT', 'VAL', 'TK', 'CM', 'DEP', 'WF'];
    optionsToRemove.forEach(opt => {
        s = s.replace(new RegExp(`\\.?${opt}\\.?`, 'g'), '');
    });

    // Remove non-alphanumeric chars (spaces, hyphens) to normalize B 30 -> B30
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

    // 2. Base Cabinets (B + Width) e.g. B18
    const baseMatch = code.match(/^(B|SB|DB|BBC|LS|BC)(\d{2})$/);
    if (baseMatch) {
        return {
            type: CabinetType.BASE,
            width: parseInt(baseMatch[2]),
            height: 34.5,
            depth: 24,
            code
        };
    }

    // 3. Tall Cabinets (U/T + Width + Height) e.g. U1884
    const tallMatch = code.match(/^(U|T|TP)(\d{2})(\d{2})$/);
    if (tallMatch) {
        return {
            type: CabinetType.TALL,
            width: parseInt(tallMatch[2]),
            height: parseInt(tallMatch[3]),
            depth: 24,
            code
        };
    }

    // 4. Panels/Fillers/Accessories (Standard Prefixes)
    if (code.startsWith('WF') || code.startsWith('BF') || code.startsWith('TK') || code.startsWith('CM') || code.startsWith('REP') || code.startsWith('DWR')) {
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

    // 7. Special Cases (ALP10W, WAIN01)
    
    // Handle suffix W (e.g. ALP10W -> 10" Wide)
    const suffixWMatch = code.match(/^([A-Z]+)(\d+)W$/);
    if (suffixWMatch) {
        return { 
            type: CabinetType.ACCESSORY, 
            width: parseInt(suffixWMatch[2]), 
            height: 30, 
            depth: 0.75, 
            code 
        };
    }

    // Handle Wainscoting (WAIN)
    if (code.startsWith('WAIN')) {
        return {
            type: CabinetType.ACCESSORY,
            width: 96, // Assume 8ft sheet
            height: 36,
            depth: 0.25,
            code
        };
    }

    // 8. Generic Fallback: Extract ANY number as width
    const genericNum = code.match(/(\d+)/);
    if (genericNum) {
         // If it has a number, assume it's a width-based accessory if we can't identify it
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
 * DEALER SIZE-BASED PRICING LOGIC
 */
export const calculateSizeBasedPrice = (
    item: { sku?: string; description?: string; rawCode?: string },
    line: CabinetLine
): { 
    price: number; 
    matchType: 'size_based'; 
    matchedDimensions: string;
    pricingMethod: 'linear_foot' | 'unit';
    calculationDetails: string;
    isValid: boolean;
} => {
    const rawSku = item.rawCode || item.sku || "";
    const dims = parseCabinetDimensions(rawSku);

    const rates = line.rates || {
        basePerFoot: 200,
        wallPerFoot: 150,
        tallPerUnit: 800,
        accessoryPerFoot: 50
    };

    if (!dims || dims.type === CabinetType.UNKNOWN) {
        return {
            price: 0,
            matchType: 'size_based',
            matchedDimensions: 'Unknown',
            pricingMethod: 'unit',
            calculationDetails: 'Invalid Code',
            isValid: false
        };
    }

    let price = 0;
    let pricingMethod: 'linear_foot' | 'unit' = 'linear_foot';
    let calculationDetails = "";

    const linearFeet = dims.width / 12;

    if (dims.type === CabinetType.BASE || dims.type === CabinetType.VANITY) {
        price = linearFeet * rates.basePerFoot;
        pricingMethod = 'linear_foot';
        calculationDetails = `${dims.width}" (${linearFeet.toFixed(2)} LF) x $${rates.basePerFoot}/ft`;
    
    } else if (dims.type === CabinetType.WALL) {
        price = linearFeet * rates.wallPerFoot;
        pricingMethod = 'linear_foot';
        calculationDetails = `${dims.width}" (${linearFeet.toFixed(2)} LF) x $${rates.wallPerFoot}/ft`;

    } else if (dims.type === CabinetType.TALL) {
        price = rates.tallPerUnit;
        pricingMethod = 'unit';
        calculationDetails = `Flat Rate (Tall Unit)`;

    } else if (dims.type === CabinetType.ACCESSORY) {
        price = linearFeet * rates.accessoryPerFoot;
        pricingMethod = 'linear_foot';
        calculationDetails = `${dims.width}" (${linearFeet.toFixed(2)} LF) x $${rates.accessoryPerFoot}/ft`;
    
    } else if (dims.type === CabinetType.HARDWARE) {
        price = 15; // Flat rate fallback for hardware
        pricingMethod = 'unit';
        calculationDetails = 'Hardware Estimate';
    }
    
    return {
        price: Math.max(1, Math.round(price)), 
        matchType: 'size_based',
        matchedDimensions: `${dims.width}"W x ${dims.height}"H`,
        pricingMethod,
        calculationDetails,
        isValid: true
    };
};

/**
 * Validates the AI-generated BOM using a Hybrid Dealer Model.
 */
export const validateBOMAgainstCatalog = (
    bomCandidates: BOMItem[],
    pricingDB: Record<string, { sku: string; price: number }>, // Exact match DB
    activeLine?: CabinetLine // Line config for size-based rates
): BOMItem[] => {
    // Fallback if no line provided
    const defaultRates: CabinetLine = activeLine || {
        id: 'default',
        name: 'Standard',
        tier: 'Mid-Range',
        description: '',
        finish: '',
        multiplier: 1,
        finishPremium: 0,
        shippingFactor: 0.05,
        rates: { basePerFoot: 250, wallPerFoot: 200, tallPerUnit: 1000, accessoryPerFoot: 100 }
    };

    return bomCandidates.map(item => {
        const normalizedKey = normalizeSku(item.rawCode || item.sku || item.description || "");
        const rawCode = item.rawCode || "";

        // 1. CHECK MANUFACTURER CATALOG (Exact SKU Match)
        const strictMatch = pricingDB[normalizedKey] || pricingDB[rawCode];
        
        if (strictMatch) {
             const dims = parseCabinetDimensions(strictMatch.sku);
             return {
                ...item,
                sku: strictMatch.sku,
                normalizedCode: normalizedKey,
                verificationStatus: 'verified',
                unitPrice: strictMatch.price,
                totalPrice: strictMatch.price * item.quantity,
                description: item.description || strictMatch.sku,
                dimensions: dims || undefined,
                verificationProof: {
                    manufacturer: defaultRates.name,
                    catalogSource: "Manufacturer Catalog",
                    matchType: 'exact',
                    matchedCode: strictMatch.sku,
                    isQuoted: true,
                    pricingMethod: 'sku',
                    calculationDetails: `Catalog Price (${defaultRates.name})`
                }
            };
        }

        // 2. FALLBACK TO SIZE-BASED PRICING
        const { price, matchType, matchedDimensions, pricingMethod, calculationDetails, isValid } = calculateSizeBasedPrice(item, defaultRates);

        if (isValid) {
            const dims = parseCabinetDimensions(normalizedKey);
            return {
                ...item,
                sku: normalizedKey,
                normalizedCode: normalizedKey,
                verificationStatus: 'verified',
                unitPrice: price,
                totalPrice: price * item.quantity,
                description: item.description || `${dims?.type || 'Item'} - ${dims?.width || '?'}W x ${dims?.height || '?'}H`,
                dimensions: dims || undefined,
                verificationProof: {
                    manufacturer: defaultRates.name,
                    catalogSource: "Dealer Rate Sheet",
                    matchType: matchType,
                    matchedCode: normalizedKey,
                    matchedDimensions: matchedDimensions,
                    pricingMethod: pricingMethod,
                    isQuoted: true,
                    calculationDetails: calculationDetails
                }
            };
        }

        // 3. REMOVE / MARK INVALID
        return {
            ...item,
            sku: normalizedKey,
            normalizedCode: normalizedKey,
            verificationStatus: 'missing',
            unitPrice: 0,
            totalPrice: 0,
            description: item.description || "Unknown Item",
        };
    });
};

export const calculateItemPrice = (
    sku: string, 
    lineId: string, 
    quantity: number,
    options: string[] = []
): { unitPrice: number; totalPrice: number; isValid: boolean; description: string; validationMessage?: string } => {
    const line = CABINET_LINES.find(l => l.id === lineId);
    if (!line) return { unitPrice: 0, totalPrice: 0, isValid: false, description: "Unknown Line" };

    const item = { sku, rawCode: sku, description: sku };
    const { price, isValid, matchedDimensions } = calculateSizeBasedPrice(item as any, line);

    if (!isValid) {
        return { 
            unitPrice: 0, 
            totalPrice: 0, 
            isValid: false, 
            description: "Invalid/Non-Cabinet Item", 
            validationMessage: "Could not determine dimensions from code." 
        };
    }

    return {
        unitPrice: price,
        totalPrice: price * quantity,
        isValid: true,
        description: `Cabinet ${matchedDimensions}`
    };
};

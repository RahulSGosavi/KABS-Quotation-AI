
// Demo Domain Models

export type DemoStep = 'start' | 'upload' | 'bom' | 'line-switch' | 'details' | 'quote' | 'admin-login' | 'admin-dashboard';

export enum CabinetType {
    BASE = 'Base',
    WALL = 'Wall',
    TALL = 'Tall',
    ACCESSORY = 'Accessory',
    VANITY = 'Vanity',
    HARDWARE = 'Hardware',
    UNKNOWN = 'Unknown'
}

export interface CabinetDimensions {
    type: CabinetType;
    width: number;
    height: number;
    depth: number;
    code: string; // The normalized design code (e.g. W3030)
}

export interface CatalogItem {
    sku: string;
    description: string;
    type: CabinetType;
    basePrice: number;
    width: number;
    depth: number;
    height: number;
    availableLines: string[];
}

export interface VerificationProof {
    manufacturer: string;
    catalogSource: string; // e.g. "Excel Catalog"
    matchType: 'exact' | 'dimension_match' | 'variant' | 'fuzzy' | 'size_based';
    matchedCode: string;
    matchedDimensions?: string; // e.g. "30W x 30H"
    isQuoted: boolean; // True only if verified
    pricingMethod?: 'sku' | 'linear_foot' | 'unit';
    calculationDetails?: string; // NEW: Stores the math (e.g. "2.5 LF x $200")
}

export interface BOMItem {
    id: string;
    type: string; // e.g., "Base Cabinet", "Wall Cabinet"
    description: string;
    quantity: number;
    // The following are populated during the Pricing phase
    sku?: string;
    unitPrice?: number;
    totalPrice?: number;
    
    // Multi-manufacturer support
    selectedLineId?: string;
    pricingOptions?: { lineId: string; lineName: string; price: number; type: 'verified' | 'estimate' | 'missing' | 'review_required' }[];

    // New fields for AI Chat Interaction
    fixedPrice?: number; // If set, overrides catalog lookup (AI determined price)
    aiReasoning?: string; // Explanation for the override (e.g. "Calculated as 3 drawers @ $50")
    isEstimate?: boolean;
    verificationStatus?: 'verified' | 'estimate' | 'missing' | 'review_required';
    verificationProof?: VerificationProof;

    // Strict lineage fields
    rawCode?: string;
    normalizedCode?: string;
    extractedOptions?: string[]; // e.g. ["FINISH END L", "Spec Depth 12"]
    
    // Dimensional Data
    dimensions?: CabinetDimensions;
}

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    timestamp: number;
}

export interface QuoteItem {
    id: string;
    tag: string;
    sku: string;
    type?: string;
    description: string;
    quantity: number;
    options: string[];
    unitPrice: number;
    totalPrice: number;
    isValid: boolean;
    validationMessage?: string;
}

export interface CatalogueFile {
    name: string;
    type: 'excel' | 'pdf' | 'nkba';
    lastUpdated: string;
    status: 'active' | 'processing' | 'missing';
}

export interface PricingRates {
    basePerFoot: number;
    wallPerFoot: number;
    tallPerUnit: number;
    accessoryPerFoot: number;
}

export interface CabinetLine {
    id: string;
    name: string;
    tier: 'Budget' | 'Mid-Range' | 'Premium';
    description: string;
    finish: string;
    multiplier: number;
    finishPremium: number;
    shippingFactor: number;
    // Admin specific
    catalogExcel?: CatalogueFile;
    guidelinesPdf?: CatalogueFile;
    // Size-based pricing
    rates?: PricingRates;
}

export interface ProjectSpecs {
    doorStyle: string;
    woodSpecies: string;
    stainColor: string;
    glaze: string;
    drawerBox: string;
    hinges: string;
    poNumber: string;
    soNumber: string;
}

export interface Project {
    id: string;
    name: string;
    clientName: string;
    address: string;
    createdAt: Date;
    updatedAt: Date;
    status: string;
}

export interface ProjectInfo {
    // Dealer Info
    dealerName: string;
    dealerAddress: string;
    dealerPhone: string;
    dealerEmail: string;
    // Client Info
    clientName: string;
    projectName: string;
    address: string;
    date: string;
    email: string;
    phone: string;
    // Manufacturer
    manufacturerName: string;
    specs: ProjectSpecs;
}

export interface DemoState {
    step: DemoStep;
    planImage: string | null; // Base64
    aiAnalysis: string | null;
    bom: BOMItem[];
    selectedLineId: string;
    projectInfo: ProjectInfo;
    // Data State (lifted for Admin modification)
    lines: CabinetLine[];
    pricingDatabase: Record<string, Record<string, { sku: string; price: number }>>;
    // Global Settings
    globalGuidelines: CatalogueFile | null;
    nkbaStandards: CatalogueFile | null; // New field for NKBA Standards
}

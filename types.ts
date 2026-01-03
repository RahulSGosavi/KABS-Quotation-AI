
// Demo Domain Models

export type DemoStep = 'start' | 'upload' | 'bom' | 'line-switch' | 'details' | 'quote' | 'admin-login' | 'admin-dashboard';

export enum CabinetType {
    BASE = 'Base',
    WALL = 'Wall',
    TALL = 'Tall',
    ACCESSORY = 'Accessory'
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
    pricingOptions?: { lineId: string; lineName: string; price: number; type: 'verified' | 'estimate' }[];

    // New fields for AI Chat Interaction
    fixedPrice?: number; // If set, overrides catalog lookup (AI determined price)
    aiReasoning?: string; // Explanation for the override (e.g. "Calculated as 3 drawers @ $50")
    isEstimate?: boolean;
    verificationStatus?: string;

    // Strict lineage fields
    rawCode?: string;
    normalizedCode?: string;
    extractedOptions?: string[];
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
    // Client Info
    clientName: string;
    projectName: string;
    address: string;
    date: string;
    // Manufacturer
    manufacturerName: string;
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
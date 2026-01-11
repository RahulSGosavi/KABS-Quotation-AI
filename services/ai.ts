import { GoogleGenAI, Type } from "@google/genai";
import { BOMItem, ChatMessage, DesignLayout, KitchenShape, ProjectSpecs } from "../types";
import { normalizeSku } from './pricingEngine';

// Lazy initialization to prevent top-level crashes if env is not ready
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Using gemini-3-flash-preview for the fastest possible 'Flash' performance
const MODEL_NAME = 'gemini-3-flash-preview';

const SYSTEM_INSTRUCTION = `You are a professional US kitchen cabinet billing engine.

You specialize in 1951 Cabinetry pricing.
You strictly follow drawing-based cabinet extraction.

You never guess prices.
You never skip steps.
Accuracy is mandatory.

🔴 HARD RULES (NEVER BREAK)
❌ Never guess prices
❌ Never skip validation
❌ Never mix cabinet + labor pricing
❌ Never auto-fill missing specs
❌ Never generate demo numbers

Your output must be strictly structured data extracted from the visual plan provided.
`;

/**
 * STEP 1: PURE EXTRACTION
 * Extracts ONLY a list of cabinet codes as strings.
 */
export async function analyzePlan(dataUrl: string): Promise<string[]> {
    const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match) return [];

    const mimeType = match[1];
    const data = match[2];

    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: {
                parts: [
                    { inlineData: { mimeType, data } },
                    {
                        text: `EXTRACT RAW CABINET CODES.
                        1. Scan the image for ALL text labels.
                        2. FILTER: Keep ONLY Cabinet Codes (e.g., B30, W3030, SB36, DB18, RR96, TK8, CM8, BF3).
                        3. EXCLUDE: Appliances (Ref, Range, DW), dimensions (30", 3'6"), room names, window labels (W1, W2).
                        4. PRESERVE duplicates (if there are two B30s, list B30 twice).
                        5. RETURN ONLY A JSON ARRAY OF STRINGS.
                        Example: ["B30", "SB36", "W3030", "W3030", "BF3"]
                        `
                    }
                ]
            },
            config: { 
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: "application/json",
                temperature: 0.1, 
                thinkingConfig: { thinkingBudget: 0 },
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });
        
        const rawText = response.text || "[]";
        return JSON.parse(rawText);
    } catch (error) {
        console.error("AI Analysis Error:", error);
        return [];
    }
}

// Helper to extract specs (kept for backward compatibility or future use)
export function extractProjectSpecs(aiText: string): Partial<ProjectSpecs> {
    return {}; // Specs are now handled manually in the workflow
}

// Keywords that indicate an item is NOT a cabinet
const EXCLUSION_KEYWORDS = [
    'FAUCET', 'HOOD', 'RANGE', 'FRIDGE', 'REFRIGERATOR', 'DISHWASHER', 'DW', 'MW', 'MICROWAVE', 'OVEN', 'COOKTOP', 'WINE',
    'LIGHT', 'LED', 'SWITCH', 'OUTLET', 'ELECTRICAL', 'J-BOX',
    'STEEL', 'BRACKET', 'SUPPORT', 'PIPE', 'PLUMBING',
    'TRASH', 'BIN', 'WASTE', 'RECYCLE',
    'CEILING', 'ELEC', 'PLUMB'
];

/**
 * STEP 4: CATEGORIZATION
 * Takes the Verified Raw Codes and groups them into BOM Items.
 */
export async function suggestBOM(rawCodes: string[]): Promise<any[]> {
    if (!rawCodes || rawCodes.length === 0) return [];

    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: `Perform CATEGORIZATION & GROUPING.
            
            INPUT: ${JSON.stringify(rawCodes)}
            
            RULES:
            1. Normalize: Remove 'BUTT', 'L', 'R' suffixes (PB36 1TD BUTT -> PB36 1TD).
            2. Categorize: 
               B/SB/PB/DB -> Base
               W/WDC -> Wall
               RR/U/T -> Tall
               TK/CM/BF/WF -> Accessory
            3. Description: Generate a short standard description (e.g. "Base 30 inch").
            
            IMPORTANT: Return JSON Array.
            `,
            config: {
                responseMimeType: "application/json",
                temperature: 0.0,
                thinkingConfig: { thinkingBudget: 0 },
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            rawCode: { type: Type.STRING },
                            type: { type: Type.STRING },
                            description: { type: Type.STRING },
                            quantity: { type: Type.NUMBER }
                        }
                    }
                }
            }
        });

        let text = response.text || "[]";
        text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
        const parsed = JSON.parse(text);
        
        // Filter out strict exclusions (Appliances)
        const filtered = parsed.filter((item: any) => {
            const code = (item.rawCode || "").toUpperCase();
            const desc = (item.description || "").toUpperCase();
            
            // 1. Check Keywords
            if (EXCLUSION_KEYWORDS.some(k => code.includes(k) || desc.includes(k))) return false;
            
            // 3. Check Appliance codes starting with non-cabinet prefixes
            if (code.startsWith('K-') || code.startsWith('RG-') || code.startsWith('BAR-')) return false;

            return true;
        });
        
        return filtered.map((item: any) => ({
            type: item.type || "Cabinet",
            description: item.description || item.rawCode,
            sku: (item.rawCode || "").toUpperCase(), 
            rawCode: item.rawCode,
            quantity: Math.max(1, Math.round(item.quantity || 1))
        }));
    } catch (error) {
        console.error("BOM Suggestion Error", error);
        return [];
    }
}

/**
 * Aggregates all extracted items by their Normalized Cabinet Code (Global Grouping).
 * Applies STRICT normalization rules.
 */
export function consolidateBOM(items: any[]): any[] {
    const globalGroup = new Map<string, any>();

    items.forEach(item => {
        const raw = item.rawCode || item.sku;
        const normalizedKey = normalizeSku(raw);
        
        if (globalGroup.has(normalizedKey)) {
            const existing = globalGroup.get(normalizedKey);
            existing.quantity += item.quantity;
        } else {
            globalGroup.set(normalizedKey, { 
                ...item, 
                sku: normalizedKey, 
                normalizedCode: normalizedKey,
                rawCode: raw
            });
        }
    });

    return Array.from(globalGroup.values());
}

export async function chatWithPricingAgent(
    history: ChatMessage[],
    currentBOM: BOMItem[],
    userMessage: string
): Promise<{ textResponse: string; updatedBOM: BOMItem[] }> {
    const systemPrompt = `You are 1951 Cabinetry Pricing Agent.
    Strictly follow 1951 rules.
    CONTEXT: ${JSON.stringify(currentBOM)}`;

    try {
        const ai = getAI();
        const chat = ai.chats.create({
            model: MODEL_NAME,
            config: { 
                responseMimeType: "application/json", 
                systemInstruction: systemPrompt,
                thinkingConfig: { thinkingBudget: 0 } 
            }
        });
        const result = await chat.sendMessage({ message: userMessage });
        const parsed = JSON.parse(result.text || "{}");
        const newBOM = [...currentBOM];
        (parsed.updates || []).forEach((u: any) => {
            if (newBOM[u.index]) newBOM[u.index] = { ...newBOM[u.index], ...u };
        });
        return { textResponse: parsed.textResponse || "Done.", updatedBOM: newBOM };
    } catch (error) {
        return { textResponse: "Error connecting to agent.", updatedBOM: currentBOM };
    }
}

// --- NEW FUNCTION: Design AI Layout Analysis ---
export async function analyzeLayout(dataUrl: string, hasNKBA: boolean, userShape: KitchenShape): Promise<DesignLayout> {
    const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match) throw new Error("Invalid file");

    const mimeType = match[1];
    const data = match[2];

    const prompt = `Analyze this floor plan measurements. The user wants to build a ${userShape} kitchen using 1951 Cabinetry standards.
    ${hasNKBA ? 'Reference NKBA Design Standards for spacing, work triangle, and landing zones.' : ''}
    
    1. Confirm the Layout Strategy for a ${userShape}.
    2. Analyze the zoning (Cooking, Cleaning, Prep).
    3. List the Conceptual Cabinets needed to achieve this ${userShape} layout.
       Assign 1951 standard codes (e.g. B30, SB36, W3030).
       
    Output JSON.`;

    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: {
                parts: [
                    { inlineData: { mimeType, data } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: "application/json",
                temperature: 0.2, // Slightly creative for design interpretation
                thinkingConfig: { thinkingBudget: 0 },
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        kitchenShape: { type: Type.STRING, enum: ['L-Shape', 'U-Shape', 'Galley', 'Island', 'Single Wall'] },
                        designNotes: { type: Type.STRING },
                        zoningAnalysis: { type: Type.STRING },
                        suggestedCabinets: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    sku: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    quantity: { type: Type.NUMBER }
                                }
                            }
                        }
                    }
                }
            }
        });

        const result = JSON.parse(response.text || "{}");
        // Force the shape to match user selection if AI drifts
        if (result) result.kitchenShape = userShape;
        return result;
    } catch (error) {
        console.error("Design AI Analysis Error", error);
        throw error;
    }
}
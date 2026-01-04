
import { GoogleGenAI, Type } from "@google/genai";
import { BOMItem, ChatMessage } from "../types";
import { normalizeSku } from './pricingEngine';

// Lazy initialization to prevent top-level crashes if env is not ready
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Using gemini-3-flash-preview for the fastest possible 'Flash' performance
const MODEL_NAME = 'gemini-3-flash-preview';

const SYSTEM_INSTRUCTION = `You are a strict KABS Cabinet Quotation Agent.
Your ONLY goal is to extract ALL CABINET CODES from the floor plan.

SCANNING RULES:
1. Scan the image from Top-Left to Bottom-Right.
2. List EVERY single alphanumeric code you see.
3. Include cabinets (B30, W3030), hardware codes if visible, and accessory codes.
4. If you see multiple identical codes (e.g. two "B30" cabinets), list BOTH of them separately. DO NOT summarize.
5. Ignore generic room labels (Kitchen, Island).

Output a simple comma-separated list of raw codes found. Do not add markdown or explanations.`;

export async function analyzePlan(dataUrl: string): Promise<string> {
    const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match) return "Error: Invalid file format.";

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
                        text: "List every cabinet label found in this plan, comma-separated."
                    }
                ]
            },
            config: { 
                systemInstruction: SYSTEM_INSTRUCTION,
                temperature: 0.1, 
                topP: 0.95,
                topK: 40,
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        return response.text || "Could not analyze plan.";
    } catch (error) {
        console.error("AI Analysis Error:", error);
        return "Error analyzing plan.";
    }
}

// Keywords that indicate an item is NOT a cabinet
// STRICT DEALER LIST - Used to clean data before pricing
// UPDATED: Removed 'HINGE', 'HARDWARE', 'GLIDE', 'KNOB', 'PULL' to allow hardware extraction
const EXCLUSION_KEYWORDS = [
    'FAUCET', 'HOOD', 'RANGE', 'FRIDGE', 'REFRIGERATOR', 'DISHWASHER', 'DW', 'MW', 'MICROWAVE', 'OVEN', 'COOKTOP', 'WINE',
    'LIGHT', 'LED', 'SWITCH', 'OUTLET', 'ELECTRICAL', 'J-BOX',
    'STEEL', 'BRACKET', 'SUPPORT', 'PIPE', 'PLUMBING',
    'TRASH', 'BIN', 'WASTE', 'RECYCLE',
    'CEILING', 'ELEC', 'PLUMB'
];

export async function suggestBOM(planDescription: string): Promise<any[]> {
    if (!planDescription || planDescription.includes("Error")) return [];

    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: `Convert the following extracted raw labels into a structured JSON Bill of Materials.
            
            INPUT LABELS: "${planDescription}"
            
            RULES:
            1. Create a separate item for EACH occurrence in the list.
            2. Infer the type:
               - "Base Cabinet" (prefix B, SB, DB)
               - "Wall Cabinet" (prefix W)
               - "Tall Cabinet" (prefix T, U)
               - "Hardware" (keywords Hinge, Glide, Knob, Pull)
               - "Accessory" (Fillers, Moldings)
            3. Store the exact code found as 'rawCode'.
            4. Provide a brief professional description.
            
            IMPORTANT: If the label is clearly an appliance (e.g. DW, REF) ignore it.`,
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
    const systemPrompt = `You are KABS Pricing Agent. Help the user adjust prices or specs.
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

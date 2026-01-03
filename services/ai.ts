
import { GoogleGenAI, Type } from "@google/genai";
import { BOMItem, ChatMessage } from "../types";
import { normalizeSku } from './pricingEngine';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Using gemini-3-flash-preview for the fastest possible 'Flash' performance
const MODEL_NAME = 'gemini-3-flash-preview';

const SYSTEM_INSTRUCTION = `You are an expert Architectural Blueprint Analyst (KABS Quotation Agent). 
Your task is to extract RAW Cabinet References from technical floor plans.

CORE RULES:
1. Extract every cabinet-related reference code exactly as it appears (e.g., "BD36.3", "W3924 X 24 DP").
2. Do NOT guess missing items.
3. Do NOT normalize or clean the codes yet; output the raw string.
4. Do NOT guess quantities from room size; only count explicit labels.

PATTERNS TO IDENTIFY (Keep Raw):
- Base Cabinets (e.g. B12, B36, BD36.3)
- Wall Cabinets (e.g. W3030, W3924 X 24 DP)
- Tall/Pantry (e.g. U362496BUTT.ET)
- Corner Units (e.g. LS36, BBC42)
- Specialty (e.g. RR96L, DEP, WF)

OUTPUT: Return ONLY a clean, comma-separated list of the extracted raw cabinet codes. No conversation.`;

export async function analyzePlan(dataUrl: string): Promise<string> {
    const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match) return "Error: Invalid file format.";

    const mimeType = match[1];
    const data = match[2];

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: {
                parts: [
                    { inlineData: { mimeType, data } },
                    {
                        text: "Identify all cabinet labels in this blueprint. Output only the raw codes found, comma-separated."
                    }
                ]
            },
            config: { 
                systemInstruction: SYSTEM_INSTRUCTION,
                temperature: 0.1, // Low temperature for high precision/deterministic results
                topP: 0.8,
                topK: 40,
                // Critical for speed: Disable thinking for pure extraction tasks to reduce latency
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        return response.text || "Could not analyze plan.";
    } catch (error) {
        console.error("AI Analysis Error:", error);
        return "Error analyzing plan.";
    }
}

export async function suggestBOM(planDescription: string): Promise<any[]> {
    if (!planDescription || planDescription.includes("Error")) return [];

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: `Convert the following extracted raw cabinet labels into a structured JSON Bill of Materials.
            
            INPUT LABELS: "${planDescription}"
            
            RULES:
            1. Count occurrences of identical RAW codes to determine quantity.
            2. Infer the type (Base, Wall, Sink, etc.) from the prefix.
            3. Store the exact code found as 'rawCode'.
            4. Provide a brief professional description.`,
            config: {
                responseMimeType: "application/json",
                temperature: 0.0,
                // Critical for speed: Disable thinking for transformation tasks
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
        
        return parsed.map((item: any) => ({
            type: item.type || "Cabinet",
            description: item.description || item.rawCode,
            sku: (item.rawCode || "").toUpperCase(), // Will be normalized later, strict logic applied in consolidateBOM
            rawCode: item.rawCode,
            quantity: Math.max(1, Math.round(item.quantity || 1))
        }));
    } catch (error) {
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
        // Apply Strict Normalization Rule here
        const raw = item.rawCode || item.sku;
        const normalizedKey = normalizeSku(raw);
        
        // We group by the NORMALIZED key (Base Code)
        if (globalGroup.has(normalizedKey)) {
            const existing = globalGroup.get(normalizedKey);
            existing.quantity += item.quantity;
            // Append options or raw notes if distinct? 
            // For now, simple aggregation
        } else {
            globalGroup.set(normalizedKey, { 
                ...item, 
                sku: normalizedKey, // The pricing SKU is the normalized one
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

import { supabase } from './supabaseClient';
import { CabinetLine, CatalogueFile } from '../types';
import { PRICING_DB, DEMO_LINES } from './mockData';
import { normalizeSku } from './pricingEngine';

// Helper to manage the global config JSON file in storage
// This acts as a "database row" for global settings without needing a real table.
const CONFIG_PATH = 'global/config.json';

interface GlobalConfig {
    guidelines?: CatalogueFile;
    nkba?: CatalogueFile;
}

export const ManufacturerService = {
    // Fetch all lines. If DB is empty or fails, fallback to Mock.
    async getLines(): Promise<CabinetLine[]> {
        try {
            const { data, error } = await supabase.from('cabinet_lines').select('*');
            
            if (error) throw error;
            
            if (!data || data.length === 0) {
                return DEMO_LINES;
            }

            return data.map((row: any) => ({
                id: row.id,
                name: row.name,
                tier: row.tier,
                description: row.description,
                finish: row.finish,
                multiplier: row.multiplier,
                finishPremium: row.finish_premium || 0,
                shippingFactor: row.shipping_factor || 0,
                catalogExcel: row.catalog_excel,
                guidelinesPdf: row.guidelines_pdf
            }));
        } catch (e) {
            return DEMO_LINES;
        }
    },

    // Fetch pricing for all lines.
    async getAllPricing(): Promise<Record<string, Record<string, { sku: string; price: number }>>> {
        try {
            const { data, error } = await supabase.from('pricing_items').select('*');
            
            if (error) throw error;

            if (!data || data.length === 0) {
                return PRICING_DB;
            }

            const dbPricing: Record<string, Record<string, { sku: string; price: number }>> = {};
            
            data.forEach((item: any) => {
                if (!dbPricing[item.line_id]) {
                    dbPricing[item.line_id] = {};
                }
                const key = item.type || item.sku; 
                dbPricing[item.line_id][key] = {
                    sku: item.sku,
                    price: item.price
                };
            });
            
            return { ...PRICING_DB, ...dbPricing };
        } catch (e) {
            return PRICING_DB;
        }
    },

    // --- GLOBAL SETTINGS (Cloud Persistence) ---
    async getGlobalSettings(): Promise<GlobalConfig> {
        try {
            // Download the JSON config file
            const { data, error } = await supabase.storage
                .from('manufacturer-assets')
                .download(CONFIG_PATH);

            if (error || !data) {
                return {};
            }

            const text = await data.text();
            return JSON.parse(text) as GlobalConfig;
        } catch (e) {
            console.error("Failed to load global settings", e);
            return {};
        }
    },

    async updateGlobalSettings(newConfig: GlobalConfig): Promise<boolean> {
        try {
            // Fetch current to merge (safe update)
            const current = await this.getGlobalSettings();
            const merged = { ...current, ...newConfig };

            const blob = new Blob([JSON.stringify(merged)], { type: 'application/json' });
            
            const { error } = await supabase.storage
                .from('manufacturer-assets')
                .upload(CONFIG_PATH, blob, { upsert: true });

            return !error;
        } catch (e) {
            return false;
        }
    },

    async addLine(line: CabinetLine): Promise<boolean> {
        try {
            const { error } = await supabase.from('cabinet_lines').insert([{
                id: line.id,
                name: line.name,
                tier: line.tier,
                description: line.description,
                finish: line.finish,
                multiplier: line.multiplier,
                finish_premium: line.finishPremium,
                shipping_factor: line.shippingFactor
            }]);
            
            return !error;
        } catch (e) {
            return false;
        }
    },

    async deleteLine(lineId: string): Promise<boolean> {
        try {
            await supabase.from('pricing_items').delete().eq('line_id', lineId);
            await supabase.from('cabinet_lines').delete().eq('id', lineId);
            return true;
        } catch (e) {
            return false;
        }
    },

    async uploadCatalogFile(lineId: string, file: File, type: 'excel' | 'pdf' | 'nkba'): Promise<CatalogueFile | null> {
        const bucketName = 'manufacturer-assets';
        const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        
        // Handle Globals vs Line-specific paths
        const folder = lineId === 'global' ? 'global' : lineId;
        const fileName = `${folder}/${Date.now()}_${cleanName}`;

        try {
            // 1. Upload File to Cloud
            const { error } = await supabase.storage
                .from(bucketName)
                .upload(fileName, file, { 
                    upsert: true,
                    contentType: file.type || 'application/octet-stream'
                });

            if (error) {
                console.error("Upload Error:", error);
                return null;
            }

            // 2. Create File Entry Object
            const fileEntry: CatalogueFile = {
                name: file.name,
                type: type,
                lastUpdated: new Date().toLocaleDateString(),
                status: 'active'
            };

            // 3. Update Reference (DB or Global Config)
            if (lineId === 'global') {
                const configKey = type === 'nkba' ? 'nkba' : 'guidelines';
                await this.updateGlobalSettings({ [configKey]: fileEntry });
            } else {
                const field = type === 'excel' ? 'catalog_excel' : 'guidelines_pdf';
                const { error: dbError } = await supabase
                    .from('cabinet_lines')
                    .update({ [field]: fileEntry })
                    .eq('id', lineId);
                
                if (dbError) return null;
            }

            return fileEntry;

        } catch (e) {
            console.error("Service Error:", e);
            return null;
        }
    },

    async removeCatalogFile(lineId: string, type: 'excel' | 'pdf' | 'nkba'): Promise<boolean> {
        try {
            if (lineId === 'global') {
                // Update Global Config JSON
                const configKey = type === 'nkba' ? 'nkba' : 'guidelines';
                
                // We fetch, clear the key, and save back
                const current = await this.getGlobalSettings();
                if (configKey === 'nkba') delete current.nkba;
                if (configKey === 'guidelines') delete current.guidelines;

                const blob = new Blob([JSON.stringify(current)], { type: 'application/json' });
                await supabase.storage.from('manufacturer-assets').upload(CONFIG_PATH, blob, { upsert: true });
                return true;
            }
            
            // Standard Line Update
            const field = type === 'excel' ? 'catalog_excel' : 'guidelines_pdf';
            await supabase
                .from('cabinet_lines')
                .update({ [field]: null })
                .eq('id', lineId);
            return true;
        } catch (e) {
            return false;
        }
    },

    async parseCatalogExcel(file: File): Promise<Record<string, { sku: string; price: number }>> {
        return new Promise((resolve) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = e.target?.result;
                    const XLSX = (window as any).XLSX;
                    if (!XLSX) {
                        console.warn("XLSX library not found");
                        resolve({}); 
                        return;
                    }

                    const workbook = XLSX.read(data, { type: 'binary' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    
                    // 1. Get all data as arrays first to find headers
                    const allRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    if (allRows.length === 0) {
                        resolve({});
                        return;
                    }

                    // 2. Scan first 20 rows to find header row containing 'SKU' and 'Price'
                    const skuCandidates = ['SKU', 'ITEM', 'CODE', 'MODEL', 'PRODUCT', 'PART NO', 'PART'];
                    const priceCandidates = ['PRICE', 'COST', 'MSRP', 'LIST PRICE', 'AMOUNT', 'NET PRICE', 'UNIT PRICE'];

                    let headerRowIndex = 0;
                    
                    for (let i = 0; i < Math.min(allRows.length, 20); i++) {
                        const row = allRows[i].map((cell: any) => String(cell).toUpperCase().trim());
                        const hasSku = row.some((cell: string) => skuCandidates.some(c => cell === c || cell.includes(c)));
                        const hasPrice = row.some((cell: string) => priceCandidates.some(c => cell === c || cell.includes(c)));
                        
                        if (hasSku && hasPrice) {
                            headerRowIndex = i;
                            break;
                        }
                    }

                    // 3. Re-parse with correct header row
                    // range: headerRowIndex tells sheet_to_json to start from that row
                    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex });

                    const pricingMap: Record<string, { sku: string; price: number }> = {};
                    
                    const findValue = (row: any, candidates: string[]) => {
                        const keys = Object.keys(row);
                        // Exact match first
                        for (const c of candidates) {
                            const exact = keys.find(k => k.trim().toUpperCase() === c);
                            if (exact) return row[exact];
                        }
                        // Partial match second
                        for (const c of candidates) {
                            const partial = keys.find(k => k.trim().toUpperCase().includes(c));
                            if (partial) return row[partial];
                        }
                        return null;
                    };

                    jsonData.forEach((row) => {
                        const sku = findValue(row, skuCandidates);
                        let priceStr = findValue(row, priceCandidates);
                        
                        if (sku && priceStr !== undefined && priceStr !== null) {
                            if (typeof priceStr === 'string') {
                                priceStr = priceStr.replace(/[^0-9.]/g, '');
                            }
                            const price = parseFloat(priceStr);

                            if (!isNaN(price) && String(sku).trim().length > 0) {
                                const rawSku = String(sku).trim();
                                
                                // KEY FIX: Normalize the key using NKBA rules to match BOM behavior
                                const normKey = normalizeSku(rawSku);
                                
                                // 1. Store Normalized Key (Priority Match)
                                if (normKey) {
                                    pricingMap[normKey] = { sku: rawSku, price };
                                }
                                
                                // 2. Store Clean Raw Key (Fallback for exact matches if normalization is too aggressive)
                                const cleanRaw = rawSku.toUpperCase();
                                if (cleanRaw !== normKey) {
                                    pricingMap[cleanRaw] = { sku: rawSku, price };
                                }
                            }
                        }
                    });
                    
                    console.log(`Parsed ${Object.keys(pricingMap).length} items from Excel.`);
                    resolve(pricingMap);

                } catch (error) {
                    console.error("Excel parse error:", error);
                    resolve({});
                }
            };
            reader.readAsBinaryString(file);
        });
    },

    async savePricing(lineId: string, pricingData: Record<string, { sku: string; price: number }>) {
        try {
            const rows = Object.entries(pricingData).map(([key, data]) => ({
                line_id: lineId,
                type: key, // Using 'type' column to store the lookup key (normalized or raw)
                sku: data.sku,
                price: data.price
            }));

            await supabase.from('pricing_items').delete().eq('line_id', lineId);
            await supabase.from('pricing_items').insert(rows);
        } catch (e) {
            // Ignore error
        }
    }
};
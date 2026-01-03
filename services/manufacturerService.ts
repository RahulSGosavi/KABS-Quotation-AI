import { supabase } from './supabaseClient';
import { CabinetLine, CatalogueFile } from '../types';
import { PRICING_DB, DEMO_LINES } from './mockData';

export const ManufacturerService = {
    // Fetch all lines. If DB is empty or fails, fallback to Mock.
    async getLines(): Promise<CabinetLine[]> {
        try {
            const { data, error } = await supabase.from('cabinet_lines').select('*');
            
            if (error) {
                console.error("Supabase Error (getLines):", error.message);
                // Return empty if table doesn't exist so we don't confuse with mock data if intention is empty
                if (error.code === '42P01') return DEMO_LINES; 
                return DEMO_LINES;
            }
            
            if (!data || data.length === 0) {
                console.log("DB empty, using Mock Lines");
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
            console.error("Supabase Connection Error:", e);
            return DEMO_LINES;
        }
    },

    // Fetch pricing for all lines.
    async getAllPricing(): Promise<Record<string, Record<string, { sku: string; price: number }>>> {
        try {
            const { data, error } = await supabase.from('pricing_items').select('*');
            
            if (error) {
                console.error("Supabase Error (getAllPricing):", error.message);
                return PRICING_DB;
            }

            if (!data || data.length === 0) {
                return PRICING_DB;
            }

            const dbPricing: Record<string, Record<string, { sku: string; price: number }>> = {};
            
            data.forEach((item: any) => {
                if (!dbPricing[item.line_id]) {
                    dbPricing[item.line_id] = {};
                }
                
                // IMPORTANT: Use the 'type' column as the primary key for the dictionary.
                // In savePricing, we store the dictionary key (SKU or 'default') into the 'type' column.
                // This ensures that 'default' key is preserved and not overwritten by the SKU value.
                const key = item.type || item.sku; 
                
                dbPricing[item.line_id][key] = {
                    sku: item.sku,
                    price: item.price
                };
            });
            
            return { ...PRICING_DB, ...dbPricing };
        } catch (e) {
            console.error("Supabase Pricing Error:", e);
            return PRICING_DB;
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
            
            if (error) {
                 console.error("Supabase Insert Error:", error);
                 return false; 
            }
            return true;
        } catch (e) {
            console.error("Error adding line to DB", e);
            return false;
        }
    },

    async deleteLine(lineId: string): Promise<boolean> {
        try {
            await supabase.from('pricing_items').delete().eq('line_id', lineId);
            await supabase.from('cabinet_lines').delete().eq('id', lineId);
            return true;
        } catch (e) {
            console.error("Delete line error", e);
            return false;
        }
    },

    async uploadCatalogFile(lineId: string, file: File, type: 'excel' | 'pdf' | 'nkba'): Promise<CatalogueFile | null> {
        try {
            const bucketName = 'manufacturer-assets';
            const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const fileName = `${lineId}/${Date.now()}_${cleanName}`;
            const FILE_SIZE_LIMIT = 1073741824; 

            // 1. Upload
            const { data, error } = await supabase.storage
                .from(bucketName)
                .upload(fileName, file, { 
                    upsert: true,
                    contentType: file.type || 'application/octet-stream'
                });

            if (error) {
                console.warn(`Upload failed:`, error.message);
                if (error.message.includes("Bucket not found")) {
                     console.error("Storage Bucket missing. Run Migration SQL.");
                }
                return null;
            }

            // 2. Construct File Entry
            const fileEntry: CatalogueFile = {
                name: file.name,
                type: type,
                lastUpdated: new Date().toLocaleString(),
                status: 'active'
            };

            // 3. Update Line Record
            if (lineId !== 'global') {
                const field = type === 'excel' ? 'catalog_excel' : 'guidelines_pdf';
                const { error: dbError } = await supabase
                    .from('cabinet_lines')
                    .update({ [field]: fileEntry })
                    .eq('id', lineId);
                
                if (dbError) {
                    console.error("DB Update Failed during Upload:", dbError.message);
                    return null;
                }
            }

            return fileEntry;

        } catch (e) {
            console.error("Unexpected Upload Error", e);
            return null;
        }
    },

    async removeCatalogFile(lineId: string, type: 'excel' | 'pdf' | 'nkba'): Promise<boolean> {
        try {
            if (lineId === 'global') {
                // For global files, we assume frontend state is truth for now as we don't have a settings table
                // In a real app, this would delete from a 'settings' table
                return true;
            }
            
            const field = type === 'excel' ? 'catalog_excel' : 'guidelines_pdf';
            await supabase
                .from('cabinet_lines')
                .update({ [field]: null })
                .eq('id', lineId);
            return true;
        } catch (e) {
            console.error("Remove file error", e);
            return false;
        }
    },

    async parseCatalogExcel(file: File): Promise<Record<string, { sku: string; price: number }>> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = e.target?.result;
                    const XLSX = (window as any).XLSX;
                    if (!XLSX) {
                        resolve({}); 
                        return;
                    }

                    const workbook = XLSX.read(data, { type: 'binary' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

                    const pricingMap: Record<string, { sku: string; price: number }> = {};
                    
                    // Candidate Headers (Case insensitive partial match logic later)
                    const skuCandidates = ['SKU', 'Item', 'Code', 'Model', 'Product', 'Part No', 'Part'];
                    const priceCandidates = ['Price', 'Cost', 'MSRP', 'List Price', 'Amount', 'Net Price', 'Unit Price'];

                    // Helper to find value from dynamic key
                    const findValue = (row: any, candidates: string[]) => {
                        const keys = Object.keys(row);
                        for (const c of candidates) {
                            const exact = keys.find(k => k.trim().toLowerCase() === c.toLowerCase());
                            if (exact) return row[exact];
                        }
                        // If no exact match, try partial
                        for (const c of candidates) {
                            const partial = keys.find(k => k.trim().toLowerCase().includes(c.toLowerCase()));
                            if (partial) return row[partial];
                        }
                        return null;
                    };

                    jsonData.forEach((row) => {
                        const sku = findValue(row, skuCandidates);
                        let priceStr = findValue(row, priceCandidates);
                        
                        if (sku && priceStr !== undefined && priceStr !== null) {
                            // Clean price string (remove $, spaces, etc)
                            if (typeof priceStr === 'string') {
                                priceStr = priceStr.replace(/[^0-9.]/g, '');
                            }
                            const price = parseFloat(priceStr);

                            // Only add if we have a valid price and sku
                            if (!isNaN(price) && sku.toString().trim().length > 0) {
                                const cleanSku = String(sku).trim().toUpperCase();
                                pricingMap[cleanSku] = { sku: cleanSku, price };
                            }
                        }
                    });
                    
                    console.log(`Parsed ${Object.keys(pricingMap).length} items from Excel.`);
                    resolve(pricingMap);

                } catch (error) {
                    console.error("Excel Parsing Error", error);
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
                type: key, // Storing the dictionary key (e.g. 'default' or 'B30') as 'type'
                sku: data.sku,
                price: data.price
            }));

            await supabase.from('pricing_items').delete().eq('line_id', lineId);
            // Insert in batches if large, but for demo direct insert is fine
            const { error } = await supabase.from('pricing_items').insert(rows);
            
            if (error) {
                console.error("Supabase pricing insert failed:", error.message);
            }
        } catch (e) {
            console.error("Could not save pricing to DB", e);
        }
    }
};
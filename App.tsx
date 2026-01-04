
import React, { useState, useEffect } from 'react';
import { DemoState, BOMItem, CabinetLine, CatalogueFile, ProjectInfo } from './types';
import { MOCK_PROJECT_DEFAULTS, DEMO_LINES, PRICING_DB } from './services/mockData';
import { analyzePlan, suggestBOM, consolidateBOM } from './services/ai';
import { ManufacturerService } from './services/manufacturerService';
import { validateBOMAgainstCatalog } from './services/pricingEngine';
import { AuthService } from './services/authService';
import { 
    StepStart, 
    StepUpload, 
    StepBOM, 
    StepLineSwitch, 
    StepProjectDetails,
    StepQuote 
} from './components/DemoComponents';
import { AdminLogin, AdminDashboard } from './components/AdminViews';

export default function App() {
    // Central Demo State
    const [state, setState] = useState<DemoState>({
        step: 'start',
        planImage: null,
        aiAnalysis: null,
        bom: [],
        selectedLineId: DEMO_LINES[0].id,
        projectInfo: MOCK_PROJECT_DEFAULTS,
        lines: DEMO_LINES, 
        pricingDatabase: PRICING_DB,
        globalGuidelines: {
            name: "KABS_Install_Standard_v2.pdf",
            type: "pdf",
            lastUpdated: new Date().toLocaleDateString(),
            status: "active"
        },
        nkbaStandards: null
    });
    
    // Upload State
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    // BOM Generation Loading State
    const [isGeneratingBOM, setIsGeneratingBOM] = useState(false);

    // Initial Load from Supabase & Auth Check
    useEffect(() => {
        const loadData = async () => {
            // 2. Load Data from Supabase
            const lines = await ManufacturerService.getLines();
            const pricing = await ManufacturerService.getAllPricing();
            
            setState(prev => ({
                ...prev,
                lines: lines.length > 0 ? lines : prev.lines,
                pricingDatabase: pricing,
                selectedLineId: lines.length > 0 ? lines[0].id : prev.selectedLineId
            }));
        };
        loadData();
    }, []);

    // --- Actions ---

    const handleUpload = async (file: File) => {
        if (!file) {
            setState(prev => ({ ...prev, planImage: null, aiAnalysis: null }));
            return;
        }
        
        setIsAnalyzing(true);
        
        // Optimize: Compress images before sending to AI
        const processFile = async (): Promise<string> => {
            return new Promise((resolve) => {
                // If it's an image, resize it to max 3072px (3K) width/height to ensure text readability
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const img = new Image();
                        img.src = event.target?.result as string;
                        img.onload = () => {
                            const MAX_DIM = 3072; // Increased from 1500 to capture small text
                            let width = img.width;
                            let height = img.height;

                            if (width > MAX_DIM || height > MAX_DIM) {
                                if (width > height) {
                                    height *= MAX_DIM / width;
                                    width = MAX_DIM;
                                } else {
                                    width *= MAX_DIM / height;
                                    height = MAX_DIM;
                                }
                            }

                            const canvas = document.createElement('canvas');
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            if (ctx) {
                                ctx.drawImage(img, 0, 0, width, height);
                                // Compress to JPEG 85% for better quality/size balance
                                resolve(canvas.toDataURL('image/jpeg', 0.85));
                            } else {
                                resolve(event.target?.result as string);
                            }
                        };
                    };
                    reader.readAsDataURL(file);
                } else {
                    // For PDF, we must read as DataURL directly
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(file);
                }
            });
        };

        try {
            const base64 = await processFile();
            setState(prev => ({ ...prev, planImage: base64 }));
            
            // Call AI
            const analysis = await analyzePlan(base64);
            
            setState(prev => ({ 
                ...prev, 
                aiAnalysis: analysis 
            }));
        } catch (err) {
            console.error("Processing failed", err);
            alert("Failed to process file.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleGenerateBOM = async () => {
        if (!state.aiAnalysis) return;
        
        setIsGeneratingBOM(true);
        try {
            // 1. Get Candidate Items from AI (Deterministic Extraction)
            const suggestedBom = await suggestBOM(state.aiAnalysis);
            
            // 2. Consolidate into Unique Line Items (Global SKU Grouping)
            const consolidatedBom = consolidateBOM(suggestedBom);
            
            // 3. Assign unique IDs immediately
            const bomWithIds = consolidatedBom.map((item, idx) => ({
                ...item,
                id: `bom-${Date.now()}-${idx}`
            }));

            // 4. Strict Validation against Selected Catalog & Size Based Pricing
            const activeLineId = state.selectedLineId;
            const activeLine = state.lines.find(l => l.id === activeLineId);
            const pricingDB = state.pricingDatabase[activeLineId] || {};
            
            const validatedBom = validateBOMAgainstCatalog(bomWithIds, pricingDB, activeLine);
            
            setState(prev => ({ 
                ...prev, 
                bom: validatedBom,
                step: 'bom'
            }));
        } catch (error) {
            console.error("Error generating BOM:", error);
        } finally {
            setIsGeneratingBOM(false);
        }
    };

    const handleUpdateBOM = (newBom: BOMItem[]) => {
        setState(prev => ({ ...prev, bom: newBom }));
    };

    const handleUpdateProjectInfo = (updates: Partial<ProjectInfo>) => {
        setState(prev => ({
            ...prev,
            projectInfo: { ...prev.projectInfo, ...updates }
        }));
    };

    const handleRestart = () => {
        setState(prev => ({
            ...prev,
            step: 'start',
            planImage: null,
            aiAnalysis: null,
            bom: [],
            selectedLineId: prev.lines[0].id, 
            projectInfo: MOCK_PROJECT_DEFAULTS
        }));
    };

    // --- Admin Actions ---

    const handleUpdateLine = (lineId: string, updates: Partial<CabinetLine>) => {
        setState(prev => ({
            ...prev,
            lines: prev.lines.map(line => line.id === lineId ? { ...line, ...updates } : line)
        }));
    };

    const handleAddLine = async (name: string, tier: 'Budget' | 'Mid-Range' | 'Premium') => {
        const lineId = `line_${Date.now()}`;
        const multiplier = tier === 'Budget' ? 1.0 : (tier === 'Mid-Range' ? 1.6 : 2.5);
        
        const newLine: CabinetLine = {
            id: lineId,
            name: name,
            tier: tier,
            description: `New ${tier} collection.`,
            finish: 'Standard',
            multiplier: multiplier,
            finishPremium: 0,
            shippingFactor: 0.05
        };

        setState(prev => ({ ...prev, lines: [...prev.lines, newLine] }));

        const saved = await ManufacturerService.addLine(newLine);
        if (!saved) {
            alert("Error: Database tables missing. Data will be lost on refresh.");
        }

        const basePrices: Record<string, number> = {
            'Base Cabinet': 220,
            'Wall Cabinet': 180,
            'Sink Base': 280,
            'Drawer Base': 350,
            'Corner Cabinet': 450,
            'Tall Cabinet': 650,
            'Refrigerator Panel': 150,
            'Dishwasher Panel': 90,
            'default': 100 
        };

        const initialPricing: Record<string, { sku: string; price: number }> = {};
        
        Object.entries(basePrices).forEach(([key, basePrice]) => {
            const prefix = name.substring(0, 3).toUpperCase();
            const sku = key === 'default' ? `${prefix}-GEN` : `${prefix}-${key.split(' ')[0].toUpperCase()}`;
            
            initialPricing[key] = {
                sku: sku,
                price: Math.round(basePrice * multiplier)
            };
        });

        await ManufacturerService.savePricing(lineId, initialPricing);
        
        setState(prev => ({
            ...prev,
            pricingDatabase: { ...prev.pricingDatabase, [lineId]: initialPricing }
        }));
    };

    const handleDeleteLine = async (lineId: string) => {
        setState(prev => ({
            ...prev,
            lines: prev.lines.filter(l => l.id !== lineId),
            selectedLineId: prev.selectedLineId === lineId ? (prev.lines[0]?.id || '') : prev.selectedLineId
        }));
        await ManufacturerService.deleteLine(lineId);
    };

    const handleDeleteFile = async (lineId: string, type: 'excel' | 'pdf' | 'nkba') => {
         if (lineId === 'global') {
            if (type === 'pdf') setState(prev => ({ ...prev, globalGuidelines: null }));
            if (type === 'nkba') setState(prev => ({ ...prev, nkbaStandards: null }));
         } else {
             setState(prev => ({
                ...prev,
                lines: prev.lines.map(l => {
                    if (l.id !== lineId) return l;
                    const update = type === 'excel' ? { catalogExcel: undefined } : { guidelinesPdf: undefined };
                    return { ...l, ...update };
                })
            }));
         }
        
        await ManufacturerService.removeCatalogFile(lineId, type);
    };

    const handleCatalogUpload = async (lineId: string, file: File, type: 'excel' | 'pdf' | 'nkba') => {
        const uploadedFile = await ManufacturerService.uploadCatalogFile(lineId, file, type);
        
        if (!uploadedFile) {
            alert("Upload failed. Check console for details.");
            return;
        }

        if (lineId === 'global') {
            if (type === 'pdf') setState(prev => ({ ...prev, globalGuidelines: uploadedFile }));
            if (type === 'nkba') setState(prev => ({ ...prev, nkbaStandards: uploadedFile }));
            return;
        }

        const updateObj = type === 'excel' ? { catalogExcel: uploadedFile } : { guidelinesPdf: uploadedFile };
        
        let newPricingDB = { ...state.pricingDatabase };
        
        if (type === 'excel') {
            const parsedPricing = await ManufacturerService.parseCatalogExcel(file);
            
            if (Object.keys(parsedPricing).length > 0) {
                 const existingDefault = newPricingDB[lineId]?.['default'];
                 
                 newPricingDB[lineId] = { ...parsedPricing };
                 if (existingDefault) {
                     newPricingDB[lineId]['default'] = existingDefault;
                 } else {
                     newPricingDB[lineId]['default'] = { sku: 'GEN-001', price: 100 };
                 }

                 await ManufacturerService.savePricing(lineId, newPricingDB[lineId]);
            } else {
                alert("Could not parse Excel. Ensure headers: 'SKU' and 'Price'.");
            }
        }

        setState(prev => ({
            ...prev,
            lines: prev.lines.map(line => line.id === lineId ? { ...line, ...updateObj } : line),
            pricingDatabase: newPricingDB
        }));
    };

    // --- View Router ---

    const renderStep = () => {
        const currentLine = state.lines.find(l => l.id === state.selectedLineId);
        
        switch (state.step) {
            case 'start':
                return <StepStart 
                    onNext={() => setState(s => ({ ...s, step: 'upload' }))} 
                    onAdmin={() => setState(s => ({ ...s, step: 'admin-login' }))}
                />;
            
            case 'admin-login':
                return <AdminLogin 
                    onLogin={() => setState(s => ({ ...s, step: 'admin-dashboard' }))} 
                    onBack={() => setState(s => ({ ...s, step: 'start' }))}
                />;

            case 'admin-dashboard':
                return <AdminDashboard 
                    lines={state.lines}
                    globalGuidelines={state.globalGuidelines}
                    nkbaStandards={state.nkbaStandards}
                    onUpdateLine={handleUpdateLine}
                    onAddLine={handleAddLine}
                    onDeleteLine={handleDeleteLine}
                    onUploadCatalog={handleCatalogUpload}
                    onDeleteFile={handleDeleteFile}
                    onLogout={() => setState(s => ({ ...s, step: 'start' }))}
                />;
            
            case 'upload':
                return (
                    <StepUpload 
                        onUpload={handleUpload} 
                        isAnalyzing={isAnalyzing}
                        analysisResult={state.aiAnalysis}
                        onNext={handleGenerateBOM}
                        onBack={() => setState(s => ({ ...s, step: 'start' }))}
                        isGenerating={isGeneratingBOM}
                    />
                );
            
            case 'bom':
                return (
                    <StepBOM 
                        bom={state.bom}
                        setBom={handleUpdateBOM}
                        onNext={() => setState(s => ({ ...s, step: 'line-switch' }))}
                        onBack={() => setState(s => ({ ...s, step: 'upload' }))}
                    />
                );

            case 'line-switch':
                return (
                    <StepLineSwitch 
                        bom={state.bom}
                        setBom={handleUpdateBOM}
                        selectedLineId={state.selectedLineId}
                        lines={state.lines}
                        pricingDatabase={state.pricingDatabase}
                        onChangeLine={(id) => setState(s => ({ ...s, selectedLineId: id }))}
                        onNext={() => setState(s => ({ ...s, step: 'details' }))}
                        onBack={() => setState(s => ({ ...s, step: 'bom' }))}
                    />
                );

            case 'details':
                return (
                    <StepProjectDetails
                        projectInfo={state.projectInfo}
                        onUpdate={handleUpdateProjectInfo}
                        onNext={() => setState(s => ({ ...s, step: 'quote' }))}
                        onBack={() => setState(s => ({ ...s, step: 'line-switch' }))}
                        selectedLineName={currentLine?.name || ""}
                    />
                )

            case 'quote':
                return (
                    <StepQuote 
                        bom={state.bom}
                        selectedLineId={state.selectedLineId}
                        lines={state.lines}
                        pricingDatabase={state.pricingDatabase}
                        projectInfo={state.projectInfo}
                        onRestart={handleRestart}
                        onBack={() => setState(s => ({ ...s, step: 'details' }))}
                    />
                );
        }
    };

    return (
        <div className="h-[100dvh] w-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
            {renderStep()}
        </div>
    );
}

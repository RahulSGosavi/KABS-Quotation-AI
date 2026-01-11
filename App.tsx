import React, { useState, useEffect } from 'react';
import { DemoState, BOMItem, CabinetLine, CatalogueFile, ProjectInfo, KitchenShape } from './types';
import { MOCK_PROJECT_DEFAULTS, DEMO_LINES, PRICING_DB } from './services/mockData';
import { analyzePlan, suggestBOM, consolidateBOM, analyzeLayout } from './services/ai';
import { ManufacturerService } from './services/manufacturerService';
import { validateBOMAgainstCatalog } from './services/pricingEngine';
import { AuthService } from './services/authService';
import { 
    StepStart, 
    StepShapeSelection,
    StepUpload,
    StepDesignResult, 
    StepBOM, 
    StepManufacturerSelect, // Previously LineSwitch
    StepExtractionReview, // NEW
    StepSpecSelection, // NEW
    StepProjectDetails,
    StepQuote 
} from './components/DemoComponents';
import { AdminLogin, AdminDashboard } from './components/AdminViews';

export default function App() {
    // Central Demo State
    const [state, setState] = useState<DemoState>({
        step: 'start',
        mode: null,
        planImage: null,
        aiAnalysis: null,
        rawExtractedCodes: [], // New list for Step 2
        designLayout: null,
        bom: [],
        selectedLineId: DEMO_LINES[0].id,
        projectInfo: MOCK_PROJECT_DEFAULTS,
        selectedShape: null,
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
            
            // 3. Load Global Settings (Cloud Persisted)
            const globalConfig = await ManufacturerService.getGlobalSettings();

            setState(prev => ({
                ...prev,
                lines: lines.length > 0 ? lines : prev.lines,
                pricingDatabase: pricing,
                selectedLineId: lines.length > 0 ? lines[0].id : prev.selectedLineId,
                // Use cloud config if available, otherwise keep default/null
                globalGuidelines: globalConfig.guidelines || prev.globalGuidelines,
                nkbaStandards: globalConfig.nkba || null
            }));
        };
        loadData();
    }, []);

    // --- Core File Processing (Shared) ---
    const processFile = async (file: File): Promise<string> => {
        return new Promise((resolve) => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.src = event.target?.result as string;
                    img.onload = () => {
                        const MAX_DIM = 3072;
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
                            resolve(canvas.toDataURL('image/jpeg', 0.85));
                        } else {
                            resolve(event.target?.result as string);
                        }
                    };
                };
                reader.readAsDataURL(file);
            } else {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
            }
        });
    };

    // --- Actions ---

    const handleUpload = async (file: File) => {
        if (!file) {
            setState(prev => ({ ...prev, planImage: null, aiAnalysis: null, designLayout: null }));
            return;
        }
        
        setIsAnalyzing(true);

        try {
            const base64 = await processFile(file);
            
            // IF DESIGN MODE: Standard Flow
            if (state.mode === 'design') {
                setState(prev => ({ 
                    ...prev, 
                    planImage: base64, 
                    aiAnalysis: "Done", 
                }));
                setIsAnalyzing(false);
                return;
            } 
            
            // QUOTATION MODE: Extract RAW CODES
            setState(prev => ({ ...prev, planImage: base64 }));
            const rawCodes = await analyzePlan(base64); // Now returns string[]
            
            if (Array.isArray(rawCodes)) {
                setState(prev => ({ 
                    ...prev, 
                    rawExtractedCodes: rawCodes,
                    step: 'extraction-review' 
                }));
            } else {
                alert("Failed to extract valid codes.");
            }
            
        } catch (err) {
            console.error("Processing failed", err);
            alert("Failed to process file.");
        } finally {
            if (state.mode !== 'design') {
                setIsAnalyzing(false);
            }
        }
    };

    const handleShapeSelection = async (shape: KitchenShape) => {
        setState(prev => ({ ...prev, selectedShape: shape }));
        setIsGeneratingBOM(true); 
        
        try {
            if (!state.planImage) return;
            const layout = await analyzeLayout(state.planImage, !!state.nkbaStandards, shape);
            setState(prev => ({
                ...prev,
                designLayout: layout,
                step: 'design-result'
            }));
        } catch(e) {
            console.error(e);
            alert("Failed to generate design layout.");
        } finally {
            setIsGeneratingBOM(false);
        }
    };

    // --- NEW: GENERATE BOM FROM SPECS ---
    const handleGenerateBOM = async () => {
        // Input: Raw Codes + Selected Line + Specs
        // Output: Grouped, Categorized, Priced BOM
        
        setIsGeneratingBOM(true);
        try {
            // 1. Group & Categorize Raw Codes (AI)
            const suggestedBom = await suggestBOM(state.rawExtractedCodes);
            const consolidatedBom = consolidateBOM(suggestedBom);
            
            const bomWithIds = consolidatedBom.map((item, idx) => ({
                ...item,
                id: `bom-${Date.now()}-${idx}`
            }));

            // 2. Validate Against Pricing DB
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

    const handleUpdateSpecs = (updates: Partial<ProjectInfo['specs']>) => {
        setState(prev => ({
            ...prev,
            projectInfo: {
                ...prev.projectInfo,
                specs: { ...prev.projectInfo.specs, ...updates }
            }
        }));
    };

    const handleRestart = () => {
        setState(prev => ({
            ...prev,
            step: 'start',
            mode: null,
            planImage: null,
            aiAnalysis: null,
            rawExtractedCodes: [],
            designLayout: null,
            bom: [],
            selectedShape: null,
            selectedLineId: prev.lines[0].id, 
            projectInfo: MOCK_PROJECT_DEFAULTS
        }));
    };

    // --- Admin Actions (Passed down) ---
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

        await ManufacturerService.addLine(newLine); 
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
        
        if (!uploadedFile) return;

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
                 if (existingDefault) newPricingDB[lineId]['default'] = existingDefault;
                 else newPricingDB[lineId]['default'] = { sku: 'GEN-001', price: 100 };
                 await ManufacturerService.savePricing(lineId, newPricingDB[lineId]);
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
                    onDesignMode={() => setState(s => ({ ...s, mode: 'design', step: 'upload' }))}
                    onQuoteMode={() => setState(s => ({ ...s, mode: 'quotation', step: 'upload' }))}
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
                        mode={state.mode || 'quotation'}
                        onUpload={handleUpload} 
                        isAnalyzing={isAnalyzing}
                        // For Design mode only
                        analysisResult={state.mode === 'design' ? (state.planImage ? "Ready" : null) : null}
                        onNext={() => setState(s => ({ ...s, step: 'shape-selection' }))}
                        onBack={() => setState(s => ({ ...s, step: 'start', mode: null }))}
                        isGenerating={isGeneratingBOM}
                    />
                );

            case 'shape-selection':
                return (
                    <StepShapeSelection 
                        onSelectShape={handleShapeSelection}
                        onBack={() => setState(s => ({ ...s, step: 'upload' }))}
                    />
                )

            case 'design-result':
                return (
                    <StepDesignResult 
                        layout={state.designLayout}
                        onBack={() => setState(s => ({ ...s, step: 'shape-selection', designLayout: null }))}
                        nkbaRules={state.nkbaStandards}
                    />
                );
            
            // --- NEW WORKFLOW STEPS START HERE ---

            case 'extraction-review':
                return (
                    <StepExtractionReview 
                        codes={state.rawExtractedCodes}
                        onRemoveCode={(idx) => {
                            const newCodes = [...state.rawExtractedCodes];
                            newCodes.splice(idx, 1);
                            setState(s => ({ ...s, rawExtractedCodes: newCodes }));
                        }}
                        onNext={() => setState(s => ({ ...s, step: 'manufacturer-select' }))}
                        onBack={() => setState(s => ({ ...s, step: 'upload' }))}
                    />
                );

            case 'manufacturer-select':
                return (
                    <StepManufacturerSelect
                        selectedLineId={state.selectedLineId}
                        lines={state.lines}
                        onChangeLine={(id) => setState(s => ({ ...s, selectedLineId: id }))}
                        onNext={() => setState(s => ({ ...s, step: 'spec-selection' }))}
                        onBack={() => setState(s => ({ ...s, step: 'extraction-review' }))}
                    />
                );

            case 'spec-selection':
                return (
                    <StepSpecSelection 
                        line={currentLine || state.lines[0]}
                        specs={state.projectInfo.specs}
                        onUpdateSpecs={handleUpdateSpecs}
                        onNext={handleGenerateBOM}
                        onBack={() => setState(s => ({ ...s, step: 'manufacturer-select' }))}
                        isProcessing={isGeneratingBOM}
                    />
                );

            // --- END NEW WORKFLOW ---

            case 'bom':
                return (
                    <StepBOM 
                        bom={state.bom}
                        setBom={handleUpdateBOM}
                        onNext={() => setState(s => ({ ...s, step: 'quote' }))}
                        onBack={() => setState(s => ({ ...s, step: 'spec-selection' }))}
                        selectedLineId={state.selectedLineId}
                        lines={state.lines} // PASSED
                        pricingDatabase={state.pricingDatabase} // PASSED
                    />
                );

            case 'details':
                // Keeping legacy details step if needed, but mostly replaced by SpecSelection
                return (
                    <StepProjectDetails
                        projectInfo={state.projectInfo}
                        onUpdate={handleUpdateProjectInfo}
                        onNext={() => setState(s => ({ ...s, step: 'quote' }))}
                        onBack={() => setState(s => ({ ...s, step: 'bom' }))}
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
                        onBack={() => setState(s => ({ ...s, step: 'bom' }))}
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
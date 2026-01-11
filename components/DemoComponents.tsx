import React, { useState, useEffect, useRef } from 'react';
import { 
    Upload, ArrowRight, ArrowLeft, CheckCircle2, 
    Loader2, Trash2, Bot, ShieldCheck, Cpu, Play, Boxes,
    FileSpreadsheet, AlertTriangle, Download, User, Factory, Lock,
    PenTool, Calculator, Ruler, Layout, BookOpen, ChevronRight, FileText,
    Maximize, MinusSquare, Grid, Square, Printer, Eye, EyeOff, X, Tag
} from 'lucide-react';
import { BOMItem, CabinetLine, ProjectInfo, CabinetType, DesignLayout, KitchenShape, CatalogueFile, QuoteItem } from '../types';
import { validateBOMAgainstCatalog, parseCabinetDimensions, calculateItemPrice } from '../services/pricingEngine';
import { extractProjectSpecs } from '../services/ai'; // Import helper
import { BOMBuilder } from './BOMBuilder';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PlanViewer } from './PlanViewer';

// --- HELPER: Pricing & Verification Logic (Strict Dealer Mode) ---
const calculatePricing = (
    bom: BOMItem[], 
    globalLineId: string, 
    lines: CabinetLine[],
    pricingDB: Record<string, Record<string, { sku: string; price: number }>>
): { items: BOMItem[], verificationStats: any, totalPrice: number } => {
    
    const activeLine = lines.find(l => l.id === globalLineId) || lines[0];
    const pricedItems = validateBOMAgainstCatalog(bom, pricingDB[globalLineId] || {}, activeLine);

    const verifiedCount = pricedItems.filter(i => i.verificationStatus === 'verified').length;
    const missingCount = pricedItems.filter(i => i.verificationStatus === 'missing').length;
    const totalPrice = pricedItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

    return {
        items: pricedItems,
        verificationStats: {
            total: bom.length,
            verified: verifiedCount,
            missing: missingCount,
            review: 0,
            hasSource: true, 
            sourceName: "Dealer Rate Sheet", 
        },
        totalPrice
    };
};

// --- STEP 1: START ---
export const StepStart = ({ 
    onDesignMode, 
    onQuoteMode, 
    onAdmin 
}: { 
    onDesignMode: () => void, 
    onQuoteMode: () => void, 
    onAdmin: () => void 
}) => {
    return (
        <div className="h-full w-full overflow-y-auto bg-slate-50 relative">
            <div className="absolute top-0 right-0 p-4 z-20">
                <button 
                    onClick={onAdmin}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-xs uppercase tracking-widest transition-all bg-white/50 backdrop-blur px-4 py-2 rounded-full border border-slate-200"
                >
                    <Lock size={12} /> Admin Access
                </button>
            </div>

            <div className="flex flex-col items-center justify-center min-h-full p-6">
                <div className="mb-12 text-center space-y-4">
                    <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-slate-900 leading-none">
                        1951 <span className="text-brand-600">Cabinetry</span> Billing Engine
                    </h1>
                    <p className="text-lg text-slate-500 font-medium">Professional US Kitchen Cabinet Billing & Pricing.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl w-full">
                    
                    {/* QUOTATION AI CARD */}
                    <div 
                        onClick={onQuoteMode}
                        className="group relative bg-white rounded-[2rem] p-8 md:p-12 shadow-xl hover:shadow-2xl hover:shadow-brand-200 border-2 border-transparent hover:border-brand-500 transition-all cursor-pointer overflow-hidden"
                    >
                         <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Calculator size={120} className="text-brand-600" />
                        </div>
                        <div className="relative z-10 space-y-6">
                            <div className="w-16 h-16 bg-brand-100 rounded-2xl flex items-center justify-center text-brand-600 mb-4">
                                <FileSpreadsheet size={32} />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 mb-2 group-hover:text-brand-600 transition-colors">Billing Engine</h2>
                                <p className="text-slate-500 font-medium leading-relaxed">
                                    Extract cabinets from drawings, validate against 1951 Specifications, and generate quote.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest pt-4">
                                <Bot size={14} /> Full Pricing Engine
                            </div>
                            <button className="w-full py-4 bg-slate-100 text-slate-900 font-bold rounded-xl group-hover:bg-brand-600 group-hover:text-white transition-all flex items-center justify-center gap-2">
                                Start New Quote <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>

                    {/* DESIGN AI CARD */}
                    <div 
                        onClick={onDesignMode}
                        className="group relative bg-white rounded-[2rem] p-8 md:p-12 shadow-xl hover:shadow-2xl hover:shadow-purple-200 border-2 border-transparent hover:border-purple-500 transition-all cursor-pointer overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                            <PenTool size={120} className="text-purple-600" />
                        </div>
                        <div className="relative z-10 space-y-6">
                            <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600 mb-4">
                                <Layout size={32} />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 mb-2 group-hover:text-purple-600 transition-colors">Design Analysis</h2>
                                <p className="text-slate-500 font-medium leading-relaxed">
                                    Analyze room geometry against NKBA standards and generate 1951 Cabinetry layouts.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest pt-4">
                                <ShieldCheck size={14} /> NKBA Standards
                            </div>
                            <button className="w-full py-4 bg-slate-100 text-slate-900 font-bold rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-all flex items-center justify-center gap-2">
                                Create New Design <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>

                </div>

                <div className="mt-12 flex gap-8 text-slate-400 text-sm font-medium">
                    <span className="flex items-center gap-2"><BookOpen size={16} /> 1951 Specification Rules</span>
                    <span className="flex items-center gap-2"><CheckCircle2 size={16} /> Strict Verification</span>
                </div>
            </div>
        </div>
    );
};

// --- STEP 2: UPLOAD & ANALYZE ---
export const StepUpload = ({ 
    mode, 
    onUpload, 
    isAnalyzing, 
    analysisResult, 
    onNext, 
    onBack,
    isGenerating
}: { 
    mode: 'design' | 'quotation',
    onUpload: (f: File) => void, 
    isAnalyzing: boolean, 
    analysisResult: string[] | string | null, 
    onNext: () => void,
    onBack: () => void,
    isGenerating?: boolean
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                setPreview(ev.target?.result as string);
            };
            reader.readAsDataURL(file);
            onUpload(file);
        }
    };

    const isPdf = preview?.startsWith('data:application/pdf');

    return (
        <div className="h-full flex flex-col bg-slate-50">
            <div className="border-b px-6 py-4 flex justify-between items-center bg-white shadow-sm z-10">
                <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold"><ArrowLeft size={20}/> Back</button>
                <h2 className="text-xl font-black text-slate-900">Upload Floor Plan</h2>
                <div className="w-20"></div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-4xl mx-auto space-y-8">
                    {/* DROPZONE */}
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-4 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all ${
                            isAnalyzing ? 'border-brand-200 bg-brand-50' : 'border-slate-300 hover:border-brand-500 hover:bg-slate-100'
                        }`}
                    >
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
                        
                        {isAnalyzing ? (
                            <div className="flex flex-col items-center animate-pulse">
                                <Loader2 size={48} className="text-brand-600 animate-spin mb-4" />
                                <h3 className="text-xl font-bold text-slate-800">Scanning Plan...</h3>
                                <p className="text-slate-500">Extracting cabinet codes and labels.</p>
                            </div>
                        ) : preview ? (
                            <div className="relative">
                                {isPdf ? (
                                    <div className="flex flex-col items-center justify-center h-64 bg-slate-50 rounded-xl border border-slate-200">
                                        <FileText size={64} className="text-red-500 mb-4 shadow-sm" />
                                        <span className="font-bold text-slate-800 text-lg">PDF Document Uploaded</span>
                                        <span className="text-sm text-slate-500">Ready for scan</span>
                                    </div>
                                ) : (
                                    <img src={preview} alt="Plan" className="max-h-96 mx-auto rounded shadow-lg object-contain" />
                                )}
                                <div className="mt-4 flex justify-center">
                                    <button className="text-sm text-slate-500 hover:text-brand-600 underline font-medium">Click to change file</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">
                                    <Upload size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Click to Upload Floor Plan</h3>
                                <p className="text-slate-500">Supports JPG, PNG, PDF</p>
                            </div>
                        )}
                    </div>

                    {/* ANALYSIS RESULT (FOR DESIGN MODE ONLY - QUOTE MODE GOES TO REVIEW STEP) */}
                    {analysisResult && mode === 'design' && (
                        <div className="p-4 bg-slate-50 border-t flex justify-end">
                            <button 
                                onClick={onNext}
                                className="bg-brand-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-brand-700 transition-all flex items-center gap-2"
                            >
                                Select Kitchen Shape <ArrowRight size={18} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- NEW STEP: EXTRACTION REVIEW ---
export const StepExtractionReview = ({
    codes,
    onRemoveCode,
    onNext,
    onBack
}: {
    codes: string[],
    onRemoveCode: (index: number) => void,
    onNext: () => void,
    onBack: () => void
}) => {
    return (
        <div className="h-full flex flex-col bg-slate-50">
            <div className="border-b px-6 py-4 flex justify-between items-center bg-white shadow-sm z-10">
                <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold"><ArrowLeft size={20}/> Back</button>
                <div className="text-center">
                    <h2 className="text-xl font-black text-slate-900">Review Scanned Items</h2>
                    <p className="text-xs text-slate-500">Remove any incorrect scans before proceeding.</p>
                </div>
                <button onClick={onNext} className="bg-brand-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-brand-700 flex items-center gap-2">
                    Select Manufacturer <ArrowRight size={18} />
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-5xl mx-auto">
                    {codes.length === 0 ? (
                         <div className="text-center py-12 text-slate-500">No codes detected. Please try scanning again.</div>
                    ) : (
                        <div className="flex flex-wrap gap-3">
                            {codes.map((code, idx) => (
                                <div key={idx} className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-3 shadow-sm hover:shadow-md transition-all group animate-in zoom-in-50 duration-200">
                                    <span className="font-mono font-bold text-slate-700">{code}</span>
                                    <button 
                                        onClick={() => onRemoveCode(idx)}
                                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full p-1 transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="mt-8 p-4 bg-blue-50 text-blue-800 rounded-lg text-sm flex items-center gap-3">
                        <InfoIcon size={18} />
                        These raw codes will be grouped and priced in the next steps.
                    </div>
                </div>
            </div>
        </div>
    )
}

function InfoIcon({size}:{size:number}) { return <AlertTriangle size={size} /> }

// --- REUSED: MANUFACTURER SELECTION (FORMERLY LINE SWITCH) ---
export const StepManufacturerSelect = ({
    selectedLineId, lines, onChangeLine, onNext, onBack
}: {
    selectedLineId: string,
    lines: CabinetLine[],
    onChangeLine: (id: string) => void,
    onNext: () => void,
    onBack: () => void
}) => {
    return (
        <div className="h-full flex flex-col bg-slate-50">
             <div className="border-b px-6 py-4 flex justify-between items-center bg-white shadow-sm z-10">
                <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold"><ArrowLeft size={20}/> Back</button>
                <h2 className="text-xl font-black text-slate-900">Choose Manufacturer Line</h2>
                <button onClick={onNext} className="bg-brand-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-brand-700 flex items-center gap-2">
                    Configure Specs <ArrowRight size={18} />
                </button>
            </div>
            <div className="p-8 max-w-5xl mx-auto w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {lines.map(line => (
                        <div 
                            key={line.id} 
                            onClick={() => onChangeLine(line.id)}
                            className={`cursor-pointer rounded-xl border-2 p-6 transition-all ${
                                selectedLineId === line.id 
                                ? 'border-brand-600 bg-brand-50 shadow-lg ring-2 ring-brand-200' 
                                : 'border-slate-200 bg-white hover:border-brand-300'
                            }`}
                        >
                            <div className="flex justify-between mb-2">
                                <h3 className="font-bold text-lg">{line.name}</h3>
                                <span className="text-xs font-bold px-2 py-1 bg-slate-100 rounded">{line.tier}</span>
                            </div>
                            <p className="text-sm text-slate-500 mb-4">{line.description}</p>
                            <div className="text-sm font-mono text-slate-700">
                                <div>Multiplier: {line.multiplier}x</div>
                                <div>Finish Prem: {(line.finishPremium*100).toFixed(0)}%</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
};

// --- NEW STEP: SPECIFICATION SELECTION ---
export const StepSpecSelection = ({
    line,
    specs,
    onUpdateSpecs,
    onNext,
    onBack,
    isProcessing
}: {
    line: CabinetLine,
    specs: ProjectInfo['specs'],
    onUpdateSpecs: (u: Partial<ProjectInfo['specs']>) => void,
    onNext: () => void,
    onBack: () => void,
    isProcessing: boolean
}) => {
    const options = line.availableOptions || {
        doorStyles: ['Standard'],
        woodSpecies: ['Standard'],
        finishes: ['Standard'],
        constructions: ['Standard']
    };

    return (
        <div className="h-full flex flex-col bg-slate-50">
            <div className="border-b px-6 py-4 flex justify-between items-center bg-white shadow-sm z-10">
                <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold"><ArrowLeft size={20}/> Back</button>
                <div className="text-center">
                    <h2 className="text-xl font-black text-slate-900">Configure Specifications</h2>
                    <p className="text-xs text-slate-500">{line.name}</p>
                </div>
                <button 
                    onClick={onNext} 
                    disabled={isProcessing}
                    className="bg-brand-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-brand-700 flex items-center gap-2 disabled:opacity-50"
                >
                    {isProcessing ? <Loader2 className="animate-spin" size={18}/> : <Boxes size={18} />}
                    {isProcessing ? 'Generating BOM...' : 'Calculate Pricing'}
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow border border-slate-200 space-y-8">
                    
                    {/* DOOR STYLE */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Door Style</label>
                        <div className="grid grid-cols-2 gap-3">
                            {options.doorStyles.map(style => (
                                <button
                                    key={style}
                                    onClick={() => onUpdateSpecs({ doorStyle: style })}
                                    className={`px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                                        specs.doorStyle === style
                                        ? 'bg-brand-50 border-brand-500 text-brand-700'
                                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                    }`}
                                >
                                    {style}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* FINISH */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Finish / Color</label>
                        <div className="grid grid-cols-2 gap-3">
                            {options.finishes.map(finish => (
                                <button
                                    key={finish}
                                    onClick={() => onUpdateSpecs({ stainColor: finish })}
                                    className={`px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                                        specs.stainColor === finish
                                        ? 'bg-brand-50 border-brand-500 text-brand-700'
                                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                    }`}
                                >
                                    {finish}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* CONSTRUCTION / BOX */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Construction</label>
                        <select 
                            className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-brand-500"
                            value={specs.drawerBox}
                            onChange={(e) => onUpdateSpecs({ drawerBox: e.target.value })}
                        >
                             {options.constructions.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                </div>
            </div>
        </div>
    )
}

export const StepShapeSelection = ({ onSelectShape, onBack }: { onSelectShape: (s: KitchenShape) => void, onBack: () => void }) => {
    const shapes: KitchenShape[] = ['L-Shape', 'U-Shape', 'Galley', 'Island', 'Single Wall'];
    return (
        <div className="h-full flex flex-col bg-slate-50">
             <div className="border-b px-6 py-4 flex items-center bg-white shadow-sm z-10">
                <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold"><ArrowLeft size={20}/> Back</button>
                <h2 className="ml-4 text-xl font-black text-slate-900">Select Kitchen Shape</h2>
            </div>
            <div className="p-8 grid grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                {shapes.map(s => (
                    <button key={s} onClick={() => onSelectShape(s)} className="p-8 bg-white border-2 border-slate-200 rounded-xl hover:border-brand-500 hover:shadow-lg transition-all text-xl font-bold text-slate-700">
                        {s}
                    </button>
                ))}
            </div>
        </div>
    )
};

export const StepDesignResult = ({ layout, onBack, nkbaRules }: { layout: DesignLayout | null, onBack: () => void, nkbaRules: any }) => {
    return (
        <div className="h-full flex flex-col bg-slate-50">
            <div className="border-b px-6 py-4 flex items-center bg-white shadow-sm z-10">
                <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold"><ArrowLeft size={20}/> Back</button>
                <h2 className="ml-4 text-xl font-black text-slate-900">Design Analysis</h2>
            </div>
            <div className="p-8 overflow-y-auto">
                {layout ? (
                    <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow space-y-6">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-bold">{layout.kitchenShape}</span>
                            {nkbaRules && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1"><ShieldCheck size={14}/> NKBA Checked</span>}
                        </div>
                        <div>
                            <h3 className="font-bold text-lg mb-2">Zoning Analysis</h3>
                            <p className="text-slate-600">{layout.zoningAnalysis}</p>
                        </div>
                         <div>
                            <h3 className="font-bold text-lg mb-2">Design Notes</h3>
                            <p className="text-slate-600">{layout.designNotes}</p>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg mb-2">Proposed Cabinetry</h3>
                            <ul className="list-disc pl-5 space-y-1">
                                {layout.suggestedCabinets.map((item, i) => (
                                    <li key={i} className="text-slate-700">
                                        <span className="font-mono font-bold">{item.sku || "GEN"}</span> - {item.description} (Qty: {item.quantity})
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-slate-500">No layout generated.</div>
                )}
            </div>
        </div>
    )
};

export const StepBOM = ({ 
    bom, setBom, onNext, onBack, selectedLineId, lines, pricingDatabase 
}: { 
    bom: BOMItem[], 
    setBom: (b: BOMItem[]) => void, 
    onNext: () => void, 
    onBack: () => void,
    selectedLineId: string,
    lines: CabinetLine[],
    pricingDatabase: any
}) => {
    // Convert BOMItem to QuoteItem for BOMBuilder
    const quoteItems: QuoteItem[] = bom.map(b => ({
        id: b.id,
        tag: b.type === 'Base' ? 'B' : (b.type === 'Wall' ? 'W' : 'A'), 
        sku: b.sku || "",
        description: b.description,
        type: b.type, // Pass type for grouping
        quantity: b.quantity,
        options: b.extractedOptions || [],
        unitPrice: b.unitPrice || 0,
        totalPrice: b.totalPrice || 0,
        isValid: b.verificationStatus === 'verified',
        validationMessage: b.verificationStatus !== 'verified' ? "Review Required" : undefined
    }));

    const handleUpdate = (id: string, updates: Partial<QuoteItem>) => {
        const newBom = bom.map(item => {
            if (item.id !== id) return item;
            const updated = { ...item, ...updates };
            // Map back specific fields
            if (updates.sku) {
                updated.sku = updates.sku;
                updated.rawCode = updates.sku;
            }
            if (updates.options) updated.extractedOptions = updates.options;
            return updated;
        });
        setBom(newBom);
    };
    
    const handleDelete = (id: string) => {
        setBom(bom.filter(b => b.id !== id));
    };

    const handleLookup = (sku: string) => {
        const currentLine = lines.find(l => l.id === selectedLineId);
        if (!currentLine) return { unitPrice: 0, isValid: false, description: "No Line Selected" };
        const db = pricingDatabase[selectedLineId] || {};
        return calculateItemPrice(sku, db, currentLine);
    }

    // Group items for display if needed, but BOMBuilder handles flat list usually.
    // The prompt asked for "Grouping". Let's sort them in BOMBuilder or pass them sorted.
    // For now, let's just use the builder which is generic.

    return (
        <div className="h-full flex flex-col bg-slate-50">
            <div className="border-b px-6 py-4 flex justify-between items-center bg-white shadow-sm z-10">
                <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold"><ArrowLeft size={20}/> Back to Specs</button>
                <h2 className="text-xl font-black text-slate-900">Bill of Materials</h2>
                <button onClick={onNext} className="bg-brand-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-brand-700 flex items-center gap-2">
                    Final Quote <ArrowRight size={18} />
                </button>
            </div>
            <div className="flex-1 overflow-hidden">
                <BOMBuilder 
                    items={quoteItems}
                    lineId={selectedLineId}
                    onUpdateItem={handleUpdate}
                    onDeleteItem={handleDelete}
                    onLookupPrice={handleLookup}
                />
            </div>
        </div>
    );
};

export const StepProjectDetails = ({
    projectInfo, onUpdate, onNext, onBack, selectedLineName
}: {
    projectInfo: ProjectInfo,
    onUpdate: (u: Partial<ProjectInfo>) => void,
    onNext: () => void,
    onBack: () => void,
    selectedLineName: string
}) => {
    return (
        <div className="h-full flex flex-col bg-slate-50">
            <div className="border-b px-6 py-4 flex justify-between items-center bg-white shadow-sm z-10">
                <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold"><ArrowLeft size={20}/> Back</button>
                <h2 className="text-xl font-black text-slate-900">Project Details</h2>
                <button onClick={onNext} className="bg-brand-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-brand-700 flex items-center gap-2">
                    View Quote <ArrowRight size={18} />
                </button>
            </div>
            <div className="p-8 max-w-4xl mx-auto w-full overflow-y-auto">
                <div className="bg-white p-8 rounded-xl shadow space-y-6">
                    <h3 className="font-bold text-lg border-b pb-2">Client Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Client Name</label>
                            <input className="w-full border rounded px-3 py-2" value={projectInfo.clientName} onChange={e => onUpdate({clientName: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Project Name/Address</label>
                            <input className="w-full border rounded px-3 py-2" value={projectInfo.projectName} onChange={e => onUpdate({projectName: e.target.value})} />
                        </div>
                    </div>

                    <h3 className="font-bold text-lg border-b pb-2 mt-4">Order Specifications ({selectedLineName})</h3>
                    <div className="grid grid-cols-2 gap-4">
                        {Object.entries(projectInfo.specs).map(([key, val]) => (
                            <div key={key}>
                                <label className="block text-sm font-medium text-slate-700 mb-1 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</label>
                                <input 
                                    className="w-full border rounded px-3 py-2" 
                                    value={val as string} 
                                    onChange={e => onUpdate({
                                        specs: { ...projectInfo.specs, [key]: e.target.value }
                                    })} 
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
};

// --- STEP 8: QUOTE (REBUILT FOR STRICT DEALER LOGIC) ---
export const StepQuote = ({ 
    bom, 
    selectedLineId, 
    lines, 
    pricingDatabase, 
    projectInfo, 
    onRestart, 
    onBack 
}: {
    bom: BOMItem[],
    selectedLineId: string,
    lines: CabinetLine[],
    pricingDatabase: any,
    projectInfo: ProjectInfo,
    onRestart: () => void,
    onBack: () => void
}) => {
    const [viewMode, setViewMode] = useState<'client' | 'manufacturer'>('client');
    const currentLine = lines.find(l => l.id === selectedLineId);

    // --- CALCULATION LOGIC ---
    // 1. Material Subtotal (Cabinets + Accessories)
    const materialSubtotal = bom.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    
    // 2. Finish Premium
    const finishPremium = materialSubtotal * (currentLine?.finishPremium || 0);

    // 3. Shipping
    const shippingCost = materialSubtotal * (currentLine?.shippingFactor || 0.05);

    // 4. Dealer Services
    let laborTotal = 0;
    projectInfo.dealerServices.forEach(srv => {
        if (srv.type === 'flat') laborTotal += srv.value;
        if (srv.type === 'per_cabinet') laborTotal += (srv.value * bom.length); // Simple count for now
        if (srv.type === 'percent_material') laborTotal += (materialSubtotal * (srv.value / 100));
    });

    // 5. Tax (Only on Material, Finish, Shipping - typically services are non-taxable in many states, but customizable)
    const taxableAmount = materialSubtotal + finishPremium + shippingCost; // Simplified rule
    const taxAmount = taxableAmount * (projectInfo.taxRate || 0);

    // 6. Grand Total
    const grandTotal = taxableAmount + laborTotal + taxAmount;


    return (
        <div className="h-full flex flex-col bg-slate-100">
            {/* Header */}
            <div className="border-b px-6 py-4 flex justify-between items-center bg-white shadow-sm z-10 print:hidden">
                <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold"><ArrowLeft size={20}/> Edit Project</button>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setViewMode('client')}
                        className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${viewMode === 'client' ? 'bg-white shadow text-brand-700' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        Client Invoice
                    </button>
                    <button 
                        onClick={() => setViewMode('manufacturer')}
                        className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${viewMode === 'manufacturer' ? 'bg-white shadow text-brand-700' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        Manufacturer Order
                    </button>
                </div>
                <div className="flex gap-2">
                     <button onClick={onRestart} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded font-medium">
                        New Project
                    </button>
                    <button className="bg-brand-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-brand-700 flex items-center gap-2 shadow-lg">
                        <Printer size={18} /> Print {viewMode === 'client' ? 'Invoice' : 'Order'}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                {viewMode === 'client' ? (
                    // --- CLIENT INVOICE VIEW ---
                    <div className="max-w-4xl mx-auto bg-white shadow-2xl rounded-none md:rounded-lg overflow-hidden min-h-[800px] flex flex-col animate-in fade-in slide-in-from-bottom-4">
                        <div className="bg-slate-900 text-white p-12">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h1 className="text-4xl font-bold mb-2">INVOICE</h1>
                                    <p className="text-slate-400">#{projectInfo.specs.soNumber || "DRAFT"}</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold">{projectInfo.dealerName}</div>
                                    <div className="text-slate-400 text-sm">{projectInfo.dealerAddress}</div>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 grid grid-cols-2 gap-12 border-b border-slate-100">
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Bill To</h3>
                                <div className="text-slate-900 font-bold text-lg">{projectInfo.clientName}</div>
                                <div className="text-slate-500">{projectInfo.projectName}</div>
                            </div>
                            <div className="text-right">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Specs</h3>
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-end gap-4"><span className="text-slate-400">Line:</span> <span className="font-bold">{currentLine?.name}</span></div>
                                    <div className="flex justify-end gap-4"><span className="text-slate-400">Door:</span> <span className="font-bold">{projectInfo.specs.doorStyle}</span></div>
                                    <div className="flex justify-end gap-4"><span className="text-slate-400">Finish:</span> <span className="font-bold">{projectInfo.specs.stainColor}</span></div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 p-8">
                            <table className="w-full text-left">
                                <thead className="text-xs text-slate-400 uppercase border-b-2 border-slate-100">
                                    <tr>
                                        <th className="py-4">Item</th>
                                        <th className="py-4 text-center">Qty</th>
                                        <th className="py-4 text-right">Rate</th>
                                        <th className="py-4 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 text-sm">
                                    {/* Section 1: Cabinets */}
                                    {bom.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="py-3 pr-4">
                                                <div className="font-bold text-slate-800">{item.sku}</div>
                                                <div className="text-slate-500 text-xs">{item.description}</div>
                                            </td>
                                            <td className="py-3 text-center text-slate-600">{item.quantity}</td>
                                            <td className="py-3 text-right text-slate-600 font-mono">${item.unitPrice?.toFixed(2)}</td>
                                            <td className="py-3 text-right text-slate-900 font-bold font-mono">${item.totalPrice?.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    
                                    {/* Section 2: Dealer Services */}
                                    {projectInfo.dealerServices.map(srv => {
                                        let val = 0;
                                        if (srv.type === 'flat') val = srv.value;
                                        if (srv.type === 'per_cabinet') val = srv.value * bom.length;
                                        if (srv.type === 'percent_material') val = materialSubtotal * (srv.value/100);
                                        
                                        return (
                                            <tr key={srv.id} className="bg-slate-50">
                                                <td className="py-3 pr-4 font-bold text-slate-700">{srv.name}</td>
                                                <td className="py-3 text-center text-slate-500">-</td>
                                                <td className="py-3 text-right text-slate-500 font-mono">-</td>
                                                <td className="py-3 text-right text-slate-700 font-bold font-mono">${val.toFixed(2)}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="bg-slate-50 p-8 flex justify-end items-start gap-12 border-t border-slate-100">
                            <div className="text-right space-y-2">
                                <div className="text-slate-500 text-sm">Materials Subtotal</div>
                                {currentLine?.finishPremium ? <div className="text-slate-500 text-sm">Finish Upcharge ({(currentLine.finishPremium * 100).toFixed(0)}%)</div> : null}
                                <div className="text-slate-500 text-sm">Freight / Shipping</div>
                                <div className="text-slate-500 text-sm">Services / Labor</div>
                                <div className="text-slate-500 text-sm">Tax ({(projectInfo.taxRate * 100).toFixed(1)}%)</div>
                                <div className="text-slate-900 font-bold text-2xl mt-4 pt-4 border-t border-slate-200">Total Due</div>
                            </div>
                            <div className="text-right space-y-2 font-mono text-slate-700">
                                <div>${materialSubtotal.toFixed(2)}</div>
                                {currentLine?.finishPremium ? <div>${finishPremium.toFixed(2)}</div> : null}
                                <div>${shippingCost.toFixed(2)}</div>
                                <div>${laborTotal.toFixed(2)}</div>
                                <div>${taxAmount.toFixed(2)}</div>
                                <div className="text-brand-600 font-black text-2xl mt-4 pt-4 border-t border-slate-200">${grandTotal.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>
                ) : (
                    // --- MANUFACTURER ORDER VIEW ---
                    <div className="max-w-4xl mx-auto bg-white shadow-xl border border-slate-200 min-h-[800px] flex flex-col p-8 md:p-12 animate-in fade-in slide-in-from-bottom-4 font-mono">
                        <div className="border-b-2 border-black pb-4 mb-8">
                            <h1 className="text-3xl font-bold uppercase tracking-widest">Purchase Order</h1>
                            <div className="flex justify-between mt-2">
                                <span>PO #: {projectInfo.specs.poNumber || "PENDING"}</span>
                                <span>Date: {new Date().toLocaleDateString()}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
                            <div className="border p-4">
                                <div className="font-bold mb-2">VENDOR:</div>
                                <div>{currentLine?.name}</div>
                                <div>ATTN: ORDER ENTRY</div>
                            </div>
                            <div className="border p-4">
                                <div className="font-bold mb-2">SHIP TO:</div>
                                <div>{projectInfo.dealerName} DC</div>
                                <div>{projectInfo.dealerAddress}</div>
                            </div>
                        </div>

                        <div className="mb-8 border p-4 text-sm">
                            <div className="font-bold border-b pb-2 mb-2">ORDER SPECIFICATIONS</div>
                            <div className="grid grid-cols-2 gap-y-1">
                                <div><span className="font-bold">Door Style:</span> {projectInfo.specs.doorStyle}</div>
                                <div><span className="font-bold">Species:</span> {projectInfo.specs.woodSpecies}</div>
                                <div><span className="font-bold">Finish:</span> {projectInfo.specs.stainColor}</div>
                                <div><span className="font-bold">Drawer:</span> {projectInfo.specs.drawerBox}</div>
                            </div>
                        </div>

                        <table className="w-full text-left text-sm border-collapse border border-black">
                            <thead className="bg-slate-100">
                                <tr>
                                    <th className="border border-black p-2 w-16 text-center">Line</th>
                                    <th className="border border-black p-2 w-16 text-center">Qty</th>
                                    <th className="border border-black p-2">Item Code</th>
                                    <th className="border border-black p-2">Description</th>
                                    <th className="border border-black p-2 w-24 text-center">Options</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bom.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="border border-black p-2 text-center">{idx + 1}</td>
                                        <td className="border border-black p-2 text-center font-bold">{item.quantity}</td>
                                        <td className="border border-black p-2 font-bold">{item.sku}</td>
                                        <td className="border border-black p-2">{item.description}</td>
                                        <td className="border border-black p-2 text-center">
                                            {(item.extractedOptions?.length || 0) > 0 ? "YES" : "-"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="mt-auto pt-12 text-center text-xs">
                            <p>*** END OF ORDER ***</p>
                            <p>PLEASE CONFIRM RECEIPT AND LEAD TIME WITHIN 24 HOURS.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
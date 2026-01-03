import React, { useState, useEffect, useRef } from 'react';
import { 
    Upload, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, 
    FileText, Loader2, DollarSign, PenTool, MousePointer2, 
    Plus, Trash2, Bot, ShieldCheck, Cpu, Play, Boxes, Search,
    FileSpreadsheet, AlertTriangle, Calculator, Percent, XCircle, Info, MapPin, Printer, Download, Lock, User, Building, Factory, ChevronDown
} from 'lucide-react';
import { BOMItem, CabinetLine, QuoteItem, ProjectInfo } from '../types';
import { normalizeSku, getSmartEstimate, findCatalogMatch } from '../services/pricingEngine';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// --- HELPER: Pricing & Verification Logic (Updated for Multi-Manufacturer) ---
const calculatePricing = (
    bom: BOMItem[], 
    globalLineId: string, 
    lines: CabinetLine[],
    pricingDB: Record<string, Record<string, { sku: string; price: number }>>
): { items: BOMItem[], verificationStats: any } => {
    
    let verifiedCount = 0;
    let estimateCount = 0;

    const pricedItems = bom.map((item, idx) => {
        // Determine which line to use for this specific item (default to global if not set)
        const effectiveLineId = item.selectedLineId || globalLineId;
        const activeLine = lines.find(l => l.id === effectiveLineId) || lines[0];
        const linePricing = pricingDB[effectiveLineId] || {};
        
        // Use normalized key for fallback/display
        const normalizedKey = normalizeSku(item.sku || item.description);
        
        // Use robust matching logic
        const { match } = findCatalogMatch(item, linePricing);
        
        let status = 'estimate';
        let unitPrice = 0;

        // 1. Calculate price for the chosen line
        if (match) {
            status = 'verified';
            unitPrice = match.price;
            verifiedCount++;
        } else {
            unitPrice = getSmartEstimate(normalizedKey, activeLine?.tier || 'Mid-Range');
            status = 'estimate';
            estimateCount++;
        }

        // 2. Pre-calculate comparison options for ALL lines (for the dropdown)
        const pricingOptions = lines.map(line => {
            const db = pricingDB[line.id] || {};
            const { match: lineMatch } = findCatalogMatch(item, db);
            
            let price = 0;
            let type: 'verified' | 'estimate' = 'estimate';

            if (lineMatch) {
                price = lineMatch.price;
                type = 'verified';
            } else {
                price = getSmartEstimate(normalizedKey, line.tier);
                type = 'estimate';
            }
            return { lineId: line.id, lineName: line.name, price, type };
        });

        return {
            ...item,
            id: item.id || `priced-${idx}`,
            sku: match ? match.sku : normalizedKey,
            normalizedCode: normalizedKey,
            unitPrice,
            totalPrice: unitPrice * item.quantity,
            verificationStatus: status,
            selectedLineId: effectiveLineId, // Persist the selection
            pricingOptions // Attach options for UI
        };
    });

    return {
        items: pricedItems,
        verificationStats: {
            total: bom.length,
            verified: verifiedCount,
            estimates: estimateCount,
            hasSource: true, 
            sourceName: "Mixed Sources", 
        }
    };
};

// --- STEP 1: START ---
export const StepStart = ({ onNext, onAdmin }: { onNext: () => void, onAdmin: () => void }) => (
    <div className="h-full w-full overflow-y-auto bg-white relative">
        <div className="absolute top-0 right-0 p-4 md:p-8 z-20">
            <button 
                onClick={onAdmin}
                className="flex items-center gap-2 text-slate-500 hover:text-brand-600 font-bold text-sm transition-all bg-white/80 backdrop-blur px-4 py-2 rounded-full border border-slate-100 shadow-sm"
            >
                <Lock size={14} /> Admin Login
            </button>
        </div>

        <div className="flex flex-col items-center justify-center min-h-full p-6 md:p-12 text-center">
            <div className="max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-brand-600 rounded-3xl text-white shadow-xl shadow-brand-200 mb-4 transform hover:rotate-6 transition-transform">
                    <Play size={40} fill="currentColor" />
                </div>
                <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 leading-tight">
                    KABS <span className="text-brand-600">Quotation AI</span>
                </h1>
                <p className="text-lg md:text-2xl text-slate-500 max-w-2xl mx-auto leading-relaxed font-medium">
                    The professional standard for kitchen designers. Exact plan extraction with verified manufacturer pricing.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10 w-full max-w-lg mx-auto">
                    <button 
                        onClick={onNext} 
                        className="px-12 py-5 bg-brand-600 text-white rounded-2xl text-xl font-bold shadow-xl shadow-brand-200 hover:bg-brand-700 hover:shadow-2xl transition-all transform hover:-translate-y-1 flex items-center justify-center gap-3 w-full"
                    >
                        Create New Quotation <ArrowRight size={24} />
                    </button>
                </div>

                <div className="pt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left max-w-4xl mx-auto">
                    {[
                        { icon: <Bot className="text-brand-600" />, title: "AI Extraction", desc: "Extract cabinets directly from blueprints." },
                        { icon: <FileSpreadsheet className="text-green-600" />, title: "Live Catalogs", desc: "Switch pricing sheets in one click." },
                        { icon: <ShieldCheck className="text-blue-600" />, title: "Audit Ready", desc: "Every price verified against Excel data." }
                    ].map((feature, i) => (
                        <div key={i} className="space-y-2 group">
                            <div className="p-2 bg-slate-50 w-fit rounded-lg group-hover:bg-white group-hover:shadow-md transition-all">{feature.icon}</div>
                            <h3 className="font-bold text-slate-900">{feature.title}</h3>
                            <p className="text-sm text-slate-500 leading-snug">{feature.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
);

// --- STEP 2: UPLOAD (Enhanced Loading & Smartness) ---
export const StepUpload = ({ 
    onUpload, 
    isAnalyzing, 
    analysisResult, 
    onNext,
    onBack,
    isGenerating 
}: { 
    onUpload: (f: File) => void, 
    isAnalyzing: boolean, 
    analysisResult: string | null, 
    onNext: () => void,
    onBack: () => void,
    isGenerating: boolean
}) => {
    const [loadingStage, setLoadingStage] = useState(0);
    const stages = [
        "Initializing Neural Engine...",
        "Scanning Architectural Layers...",
        "Identifying Cabinet Labels (B, W, SB)...",
        "Refining Hand-drawn Markings...",
        "Validating extracted SKU codes..."
    ];

    useEffect(() => {
        let interval: any;
        if (isAnalyzing || isGenerating) {
            interval = setInterval(() => {
                setLoadingStage(prev => (prev + 1) % stages.length);
            }, 1800);
        } else {
            setLoadingStage(0);
        }
        return () => clearInterval(interval);
    }, [isAnalyzing, isGenerating]);

    const getCodeCount = () => {
        if (!analysisResult) return 0;
        const matches = analysisResult.match(/\b[BWS]\d+\b/gi) || analysisResult.split(',').filter(s => s.trim().length > 1);
        return matches.length;
    };

    return (
        <div className="h-full w-full overflow-y-auto bg-slate-50 flex flex-col">
            <div className="bg-white border-b px-6 py-4 flex items-center justify-between shrink-0 shadow-sm z-10">
                <button 
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-colors"
                >
                    <ArrowLeft size={20} /> Back
                </button>
                <div className="flex items-center gap-3">
                    <div className="bg-brand-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</div>
                    <span className="font-bold text-slate-900">Upload Plan</span>
                </div>
                <div className="w-20"></div>
            </div>

            <div className="flex-1 max-w-4xl mx-auto p-4 md:p-10 w-full flex flex-col justify-center">
                <div className="mb-10 text-center">
                    <h2 className="text-3xl font-black text-slate-900">Smart Blueprint Scan</h2>
                    <p className="text-slate-500 mt-2 font-medium">Upload your floor plan for instant, AI-powered extraction.</p>
                </div>

                <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 p-8 md:p-12">
                    {(isAnalyzing || isGenerating) ? (
                        <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in">
                            <div className="relative mb-8">
                                <Loader2 className="animate-spin text-brand-600" size={64} />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Cpu size={24} className="text-brand-400 animate-pulse" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 mb-2">Smart Analyzing</h3>
                            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
                                <span className="w-2 h-2 bg-brand-500 rounded-full animate-ping"></span>
                                <p className="text-brand-600 font-black text-sm uppercase tracking-widest transition-all">
                                    {stages[loadingStage]}
                                </p>
                            </div>
                        </div>
                    ) : analysisResult ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                            <div className="w-20 h-20 bg-green-100 rounded-3xl flex items-center justify-center text-green-600 mb-6 shadow-inner animate-in slide-in-from-top-4">
                                <CheckCircle2 size={40} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 mb-2">Extraction Succeeded</h3>
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 w-full max-w-md my-6 text-left shadow-inner">
                                <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-3">
                                    <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Global BOM Source</span>
                                    <span className="bg-brand-600 text-white px-3 py-1 rounded-full text-xs font-bold">{getCodeCount()} Components Identifed</span>
                                </div>
                                <div className="text-sm text-slate-600 font-mono leading-relaxed max-h-32 overflow-y-auto no-scrollbar scroll-smooth">
                                    {analysisResult.split(',').map((code, idx) => (
                                        <span key={idx} className="inline-block bg-white border border-slate-200 px-2 py-1 rounded mr-1 mb-1 font-black text-brand-700">
                                            {code.trim()}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            
                            <button 
                                onClick={onNext} 
                                className="w-full max-w-md py-5 bg-brand-600 text-white font-black text-xl rounded-2xl hover:bg-brand-700 shadow-xl shadow-brand-200 transition-all flex items-center justify-center gap-3 transform active:scale-95"
                            >
                                Build Professional BOM <ArrowRight size={24} />
                            </button>
                            <button 
                                onClick={() => onUpload(null as any)}
                                className="mt-6 text-slate-400 hover:text-slate-600 font-bold text-sm underline decoration-dotted"
                            >
                                Scan different area
                            </button>
                        </div>
                    ) : (
                        <div className="w-full h-full min-h-[350px] border-4 border-dashed border-slate-100 rounded-[2rem] flex flex-col items-center justify-center p-8 md:p-12 hover:border-brand-200 hover:bg-brand-50/20 transition-all group cursor-pointer relative">
                            <Upload size={64} className="text-slate-200 mb-6 transition-all group-hover:-translate-y-2 group-hover:text-brand-400" />
                            <h3 className="text-2xl font-black text-slate-800 mb-2">Select Design Blueprint</h3>
                            <p className="text-slate-400 mb-8 font-medium">Auto-detection for technical plans (PDF/IMG)</p>
                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*,.pdf" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
                            <div className="px-10 py-4 bg-white border-2 border-slate-200 rounded-2xl font-black text-slate-700 shadow-sm hover:shadow-md transition-all">
                                Upload File
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- STEP 3: BOM REVIEW ---
export const StepBOM = ({ 
    bom, 
    setBom, 
    onNext, 
    onBack 
}: { 
    bom: BOMItem[], 
    setBom: (items: BOMItem[]) => void, 
    onNext: () => void, 
    onBack: () => void 
}) => {
    const totalQty = bom.reduce((acc, item) => acc + item.quantity, 0);

    const updateQty = (id: string, delta: number) => {
        const newBom = bom.map(item => {
            if (item.id === id) {
                return { ...item, quantity: Math.max(0, item.quantity + delta) };
            }
            return item;
        }).filter(item => item.quantity > 0);
        setBom(newBom);
    };

    return (
        <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden">
            <div className="bg-white border-b px-6 py-5 flex items-center justify-between shrink-0 shadow-sm z-10">
                <button 
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-colors"
                >
                    <ArrowLeft size={20} /> Back
                </button>
                <div className="flex items-center gap-4">
                    <div className="bg-brand-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">2</div>
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-slate-900">Review Bill of Materials</h2>
                    </div>
                </div>
                <div className="flex bg-slate-900 text-white px-4 py-1.5 rounded-full text-sm font-bold">
                    {totalQty} Items Total
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4 md:p-10">
                <div className="max-w-6xl mx-auto bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col h-full">
                    <div className="overflow-x-auto h-full">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Part Code</th>
                                    <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Description</th>
                                    <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Quantity</th>
                                    <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {bom.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-8 py-20 text-center">
                                             <Boxes size={48} className="mx-auto text-slate-200 mb-4" />
                                             <p className="text-slate-400 font-medium">No items found in plan.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    bom.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-8 py-5">
                                                <span className="font-mono font-black px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-900">
                                                    {item.sku}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="text-slate-900 font-bold">{item.description}</div>
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{item.type}</div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center justify-center bg-slate-100 p-1 rounded-2xl w-fit mx-auto">
                                                    <button 
                                                        onClick={() => updateQty(item.id, -1)}
                                                        className="w-8 h-8 flex items-center justify-center bg-white text-slate-900 font-black rounded-lg shadow-sm hover:bg-brand-600 hover:text-white transition-all"
                                                    >
                                                        -
                                                    </button>
                                                    <div className="w-10 text-center font-black text-slate-900 text-base">
                                                        {item.quantity}
                                                    </div>
                                                    <button 
                                                        onClick={() => updateQty(item.id, 1)}
                                                        className="w-8 h-8 flex items-center justify-center bg-white text-slate-900 font-black rounded-lg shadow-sm hover:bg-brand-600 hover:text-white transition-all"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <button 
                                                    onClick={() => updateQty(item.id, -item.quantity)}
                                                    className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="bg-white border-t p-6 md:px-12 md:py-8 shrink-0 flex items-center justify-center z-10 shadow-2xl">
                <button 
                    onClick={onNext} 
                    disabled={bom.length === 0} 
                    className="w-full md:w-auto px-20 py-5 bg-brand-600 text-white font-black text-xl rounded-2xl hover:bg-brand-700 shadow-xl shadow-brand-200 transition-all flex items-center justify-center gap-3 disabled:opacity-30"
                >
                    Confirm BOM & Price <ArrowRight size={24} />
                </button>
            </div>
        </div>
    );
};

// --- STEP 4: LINE SWITCH ---
export const StepLineSwitch = ({ 
    bom, 
    setBom,
    selectedLineId, 
    lines,
    pricingDatabase,
    onChangeLine,
    onNext,
    onBack
}: { 
    bom: BOMItem[], 
    setBom: (items: BOMItem[]) => void,
    selectedLineId: string, 
    lines: CabinetLine[],
    pricingDatabase: Record<string, Record<string, { sku: string; price: number }>>,
    onChangeLine: (id: string) => void,
    onNext: () => void,
    onBack: () => void
}) => {
    // This now returns the priced items including the 'pricingOptions' and 'selectedLineId'
    const { items: pricedBom, verificationStats } = calculatePricing(bom, selectedLineId, lines, pricingDatabase);
    const total = pricedBom.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    const activeLine = lines.find(l => l.id === selectedLineId)!;

    const handleItemManufacturerChange = (itemId: string, newLineId: string) => {
        // Update the 'bom' state with the new selectedLineId for this item
        const updatedBom = bom.map(item => 
            item.id === itemId ? { ...item, selectedLineId: newLineId } : item
        );
        setBom(updatedBom);
    };

    return (
        <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden">
            <div className="bg-white border-b shrink-0 z-20 shadow-sm">
                <div className="max-w-[1800px] mx-auto px-4 md:px-10 py-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <button 
                        onClick={onBack}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-colors"
                    >
                        <ArrowLeft size={20} /> Back
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="bg-brand-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">3</div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900">Pricing & Audit</h2>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto no-scrollbar py-1">
                        <div className="flex gap-2 min-w-max">
                            {lines.map(line => (
                                <button 
                                    key={line.id} 
                                    onClick={() => onChangeLine(line.id)} 
                                    className={`px-6 py-3 text-sm font-black rounded-2xl transition-all border-2 ${
                                        selectedLineId === line.id 
                                        ? 'bg-slate-900 text-white border-slate-900 shadow-xl scale-105' 
                                        : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'
                                    }`}
                                >
                                    {line.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <div className="max-w-[1800px] mx-auto p-4 md:p-10 flex flex-col lg:flex-row gap-10 lg:h-full lg:overflow-hidden">
                    <div className="flex-[3] flex flex-col gap-6 lg:h-full lg:overflow-hidden">
                        <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 flex flex-col lg:h-full lg:overflow-hidden relative">
                            <div className="bg-slate-50 px-8 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Inventory List</span>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                                        <ShieldCheck size={12}/> {verificationStats.verified} VERIFIED
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                        <AlertTriangle size={12}/> {verificationStats.estimates} ESTIMATES
                                    </div>
                                </div>
                            </div>
                            <div className="overflow-x-auto lg:h-full pb-20">
                                <table className="w-full text-left text-sm border-collapse min-w-[850px]">
                                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm border-b">
                                        <tr>
                                            <th className="px-8 py-4">Cabinet Code</th>
                                            <th className="px-8 py-4">Description</th>
                                            <th className="px-8 py-4 w-64">Manufacturer</th>
                                            <th className="px-8 py-4 text-center">Qty</th>
                                            <th className="px-8 py-4 text-right">Unit Price</th>
                                            <th className="px-8 py-4 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {pricedBom.map((item, idx) => (
                                            <tr key={idx} className="group hover:bg-slate-50/50 transition-all">
                                                <td className="px-8 py-5">
                                                    <span className={`font-mono font-black px-3 py-1.5 rounded-xl text-sm border-2 ${
                                                        item.verificationStatus === 'verified' ? 'text-brand-700 bg-brand-50 border-brand-100' : 'text-amber-700 bg-amber-50 border-amber-100'
                                                    }`}>
                                                        {item.sku}
                                                    </span>
                                                    {item.verificationStatus !== 'verified' && (
                                                        <div className="text-[10px] text-amber-600 font-bold mt-1 text-center">ESTIMATED</div>
                                                    )}
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="text-slate-900 font-bold mb-0.5">{item.description}</div>
                                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.type}</div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="relative">
                                                        <select 
                                                            className={`appearance-none w-full bg-white border-2 rounded-xl py-2 pl-3 pr-8 text-xs font-bold focus:outline-none cursor-pointer transition-colors ${
                                                                item.verificationStatus === 'verified' 
                                                                ? 'border-green-100 text-green-700 hover:border-green-200' 
                                                                : 'border-amber-100 text-amber-700 hover:border-amber-200'
                                                            }`}
                                                            value={item.selectedLineId || selectedLineId}
                                                            onChange={(e) => handleItemManufacturerChange(item.id, e.target.value)}
                                                        >
                                                            {item.pricingOptions?.map(opt => (
                                                                <option key={opt.lineId} value={opt.lineId}>
                                                                    {opt.lineName} - ${opt.price.toFixed(0)} {opt.type === 'estimate' ? '(Est.)' : ''}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5 text-center font-black text-slate-700 text-lg">{item.quantity}</td>
                                                <td className="px-8 py-5 text-right font-mono font-bold text-slate-500">${item.unitPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                <td className="px-8 py-5 text-right font-mono font-black text-slate-900 text-lg">${item.totalPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 lg:max-w-[420px] flex flex-col gap-8 lg:h-full lg:overflow-y-auto pb-10">
                        <div className="hidden lg:block bg-slate-900 text-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-800 relative overflow-hidden">
                            <div className="relative z-10">
                                <div className="text-[11px] uppercase font-black text-slate-400 mb-2 tracking-[0.3em]">Total Value</div>
                                <div className="text-5xl font-black tracking-tighter mb-8 flex items-baseline gap-1">
                                    <span className="text-2xl font-bold opacity-50">$</span>
                                    {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                                <div className="pt-6 border-t border-slate-700 space-y-4">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400 font-bold">Selected Line:</span>
                                        <span className="font-black text-white bg-slate-800 px-3 py-1 rounded-lg">{activeLine.name}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400 font-bold">Sourcing:</span>
                                        <span className="font-black text-brand-400">Multi-Vendor Enabled</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={onNext} 
                            className="w-full py-5 bg-brand-600 text-white font-black text-xl rounded-2xl shadow-xl shadow-brand-200 hover:bg-brand-700 hover:shadow-2xl transition-all flex items-center justify-center gap-3 transform active:scale-95"
                        >
                            Finalize Project Info <ArrowRight size={24} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- STEP 4.5: PROJECT DETAILS FORM ---
export const StepProjectDetails = ({ 
    projectInfo, 
    onUpdate, 
    onNext, 
    onBack,
    selectedLineName 
}: { 
    projectInfo: ProjectInfo, 
    onUpdate: (updates: Partial<ProjectInfo>) => void, 
    onNext: () => void, 
    onBack: () => void,
    selectedLineName: string
}) => {
    useEffect(() => {
        if (!projectInfo.manufacturerName) {
            onUpdate({ manufacturerName: selectedLineName });
        }
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onNext();
    };

    return (
        <div className="h-full w-full overflow-y-auto bg-slate-50 flex flex-col">
            <div className="bg-white border-b px-6 py-5 flex items-center justify-between shrink-0 shadow-sm z-10">
                <button 
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-colors"
                >
                    <ArrowLeft size={20} /> Back
                </button>
                <div className="flex items-center gap-4">
                    <div className="bg-brand-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">4</div>
                    <h2 className="text-xl md:text-2xl font-black text-slate-900">Project Details</h2>
                </div>
                <div className="w-20"></div>
            </div>

            <div className="flex-1 flex items-center justify-center p-4 md:p-10">
                <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 p-8 md:p-12 w-full max-w-2xl">
                    <div className="mb-8 text-center sm:text-left">
                        <h3 className="text-2xl font-black text-slate-900">Final Quotation Info</h3>
                        <p className="text-slate-500 font-medium mt-1">Provide names for the professional header.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 gap-6">
                            {/* Manufacturer Name input removed per request */}
                            
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <Building size={14} className="text-brand-600" /> Dealer Name
                                </label>
                                <input 
                                    type="text" 
                                    required
                                    value={projectInfo.dealerName}
                                    onChange={(e) => onUpdate({ dealerName: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-900 focus:border-brand-500 focus:bg-white transition-all outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <User size={14} className="text-brand-600" /> Customer Name
                                </label>
                                <input 
                                    type="text" 
                                    required
                                    value={projectInfo.clientName}
                                    onChange={(e) => onUpdate({ clientName: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-900 focus:border-brand-500 focus:bg-white transition-all outline-none"
                                />
                            </div>
                        </div>

                        <button 
                            type="submit"
                            className="w-full py-5 bg-brand-600 text-white font-black text-xl rounded-2xl shadow-xl shadow-brand-200 hover:bg-brand-700 hover:shadow-2xl transition-all flex items-center justify-center gap-3 transform active:scale-95 mt-4"
                        >
                            Preview Quotation <ArrowRight size={24} />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

// --- STEP 5: FINAL QUOTE (Improved Responsiveness & Layout) ---
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
    pricingDatabase: Record<string, Record<string, { sku: string; price: number }>>,
    projectInfo: ProjectInfo,
    onRestart: () => void,
    onBack: () => void
}) => {
    const docRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    
    // Derived priced items
    const { items: pricedBom } = calculatePricing(bom, selectedLineId, lines, pricingDatabase);
    
    // Strict separation of totals
    const verifiedItems = pricedBom.filter(i => i.verificationStatus === 'verified');
    const estimatedItems = pricedBom.filter(i => i.verificationStatus !== 'verified');

    const verifiedSubtotal = verifiedItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    const estimatedSubtotal = estimatedItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    
    const activeLine = lines.find(l => l.id === selectedLineId)!;
    const shippingCost = verifiedSubtotal * activeLine.shippingFactor;
    
    // Final Total only includes verified + shipping (Estimates kept separate per instructions)
    const finalTotal = verifiedSubtotal + shippingCost;

    const getLineName = (id?: string) => lines.find(l => l.id === (id || selectedLineId))?.name || 'Unknown';

    const handleDownloadPDF = async () => {
        if (!docRef.current) return;
        setIsDownloading(true);
        try {
            const element = docRef.current;
            
            // For proper PDF generation, we need to ensure the element is visible and styled correctly
            const originalStyle = element.style.cssText;
            element.style.width = '1200px'; 
            element.style.position = 'fixed';
            element.style.left = '-9999px';
            element.style.top = '0';
            
            const canvas = await html2canvas(element, { 
                scale: 2, 
                useCORS: true, 
                logging: false, 
                backgroundColor: '#ffffff',
                windowWidth: 1200
            });
            
            element.style.cssText = originalStyle;
            
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgProps = pdf.getImageProperties(imgData);
            const ratio = imgProps.height / imgProps.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfWidth * ratio);
            pdf.save(`Quotation-${projectInfo.clientName.replace(/\s+/g, '-')}.pdf`);
        } catch (err) { 
            console.error("PDF generation error:", err);
            alert("Failed to generate PDF. Please try printing.");
        } finally { 
            setIsDownloading(false); 
        }
    };

    return (
        <div className="h-full w-full overflow-y-auto bg-slate-100 p-4 md:p-12 print:p-0 flex flex-col items-center">
            <div className="w-full max-w-5xl flex flex-col gap-6 print:gap-0">
                {/* Screen Navigation */}
                <div className="flex flex-col sm:flex-row justify-between items-center print:hidden gap-4 mb-4">
                    <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-900 transition-colors w-full sm:w-auto">
                        <ArrowLeft size={18} /> Back
                    </button>
                    <div className="flex gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar pb-1">
                        <button onClick={onRestart} className="whitespace-nowrap px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 shadow-sm transition-all text-sm">
                            New Project
                        </button>
                        <button 
                            onClick={handleDownloadPDF} 
                            disabled={isDownloading} 
                            className="whitespace-nowrap px-4 py-2 bg-brand-600 text-white rounded-xl font-black shadow-lg hover:bg-brand-700 transition-all flex items-center gap-2 disabled:opacity-50 text-sm"
                        >
                            {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} 
                            PDF
                        </button>
                        <button 
                            onClick={() => window.print()} 
                            className="whitespace-nowrap px-4 py-2 bg-slate-900 text-white rounded-xl font-black shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2 text-sm"
                        >
                            <Printer size={16} /> Print
                        </button>
                    </div>
                </div>

                {/* THE DOCUMENT - Professional Invoice Layout */}
                <div 
                    ref={docRef} 
                    className="bg-white p-6 md:p-16 shadow-2xl rounded-sm print:shadow-none print:p-0 text-slate-900 min-h-[1100px] flex flex-col w-full overflow-x-auto"
                >
                    {/* Header: Logo & Branding */}
                    <div className="flex flex-col sm:flex-row justify-between border-b-4 border-slate-900 pb-10 mb-10 gap-6">
                        <div className="flex flex-col gap-2">
                            <div className="bg-slate-900 text-white px-3 py-1 w-fit text-[10px] font-black tracking-[0.4em] uppercase">Bill of Materials</div>
                            <h1 className="text-4xl font-black tracking-tighter text-slate-900 leading-none">QUOTATION</h1>
                            <div className="text-slate-400 font-bold text-xs mt-2 uppercase tracking-widest">
                                Ref: #{Date.now().toString().slice(-6)} • {projectInfo.date}
                            </div>
                        </div>
                        <div className="text-left sm:text-right flex flex-col justify-end">
                            <div className="text-lg font-black uppercase text-brand-600">{projectInfo.dealerName}</div>
                            <p className="text-[11px] text-slate-500 mt-1 font-bold leading-relaxed max-w-[250px] sm:ml-auto">
                                {projectInfo.dealerAddress || "Company Location Address Line"}
                            </p>
                        </div>
                    </div>

                    {/* Parties Section: Billing & Manufacturing */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-12 bg-slate-50 p-6 rounded-xl border border-slate-100">
                        <div className="space-y-1">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Customer Information</h4>
                            <div className="text-xl font-black text-slate-900">{projectInfo.clientName}</div>
                            <div className="text-xs text-slate-500 font-bold leading-relaxed">{projectInfo.address}</div>
                        </div>
                        <div className="text-left sm:text-right space-y-1">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Cabinetry Details</h4>
                            <div className="text-xl font-black text-slate-900">Multi-Vendor Quote</div>
                            <div className="text-[10px] text-brand-600 font-black uppercase tracking-widest">
                                Custom Specification • Various Tiers
                            </div>
                        </div>
                    </div>

                    {/* MAIN PRICING TABLE */}
                    <div className="mb-10 flex-grow">
                        <table className="w-full text-left border-collapse table-fixed min-w-[700px]">
                            <thead>
                                <tr className="border-b-2 border-slate-900">
                                    <th className="py-3 px-2 font-black uppercase tracking-widest text-[10px] w-28">Item Code</th>
                                    <th className="py-3 px-2 font-black uppercase tracking-widest text-[10px]">Description</th>
                                    <th className="py-3 px-2 font-black uppercase tracking-widest text-[10px] text-center w-12">Qty</th>
                                    <th className="py-3 px-2 font-black uppercase tracking-widest text-[10px] text-right w-24">Unit Price</th>
                                    <th className="py-3 px-2 font-black uppercase tracking-widest text-[10px] text-left w-32 pl-4">Manufacturer</th>
                                    <th className="py-3 px-2 font-black uppercase tracking-widest text-[10px] text-right w-24">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pricedBom.map((item, i) => (
                                    <tr key={i} className={`align-top group transition-colors ${item.verificationStatus === 'verified' ? 'hover:bg-slate-50' : 'bg-amber-50/30 hover:bg-amber-50'}`}>
                                        <td className="py-4 px-2 font-mono font-black text-xs text-brand-700">
                                            {item.sku}
                                            {item.verificationStatus !== 'verified' && (
                                                <span className="block text-[8px] text-amber-600 font-bold uppercase mt-1">ESTIMATED</span>
                                            )}
                                        </td>
                                        <td className="py-4 px-2">
                                            <div className="font-bold text-sm text-slate-900 leading-tight">{item.description}</div>
                                            <div className="text-[9px] font-black text-slate-400 uppercase mt-1 tracking-wider">{item.type}</div>
                                        </td>
                                        <td className="py-4 px-2 text-center font-black text-sm text-slate-800">{item.quantity}</td>
                                        <td className="py-4 px-2 text-right font-mono text-xs text-slate-500">
                                            {item.verificationStatus === 'verified' ? `$${item.unitPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : <span className="text-amber-600 italic">Est.</span>}
                                        </td>
                                        <td className="py-4 px-2 pl-4">
                                            <span className="inline-block px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                {getLineName(item.selectedLineId)}
                                            </span>
                                        </td>
                                        <td className="py-4 px-2 text-right font-mono font-black text-sm text-slate-900">
                                            ${item.totalPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals & Footer Info */}
                    <div className="pt-8 border-t-2 border-slate-200">
                        <div className="flex flex-col sm:flex-row justify-between gap-10">
                            {/* Notes/Terms */}
                            <div className="flex-1 max-w-sm">
                                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-3">Terms & Conditions</h4>
                                <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                                    This quotation is valid for 30 days. Prices are based on current manufacturer list data. 
                                    Standard shipping lead times apply. Natural materials may vary in grain and color.
                                    Payment terms: 50% deposit on order, balance prior to shipment.
                                </p>
                            </div>
                            
                            {/* Calculation Summary */}
                            <div className="w-full sm:w-80 space-y-4">
                                <div className="flex justify-between items-center text-slate-500 font-bold text-xs uppercase tracking-wider">
                                    <span>Manufacturer Quotation Total</span>
                                    <span>${verifiedSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between items-center text-slate-500 font-bold text-xs uppercase tracking-wider">
                                    <span>Shipping & Freight ({(activeLine.shippingFactor * 100).toFixed(0)}%)</span>
                                    <span>${shippingCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                
                                {estimatedSubtotal > 0 && (
                                     <div className="flex justify-between items-center text-amber-600 font-bold text-xs uppercase tracking-wider border-t border-dashed border-slate-200 pt-2 mt-2">
                                        <span>Estimated Items Total</span>
                                        <span>${estimatedSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                )}

                                <div className="flex justify-between items-center text-3xl font-black text-slate-900 border-t-4 border-slate-900 pt-6 mt-4">
                                    <span className="text-base uppercase tracking-tighter">Grand Total (Verified)</span>
                                    <span className="flex items-baseline gap-1">
                                        <span className="text-lg font-bold opacity-30">$</span>
                                        {finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Branding */}
                    <div className="mt-16 text-[9px] text-slate-400 border-t border-dashed border-slate-200 pt-6 flex flex-col sm:flex-row justify-between items-center gap-2 uppercase tracking-[0.2em] font-black">
                        <div className="flex items-center gap-2">
                            <ShieldCheck size={10} className="text-green-500" /> 
                            Securely Generated via KABS Quotation AI
                        </div>
                        <div className="flex items-center gap-4">
                            <span>System Auth: {Date.now().toString().slice(-4)}</span>
                            <span>Invoice v2.5.0</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

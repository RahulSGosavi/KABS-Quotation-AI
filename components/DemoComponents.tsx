import React, { useState, useEffect } from 'react';
import { 
    Upload, ArrowRight, ArrowLeft, CheckCircle2, 
    Loader2, Trash2, Bot, ShieldCheck, Cpu, Play, Boxes,
    FileSpreadsheet, AlertTriangle, Download, User, Factory, Lock
} from 'lucide-react';
import { BOMItem, CabinetLine, ProjectInfo, CabinetType } from '../types';
import { validateBOMAgainstCatalog, parseCabinetDimensions } from '../services/pricingEngine';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
export const StepStart = ({ onNext, onAdmin }: { onNext: () => void, onAdmin: () => void }) => {
    return (
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
                <div className="max-w-3xl space-y-8">
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
                            { icon: <FileSpreadsheet className="text-green-600" />, title: "Size-Based Pricing", desc: "Dealer-grade estimates by linear foot." },
                            { icon: <ShieldCheck className="text-blue-600" />, title: "Audit Ready", desc: "Every cabinet verified by size category." }
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
};

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

// --- STEP 3: BOM REVIEW (Grouped by Category) ---
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

    // Grouping Logic
    const groupedItems = bom.reduce((acc, item) => {
        const dims = parseCabinetDimensions(item.sku || "");
        let category = 'Other';
        
        if (dims) {
            if (dims.type === CabinetType.BASE || dims.type === CabinetType.VANITY) category = 'Cabinets (Base/Vanity)';
            else if (dims.type === CabinetType.TALL) category = 'Cabinets (Tall)';
            else if (dims.type === CabinetType.WALL) category = 'Walls';
            else if (dims.type === CabinetType.ACCESSORY) category = 'Components (Doors/Panels)';
            else if (dims.type === CabinetType.HARDWARE) category = 'Hardware';
        }
        
        if (!acc[category]) acc[category] = [];
        acc[category].push(item);
        return acc;
    }, {} as Record<string, BOMItem[]>);

    // Sort order
    const categoryOrder = ['Cabinets (Base/Vanity)', 'Walls', 'Cabinets (Tall)', 'Components (Doors/Panels)', 'Hardware', 'Other'];

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
                <div className="max-w-6xl mx-auto space-y-8">
                    {categoryOrder.map(category => {
                        const items = groupedItems[category];
                        if (!items || items.length === 0) return null;

                        return (
                            <div key={category} className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col">
                                <div className="bg-slate-50 px-8 py-4 border-b border-slate-100">
                                    <h3 className="font-black text-slate-700 uppercase tracking-widest text-sm">{category}</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <tbody className="divide-y divide-slate-100">
                                            {items.map((item) => (
                                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-8 py-5 w-40">
                                                        <span className="font-mono font-black px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-900 block text-center">
                                                            {item.sku}
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        <div className="text-slate-900 font-bold">{item.description}</div>
                                                    </td>
                                                    <td className="px-8 py-5 w-48">
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
                                                    <td className="px-8 py-5 text-right w-20">
                                                        <button 
                                                            onClick={() => updateQty(item.id, -item.quantity)}
                                                            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 size={20} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                    
                    {bom.length === 0 && (
                        <div className="text-center py-20 bg-white rounded-[2rem]">
                            <Boxes size={48} className="mx-auto text-slate-200 mb-4" />
                            <p className="text-slate-400 font-medium">No items found in plan.</p>
                        </div>
                    )}
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
    pricingDatabase: any,
    onChangeLine: (id: string) => void,
    onNext: () => void,
    onBack: () => void
}) => {
    // Calculate totals for ALL lines to show comparison
    const comparison = lines.map(line => {
        const { totalPrice } = calculatePricing(bom, line.id, lines, pricingDatabase);
        return { line, totalPrice };
    });

    // For current display table
    const { items: pricedBom, verificationStats } = calculatePricing(bom, selectedLineId, lines, pricingDatabase);

    return (
        <div className="h-full w-full flex flex-col bg-slate-50">
            <div className="bg-white border-b px-6 py-5 flex items-center justify-between shrink-0 shadow-sm z-10">
                <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold"><ArrowLeft size={20} /> Back</button>
                <div className="flex items-center gap-4">
                    <div className="bg-brand-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">3</div>
                    <h2 className="text-xl font-black text-slate-900">Select Manufacturer</h2>
                </div>
                <div className="w-20"></div>
            </div>

            <div className="flex-1 overflow-auto p-4 md:p-10">
                <div className="max-w-5xl mx-auto space-y-10">
                    {/* Line Selection Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {comparison.map(({ line, totalPrice }) => {
                            const isSelected = selectedLineId === line.id;
                            return (
                                <div 
                                    key={line.id}
                                    onClick={() => onChangeLine(line.id)}
                                    className={`relative rounded-[2rem] p-6 cursor-pointer transition-all border-2 ${isSelected ? 'bg-white border-brand-600 shadow-2xl scale-105 z-10' : 'bg-white border-slate-100 shadow-sm hover:border-brand-200 hover:shadow-md'}`}
                                >
                                    {isSelected && <div className="absolute top-4 right-4 text-brand-600"><CheckCircle2 size={24} fill="currentColor" className="text-white" /></div>}
                                    
                                    <h3 className="text-lg font-black text-slate-900 mb-1">{line.name}</h3>
                                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border mb-4 ${
                                        line.tier === 'Premium' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                        line.tier === 'Mid-Range' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                        'bg-green-50 text-green-700 border-green-100'
                                    }`}>
                                        {line.tier}
                                    </span>
                                    
                                    <p className="text-slate-500 text-sm mb-6 h-10 line-clamp-2 leading-relaxed">
                                        {line.description}
                                    </p>

                                    <div className="pt-6 border-t border-slate-100">
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Estimated Total</div>
                                        <div className="text-3xl font-black text-slate-900 tracking-tight">
                                            ${totalPrice.toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Audit Table */}
                    <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-8 py-4 border-b border-slate-100 flex justify-between items-center">
                             <h3 className="font-black text-slate-700 uppercase tracking-widest text-sm">Detailed Pricing Audit</h3>
                             <div className="flex gap-2">
                                <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full flex items-center gap-1"><ShieldCheck size={12}/> {verificationStats.verified} Verified</span>
                                <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded-full flex items-center gap-1"><AlertTriangle size={12}/> {verificationStats.missing} Unpriced</span>
                             </div>
                        </div>
                        <div className="overflow-x-auto max-h-[400px]">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead className="bg-slate-50 sticky top-0 shadow-sm z-10">
                                    <tr>
                                        <th className="px-6 py-3 font-bold text-slate-500">Item</th>
                                        <th className="px-6 py-3 font-bold text-slate-500">Dimensions</th>
                                        <th className="px-6 py-3 font-bold text-slate-500 text-center">Qty</th>
                                        <th className="px-6 py-3 font-bold text-slate-500 text-right">Unit Price</th>
                                        <th className="px-6 py-3 font-bold text-slate-500 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {pricedBom.map((item, i) => (
                                        <tr key={i} className="hover:bg-slate-50">
                                            <td className="px-6 py-3">
                                                <span className={`font-mono font-bold px-2 py-1 rounded ${item.verificationStatus === 'verified' ? 'text-slate-700 bg-slate-100' : 'text-red-600 bg-red-50'}`}>
                                                    {item.sku}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-slate-600">
                                                {item.verificationProof?.matchedDimensions || '-'}
                                            </td>
                                            <td className="px-6 py-3 text-center font-bold">
                                                {item.quantity}
                                            </td>
                                            <td className="px-6 py-3 text-right font-mono text-slate-500">
                                                 {item.verificationStatus === 'verified' ? `$${(item.unitPrice||0).toFixed(2)}` : '-'}
                                            </td>
                                            <td className="px-6 py-3 text-right font-mono font-bold text-slate-900">
                                                 {item.verificationStatus === 'verified' ? `$${(item.totalPrice||0).toFixed(2)}` : <span className="text-red-500">MISSING</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white border-t p-6 md:px-12 md:py-8 shrink-0 flex items-center justify-center z-10 shadow-2xl">
                <button 
                    onClick={onNext} 
                    className="w-full md:w-auto px-20 py-5 bg-brand-600 text-white font-black text-xl rounded-2xl hover:bg-brand-700 shadow-xl shadow-brand-200 transition-all flex items-center justify-center gap-3"
                >
                    Continue to Details <ArrowRight size={24} />
                </button>
            </div>
        </div>
    );
};

// --- Extracted DetailInput to avoid recreation and naming conflict ---
const DetailInput = ({ 
    label, 
    value, 
    fieldKey, 
    placeholder,
    projectInfo,
    onUpdate
}: { 
    label: string, 
    value: string, 
    fieldKey: keyof ProjectInfo | string, 
    placeholder?: string,
    projectInfo: ProjectInfo,
    onUpdate: (updates: Partial<ProjectInfo>) => void
}) => {
    // Handle nested specs logic
    const isSpec = fieldKey.startsWith('specs.');
    const field = isSpec ? fieldKey.split('.')[1] : fieldKey;
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isSpec) {
            onUpdate({ specs: { ...projectInfo.specs, [field]: e.target.value } });
        } else {
            onUpdate({ [field]: e.target.value } as any);
        }
    };

    return (
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{label}</label>
            <input 
                type="text" 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-brand-500 focus:bg-white outline-none transition-all"
                value={value}
                onChange={handleChange}
                placeholder={placeholder}
            />
        </div>
    );
};

// --- STEP 5: PROJECT DETAILS ---
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
    return (
        <div className="h-full w-full flex flex-col bg-slate-50">
             <div className="bg-white border-b px-6 py-5 flex items-center justify-between shrink-0 shadow-sm z-10">
                <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold"><ArrowLeft size={20} /> Back</button>
                <div className="flex items-center gap-4">
                    <div className="bg-brand-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">4</div>
                    <h2 className="text-xl font-black text-slate-900">Project Details</h2>
                </div>
                <div className="w-20"></div>
            </div>

            <div className="flex-1 overflow-auto p-4 md:p-10">
                <div className="max-w-4xl mx-auto space-y-8">
                    
                    {/* Dealer / Client Section */}
                    <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
                        <div className="flex items-center gap-3 mb-6">
                            <User className="text-brand-600" />
                            <h3 className="text-xl font-black text-slate-900">Client Information</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <DetailInput label="Client Name" value={projectInfo.clientName} fieldKey="clientName" projectInfo={projectInfo} onUpdate={onUpdate} />
                            <DetailInput label="Project Name" value={projectInfo.projectName} fieldKey="projectName" projectInfo={projectInfo} onUpdate={onUpdate} />
                            <div className="md:col-span-2">
                                <DetailInput label="Site Address" value={projectInfo.address} fieldKey="address" projectInfo={projectInfo} onUpdate={onUpdate} />
                            </div>
                            <DetailInput label="Email" value={projectInfo.email} fieldKey="email" projectInfo={projectInfo} onUpdate={onUpdate} />
                            <DetailInput label="Phone" value={projectInfo.phone} fieldKey="phone" projectInfo={projectInfo} onUpdate={onUpdate} />
                        </div>
                    </div>

                     {/* Manufacturer Specs */}
                     <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
                        <div className="flex items-center gap-3 mb-6">
                            <Factory className="text-brand-600" />
                            <h3 className="text-xl font-black text-slate-900">Manufacturing Specs ({selectedLineName})</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <DetailInput label="Door Style" value={projectInfo.specs.doorStyle} fieldKey="specs.doorStyle" projectInfo={projectInfo} onUpdate={onUpdate} />
                            <DetailInput label="Wood Species" value={projectInfo.specs.woodSpecies} fieldKey="specs.woodSpecies" projectInfo={projectInfo} onUpdate={onUpdate} />
                            <DetailInput label="Stain / Finish" value={projectInfo.specs.stainColor} fieldKey="specs.stainColor" projectInfo={projectInfo} onUpdate={onUpdate} />
                            <DetailInput label="Glaze" value={projectInfo.specs.glaze} fieldKey="specs.glaze" projectInfo={projectInfo} onUpdate={onUpdate} />
                            <DetailInput label="Drawer Box" value={projectInfo.specs.drawerBox} fieldKey="specs.drawerBox" projectInfo={projectInfo} onUpdate={onUpdate} />
                            <DetailInput label="Hinges" value={projectInfo.specs.hinges} fieldKey="specs.hinges" projectInfo={projectInfo} onUpdate={onUpdate} />
                        </div>
                    </div>

                </div>
            </div>

            <div className="bg-white border-t p-6 md:px-12 md:py-8 shrink-0 flex items-center justify-center z-10 shadow-2xl">
                <button 
                    onClick={onNext} 
                    className="w-full md:w-auto px-20 py-5 bg-brand-600 text-white font-black text-xl rounded-2xl hover:bg-brand-700 shadow-xl shadow-brand-200 transition-all flex items-center justify-center gap-3"
                >
                    Generate Final Quote <ArrowRight size={24} />
                </button>
            </div>
        </div>
    );
};

// --- STEP 6: QUOTE (REBUILT TO MATCH SPECIFIC PDF FORMAT) ---
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
    // 1. Calculate pricing
    const { items: pricedItems } = calculatePricing(bom, selectedLineId, lines, pricingDatabase);
    
    // 2. Strict Filter: Only verified items appear on the quote
    const validItems = pricedItems.filter(item => item.verificationStatus === 'verified');
    
    // 3. Recalculate total based on valid items only
    const validTotal = validItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    const selectedLine = lines.find(l => l.id === selectedLineId);

    // 4. Financial Calculations
    const shippingPercent = selectedLine?.shippingFactor || 0;
    const shippingCost = validTotal * shippingPercent;
    
    const surchargePercent = 0.015;
    const surchargeCost = validTotal * surchargePercent;
    
    // Tax Calculation: Standard logic is Tax Base = Subtotal + Shipping + Surcharge
    const taxPercent = 0.07; // 7% Sales Tax (Estimated)
    const taxableAmount = validTotal + shippingCost + surchargeCost;
    const taxCost = taxableAmount * taxPercent;
    
    const grandTotal = taxableAmount + taxCost;
    
    const generatePDF = () => {
        const doc = new jsPDF();
        
        // Helper for colors
        const bgGray = '#e5e7eb';
        const black = '#000000';
        
        // --- 1. Header ---
        doc.setFontSize(22);
        doc.setFont("helvetica", "bolditalic");
        doc.text(selectedLine?.name || 'Manufacturer', 14, 20);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        doc.text(`${selectedLine?.tier} Series - ${selectedLine?.description}`, 14, 25);
        
        // Factory Info (Right)
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        const rightX = 140;
        doc.text("Manufacturing Facility", rightX, 15);
        doc.text("Factory Direct Orders", rightX, 19);
        doc.text("Phone: 800-555-0199", rightX, 23);
        doc.text("Email: orders@kabs.com", rightX, 27);
        
        // Order Title
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Order", 105, 35, { align: "center" });
        doc.line(14, 37, 196, 37);

        // --- 2. Information Boxes ---
        let y = 42;
        
        const drawSectionHeader = (posY: number, title: string) => {
            doc.setFillColor(bgGray);
            doc.rect(14, posY, 182, 5, 'F');
            doc.rect(14, posY, 182, 5, 'S'); // border
            doc.setFontSize(9);
            doc.setFont("helvetica", "bolditalic");
            doc.text(title, 16, posY + 3.5);
            return posY + 5;
        };

        // Dealer Info
        y = drawSectionHeader(y, "Dealer Information");
        doc.rect(14, y, 182, 14); // box
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(projectInfo.dealerName, 16, y + 4);
        doc.setFont("helvetica", "normal");
        doc.text(projectInfo.dealerAddress, 16, y + 8);
        doc.text(`Phone: ${projectInfo.dealerPhone}   Email: ${projectInfo.dealerEmail}`, 16, y + 12);
        y += 16;

        // Project Info
        y = drawSectionHeader(y, "Project Information");
        doc.rect(14, y, 182, 20); // box
        doc.setFontSize(8);
        const col1 = 16; const val1 = 45;
        const col2 = 105; const val2 = 130;
        
        // Left Column
        doc.text("Project Name:", col1, y + 4); doc.setFont("helvetica", "bold"); doc.text(projectInfo.projectName, val1, y + 4); doc.setFont("helvetica", "normal");
        doc.text("Cust. Email:", col1, y + 8); doc.text(projectInfo.email, val1, y + 8);
        doc.text("Cust. Phone:", col1, y + 12); doc.text(projectInfo.phone, val1, y + 12);
        doc.text("Type:", col1, y + 16); doc.text("New Construction", val1, y + 16);
        
        // Right Column
        doc.text("User:", col2, y + 4); doc.text(projectInfo.clientName, val2, y + 4);
        doc.text("Designer:", col2, y + 8); doc.text("Internal Design Team", val2, y + 8);
        doc.text("Proj #:", col2, y + 12); doc.text(projectInfo.specs.soNumber || "947161", val2, y + 12);
        doc.text("Date:", col2, y + 16); doc.text(projectInfo.date, val2, y + 16);
        y += 22;

        // Job & Shipping (Side by Side)
        const midPoint = 105;
        doc.rect(14, y, 91, 20); // Left Box
        doc.rect(105, y, 91, 20); // Right Box
        
        doc.setFontSize(9); doc.setFont("helvetica", "bold");
        doc.text("Job Information", 16, y + 4);
        doc.text("Shipping Information", 107, y + 4);
        
        doc.setFontSize(8); doc.setFont("helvetica", "normal");
        doc.text(`Name: ${projectInfo.clientName}`, 16, y + 8);
        doc.text(`Addr: ${projectInfo.address.substring(0, 30)}...`, 16, y + 12);
        doc.text(`Phone: ${projectInfo.phone}`, 16, y + 16);
        
        doc.text(`Name: KFL-DC`, 107, y + 8);
        doc.text(`Addr: ${projectInfo.dealerAddress.substring(0, 30)}...`, 107, y + 12);
        doc.text(`Attn: Shipping Dept`, 107, y + 16);
        y += 22;

        // Attachments
        y = drawSectionHeader(y, "Kitchen Specifications");
        doc.rect(14, y, 182, 12);
        doc.setFontSize(8); doc.setFont("helvetica", "normal");
        
        doc.text(`Wood: ${projectInfo.specs.woodSpecies}`, 16, y + 4);
        doc.text(`Door: ${projectInfo.specs.doorStyle}`, 16, y + 8);
        
        doc.text(`Finish: ${projectInfo.specs.stainColor}`, 60, y + 4);
        doc.text(`Glaze: ${projectInfo.specs.glaze}`, 60, y + 8);
        
        doc.text(`Drawer: ${projectInfo.specs.drawerBox}`, 105, y + 4);
        doc.text(`Hinge: ${projectInfo.specs.hinges}`, 105, y + 8);
        y += 15;

        // --- 3. Products Table ---
        autoTable(doc, {
            startY: y,
            head: [['Item', 'Qty', 'Product Code', 'Description', 'Price', 'Total']],
            body: validItems.map((item, index) => [
                index + 1,
                item.quantity,
                item.sku,
                `${item.description}\n${item.verificationProof?.matchedDimensions ? `Dims: ${item.verificationProof.matchedDimensions}` : ''}`,
                `$${item.unitPrice?.toFixed(2)}`,
                `$${item.totalPrice?.toFixed(2)}`
            ]),
            theme: 'plain',
            headStyles: { 
                fillColor: [229, 231, 235], 
                textColor: 0, 
                fontStyle: 'bold', 
                lineWidth: 0.1, 
                lineColor: 0 
            },
            bodyStyles: { 
                textColor: 0, 
                lineWidth: 0.1, 
                lineColor: 0,
                fontSize: 9,
                cellPadding: 2
            },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center' },
                1: { cellWidth: 10, halign: 'center' },
                2: { cellWidth: 30, fontStyle: 'bold' },
                3: { cellWidth: 'auto' }, // Wraps description
                4: { cellWidth: 20, halign: 'right' },
                5: { cellWidth: 25, halign: 'right' }
            },
            margin: { left: 14, right: 14 },
            rowPageBreak: 'avoid',
            didDrawPage: (data) => {
                // Header is automatically repeated by autoTable
            }
        });

        // --- 4. Summary Footer (Vector Grid) ---
        // Get Y position after table
        let finalY = (doc as any).lastAutoTable.finalY;
        
        // Check if we need a new page for summary
        if (finalY > 240) {
            doc.addPage();
            finalY = 20;
        } else {
            finalY += 5;
        }

        // Summary Header
        doc.setDrawColor(0);
        doc.setFillColor(bgGray);
        doc.rect(14, finalY, 182, 7, 'F'); 
        doc.rect(14, finalY, 182, 7, 'S');
        doc.setFontSize(10); doc.setFont("helvetica", "bold");
        doc.text("Summarized Order Totals", 16, finalY + 5);
        finalY += 7;
        
        // Summary Table Calculation
        const summaryHeight = 42; // 6 rows * 7mm each
        const leftWidth = 100;
        const rightWidth = 82;
        const summaryRightX = 14 + leftWidth;
        const rowH = 7;

        // Left Box (Kitchen Sub Total) - Vector Box
        doc.rect(14, finalY, leftWidth, summaryHeight); 
        doc.setFontSize(14);
        doc.text("Kitchen Sub Total", 20, finalY + (summaryHeight/2));
        doc.text(`$${validTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 14 + leftWidth - 5, finalY + (summaryHeight/2), { align: "right" });

        // Right Box (Grid)
        const drawRightRow = (label: string, value: string, yPos: number, isLast = false) => {
            if (isLast) {
                doc.setFillColor(bgGray);
                doc.rect(summaryRightX, yPos, rightWidth, rowH, 'F');
                doc.setFont("helvetica", "bold");
            } else {
                doc.setFont("helvetica", "normal");
            }
            doc.rect(summaryRightX, yPos, rightWidth, rowH);
            doc.setFontSize(9);
            doc.text(label, summaryRightX + 2, yPos + 5);
            doc.text(value, summaryRightX + rightWidth - 2, yPos + 5, { align: "right" });
        };

        drawRightRow("Cabinets Subtotal", `$${validTotal.toFixed(2)}`, finalY);
        drawRightRow(`Shipping (${(shippingPercent * 100).toFixed(1)}%)`, `$${shippingCost.toFixed(2)}`, finalY + rowH);
        drawRightRow("Fuel Surcharge (1.5%)", `$${surchargeCost.toFixed(2)}`, finalY + rowH * 2);
        drawRightRow("Modifications / Extras", "$0.00", finalY + rowH * 3);
        drawRightRow(`Est. Tax (7.0%)`, `$${taxCost.toFixed(2)}`, finalY + rowH * 4);
        drawRightRow("Order Grand Total", `$${grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`, finalY + rowH * 5, true);

        // --- 5. Footer Text ---
        const pageCount = doc.getNumberOfPages();
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.text(`Page ${i} of ${pageCount} - Printed: ${new Date().toLocaleString()}`, 196, 290, { align: 'right' });
            doc.text("Generated by KABS Quotation AI", 14, 290);
        }

        doc.save(`${projectInfo.clientName.replace(/\s+/g, '_')}_Quote.pdf`);
    };

    return (
        <div className="h-full w-full flex flex-col bg-slate-100">
             <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0 shadow-md z-20 print:hidden">
                <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white font-bold"><ArrowLeft size={20} /> Edit Details</button>
                <div className="font-mono text-sm opacity-50">QUOTE PREVIEW MODE</div>
                <button onClick={onRestart} className="flex items-center gap-2 text-slate-400 hover:text-white font-bold">New Project</button>
            </div>

            <div className="flex-1 overflow-auto p-4 md:p-10 flex justify-center bg-gray-100">
                {/* HTML Preview (Kept for UI Feedback only) */}
                <div 
                    id="quote-preview" 
                    className="bg-white text-black font-sans text-[11px] shadow-2xl relative box-border flex flex-col"
                    style={{ 
                        width: '210mm', 
                        minHeight: '297mm', 
                        padding: '15mm',
                        margin: '0 auto' 
                    }}
                >
                    <div className="text-center mb-8 border-b border-dashed pb-4 text-slate-400">
                        <p>PREVIEW MODE ONLY</p>
                        <p className="text-[10px]">Use the "Download PDF" button below for the official production-ready file.</p>
                    </div>

                    {/* Header: Grid Layout to prevent overlap */}
                    <div className="border-b-2 border-black pb-2 mb-4 shrink-0">
                        <div className="text-center font-bold text-lg mb-6">Order</div>
                        
                        <div className="grid grid-cols-2 gap-8 items-start">
                            {/* Left Side: Logo/Manufacturer */}
                            <div className="flex flex-col gap-1">
                                <h1 className="text-3xl font-serif italic font-bold leading-none break-words tracking-tight text-slate-900">
                                    {selectedLine?.name || 'Manufacturer'}
                                </h1>
                                <div className="text-[10px] italic pl-1 text-slate-700">
                                    {selectedLine?.tier} Series - {selectedLine?.description}
                                </div>
                            </div>

                            {/* Right Side: Factory Info */}
                            <div className="text-right text-[10px] leading-tight">
                                <div className="font-bold text-[11px] mb-1">{selectedLine?.name || 'Manufacturer'}</div>
                                <div>Manufacturing Facility</div>
                                <div>Factory Direct Orders</div>
                                <div>Phone: 800-555-0199</div>
                                <div>Email: orders@kabs.com</div>
                            </div>
                        </div>
                    </div>

                    {/* Dealer Information Box */}
                    <div className="border border-black mb-1 shrink-0">
                        <div className="bg-gray-200 border-b border-black px-1 font-bold italic text-[10px]">Dealer Information</div>
                        <div className="p-1 pl-2 text-[10px] leading-snug">
                            <div className="font-bold">{projectInfo.dealerName}</div>
                            <div>{projectInfo.dealerAddress}</div>
                            <div>Phone: {projectInfo.dealerPhone} Fax:</div>
                            <div>Email: {projectInfo.dealerEmail} Website:</div>
                        </div>
                    </div>

                    {/* Product Table Preview */}
                    <div className="border border-black mb-2 flex-1 relative mt-4">
                         <div className="bg-gray-200 border-b border-black px-1 font-bold text-[11px]">Products (First Page Preview)</div>
                         <table className="w-full text-left text-[9px] border-collapse table-fixed">
                            <thead>
                                <tr className="border-b border-black text-center font-bold">
                                    <th className="border-r border-black w-[5%] py-1">Item</th>
                                    <th className="border-r border-black w-[5%] py-1">Qty.</th>
                                    <th className="border-r border-black w-[15%] py-1 text-left px-1">Code</th>
                                    <th className="border-r border-black w-[55%] py-1 text-left px-1">Description</th>
                                    <th className="w-[20%] py-1 text-right px-1">Price</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-300">
                                {validItems.slice(0, 10).map((item, idx) => (
                                    <tr key={item.id}>
                                        <td className="border-r border-black text-center py-1">{idx + 1}</td>
                                        <td className="border-r border-black text-center py-1">{item.quantity}</td>
                                        <td className="border-r border-black px-1 py-1 font-medium">{item.sku}</td>
                                        <td className="border-r border-black px-1 py-1">{item.description}</td>
                                        <td className="px-1 py-1 text-right font-medium">${(item.totalPrice || 0).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                         </table>
                         {validItems.length > 10 && <div className="text-center italic text-slate-400 p-2">... {validItems.length - 10} more items in PDF ...</div>}
                    </div>

                    {/* Summary Footer Preview (Grid Matching PDF) */}
                    <div className="border border-black mt-4 shrink-0">
                        <div className="bg-gray-200 border-b border-black px-1 font-bold text-[11px] py-1">Summarized Order Totals (Preview)</div>
                        <div className="flex" style={{ height: '220px' }}> {/* Fixed height to match relative PDF proportions approx */}
                            {/* Left Side */}
                            <div className="flex-1 border-r border-black flex flex-col justify-center px-6 relative">
                                <div className="text-[14px] font-bold">Kitchen Sub Total</div>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] font-bold">
                                    ${validTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            
                            {/* Right Side - Grid */}
                            <div className="w-[45%] text-[10px] flex flex-col">
                                <div className="flex justify-between px-2 py-2 border-b border-gray-300 flex-1 items-center">
                                    <span>Cabinets Subtotal</span>
                                    <span>${validTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between px-2 py-2 border-b border-gray-300 flex-1 items-center">
                                    <span>Shipping ({(shippingPercent * 100).toFixed(1)}%)</span>
                                    <span>${shippingCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between px-2 py-2 border-b border-gray-300 flex-1 items-center">
                                    <span>Fuel Surcharge (1.5%)</span>
                                    <span>${surchargeCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between px-2 py-2 border-b border-gray-300 flex-1 items-center">
                                    <span>Modifications / Extras</span>
                                    <span>$0.00</span>
                                </div>
                                <div className="flex justify-between px-2 py-2 border-b border-black flex-1 items-center">
                                    <span>Est. Tax (7.0%)</span>
                                    <span>${taxCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between px-2 py-2 font-bold bg-gray-300 flex-1 items-center">
                                    <span>Order Grand Total</span>
                                    <span>${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Text Preview */}
                    <div className="mt-auto pt-8 flex justify-between text-[10px] text-gray-500 font-sans">
                        <div>Generated by KABS Quotation AI</div>
                        <div>Page 1 of 1 - Printed: {new Date().toLocaleString()}</div>
                    </div>
                </div>
            </div>

            <div className="bg-white border-t p-6 md:px-12 md:py-8 shrink-0 flex items-center justify-center z-10 shadow-2xl gap-4 print:hidden">
                <button 
                    onClick={generatePDF}
                    className="w-full md:w-auto px-12 py-4 bg-slate-900 text-white font-black text-lg rounded-2xl hover:bg-slate-800 shadow-xl transition-all flex items-center justify-center gap-3"
                >
                    <Download size={20} /> Download PDF Quote
                </button>
            </div>
        </div>
    );
};
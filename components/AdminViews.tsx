
import React, { useState, useRef, useEffect } from 'react';
import { Lock, FileSpreadsheet, FileText, Upload, CheckCircle, AlertCircle, LogOut, Search, Plus, Info, Trash2, ArrowLeft, ChevronRight, Save, ShieldCheck, Loader2 } from 'lucide-react';
import { CabinetLine, CatalogueFile } from '../types';
import { AuthService } from '../services/authService';

// --- ADMIN LOGIN ---
export const AdminLogin = ({ onLogin, onBack }: { onLogin: () => void, onBack: () => void }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const success = AuthService.login(email, password);
        
        if (success) {
            onLogin();
        } else {
            setError('Invalid credentials. Try admin@kabs.com / admin');
        }
    };

    return (
        <div className="min-h-full flex items-center justify-center bg-slate-100 p-4">
            <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md border border-slate-200 animate-in fade-in zoom-in duration-300">
                <div className="flex justify-center mb-6">
                    <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                        <Lock size={24} />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">KABS Admin Portal</h2>
                <p className="text-center text-slate-500 mb-8">Manage partner catalogs and pricing.</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                        <input 
                            type="email" 
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none transition-all"
                            placeholder="admin@kabs.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                        <input 
                            type="password" 
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none transition-all"
                            placeholder="•••••"
                        />
                    </div>
                    
                    {error && (
                        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded border border-red-100">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    <button 
                        type="submit"
                        className="w-full py-3 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors shadow-lg"
                    >
                        Secure Login
                    </button>
                    <button 
                        type="button"
                        onClick={onBack}
                        className="w-full py-2 text-slate-500 text-sm hover:text-slate-800 transition-colors"
                    >
                        Back
                    </button>
                </form>
            </div>
        </div>
    );
};

// --- ADMIN DASHBOARD WRAPPER ---
export const AdminDashboard = ({ 
    lines, 
    globalGuidelines,
    nkbaStandards,
    onUpdateLine, 
    onAddLine,
    onDeleteLine,
    onUploadCatalog,
    onDeleteFile,
    onLogout 
}: { 
    lines: CabinetLine[], 
    globalGuidelines: CatalogueFile | null,
    nkbaStandards: CatalogueFile | null,
    onUpdateLine: (lineId: string, updates: Partial<CabinetLine>) => void,
    onAddLine: (name: string, tier: 'Budget' | 'Mid-Range' | 'Premium') => void,
    onDeleteLine: (lineId: string) => void,
    onUploadCatalog: (lineId: string, file: File, type: 'excel' | 'pdf' | 'nkba') => Promise<void>,
    onDeleteFile: (lineId: string, type: 'excel' | 'pdf' | 'nkba') => void,
    onLogout: () => void 
}) => {
    // State to toggle between Home (null) and Detail view (string id)
    // New state 'creating' for the creation page
    const [viewMode, setViewMode] = useState<'home' | 'create' | 'detail'>('home');
    const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

    // Ensure state validity if line deleted while viewing
    useEffect(() => {
        if (selectedLineId && !lines.find(l => l.id === selectedLineId)) {
            setSelectedLineId(null);
            setViewMode('home');
        }
    }, [lines, selectedLineId]);

    const handleLogout = () => {
        AuthService.logout();
        onLogout();
    };

    const handleCreateLine = (name: string, tier: 'Budget' | 'Mid-Range' | 'Premium') => {
        onAddLine(name, tier);
        setViewMode('home');
    };

    const activeLine = lines.find(l => l.id === selectedLineId);

    return (
        <div className="h-full bg-slate-100 text-slate-800 font-sans overflow-hidden flex flex-col">
            {/* Common Header */}
            <div className="bg-slate-900 text-white px-4 md:px-8 py-4 flex justify-between items-center shadow-md z-20 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="text-xl font-bold tracking-tight">KABS ADMIN</div>
                    <div className="h-6 w-px bg-slate-700 mx-2 hidden md:block"></div>
                    <div className="text-sm text-slate-400 hidden md:block">Content Management System</div>
                </div>
                <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
                    <LogOut size={16} /> Sign Out
                </button>
            </div>

            <div className="flex-1 overflow-auto">
                {viewMode === 'create' ? (
                    <CreateManufacturerView 
                        onCancel={() => setViewMode('home')}
                        onCreate={handleCreateLine}
                    />
                ) : viewMode === 'detail' && activeLine ? (
                    <ManufacturerDetailView 
                        line={activeLine}
                        onBack={() => {
                            setSelectedLineId(null);
                            setViewMode('home');
                        }}
                        onDeleteLine={onDeleteLine}
                        onUploadCatalog={onUploadCatalog}
                        onDeleteFile={onDeleteFile}
                    />
                ) : (
                    <DashboardHomeView 
                        lines={lines}
                        globalGuidelines={globalGuidelines}
                        nkbaStandards={nkbaStandards}
                        onSelectLine={(id) => {
                            setSelectedLineId(id);
                            setViewMode('detail');
                        }}
                        onAddClick={() => setViewMode('create')}
                        onUploadGlobal={(f) => onUploadCatalog('global', f, 'pdf')}
                        onUploadNkba={(f) => onUploadCatalog('global', f, 'nkba')}
                    />
                )}
            </div>
        </div>
    );
};


// --- SUB-VIEW: DASHBOARD HOME ---
const DashboardHomeView = ({
    lines,
    globalGuidelines,
    nkbaStandards,
    onSelectLine,
    onAddClick,
    onUploadGlobal,
    onUploadNkba
}: {
    lines: CabinetLine[],
    globalGuidelines: CatalogueFile | null,
    nkbaStandards: CatalogueFile | null,
    onSelectLine: (id: string) => void,
    onAddClick: () => void,
    onUploadGlobal: (file: File) => void,
    onUploadNkba: (file: File) => void
}) => {
    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Section 1: Global Settings */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-start gap-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-blue-50 p-2 rounded-lg text-blue-600 shrink-0">
                            <FileText size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Global Installation Guidelines</h3>
                    </div>
                    <p className="text-slate-500 text-sm">
                        This PDF document is shared across all manufacturer lines and accessible to all users.
                    </p>
                    
                    <div className="w-full mt-auto pt-4 flex flex-col sm:flex-row items-center gap-3">
                        {globalGuidelines ? (
                            <div className="bg-slate-50 border border-slate-200 rounded px-3 py-2 flex items-center gap-2 text-sm flex-1 w-full">
                                <FileText size={16} className="text-red-500 shrink-0" />
                                <div className="flex flex-col overflow-hidden">
                                    <span className="font-medium text-slate-700 truncate">{globalGuidelines.name}</span>
                                    <span className="text-[10px] text-slate-400">Updated: {globalGuidelines.lastUpdated}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-slate-400 italic flex-1">No global guidelines uploaded.</div>
                        )}
                        
                        <label className="cursor-pointer px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded hover:bg-slate-700 transition-colors flex items-center gap-2 w-full sm:w-auto justify-center">
                            <Upload size={14} /> Update PDF
                            <input 
                                type="file" 
                                className="hidden" 
                                accept=".pdf" 
                                onChange={(e) => e.target.files?.[0] && onUploadGlobal(e.target.files[0])} 
                            />
                        </label>
                    </div>
                </div>

                {/* Section 2: NKBA Standards */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-start gap-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-green-50 p-2 rounded-lg text-green-600 shrink-0">
                            <ShieldCheck size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">NKBA Design Standards</h3>
                    </div>
                    <p className="text-slate-500 text-sm">
                        Upload NKBA PDF to enable authoritative design validation and compliance checks.
                    </p>
                    
                    <div className="w-full mt-auto pt-4 flex flex-col sm:flex-row items-center gap-3">
                        {nkbaStandards ? (
                            <div className="bg-slate-50 border border-slate-200 rounded px-3 py-2 flex items-center gap-2 text-sm flex-1 w-full">
                                <ShieldCheck size={16} className="text-green-600 shrink-0" />
                                <div className="flex flex-col overflow-hidden">
                                    <span className="font-medium text-slate-700 truncate">{nkbaStandards.name}</span>
                                    <span className="text-[10px] text-slate-400">Updated: {nkbaStandards.lastUpdated}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-slate-400 italic flex-1">No NKBA standards uploaded.</div>
                        )}
                        
                        <label className="cursor-pointer px-4 py-2 bg-green-700 text-white text-sm font-medium rounded hover:bg-green-800 transition-colors flex items-center gap-2 w-full sm:w-auto justify-center">
                            <Upload size={14} /> Upload PDF
                            <input 
                                type="file" 
                                className="hidden" 
                                accept=".pdf" 
                                onChange={(e) => e.target.files?.[0] && onUploadNkba(e.target.files[0])} 
                            />
                        </label>
                    </div>
                </div>
            </div>

            {/* Section 3: Manufacturers Grid */}
            <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <h2 className="text-2xl font-bold text-slate-800">Manufacturers</h2>
                    <button 
                        onClick={onAddClick}
                        className="px-4 py-2 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 transition-colors flex items-center gap-2 shadow-sm w-full sm:w-auto justify-center"
                    >
                        <Plus size={18} /> Add Manufacturer
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {lines.map(line => (
                        <div 
                            key={line.id} 
                            onClick={() => onSelectLine(line.id)}
                            className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg hover:border-brand-200 transition-all cursor-pointer group relative"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-lg text-slate-900 group-hover:text-brand-700 transition-colors">{line.name}</h3>
                                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold border ${
                                        line.tier === 'Premium' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                        line.tier === 'Mid-Range' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                        'bg-green-50 text-green-700 border-green-100'
                                    }`}>
                                        {line.tier}
                                    </span>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                                    <ChevronRight size={18} />
                                </div>
                            </div>
                            
                            <p className="text-slate-500 text-sm line-clamp-2 mb-6 h-10">
                                {line.description}
                            </p>

                            <div className="flex gap-2 text-xs border-t border-slate-100 pt-4">
                                <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${line.catalogExcel ? 'bg-green-50 text-green-700' : 'bg-slate-50 text-slate-400'}`}>
                                    <FileSpreadsheet size={14} /> {line.catalogExcel ? 'Excel' : 'No Pricing'}
                                </div>
                                <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${line.guidelinesPdf ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-400'}`}>
                                    <FileText size={14} /> {line.guidelinesPdf ? 'PDF' : 'No Specs'}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- SUB-VIEW: CREATE MANUFACTURER ---
const CreateManufacturerView = ({
    onCancel,
    onCreate
}: {
    onCancel: () => void,
    onCreate: (name: string, tier: 'Budget' | 'Mid-Range' | 'Premium') => void
}) => {
    const [name, setName] = useState('');
    const [tier, setTier] = useState<'Budget' | 'Mid-Range' | 'Premium'>('Mid-Range');

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-8 mt-4 md:mt-12">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Add New Manufacturer</h2>
            
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Manufacturer Name</label>
                        <input 
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                            placeholder="e.g. Acme Cabinetry"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-3">Price Tier Category</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {(['Budget', 'Mid-Range', 'Premium'] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => setTier(t)}
                                    className={`p-4 rounded-lg border-2 text-center transition-all ${
                                        tier === t 
                                        ? 'border-brand-600 bg-brand-50 text-brand-700' 
                                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                    }`}
                                >
                                    <div className="font-semibold mb-1">{t}</div>
                                    <div className="text-xs opacity-70">
                                        {t === 'Budget' && 'Economy materials'}
                                        {t === 'Mid-Range' && 'Standard standard'}
                                        {t === 'Premium' && 'Custom finishes'}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 mt-6">
                        <button 
                            onClick={onCancel}
                            className="px-6 py-2 text-slate-600 hover:text-slate-800 font-medium"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={() => {
                                if(name.trim()) onCreate(name, tier);
                            }}
                            disabled={!name.trim()}
                            className="px-6 py-2 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                           <Save size={18} /> Create Manufacturer
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- SUB-VIEW: MANUFACTURER DETAIL ---
const ManufacturerDetailView = ({
    line,
    onBack,
    onDeleteLine,
    onUploadCatalog,
    onDeleteFile
}: {
    line: CabinetLine,
    onBack: () => void,
    onDeleteLine: (id: string) => void,
    onUploadCatalog: (id: string, f: File, t: 'excel' | 'pdf' | 'nkba') => Promise<void>,
    onDeleteFile: (id: string, t: 'excel' | 'pdf' | 'nkba') => void
}) => {
    // State to track upload progress
    const [uploadingType, setUploadingType] = useState<'excel' | 'pdf' | null>(null);

    const handleUpload = async (file: File, type: 'excel' | 'pdf') => {
        setUploadingType(type);
        try {
            await onUploadCatalog(line.id, file, type);
        } catch (error) {
            console.error("Upload failed", error);
            alert("Upload failed. Please try again.");
        } finally {
            setUploadingType(null);
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-8">
            {/* Header Navigation */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                <button 
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-medium transition-colors"
                >
                    <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                        <ArrowLeft size={16} />
                    </div>
                    Back to Dashboard
                </button>

                <button 
                    onClick={() => {
                        if(confirm(`Are you sure you want to delete ${line.name}? This action cannot be undone.`)) {
                            onDeleteLine(line.id);
                            onBack();
                        }
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 w-full sm:w-auto justify-center"
                >
                    <Trash2 size={16} /> Delete Manufacturer
                </button>
            </div>

            {/* Main Info Header */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 mb-8">
                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">{line.name}</h1>
                        <p className="text-slate-500 max-w-2xl">{line.description}</p>
                    </div>
                    <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${
                        line.tier === 'Premium' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                        line.tier === 'Mid-Range' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                        'bg-green-100 text-green-700 border-green-200'
                    }`}>
                        {line.tier}
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8 pt-8 border-t border-slate-100">
                    <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Base Multiplier</div>
                        <div className="text-2xl font-mono font-bold text-slate-800">{line.multiplier}x</div>
                    </div>
                    <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Finish Premium</div>
                        <div className="text-2xl font-mono font-bold text-slate-800">{(line.finishPremium * 100).toFixed(0)}%</div>
                    </div>
                    <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Shipping Factor</div>
                        <div className="text-2xl font-mono font-bold text-slate-800">{(line.shippingFactor * 100).toFixed(0)}%</div>
                    </div>
                </div>
            </div>

            {/* Files Section */}
            <h2 className="text-xl font-bold text-slate-800 mb-4">Catalog Management</h2>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
                {/* EXCEL */}
                <FileRow 
                    title="Price Sheet Data"
                    description="Upload Excel/CSV to populate SKU database"
                    icon={<FileSpreadsheet className="text-green-600" size={24} />}
                    accept=".xlsx,.csv"
                    file={line.catalogExcel}
                    onUpload={(f) => handleUpload(f, 'excel')}
                    onDelete={() => onDeleteFile(line.id, 'excel')}
                    isUploading={uploadingType === 'excel'}
                />
                
                {/* PDF */}
                <FileRow 
                    title="Specification Guide"
                    description="Visual catalog for installation specs"
                    icon={<FileText className="text-red-600" size={24} />}
                    accept=".pdf"
                    file={line.guidelinesPdf}
                    onUpload={(f) => handleUpload(f, 'pdf')}
                    onDelete={() => onDeleteFile(line.id, 'pdf')}
                    isUploading={uploadingType === 'pdf'}
                />
            </div>
        </div>
    );
};

// --- Helper Components ---

const FileRow = ({ 
    title,
    description,
    icon, 
    accept, 
    file, 
    onUpload,
    onDelete,
    isUploading
}: { 
    title: string, 
    description?: string,
    icon: React.ReactNode, 
    accept: string, 
    file?: CatalogueFile, 
    onUpload: (f: File) => void,
    onDelete: () => void,
    isUploading?: boolean
}) => {
    return (
        <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between group hover:bg-slate-50 transition-colors gap-4">
            <div className="flex items-center gap-5 w-full sm:w-auto">
                <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center shadow-sm shrink-0">
                    {icon}
                </div>
                <div className="min-w-0">
                    <div className="font-bold text-slate-900">{title}</div>
                    {file ? (
                        <div className="flex flex-col mt-1">
                            <span className="text-sm font-medium text-brand-600 truncate max-w-[200px] md:max-w-[300px]">{file.name}</span>
                            <span className="text-xs text-slate-400">Updated: {file.lastUpdated}</span>
                        </div>
                    ) : (
                        <div className="text-sm text-slate-400 mt-1">{description || "Not uploaded"}</div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                {file && !isUploading ? (
                    <>
                        <button 
                            onClick={onDelete}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                            title="Delete File"
                        >
                            <Trash2 size={18} />
                        </button>
                        <div className="h-8 w-px bg-slate-200"></div>
                    </>
                ) : null}
                
                <label className={`cursor-pointer px-5 py-2.5 font-medium text-sm rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 border w-full sm:w-auto ${
                    isUploading 
                    ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-wait' 
                    : file 
                        ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300' 
                        : 'bg-slate-800 border-transparent text-white hover:bg-slate-700'
                }`}>
                    {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {isUploading ? 'Uploading...' : (file ? 'Replace' : 'Upload File')}
                    <input type="file" className="hidden" accept={accept} disabled={isUploading} onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
                </label>
            </div>
        </div>
    );
};

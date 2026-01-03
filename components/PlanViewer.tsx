import React, { useState, useRef, useEffect } from 'react';
import { MousePointer2, Plus, ZoomIn, ZoomOut } from 'lucide-react';

interface PlanViewerProps {
    onAddTag: (tag: string) => void;
    items: { tag: string }[];
}

export const PlanViewer: React.FC<PlanViewerProps> = ({ onAddTag, items }) => {
    const [scale, setScale] = useState(1);
    const [markers, setMarkers] = useState<{x: number, y: number, label: string}[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const [mode, setMode] = useState<'view' | 'tag'>('view');

    // Simulate placing existing tags from BOM
    useEffect(() => {
        // In a real app, coordinates come from the DB. 
        // Here we just don't clear them so the user feels persistence during the session.
    }, [items]);

    const handlePlanClick = (e: React.MouseEvent) => {
        if (mode !== 'tag' || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;

        const nextNum = items.length + 1;
        const label = `C${nextNum}`;

        setMarkers([...markers, { x, y, label }]);
        onAddTag(label);
        
        // Auto-switch back to view or stay in tag mode? Let's stay in tag for speed.
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200">
            {/* Toolbar */}
            <div className="p-3 border-b border-slate-200 bg-white flex justify-between items-center shadow-sm z-10">
                <div className="flex space-x-2">
                    <button 
                        onClick={() => setMode('view')}
                        className={`p-2 rounded flex items-center gap-2 text-sm font-medium ${mode === 'view' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border'}`}
                    >
                        <MousePointer2 size={16} /> Pan
                    </button>
                    <button 
                        onClick={() => setMode('tag')}
                        className={`p-2 rounded flex items-center gap-2 text-sm font-medium ${mode === 'tag' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border'}`}
                    >
                        <Plus size={16} /> Add Cabinet
                    </button>
                </div>
                <div className="flex space-x-1">
                    <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-2 hover:bg-slate-100 rounded">
                        <ZoomOut size={18} />
                    </button>
                    <span className="p-2 text-sm text-slate-500 w-12 text-center">{Math.round(scale * 100)}%</span>
                    <button onClick={() => setScale(s => Math.min(2, s + 0.1))} className="p-2 hover:bg-slate-100 rounded">
                        <ZoomIn size={18} />
                    </button>
                </div>
            </div>

            {/* Canvas Area */}
            <div className="flex-1 overflow-hidden relative cursor-crosshair bg-slate-100 grid place-items-center">
                <div 
                    ref={containerRef}
                    onClick={handlePlanClick}
                    style={{ 
                        transform: `scale(${scale})`, 
                        width: '800px', 
                        height: '600px',
                        transformOrigin: 'center center',
                        transition: 'transform 0.1s ease-out'
                    }}
                    className="bg-white shadow-xl relative border border-slate-300"
                >
                    {/* Placeholder for PDF Image */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 pointer-events-none">
                         <svg className="w-full h-full opacity-20" viewBox="0 0 100 100">
                            <rect x="10" y="10" width="80" height="80" fill="none" stroke="currentColor" strokeWidth="1"/>
                            <line x1="10" y1="30" x2="40" y2="30" stroke="currentColor" strokeWidth="1"/>
                            <rect x="10" y="30" width="30" height="20" fill="none" stroke="currentColor" strokeWidth="0.5"/>
                            <text x="50" y="50" textAnchor="middle" fontSize="5" fill="currentColor">KITCHEN FLOOR PLAN PDF</text>
                         </svg>
                    </div>

                    {/* Markers */}
                    {markers.map((m, idx) => (
                        <div 
                            key={idx}
                            style={{ left: m.x, top: m.y }}
                            className="absolute transform -translate-x-1/2 -translate-y-1/2 bg-brand-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-md z-20 pointer-events-none"
                        >
                            {m.label}
                        </div>
                    ))}
                    
                    {/* Ghost marker for existing items if we had coordinates */}
                    {items.length > markers.length && (
                         <div className="absolute top-2 right-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded border border-yellow-300">
                            {items.length - markers.length} items added via BOM
                        </div>
                    )}
                </div>
            </div>
            
            <div className="bg-white p-2 border-t border-slate-200 text-xs text-slate-500">
                {mode === 'tag' ? 'Click on plan to place cabinet tag.' : 'Pan and Zoom mode.'}
            </div>
        </div>
    );
};

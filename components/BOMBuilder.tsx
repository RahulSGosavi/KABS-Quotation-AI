import React, { useState } from 'react';
import { QuoteItem, CabinetLine } from '../types';
import { MASTER_CATALOG } from '../constants';
import { calculateItemPrice } from '../services/pricingEngine';
import { Trash2, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';

interface BOMBuilderProps {
    items: QuoteItem[];
    lineId: string;
    onUpdateItem: (id: string, updates: Partial<QuoteItem>) => void;
    onDeleteItem: (id: string) => void;
}

export const BOMBuilder: React.FC<BOMBuilderProps> = ({ items, lineId, onUpdateItem, onDeleteItem }) => {
    
    const handleSkuChange = (id: string, newSku: string) => {
        // Trigger re-price logic immediately
        const pricing = calculateItemPrice(newSku, lineId, 1); // defaulting qty 1 for check
        onUpdateItem(id, { 
            sku: newSku, 
            description: pricing.description,
            unitPrice: pricing.unitPrice,
            totalPrice: pricing.totalPrice,
            isValid: pricing.isValid,
            validationMessage: pricing.validationMessage
        });
    };

    const handleQtyChange = (id: string, sku: string, newQty: number, currentUnitPrice: number) => {
        // Only update total, assume unit price stable unless sku changes
        onUpdateItem(id, {
            quantity: newQty,
            totalPrice: Math.round(newQty * currentUnitPrice * 100) / 100
        });
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="overflow-x-auto flex-1">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 shadow-sm z-10">
                        <tr>
                            <th className="px-4 py-3 w-16">Tag</th>
                            <th className="px-4 py-3 w-20">Qty</th>
                            <th className="px-4 py-3 w-32">SKU</th>
                            <th className="px-4 py-3">Description</th>
                            <th className="px-4 py-3 w-24 text-right">Unit Price</th>
                            <th className="px-4 py-3 w-24 text-right">Total</th>
                            <th className="px-4 py-3 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                                    No items yet. Click the Plan or "Add Item" to start.
                                </td>
                            </tr>
                        ) : (
                            items.map((item) => (
                                <BOMRow 
                                    key={item.id} 
                                    item={item} 
                                    onSkuChange={handleSkuChange}
                                    onQtyChange={handleQtyChange}
                                    onDelete={onDeleteItem}
                                />
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Sub-component for performance optimization in large lists
const BOMRow: React.FC<{
    item: QuoteItem;
    onSkuChange: (id: string, sku: string) => void;
    onQtyChange: (id: string, sku: string, qty: number, price: number) => void;
    onDelete: (id: string) => void;
}> = ({ item, onSkuChange, onQtyChange, onDelete }) => {
    const [skuInput, setSkuInput] = useState(item.sku);

    // Sync local state if prop changes (e.g. from line swap)
    React.useEffect(() => {
        setSkuInput(item.sku);
    }, [item.sku]);

    return (
        <tr className={`hover:bg-slate-50 group ${!item.isValid ? 'bg-red-50 hover:bg-red-100' : ''}`}>
            <td className="px-4 py-2 font-medium text-slate-700">{item.tag}</td>
            <td className="px-4 py-2">
                <input 
                    type="number" 
                    min="1"
                    className="w-12 border border-slate-300 rounded px-1 py-1 text-center focus:ring-2 focus:ring-brand-500 outline-none"
                    value={item.quantity}
                    onChange={(e) => onQtyChange(item.id, item.sku, parseInt(e.target.value) || 0, item.unitPrice)}
                />
            </td>
            <td className="px-4 py-2 relative">
                <div className="flex items-center gap-2">
                    <input 
                        type="text" 
                        className={`w-full border rounded px-2 py-1 uppercase font-mono transition-colors focus:ring-2 outline-none
                            ${!item.isValid ? 'border-red-500 focus:ring-red-200' : 'border-slate-300 focus:ring-brand-500'}
                        `}
                        value={skuInput}
                        onChange={(e) => setSkuInput(e.target.value)}
                        onBlur={() => onSkuChange(item.id, skuInput)}
                        list="sku-suggestions"
                    />
                    {!item.isValid && (
                         <div className="group/tooltip relative">
                            <AlertCircle size={16} className="text-red-500 cursor-help" />
                            <div className="absolute left-full ml-2 top-0 w-48 p-2 bg-red-800 text-white text-xs rounded shadow-lg z-50 hidden group-hover/tooltip:block">
                                {item.validationMessage || "Invalid SKU"}
                            </div>
                        </div>
                    )}
                </div>
                <datalist id="sku-suggestions">
                    {MASTER_CATALOG.map(cat => <option key={cat.sku} value={cat.sku} />)}
                </datalist>
            </td>
            <td className="px-4 py-2">
                <div className="flex flex-col">
                    <span className={`text-sm ${!item.isValid ? 'text-red-600 italic' : 'text-slate-600'}`}>
                        {item.description || "Unknown Item"}
                    </span>
                    {item.options.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                            {item.options.map(opt => (
                                <span key={opt} className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
                                    {opt}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </td>
            <td className="px-4 py-2 text-right font-mono text-slate-600">
                ${item.unitPrice.toFixed(2)}
            </td>
            <td className="px-4 py-2 text-right font-mono font-medium text-slate-800">
                ${item.totalPrice.toFixed(2)}
            </td>
            <td className="px-4 py-2 text-center">
                <button 
                    onClick={() => onDelete(item.id)}
                    className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <Trash2 size={16} />
                </button>
            </td>
        </tr>
    );
};

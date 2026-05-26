import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Plus, Trash2 } from 'lucide-react';

function createEmptyItem() {
    return {
        title: '',
        description: '',
        years: ''
    };
}

export default function ProfileHistoryEditor({
    title,
    helperText,
    items,
    onChange,
    isEditing,
    titlePlaceholder = 'Title or school name',
    descriptionPlaceholder = 'Major, description, or notes',
    yearsPlaceholder = 'e.g., 2020 - 2024',
    emptyText = 'No entries yet.'
}) {
    const safeItems = Array.isArray(items) ? items : [];

    const updateItem = (index, field, value) => {
        onChange(safeItems.map((item, itemIndex) => (
            itemIndex === index ? { ...item, [field]: value } : item
        )));
    };

    const addItem = () => {
        onChange([...safeItems, createEmptyItem()]);
    };

    const removeItem = (index) => {
        onChange(safeItems.filter((_, itemIndex) => itemIndex !== index));
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h4 className="text-lg font-black text-slate-900">{title}</h4>
                    {helperText && <p className="mt-1 text-sm text-slate-500">{helperText}</p>}
                </div>
                {isEditing && (
                    <Button type="button" variant="outline" onClick={addItem} className="h-9 shrink-0 rounded-lg">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Entry
                    </Button>
                )}
            </div>

            {safeItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400">
                    {emptyText}
                </div>
            ) : (
                <div className="space-y-4">
                    {safeItems.map((item, index) => (
                        <div key={item.id || index} className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="absolute left-4 top-5 h-3 w-3 rounded-full border-2 border-white bg-[#155dfc] shadow ring-2 ring-blue-100" />
                            <div className="ml-7 space-y-3">
                                {isEditing ? (
                                    <>
                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_180px]">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Title / School</Label>
                                                <Input
                                                    value={item.title || ''}
                                                    onChange={(event) => updateItem(index, 'title', event.target.value)}
                                                    placeholder={titlePlaceholder}
                                                    className="h-11 rounded-lg"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Years</Label>
                                                <Input
                                                    value={item.years || ''}
                                                    onChange={(event) => updateItem(index, 'years', event.target.value)}
                                                    placeholder={yearsPlaceholder}
                                                    className="h-11 rounded-lg"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Major / Description</Label>
                                            <Textarea
                                                value={item.description || ''}
                                                onChange={(event) => updateItem(index, 'description', event.target.value)}
                                                placeholder={descriptionPlaceholder}
                                                className="min-h-24 rounded-lg"
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => removeItem(index)}
                                            className="h-9 border-red-200 text-red-600 hover:bg-red-50"
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Remove
                                        </Button>
                                    </>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <h5 className="break-words text-base font-black text-slate-900">{item.title || 'Untitled entry'}</h5>
                                            {item.years && (
                                                <span className="w-fit shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#155dfc]">
                                                    {item.years}
                                                </span>
                                            )}
                                        </div>
                                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">
                                            {item.description || 'No description provided.'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleHelp, Code2, Sparkles } from 'lucide-react';

import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Textarea } from '../../ui/textarea';
import {
    CONSENT_TEMPLATE_CODES,
    inspectConsentTemplate,
    normalizeImportedConsentTemplate
} from '../../lib/consentTemplateCodes';

const QUICK_CODES = ['&date&', '&owner_name&', '&pet_name&', '&veterinarian_name&', '&service_name&', '&branch_name&'];

export function ConsentTemplateEditor({ value, onChange, textareaRef, onInsertCode, rows = 18 }) {
    const inspection = useMemo(() => inspectConsentTemplate(value), [value]);
    const quickCodes = CONSENT_TEMPLATE_CODES.filter((item) => QUICK_CODES.includes(item.code));

    const applySmartConversion = () => {
        onChange(normalizeImportedConsentTemplate(value));
    };

    return (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                            <Code2 className="size-4 text-blue-600" /> Template content
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Select an underline blank, then insert a code to replace it. Inserted values appear bold in the document preview.
                        </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={applySmartConversion}>
                        <Sparkles className="size-4 text-amber-500" /> Detect common blanks
                    </Button>
                </div>

                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {quickCodes.map((item) => (
                        <button
                            key={item.code}
                            type="button"
                            onClick={() => onInsertCode(item.code)}
                            className="shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs font-bold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-slate-800"
                            title={`Insert ${item.label}`}
                        >
                            {item.code}
                        </button>
                    ))}
                </div>
            </div>

            <Textarea
                ref={textareaRef}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onFocus={() => textareaRef?.current?.setAttribute('data-consent-editor-active', 'true')}
                rows={rows}
                spellCheck
                className="min-h-[320px] resize-y rounded-none border-0 bg-white font-mono text-sm leading-6 focus:ring-0 dark:bg-slate-950 dark:text-slate-100"
                placeholder="Consent text or TXT upload"
            />

            <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/70 sm:flex-row sm:flex-wrap sm:items-center">
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="size-3.5" /> {inspection.supportedCodes.length} supported code{inspection.supportedCodes.length === 1 ? '' : 's'}
                </span>
                {inspection.blankRuns.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="size-3.5" /> {inspection.blankRuns.length} underline blank{inspection.blankRuns.length === 1 ? '' : 's'} still need a rule
                    </span>
                )}
                {inspection.unknownCodes.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-red-700 dark:text-red-300">
                        <AlertTriangle className="size-3.5" /> Unknown: {inspection.unknownCodes.join(', ')}
                    </span>
                )}
            </div>
        </div>
    );
}

export function ConsentCodeReference({ onInsertCode }) {
    const [open, setOpen] = useState(false);
    const groupedCodes = useMemo(() => CONSENT_TEMPLATE_CODES.reduce((groups, item) => ({
        ...groups,
        [item.group]: [...(groups[item.group] || []), item]
    }), {}), []);

    const insertCode = (code) => {
        onInsertCode(code);
        setOpen(false);
    };

    return (
        <>
            <Button
                type="button"
                size="icon"
                onClick={() => setOpen(true)}
                className="fixed bottom-6 right-6 z-40 size-12 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700"
                aria-label="Open consent template code guide"
                title="Consent template code guide"
            >
                <CircleHelp className="size-6" />
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-h-[88vh] max-w-3xl overflow-hidden p-0">
                    <DialogHeader className="border-b border-slate-200 p-5 pr-14 dark:border-slate-700">
                        <DialogTitle className="flex items-center gap-2">
                            <CircleHelp className="size-5 text-blue-600" /> Consent template code guide
                        </DialogTitle>
                        <DialogDescription>
                            Click a code to insert it at the cursor in the active consent editor.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[68vh] space-y-5 overflow-y-auto p-5">
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
                            <p className="font-bold">Rules</p>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">
                                <li>Codes must begin and end with an ampersand, for example <code>&amp;date&amp;</code>.</li>
                                <li>Date codes are filled automatically when the document is displayed or signed.</li>
                                <li>Owner, pet, veterinarian, service, and reference codes use the current booking or queue record.</li>
                                <li>Select an underline such as <code>________</code> before clicking a code to replace that blank.</li>
                                <li>Codes apply only to the editable letter content, never to the document title.</li>
                                <li>The pet-owner printed name and electronic signature section is permanent and does not need a code.</li>
                            </ul>
                        </div>

                        {Object.entries(groupedCodes).map(([group, items]) => (
                            <section key={group}>
                                <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{group}</h3>
                                <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                                    {items.map((item) => (
                                        <button
                                            key={item.code}
                                            type="button"
                                            onClick={() => insertCode(item.code)}
                                            className="grid w-full gap-1 p-3 text-left transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:hover:bg-slate-800 sm:grid-cols-[170px_minmax(0,1fr)_180px] sm:items-center sm:gap-3"
                                        >
                                            <code className="font-bold text-blue-700 dark:text-blue-300">{item.code}</code>
                                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.label}</span>
                                            <span className="truncate text-xs text-slate-500 dark:text-slate-400">Example: {item.example}</span>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

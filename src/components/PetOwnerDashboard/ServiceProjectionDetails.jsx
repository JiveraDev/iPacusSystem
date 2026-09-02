import { Card, CardContent } from "../../ui/card";
import { cn } from "../../ui/utils";

export function ServiceProjectionDetails({ detail, children }) {
    const includedItems = Array.isArray(detail?.includedItems) ? detail.includedItems : [];

    return (
        <div className="space-y-5 text-sm text-slate-700 dark:text-slate-300">
            <section>
                <h4 className="mb-2 text-xs font-black uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                    {detail?.includedTitle || "What's Included:"}
                </h4>
                <ul className="space-y-2">
                    {includedItems.map((item) => (
                        <li key={item} className="flex items-start gap-2.5 leading-5">
                            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#155dfc]" aria-hidden="true" />
                            <span>{item}</span>
                        </li>
                    ))}
                </ul>
            </section>
            <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-950/30">
                <h4 className="text-xs font-black uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Duration</h4>
                <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{detail?.duration || "To be announced"}</p>
            </section>
            <section>
                <h4 className="mb-2 text-xs font-black uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Price</h4>
                {children}
            </section>
        </div>
    );
}

export function ServiceProjectionNote({ detail, className = "" }) {
    if (!detail?.reviewNote) {
        return null;
    }

    return (
        <Card className={cn(
            "border-blue-100 bg-blue-50/70 shadow-none dark:border-blue-900/60 dark:bg-blue-950/20",
            className
        )}>
            <CardContent className="pt-4 sm:pt-5">
                <p className="text-sm font-medium leading-6 text-slate-700 dark:text-slate-300">
                    <span className="mr-1 font-black text-blue-700 dark:text-blue-300" aria-hidden="true">i</span>
                    {detail.reviewNote}
                </p>
            </CardContent>
        </Card>
    );
}

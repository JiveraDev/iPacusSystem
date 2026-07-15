export default function DashboardPageHeader({
    title,
    description,
    actions = null,
    toolbar = null,
    layout = 'responsive',
    className = ''
}) {
    const isStacked = layout === 'stacked';

    return (
        <section className={`rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className}`}>
            <div className={`flex flex-col gap-4 ${isStacked ? '' : 'xl:flex-row xl:items-end xl:justify-between'}`}>
                <div className="min-w-0">
                    <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                        {title}
                    </h1>
                    {description ? (
                        <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
                            {description}
                        </p>
                    ) : null}
                </div>

                {toolbar ? (
                    <div className={isStacked ? 'w-full' : 'w-full xl:w-auto'}>
                        {toolbar}
                    </div>
                ) : actions ? (
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                        {actions}
                    </div>
                ) : null}
            </div>
        </section>
    );
}

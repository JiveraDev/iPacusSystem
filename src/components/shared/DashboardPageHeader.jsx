import ServicePetPeek from './ServicePetPeek.jsx';

const HEADER_PET_KINDS = ['dog', 'cat', 'bunny', 'parrot'];
const HEADER_PET_ACCENTS = ['blue', 'coral', 'sun', 'mint'];

function getHeaderPetVariant(title) {
    const hash = Array.from(String(title || 'dashboard')).reduce(
        (total, character) => total + character.charCodeAt(0),
        0
    );

    return {
        kind: HEADER_PET_KINDS[hash % HEADER_PET_KINDS.length],
        accent: HEADER_PET_ACCENTS[Math.floor(hash / HEADER_PET_KINDS.length) % HEADER_PET_ACCENTS.length]
    };
}

export default function DashboardPageHeader({
    title,
    description,
    icon: Icon = null,
    meta = null,
    navigation = null,
    actions = null,
    toolbar = null,
    layout = 'responsive',
    petHover = true,
    petKind = null,
    petAccent = null,
    className = ''
}) {
    const isStacked = layout === 'stacked';
    const automaticPet = getHeaderPetVariant(title);
    const titleBlock = (
        <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#155dfc] dark:bg-blue-950/60 dark:text-blue-300">
                    <Icon className="size-5" aria-hidden="true" />
                </span>
            ) : null}
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                        {title}
                    </h1>
                    {meta}
                </div>
                {description ? (
                    <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
                        {description}
                    </p>
                ) : null}
            </div>
        </div>
    );
    const actionBlock = actions ? (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            {actions}
        </div>
    ) : null;

    return (
        <section
            data-slot="dashboard-page-header"
            data-header-pet={petHover ? 'enabled' : 'disabled'}
            className={`dashboard-page-header-pet relative isolate overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className}`}
        >
            {petHover ? (
                <ServicePetPeek
                    kind={petKind || automaticPet.kind}
                    accent={petAccent || automaticPet.accent}
                />
            ) : null}
            {navigation ? (
                <div className="mb-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                    {navigation}
                </div>
            ) : null}
            {isStacked ? (
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        {titleBlock}
                        {actionBlock}
                    </div>
                    {toolbar ? <div className="w-full">{toolbar}</div> : null}
                </div>
            ) : (
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    {titleBlock}
                    {toolbar ? <div className="w-full xl:w-auto">{toolbar}</div> : actionBlock}
                </div>
            )}
        </section>
    );
}

import { Button } from '../../ui/button';
import { cn } from '../../ui/utils';

function getPaginationItems(currentPage, totalPages) {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    if (currentPage <= 4) {
        return [1, 2, 3, 4, 5, 'end-ellipsis', totalPages];
    }

    if (currentPage >= totalPages - 3) {
        return [1, 'start-ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, 'start-ellipsis', currentPage - 1, currentPage, currentPage + 1, 'end-ellipsis', totalPages];
}

export default function TablePagination({
    currentPage,
    totalItems,
    pageSize = 20,
    onPageChange,
    itemLabel = 'items',
    className,
}) {
    if (totalItems <= 0) {
        return null;
    }

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const activePage = Math.min(Math.max(1, currentPage), totalPages);
    const firstItem = ((activePage - 1) * pageSize) + 1;
    const lastItem = Math.min(activePage * pageSize, totalItems);

    return (
        <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
            <p className="text-sm text-slate-500" aria-live="polite">
                Showing {firstItem}-{lastItem} of {totalItems} {itemLabel}
            </p>
            <nav className="flex flex-wrap items-center gap-1" aria-label={`${itemLabel} pagination`}>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={activePage === 1}
                    onClick={() => onPageChange(activePage - 1)}
                >
                    Previous
                </Button>
                {getPaginationItems(activePage, totalPages).map((item) => {
                    if (typeof item !== 'number') {
                        return (
                            <span key={item} className="flex size-9 items-center justify-center text-sm text-slate-400" aria-hidden="true">
                                &hellip;
                            </span>
                        );
                    }

                    const isActive = item === activePage;

                    return (
                        <Button
                            key={item}
                            type="button"
                            variant={isActive ? 'default' : 'outline'}
                            size="icon"
                            className="size-9"
                            aria-label={`Go to ${itemLabel} page ${item}`}
                            aria-current={isActive ? 'page' : undefined}
                            onClick={() => onPageChange(item)}
                        >
                            {item}
                        </Button>
                    );
                })}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={activePage === totalPages}
                    onClick={() => onPageChange(activePage + 1)}
                >
                    Next
                </Button>
            </nav>
        </div>
    );
}

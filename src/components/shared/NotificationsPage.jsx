import { ArrowLeft } from 'lucide-react';
import { Button } from '../../ui/button';
import { useNotificationCenter } from '../../hooks/useNotificationCenter';
import { useNavigate } from '../dashboardRouter.jsx';
import { prepareNotificationRedirect } from '../../lib/notificationRedirect';
import NotificationFeed from './NotificationFeed.jsx';

const NOTIFICATIONS_RETURN_PATH_KEY = 'ipawcus-notifications-return-path';

export default function NotificationsPage({ user }) {
    const navigate = useNavigate();
    const {
        unreadCount,
        filter,
        setFilter,
        summaryItems,
        isUpdating,
        isLoading,
        isLoadingMore,
        errorMessage,
        visibleNotifications,
        notificationGroups,
        canLoadMoreVisible,
        loadMoreLabel,
        loadMore,
        markNotificationAsOpened,
        markAllRead
    } = useNotificationCenter(user, {
        pageSize: 12,
        refreshKeyPrefix: 'notifications-page'
    });

    const handleNotificationClick = async (notification) => {
        await markNotificationAsOpened(notification);

        const redirectPath = prepareNotificationRedirect(notification.petRedirectPath || notification.redirectPath);
        if (redirectPath) {
            navigate(redirectPath);
        }
    };

    const handleBack = () => {
        let returnPath = '';

        try {
            returnPath = sessionStorage.getItem(NOTIFICATIONS_RETURN_PATH_KEY) || '';
            sessionStorage.removeItem(NOTIFICATIONS_RETURN_PATH_KEY);
        } catch {
            returnPath = '';
        }

        if (returnPath && returnPath !== '/dashboard/notifications') {
            navigate(returnPath);
            return;
        }

        navigate('/dashboard');
    };

    return (
        <section className="mx-auto flex w-full max-w-4xl flex-col gap-4">
            <div className="flex items-center gap-3">
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleBack}
                    aria-label="Back to dashboard"
                    className="size-10 shrink-0 rounded-lg bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                >
                    <ArrowLeft className="size-5" />
                </Button>
                <div className="min-w-0">
                    <h1 className="truncate text-2xl font-black text-slate-950">Notifications</h1>
                    <p className="text-sm font-semibold text-slate-500">
                        {unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'All caught up'}
                    </p>
                </div>
            </div>

            <NotificationFeed
                layout="page"
                title="Recent updates"
                unreadCount={unreadCount}
                filter={filter}
                onFilterChange={setFilter}
                summaryItems={summaryItems}
                isUpdating={isUpdating}
                onMarkAllRead={markAllRead}
                isLoading={isLoading}
                errorMessage={errorMessage}
                visibleNotifications={visibleNotifications}
                notificationGroups={notificationGroups}
                canLoadMoreVisible={canLoadMoreVisible}
                isLoadingMore={isLoadingMore}
                onLoadMore={loadMore}
                loadMoreLabel={loadMoreLabel}
                onNotificationClick={handleNotificationClick}
            />
        </section>
    );
}

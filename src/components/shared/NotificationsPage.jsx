import { ArrowLeft } from 'lucide-react';
import { Button } from '../../ui/button';
import { useNotificationCenter } from '../../hooks/useNotificationCenter';
import { useNavigate } from '../dashboardRouter.jsx';
import { prepareNotificationRedirect } from '../../lib/notificationRedirect';
import NotificationFeed from './NotificationFeed.jsx';
import DashboardPageHeader from './DashboardPageHeader.jsx';
import BrowserNotificationButton from './BrowserNotificationButton.jsx';

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
            <DashboardPageHeader
                title="Notifications"
                description={unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'All caught up'}
                navigation={(
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleBack}
                        className="-ml-2 gap-2 text-slate-600 dark:text-slate-300"
                    >
                        <ArrowLeft className="size-4" />
                        Back to dashboard
                    </Button>
                )}
            />

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
                notificationControl={<BrowserNotificationButton user={user} />}
                onNotificationClick={handleNotificationClick}
            />
        </section>
    );
}

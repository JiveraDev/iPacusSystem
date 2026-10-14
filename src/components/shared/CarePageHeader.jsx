import DashboardPageHeader from './DashboardPageHeader.jsx';
import { cn } from '../../ui/utils';
import './careWorkspace.css';

export default function CarePageHeader({ className = '', ...props }) {
    return <div data-dashboard-heading-plain><DashboardPageHeader {...props} petHover={false} className={cn('care-page-header', className)} /></div>;
}

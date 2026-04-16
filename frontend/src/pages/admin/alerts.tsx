import { getAdminLayout } from '../../components/Layout';
import { AdminConsole } from './index';

export default function OperationalAlertsPage() {
  return <AdminConsole forcedTab="operational-alerts" showTabs={false} />;
}

OperationalAlertsPage.getLayout = getAdminLayout;

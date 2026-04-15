import { getAdminLayout } from '../../components/Layout';
import { AdminConsole } from './index';

export default function DirectPaymentsPage() {
  return <AdminConsole forcedTab="direct-payments" showTabs={false} />;
}

DirectPaymentsPage.getLayout = getAdminLayout;

import { getAdminLayout } from '../../components/Layout';
import { AdminConsole } from './index';

export default function PickupRequestsPage() {
  return <AdminConsole forcedTab="pickup" showTabs={false} />;
}

PickupRequestsPage.getLayout = getAdminLayout;

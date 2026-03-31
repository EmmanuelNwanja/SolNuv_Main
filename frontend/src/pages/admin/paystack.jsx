import { getAdminLayout } from '../../components/Layout';
import { AdminConsole } from './index';

export default function AdminPaystackPage() {
  return <AdminConsole forcedTab="paystack" showTabs={false} />;
}

AdminPaystackPage.getLayout = getAdminLayout;

import { getAdminLayout } from '../../components/Layout';
import { AdminConsole } from './index';

export default function AdminManagementPage() {
  return <AdminConsole forcedTab="admins" showTabs={false} />;
}

AdminManagementPage.getLayout = getAdminLayout;

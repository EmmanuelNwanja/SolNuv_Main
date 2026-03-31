import { getAdminLayout } from '../../components/Layout';
import { AdminConsole } from './index';

export default function AdminUsersPage() {
  return <AdminConsole forcedTab="users" showTabs={false} />;
}

AdminUsersPage.getLayout = getAdminLayout;

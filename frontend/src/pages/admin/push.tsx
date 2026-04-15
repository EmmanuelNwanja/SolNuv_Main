import { getAdminLayout } from '../../components/Layout';
import { AdminConsole } from './index';

export default function AdminPushPage() {
  return <AdminConsole forcedTab="push" showTabs={false} />;
}

AdminPushPage.getLayout = getAdminLayout;

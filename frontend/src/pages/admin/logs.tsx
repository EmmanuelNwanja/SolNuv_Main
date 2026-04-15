import { getAdminLayout } from '../../components/Layout';
import { AdminConsole } from './index';

export default function AdminLogsPage() {
  return <AdminConsole forcedTab="logs" showTabs={false} />;
}

AdminLogsPage.getLayout = getAdminLayout;

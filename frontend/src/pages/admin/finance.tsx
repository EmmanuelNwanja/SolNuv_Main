import { getAdminLayout } from '../../components/Layout';
import { AdminConsole } from './index';

export default function AdminFinancePage() {
  return <AdminConsole forcedTab="finance" showTabs={false} />;
}

AdminFinancePage.getLayout = getAdminLayout;

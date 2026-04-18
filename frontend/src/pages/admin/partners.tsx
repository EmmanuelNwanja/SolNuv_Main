import { getAdminLayout } from '../../components/Layout';
import { AdminConsole } from './index';

export default function AdminPartnersPage() {
  return <AdminConsole forcedTab="partners" showTabs={false} />;
}

AdminPartnersPage.getLayout = getAdminLayout;

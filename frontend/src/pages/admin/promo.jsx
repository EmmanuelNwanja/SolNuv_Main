import { getAdminLayout } from '../../components/Layout';
import { AdminConsole } from './index';

export default function AdminPromoPage() {
  return <AdminConsole forcedTab="promo" showTabs={false} />;
}

AdminPromoPage.getLayout = getAdminLayout;

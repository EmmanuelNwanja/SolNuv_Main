import { getAdminLayout } from '../../components/Layout';
import { AdminConsole } from './index';

export default function AdminProjectsPage() {
  return <AdminConsole forcedTab="projects" showTabs={false} />;
}

AdminProjectsPage.getLayout = getAdminLayout;

import SettingsPage from "../../settings";
import { getPartnerTrainingLayout } from "../../../components/Layout";

export default function TrainingSettingsPage() {
  return <SettingsPage />;
}

TrainingSettingsPage.getLayout = getPartnerTrainingLayout;

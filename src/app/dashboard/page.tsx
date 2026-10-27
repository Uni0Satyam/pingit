import { getSession } from "../utils/getSession";
import DashboardClient from "@/components/DashboardClient";

export const instant = false;

const Dashboard = async () => {
  const session = await getSession();

  return (
    <>
      <DashboardClient userProfile={session?.user?.userProfile}/>
    </>
  );
};

export default Dashboard;

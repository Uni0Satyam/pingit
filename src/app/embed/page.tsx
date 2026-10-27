import EmbedClient from "@/components/EmbedClient";
import { getSession } from "../utils/getSession";

export const instant = false;

const page = async () => {
  const session = await getSession();

  return (
    <>
      <EmbedClient userProfile={session?.user?.userProfile!}/>
    </>
  );
};

export default page;

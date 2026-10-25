import HomeClient from '@/components/HomeClient'
import { getSession } from './utils/getSession'

export const instant = false; 

const page = async () => {
  const session = await getSession()
  const user = session?.user;
  return (
    <>
    <HomeClient userProfile={user?.userProfile} />
    </>
  )
}

export default page
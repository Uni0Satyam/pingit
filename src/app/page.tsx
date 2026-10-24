import HomeClient from '@/components/HomeClient'
import { getSession } from './utils/getSession'

export const instant = false; 

const page = async () => {
  const session = await getSession()
  return (
    <>
    <HomeClient email={session?.user?.email} profile={session?.user?.userProfile} />
    </>
  )
}

export default page
import HomeClient from '@/components/HomeClient'
import { getSession } from './utils/getSession'

export const instant = false; 

const page = async () => {
  const session = await getSession()
  
  return (
    <>
    <HomeClient userProfile={session?.user?.userProfile} />
    </>
  )
}

export default page
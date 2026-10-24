import { cookies } from "next/headers";
import { scalekit } from "@/lib/scalekit";

export async function getSession() {
    const session = await cookies();
    const token = session.get("access_token")?.value;
    if(!token) return null;
    
    try {
        const res:any = await scalekit.validateToken(token!);
        const user = await scalekit.user.getUser(res.sub);
        return user;
    } catch (error) {
        console.log(error);
        return null;
    }
}
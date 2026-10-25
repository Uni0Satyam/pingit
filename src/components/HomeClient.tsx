"use client";
import { motion } from "motion/react";
import { Button } from "./ui/button";
import {
  User,
  CreditCardIcon,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
  MessageCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuGroup
} from "./ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { useState } from "react";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { useRouter } from "next/navigation";

const features = [
  {
    title: "Plug & Play",
    desc: "Add the chatbot to your site in single script.",
  },
  {
    title: "Admin Controlled",
    desc: "You controls exactly what AI knows and answers.",
  },
  {
    title: "Always Online",
    desc: "Your customers get instant support 24/7.",
  },
];


const handleLogin = () => {
  window.location.href = "/api/auth/login";
};

const handleLogout = () => {
  window.location.href = "/api/auth/logout";
}

const HomeClient = ({ userProfile }: { userProfile?: any }) => {
  const router = useRouter();
  const firstName = userProfile?.firstName[0].toUpperCase();
  const lastName = userProfile?.lastName[0].toUpperCase();
  const [openDialog, setOpenDialog] = useState(false);

  return (
    <div>
      <div className="min-h-screen bg-linear-to-br from-white to-zinc-50 text-zinc-900 overflow-x-hidden border-b">
        <motion.div
          initial={{ y: -70 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.7 }}
          className="fixed top-0 left-0 w-full z-50 bg-white/70 backdrop-blur-xl border-b border-zinc-200"
        >
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="text-lg tracking-tight font-semibold">
              Support <span className="text-zinc-400">Ease</span>
            </div>
            {userProfile ? (
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button className="w-10 h-10 rounded-full flex items-center justify-center font-semibold hover:scale-105 transition hover:cursor-pointer">
                        {firstName + lastName || <User size={16} />}
                      </Button>
                    }
                  />
                  <DropdownMenuContent>
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>My Account</DropdownMenuLabel>
                      <DropdownMenuItem>
                        <UserIcon />
                        Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <CreditCardIcon />
                        Billing
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <SettingsIcon />
                        Settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={(e) => {
                          e.preventDefault();
                          setOpenDialog(true);
                        }}
                      >
                        <LogOutIcon />
                        Log out
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                <AlertDialog open={openDialog} onOpenChange={setOpenDialog}>
                  <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                      <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
                        <LogOutIcon />
                      </AlertDialogMedia>
                      <AlertDialogTitle>
                        Log out of your account?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        You will need to log back in to access your dashboard,
                        saved preferences, and account settings.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel variant="outline">
                        Stay logged in
                      </AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={handleLogout}>
                        Logout
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : (
              <Button
                className="cursor-pointer px-5 py-2 text-sm font-medium transition disabled:opacity-60 flex items-center gap-2"
                onClick={handleLogin}
              >
                Login
              </Button>
            )}
          </div>
        </motion.div>

        <section className="pt-36 pb-28 px-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.7 }}
            >
              <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
                AI Customer support <br />
                Built for modern websites
              </h1>
              <p className="mt-6 text-lg text-zinc-600 max-w-xl">
                Add a powerful AI chatbot to your website in one click Let your
                customer get instant answers using your own business knowledge.
              </p>
              <div className="mt-10 flex gap-4">
                {userProfile ? (
                  <Button className="px-7 py-3 font-medium transition disabled:opacity-60 hover:cursor-pointer"
                  onClick={() => router.push("/dashboard")}>
                    Go to Dashboard
                  </Button>
                ) : (
                  <Button
                    className="px-7 py-3 font-medium transition disabled:opacity-60 hover:cursor-pointer"
                    onClick={handleLogin}
                  >
                    Get Started
                  </Button>
                )}
                <Button
                  variant={"outline"}
                  className="px-7 py-3 transition disabled:opacity-60 hover:cursor-pointer"
                  onClick={() => router.push("/learn-more")}
                >
                  Learn More
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative"
            >
              <div className="rounded-2xl shadow-2xl border border-zinc-200 p-6">
                <div className="text-sm text-zinc-500 mb-3">
                  Live Chat Preview
                </div>
                <div className="flex w-full max-w-sm flex-col gap-8 py-12">
                  <Bubble align="end" className="flex items-end">
                    <BubbleContent>My order's current status</BubbleContent>
                    <Avatar>
                      <AvatarImage
                        src="https://github.com/evilrabbit.png"
                        alt="@evilrabbit"
                      />
                      <AvatarFallback>Evilrabbit</AvatarFallback>
                    </Avatar>
                  </Bubble>
                  <Bubble variant="muted">
                    <BubbleContent>
                      Your purchase (grooming kit) has been dispatched via
                      Shiprocket. The tracking status shows it is currently in
                      transit and estimated to arrive by Tuesday, 27 October
                    </BubbleContent>
                    <Avatar>
                      <AvatarImage
                        src="https://t3.ftcdn.net/jpg/05/83/74/28/240_F_583742888_L0dIi5d23qJ2rteSlXMeMDGNsnLxbkjB.jpg"
                        alt="@bot"
                        className="grayscale h-7 w-7"
                      />
                      <AvatarFallback>Bot</AvatarFallback>
                      <AvatarBadge className="bg-green-600 dark:bg-green-800" />
                    </Avatar>
                  </Bubble>
                  <motion.div
                    animate={{ y: [0, -12, 0] }}
                    transition={{ repeat: Infinity, duration: 3 }}
                    className="absolute -bottom-6 -right-6 w-14 h-14 rounded-full bg-black flex items-center justify-center shadow-xl text-white"
                  >
                    <MessageCircle />
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section
          id="feature"
          className="bg-zinc-50 py-28 px-6 border-t border-zinc-200"
        >
          <div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false }}
              transition={{ duration: 0.5 }}
              className="text-3xl font-semibold text-center"
            >
              Why Businesses Choose Us?
            </motion.h2>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-10">
              {features.map((feat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  viewport={{ once: true }}
                  className="p-8 shadow-lg border border-zinc-200 rounded-2xl"
                >
                  <h1 className="text-lg font-medium">{feat.title}</h1>
                  <p className="mt-3 text-zinc-600 text-sm">{feat.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <footer className="py-10 text-center text-sm text-zinc-600">
          &copy; {new Date().getFullYear()} Support Ease. All rights reserved
        </footer>
      </div>
    </div>
  );
};

export default HomeClient;

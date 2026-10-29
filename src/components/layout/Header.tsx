"use client";
import { motion } from "motion/react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "../ui/dropdown-menu";
import {
  User,
  CreditCardIcon,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react";
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
} from "../ui/alert-dialog";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"

type HeaderProps = {
  userProfile: any;
  loading?: boolean;
  onLogin?: () => void;
};

export const Header = ({ userProfile, loading, onLogin }: HeaderProps) => {
  const firstName = userProfile?.firstName[0].toUpperCase();
  const lastName = userProfile?.lastName[0].toUpperCase();
  const [openDialog, setOpenDialog] = useState(false);
  const router = useRouter();
  const [localLoading, setLocalLoading] = useState(false);
  const [openProfile, setOpenProfile] = useState(false);
  const [openBilling, setOpenBilling] = useState(false);


  const handleLogin = () => {
    if (onLogin) {
      onLogin();
      return;
    }

    setLocalLoading(true);
    window.location.href = "/api/auth/login";
  };

  const handleLogout = () => {
    window.location.href = "/api/auth/logout";
  };

  return (
    <motion.div
      initial={{ y: -70 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.7 }}
      className="fixed top-0 left-0 w-full z-50 bg-white/70 backdrop-blur-xl border-b border-zinc-200"
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div
          className="text-lg tracking-tight font-semibold cursor-pointer"
          onClick={() => router.push("/")}
        >
          ping<span className="text-zinc-400">it</span>
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
                  <DropdownMenuItem onMouseOver={() => setOpenProfile(!openProfile)} onMouseLeave={() => setOpenProfile(false)}>
                    <UserIcon />
                    Profile
                  </DropdownMenuItem>
                  <HoverCard open={openProfile} onOpenChange={setOpenProfile}>
                    <HoverCardTrigger
                      delay={10}
                      closeDelay={100}
                    />
                    <HoverCardContent className="flex w-64 flex-col gap-0.5">
                      <div className="font-semibold">Coming Soon</div>
                      <div>
                        Working on it please have patience
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                  <DropdownMenuItem onMouseOver={() => setOpenBilling(!openBilling)} onMouseLeave={() => setOpenBilling(false)}>
                    <CreditCardIcon />
                    Billing
                  </DropdownMenuItem>
                  <HoverCard open={openBilling} onOpenChange={setOpenBilling}>
                    <HoverCardTrigger
                      delay={10}
                      closeDelay={100}
                    />
                    <HoverCardContent className="flex w-64 flex-col gap-0.5">
                      <div className="font-semibold">Free</div>
                      <div>
                        Only for 1st phase tester till 2027
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                  <DropdownMenuItem onClick={() => router.push("/dashboard")}>
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
                  <AlertDialogTitle>Log out of your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You will need to log back in to access your dashboard, saved
                    preferences, and account settings.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel
                    variant="outline"
                    className="hover:cursor-pointer"
                  >
                    Stay logged in
                  </AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={handleLogout}
                    className="hover:cursor-pointer"
                  >
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
            disabled={loading ?? localLoading}
          >
            Login
          </Button>
        )}
      </div>
    </motion.div>
  );
};

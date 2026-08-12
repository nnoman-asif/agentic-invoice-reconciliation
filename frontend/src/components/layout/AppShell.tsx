import { Outlet } from "react-router-dom"
import { motion } from "framer-motion"

import { Sidebar } from "./Sidebar"
import { TopBar } from "./TopBar"
import { MobileSidebar } from "./MobileSidebar"
import { SystemLimitedBanner } from "./SystemLimitedBanner"
import { useMediaQuery } from "@/hooks/useMediaQuery"

export function AppShell() {
  const isDesktop = useMediaQuery("(min-width: 1024px)")

  return (
    <div className="flex min-h-screen bg-background">
      {isDesktop && <Sidebar />}
      {!isDesktop && <MobileSidebar />}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <SystemLimitedBanner />
        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10"
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  )
}

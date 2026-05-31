import Sidebar from "@/components/sidebar";
import MobileTabBar from "@/components/mobile-tab-bar";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Desktop: sidebar. Mobile: bottom tab bar (app-style), no sidebar/header. */}
      <Sidebar className="hidden lg:flex" />
      <main className="h-full pb-28 lg:pb-0 lg:pl-[256px]">
        <div className="mx-auto h-full max-w-[1056px] pt-6">{children}</div>
      </main>
      <MobileTabBar />
    </>
  );
}

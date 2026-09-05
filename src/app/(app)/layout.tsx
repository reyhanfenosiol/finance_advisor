import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar userEmail={user.email} />
      <main className="min-w-0 flex-1 px-9 py-8 pb-16">{children}</main>
    </div>
  );
}

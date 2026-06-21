import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getSession } from "@/lib/session";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <>
      <Navbar session={session ? { role: session.role, name: session.name } : null} />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}

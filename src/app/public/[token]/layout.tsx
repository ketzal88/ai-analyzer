import "@/app/globals.css";

export const metadata = {
  title: "Worker Brain — Client Dashboard",
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-stellar text-white">
      {children}
    </div>
  );
}

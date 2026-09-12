import { notFound } from "next/navigation";
import { ArchiveBoard } from "@/components/ArchiveBoard";
import { getArchiveStore } from "@/lib/archive/store";

export const dynamic = "force-dynamic";

export default async function ArchivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const archive = await getArchiveStore().get(id);
  if (!archive) notFound();
  return (
    <div className="h-svh">
      <ArchiveBoard archive={archive} />
    </div>
  );
}

import { notFound } from "next/navigation";
import { ArchiveBoard } from "@/components/ArchiveBoard";
import { getArchiveStore } from "@/lib/archive/store";
import { boardViewFromParam } from "@/lib/board-view";

export const dynamic = "force-dynamic";

export default async function ArchivePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ phase?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const archive = await getArchiveStore().get(id);
  if (!archive) notFound();
  return (
    <div className="h-svh">
      <ArchiveBoard
        archive={archive}
        initialView={boardViewFromParam(query.phase)}
      />
    </div>
  );
}

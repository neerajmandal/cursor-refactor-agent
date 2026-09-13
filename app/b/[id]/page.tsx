import { BoardEntry } from "@/components/BoardEntry";
import { boardViewFromParam } from "@/lib/board-view";

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ phase?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return (
    <div className="h-svh">
      <BoardEntry boardId={id} initialView={boardViewFromParam(query.phase)} />
    </div>
  );
}

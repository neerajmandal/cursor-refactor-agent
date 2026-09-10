import { BoardEntry } from "@/components/BoardEntry";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="h-svh">
      <BoardEntry boardId={id} />
    </div>
  );
}

import { ProjectList } from "@/components/ProjectList";
import { getArchiveStore } from "@/lib/archive/store";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const archives = await getArchiveStore().list();

  return (
    <main className="px-8 py-10 md:px-12 md:py-12">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
        Projects
      </p>
      <h1 className="mt-3 font-serif text-4xl tracking-tight text-ink">
        Saved refactors
      </h1>
      <p className="mt-4 max-w-lg text-[15px] leading-6 text-muted">
        Every migration snapshot is stored locally or in the online database so you
        can reopen the architecture and evidence later.
      </p>

      {archives.length ? (
        <ProjectList archives={archives} />
      ) : (
        <p className="mt-10 max-w-md text-sm leading-6 text-muted">
          No saved refactors yet. Start from New refactor — completed and in-progress
          boards will show up here.
        </p>
      )}
    </main>
  );
}

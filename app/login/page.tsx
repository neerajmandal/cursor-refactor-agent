import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-svh items-center justify-center text-sm text-muted">
          Loading…
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { hasSession } from "@/lib/auth";

export default async function LoginPage() {
  if (await hasSession()) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
            D
          </div>
          <h1 className="text-xl font-semibold">Sign in to Dedupe</h1>
          <p className="mt-1 text-sm text-muted">Find duplicates and keep the right data.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}

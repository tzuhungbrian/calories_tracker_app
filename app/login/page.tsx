import { Suspense } from "react";
import { LoginForm } from "@/components/login_form";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-slate-950" />}>
      <LoginForm />
    </Suspense>
  );
}

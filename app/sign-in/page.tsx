import { SignInForm } from "./sign-in-form";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/";
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">SCM Category Management 1</p>
        <h1>TPEC CM1 PO Monitoring</h1>
        <p>Sign in with an approved workspace email to open the PO register.</p>
        {params.error && <p className="auth-error">That sign-in link has expired or is invalid. Request a new one.</p>}
        <SignInForm next={next} />
      </section>
    </main>
  );
}

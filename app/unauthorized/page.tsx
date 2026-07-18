import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Access restricted</p>
        <h1>Your account is not in this workspace</h1>
        <p>Ask a PO Monitoring administrator to add your work email, then sign in again.</p>
        <Link href="/sign-in">Return to sign in</Link>
      </section>
    </main>
  );
}

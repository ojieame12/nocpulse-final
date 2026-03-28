import Link from "next/link";

type CheckEmailScreenProps = {
  email?: string;
  nextPath?: string;
};

export function CheckEmailScreen({
  email,
  nextPath = "/",
}: CheckEmailScreenProps) {
  return (
    <main>
      <div className="shell">
        <section className="hero">
          <span className="pill">Check your email</span>
          <h1>Magic link sent</h1>
          <p>
            {email
              ? `A sign-in link was requested for ${email}.`
              : "A sign-in link was requested for your email address."}
          </p>
          <p>
            After you open the link, Supabase redirects back through
            <code> /auth/callback</code> and then returns you to the app.
          </p>
        </section>

        <section className="grid">
          <article className="panel">
            <h2>Next destination</h2>
            <p>
              After callback completion, the browser will return to
              <code> {nextPath}</code>.
            </p>
          </article>

          <article className="panel">
            <h2>Need another link?</h2>
            <p>
              <Link href={`/auth/sign-in?next=${encodeURIComponent(nextPath)}`}>
                Send another email
              </Link>
            </p>
            <p>
              <Link href={nextPath}>Return without signing in</Link>
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}

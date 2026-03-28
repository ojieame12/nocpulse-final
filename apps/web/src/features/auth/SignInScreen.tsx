import Link from "next/link";
import { EmailSignInForm } from "./EmailSignInForm";

type SignInScreenProps = {
  nextPath?: string;
};

export function SignInScreen({ nextPath = "/" }: SignInScreenProps) {
  return (
    <main>
      <div className="shell">
        <section className="hero">
          <span className="pill">Supabase Auth</span>
          <h1>Sign in</h1>
          <p>
            Use the email sign-in route to request a magic link. After the callback
            completes, the server shell will resolve your actor from the Supabase
            session instead of the development fallback.
          </p>
        </section>

        <section className="grid">
          <article className="panel">
            <h2>Email sign-in</h2>
            <EmailSignInForm nextPath={nextPath} />
          </article>

          <article className="panel">
            <h2>After sign-in</h2>
            <ul>
              <li>The email link redirects through <code>/auth/callback</code>.</li>
              <li>The server proxy refreshes the Supabase auth session cookies.</li>
              <li>The home route resolves your actor from workspace membership.</li>
            </ul>
            <p>
              <Link href="/">Back to home</Link>
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}

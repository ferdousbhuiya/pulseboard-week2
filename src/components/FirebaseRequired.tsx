import React from "react";

export default function FirebaseRequired() {
  return (
    <main className="shell">
      <section className="hero-card setup-card">
        <p className="eyebrow">Firebase required</p>
        <h1>Configure the backend before running the app.</h1>
        <p>
          Copy <strong>.env.example</strong> to <strong>.env</strong>, fill in your Firebase project values, and
          enable Email/Password authentication in the Firebase console.
        </p>
        <ul className="setup-list">
          <li>Create a Firestore database.</li>
          <li>Deploy the rules from <strong>firestore.rules</strong>.</li>
          <li>Restart <strong>npm run dev</strong> after adding the environment variables.</li>
        </ul>
      </section>
    </main>
  );
}

import Link from "next/link";

import { LatestPost } from "~/app/_components/post";
import { SessionInfo } from "~/app/_components/session-info";
import { api, HydrateClient } from "~/trpc/server";
import styles from "./index.module.css";

export default async function Home() {
  const hello = await api.post.hello({ text: "from tRPC" });
  const notes = await api.notes.getAll();

  void api.post.getLatest.prefetch();

  return (
    <HydrateClient>
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>
            Create <span className={styles.pinkSpan}>T3</span> App
          </h1>
          <div className={styles.cardRow}>
            <Link
              className={styles.card}
              href="https://create.t3.gg/en/usage/first-steps"
              target="_blank"
            >
              <h3 className={styles.cardTitle}>First Steps →</h3>
              <div className={styles.cardText}>
                Just the basics - Everything you need to know to set up your
                database and authentication.
              </div>
            </Link>
            <Link
              className={styles.card}
              href="https://create.t3.gg/en/introduction"
              target="_blank"
            >
              <h3 className={styles.cardTitle}>Documentation →</h3>
              <pre className={styles.cardText}>
                {JSON.stringify(notes, null, 2)}
              </pre>
            </Link>
          </div>
          <div className={styles.showcaseContainer}>
            <p className={styles.showcaseText}>
              {hello ? hello.greeting : "Loading tRPC query..."}
            </p>
            <SessionInfo />
          </div>

          <LatestPost />
        </div>
      </main>
    </HydrateClient>
  );
}

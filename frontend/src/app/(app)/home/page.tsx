import { InboxView } from "@/components/home/InboxView";

/** Default home view — same as /home/inbox (avoids redirect-only 404 edge cases). */
export default function HomePage() {
  return <InboxView />;
}

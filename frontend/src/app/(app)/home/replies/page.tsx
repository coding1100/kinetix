import { redirect } from "next/navigation";

export default function RepliesPage() {
  redirect("/home/inbox?tab=replies");
}

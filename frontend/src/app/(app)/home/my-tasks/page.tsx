import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const CARDS = [
  { title: "Assigned to me", href: "/home/my-tasks/assigned", desc: "Tasks assigned to you" },
  { title: "Today & Overdue", href: "/home/my-tasks/today", desc: "Agenda and due items" },
  { title: "Personal List", href: "/home/my-tasks/personal", desc: "Quick personal todos" },
  { title: "LineUp", href: "/home/my-tasks/lineup", desc: "Do ASAP" },
  { title: "Reminders", href: "/home/my-tasks/reminders", desc: "Upcoming reminders" },
  { title: "Recents", href: "/home/my-tasks/recents", desc: "Recently opened" },
];

export default function MyTasksHubPage() {
  return (
    <>
      <PageHeader title="My Tasks" />
      <div className="flex-1 overflow-y-auto p-6">
        <p className="mb-4 text-sm text-muted-foreground">
          Good morning — here&apos;s your day.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((c) => (
            <Link key={c.href} href={c.href}>
              <Card className="transition-colors hover:border-primary/50 hover:shadow-md">
                <CardHeader>
                  <CardTitle className="text-primary">{c.title}</CardTitle>
                  <CardDescription>{c.desc}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

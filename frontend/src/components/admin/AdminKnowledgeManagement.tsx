"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import {
  createCompanyDocument,
  listCompanyDocuments,
  deleteCompanyDocument,
  type CompanyDocumentDto,
} from "@/lib/api/ai";
import {
  PlusIcon,
  Trash2Icon,
  FileTextIcon,
  SparklesIcon,
  ShieldCheckIcon,
  BookOpenIcon,
  SearchIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatRequestError } from "@/lib/api/client";

const SAMPLE_TEMPLATES = [
  {
    title: "Employee Annual Leave & PTO Policy 2026",
    category: "HR",
    content:
      "All full-time employees receive 20 days of paid annual leave per calendar year. Leave requests must be submitted through Kinetix at least 5 business days in advance for approval by your team manager. Unused leave of up to 5 days can be carried over to the following year. Employees also receive 10 days of paid sick leave per year, which requires a medical certificate if absent for more than 2 consecutive days.",
  },
  {
    title: "IT Equipment & VPN Security SOP",
    category: "IT",
    content:
      "Company laptops and credentials must be secured at all times. Employees connecting remotely must use the official corporate VPN with multi-factor authentication (MFA) enabled. Hardware replacement requests or technical issues should be reported directly to the #it-support channel. Password changes are enforced every 90 days, requiring a minimum length of 12 characters with special symbols.",
  },
  {
    title: "Remote Work & Flexible Hours Policy",
    category: "Policy",
    content:
      "Kinetix operates under a hybrid-flexible work model. Core collaboration hours are set between 10:00 AM and 4:00 PM local time. Employees working remotely must maintain an active status on Kinetix chat and update their calendar status for planned absences or out-of-office blocks.",
  },
];

export function AdminKnowledgeManagement() {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [documents, setDocuments] = useState<CompanyDocumentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("HR");
  const [content, setContent] = useState("");

  const loadDocs = async () => {
    if (!ready || !accessToken || !workspaceId) return;
    setLoading(true);
    try {
      const res = await listCompanyDocuments(accessToken, workspaceId);
      setDocuments(res.data);
    } catch (err) {
      toast.error(`Failed to load knowledge documents — ${formatRequestError(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDocs();
  }, [ready, accessToken, workspaceId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !ready || !accessToken || !workspaceId) return;

    setSubmitting(true);
    try {
      await createCompanyDocument(accessToken, workspaceId, {
        title,
        category,
        content,
      });
      toast.success("Document successfully indexed into AI Knowledge Base!");
      setTitle("");
      setContent("");
      setShowAddForm(false);
      void loadDocs();
    } catch (err) {
      toast.error(`Failed to add document — ${formatRequestError(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoadSample = (template: typeof SAMPLE_TEMPLATES[0]) => {
    setTitle(template.title);
    setCategory(template.category);
    setContent(template.content);
    setShowAddForm(true);
    toast.info(`Loaded "${template.title}" template into editor.`);
  };

  const handleDelete = async (id: string, docTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${docTitle}"?`)) return;
    if (!ready || !accessToken || !workspaceId) return;

    try {
      await deleteCompanyDocument(accessToken, workspaceId, id);
      toast.success("Document removed from Knowledge Base");
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      toast.error(`Failed to delete document — ${formatRequestError(err)}`);
    }
  };

  const filteredDocs = documents.filter(
    (d) =>
      d.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      d.category.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <Card className="w-full max-w-4xl border-border shadow-md">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4 bg-gradient-to-r from-indigo-50/50 via-card to-background dark:from-indigo-950/20">
        <div>
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <ShieldCheckIcon className="size-5 text-indigo-600" />
            Company Knowledge Base & Policy Manager
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            Index official company policy documents, HR handbooks, and IT SOPs into the AI RAG engine.
          </CardDescription>
        </div>
        <Button
          size="sm"
          className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm"
          onClick={() => setShowAddForm((v) => !v)}
        >
          <PlusIcon className="size-4" />
          {showAddForm ? "Close Editor" : "Add Policy Document"}
        </Button>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Document Editor Form */}
        {showAddForm && (
          <form
            onSubmit={handleCreate}
            className="space-y-4 rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/60 via-card to-purple-50/20 p-5 dark:border-indigo-900/40 dark:from-indigo-950/30 dark:to-purple-950/20 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                <SparklesIcon className="size-4 text-indigo-500" />
                Add & Index Policy Document
              </h4>

              {/* Sample Template Quick Loaders */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground font-medium">Quick Template:</span>
                {SAMPLE_TEMPLATES.map((tmpl, idx) => (
                  <Button
                    key={idx}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2 py-0"
                    onClick={() => handleLoadSample(tmpl)}
                  >
                    {tmpl.category} Sample
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold text-foreground">Document Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Employee Annual Leave & PTO Policy 2026"
                  className="h-9 text-xs mt-1 bg-background"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-foreground">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground mt-1"
                >
                  <option value="HR">HR & Benefits</option>
                  <option value="IT">IT & Security</option>
                  <option value="Policy">Company Policy</option>
                  <option value="General">General Guidelines</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-foreground">Document Text Content</label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste the full text of the policy or handbook document..."
                className="min-h-[140px] text-xs mt-1 bg-background leading-relaxed"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting || !title.trim() || !content.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 font-semibold"
              >
                {submitting ? <Spinner className="size-3.5" /> : <SparklesIcon className="size-3.5" />}
                Save & Index Vector
              </Button>
            </div>
          </form>
        )}

        {/* Search & Filter Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search indexed documents..."
              className="pl-8 h-9 text-xs bg-background"
            />
          </div>
          <Badge variant="secondary" className="text-xs font-semibold">
            {documents.length} Total Indexed Documents
          </Badge>
        </div>

        {/* Document Cards List */}
        {loading ? (
          <div className="flex h-36 items-center justify-center">
            <Spinner className="size-7 text-indigo-600" />
          </div>
        ) : filteredDocs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-start justify-between rounded-xl border border-border bg-card p-4 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-800 transition-all group"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <FileTextIcon className="size-4 text-indigo-600 shrink-0" />
                    <h5 className="font-bold text-xs text-foreground truncate">{doc.title}</h5>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] py-0 px-2 bg-muted/40 font-medium">
                      {doc.category}
                    </Badge>
                    <span>Indexed {new Date(doc.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-70 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDelete(doc.id, doc.title)}
                  title="Delete Document"
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-muted-foreground space-y-3 border border-dashed border-border rounded-xl bg-muted/10">
            <BookOpenIcon className="mx-auto size-9 text-muted-foreground/50" />
            <p className="font-semibold text-foreground">No policy documents found</p>
            <p className="max-w-md mx-auto text-muted-foreground">
              Click **"Add Policy Document"** above or use a **"Quick Template"** to populate the AI Knowledge Base with sample company policies.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 mt-2"
              onClick={() => handleLoadSample(SAMPLE_TEMPLATES[0])}
            >
              <SparklesIcon className="size-3.5 text-indigo-500" />
              Load Sample HR Policy
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
